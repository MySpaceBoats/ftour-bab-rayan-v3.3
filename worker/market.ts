/** REST routes of the marketplace, called from handleHubRequest for any /hub/market/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as M from "./market-d1";
import { id, readJson, str } from "./hub-http";

export interface MarketCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "market/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
}

const seller = async (s: M.Seller, sign: MarketCtx["sign"]) => ({ id: s.id, display_name: s.display_name, avatar: await sign(s.avatar_key) });

function listingInput(b: Record<string, unknown>): M.ListingInput {
  if (b.media !== undefined && !(Array.isArray(b.media) && b.media.every(x => typeof x === "string"))) throw new H.HubError("invalid", "Photos invalides");
  return {
    title: str(b.title), description: str(b.description),
    price: typeof b.price === "number" ? b.price : NaN,
    category: str(b.category), condition: str(b.condition), city: str(b.city),
    phone: b.phone, whatsapp: b.whatsapp === true,
    mediaPaths: (b.media as string[] | undefined) ?? [],
  };
}

export async function handleMarketRoute(c: MarketCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  let m: RegExpExecArray | null;

  // ---- listings ----------------------------------------------------------
  if (match("GET", /^listings$/)) {
    const me = await member();
    const cur = url.searchParams.get("cursor");
    const r = await M.listListings(d, me.id, {
      cursor: cur && /^\d+$/.test(cur) ? Number(cur) : null,
      category: url.searchParams.get("category") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      mine: url.searchParams.get("mine") === "1",
    });
    return json({
      listings: await Promise.all(r.listings.map(async ({ cover, seller: s, ...rest }) => ({ ...rest, cover: await sign(cover), seller: await seller(s, sign) }))),
      nextCursor: r.nextCursor,
    });
  }
  if (match("POST", /^listings$/)) {
    const me = await member();
    return json(await M.createListing(d, me, listingInput(await readJson(request)), now()));
  }
  if ((m = match("GET", /^listings\/(\d+)$/))) {
    const me = await member();
    const l = await M.getListing(d, me.id, id(m[1]));
    const { seller: s, media, ...rest } = l;
    return json({ listing: { ...rest, seller: await seller(s, sign), media: await Promise.all(media.map(sign)) } });
  }
  if ((m = match("PUT", /^listings\/(\d+)$/))) {
    const me = await member();
    await M.updateListing(d, me, id(m[1]), listingInput(await readJson(request)), now());
    return json({ ok: true });
  }
  if ((m = match("DELETE", /^listings\/(\d+)$/))) {
    await M.hideListing(d, id(m[1]), await member());
    return json({ ok: true });
  }
  if ((m = match("POST", /^listings\/(\d+)\/status$/))) {
    const me = await member();
    await M.setListingStatus(d, me, id(m[1]), str((await readJson(request)).status) as "active" | "sold", now());
    return json({ ok: true });
  }

  // ---- comments / report -------------------------------------------------
  if ((m = match("GET", /^listings\/(\d+)\/comments$/))) {
    await member();
    const list = await M.listListingComments(d, id(m[1]));
    return json({ comments: await Promise.all(list.map(async x => ({ ...x, author: await seller(x.author, sign) }))) });
  }
  if ((m = match("POST", /^listings\/(\d+)\/comments$/))) {
    const me = await member();
    return json(await M.addListingComment(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("DELETE", /^comments\/(\d+)$/))) {
    await M.removeListingComment(d, await member(), id(m[1]));
    return json({ ok: true });
  }
  if (match("POST", /^report$/)) {
    const me = await member();
    const b = await readJson(request);
    await M.reportMarket(d, me, str(b.type) as "listing" | "comment", id(b.id), str(b.reason));
    return json({ ok: true });
  }

  // ---- admin (Supabase bearer + role) ------------------------------------
  if (match("GET", /^admin\/listings$/)) { await admin(); return json({ listings: await M.adminListListings(d) }); }
  if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await M.listMarketReports(d) }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    const b = await readJson(request);
    await M.hideMarketContent(d, str(b.type) as "listing" | "comment", id(b.id));
    return json({ ok: true });
  }
  if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) {
    await admin();
    await M.dismissMarketReport(d, id(m[1]));
    return json({ ok: true });
  }

  // ---- messaging (members only: admin() is deliberately not used) --------
  if ((m = match("POST", /^listings\/(\d+)\/thread$/))) {
    const me = await member();
    return json(await M.openThread(d, me, id(m[1]), now()));
  }
  if (match("GET", /^threads$/)) {
    const me = await member();
    const threads = await M.listThreads(d, me.id);
    return json({
      threads: await Promise.all(threads.map(async ({ cover, other, ...t }) => ({
        ...t,
        last_body: t.last_body === null ? null : t.last_body.slice(0, 120),
        cover: await sign(cover),
        other: await seller(other, sign),
      }))),
    });
  }
  if ((m = match("GET", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    const cur = url.searchParams.get("cursor");
    const r = await M.listMessages(d, me, id(m[1]), cur && /^\d+$/.test(cur) ? Number(cur) : null);
    return json({ ...r, other: await seller(r.other, sign) });
  }
  if ((m = match("POST", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    return json(await M.sendMessage(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("POST", /^threads\/(\d+)\/read$/))) {
    const me = await member();
    await M.markThreadRead(d, me, id(m[1]), now());
    return json({ ok: true });
  }
  if (match("GET", /^unread$/)) {
    const me = await member();
    return json({ count: await M.unreadTotal(d, me.id) });
  }

  return null;
}
