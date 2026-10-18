/**
 * Salons thématiques du Hub (feed + visio Jitsi) — couche données sur Cloudflare D1 (tables sl_*). Réutilise les membres du Hub.
 * Aucun import HTTP / Supabase : testable avec un faux D1. Le temps est toujours passé en paramètre (nowMs).
 */
import { z } from "zod";
import type { D1Like } from "./gallery-d1";
import { HubError, iso, HOUR_MS, type MemberRow } from "./hub-d1";
import { HOST_OK } from "./stay-d1";

export const SL_LIMITS = { salonsPerDay: 5, postsPerMinute: 20, title: 80, topic: 500, body: 2000, pageSize: 30 };
const DAY_MS = 24 * HOUR_MS;
const MINUTE_MS = 60_000;
// ponytail: curseur = "<activité ISO>_<id>" ; un format invalide est refusé, pas deviné
const CURSOR_RE = /^([0-9TZ:.-]{20,30})_(\d+)$/;

export type SalonStatus = "active" | "archived" | "hidden";
export interface SalonPerson { id: number; display_name: string; avatar_key: string | null }
export interface SalonCard {
  id: number; title: string; topic: string; status: SalonStatus; post_count: number;
  last_post_at: string | null; created_at: string; mine: boolean; creator: SalonPerson;
}
export interface SalonDetail extends SalonCard { room: string }
export interface AdminSalon { id: number; title: string; status: SalonStatus; creator: string; post_count: number }

// ---- validation -----------------------------------------------------------

const text = (label: string, max: number) =>
  z.string({ required_error: `${label} requis`, invalid_type_error: `${label} invalide` })
    .transform(v => v.trim())
    .pipe(z.string().min(1, `${label} requis`).max(max, `${label} trop long (${max} caractères max)`));

const salonSchema = z.object({ title: text("Titre", SL_LIMITS.title), topic: text("Sujet", SL_LIMITS.topic) });

export function parse<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new HubError("invalid", r.error.issues[0]?.message ?? "Données invalides");
  return r.data;
}

// ---- create / list / detail ----------------------------------------------

export async function createSalon(d: D1Like, member: MemberRow, raw: unknown, nowMs: number): Promise<{ id: number }> {
  const c = parse(salonSchema, raw);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM sl_salons WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - DAY_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= SL_LIMITS.salonsPerDay) throw new HubError("rate_limited", `Limite de ${SL_LIMITS.salonsPerDay} salons par jour atteinte`);
  const room = crypto.randomUUID().replaceAll("-", "");
  const row = await d.prepare("INSERT INTO sl_salons (member_id, title, topic, room, created_at) VALUES (?,?,?,?,?) RETURNING id")
    .bind(member.id, c.title, c.topic, room, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

/** Alias: s = sl_salons, m = créateur (hub_members, comme HOST_OK l'attend). `extra` = colonnes en plus (ex. ", s.room"). */
const cardSelect = (extra = "") => `SELECT s.id, s.title, s.topic, s.status, s.last_post_at, s.created_at, s.member_id${extra},
    COALESCE(s.last_post_at, s.created_at) AS activity,
    (SELECT COUNT(*) FROM sl_posts p WHERE p.salon_id = s.id AND p.deleted_at IS NULL) AS post_count,
    m.id AS cr_id, m.display_name AS cr_name, m.avatar_key AS cr_avatar
  FROM sl_salons s JOIN hub_members m ON m.id = s.member_id`;

function toCard(r: any, viewerId: number): SalonCard {
  return {
    id: r.id, title: r.title, topic: r.topic, status: r.status, post_count: r.post_count ?? 0,
    last_post_at: r.last_post_at ?? null, created_at: r.created_at, mine: r.member_id === viewerId,
    creator: { id: r.cr_id, display_name: r.cr_name, avatar_key: r.cr_avatar },
  };
}

/** Salons actifs, activité la plus récente d'abord, pagination keyset sur (activité, id). */
export async function listSalons(d: D1Like, viewerId: number, o: { cursor?: string | null; limit?: number } = {}): Promise<{ salons: SalonCard[]; nextCursor: string | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? SL_LIMITS.pageSize) || SL_LIMITS.pageSize, 1), 50);
  const where = [HOST_OK, "s.status = 'active'"];
  const args: unknown[] = [];
  if (o.cursor) {
    const c = CURSOR_RE.exec(o.cursor);
    if (!c) throw new HubError("invalid", "Curseur invalide");
    where.push("(COALESCE(s.last_post_at, s.created_at) < ? OR (COALESCE(s.last_post_at, s.created_at) = ? AND s.id < ?))");
    args.push(c[1], c[1], Number(c[2]));
  }
  const { results } = await d.prepare(`${cardSelect()} WHERE ${where.join(" AND ")} ORDER BY activity DESC, s.id DESC LIMIT ?`)
    .bind(...args, lim + 1).all<any>();
  const page = results.slice(0, lim);
  const last = page[page.length - 1];
  return { salons: page.map(r => toCard(r, viewerId)), nextCursor: results.length > lim && last ? `${last.activity}_${last.id}` : null };
}

/** Détail (avec `room`) d'un salon actif ou archivé ; masqué, inconnu ou créateur suspendu = 404. */
export async function getSalon(d: D1Like, viewerId: number, id: number): Promise<SalonDetail> {
  const r = await d.prepare(`${cardSelect(", s.room")} WHERE s.id = ? AND s.status IN ('active','archived') AND ${HOST_OK}`).bind(id).first<any>();
  if (!r) throw new HubError("not_found", "Salon introuvable");
  return { ...toCard(r, viewerId), room: r.room };
}

// ---- archive / admin ------------------------------------------------------

export async function archiveSalon(d: D1Like, member: MemberRow, id: number): Promise<void> {
  const s = await d.prepare("SELECT member_id, status FROM sl_salons WHERE id = ?").bind(id).first<{ member_id: number; status: SalonStatus }>();
  if (!s || s.status === "hidden") throw new HubError("not_found", "Salon introuvable");
  if (s.member_id !== member.id) throw new HubError("forbidden", "Seul le créateur peut archiver ce salon");
  await d.prepare("UPDATE sl_salons SET status = 'archived' WHERE id = ? AND status = 'active'").bind(id).run();
}

export async function adminListSalons(d: D1Like): Promise<AdminSalon[]> {
  const { results } = await d.prepare(
    `SELECT s.id, s.title, s.status, m.display_name AS creator,
       (SELECT COUNT(*) FROM sl_posts p WHERE p.salon_id = s.id AND p.deleted_at IS NULL) AS post_count
     FROM sl_salons s JOIN hub_members m ON m.id = s.member_id ORDER BY s.id DESC LIMIT 100`,
  ).all<AdminSalon>();
  return results;
}

async function assertExists(d: D1Like, id: number): Promise<void> {
  if (!(await d.prepare("SELECT 1 AS ok FROM sl_salons WHERE id = ?").bind(id).first())) throw new HubError("not_found", "Salon introuvable");
}

/** Soft delete : le salon disparaît partout. */
export async function hideSalon(d: D1Like, id: number): Promise<void> {
  await assertExists(d, id);
  await d.prepare("UPDATE sl_salons SET status = 'hidden' WHERE id = ?").bind(id).run();
}

/** Suppression définitive : messages d'abord, pour ne pas dépendre du pragma de clés étrangères. */
export async function deleteSalon(d: D1Like, id: number): Promise<void> {
  await assertExists(d, id);
  await d.batch([
    d.prepare("DELETE FROM sl_posts WHERE salon_id = ?").bind(id),
    d.prepare("DELETE FROM sl_salons WHERE id = ?").bind(id),
  ]);
}

// ---- posts ----------------------------------------------------------------

export interface SalonPost { id: number; body: string; created_at: string; mine: boolean; author: SalonPerson }

const postSchema = z.object({ body: text("Message", SL_LIMITS.body) });

/** Statut d'un salon lisible (actif ou archivé, créateur valide) ; sinon 404. */
async function readableStatus(d: D1Like, salonId: number): Promise<SalonStatus> {
  const r = await d.prepare(
    `SELECT s.status FROM sl_salons s JOIN hub_members m ON m.id = s.member_id
     WHERE s.id = ? AND s.status IN ('active','archived') AND ${HOST_OK}`,
  ).bind(salonId).first<{ status: SalonStatus }>();
  if (!r) throw new HubError("not_found", "Salon introuvable");
  return r.status;
}

export async function createPost(d: D1Like, member: MemberRow, salonId: number, raw: unknown, nowMs: number): Promise<{ id: number }> {
  const c = parse(postSchema, raw);
  if ((await readableStatus(d, salonId)) !== "active") throw new HubError("conflict", "Ce salon est archivé");
  const n = await d.prepare("SELECT COUNT(*) AS n FROM sl_posts WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - MINUTE_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= SL_LIMITS.postsPerMinute) throw new HubError("rate_limited", `Limite de ${SL_LIMITS.postsPerMinute} messages par minute atteinte`);
  const row = await d.prepare("INSERT INTO sl_posts (salon_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id")
    .bind(salonId, member.id, c.body, iso(nowMs)).first<{ id: number }>();
  // ponytail: deux requêtes, pas de transaction ; au pire last_post_at retarde d'un message
  await d.prepare("UPDATE sl_salons SET last_post_at = ? WHERE id = ?").bind(iso(nowMs), salonId).run();
  return { id: row!.id };
}

/** Messages non supprimés, plus récents d'abord ; curseur = id du dernier message renvoyé. */
export async function listPosts(d: D1Like, viewerId: number, salonId: number, o: { cursor?: string | null; limit?: number } = {}): Promise<{ posts: SalonPost[]; nextCursor: string | null }> {
  await readableStatus(d, salonId);
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? SL_LIMITS.pageSize) || SL_LIMITS.pageSize, 1), 50);
  if (o.cursor && !/^\d{1,15}$/.test(o.cursor)) throw new HubError("invalid", "Curseur invalide");
  const { results } = await d.prepare(
    `SELECT p.id, p.body, p.created_at, p.member_id, m.id AS au_id, m.display_name AS au_name, m.avatar_key AS au_avatar
     FROM sl_posts p JOIN hub_members m ON m.id = p.member_id
     WHERE p.salon_id = ? AND p.deleted_at IS NULL AND ${HOST_OK}${o.cursor ? " AND p.id < ?" : ""}
     ORDER BY p.id DESC LIMIT ?`,
  ).bind(salonId, ...(o.cursor ? [Number(o.cursor)] : []), lim + 1).all<any>();
  const page = results.slice(0, lim);
  const last = page[page.length - 1];
  return {
    posts: page.map(r => ({
      id: r.id, body: r.body, created_at: r.created_at, mine: r.member_id === viewerId,
      author: { id: r.au_id, display_name: r.au_name, avatar_key: r.au_avatar },
    })),
    nextCursor: results.length > lim && last ? String(last.id) : null,
  };
}

export async function deletePost(d: D1Like, member: MemberRow, salonId: number, postId: number): Promise<void> {
  const p = await d.prepare("SELECT member_id, deleted_at FROM sl_posts WHERE id = ? AND salon_id = ?").bind(postId, salonId).first<{ member_id: number; deleted_at: string | null }>();
  if (!p || p.deleted_at) throw new HubError("not_found", "Message introuvable");
  if (p.member_id !== member.id) throw new HubError("forbidden", "Seul l'auteur peut supprimer son message");
  await d.prepare("UPDATE sl_posts SET deleted_at = ? WHERE id = ?").bind(iso(Date.now()), postId).run();
}
