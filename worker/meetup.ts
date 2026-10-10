/** REST routes of the volunteer meetup module, called from handleHubRequest for any /hub/meetup/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as M from "./meetup-d1";
import { readJson } from "./hub-http";

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
  const { d, request, url, path, now, json, member, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);

  // ---- meetups -----------------------------------------------------------
  if (match("GET", /^meetups$/)) {
    const me = await member();
    const r = await M.listMeetups(d, me.id, { cursor: url.searchParams.get("cursor") }, now());
    return json({ meetups: await Promise.all(r.meetups.map(m => presentCard(m, sign))), nextCursor: r.nextCursor });
  }
  if (match("POST", /^meetups$/)) {
    const me = await member();
    return json(await M.createMeetup(d, me, await readJson(request), now()));
  }

  return null;
}
