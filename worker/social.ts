/** REST routes of friends / follows, called from handleHubRequest for any /hub/social/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as S from "./social-d1";
import { id, readJson } from "./hub-http";

export interface SocialCtx {
  d: D1Like; request: Request; url: URL; path: string; now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  sign: (p: string | null) => Promise<string | null>;
}

export async function handleSocialRoute(c: SocialCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const person = async (p: S.PersonRow) => ({ id: p.id, display_name: p.display_name, avatar: await sign(p.avatar_key), ...(p.favorite === undefined ? {} : { favorite: p.favorite }) });
  const page = async (r: { people: S.PersonRow[]; nextCursor: number | null }) => json({ people: await Promise.all(r.people.map(person)), nextCursor: r.nextCursor });
  const cursor = () => { const v = url.searchParams.get("cursor"); return v && /^\d+$/.test(v) ? Number(v) : null; };
  let m: RegExpExecArray | null;

  if ((m = match("GET", /^relation\/(\d+)$/))) { const me = await member(); return json(await S.relation(d, me.id, id(m[1]))); }
  if (match("POST", /^friend\/request$/)) { const me = await member(); return json(await S.requestFriend(d, me.id, id((await readJson(request)).id), now())); }
  if (match("POST", /^friend\/accept$/)) { const me = await member(); await S.acceptFriend(d, me.id, id((await readJson(request)).id), now()); return json({ ok: true }); }
  if (match("POST", /^friend\/decline$/)) { const me = await member(); await S.declineFriend(d, me.id, id((await readJson(request)).id)); return json({ ok: true }); }
  if ((m = match("DELETE", /^friend\/(\d+)$/))) { const me = await member(); await S.removeFriend(d, me.id, id(m[1])); return json({ ok: true }); }
  if (match("POST", /^follow$/)) { const me = await member(); await S.follow(d, me.id, id((await readJson(request)).id), now()); return json({ ok: true }); }
  if ((m = match("DELETE", /^follow\/(\d+)$/))) { const me = await member(); await S.unfollow(d, me.id, id(m[1])); return json({ ok: true }); }
  if (match("POST", /^favorite$/)) {
    const me = await member(); const b = await readJson(request);
    if (typeof b.on !== "boolean") throw new H.HubError("invalid", "Valeur invalide");
    await S.setFavorite(d, me.id, id(b.id), b.on); return json({ ok: true });
  }
  if (match("GET", /^friends$/)) { const me = await member(); return page(await S.listFriends(d, me.id, cursor())); }
  if (match("GET", /^following$/)) { const me = await member(); return page(await S.listFollowing(d, me.id, cursor())); }
  if (match("GET", /^requests$/)) {
    const me = await member(); const r = await S.listRequests(d, me.id);
    return json({ received: await Promise.all(r.received.map(person)), sent: await Promise.all(r.sent.map(person)) });
  }
  return null;
}
