import { beforeEach, describe, expect, it } from "vitest";
import { galleryDecision, remindVolunteers, volunteerConfirmed, type Mailer } from "./hub-notify";
import { createHubHarness, type HubHarness } from "./test-hub";

let h: HubHarness;
beforeEach(() => { h = createHubHarness(); });

const json = async (r: Response) => (await r.json()) as any;
const mailer = (): Mailer => ({ baseUrl: "https://site.test", sendBatch: async m => { h.batches.push(m); } });

async function setup() {
  const a = await h.signIn("a@x.ma");
  const b = await h.signIn("b@x.ma");
  const post = await json(await h.call("POST", "/hub/posts", { token: a.session, body: { body: "Bonjour tout le monde" } }));
  return { a, b, postId: post.id as number };
}
const list = async (token: string) => json(await h.call("GET", "/hub/notifications", { token }));
const unread = async (token: string) => (await json(await h.call("GET", "/hub/notifications/unread", { token }))).unread as number;

describe("likes and comments", () => {
  it("a like notifies the author once (dedupe), never with an email address, no email by default", async () => {
    const { a, b, postId } = await setup();
    expect((await h.call("POST", `/hub/posts/${postId}/like`, { token: b.session })).status).toBe(200);
    const raw = await (await h.call("GET", "/hub/notifications", { token: a.session })).text();
    const n = JSON.parse(raw);
    expect(n.notifications).toHaveLength(1);
    expect(n.notifications[0]).toMatchObject({ type: "like", read: false });
    expect(n.notifications[0].title).toContain("Amina B.");
    expect(raw).not.toContain("b@x.ma");
    expect(h.batches).toHaveLength(0);
    await h.call("POST", `/hub/posts/${postId}/like`, { token: b.session }); // unlike
    await h.call("POST", `/hub/posts/${postId}/like`, { token: b.session }); // relike
    expect((await list(a.session)).notifications).toHaveLength(1);
    expect(await unread(a.session)).toBe(1);
  });

  it("liking your own post does not notify", async () => {
    const { a, postId } = await setup();
    await h.call("POST", `/hub/posts/${postId}/like`, { token: a.session });
    expect((await list(a.session)).notifications).toHaveLength(0);
  });

  it("a comment notifies the author and emails escaped content in one batch", async () => {
    const { a, b, postId } = await setup();
    await h.call("POST", `/hub/posts/${postId}/comments`, { token: b.session, body: { body: "<b>hi</b>" } });
    expect((await list(a.session)).notifications[0]).toMatchObject({ type: "comment" });
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(1);
    expect(h.batches[0][0].to).toBe("a@x.ma");
    expect(h.batches[0][0].html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(h.batches[0][0].html).not.toContain("<b>hi</b>");
  });
});

describe("preferences", () => {
  it("defaults, update, validation; an email-off type still records the in-app row", async () => {
    const { a, b, postId } = await setup();
    const prefs = await json(await h.call("GET", "/hub/notifications/prefs", { token: a.session }));
    expect(prefs).toEqual({ prefs: { like: false, comment: true, gallery: true, announcement: true, volunteer: true } });
    expect((await h.call("PUT", "/hub/notifications/prefs", { token: a.session, body: { comment: false } })).status).toBe(200);
    await h.call("POST", `/hub/posts/${postId}/comments`, { token: b.session, body: { body: "salut" } });
    expect((await list(a.session)).notifications).toHaveLength(1);
    expect(h.batches).toHaveLength(0);
    expect((await h.call("PUT", "/hub/notifications/prefs", { token: a.session, body: { comment: "yes" } })).status).toBe(400);
    expect((await h.call("PUT", "/hub/notifications/prefs", { token: a.session, body: { nope: true } })).status).toBe(400);
  });
});

describe("read state and auth", () => {
  it("marks one or all as read, is scoped to the member, caps ids at 50, needs a session", async () => {
    const { a, b, postId } = await setup();
    await h.call("POST", `/hub/posts/${postId}/like`, { token: b.session });
    await h.call("POST", `/hub/posts/${postId}/comments`, { token: b.session, body: { body: "salut" } });
    const items = (await list(a.session)).notifications as { id: number }[];
    expect(items).toHaveLength(2);
    expect(await unread(a.session)).toBe(2);

    await h.call("POST", "/hub/notifications/read", { token: b.session, body: { ids: items.map(i => i.id) } });
    expect(await unread(a.session)).toBe(2);

    const one = await json(await h.call("POST", "/hub/notifications/read", { token: a.session, body: { ids: [items[0].id] } }));
    expect(one.unread).toBe(1);
    const all = await json(await h.call("POST", "/hub/notifications/read", { token: a.session, body: {} }));
    expect(all.unread).toBe(0);

    expect((await h.call("POST", "/hub/notifications/read", { token: a.session, body: { ids: Array.from({ length: 51 }, (_, i) => i + 1) } })).status).toBe(400);
    for (const [method, path] of [["GET", "/hub/notifications"], ["GET", "/hub/notifications/unread"], ["POST", "/hub/notifications/read"], ["GET", "/hub/notifications/prefs"], ["PUT", "/hub/notifications/prefs"]] as const) {
      expect((await h.call(method, path, method === "GET" ? {} : { body: {} })).status).toBe(401);
    }
  });
});

describe("announcements", () => {
  it("fans out to active members only (not the team account, not suspended) with one batch", async () => {
    const a = await h.signIn("a@x.ma");
    const b = await h.signIn("b@x.ma");
    const c = await h.signIn("c@x.ma");
    h.sqlite.prepare("UPDATE hub_members SET status = 'suspended' WHERE id = ?").run(c.member.id);
    const r = await h.call("POST", "/hub/admin/posts", { admin: "admin", body: { body: "Réunion samedi", pinned: true } });
    expect(r.status).toBe(200);
    expect((await list(a.session)).notifications.filter((n: any) => n.type === "announcement")).toHaveLength(1);
    expect((await list(b.session)).notifications.filter((n: any) => n.type === "announcement")).toHaveLength(1);
    const rows = h.sqlite.prepare("SELECT member_id FROM hub_notifications WHERE type = 'announcement'").all() as { member_id: number }[];
    expect(rows.map(x => x.member_id).sort()).toEqual([a.member.id, b.member.id].sort());
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].map(m => m.to).sort()).toEqual(["a@x.ma", "b@x.ma"]);
  });
});

describe("gallery decision", () => {
  it("notifies the proposing member once per outcome; unknown photo is ignored", async () => {
    const a = await h.signIn("a@x.ma");
    h.sqlite.prepare("INSERT INTO hub_gallery_proposals (r2_key, member_id, gallery_photo_id, created_at) VALUES ('1/x.jpg', ?, 'g1', '2026-10-09T00:00:00Z')").run(a.member.id);
    expect(await galleryDecision(h.d, mailer(), "g1", "published", h.clock)).toBe(1);
    const n = (await list(a.session)).notifications;
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ type: "gallery" });
    expect(n[0].title).toContain("publiée");
    expect(await galleryDecision(h.d, mailer(), "g1", "published", h.clock)).toBe(0);
    expect((await list(a.session)).notifications).toHaveLength(1);
    expect(await galleryDecision(h.d, mailer(), "g1", "rejected", h.clock)).toBe(1);
    expect((await list(a.session)).notifications).toHaveLength(2);
    expect(await galleryDecision(h.d, mailer(), "nope", "published", h.clock)).toBeNull();
    expect((h.sqlite.prepare("SELECT COUNT(*) AS n FROM hub_notifications").get() as { n: number }).n).toBe(2);
  });
});

describe("volunteer confirmation and reminders", () => {
  const day = (date: string, iftar = "18:45") => Number(h.sqlite.prepare("INSERT INTO t_ramadan_days (date, iftar_time) VALUES (?,?)").run(date, iftar).lastInsertRowid);

  it("confirmation mentions the date; a volunteer without a hub member is ignored", async () => {
    const d1 = day("2027-02-20");
    const va = h.vol("a@x.ma", "confirmed", d1);
    const a = await h.signIn("a@x.ma");
    const vn = h.vol("nomember@x.ma", "confirmed", d1);
    expect(await volunteerConfirmed(h.d, mailer(), va, h.clock)).toBe(1);
    const n = (await list(a.session)).notifications;
    expect(n[0]).toMatchObject({ type: "volunteer" });
    expect(n[0].body).toContain("20/02/2027");
    expect(await volunteerConfirmed(h.d, mailer(), vn, h.clock)).toBeNull();
  });

  it("reminds confirmed volunteers with a hub member for the given day, once", async () => {
    const d1 = day("2027-02-20");
    const d2 = day("2027-02-21");
    h.vol("a@x.ma", "confirmed", d1);
    const a = await h.signIn("a@x.ma");
    h.vol("nomember@x.ma", "confirmed", d1);
    h.vol("b@x.ma", "confirmed", d1);
    await h.signIn("b@x.ma");
    h.sqlite.prepare("UPDATE t_volunteers SET status = 'registered' WHERE lower(email) = 'b@x.ma'").run();
    h.vol("c@x.ma", "confirmed", d2);
    await h.signIn("c@x.ma");

    expect(await remindVolunteers(h.d, mailer(), "2027-02-20", h.clock)).toBe(1);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(1);
    expect(h.batches[0][0].to).toBe("a@x.ma");
    const n = (await list(a.session)).notifications;
    expect(n[0].title).toContain("20/02");
    expect(n[0].body).toContain("18:45");
    expect(await remindVolunteers(h.d, mailer(), "2027-02-20", h.clock)).toBe(0);
  });
});
