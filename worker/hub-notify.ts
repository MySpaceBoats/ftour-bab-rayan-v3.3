/**
 * Hub notifications on D1: an in-app row (bell) is always recorded; the email channel (Resend) follows a per-type preference.
 * No HTTP imports besides the injected Mailer: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { escapeHtml, sendEmailBatch, type BatchEmail } from "./email";
import { HubError, TEAM_EMAIL, iso, type MemberRow } from "./hub-d1";
import { appBaseUrl } from "./hub-http";

export const NOTIF_TYPES = ["like", "comment", "gallery", "announcement", "volunteer"] as const;
export type NotifType = (typeof NOTIF_TYPES)[number];
/** Email channel defaults (the bell always records everything). Likes are noisy: off. */
export const EMAIL_DEFAULTS: Record<NotifType, boolean> = { like: false, comment: true, gallery: true, announcement: true, volunteer: true };

export interface NotifInput { type: NotifType; title: string; body?: string; link?: string; dedupeKey?: string }
export interface Mailer { baseUrl: string; sendBatch(msgs: BatchEmail[]): Promise<unknown> }

export function mailerFromEnv(env: { PUBLIC_APP_URL?: string; RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string }): Mailer {
  const apiKey = env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "";
  return { baseUrl: appBaseUrl(env), sendBatch: msgs => sendEmailBatch(apiKey, msgs) };
}

const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const dmy = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

// ---- data ---------------------------------------------------------------------

/** Records one in-app notification for an active, non-team member. null when skipped (inactive member or duplicate dedupe_key). */
export async function notify(d: D1Like, memberId: number, n: NotifInput, nowMs: number): Promise<number | null> {
  const r = await d.prepare(
    `INSERT INTO hub_notifications (member_id, type, title, body, link, dedupe_key, created_at)
     SELECT id, ?, ?, ?, ?, ?, ? FROM hub_members WHERE id = ? AND status = 'active' AND email <> ?
     ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`,
  ).bind(n.type, n.title, n.body ?? "", n.link ?? null, n.dedupeKey ?? null, iso(nowMs), memberId, TEAM_EMAIL).first<{ id: number }>();
  return r?.id ?? null;
}

export interface NotificationView { id: number; type: NotifType; title: string; body: string; link: string | null; created_at: string; read: boolean }

export async function listNotifications(d: D1Like, memberId: number, cursor: number | null, limit = 20): Promise<{ notifications: NotificationView[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const { results } = await d.prepare(
    "SELECT id, type, title, body, link, created_at, read_at FROM hub_notifications WHERE member_id = ? AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT ?",
  ).bind(memberId, cursor, cursor, lim + 1).all<NotificationView & { read_at: string | null }>();
  const rows = results.slice(0, lim);
  return {
    notifications: rows.map(r => ({ id: r.id, type: r.type, title: r.title, body: r.body, link: r.link, created_at: r.created_at, read: r.read_at != null })),
    nextCursor: results.length > lim ? rows[rows.length - 1].id : null,
  };
}

export async function unreadCount(d: D1Like, memberId: number): Promise<number> {
  const r = await d.prepare("SELECT COUNT(*) AS n FROM hub_notifications WHERE member_id = ? AND read_at IS NULL").bind(memberId).first<{ n: number }>();
  return r?.n ?? 0;
}

/** Marks the given ids (or all when null) as read. Always scoped to the member. */
export async function markRead(d: D1Like, memberId: number, ids: number[] | null, nowMs: number): Promise<void> {
  if (ids === null) {
    await d.prepare("UPDATE hub_notifications SET read_at = ? WHERE member_id = ? AND read_at IS NULL").bind(iso(nowMs), memberId).run();
    return;
  }
  if (ids.length > 50) throw new HubError("invalid", "Trop de notifications (50 max)");
  if (ids.length === 0) return;
  await d.prepare(`UPDATE hub_notifications SET read_at = ? WHERE member_id = ? AND read_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`)
    .bind(iso(nowMs), memberId, ...ids).run();
}

export async function getPrefs(d: D1Like, memberId: number): Promise<Record<NotifType, boolean>> {
  const { results } = await d.prepare("SELECT type, email FROM hub_notification_prefs WHERE member_id = ?").bind(memberId).all<{ type: NotifType; email: number }>();
  const prefs = { ...EMAIL_DEFAULTS };
  for (const r of results) if (r.type in prefs) prefs[r.type] = r.email === 1;
  return prefs;
}

export async function setPrefs(d: D1Like, memberId: number, input: Record<string, unknown>): Promise<Record<NotifType, boolean>> {
  const entries = Object.entries(input);
  for (const [k, v] of entries) {
    if (!(NOTIF_TYPES as readonly string[]).includes(k) || typeof v !== "boolean") throw new HubError("invalid", "Préférences invalides");
  }
  for (const [k, v] of entries) {
    await d.prepare("INSERT INTO hub_notification_prefs (member_id, type, email) VALUES (?,?,?) ON CONFLICT(member_id, type) DO UPDATE SET email = excluded.email")
      .bind(memberId, k, v ? 1 : 0).run();
  }
  return getPrefs(d, memberId);
}

// ---- email channel ---------------------------------------------------------------

const ELIGIBLE = "EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))";

/** Primary email when the member is active, not the team account, still eligible and the email preference for `type` is on. */
async function emailFor(d: D1Like, memberId: number, type: NotifType): Promise<string | null> {
  const r = await d.prepare(
    `SELECT m.email AS email FROM hub_members m
     WHERE m.id = ? AND m.status = 'active' AND m.email <> ? AND ${ELIGIBLE}
       AND COALESCE((SELECT p.email FROM hub_notification_prefs p WHERE p.member_id = m.id AND p.type = ?), ?) = 1`,
  ).bind(memberId, TEAM_EMAIL, type, EMAIL_DEFAULTS[type] ? 1 : 0).first<{ email: string }>();
  return r?.email ?? null;
}

function notificationEmail(baseUrl: string, n: NotifInput): Omit<BatchEmail, "to"> {
  const href = `${baseUrl}/fr${n.link ?? "/benevole/espace"}`;
  return {
    subject: n.title.slice(0, 120),
    html: `<p>Bonjour,</p><p><strong>${escapeHtml(n.title)}</strong></p>${n.body ? `<p>${escapeHtml(n.body)}</p>` : ""}<p><a href="${escapeHtml(href)}">Ouvrir l'espace bénévole</a></p><p style="font-size:12px;color:#64748b"><a href="${escapeHtml(`${baseUrl}/fr/benevole/espace/profil`)}">Gérer mes notifications</a></p>`,
  };
}

/** Records every notification, then sends ONE batch of emails for the newly recorded ones. Returns the number recorded. */
async function deliverTo(d: D1Like, mailer: Mailer, items: { memberId: number; n: NotifInput }[], nowMs: number): Promise<number> {
  let inserted = 0;
  const emails: BatchEmail[] = [];
  for (const { memberId, n } of items) {
    if ((await notify(d, memberId, n, nowMs)) === null) continue;
    inserted++;
    const to = await emailFor(d, memberId, n.type);
    if (to) emails.push({ to, ...notificationEmail(mailer.baseUrl, n) });
  }
  if (emails.length) {
    try { await mailer.sendBatch(emails); } catch (e) { console.error("[hub-notify] batch failed", e); }
  }
  return inserted;
}

// ---- emitters (titles use display names only, never emails) -----------------------

export async function onLike(d: D1Like, mailer: Mailer, actor: MemberRow, postId: number, nowMs: number): Promise<number> {
  const post = await d.prepare("SELECT member_id, body FROM hub_posts WHERE id = ?").bind(postId).first<{ member_id: number; body: string }>();
  if (!post || post.member_id === actor.id) return 0;
  return deliverTo(d, mailer, [{
    memberId: post.member_id,
    n: { type: "like", title: `${actor.display_name} a aimé votre publication`, body: excerpt(post.body, 100), link: "/benevole/espace", dedupeKey: `like:${postId}:${actor.id}` },
  }], nowMs);
}

export async function onComment(d: D1Like, mailer: Mailer, actor: MemberRow, postId: number, commentId: number, text: string, nowMs: number): Promise<number> {
  const post = await d.prepare("SELECT member_id FROM hub_posts WHERE id = ?").bind(postId).first<{ member_id: number }>();
  if (!post || post.member_id === actor.id) return 0;
  return deliverTo(d, mailer, [{
    memberId: post.member_id,
    n: { type: "comment", title: `${actor.display_name} a commenté votre publication`, body: excerpt(text, 140), link: "/benevole/espace", dedupeKey: `comment:${commentId}` },
  }], nowMs);
}

/** Fan-out to every active non-team member in one INSERT ... SELECT, then one batch for those who are eligible and opted in. */
export async function onAnnouncement(d: D1Like, mailer: Mailer, postId: number, text: string, nowMs: number): Promise<number> {
  const n: NotifInput = { type: "announcement", title: "Annonce de l'équipe", body: excerpt(text, 140), link: "/benevole/espace" };
  const { results } = await d.prepare(
    `INSERT INTO hub_notifications (member_id, type, title, body, link, dedupe_key, created_at)
     SELECT id, 'announcement', ?, ?, ?, 'announcement:' || ? || ':' || id, ? FROM hub_members WHERE status = 'active' AND email <> ?
     ON CONFLICT(dedupe_key) DO NOTHING RETURNING member_id`,
  ).bind(n.title, n.body ?? "", n.link ?? null, postId, iso(nowMs), TEAM_EMAIL).all<{ member_id: number }>();
  if (results.length === 0) return 0;
  // one bulk SELECT (no IN list: D1 allows 100 bound parameters per statement)
  const rows = await d.prepare(
    `SELECT m.email AS email FROM hub_members m
     WHERE m.status = 'active' AND m.email <> ? AND ${ELIGIBLE}
       AND COALESCE((SELECT p.email FROM hub_notification_prefs p WHERE p.member_id = m.id AND p.type = 'announcement'), 1) = 1
       AND EXISTS (SELECT 1 FROM hub_notifications x WHERE x.dedupe_key = 'announcement:' || ? || ':' || m.id AND x.created_at = ?)`,
  ).bind(TEAM_EMAIL, postId, iso(nowMs)).all<{ email: string }>();
  const msg = notificationEmail(mailer.baseUrl, n);
  if (rows.results.length) {
    try { await mailer.sendBatch(rows.results.map(r => ({ to: r.email, ...msg }))); } catch (e) { console.error("[hub-notify] batch failed", e); }
  }
  return results.length;
}

/** Admin moderation outcome for a photo the member proposed from the Hub. null when the photo was not proposed from the Hub. */
export async function galleryDecision(d: D1Like, mailer: Mailer, galleryPhotoId: string, status: "published" | "rejected", nowMs: number): Promise<number | null> {
  const p = await d.prepare("SELECT member_id FROM hub_gallery_proposals WHERE gallery_photo_id = ?").bind(galleryPhotoId).first<{ member_id: number }>();
  if (!p) return null;
  return deliverTo(d, mailer, [{
    memberId: p.member_id,
    n: {
      type: "gallery",
      title: status === "published" ? "Votre photo est publiée dans la galerie" : "Votre photo n'a pas été retenue pour la galerie",
      body: status === "published" ? "Merci pour votre partage, elle est visible par tous les visiteurs du site." : "L'équipe n'a pas pu la publier dans la galerie publique. Elle reste visible dans l'espace bénévole.",
      link: "/profil-benevole",
      dedupeKey: `gallery:${galleryPhotoId}:${status}`,
    },
  }], nowMs);
}

/** Admin confirmed a volunteer registration. null when the volunteer has no Hub member. */
export async function volunteerConfirmed(d: D1Like, mailer: Mailer, volunteerId: number, nowMs: number): Promise<number | null> {
  const v = await d.prepare(
    "SELECT lower(v.email) AS email, substr(r.date, 1, 10) AS date FROM t_volunteers v LEFT JOIN t_ramadan_days r ON r.id = v.day_id WHERE v.id = ?",
  ).bind(volunteerId).first<{ email: string | null; date: string | null }>();
  if (!v?.email) return null;
  const m = await d.prepare("SELECT id FROM hub_members WHERE email = ?").bind(v.email).first<{ id: number }>();
  if (!m) return null;
  return deliverTo(d, mailer, [{
    memberId: m.id,
    n: {
      type: "volunteer",
      title: "Inscription bénévole confirmée",
      body: `${v.date ? `Votre inscription pour le ${dmy(v.date)} est confirmée. ` : "Votre inscription est confirmée. "}Votre QR code vous a été envoyé par email.`,
      link: "/profil-benevole",
      dedupeKey: `volunteer-confirmed:${volunteerId}`,
    },
  }], nowMs);
}

/** Daily cron: reminds confirmed volunteers (who already have a Hub member) of their service on `dateStr` (YYYY-MM-DD). Returns the count recorded. */
export async function remindVolunteers(d: D1Like, mailer: Mailer, dateStr: string, nowMs: number): Promise<number> {
  const { results } = await d.prepare(
    `SELECT v.id AS vid, m.id AS member_id, r.iftar_time AS iftar
     FROM t_volunteers v
     JOIN t_ramadan_days r ON r.id = v.day_id
     JOIN hub_members m ON m.email = lower(v.email) AND m.status = 'active' AND m.email <> ?
     WHERE v.status = 'confirmed' AND substr(r.date, 1, 10) = ?`,
  ).bind(TEAM_EMAIL, dateStr).all<{ vid: number; member_id: number; iftar: string | null }>();
  return deliverTo(d, mailer, results.map(r => ({
    memberId: r.member_id,
    n: {
      type: "volunteer" as const,
      title: `Rappel : votre service bénévole du ${dmy(dateStr).slice(0, 5)}`,
      body: `${r.iftar ? `Iftar prévu à ${r.iftar}. ` : ""}Présentez votre QR code (reçu par email) à votre arrivée.`,
      link: "/profil-benevole",
      dedupeKey: `volunteer-reminder:${r.vid}`,
    },
  })), nowMs);
}
