import { beforeEach, describe, expect, it } from "vitest";
import { createHubHarness, type HubHarness } from "./test-hub";
import type { FetchLike } from "./ai-core";

let h: HubHarness;
beforeEach(() => { h = createHubHarness(); });

const verdict = (v: unknown): FetchLike => async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(v) } }] }));
const bad = { violation: true, rule: "R2", confidence: 0.97, reason: "propos haineux" };
const bell = async (token: string) => ((await (await h.call("GET", "/hub/notifications", { token })).json()) as any).notifications as any[];

describe("moderation wired into the hub", () => {
  it("a violating post is hidden right after publication and the author is told", async () => {
    h.aiFetch = verdict(bad);
    const a = await h.signIn("a@x.ma");
    const mod = await h.signIn("mod@x.ma");
    h.sqlite.prepare("UPDATE hub_members SET role = 'moderator' WHERE id = ?").run(mod.member.id);

    const res = await h.call("POST", "/hub/posts", { token: a.session, body: { body: "texte haineux" } });
    expect(res.status).toBe(200); // publication itself still succeeds
    const { id } = (await res.json()) as { id: number };

    expect((h.sqlite.prepare("SELECT status FROM hub_posts WHERE id = ?").get(id) as any).status).toBe("hidden");
    expect((await bell(a.session)).some(n => n.title === "Votre publication a été masquée")).toBe(true);
    expect((await bell(mod.session)).some(n => n.title.includes("Modération IA"))).toBe(true);
    const feed = (await (await h.call("GET", "/hub/feed", { token: a.session })).json()) as any;
    expect(feed.posts.find((p: any) => p.id === id)).toBeUndefined();
  });

  it("a violating comment is hidden", async () => {
    const a = await h.signIn("a@x.ma");
    const b = await h.signIn("b@x.ma");
    h.aiFetch = verdict({ violation: false, rule: null, confidence: 0, reason: "" });
    const { id: postId } = (await (await h.call("POST", "/hub/posts", { token: a.session, body: { body: "Bonjour" } })).json()) as any;
    h.aiFetch = verdict(bad);
    const { id } = (await (await h.call("POST", `/hub/posts/${postId}/comments`, { token: b.session, body: { body: "haine" } })).json()) as any;
    expect((h.sqlite.prepare("SELECT status FROM hub_comments WHERE id = ?").get(id) as any).status).toBe("hidden");
  });

  it("a model outage never blocks publishing", async () => {
    h.aiFetch = async () => new Response("{}", { status: 503 });
    const a = await h.signIn("a@x.ma");
    const res = await h.call("POST", "/hub/posts", { token: a.session, body: { body: "Bonjour" } });
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: number };
    expect((h.sqlite.prepare("SELECT status FROM hub_posts WHERE id = ?").get(id) as any).status).toBe("visible");
    expect((h.sqlite.prepare("SELECT action FROM hub_moderation WHERE target_id = ?").get(id) as any).action).toBe("error");
  });

  it("without OPENROUTER_API_KEY the hub behaves as before (no moderation row)", async () => {
    delete h.env.OPENROUTER_API_KEY;
    const a = await h.signIn("a@x.ma");
    const { id } = (await (await h.call("POST", "/hub/posts", { token: a.session, body: { body: "Bonjour" } })).json()) as any;
    expect(h.sqlite.prepare("SELECT COUNT(*) AS n FROM hub_moderation WHERE target_id = ?").get(id)).toEqual({ n: 0 });
  });
});

describe("admin moderation routes", () => {
  async function hiddenPost() {
    h.aiFetch = verdict(bad);
    const a = await h.signIn("a@x.ma");
    const { id } = (await (await h.call("POST", "/hub/posts", { token: a.session, body: { body: "texte haineux" } })).json()) as { id: number };
    const row = h.sqlite.prepare("SELECT id FROM hub_moderation WHERE target_id = ?").get(id) as { id: number };
    return { a, postId: id, modId: row.id };
  }

  it("refuses non-admins", async () => {
    const { a } = await hiddenPost();
    expect((await h.call("GET", "/hub/admin/moderation", { token: a.session })).status).toBeGreaterThanOrEqual(401);
    expect((await h.call("GET", "/hub/admin/moderation", { admin: "user" })).status).toBe(403);
  });

  it("lists items to review with author and excerpt", async () => {
    const { modId } = await hiddenPost();
    const res = await h.call("GET", "/hub/admin/moderation?filter=review", { admin: "admin" });
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as any;
    expect(items).toEqual([expect.objectContaining({ id: modId, action: "hidden", rule: "R2", excerpt: "texte haineux", reviewed_at: null })]);
  });

  it("restore makes the post visible again, tells the author and is never re-analysed", async () => {
    const { a, postId, modId } = await hiddenPost();
    h.aiFetch = verdict(bad);
    const res = await h.call("POST", `/hub/admin/moderation/${modId}/restore`, { admin: "admin" });
    expect(res.status).toBe(200);
    expect((h.sqlite.prepare("SELECT status FROM hub_posts WHERE id = ?").get(postId) as any).status).toBe("visible");
    expect(h.sqlite.prepare("SELECT action, reviewed_at IS NOT NULL AS done FROM hub_moderation WHERE id = ?").get(modId)).toEqual({ action: "restored", done: 1 });
    expect((await bell(a.session)).some(n => n.title === "Votre publication a été rétablie")).toBe(true);
    const items = ((await (await h.call("GET", "/hub/admin/moderation?filter=review", { admin: "admin" })).json()) as any).items;
    expect(items).toHaveLength(0);
  });

  it("confirm on a hidden item only closes the review", async () => {
    const { postId, modId } = await hiddenPost();
    await h.call("POST", `/hub/admin/moderation/${modId}/confirm`, { admin: "admin" });
    expect((h.sqlite.prepare("SELECT status FROM hub_posts WHERE id = ?").get(postId) as any).status).toBe("hidden");
    expect((h.sqlite.prepare("SELECT reviewed_at IS NOT NULL AS done FROM hub_moderation WHERE id = ?").get(modId) as any).done).toBe(1);
  });

  it("confirm on a flagged item hides it and tells the author", async () => {
    h.aiFetch = verdict({ ...bad, confidence: 0.6 });
    const a = await h.signIn("a@x.ma");
    const { id: postId } = (await (await h.call("POST", "/hub/posts", { token: a.session, body: { body: "limite" } })).json()) as any;
    const modId = (h.sqlite.prepare("SELECT id FROM hub_moderation WHERE target_id = ?").get(postId) as any).id as number;
    expect((h.sqlite.prepare("SELECT status FROM hub_posts WHERE id = ?").get(postId) as any).status).toBe("visible");
    await h.call("POST", `/hub/admin/moderation/${modId}/confirm`, { admin: "admin" });
    expect((h.sqlite.prepare("SELECT status FROM hub_posts WHERE id = ?").get(postId) as any).status).toBe("hidden");
    expect(h.sqlite.prepare("SELECT action FROM hub_moderation WHERE id = ?").get(modId)).toEqual({ action: "hidden" });
    expect((await bell(a.session)).some(n => n.title === "Votre publication a été masquée")).toBe(true);
  });

  it("restore on a flagged item only closes the line, without telling the author", async () => {
    h.aiFetch = verdict({ ...bad, confidence: 0.6 });
    const a = await h.signIn("a@x.ma");
    const { id: postId } = (await (await h.call("POST", "/hub/posts", { token: a.session, body: { body: "limite" } })).json()) as any;
    const modId = (h.sqlite.prepare("SELECT id FROM hub_moderation WHERE target_id = ?").get(postId) as any).id as number;
    await h.call("POST", `/hub/admin/moderation/${modId}/restore`, { admin: "admin" });
    expect((await bell(a.session))).toHaveLength(0);
    expect(h.sqlite.prepare("SELECT action FROM hub_moderation WHERE id = ?").get(modId)).toEqual({ action: "restored" });
  });

  it("returns 404 for an unknown item", async () => {
    expect((await h.call("POST", "/hub/admin/moderation/9999/restore", { admin: "admin" })).status).toBe(404);
  });

  it("I3: errors appear in the review queue and can be dismissed", async () => {
    h.aiFetch = async () => new Response("{}", { status: 503 });
    const a = await h.signIn("a@x.ma");
    await h.call("POST", "/hub/posts", { token: a.session, body: { body: "Bonjour" } });
    const items = ((await (await h.call("GET", "/hub/admin/moderation?filter=review", { admin: "admin" })).json()) as any).items;
    expect(items).toEqual([expect.objectContaining({ action: "error" })]);
    expect((await h.call("POST", `/hub/admin/moderation/${items[0].id}/confirm`, { admin: "admin" })).status).toBe(200);
    expect(((await (await h.call("GET", "/hub/admin/moderation?filter=review", { admin: "admin" })).json()) as any).items).toHaveLength(0);
  });

  it("I5: a second restore of the same item is refused and sends no second message", async () => {
    const { a, modId } = await hiddenPost();
    expect((await h.call("POST", `/hub/admin/moderation/${modId}/restore`, { admin: "admin" })).status).toBe(200);
    expect((await h.call("POST", `/hub/admin/moderation/${modId}/restore`, { admin: "admin" })).status).toBeGreaterThanOrEqual(400);
    const msgs = h.sqlite.prepare("SELECT COUNT(*) AS n FROM pro_messages WHERE body LIKE '%rétablie%'").get() as any;
    expect(msgs.n).toBe(1);
    void a;
  });

  it("I4: confirming a flagged item the author deleted meanwhile does not tell the author it was masked", async () => {
    h.aiFetch = verdict({ ...bad, confidence: 0.6 });
    const a = await h.signIn("a@x.ma");
    const { id: postId } = (await (await h.call("POST", "/hub/posts", { token: a.session, body: { body: "limite" } })).json()) as any;
    const modId = (h.sqlite.prepare("SELECT id FROM hub_moderation WHERE target_id = ?").get(postId) as any).id as number;
    await h.call("DELETE", `/hub/posts/${postId}`, { token: a.session });
    await h.call("POST", `/hub/admin/moderation/${modId}/confirm`, { admin: "admin" });
    expect((await bell(a.session)).some(n => n.title === "Votre publication a été masquée")).toBe(false);
  });
});

