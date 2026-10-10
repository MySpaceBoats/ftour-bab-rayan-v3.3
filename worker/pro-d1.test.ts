import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "./gallery-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import * as h from "./hub-d1";
import * as pro from "./pro-d1";

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string, first = "Amina", role?: "moderator") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  if (role) sqlite.prepare("UPDATE hub_members SET role=? WHERE email=?").run(role, email);
  return (await h.getSession(d, session, T0 + 1))!;
}
const suspend = (id: number) => sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(id);

beforeEach(() => {
  sqlite = openDb();
  d = fakeD1(sqlite);
});

describe("pro profile", () => {
  it("returns defaults, then saves and normalises", async () => {
    const a = await member("a@x.ma");
    expect(await pro.getProfile(d, a.id, a.id)).toMatchObject({ headline: "", company: "", skills: [], open_to_work: false, mine: true });
    await pro.saveProfile(d, a, { headline: " Dev ", company: "Acme", city: "Rabat", skills: ["React", " react ", "", "SQL"], open_to_work: true }, T0);
    expect(await pro.getProfile(d, a.id, a.id)).toMatchObject({ headline: "Dev", company: "Acme", city: "Rabat", skills: ["React", "SQL"], open_to_work: true });
  });

  it("saving twice updates the same row", async () => {
    const a = await member("a@x.ma");
    await pro.saveProfile(d, a, { headline: "A" }, T0);
    await pro.saveProfile(d, a, { headline: "B" }, T0 + 1);
    expect((await pro.getProfile(d, a.id, a.id)).headline).toBe("B");
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM pro_profiles").get() as { n: number }).n).toBe(1);
  });

  it("rejects invalid input", async () => {
    const a = await member("a@x.ma");
    const bad: Record<string, unknown>[] = [
      { headline: "x".repeat(81) }, { company: "x".repeat(81) }, { city: "x".repeat(61) },
      { skills: Array.from({ length: 9 }, (_, i) => `s${i}`) }, { skills: ["x".repeat(31)] }, { skills: "react" }, { skills: [1] }, { company: 5 },
    ];
    for (const b of bad) await expect(pro.saveProfile(d, a, b, T0)).rejects.toMatchObject({ code: "invalid" });
  });

  it("is visible to other members; suspended or unknown members are not found", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "Dev" }, T0);
    expect(await pro.getProfile(d, b.id, a.id)).toMatchObject({ headline: "Dev", mine: false, member: { id: a.id } });
    suspend(a.id);
    await expect(pro.getProfile(d, b.id, a.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(pro.getProfile(d, b.id, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});

const post = (over: Partial<Parameters<typeof pro.createPost>[2]> = {}) => ({ body: "Bonjour le réseau", ...over });

describe("pro link", () => {
  it("accepts http(s) and rejects everything else", () => {
    expect(pro.cleanLink(undefined)).toBeNull();
    expect(pro.cleanLink("")).toBeNull();
    expect(pro.cleanLink(" https://example.com/a ")).toBe("https://example.com/a");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.ma", "pas un lien", 42, `https://x.ma/${"a".repeat(300)}`])
      expect(() => pro.cleanLink(bad)).toThrow(h.HubError);
  });
});

describe("pro feed", () => {
  it("creates posts and lists newest first with counters", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "Dev" }, T0);
    const p1 = await pro.createPost(d, a, post({ body: "premier" }), T0);
    const p2 = await pro.createPost(d, a, post({ body: "second", link: "https://example.com" }), T0 + 1);
    await pro.toggleLike(d, b.id, p2.id);
    await pro.addComment(d, b, p2.id, "bravo", T0 + 2);
    const f = await pro.feed(d, b.id);
    expect(f.posts.map(p => p.id)).toEqual([p2.id, p1.id]);
    expect(f.posts[0]).toMatchObject({ link: "https://example.com/", like_count: 1, comment_count: 1, liked: true, author: { id: a.id, headline: "Dev" } });
    expect(f.posts[1]).toMatchObject({ liked: false, like_count: 0 });
    expect(f.nextCursor).toBeNull();
  });

  it("paginates with a numeric cursor", async () => {
    const a = await member("a@x.ma");
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) ids.push((await pro.createPost(d, a, post({ body: `p${i}` }), T0 + i)).id);
    const first = await pro.feed(d, a.id, null, 2);
    expect(first.posts.map(p => p.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).toBe(ids[1]);
    const second = await pro.feed(d, a.id, first.nextCursor, 2);
    expect(second.posts.map(p => p.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
  });

  it("validates body and photos", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    for (const body of ["", "   ", "x".repeat(2001)]) await expect(pro.createPost(d, a, post({ body }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, post({ mediaPaths: Array.from({ length: 5 }, (_, i) => `${a.id}/${i}.jpg`) }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, post({ mediaPaths: [`${b.id}/x.jpg`] }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, post({ mediaPaths: [`${a.id}/../x.jpg`] }), T0)).rejects.toMatchObject({ code: "invalid" });
    const ok = await pro.createPost(d, a, post({ mediaPaths: [`${a.id}/a.jpg`, `${a.id}/b.png`] }), T0);
    expect((await pro.feed(d, a.id)).posts.find(p => p.id === ok.id)!.media).toEqual([`${a.id}/a.jpg`, `${a.id}/b.png`]);
  });

  it("limits posts to 10 per hour", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 10; i++) await pro.createPost(d, a, post(), T0);
    await expect(pro.createPost(d, a, post(), T0)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(pro.createPost(d, a, post(), T0 + HOUR + 1)).resolves.toBeDefined();
  });

  it("hides posts of suspended authors", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const p = await pro.createPost(d, a, post(), T0);
    suspend(a.id);
    expect((await pro.feed(d, b.id)).posts).toEqual([]);
    await expect(pro.toggleLike(d, b.id, p.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("pro likes and comments", () => {
  it("toggles likes", async () => {
    const a = await member("a@x.ma");
    const p = await pro.createPost(d, a, post(), T0);
    expect(await pro.toggleLike(d, a.id, p.id)).toEqual({ liked: true, count: 1 });
    expect(await pro.toggleLike(d, a.id, p.id)).toEqual({ liked: false, count: 0 });
  });

  it("adds, lists and removes comments (author or moderator only)", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const mod = await member("m@x.ma", "Sara", "moderator");
    const p = await pro.createPost(d, a, post(), T0);
    const c = await pro.addComment(d, b, p.id, "  super  ", T0);
    expect((await pro.listComments(d, p.id)).map(x => x.body)).toEqual(["super"]);
    await expect(pro.addComment(d, b, p.id, "", T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.removeContent(d, a, "comment", c.id)).rejects.toMatchObject({ code: "forbidden" });
    await pro.removeContent(d, mod, "comment", c.id);
    expect(await pro.listComments(d, p.id)).toEqual([]);
  });

  it("limits comments to 30 per hour", async () => {
    const a = await member("a@x.ma");
    const p = await pro.createPost(d, a, post(), T0);
    for (let i = 0; i < 30; i++) await pro.addComment(d, a, p.id, "c", T0);
    await expect(pro.addComment(d, a, p.id, "c", T0)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("removes a post: owner or moderator, not others", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const p = await pro.createPost(d, a, post(), T0);
    await expect(pro.removeContent(d, b, "post", p.id)).rejects.toMatchObject({ code: "forbidden" });
    await pro.removeContent(d, a, "post", p.id);
    expect((await pro.feed(d, a.id)).posts).toEqual([]);
    await expect(pro.removeContent(d, a, "post", p.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("pro reports", () => {
  it("reports, lists, dismisses and hides", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const p = await pro.createPost(d, a, post({ body: "contenu litigieux" }), T0);
    await pro.reportContent(d, b, "post", p.id, "spam");
    await pro.reportContent(d, b, "post", p.id, "spam encore"); // same reporter + target: ignored
    const reports = await pro.listReports(d);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ target_type: "post", target_id: p.id, reason: "spam", reporter: b.display_name, body: "contenu litigieux", target_status: "visible" });
    await pro.hideContent(d, "post", p.id);
    expect((await pro.listReports(d))[0].target_status).toBe("hidden");
    expect((await pro.feed(d, b.id)).posts).toEqual([]);
    await pro.dismissReport(d, reports[0].id);
    expect(await pro.listReports(d)).toEqual([]);
  });

  it("rejects unknown types, empty reasons and missing targets", async () => {
    const a = await member("a@x.ma");
    await expect(pro.reportContent(d, a, "member" as any, 1, "x")).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.reportContent(d, a, "post", 999, "x")).rejects.toMatchObject({ code: "not_found" });
    const p = await pro.createPost(d, a, post(), T0);
    await expect(pro.reportContent(d, a, "post", p.id, "  ")).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.hideContent(d, "post", 999)).rejects.toMatchObject({ code: "not_found" });
  });
});
