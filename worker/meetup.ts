/** REST routes of the volunteer meetup module, called from handleHubRequest for any /hub/meetup/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as M from "./meetup-d1";
import { id, readJson } from "./hub-http";

export interface MeetupCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "meetup/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
}

const organizer = async (o: M.MeetupOrganizer, sign: MeetupCtx["sign"]) => ({ id: o.id, display_name: o.display_name, avatar: await sign(o.avatar_key) });
/** photo_key never leaves on a card: only the signed URL does. */
const presentCard = async (c: M.MeetupCard, sign: MeetupCtx["sign"]) => {
  const { photo_key, organizer: o, ...rest } = c;
  return { ...rest, photo: await sign(photo_key), organizer: await organizer(o, sign) };
};

export async function handleMeetupRoute(c: MeetupCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const q = (k: string) => url.searchParams.get(k) ?? undefined;
  let m: RegExpExecArray | null;

  // ---- meetups -----------------------------------------------------------
  if (match("GET", /^meetups$/)) {
    const me = await member();
    const r = await M.listMeetups(d, me.id, { cursor: q("cursor"), country: q("country"), city: q("city"), category: q("category"), from: q("from"), to: q("to") }, now());
    return json({ meetups: await Promise.all(r.meetups.map(x => presentCard(x, sign))), nextCursor: r.nextCursor });
  }
  if (match("POST", /^meetups$/)) {
    const me = await member();
    return json(await M.createMeetup(d, me, await readJson(request), now()));
  }
  if (match("GET", /^places$/)) {
    await member();
    return json(await M.listMeetupPlaces(d, now()));
  }
  if ((m = match("GET", /^meetups\/(\d+)$/))) {
    const me = await member();
    const { photo_key, participants, waitlist, organizer: o, ...rest } = await M.getMeetup(d, me.id, id(m[1]), now());
    // photo_key (needed by the edit form) is for the organizer only
    return json({
      meetup: {
        ...rest, photo: await sign(photo_key), ...(rest.mine ? { photo_key } : {}),
        organizer: await organizer(o, sign),
        participants: await Promise.all(participants.map(p => organizer(p, sign))),
        waitlist: await Promise.all(waitlist.map(p => organizer(p, sign))),
      },
    });
  }
  if ((m = match("PUT", /^meetups\/(\d+)$/))) {
    const me = await member();
    await M.updateMeetup(d, me, id(m[1]), await readJson(request), now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^meetups\/(\d+)\/cancel$/))) {
    const me = await member();
    await M.cancelMeetup(d, me, id(m[1]), now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^meetups\/(\d+)\/join$/))) {
    const me = await member();
    return json(await M.joinMeetup(d, me, id(m[1]), now()));
  }
  if ((m = match("POST", /^meetups\/(\d+)\/leave$/))) {
    const me = await member();
    return json(await M.leaveMeetup(d, me, id(m[1])));
  }
  if (match("GET", /^mine$/)) {
    const me = await member();
    const list = await M.listMyMeetups(d, me.id, q("role") ?? "organized", now());
    return json({ meetups: await Promise.all(list.map(x => presentCard(x, sign))) });
  }

  // ---- admin (Supabase bearer + role) ------------------------------------
  if (match("GET", /^admin\/meetups$/)) { await admin(); return json({ meetups: await M.adminListMeetups(d) }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    await M.hideMeetup(d, id((await readJson(request)).id));
    return json({ ok: true });
  }
  if (match("POST", /^admin\/delete$/)) {
    await admin();
    await M.deleteMeetup(d, id((await readJson(request)).id));
    return json({ ok: true });
  }

  return null;
}
