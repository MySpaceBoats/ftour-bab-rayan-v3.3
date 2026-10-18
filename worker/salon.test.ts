import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHubHarness, type HubHarness } from "./test-hub";

let h: HubHarness;
beforeEach(() => {
  h = createHubHarness();
  h.sqlite.exec(readFileSync(new URL("./d1/salon.sql", import.meta.url).pathname, "utf8"));
});

const get = async <T>(path: string, token: string, admin?: string) => (await h.call("GET", path, { token, admin })).json() as Promise<T>;
const bad = async (method: string, path: string, o: { token?: string; admin?: string; body?: unknown }, status: number, code: string) => {
  const res = await h.call(method, path, o);
  expect(res.status, `${method} ${path}`).toBe(status);
  expect(((await res.json()) as { error: string }).error).toBe(code);
};

describe("salon http", () => {
  it("requires auth, 404 on unknown path", async () => {
    expect((await h.call("GET", "/hub/salon/nope")).status).toBe(404);
    expect((await h.call("GET", "/hub/salon/salons")).status).toBe(401);
    expect((await h.call("POST", "/hub/salon/salons", { body: { title: "a", topic: "b" } })).status).toBe(401);
  });

  it("tracer: create, list (no room), detail (room), post, read feed", async () => {
    const a = await h.signIn("a@x.ma");
    const b = await h.signIn("b@x.ma");
    const created = await h.call("POST", "/hub/salon/salons", { token: a.session, body: { title: "Cuisine", topic: "Recettes" } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };

    const list = await get<{ salons: any[]; nextCursor: string | null }>("/hub/salon/salons", b.session);
    expect(list.salons).toHaveLength(1);
    expect(list.salons[0]).toMatchObject({ id, title: "Cuisine", topic: "Recettes", mine: false, post_count: 0, creator: { display_name: "Amina B." } });
    expect(JSON.stringify(list)).not.toMatch(/room|@x\.ma|avatar_key/);

    const det = await get<{ salon: any }>(`/hub/salon/salons/${id}`, b.session);
    expect(det.salon.room).toMatch(/^[a-f0-9]{32}$/);

    const posted = await h.call("POST", `/hub/salon/salons/${id}/posts`, { token: b.session, body: { body: "Salam <b>tous</b>" } });
    expect(posted.status).toBe(200);
    const feed = await get<{ posts: any[] }>(`/hub/salon/salons/${id}/posts`, a.session);
    expect(feed.posts[0]).toMatchObject({ body: "Salam <b>tous</b>", mine: false, author: { display_name: "Amina B." } });
    expect(JSON.stringify(feed)).not.toMatch(/@x\.ma|avatar_key/);
  });

  it("returns 400 invalid for bad ids, cursors and payloads (never 500)", async () => {
    const a = await h.signIn("a@x.ma");
    await bad("GET", "/hub/salon/salons/abc", { token: a.session }, 400, "invalid");
    await bad("GET", "/hub/salon/salons/0/posts", { token: a.session }, 400, "invalid");
    await bad("GET", "/hub/salon/salons?cursor=zzz", { token: a.session }, 400, "invalid");
    await bad("POST", "/hub/salon/salons", { token: a.session, body: { title: "", topic: "x" } }, 400, "invalid");
    await bad("GET", "/hub/salon/salons/9999", { token: a.session }, 404, "not_found");
    const { id } = (await (await h.call("POST", "/hub/salon/salons", { token: a.session, body: { title: "T", topic: "S" } })).json()) as { id: number };
    await bad("GET", `/hub/salon/salons/${id}/posts?cursor=abc`, { token: a.session }, 400, "invalid");
    await bad("POST", `/hub/salon/salons/${id}/posts`, { token: a.session, body: { body: "   " } }, 400, "invalid");
  });

  it("delete post, archive and conflict on posting to an archived salon", async () => {
    const a = await h.signIn("a@x.ma");
    const b = await h.signIn("b@x.ma");
    const { id } = (await (await h.call("POST", "/hub/salon/salons", { token: a.session, body: { title: "T", topic: "S" } })).json()) as { id: number };
    const { id: pid } = (await (await h.call("POST", `/hub/salon/salons/${id}/posts`, { token: b.session, body: { body: "x" } })).json()) as { id: number };

    await bad("DELETE", `/hub/salon/salons/${id}/posts/${pid}`, { token: a.session }, 403, "forbidden");
    expect((await h.call("DELETE", `/hub/salon/salons/${id}/posts/${pid}`, { token: b.session })).status).toBe(200);
    await bad("POST", `/hub/salon/salons/${id}/archive`, { token: b.session }, 403, "forbidden");
    expect((await h.call("POST", `/hub/salon/salons/${id}/archive`, { token: a.session })).status).toBe(200);
    await bad("POST", `/hub/salon/salons/${id}/posts`, { token: b.session, body: { body: "y" } }, 409, "conflict");
    expect((await get<{ salons: any[] }>("/hub/salon/salons", b.session)).salons).toEqual([]);
    expect((await get<{ salon: any }>(`/hub/salon/salons/${id}`, b.session)).salon.status).toBe("archived");
  });

  it("restricts the admin surface to admin roles; hide then delete", async () => {
    const a = await h.signIn("a@x.ma");
    const v = await h.signIn("v@x.ma");
    const { id } = (await (await h.call("POST", "/hub/salon/salons", { token: a.session, body: { title: "T", topic: "S" } })).json()) as { id: number };
    for (const [method, path, body] of [["GET", "/hub/salon/admin/salons", undefined], ["POST", "/hub/salon/admin/hide", { id }], ["POST", "/hub/salon/admin/delete", { id }]] as const) {
      for (const admin of [undefined, "member", "user"]) {
        expect((await h.call(method, path, { token: v.session, admin, body })).status, `${method} ${path} ${admin}`).toBe(403);
      }
    }
    const list = await get<{ salons: any[] }>("/hub/salon/admin/salons", v.session, "admin_ops");
    expect(list.salons[0]).toMatchObject({ id, title: "T", creator: "Amina B.", status: "active", post_count: 0 });
    expect(JSON.stringify(list)).not.toMatch(/room|@x\.ma/);

    expect((await h.call("POST", "/hub/salon/admin/hide", { token: v.session, admin: "admin", body: { id } })).status).toBe(200);
    expect((await get<{ salons: any[] }>("/hub/salon/salons", v.session)).salons).toEqual([]);
    await bad("GET", `/hub/salon/salons/${id}`, { token: v.session }, 404, "not_found");
    expect((await h.call("POST", "/hub/salon/admin/delete", { token: v.session, admin: "admin", body: { id } })).status).toBe(200);
    await bad("POST", "/hub/salon/admin/delete", { token: v.session, admin: "admin", body: { id } }, 404, "not_found");
    await bad("POST", "/hub/salon/admin/hide", { token: v.session, admin: "admin", body: {} }, 400, "invalid");
  });
});
