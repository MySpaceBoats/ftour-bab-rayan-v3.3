/** REST routes of the volunteer housing module, called from handleHubRequest for any /hub/stay/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as S from "./stay-d1";
import { id, readJson, str } from "./hub-http";

export interface StayCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "stay/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
}

const host = async (h: S.StayHost, sign: StayCtx["sign"]) => ({ id: h.id, display_name: h.display_name, avatar: await sign(h.avatar_key) });
const presentCard = async (l: S.StayCard, sign: StayCtx["sign"]) => ({ ...l, cover: await sign(l.cover), host: await host(l.host, sign) });

function listingInput(b: Record<string, unknown>): S.StayListingInput {
  if (b.media !== undefined && !(Array.isArray(b.media) && b.media.every(x => typeof x === "string"))) throw new H.HubError("invalid", "Photos invalides");
  if (b.amenities !== undefined && !(Array.isArray(b.amenities) && b.amenities.every(x => typeof x === "string"))) throw new H.HubError("invalid", "Équipements invalides");
  return {
    title: str(b.title), description: str(b.description), kind: str(b.kind),
    city: str(b.city), area: str(b.area),
    capacity: typeof b.capacity === "number" ? b.capacity : NaN,
    rooms: typeof b.rooms === "number" ? b.rooms : NaN,
    priceType: str(b.priceType),
    price: typeof b.price === "number" ? b.price : NaN,
    amenities: (b.amenities as string[] | undefined) ?? [],
    availableFrom: typeof b.availableFrom === "string" && b.availableFrom ? b.availableFrom : null,
    availableTo: typeof b.availableTo === "string" && b.availableTo ? b.availableTo : null,
    phone: b.phone, whatsapp: b.whatsapp === true,
    mediaPaths: (b.media as string[] | undefined) ?? [],
  };
}

export async function handleStayRoute(c: StayCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  let m: RegExpExecArray | null;

  // ---- listings ----------------------------------------------------------
  if (match("GET", /^listings$/)) {
    const me = await member();
    const cur = url.searchParams.get("cursor");
    const guests = url.searchParams.get("guests");
    const r = await S.listStayListings(d, me.id, {
      cursor: cur && /^\d+$/.test(cur) ? Number(cur) : null,
      kind: url.searchParams.get("kind") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      priceType: url.searchParams.get("priceType") ?? undefined,
      guests: guests && /^\d+$/.test(guests) ? Number(guests) : undefined,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      mine: url.searchParams.get("mine") === "1",
    });
    return json({ listings: await Promise.all(r.listings.map(l => presentCard(l, sign))), nextCursor: r.nextCursor });
  }
  if (match("POST", /^listings$/)) {
    const me = await member();
    return json(await S.createListing(d, me, listingInput(await readJson(request)), now()));
  }
  if ((m = match("GET", /^listings\/(\d+)$/))) {
    const me = await member();
    const { host: h, media, ...rest } = await S.getStayListing(d, me.id, id(m[1]));
    return json({ listing: { ...rest, host: await host(h, sign), media: await Promise.all(media.map(sign)) } });
  }
  if ((m = match("PUT", /^listings\/(\d+)$/))) {
    const me = await member();
    await S.updateListing(d, me, id(m[1]), listingInput(await readJson(request)), now());
    return json({ ok: true });
  }
  if ((m = match("DELETE", /^listings\/(\d+)$/))) {
    await S.hideStayListing(d, id(m[1]), await member());
    return json({ ok: true });
  }
  if ((m = match("POST", /^listings\/(\d+)\/status$/))) {
    const me = await member();
    await S.setListingStatus(d, me, id(m[1]), str((await readJson(request)).status) as "active" | "paused", now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^listings\/(\d+)\/requests$/))) {
    const me = await member();
    const b = await readJson(request);
    return json(await S.createRequest(d, me, id(m[1]), { startDate: b.startDate, endDate: b.endDate, guests: b.guests, message: b.message }, now()));
  }

  // ---- requests (demandes de séjour) -------------------------------------
  if (match("GET", /^requests$/)) {
    const me = await member();
    const role = url.searchParams.get("role") ?? "all";
    const list = await S.listMyRequests(d, me.id, role as "guest" | "host" | "all");
    return json({ requests: await Promise.all(list.map(async r => ({ ...r, cover: await sign(r.cover), other: await host(r.other, sign) }))) });
  }
  if ((m = match("GET", /^requests\/(\d+)$/))) {
    const me = await member();
    const r = await S.getRequestDetail(d, me, id(m[1]));
    return json({ request: { ...r, guest: await host(r.guest, sign), host: await host(r.host, sign) } });
  }
  if ((m = match("POST", /^requests\/(\d+)\/status$/))) {
    const me = await member();
    const b = await readJson(request);
    await S.decideRequest(d, me, id(m[1]), str(b.action), b.reply, now());
    return json({ ok: true });
  }
  if ((m = match("GET", /^requests\/(\d+)\/messages$/))) {
    const me = await member();
    const cur = url.searchParams.get("cursor");
    const r = await S.listRequestMessages(d, me, id(m[1]), cur && /^\d+$/.test(cur) ? Number(cur) : null);
    return json({ ...r, other: await host(r.other, sign) });
  }
  if ((m = match("POST", /^requests\/(\d+)\/messages$/))) {
    const me = await member();
    return json(await S.sendRequestMessage(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("POST", /^requests\/(\d+)\/read$/))) {
    const me = await member();
    await S.markRequestRead(d, me, id(m[1]), now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^requests\/(\d+)\/review$/))) {
    const me = await member();
    const b = await readJson(request);
    return json(await S.reviewRequest(d, me, id(m[1]), b.rating, b.body, now()));
  }

  // ---- misc / report -----------------------------------------------------
  if (match("GET", /^unread$/)) {
    const me = await member();
    return json({ count: await S.unreadTotal(d, me.id) });
  }
  if (match("POST", /^report$/)) {
    const me = await member();
    const b = await readJson(request);
    await S.reportStay(d, me, str(b.type) as "listing" | "message", id(b.id), str(b.reason));
    return json({ ok: true });
  }

  // ---- admin (Supabase bearer + role) ------------------------------------
  if (match("GET", /^admin\/listings$/)) { await admin(); return json({ listings: await S.adminListStayListings(d) }); }
  if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await S.listStayReports(d) }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    const b = await readJson(request);
    await S.hideStayContent(d, str(b.type) as "listing" | "message", id(b.id));
    return json({ ok: true });
  }
  if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) {
    await admin();
    await S.dismissStayReport(d, id(m[1]));
    return json({ ok: true });
  }

  return null;
}
