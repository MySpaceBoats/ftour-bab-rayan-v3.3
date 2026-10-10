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

  return null;
}
