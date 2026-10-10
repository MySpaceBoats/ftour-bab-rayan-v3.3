/**
 * Volunteer housing — "façon Airbnb" — data layer on Cloudflare D1 (tables st_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, cleanBody, iso, isOwnPath, type MemberRow } from "./hub-d1";
import { normalizePhone } from "./market-d1";

export const ST_KINDS = ["chambre", "studio", "appartement", "maison", "canape", "tente"] as const;
export const ST_PRICE_TYPES = ["gratuit", "participation", "prix"] as const;
export const ST_AMENITIES = ["wifi", "cuisine", "salle_de_bain", "chauffage", "clim", "parking", "lessive", "animaux_ok", "famille_ok", "accessible"] as const;
export const ST_LIMITS = {
  listingsPerDay: 5, requestsPerDay: 10, messagesPerHour: 60,
  title: 80, description: 2000, city: 60, area: 60, message: 1000, reply: 500, review: 500, reason: 300,
  photos: 6, capacityMax: 12, roomsMax: 10, maxPrice: 999_999, maxNights: 60,
  amenities: ST_AMENITIES.length, likePatternBytes: 50,
};
const DAY_MS = 24 * HOUR_MS;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hosts whose hub account is suspended, or whose volunteer is no longer confirmed/present, vanish. m = hub_members alias. */
export const HOST_OK = `m.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))`;

export type StayStatus = "active" | "paused" | "hidden";
export type StayRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface StayHost { id: number; display_name: string; avatar_key: string | null }
export interface StayCard {
  id: number; title: string; kind: string; price_type: string; price: number; city: string; area: string;
  capacity: number; status: StayStatus; available_from: string | null; available_to: string | null;
  created_at: string; host: StayHost; cover: string | null; rating: number | null; review_count: number;
}
export interface StayDetail extends Omit<StayCard, "cover"> {
  description: string; rooms: number; amenities: string[]; updated_at: string; media: string[]; mine: boolean;
  contact: { phone: string; whatsapp: boolean } | null;
  reviews: StayReviewView[];
  media_keys?: string[]; // owner only
}
export interface StayReviewView { id: number; request_id: number; rating: number; body: string; created_at: string; author: StayHost }
export interface StayListingInput {
  title: string; description: string; kind: string; city?: string; area?: string;
  capacity: number; rooms: number; priceType: string; price: number; amenities?: string[];
  availableFrom?: string | null; availableTo?: string | null;
  phone?: unknown; whatsapp?: boolean; mediaPaths?: string[];
}

export interface StayRequestSummary {
  id: number; listing_id: number; listing_title: string; listing_status: string; kind: string; city: string;
  start_date: string; end_date: string; guests: number; status: StayRequestStatus; created_at: string;
  host_reply: string | null; cover: string | null; other: StayHost; unread: number;
}
export interface StayRequestDetail {
  id: number; listing: { id: number; title: string; status: string; kind: string; city: string };
  guest: StayHost; host: StayHost; start_date: string; end_date: string; guests: number;
  message: string; status: StayRequestStatus; host_reply: string | null;
  created_at: string; updated_at: string; decided_at: string | null;
  role: "guest" | "host"; can_review: boolean; review: { rating: number; body: string; created_at: string } | null; unread: number;
}
export interface StayMessageView { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
export interface StayReportView { id: number; target_type: "listing" | "message"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminStayListing { id: number; title: string; kind: string; price_type: string; price: number; status: string; host: string; created_at: string }

// ---- helpers --------------------------------------------------------------

/** A real calendar date in YYYY-MM-DD (rejects 2026-02-31 even though the regexp accepts it). */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's date in Morocco (the event timezone), as YYYY-MM-DD. */
export function todayCasablanca(nowMs: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(new Date(nowMs));
}

/** Half-open overlap of two [start, end) stays. ISO dates compare lexicographically. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function nightsBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS);
}

function likePattern(q: string): string | null {
  const t = q.trim();
  if (!t) return null;
  const p = `%${t.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  if (new TextEncoder().encode(p).length > ST_LIMITS.likePatternBytes) throw new HubError("invalid", "Recherche trop longue");
  return p;
}

function cleanOptionalDate(raw: unknown, label: string): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (!isIsoDate(raw)) throw new HubError("invalid", `${label} invalide (format AAAA-MM-JJ)`);
  return raw;
}

function cleanInt(raw: unknown, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < min || (raw as number) > max) throw new HubError("invalid", `${label} invalide (${min} à ${max})`);
  return raw as number;
}

interface CleanListing {
  title: string; description: string; kind: string; city: string; area: string; capacity: number; rooms: number;
  priceType: string; price: number; amenities: string; availableFrom: string | null; availableTo: string | null;
  phone: string | null; whatsapp: boolean; media: string[];
}

function cleanListing(member: MemberRow, i: StayListingInput): CleanListing {
  const title = cleanBody(i.title, ST_LIMITS.title, "Titre");
  const description = cleanBody(i.description, ST_LIMITS.description, "Description");
  if (!(ST_KINDS as readonly string[]).includes(i.kind)) throw new HubError("invalid", "Type de logement invalide");
  if (!(ST_PRICE_TYPES as readonly string[]).includes(i.priceType)) throw new HubError("invalid", "Type de prix invalide");
  const city = typeof i.city === "string" ? i.city.trim() : "";
  if (city.length > ST_LIMITS.city) throw new HubError("invalid", "Ville trop longue (60 caractères max)");
  const area = typeof i.area === "string" ? i.area.trim() : "";
  if (area.length > ST_LIMITS.area) throw new HubError("invalid", "Quartier trop long (60 caractères max)");
  const capacity = cleanInt(i.capacity, 1, ST_LIMITS.capacityMax, "Capacité");
  const rooms = cleanInt(i.rooms, 0, ST_LIMITS.roomsMax, "Nombre de pièces");
  const availableFrom = cleanOptionalDate(i.availableFrom, "Date de début de disponibilité");
  const availableTo = cleanOptionalDate(i.availableTo, "Date de fin de disponibilité");
  if (availableFrom && availableTo && availableTo < availableFrom) throw new HubError("invalid", "La fin de disponibilité doit suivre son début");
  const rawAmenities = i.amenities ?? [];
  if (rawAmenities.length > ST_LIMITS.amenities) throw new HubError("invalid", "Trop d'équipements");
  for (const a of rawAmenities) if (!(ST_AMENITIES as readonly string[]).includes(a)) throw new HubError("invalid", "Équipement invalide");
  const amenities = JSON.stringify([...new Set(rawAmenities)]);
  let price = 0;
  if (i.priceType !== "gratuit") {
    price = cleanInt(i.price, i.priceType === "prix" ? 1 : 0, ST_LIMITS.maxPrice, "Prix par nuit");
  }
  const phone = normalizePhone(i.phone);
  const whatsapp = i.whatsapp === true && phone !== null;
  if (whatsapp && !phone!.startsWith("+")) throw new HubError("invalid", "Pour WhatsApp, saisissez le numéro au format international (+212…)");
  const media = i.mediaPaths ?? [];
  if (media.length > ST_LIMITS.photos || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", `Photos invalides (${ST_LIMITS.photos} max)`);
  return { title, description, kind: i.kind, city, area, capacity, rooms, priceType: i.priceType, price, amenities, availableFrom, availableTo, phone, whatsapp, media };
}

function parseAmenities(raw: unknown): string[] {
  try {
    const v = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---- listings -------------------------------------------------------------

export async function createListing(d: D1Like, member: MemberRow, input: StayListingInput, nowMs: number): Promise<{ id: number }> {
  const c = cleanListing(member, input);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM st_listings WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - DAY_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= ST_LIMITS.listingsPerDay) throw new HubError("rate_limited", `Limite de ${ST_LIMITS.listingsPerDay} logements par jour atteinte`);
  const row = await d.prepare(
    `INSERT INTO st_listings (member_id, title, description, kind, city, area, capacity, rooms, price_type, price, amenities,
       available_from, available_to, contact_phone, contact_whatsapp, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  ).bind(member.id, c.title, c.description, c.kind, c.city, c.area, c.capacity, c.rooms, c.priceType, c.price, c.amenities,
    c.availableFrom, c.availableTo, c.phone, c.whatsapp ? 1 : 0, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  // ponytail: listing then photos are two statements (not atomic); a failed photo insert leaves a photo-less listing
  if (c.media.length) await d.batch(c.media.map((p, i) => d.prepare("INSERT INTO st_listing_media (listing_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

async function ownedListing(d: D1Like, member: MemberRow, id: number): Promise<void> {
  const r = await d.prepare("SELECT member_id, status FROM st_listings WHERE id = ?").bind(id).first<{ member_id: number; status: string }>();
  if (!r || r.status === "hidden") throw new HubError("not_found", "Logement introuvable");
  if (r.member_id !== member.id) throw new HubError("forbidden", "Action non autorisée");
}

export async function updateListing(d: D1Like, member: MemberRow, id: number, input: StayListingInput, nowMs: number): Promise<void> {
  const c = cleanListing(member, input);
  await ownedListing(d, member, id);
  await d.batch([
    d.prepare(
      `UPDATE st_listings SET title=?, description=?, kind=?, city=?, area=?, capacity=?, rooms=?, price_type=?, price=?, amenities=?,
         available_from=?, available_to=?, contact_phone=?, contact_whatsapp=?, updated_at=? WHERE id=?`,
    ).bind(c.title, c.description, c.kind, c.city, c.area, c.capacity, c.rooms, c.priceType, c.price, c.amenities,
      c.availableFrom, c.availableTo, c.phone, c.whatsapp ? 1 : 0, iso(nowMs), id),
    d.prepare("DELETE FROM st_listing_media WHERE listing_id = ?").bind(id),
    ...c.media.map((p, i) => d.prepare("INSERT INTO st_listing_media (listing_id, r2_key, position) VALUES (?,?,?)").bind(id, p, i)),
  ]);
}

export async function setListingStatus(d: D1Like, member: MemberRow, id: number, status: "active" | "paused", nowMs: number): Promise<void> {
  if (status !== "active" && status !== "paused") throw new HubError("invalid", "Statut invalide");
  await ownedListing(d, member, id);
  await d.prepare("UPDATE st_listings SET status = ?, updated_at = ? WHERE id = ?").bind(status, iso(nowMs), id).run();
}

/** Soft delete. With an actor: owner or moderator only. Without: admin (caller already authorised). */
export async function hideStayListing(d: D1Like, id: number, actor?: MemberRow): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM st_listings WHERE id = ? AND status <> 'hidden'").bind(id).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Logement introuvable");
  if (actor && actor.id !== r.member_id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE st_listings SET status = 'hidden' WHERE id = ?").bind(id).run();
}

export interface StaySearch {
  cursor?: number | null; kind?: string; city?: string; q?: string; priceType?: string;
  guests?: number; from?: string | null; to?: string | null; mine?: boolean; limit?: number;
}

/** Search active stays. `mine` widens to the owner's paused stays too. A date filter only keeps free windows. */
export async function listStayListings(d: D1Like, viewerId: number, o: StaySearch = {}): Promise<{ listings: StayCard[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? 20) || 20, 1), 50);
  if (o.kind && !(ST_KINDS as readonly string[]).includes(o.kind)) throw new HubError("invalid", "Type de logement invalide");
  if (o.priceType && !(ST_PRICE_TYPES as readonly string[]).includes(o.priceType)) throw new HubError("invalid", "Type de prix invalide");
  const from = cleanOptionalDate(o.from, "Date d'arrivée");
  const to = cleanOptionalDate(o.to, "Date de départ");
  if (from && to && to <= from) throw new HubError("invalid", "La date de départ doit suivre la date d'arrivée");
  const guests = o.guests === undefined ? 1 : cleanInt(o.guests, 1, ST_LIMITS.capacityMax, "Voyageurs");
  const pattern = o.q ? likePattern(o.q) : null;
  const cityPattern = o.city?.trim() ? likePattern(o.city) : null;

  const where: string[] = [HOST_OK];
  const args: unknown[] = [];
  where.push(o.mine ? "l.status IN ('active','paused')" : "l.status = 'active'");
  if (o.mine) { where.push("l.member_id = ?"); args.push(viewerId); }
  if (o.cursor != null) { where.push("l.id < ?"); args.push(o.cursor); }
  if (o.kind) { where.push("l.kind = ?"); args.push(o.kind); }
  if (o.priceType) { where.push("l.price_type = ?"); args.push(o.priceType); }
  if (cityPattern) { where.push("l.city LIKE ? ESCAPE '\\'"); args.push(cityPattern); }
  if (pattern) {
    where.push("(l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\' OR l.city LIKE ? ESCAPE '\\' OR l.area LIKE ? ESCAPE '\\')");
    args.push(pattern, pattern, pattern, pattern);
  }
  where.push("l.capacity >= ?"); args.push(guests);
  // A date filter keeps only listings whose window can hold the requested stay; an open-ended
  // bound only needs to fit on the side it is known.
  if (from) { where.push("(l.available_from IS NULL OR l.available_from <= ?)"); args.push(from); }
  if (from) { where.push("(l.available_to IS NULL OR l.available_to >= ?)"); args.push(from); }
  if (to) { where.push("(l.available_from IS NULL OR l.available_from <= ?)"); args.push(to); }
  if (to) { where.push("(l.available_to IS NULL OR l.available_to >= ?)"); args.push(to); }
  // a stay is only offered if no pending/accepted request already covers the window
  const blocked = "EXISTS (SELECT 1 FROM st_requests r WHERE r.listing_id = l.id AND r.status IN ('pending','accepted') AND r.start_date < ? AND ? < r.end_date)";
  if (from && to) { where.push(`NOT ${blocked}`); args.push(to, from); }
  else if (from) { where.push("NOT EXISTS (SELECT 1 FROM st_requests r WHERE r.listing_id = l.id AND r.status IN ('pending','accepted') AND r.end_date > ?)"); args.push(from); }
  else if (to) { where.push("NOT EXISTS (SELECT 1 FROM st_requests r WHERE r.listing_id = l.id AND r.status IN ('pending','accepted') AND r.start_date < ?)"); args.push(to); }

  const { results } = await d.prepare(
    `SELECT l.id, l.title, l.kind, l.price_type, l.price, l.city, l.area, l.capacity, l.status, l.created_at,
            l.available_from, l.available_to,
            m.id AS host_id, m.display_name AS host_name, m.avatar_key AS host_avatar,
            (SELECT ROUND(AVG(rating), 1) FROM st_reviews WHERE listing_id = l.id) AS rating,
            (SELECT COUNT(*) FROM st_reviews WHERE listing_id = l.id) AS review_count
     FROM st_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE ${where.join(" AND ")}
     ORDER BY l.id DESC LIMIT ?`,
  ).bind(...args, lim + 1).all<any>();
  const page = results.slice(0, lim);
  const covers = new Map<number, string>();
  if (page.length) {
    const ids = page.map(r => r.id);
    const m = await d.prepare(`SELECT listing_id, r2_key FROM st_listing_media WHERE position = 0 AND listing_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ listing_id: number; r2_key: string }>();
    for (const row of m.results) covers.set(row.listing_id, row.r2_key);
  }
  const listings: StayCard[] = page.map(r => ({
    id: r.id, title: r.title, kind: r.kind, price_type: r.price_type, price: r.price, city: r.city, area: r.area,
    capacity: r.capacity, status: r.status, available_from: r.available_from, available_to: r.available_to, created_at: r.created_at,
    host: { id: r.host_id, display_name: r.host_name, avatar_key: r.host_avatar }, cover: covers.get(r.id) ?? null,
    rating: r.rating ?? null, review_count: r.review_count ?? 0,
  }));
  return { listings, nextCursor: results.length > lim ? listings[listings.length - 1].id : null };
}

export async function getStayListing(d: D1Like, viewerId: number, id: number): Promise<StayDetail> {
  const r = await d.prepare(
    `SELECT l.*, m.id AS host_id, m.display_name AS host_name, m.avatar_key AS host_avatar,
            (SELECT ROUND(AVG(rating), 1) FROM st_reviews WHERE listing_id = l.id) AS rating,
            (SELECT COUNT(*) FROM st_reviews WHERE listing_id = l.id) AS review_count
     FROM st_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE l.id = ? AND l.status IN ('active','paused') AND ${HOST_OK}`,
  ).bind(id).first<any>();
  if (!r) throw new HubError("not_found", "Logement introuvable");
  const media = await d.prepare("SELECT r2_key FROM st_listing_media WHERE listing_id = ? ORDER BY position").bind(id).all<{ r2_key: string }>();
  const keys = media.results.map(x => x.r2_key);
  const mine = r.member_id === viewerId;
  return {
    id: r.id, title: r.title, description: r.description, kind: r.kind, city: r.city, area: r.area, capacity: r.capacity,
    rooms: r.rooms, price_type: r.price_type, price: r.price, amenities: parseAmenities(r.amenities),
    available_from: r.available_from, available_to: r.available_to, status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    host: { id: r.host_id, display_name: r.host_name, avatar_key: r.host_avatar },
    media: keys, mine, rating: r.rating ?? null, review_count: r.review_count ?? 0,
    contact: r.contact_phone ? { phone: r.contact_phone, whatsapp: Boolean(r.contact_whatsapp) } : null,
    reviews: await listListingReviews(d, id),
    ...(mine ? { media_keys: keys } : {}),
  };
}

export async function listListingReviews(d: D1Like, listingId: number): Promise<StayReviewView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.request_id, r.rating, r.body, r.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM st_reviews r JOIN hub_members m ON m.id = r.author_id WHERE r.listing_id = ? ORDER BY r.id DESC LIMIT 50`,
  ).bind(listingId).all<any>();
  return results.map(r => ({
    id: r.id, request_id: r.request_id, rating: r.rating, body: r.body, created_at: r.created_at,
    author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar },
  }));
}

// ---- requests (demandes de séjour) ---------------------------------------

async function activeListing(d: D1Like, listingId: number): Promise<{ id: number; member_id: number; capacity: number; available_from: string | null; available_to: string | null }> {
  const l = await d.prepare(
    `SELECT l.id, l.member_id, l.capacity, l.available_from, l.available_to FROM st_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE l.id = ? AND l.status = 'active' AND ${HOST_OK}`,
  ).bind(listingId).first<{ id: number; member_id: number; capacity: number; available_from: string | null; available_to: string | null }>();
  if (!l) throw new HubError("not_found", "Logement introuvable");
  return l;
}

export interface StayRequestInput { startDate: unknown; endDate: unknown; guests: unknown; message: unknown }

export async function createRequest(d: D1Like, guest: MemberRow, listingId: number, input: StayRequestInput, nowMs: number): Promise<{ id: number }> {
  const l = await activeListing(d, listingId);
  if (l.member_id === guest.id) throw new HubError("invalid", "Vous ne pouvez pas réserver votre propre logement");
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) throw new HubError("invalid", "Dates invalides (format AAAA-MM-JJ)");
  const start = input.startDate, end = input.endDate;
  const today = todayCasablanca(nowMs);
  if (start < today) throw new HubError("invalid", "La date d'arrivée est déjà passée");
  const nights = nightsBetween(start, end);
  if (nights < 1) throw new HubError("invalid", "La date de départ doit suivre la date d'arrivée");
  if (nights > ST_LIMITS.maxNights) throw new HubError("invalid", `Séjour trop long (${ST_LIMITS.maxNights} nuits max)`);
  const guests = cleanInt(input.guests, 1, ST_LIMITS.capacityMax, "Voyageurs");
  if (guests > l.capacity) throw new HubError("invalid", `Ce logement accueille ${l.capacity} voyageur(s) au maximum`);
  const message = cleanBody(input.message, ST_LIMITS.message, "Message");
  if (l.available_from && start < l.available_from) throw new HubError("invalid", `Logement disponible à partir du ${l.available_from}`);
  if (l.available_to && end > l.available_to) throw new HubError("invalid", `Logement disponible jusqu'au ${l.available_to}`);
  const busy = await d.prepare(
    "SELECT COUNT(*) AS n FROM st_requests WHERE listing_id = ? AND status IN ('pending','accepted') AND start_date < ? AND ? < end_date",
  ).bind(listingId, end, start).first<{ n: number }>();
  if ((busy?.n ?? 0) > 0) throw new HubError("invalid", "Ces dates ne sont plus disponibles");
  const n = await d.prepare("SELECT COUNT(*) AS n FROM st_requests WHERE guest_id = ? AND created_at > ?").bind(guest.id, iso(nowMs - DAY_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= ST_LIMITS.requestsPerDay) throw new HubError("rate_limited", `Limite de ${ST_LIMITS.requestsPerDay} demandes par jour atteinte`);
  const row = await d.prepare(
    "INSERT INTO st_requests (listing_id, guest_id, host_id, start_date, end_date, guests, message, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id",
  ).bind(listingId, guest.id, l.member_id, start, end, guests, message, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export type StayDecision = "accept" | "decline" | "cancel";

export async function decideRequest(d: D1Like, actor: MemberRow, requestId: number, action: string, hostReply: unknown, nowMs: number): Promise<void> {
  if (action !== "accept" && action !== "decline" && action !== "cancel") throw new HubError("invalid", "Action invalide");
  const r = await d.prepare("SELECT id, guest_id, host_id, status FROM st_requests WHERE id = ?").bind(requestId).first<{ id: number; guest_id: number; host_id: number; status: StayRequestStatus }>();
  if (!r) throw new HubError("not_found", "Demande introuvable");
  const isHost = r.host_id === actor.id;
  const isGuest = r.guest_id === actor.id;
  if (!isHost && !isGuest) throw new HubError("not_found", "Demande introuvable");
  if (action === "cancel") {
    if (r.status !== "pending" && r.status !== "accepted") throw new HubError("invalid", "Cette demande est déjà close");
  } else {
    if (!isHost) throw new HubError("forbidden", "Seul l'hôte peut répondre à cette demande");
    if (r.status !== "pending") throw new HubError("invalid", "Cette demande a déjà été traitée");
  }
  const status: StayRequestStatus = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
  const reply = isHost && typeof hostReply === "string" && hostReply.trim() ? cleanBody(hostReply, ST_LIMITS.reply, "Réponse") : null;
  await d.prepare("UPDATE st_requests SET status = ?, host_reply = COALESCE(?, host_reply), updated_at = ?, decided_at = ? WHERE id = ?")
    .bind(status, reply, iso(nowMs), iso(nowMs), requestId).run();
}

export async function listMyRequests(d: D1Like, memberId: number, role: "guest" | "host" | "all" = "all"): Promise<StayRequestSummary[]> {
  if (role !== "guest" && role !== "host" && role !== "all") throw new HubError("invalid", "Filtre invalide");
  const scope = role === "guest" ? "r.guest_id = ?" : role === "host" ? "r.host_id = ?" : "(r.guest_id = ? OR r.host_id = ?)";
  const { results } = await d.prepare(
    `SELECT r.id, r.listing_id, r.start_date, r.end_date, r.guests, r.status, r.created_at, r.host_reply,
            l.title AS listing_title, l.status AS listing_status, l.kind, l.city,
            (SELECT r2_key FROM st_listing_media WHERE listing_id = l.id AND position = 0) AS cover,
            o.id AS other_id, o.display_name AS other_name, o.avatar_key AS other_avatar,
            (SELECT COUNT(*) FROM st_request_messages x WHERE x.request_id = r.id AND x.sender_id <> ? AND x.read_at IS NULL AND x.status = 'visible') AS unread
     FROM st_requests r
     JOIN st_listings l ON l.id = r.listing_id
     JOIN hub_members o ON o.id = CASE WHEN r.guest_id = ? THEN r.host_id ELSE r.guest_id END
     WHERE ${scope} AND l.status <> 'hidden'
     ORDER BY r.id DESC LIMIT 100`,
  ).bind(...(role === "all" ? [memberId, memberId, memberId, memberId] : [memberId, memberId, memberId])).all<any>();
  return results.map(r => ({
    id: r.id, listing_id: r.listing_id, listing_title: r.listing_title, listing_status: r.listing_status, kind: r.kind, city: r.city,
    start_date: r.start_date, end_date: r.end_date, guests: r.guests, status: r.status, created_at: r.created_at, host_reply: r.host_reply,
    cover: r.cover, other: { id: r.other_id, display_name: r.other_name, avatar_key: r.other_avatar }, unread: r.unread ?? 0,
  }));
}

export async function getRequestDetail(d: D1Like, member: MemberRow, requestId: number): Promise<StayRequestDetail> {
  const r = await d.prepare(
    `SELECT r.*, l.title AS listing_title, l.status AS listing_status, l.kind AS listing_kind, l.city AS listing_city,
            g.display_name AS guest_name, g.avatar_key AS guest_avatar,
            h.display_name AS host_name, h.avatar_key AS host_avatar,
            (SELECT COUNT(*) FROM st_reviews WHERE request_id = r.id) AS reviewed,
            (SELECT COUNT(*) FROM st_request_messages x WHERE x.request_id = r.id AND x.sender_id <> ? AND x.read_at IS NULL AND x.status = 'visible') AS unread
     FROM st_requests r JOIN st_listings l ON l.id = r.listing_id
     JOIN hub_members g ON g.id = r.guest_id JOIN hub_members h ON h.id = r.host_id
     WHERE r.id = ?`,
  ).bind(member.id, requestId).first<any>();
  if (!r) throw new HubError("not_found", "Demande introuvable");
  const isGuest = r.guest_id === member.id;
  const isHost = r.host_id === member.id;
  if (!isGuest && !isHost) throw new HubError("not_found", "Demande introuvable");
  const review = await d.prepare("SELECT rating, body, created_at FROM st_reviews WHERE request_id = ?").bind(requestId).first<{ rating: number; body: string; created_at: string }>();
  return {
    id: r.id,
    listing: { id: r.listing_id, title: r.listing_title, status: r.listing_status, kind: r.listing_kind, city: r.listing_city },
    guest: { id: r.guest_id, display_name: r.guest_name, avatar_key: r.guest_avatar },
    host: { id: r.host_id, display_name: r.host_name, avatar_key: r.host_avatar },
    start_date: r.start_date, end_date: r.end_date, guests: r.guests, message: r.message, status: r.status,
    host_reply: r.host_reply, created_at: r.created_at, updated_at: r.updated_at, decided_at: r.decided_at,
    role: isGuest ? "guest" : "host",
    can_review: isGuest && r.status === "accepted" && Number(r.reviewed ?? 0) === 0,
    review: review ?? null,
    unread: r.unread ?? 0,
  };
}

// ---- request messages -----------------------------------------------------

interface RequestRow { id: number; listing_id: number; guest_id: number; host_id: number; status: StayRequestStatus; listing_title: string; listing_status: string }

/** Request the member takes part in. Outsiders get a 404 (existence is not revealed). */
async function participantRequest(d: D1Like, member: MemberRow, requestId: number): Promise<RequestRow> {
  const r = await d.prepare(
    `SELECT r.id, r.listing_id, r.guest_id, r.host_id, r.status, l.title AS listing_title, l.status AS listing_status
     FROM st_requests r JOIN st_listings l ON l.id = r.listing_id WHERE r.id = ?`,
  ).bind(requestId).first<RequestRow>();
  if (!r || (r.guest_id !== member.id && r.host_id !== member.id)) throw new HubError("not_found", "Demande introuvable");
  return r;
}

/** A closed request (declined/cancelled) or a hidden listing freezes its conversation. */
function assertThreadOpen(r: RequestRow): void {
  if (r.status !== "pending" && r.status !== "accepted") throw new HubError("forbidden", "Cette demande est close");
  if (r.listing_status === "hidden") throw new HubError("forbidden", "Cette demande est close");
}

export async function listRequestMessages(d: D1Like, member: MemberRow, requestId: number, before: number | null = null) {
  const r = await participantRequest(d, member, requestId);
  const { results } = await d.prepare(
    "SELECT id, sender_id, body, created_at, read_at FROM st_request_messages WHERE request_id = ? AND status = 'visible' AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT 51",
  ).bind(requestId, before, before).all<StayMessageView>();
  const page = results.slice(0, 50).reverse();
  const otherId = r.guest_id === member.id ? r.host_id : r.guest_id;
  const o = await d.prepare("SELECT id, display_name, avatar_key FROM hub_members WHERE id = ?").bind(otherId).first<StayHost>();
  return {
    messages: page,
    nextCursor: results.length > 50 ? page[0].id : null,
    other: o!,
    request: { id: r.id, status: r.status, listing: { id: r.listing_id, title: r.listing_title, status: r.listing_status } },
  };
}

export async function sendRequestMessage(d: D1Like, member: MemberRow, requestId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const r = await participantRequest(d, member, requestId);
  assertThreadOpen(r);
  const body = cleanBody(rawBody, ST_LIMITS.message, "Message");
  const n = await d.prepare("SELECT COUNT(*) AS n FROM st_request_messages WHERE sender_id = ? AND created_at > ?").bind(member.id, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= ST_LIMITS.messagesPerHour) throw new HubError("rate_limited", "Trop de messages, réessayez plus tard");
  const row = await d.prepare("INSERT INTO st_request_messages (request_id, sender_id, body, created_at) VALUES (?,?,?,?) RETURNING id")
    .bind(requestId, member.id, body, iso(nowMs)).first<{ id: number }>();
  await d.prepare("UPDATE st_requests SET updated_at = ? WHERE id = ?").bind(iso(nowMs), requestId).run();
  return { id: row!.id };
}

export async function markRequestRead(d: D1Like, member: MemberRow, requestId: number, nowMs: number): Promise<void> {
  await participantRequest(d, member, requestId);
  await d.prepare("UPDATE st_request_messages SET read_at = ? WHERE request_id = ? AND sender_id <> ? AND read_at IS NULL")
    .bind(iso(nowMs), requestId, member.id).run();
}

export async function unreadTotal(d: D1Like, memberId: number): Promise<number> {
  const r = await d.prepare(
    `SELECT
       (SELECT COUNT(*) FROM st_request_messages x JOIN st_requests q ON q.id = x.request_id JOIN st_listings l ON l.id = q.listing_id
          WHERE (q.guest_id = ? OR q.host_id = ?) AND x.sender_id <> ? AND x.read_at IS NULL AND x.status = 'visible' AND l.status <> 'hidden')
       + (SELECT COUNT(*) FROM st_requests q JOIN st_listings l ON l.id = q.listing_id WHERE q.host_id = ? AND q.status = 'pending' AND l.status <> 'hidden') AS n`,
  ).bind(memberId, memberId, memberId, memberId).first<{ n: number }>();
  return r?.n ?? 0;
}

// ---- reviews --------------------------------------------------------------

export async function reviewRequest(d: D1Like, member: MemberRow, requestId: number, rating: unknown, rawBody: unknown, nowMs: number): Promise<{ id: number }> {
  const r = await d.prepare("SELECT id, listing_id, guest_id, status FROM st_requests WHERE id = ?").bind(requestId).first<{ id: number; listing_id: number; guest_id: number; status: StayRequestStatus }>();
  if (!r) throw new HubError("not_found", "Demande introuvable");
  if (r.guest_id !== member.id) throw new HubError("forbidden", "Seul le voyageur peut laisser un avis");
  if (r.status !== "accepted") throw new HubError("invalid", "Vous pourrez laisser un avis après acceptation de votre demande");
  const cleanRating = cleanInt(rating, 1, 5, "Note");
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (body.length > ST_LIMITS.review) throw new HubError("invalid", `Avis trop long (${ST_LIMITS.review} caractères max)`);
  const existing = await d.prepare("SELECT 1 AS ok FROM st_reviews WHERE request_id = ?").bind(requestId).first();
  if (existing) throw new HubError("invalid", "Vous avez déjà laissé un avis");
  const row = await d.prepare("INSERT INTO st_reviews (request_id, listing_id, author_id, rating, body, created_at) VALUES (?,?,?,?,?,?) RETURNING id")
    .bind(requestId, r.listing_id, member.id, cleanRating, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

// ---- reports / admin ------------------------------------------------------

const ST_TABLE = { listing: "st_listings", message: "st_request_messages" } as const;
function stayTable(type: string): "st_listings" | "st_request_messages" {
  if (!Object.hasOwn(ST_TABLE, type)) throw new HubError("invalid", "Type invalide");
  return ST_TABLE[type as keyof typeof ST_TABLE];
}

export async function reportStay(d: D1Like, member: MemberRow, type: "listing" | "message", id: number, rawReason: string): Promise<void> {
  const t = stayTable(type);
  const reason = cleanBody(rawReason, ST_LIMITS.reason, "Motif");
  const visible = t === "st_listings" ? "status IN ('active','paused')" : "status = 'visible'";
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ? AND ${visible}`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare("INSERT OR IGNORE INTO st_reports (target_type, target_id, member_id, reason) VALUES (?,?,?,?)").bind(type, id, member.id, reason).run();
}

export async function listStayReports(d: D1Like): Promise<StayReportView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, m.display_name AS reporter,
       CASE r.target_type WHEN 'listing' THEN (SELECT title FROM st_listings WHERE id = r.target_id) ELSE (SELECT body FROM st_request_messages WHERE id = r.target_id) END AS body,
       CASE r.target_type WHEN 'listing' THEN (SELECT status FROM st_listings WHERE id = r.target_id) ELSE (SELECT status FROM st_request_messages WHERE id = r.target_id) END AS target_status
     FROM st_reports r JOIN hub_members m ON m.id = r.member_id ORDER BY r.id DESC LIMIT 100`,
  ).all<StayReportView>();
  return results;
}

export async function dismissStayReport(d: D1Like, id: number): Promise<void> {
  await d.prepare("DELETE FROM st_reports WHERE id = ?").bind(id).run();
}

export async function hideStayContent(d: D1Like, type: "listing" | "message", id: number): Promise<void> {
  const t = stayTable(type);
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ?`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

export async function adminListStayListings(d: D1Like): Promise<AdminStayListing[]> {
  const { results } = await d.prepare(
    `SELECT l.id, l.title, l.kind, l.price_type, l.price, l.status, m.display_name AS host, l.created_at
     FROM st_listings l JOIN hub_members m ON m.id = l.member_id ORDER BY l.id DESC LIMIT 100`,
  ).all<AdminStayListing>();
  return results;
}
