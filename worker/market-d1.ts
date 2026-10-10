/**
 * Marketplace data layer on Cloudflare D1 (tables mk_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, cleanBody, iso, isOwnPath, type MemberRow } from "./hub-d1";

export const MK_CATEGORIES = ["maison", "mode", "high-tech", "enfants", "livres", "vehicules", "autre"] as const;
export const MK_CONDITIONS = ["neuf", "bon", "correct"] as const;
export const MK_LIMITS = {
  listingsPerDay: 5, commentsPerHour: 30, messagesPerHour: 30, threadsPerHour: 20,
  title: 80, description: 2000, city: 60, comment: 500, message: 1000, photos: 4, maxPrice: 9_999_999, reason: 300, likePatternBytes: 50,
};
const DAY_MS = 24 * HOUR_MS;

/** Sellers whose hub account is suspended, or whose volunteer is no longer confirmed/present, vanish. m = hub_members alias. */
export const SELLER_OK = `m.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))`;

export interface Seller { id: number; display_name: string; avatar_key: string | null }
export interface ListingCard { id: number; title: string; price: number; category: string; condition: string; city: string; status: "active" | "sold"; created_at: string; seller: Seller; cover: string | null }
export interface ListingDetail extends Omit<ListingCard, "cover"> {
  description: string; updated_at: string; media: string[]; mine: boolean;
  contact: { phone: string; whatsapp: boolean } | null;
  media_keys?: string[]; // owner only
}
export interface ListingInput { title: string; description: string; price: number; category: string; condition: string; city?: string; phone?: unknown; whatsapp?: boolean; mediaPaths?: string[] }

export function normalizePhone(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new HubError("invalid", "Téléphone invalide");
  const p = raw.replace(/[\s.\-()]/g, "");
  if (p === "") return null;
  if (!/^\+?\d{8,15}$/.test(p)) throw new HubError("invalid", "Téléphone invalide (8 à 15 chiffres)");
  return p;
}

interface Clean { title: string; description: string; price: number; category: string; condition: string; city: string; phone: string | null; whatsapp: boolean; media: string[] }
function clean(member: MemberRow, i: ListingInput): Clean {
  const title = cleanBody(i.title, MK_LIMITS.title, "Titre");
  const description = cleanBody(i.description, MK_LIMITS.description, "Description");
  if (!Number.isSafeInteger(i.price) || i.price < 0 || i.price > MK_LIMITS.maxPrice) throw new HubError("invalid", "Prix invalide (entier en MAD, 0 = gratuit)");
  if (!(MK_CATEGORIES as readonly string[]).includes(i.category)) throw new HubError("invalid", "Catégorie invalide");
  if (!(MK_CONDITIONS as readonly string[]).includes(i.condition)) throw new HubError("invalid", "État invalide");
  const city = typeof i.city === "string" ? i.city.trim() : "";
  if (city.length > MK_LIMITS.city) throw new HubError("invalid", "Ville trop longue (60 caractères max)");
  const phone = normalizePhone(i.phone);
  const whatsapp = i.whatsapp === true && phone !== null;
  if (whatsapp && !phone!.startsWith("+")) throw new HubError("invalid", "Pour WhatsApp, saisissez le numéro au format international (+212…)");
  const media = i.mediaPaths ?? [];
  if (media.length > MK_LIMITS.photos || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");
  return { title, description, price: i.price, category: i.category, condition: i.condition, city, phone, whatsapp, media };
}

export async function createListing(d: D1Like, member: MemberRow, input: ListingInput, nowMs: number): Promise<{ id: number }> {
  const c = clean(member, input);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mk_listings WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - DAY_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MK_LIMITS.listingsPerDay) throw new HubError("rate_limited", "Limite de 5 annonces par jour atteinte");
  const row = await d.prepare(
    "INSERT INTO mk_listings (member_id, title, description, price, category, item_condition, city, contact_phone, contact_whatsapp, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
  ).bind(member.id, c.title, c.description, c.price, c.category, c.condition, c.city, c.phone, c.whatsapp ? 1 : 0, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  // ponytail: listing then photos are two statements (not atomic); a failed photo insert leaves a photo-less listing
  if (c.media.length) await d.batch(c.media.map((p, i) => d.prepare("INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

async function ownedListing(d: D1Like, member: MemberRow, id: number): Promise<void> {
  const r = await d.prepare("SELECT member_id, status FROM mk_listings WHERE id = ?").bind(id).first<{ member_id: number; status: string }>();
  if (!r || r.status === "hidden") throw new HubError("not_found", "Annonce introuvable");
  if (r.member_id !== member.id) throw new HubError("forbidden", "Action non autorisée");
}

export async function updateListing(d: D1Like, member: MemberRow, id: number, input: ListingInput, nowMs: number): Promise<void> {
  const c = clean(member, input);
  await ownedListing(d, member, id);
  await d.batch([
    d.prepare("UPDATE mk_listings SET title=?, description=?, price=?, category=?, item_condition=?, city=?, contact_phone=?, contact_whatsapp=?, updated_at=? WHERE id=?")
      .bind(c.title, c.description, c.price, c.category, c.condition, c.city, c.phone, c.whatsapp ? 1 : 0, iso(nowMs), id),
    d.prepare("DELETE FROM mk_listing_media WHERE listing_id = ?").bind(id),
    ...c.media.map((p, i) => d.prepare("INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (?,?,?)").bind(id, p, i)),
  ]);
}

export async function setListingStatus(d: D1Like, member: MemberRow, id: number, status: "active" | "sold", nowMs: number): Promise<void> {
  if (status !== "active" && status !== "sold") throw new HubError("invalid", "Statut invalide");
  await ownedListing(d, member, id);
  await d.prepare("UPDATE mk_listings SET status = ?, updated_at = ? WHERE id = ?").bind(status, iso(nowMs), id).run();
}

/** Soft delete. With an actor: owner or moderator only. Without: admin (caller already authorised). */
export async function hideListing(d: D1Like, id: number, actor?: MemberRow): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM mk_listings WHERE id = ? AND status <> 'hidden'").bind(id).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Annonce introuvable");
  if (actor && actor.id !== r.member_id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE mk_listings SET status = 'hidden' WHERE id = ?").bind(id).run();
}

export async function listListings(
  d: D1Like, viewerId: number,
  o: { cursor?: number | null; category?: string; q?: string; mine?: boolean; limit?: number } = {},
): Promise<{ listings: ListingCard[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? 20) || 20, 1), 50);
  const cat = o.category || null;
  if (cat !== null && !(MK_CATEGORIES as readonly string[]).includes(cat)) throw new HubError("invalid", "Catégorie invalide");
  const q = (o.q ?? "").trim();
  let pattern: string | null = null;
  if (q) {
    pattern = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    if (new TextEncoder().encode(pattern).length > MK_LIMITS.likePatternBytes) throw new HubError("invalid", "Recherche trop longue");
  }
  const cursor = o.cursor ?? null;
  const { results } = await d.prepare(
    `SELECT l.id, l.title, l.price, l.category, l.item_condition AS condition, l.city, l.status, l.created_at,
            m.id AS seller_id, m.display_name AS seller_name, m.avatar_key AS seller_avatar
     FROM mk_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE l.status IN ('active','sold') AND ${SELLER_OK}
       AND (? IS NULL OR l.id < ?) AND (? IS NULL OR l.category = ?) AND (? = 0 OR l.member_id = ?)
       AND (? IS NULL OR l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\')
     ORDER BY l.id DESC LIMIT ?`,
  ).bind(cursor, cursor, cat, cat, o.mine ? 1 : 0, viewerId, pattern, pattern, pattern, lim + 1).all<any>();
  const page = results.slice(0, lim);
  const covers = new Map<number, string>();
  if (page.length) {
    const ids = page.map(r => r.id);
    const m = await d.prepare(`SELECT listing_id, r2_key FROM mk_listing_media WHERE position = 0 AND listing_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ listing_id: number; r2_key: string }>();
    for (const row of m.results) covers.set(row.listing_id, row.r2_key);
  }
  const listings: ListingCard[] = page.map(r => ({
    id: r.id, title: r.title, price: r.price, category: r.category, condition: r.condition, city: r.city, status: r.status, created_at: r.created_at,
    seller: { id: r.seller_id, display_name: r.seller_name, avatar_key: r.seller_avatar }, cover: covers.get(r.id) ?? null,
  }));
  return { listings, nextCursor: results.length > lim ? listings[listings.length - 1].id : null };
}

export async function getListing(d: D1Like, viewerId: number, id: number): Promise<ListingDetail> {
  const r = await d.prepare(
    `SELECT l.*, l.item_condition AS condition, m.id AS seller_id, m.display_name AS seller_name, m.avatar_key AS seller_avatar
     FROM mk_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE l.id = ? AND l.status IN ('active','sold') AND ${SELLER_OK}`,
  ).bind(id).first<any>();
  if (!r) throw new HubError("not_found", "Annonce introuvable");
  const media = await d.prepare("SELECT r2_key FROM mk_listing_media WHERE listing_id = ? ORDER BY position").bind(id).all<{ r2_key: string }>();
  const keys = media.results.map(x => x.r2_key);
  const mine = r.member_id === viewerId;
  return {
    id: r.id, title: r.title, description: r.description, price: r.price, category: r.category, condition: r.condition, city: r.city,
    status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    seller: { id: r.seller_id, display_name: r.seller_name, avatar_key: r.seller_avatar },
    media: keys, mine,
    contact: r.contact_phone ? { phone: r.contact_phone, whatsapp: Boolean(r.contact_whatsapp) } : null,
    ...(mine ? { media_keys: keys } : {}),
  };
}

// ---- comments -------------------------------------------------------------

export interface MkCommentView { id: number; listing_id: number; body: string; created_at: string; author: Seller }

async function visibleListing(d: D1Like, id: number): Promise<void> {
  const r = await d.prepare(`SELECT 1 AS ok FROM mk_listings l JOIN hub_members m ON m.id = l.member_id WHERE l.id = ? AND l.status IN ('active','sold') AND ${SELLER_OK}`).bind(id).first();
  if (!r) throw new HubError("not_found", "Annonce introuvable");
}

export async function addListingComment(d: D1Like, member: MemberRow, listingId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(rawBody, MK_LIMITS.comment, "Commentaire");
  await visibleListing(d, listingId);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mk_comments WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MK_LIMITS.commentsPerHour) throw new HubError("rate_limited", "Trop de commentaires, réessayez plus tard");
  const row = await d.prepare("INSERT INTO mk_comments (listing_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(listingId, member.id, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listListingComments(d: D1Like, listingId: number): Promise<MkCommentView[]> {
  await visibleListing(d, listingId);
  const { results } = await d.prepare(
    `SELECT c.id, c.listing_id, c.body, c.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM mk_comments c JOIN hub_members m ON m.id = c.member_id WHERE c.listing_id = ? AND c.status = 'visible' ORDER BY c.id ASC LIMIT 200`,
  ).bind(listingId).all<any>();
  return results.map(r => ({ id: r.id, listing_id: r.listing_id, body: r.body, created_at: r.created_at, author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar } }));
}

export async function removeListingComment(d: D1Like, actor: MemberRow, commentId: number): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM mk_comments WHERE id = ? AND status = 'visible'").bind(commentId).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Commentaire introuvable");
  if (r.member_id !== actor.id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE mk_comments SET status = 'hidden' WHERE id = ?").bind(commentId).run();
}

// ---- reports / admin ------------------------------------------------------

const MK_TABLE = { listing: "mk_listings", comment: "mk_comments" } as const;
function mkTable(type: string): "mk_listings" | "mk_comments" {
  if (!Object.hasOwn(MK_TABLE, type)) throw new HubError("invalid", "Type invalide");
  return MK_TABLE[type as keyof typeof MK_TABLE];
}

export interface MkReportView { id: number; target_type: "listing" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminListingView { id: number; title: string; price: number; status: string; seller: string; created_at: string }

export async function reportMarket(d: D1Like, member: MemberRow, type: "listing" | "comment", id: number, rawReason: string): Promise<void> {
  const t = mkTable(type);
  const reason = cleanBody(rawReason, MK_LIMITS.reason, "Motif");
  const visible = t === "mk_listings" ? "status IN ('active','sold')" : "status = 'visible'";
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ? AND ${visible}`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare("INSERT OR IGNORE INTO mk_reports (target_type, target_id, member_id, reason) VALUES (?,?,?,?)").bind(type, id, member.id, reason).run();
}

export async function listMarketReports(d: D1Like): Promise<MkReportView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, m.display_name AS reporter,
       CASE r.target_type WHEN 'listing' THEN (SELECT title FROM mk_listings WHERE id = r.target_id) ELSE (SELECT body FROM mk_comments WHERE id = r.target_id) END AS body,
       CASE r.target_type WHEN 'listing' THEN (SELECT status FROM mk_listings WHERE id = r.target_id) ELSE (SELECT status FROM mk_comments WHERE id = r.target_id) END AS target_status
     FROM mk_reports r JOIN hub_members m ON m.id = r.member_id ORDER BY r.id DESC LIMIT 100`,
  ).all<MkReportView>();
  return results;
}

export async function dismissMarketReport(d: D1Like, id: number): Promise<void> {
  await d.prepare("DELETE FROM mk_reports WHERE id = ?").bind(id).run();
}

export async function hideMarketContent(d: D1Like, type: "listing" | "comment", id: number): Promise<void> {
  const t = mkTable(type);
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ?`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

export async function adminListListings(d: D1Like): Promise<AdminListingView[]> {
  const { results } = await d.prepare(
    "SELECT l.id, l.title, l.price, l.status, m.display_name AS seller, l.created_at FROM mk_listings l JOIN hub_members m ON m.id = l.member_id ORDER BY l.id DESC LIMIT 100",
  ).all<AdminListingView>();
  return results;
}
