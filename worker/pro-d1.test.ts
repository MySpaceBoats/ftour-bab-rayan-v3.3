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

const job = (over: Partial<pro.JobInput> = {}): pro.JobInput => ({ title: "Développeur React", company: "Acme", city: "Casablanca", type: "cdi", description: "Nous recrutons.", contact: "rh@acme.ma", ...over });
/** Insert a job directly (bypasses the daily rate limit) for list/search/pagination tests. */
function rawJob(memberId: number, over: Record<string, unknown> = {}) {
  const o = { title: "Poste", company: "Co", city: "", type: "cdi", description: "desc", status: "open", ...over };
  return Number(sqlite.prepare("INSERT INTO pro_jobs (member_id,title,company,city,type,description,status) VALUES (?,?,?,?,?,?,?)")
    .run(memberId, o.title, o.company, o.city, o.type, o.description, o.status).lastInsertRowid);
}

describe("pro jobs: write", () => {
  it("creates a job and reads its detail (contact visible, mine flag)", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "RH" }, T0);
    const { id } = await pro.createJob(d, a, job(), T0);
    expect(await pro.getJob(d, a.id, id)).toMatchObject({ title: "Développeur React", company: "Acme", type: "cdi", status: "open", contact: "rh@acme.ma", mine: true, poster: { id: a.id, headline: "RH" } });
    expect((await pro.getJob(d, b.id, id)).mine).toBe(false);
  });

  it("validates input", async () => {
    const a = await member("a@x.ma");
    const bad: Partial<pro.JobInput>[] = [
      { title: "" }, { title: "x".repeat(81) }, { company: "" }, { company: "x".repeat(81) }, { city: "x".repeat(61) },
      { type: "interim" }, { description: "" }, { description: "x".repeat(3001) }, { contact: "x".repeat(121) }, { contact: 5 as any },
    ];
    for (const over of bad) await expect(pro.createJob(d, a, job(over), T0)).rejects.toMatchObject({ code: "invalid" });
  });

  it("limits to 3 jobs per 24 h", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 3; i++) await pro.createJob(d, a, job(), T0);
    await expect(pro.createJob(d, a, job(), T0)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(pro.createJob(d, a, job(), T0 + DAY + 1)).resolves.toBeDefined();
  });

  it("only the owner edits or closes; hidden jobs are gone", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id } = await pro.createJob(d, a, job(), T0);
    await expect(pro.updateJob(d, b, id, job({ title: "Piraté" }), T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(pro.setJobStatus(d, b, id, "closed", T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(pro.setJobStatus(d, a, id, "hidden" as any, T0)).rejects.toMatchObject({ code: "invalid" });
    await pro.updateJob(d, a, id, job({ title: "Lead React", contact: "" }), T0 + 1);
    expect(await pro.getJob(d, a.id, id)).toMatchObject({ title: "Lead React", contact: null });
    await pro.setJobStatus(d, a, id, "closed", T0 + 2);
    expect((await pro.getJob(d, b.id, id)).status).toBe("closed");
    await pro.setJobStatus(d, a, id, "open", T0 + 3);
    await pro.hideJob(d, id, a);
    await expect(pro.getJob(d, a.id, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(pro.updateJob(d, a, id, job(), T0)).rejects.toMatchObject({ code: "not_found" });
  });

  it("hideJob: owner or moderator only; admin (no actor) always", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const mod = await member("m@x.ma", "Sara", "moderator");
    const id1 = rawJob(a.id), id2 = rawJob(a.id), id3 = rawJob(a.id);
    await expect(pro.hideJob(d, id1, b)).rejects.toMatchObject({ code: "forbidden" });
    await pro.hideJob(d, id1, mod);
    await pro.hideJob(d, id2, a);
    await pro.hideJob(d, id3);
    await expect(pro.hideJob(d, id3)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("pro jobs: list", () => {
  it("lists open jobs newest first; closed only under mine", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const open = rawJob(a.id, { title: "Ouverte" });
    const closed = rawJob(a.id, { title: "Fermée", status: "closed" });
    rawJob(a.id, { title: "Masquée", status: "hidden" });
    expect((await pro.listJobs(d, b.id)).jobs.map(j => j.id)).toEqual([open]);
    expect((await pro.listJobs(d, a.id, { mine: true })).jobs.map(j => j.id)).toEqual([closed, open]);
    expect((await pro.listJobs(d, b.id, { mine: true })).jobs).toEqual([]);
  });

  it("filters by type and city (case-insensitive)", async () => {
    const a = await member("a@x.ma");
    const cdi = rawJob(a.id, { type: "cdi", city: "Rabat" });
    const stage = rawJob(a.id, { type: "stage", city: "Casablanca" });
    expect((await pro.listJobs(d, a.id, { type: "stage" })).jobs.map(j => j.id)).toEqual([stage]);
    expect((await pro.listJobs(d, a.id, { city: "rabat" })).jobs.map(j => j.id)).toEqual([cdi]);
    await expect(pro.listJobs(d, a.id, { type: "interim" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("searches title, company and description; escapes % and _; rejects long queries", async () => {
    const a = await member("a@x.ma");
    const pct = rawJob(a.id, { title: "Bonus 100% garanti" });
    rawJob(a.id, { title: "Développeur" });
    const company = rawJob(a.id, { company: "Zebra Corp" });
    const desc = rawJob(a.id, { description: "maîtrise de SQL exigée" });
    expect((await pro.listJobs(d, a.id, { q: "%" })).jobs.map(j => j.id)).toEqual([pct]);
    expect((await pro.listJobs(d, a.id, { q: "_" })).jobs).toEqual([]);
    expect((await pro.listJobs(d, a.id, { q: "zebra" })).jobs.map(j => j.id)).toEqual([company]);
    expect((await pro.listJobs(d, a.id, { q: "sql" })).jobs.map(j => j.id)).toEqual([desc]);
    await expect(pro.listJobs(d, a.id, { q: "a".repeat(60) })).rejects.toMatchObject({ code: "invalid" });
  });

  it("paginates with a cursor", async () => {
    const a = await member("a@x.ma");
    const ids = [rawJob(a.id), rawJob(a.id), rawJob(a.id)];
    const first = await pro.listJobs(d, a.id, { limit: 2 });
    expect(first.jobs.map(j => j.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).toBe(ids[1]);
    const second = await pro.listJobs(d, a.id, { cursor: first.nextCursor, limit: 2 });
    expect(second.jobs.map(j => j.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
  });

  it("hides jobs of suspended posters", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const id = rawJob(a.id);
    suspend(a.id);
    expect((await pro.listJobs(d, b.id)).jobs).toEqual([]);
    await expect(pro.getJob(d, b.id, id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("reports a job and lists it for admins; admin lists all jobs", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const id = rawJob(a.id, { title: "Offre douteuse" });
    await pro.reportContent(d, b, "job", id, "arnaque");
    expect((await pro.listReports(d))[0]).toMatchObject({ target_type: "job", body: "Offre douteuse", target_status: "open" });
    await pro.hideContent(d, "job", id);
    expect((await pro.listReports(d))[0].target_status).toBe("hidden");
    expect((await pro.adminListJobs(d))[0]).toMatchObject({ id, title: "Offre douteuse", status: "hidden", poster: a.display_name });
  });
});

describe("pro messaging", () => {
  it("opens one thread per pair and job; applying twice reuses it", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    const direct = await pro.openThread(d, b, { to: a.id }, T0);
    expect(direct.created).toBe(true);
    expect(await pro.openThread(d, b, { to: a.id }, T0)).toEqual({ id: direct.id, created: false });
    expect(await pro.openThread(d, a, { to: b.id }, T0)).toEqual({ id: direct.id, created: false }); // order of the pair does not matter
    const apply = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    expect(apply.id).not.toBe(direct.id);
    expect(await pro.openThread(d, b, { to: a.id, jobId }, T0)).toEqual({ id: apply.id, created: false });
  });

  it("refuses self, unknown, suspended, wrong-poster and hidden-job targets", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const c = await member("c@x.ma", "Sara");
    await expect(pro.openThread(d, a, { to: a.id }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.openThread(d, a, { to: 9999 }, T0)).rejects.toMatchObject({ code: "not_found" });
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    await expect(pro.openThread(d, c, { to: b.id, jobId }, T0)).rejects.toMatchObject({ code: "invalid" }); // job belongs to a, not b
    await expect(pro.openThread(d, b, { to: a.id, jobId: 9999 }, T0)).rejects.toMatchObject({ code: "not_found" });
    await pro.hideJob(d, jobId);
    await expect(pro.openThread(d, b, { to: a.id, jobId }, T0)).rejects.toMatchObject({ code: "not_found" });
    suspend(c.id);
    await expect(pro.openThread(d, a, { to: c.id }, T0)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a new thread on a closed job is refused, an existing one continues", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const c = await member("c@x.ma", "Sara");
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    const t = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    await pro.setJobStatus(d, a, jobId, "closed", T0);
    await expect(pro.openThread(d, c, { to: a.id, jobId }, T0)).rejects.toMatchObject({ code: "invalid" });
    expect(await pro.openThread(d, b, { to: a.id, jobId }, T0)).toEqual({ id: t.id, created: false });
    await expect(pro.sendMessage(d, b, t.id, "Toujours intéressé", T0)).resolves.toBeDefined();
  });

  it("only the two participants read and write; outsiders get not_found", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const c = await member("c@x.ma", "Sara");
    const mod = await member("m@x.ma", "Admin", "moderator");
    const t = await pro.openThread(d, b, { to: a.id }, T0);
    await pro.sendMessage(d, b, t.id, "Bonjour", T0);
    for (const outsider of [c, mod]) {
      await expect(pro.listMessages(d, outsider, t.id)).rejects.toMatchObject({ code: "not_found" });
      await expect(pro.sendMessage(d, outsider, t.id, "intrus", T0)).rejects.toMatchObject({ code: "not_found" });
      await expect(pro.markThreadRead(d, outsider, t.id, T0)).rejects.toMatchObject({ code: "not_found" });
    }
    expect((await pro.listMessages(d, a, t.id)).messages.map(m => m.body)).toEqual(["Bonjour"]);
  });

  it("validates messages, limits to 30/h, and refuses writing to a suspended member", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const t = await pro.openThread(d, b, { to: a.id }, T0);
    for (const body of ["", "   ", "x".repeat(1001)]) await expect(pro.sendMessage(d, b, t.id, body, T0)).rejects.toMatchObject({ code: "invalid" });
    for (let i = 0; i < 30; i++) await pro.sendMessage(d, b, t.id, `m${i}`, T0);
    await expect(pro.sendMessage(d, b, t.id, "trop", T0)).rejects.toMatchObject({ code: "rate_limited" });
    suspend(a.id);
    await expect(pro.sendMessage(d, b, t.id, "plus tard", T0 + HOUR + 1)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("limits new threads to 20 per hour", async () => {
    const me = await member("me@x.ma", "Moi");
    for (let i = 0; i < 20; i++) { const o = await member(`o${i}@x.ma`, `O${i}`); await pro.openThread(d, me, { to: o.id }, T0); }
    const extra = await member("extra@x.ma", "Extra");
    await expect(pro.openThread(d, me, { to: extra.id }, T0)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("inbox: hides empty threads from the recipient, counts unread, clears them on read", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id: jobId } = await pro.createJob(d, a, job({ title: "Chef de projet" }), T0);
    const t = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    expect(await pro.listThreads(d, a.id)).toEqual([]); // nothing written yet: invisible to the poster
    expect(await pro.listThreads(d, b.id)).toHaveLength(1);
    await pro.sendMessage(d, b, t.id, "Je postule", T0 + 1);
    await pro.sendMessage(d, b, t.id, "Voici mon CV en lien", T0 + 2);
    const inbox = await pro.listThreads(d, a.id);
    expect(inbox[0]).toMatchObject({ id: t.id, job_title: "Chef de projet", last_body: "Voici mon CV en lien", unread: 2, other: { id: b.id } });
    expect(await pro.unreadTotal(d, a.id)).toBe(2);
    expect(await pro.unreadTotal(d, b.id)).toBe(0);
    await pro.markThreadRead(d, a, t.id, T0 + 3);
    expect(await pro.unreadTotal(d, a.id)).toBe(0);
    const conv = await pro.listMessages(d, a, t.id);
    expect(conv).toMatchObject({ other: { id: b.id }, job: { id: jobId, title: "Chef de projet" }, nextCursor: null });
    expect(conv.messages.every(m => m.read_at !== null)).toBe(true);
  });

  it("inbox hides threads with suspended members and hidden-job titles", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    const t = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    await pro.sendMessage(d, b, t.id, "Bonjour", T0);
    await pro.hideJob(d, jobId);
    expect((await pro.listThreads(d, a.id))[0].job_title).toBeNull();
    suspend(b.id);
    expect(await pro.listThreads(d, a.id)).toEqual([]);
    expect(await pro.unreadTotal(d, a.id)).toBe(0);
  });

  it("paginates messages 50 at a time", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const t = await pro.openThread(d, b, { to: a.id }, T0);
    for (let i = 0; i < 55; i++) sqlite.prepare("INSERT INTO pro_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?)").run(t.id, b.id, `m${i}`, h.iso(T0 + i));
    const first = await pro.listMessages(d, a, t.id);
    expect(first.messages).toHaveLength(50);
    expect(first.messages[49].body).toBe("m54");
    expect(first.nextCursor).not.toBeNull();
    const older = await pro.listMessages(d, a, t.id, first.nextCursor);
    expect(older.messages.map(m => m.body)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(older.nextCursor).toBeNull();
  });
});
