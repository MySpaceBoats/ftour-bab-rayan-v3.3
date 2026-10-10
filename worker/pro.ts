/** REST routes of the professional network, called from handleHubRequest for any /hub/pro/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as P from "./pro-d1";
import { id, readJson, str } from "./hub-http";

export interface ProCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "pro/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
}

const cursorOf = (url: URL) => {
  const c = url.searchParams.get("cursor");
  return c && /^\d+$/.test(c) ? Number(c) : null;
};

function jobInput(b: Record<string, unknown>): P.JobInput {
  return { title: str(b.title), company: str(b.company), city: str(b.city), type: str(b.type), description: str(b.description), contact: b.contact };
}

export async function handlePro(c: ProCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const who = async (p: P.Person) => ({
    id: p.id, display_name: p.display_name, avatar: await sign(p.avatar_key),
    ...(p.headline !== undefined ? { headline: p.headline } : {}),
  });
  let m: RegExpExecArray | null;

  // ---- profile -----------------------------------------------------------
  if ((m = match("GET", /^profile\/(\d+)$/))) {
    const me = await member();
    const { member: person, ...rest } = await P.getProfile(d, me.id, id(m[1]));
    return json({ profile: { ...rest, member: await who(person) } });
  }
  if (match("PUT", /^profile$/)) {
    const me = await member();
    return json({ profile: await P.saveProfile(d, me, await readJson(request), now()) });
  }

  // ---- feed --------------------------------------------------------------
  if (match("GET", /^feed$/)) {
    const me = await member();
    const f = await P.feed(d, me.id, cursorOf(url));
    const posts = await Promise.all(f.posts.map(async p => ({ ...p, media: await Promise.all(p.media.map(sign)), author: await who(p.author) })));
    return json({ posts, nextCursor: f.nextCursor });
  }
  if (match("POST", /^posts$/)) {
    const me = await member();
    const b = await readJson(request);
    const media = Array.isArray(b.media) ? b.media.filter((x): x is string => typeof x === "string") : [];
    return json(await P.createPost(d, me, { body: str(b.body), link: b.link, mediaPaths: media }, now()));
  }
  if ((m = match("DELETE", /^posts\/(\d+)$/))) {
    await P.removeContent(d, await member(), "post", id(m[1]));
    return json({ ok: true });
  }
  if ((m = match("POST", /^posts\/(\d+)\/like$/))) {
    const me = await member();
    return json(await P.toggleLike(d, me.id, id(m[1])));
  }
  if ((m = match("GET", /^posts\/(\d+)\/comments$/))) {
    await member();
    const comments = await P.listComments(d, id(m[1]));
    return json({ comments: await Promise.all(comments.map(async x => ({ ...x, author: await who(x.author) }))) });
  }
  if ((m = match("POST", /^posts\/(\d+)\/comments$/))) {
    const me = await member();
    return json(await P.addComment(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("DELETE", /^comments\/(\d+)$/))) {
    await P.removeContent(d, await member(), "comment", id(m[1]));
    return json({ ok: true });
  }

  // ---- report / admin ----------------------------------------------------
  if (match("POST", /^report$/)) {
    const me = await member();
    const b = await readJson(request);
    await P.reportContent(d, me, str(b.type), id(b.id), str(b.reason));
    return json({ ok: true });
  }
  if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await P.listReports(d) }); }
  if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) { await admin(); await P.dismissReport(d, id(m[1])); return json({ ok: true }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    const b = await readJson(request);
    await P.hideContent(d, str(b.type), id(b.id));
    return json({ ok: true });
  }

  // ---- jobs --------------------------------------------------------------
  if (match("GET", /^jobs$/)) {
    const me = await member();
    const r = await P.listJobs(d, me.id, {
      cursor: cursorOf(url),
      type: url.searchParams.get("type") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      mine: url.searchParams.get("mine") === "1",
    });
    return json({ jobs: await Promise.all(r.jobs.map(async j => ({ ...j, poster: await who(j.poster) }))), nextCursor: r.nextCursor });
  }
  if (match("POST", /^jobs$/)) {
    const me = await member();
    return json(await P.createJob(d, me, jobInput(await readJson(request)), now()));
  }
  if ((m = match("GET", /^jobs\/(\d+)$/))) {
    const me = await member();
    const j = await P.getJob(d, me.id, id(m[1]));
    return json({ job: { ...j, poster: await who(j.poster) } });
  }
  if ((m = match("PUT", /^jobs\/(\d+)$/))) {
    const me = await member();
    await P.updateJob(d, me, id(m[1]), jobInput(await readJson(request)), now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^jobs\/(\d+)\/status$/))) {
    const me = await member();
    await P.setJobStatus(d, me, id(m[1]), str((await readJson(request)).status) as "open" | "closed", now());
    return json({ ok: true });
  }
  if ((m = match("DELETE", /^jobs\/(\d+)$/))) {
    await P.hideJob(d, id(m[1]), await member());
    return json({ ok: true });
  }
  if (match("GET", /^admin\/jobs$/)) { await admin(); return json({ jobs: await P.adminListJobs(d) }); }

  // ---- messaging ---------------------------------------------------------
  if (match("POST", /^threads$/)) {
    const me = await member();
    const b = await readJson(request);
    const jobId = b.job_id === undefined || b.job_id === null ? 0 : id(b.job_id);
    return json(await P.openThread(d, me, { to: id(b.to), jobId }, now()));
  }
  if (match("GET", /^threads$/)) {
    const me = await member();
    const threads = await P.listThreads(d, me.id);
    return json({ threads: await Promise.all(threads.map(async t => ({ ...t, other: await who(t.other) }))) });
  }
  if ((m = match("GET", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    const r = await P.listMessages(d, me, id(m[1]), cursorOf(url));
    return json({ ...r, other: await who(r.other) });
  }
  if ((m = match("POST", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    return json(await P.sendMessage(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("POST", /^threads\/(\d+)\/read$/))) {
    const me = await member();
    await P.markThreadRead(d, me, id(m[1]), now());
    return json({ ok: true });
  }
  if (match("GET", /^unread$/)) {
    const me = await member();
    return json({ count: await P.unreadTotal(d, me.id) });
  }

  return null;
}
