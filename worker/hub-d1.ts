/**
 * Volunteer hub data layer on Cloudflare D1 (tables hub_*). No HTTP / Supabase imports: testable with a fake D1.
 * Time is always passed in (nowMs): the Worker freezes Date at module load.
 */
import type { D1Like } from "./gallery-d1";

export type HubErrorCode = "unauthorized" | "forbidden" | "not_found" | "invalid" | "rate_limited";
export class HubError extends Error {
  constructor(public code: HubErrorCode, message: string) { super(message); }
}

export const LOGIN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const LIMITS = { postsPerHour: 10, commentsPerHour: 30, uploadsPerHour: 20, loginsPerHour: 3, post: 2000, comment: 500, media: 4, reason: 300, name: 40, bio: 300 };
export const TEAM_EMAIL = "equipe@hub.ftourbabrayan.ma"; // never a volunteer email: cannot log in

export interface MemberRow { id: number; email: string; display_name: string; avatar_key: string | null; bio: string; role: "member" | "moderator"; status: "active" | "suspended"; created_at: string }
export type MemberView = Omit<MemberRow, "email" | "status" | "created_at">;

export const iso = (ms: number) => new Date(ms).toISOString();
const normEmail = (e: string) => e.trim().toLowerCase();

export async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function memberView(m: MemberRow): MemberView {
  return { id: m.id, display_name: m.display_name, avatar_key: m.avatar_key, bio: m.bio, role: m.role };
}

export async function isEligible(d: D1Like, email: string): Promise<boolean> {
  const r = await d.prepare("SELECT 1 AS ok FROM t_volunteers WHERE lower(email) = ? AND status IN ('confirmed','present') LIMIT 1").bind(normEmail(email)).first();
  return r != null;
}

export async function canRequestLogin(d: D1Like, email: string, nowMs: number): Promise<boolean> {
  const r = await d.prepare("SELECT COUNT(*) AS n FROM hub_login_tokens WHERE email = ? AND created_at > ?").bind(normEmail(email), iso(nowMs - HOUR_MS)).first<{ n: number }>();
  return (r?.n ?? 0) < LIMITS.loginsPerHour;
}

export async function createLoginToken(d: D1Like, email: string, nowMs: number): Promise<string> {
  const raw = randomToken();
  await d.prepare("DELETE FROM hub_login_tokens WHERE expires_at < ?").bind(iso(nowMs - HOUR_MS)).run();
  await d.prepare("INSERT INTO hub_login_tokens (token_hash, email, created_at, expires_at) VALUES (?,?,?,?)")
    .bind(await sha256Hex(raw), normEmail(email), iso(nowMs), iso(nowMs + LOGIN_TTL_MS)).run();
  return raw;
}

async function upsertMember(d: D1Like, email: string): Promise<MemberRow> {
  const e = normEmail(email);
  const existing = await d.prepare("SELECT * FROM hub_members WHERE email = ?").bind(e).first<MemberRow>();
  if (existing) return existing;
  const v = await d.prepare("SELECT first_name, last_name FROM t_volunteers WHERE lower(email) = ? ORDER BY id LIMIT 1").bind(e).first<{ first_name: string; last_name: string }>();
  const name = v ? `${v.first_name} ${String(v.last_name ?? "").charAt(0)}.`.trim() : e.split("@")[0];
  const row = await d.prepare("INSERT INTO hub_members (email, display_name) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET email = excluded.email RETURNING *")
    .bind(e, name.slice(0, LIMITS.name)).first<MemberRow>();
  return row!;
}

export async function openSession(d: D1Like, loginToken: string, nowMs: number): Promise<{ session: string; member: MemberView }> {
  const used = await d.prepare("UPDATE hub_login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email")
    .bind(iso(nowMs), await sha256Hex(loginToken), iso(nowMs)).first<{ email: string }>();
  if (!used) throw new HubError("unauthorized", "Lien invalide ou expiré");
  if (!(await isEligible(d, used.email))) throw new HubError("forbidden", "Accès réservé aux bénévoles confirmés");
  const member = await upsertMember(d, used.email);
  if (member.status !== "active") throw new HubError("forbidden", "Compte suspendu");
  const session = randomToken();
  await d.prepare("INSERT INTO hub_sessions (token_hash, member_id, expires_at) VALUES (?,?,?)")
    .bind(await sha256Hex(session), member.id, iso(nowMs + SESSION_TTL_MS)).run();
  return { session, member: memberView(member) };
}

export async function getSession(d: D1Like, sessionToken: string, nowMs: number): Promise<MemberRow | null> {
  if (!sessionToken) return null;
  return d.prepare(
    "SELECT m.* FROM hub_sessions s JOIN hub_members m ON m.id = s.member_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND m.status = 'active'",
  ).bind(await sha256Hex(sessionToken), iso(nowMs)).first<MemberRow>();
}

export async function revokeSession(d: D1Like, sessionToken: string, nowMs: number): Promise<void> {
  await d.prepare("UPDATE hub_sessions SET revoked_at = ? WHERE token_hash = ?").bind(iso(nowMs), await sha256Hex(sessionToken)).run();
}

export async function updateProfile(d: D1Like, member: MemberRow, input: { display_name?: string; bio?: string; avatar_key?: string | null }): Promise<MemberView> {
  const name = input.display_name === undefined ? member.display_name : input.display_name.trim();
  const bio = input.bio === undefined ? member.bio : input.bio.trim();
  const avatar = input.avatar_key === undefined ? member.avatar_key : input.avatar_key;
  if (name.length < 1 || name.length > LIMITS.name) throw new HubError("invalid", "Nom invalide (1 à 40 caractères)");
  if (bio.length > LIMITS.bio) throw new HubError("invalid", "Bio trop longue (300 caractères max)");
  if (avatar != null && !isOwnPath(member.id, avatar)) throw new HubError("invalid", "Photo invalide");
  const row = await d.prepare("UPDATE hub_members SET display_name = ?, bio = ?, avatar_key = ? WHERE id = ? RETURNING *")
    .bind(name, bio, avatar, member.id).first<MemberRow>();
  return memberView(row!);
}

/** A bucket-relative media path must be "<memberId>/<file>" with no traversal. */
export function isOwnPath(memberId: number, path: string): boolean {
  return typeof path === "string" && !path.includes("..") && /^\d+\/[\w.\-]+$/.test(path) && path.startsWith(`${memberId}/`);
}

// ---- posts / feed / likes / comments -------------------------------------

export interface PostView {
  id: number; body: string; kind: "post" | "announcement"; pinned: boolean; created_at: string;
  author: { id: number; display_name: string; avatar_key: string | null };
  like_count: number; comment_count: number; liked: boolean; media: string[];
}
export interface CommentView { id: number; post_id: number; body: string; created_at: string; author: { id: number; display_name: string; avatar_key: string | null } }

async function countSince(d: D1Like, table: "hub_posts" | "hub_comments" | "hub_uploads", memberId: number, nowMs: number): Promise<number> {
  const r = await d.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE member_id = ? AND created_at > ?`).bind(memberId, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  return r?.n ?? 0;
}

function cleanBody(raw: unknown, max: number, label: string): string {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length < 1 || body.length > max) throw new HubError("invalid", `${label} invalide (1 à ${max} caractères)`);
  return body;
}

export async function recordUpload(d: D1Like, memberId: number, nowMs: number): Promise<void> {
  if ((await countSince(d, "hub_uploads", memberId, nowMs)) >= LIMITS.uploadsPerHour) throw new HubError("rate_limited", "Trop de photos envoyées, réessayez plus tard");
  await d.prepare("INSERT INTO hub_uploads (member_id, created_at) VALUES (?,?)").bind(memberId, iso(nowMs)).run();
}

export async function createPost(d: D1Like, member: MemberRow, input: { body: string; mediaPaths?: string[] }, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(input.body, LIMITS.post, "Message");
  const media = input.mediaPaths ?? [];
  if (media.length > LIMITS.media || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");
  if ((await countSince(d, "hub_posts", member.id, nowMs)) >= LIMITS.postsPerHour) throw new HubError("rate_limited", "Trop de publications, réessayez plus tard");
  // ponytail: post then media are two statements (not atomic); a failed media insert leaves a text-only post
  const row = await d.prepare("INSERT INTO hub_posts (member_id, body, created_at) VALUES (?,?,?) RETURNING id").bind(member.id, body, iso(nowMs)).first<{ id: number }>();
  if (media.length) await d.batch(media.map((p, i) => d.prepare("INSERT INTO hub_post_media (post_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

async function loadPosts(d: D1Like, viewerId: number, pinned: 0 | 1, cursor: number | null, limit: number): Promise<PostView[]> {
  const { results } = await d.prepare(
    `SELECT p.id, p.body, p.kind, p.pinned, p.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar,
       (SELECT COUNT(*) FROM hub_likes l WHERE l.post_id = p.id) AS like_count,
       (SELECT COUNT(*) FROM hub_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count,
       EXISTS(SELECT 1 FROM hub_likes l WHERE l.post_id = p.id AND l.member_id = ?) AS liked
     FROM hub_posts p JOIN hub_members m ON m.id = p.member_id
     WHERE p.status = 'visible' AND p.pinned = ? AND (? IS NULL OR p.id < ?)
     ORDER BY p.id DESC LIMIT ?`,
  ).bind(viewerId, pinned, cursor, cursor, limit).all<any>();
  const posts: PostView[] = results.map(r => ({
    id: r.id, body: r.body, kind: r.kind, pinned: Boolean(r.pinned), created_at: r.created_at,
    author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar },
    like_count: r.like_count, comment_count: r.comment_count, liked: Boolean(r.liked), media: [],
  }));
  if (posts.length) {
    const ids = posts.map(p => p.id);
    const m = await d.prepare(`SELECT post_id, r2_key FROM hub_post_media WHERE post_id IN (${ids.map(() => "?").join(",")}) ORDER BY post_id, position`).bind(...ids).all<{ post_id: number; r2_key: string }>();
    for (const row of m.results) posts.find(p => p.id === row.post_id)!.media.push(row.r2_key);
  }
  return posts;
}

export async function feed(d: D1Like, viewerId: number, cursor: number | null = null, limit = 20) {
  const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const pinned = cursor == null ? await loadPosts(d, viewerId, 1, null, 5) : [];
  const rows = await loadPosts(d, viewerId, 0, cursor, lim + 1);
  const posts = rows.slice(0, lim);
  return { pinned, posts, nextCursor: rows.length > lim ? posts[posts.length - 1].id : null };
}

async function visiblePost(d: D1Like, postId: number): Promise<void> {
  if (!(await d.prepare("SELECT 1 AS ok FROM hub_posts WHERE id = ? AND status = 'visible'").bind(postId).first())) throw new HubError("not_found", "Publication introuvable");
}

export async function toggleLike(d: D1Like, memberId: number, postId: number): Promise<{ liked: boolean; count: number }> {
  await visiblePost(d, postId);
  const removed = await d.prepare("DELETE FROM hub_likes WHERE post_id = ? AND member_id = ? RETURNING 1 AS x").bind(postId, memberId).first();
  if (!removed) await d.prepare("INSERT OR IGNORE INTO hub_likes (post_id, member_id) VALUES (?,?)").bind(postId, memberId).run();
  const c = await d.prepare("SELECT COUNT(*) AS n FROM hub_likes WHERE post_id = ?").bind(postId).first<{ n: number }>();
  return { liked: !removed, count: c?.n ?? 0 };
}

export async function addComment(d: D1Like, member: MemberRow, postId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(rawBody, LIMITS.comment, "Commentaire");
  await visiblePost(d, postId);
  if ((await countSince(d, "hub_comments", member.id, nowMs)) >= LIMITS.commentsPerHour) throw new HubError("rate_limited", "Trop de commentaires, réessayez plus tard");
  const row = await d.prepare("INSERT INTO hub_comments (post_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(postId, member.id, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listComments(d: D1Like, postId: number): Promise<CommentView[]> {
  const { results } = await d.prepare(
    `SELECT c.id, c.post_id, c.body, c.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM hub_comments c JOIN hub_members m ON m.id = c.member_id WHERE c.post_id = ? AND c.status = 'visible' ORDER BY c.id ASC LIMIT 200`,
  ).bind(postId).all<any>();
  return results.map(r => ({ id: r.id, post_id: r.post_id, body: r.body, created_at: r.created_at, author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar } }));
}

const TABLE = { post: "hub_posts", comment: "hub_comments" } as const;

/** Soft delete (status = hidden). Owner or moderator. Admin hides go through hideContent (Task 3). */
export async function removeContent(d: D1Like, actor: MemberRow, type: "post" | "comment", id: number): Promise<void> {
  const t = TABLE[type];
  if (!t) throw new HubError("invalid", "Type invalide");
  const row = await d.prepare(`SELECT member_id FROM ${t} WHERE id = ? AND status = 'visible'`).bind(id).first<{ member_id: number }>();
  if (!row) throw new HubError("not_found", "Contenu introuvable");
  if (row.member_id !== actor.id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}
