/** REST routes of the salons module, called from handleHubRequest for any /hub/salon/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as S from "./salon-d1";
import { id, readJson } from "./hub-http";
import { jitsiUrl, type JaasEnv } from "./jaas";

export interface SalonCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "salon/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
  env: JaasEnv;
}

/** avatar_key never leaves: only the signed URL does. */
const person = async (p: S.SalonPerson, sign: SalonCtx["sign"]) => ({ id: p.id, display_name: p.display_name, avatar: await sign(p.avatar_key) });
const presentCard = async <T extends S.SalonCard>(c: T, sign: SalonCtx["sign"]) => ({ ...c, creator: await person(c.creator, sign) });

export async function handleSalonRoute(c: SalonCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign, env } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const q = (k: string) => url.searchParams.get(k) ?? undefined;
  let m: RegExpExecArray | null;

  // ---- salons ------------------------------------------------------------
  if (match("GET", /^salons$/)) {
    const me = await member();
    const r = await S.listSalons(d, me.id, { cursor: q("cursor") });
    return json({ salons: await Promise.all(r.salons.map(x => presentCard(x, sign))), nextCursor: r.nextCursor });
  }
  if (match("POST", /^salons$/)) {
    const me = await member();
    return json(await S.createSalon(d, me, await readJson(request), now()));
  }
  if ((m = match("GET", /^salons\/([^/]+)$/))) {
    const me = await member();
    return json({ salon: await presentCard(await S.getSalon(d, me.id, id(m[1])), sign) });
  }
  if ((m = match("POST", /^salons\/([^/]+)\/archive$/))) {
    const me = await member();
    await S.archiveSalon(d, me, id(m[1]));
    return json({ ok: true });
  }

  if ((m = match("GET", /^salons\/([^/]+)\/jitsi$/))) {
    const me = await member();
    const s = await S.getSalon(d, me.id, id(m[1]));
    if (s.status !== "active") throw new H.HubError("conflict", "Ce salon est archivé");
    // le créateur modère sa visio ; jeton propre à chaque membre, jamais mis en cache ni renvoyé dans le détail
    return json(await jitsiUrl(env, { room: `babrayan-${s.room}`, name: me.display_name, userId: me.id, moderator: s.mine, nowMs: now() }));
  }

  // ---- posts -------------------------------------------------------------
  if ((m = match("GET", /^salons\/([^/]+)\/posts$/))) {
    const me = await member();
    const r = await S.listPosts(d, me.id, id(m[1]), { cursor: q("cursor") });
    return json({ posts: await Promise.all(r.posts.map(async p => ({ ...p, author: await person(p.author, sign) }))), nextCursor: r.nextCursor });
  }
  if ((m = match("POST", /^salons\/([^/]+)\/posts$/))) {
    const me = await member();
    return json(await S.createPost(d, me, id(m[1]), await readJson(request), now()));
  }
  if ((m = match("DELETE", /^salons\/([^/]+)\/posts\/([^/]+)$/))) {
    const me = await member();
    await S.deletePost(d, me, id(m[1]), id(m[2]));
    return json({ ok: true });
  }

  // ---- admin (Supabase bearer + role) ------------------------------------
  if (match("GET", /^admin\/salons$/)) { await admin(); return json({ salons: await S.adminListSalons(d) }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    await S.hideSalon(d, id((await readJson(request)).id));
    return json({ ok: true });
  }
  if (match("POST", /^admin\/delete$/)) {
    await admin();
    await S.deleteSalon(d, id((await readJson(request)).id));
    return json({ ok: true });
  }

  return null;
}
