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
