/**
 * Professional network data layer on Cloudflare D1 (tables pro_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, cleanBody, iso, isOwnPath, type MemberRow } from "./hub-d1";
import { normalizePhone } from "./market-d1";

export const JOB_TYPES = ["cdi", "cdd", "stage", "freelance", "benevolat"] as const;
export const PRO_LIMITS = {
  postsPerHour: 10, commentsPerHour: 30, jobsPerDay: 3, messagesPerHour: 30, threadsPerHour: 20,
  post: 2000, comment: 500, link: 300, media: 4, headline: 80, company: 80, city: 60, skills: 8, skill: 30,
  jobTitle: 80, jobDescription: 3000, contact: 120, message: 1000, reason: 300, likePatternBytes: 50,
};
const DAY_MS = 24 * HOUR_MS;

/** A member whose hub account is suspended, or whose volunteer is no longer confirmed/present, vanishes. a = hub_members alias. */
export const memberOk = (a: string) =>
  `${a}.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = ${a}.email AND v.status IN ('confirmed','present'))`;
const AUTHOR_OK = memberOk("m");

export interface Person { id: number; display_name: string; avatar_key: string | null; headline?: string }

type Counted = "pro_posts" | "pro_comments" | "pro_jobs" | "pro_messages" | "pro_threads";
async function recent(d: D1Like, table: Counted, col: "member_id" | "sender_id" | "created_by", id: number, sinceMs: number): Promise<number> {
  const r = await d.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ? AND created_at > ?`).bind(id, iso(sinceMs)).first<{ n: number }>();
  return r?.n ?? 0;
}

// ---- profile ----------------------------------------------------------------

export interface ProProfile { headline: string; company: string; city: string; skills: string[]; open_to_work: boolean }
export interface ProProfileView extends ProProfile { member: Person; bio: string; mine: boolean }

function text(v: unknown, max: number, label: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new HubError("invalid", `${label} invalide`);
  const s = v.trim();
  if (s.length > max) throw new HubError("invalid", `${label} trop long (${max} caractères max)`);
  return s;
}

function cleanSkills(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || !raw.every(s => typeof s === "string")) throw new HubError("invalid", "Compétences invalides");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw.map(x => x.trim()).filter(Boolean)) {
    if (s.length > PRO_LIMITS.skill) throw new HubError("invalid", "Compétence trop longue (30 caractères max)");
    if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  if (out.length > PRO_LIMITS.skills) throw new HubError("invalid", "8 compétences maximum");
  return out;
}

function parseSkills(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch { return []; }
}

/** Full replacement (PUT semantics): omitted fields become empty. */
export async function saveProfile(d: D1Like, member: MemberRow, input: Record<string, unknown>, nowMs: number): Promise<ProProfile> {
  const p: ProProfile = {
    headline: text(input.headline, PRO_LIMITS.headline, "Titre"),
    company: text(input.company, PRO_LIMITS.company, "Entreprise"),
    city: text(input.city, PRO_LIMITS.city, "Ville"),
    skills: cleanSkills(input.skills),
    open_to_work: input.open_to_work === true,
  };
  await d.prepare(
    `INSERT INTO pro_profiles (member_id, headline, company, city, skills, open_to_work, updated_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(member_id) DO UPDATE SET headline = excluded.headline, company = excluded.company, city = excluded.city,
       skills = excluded.skills, open_to_work = excluded.open_to_work, updated_at = excluded.updated_at`,
  ).bind(member.id, p.headline, p.company, p.city, JSON.stringify(p.skills), p.open_to_work ? 1 : 0, iso(nowMs)).run();
  return p;
}

export async function getProfile(d: D1Like, viewerId: number, memberId: number): Promise<ProProfileView> {
  const r = await d.prepare(
    `SELECT m.id, m.display_name, m.avatar_key, m.bio, p.headline, p.company, p.city, p.skills, p.open_to_work
     FROM hub_members m LEFT JOIN pro_profiles p ON p.member_id = m.id WHERE m.id = ? AND ${AUTHOR_OK}`,
  ).bind(memberId).first<any>();
  if (!r) throw new HubError("not_found", "Membre introuvable");
  return {
    member: { id: r.id, display_name: r.display_name, avatar_key: r.avatar_key, headline: r.headline ?? "" },
    bio: r.bio, headline: r.headline ?? "", company: r.company ?? "", city: r.city ?? "",
    skills: parseSkills(r.skills), open_to_work: Boolean(r.open_to_work), mine: r.id === viewerId,
  };
}

// ---- feed -------------------------------------------------------------------

export interface PostView {
  id: number; body: string; link: string | null; created_at: string;
  author: Person & { headline: string };
  like_count: number; comment_count: number; liked: boolean; media: string[];
}
export interface CommentView { id: number; post_id: number; body: string; created_at: string; author: Person }

/** Only http(s) links are kept (never javascript:, data:, …); returns the normalised URL. */
export function cleanLink(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new HubError("invalid", "Lien invalide");
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new HubError("invalid", "Lien invalide"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new HubError("invalid", "Lien invalide (http ou https)");
  if (u.href.length > PRO_LIMITS.link) throw new HubError("invalid", "Lien trop long (300 caractères max)");
  return u.href;
}

export async function createPost(d: D1Like, member: MemberRow, input: { body: string; link?: unknown; mediaPaths?: string[] }, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(input.body, PRO_LIMITS.post, "Message");
  const link = cleanLink(input.link);
  const media = input.mediaPaths ?? [];
  if (media.length > PRO_LIMITS.media || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");
  if ((await recent(d, "pro_posts", "member_id", member.id, nowMs - HOUR_MS)) >= PRO_LIMITS.postsPerHour) throw new HubError("rate_limited", "Trop de publications, réessayez plus tard");
  // ponytail: post then media are two statements (not atomic); a failed media insert leaves a text-only post
  const row = await d.prepare("INSERT INTO pro_posts (member_id, body, link, created_at) VALUES (?,?,?,?) RETURNING id").bind(member.id, body, link, iso(nowMs)).first<{ id: number }>();
  if (media.length) await d.batch(media.map((p, i) => d.prepare("INSERT INTO pro_post_media (post_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

export async function feed(d: D1Like, viewerId: number, cursor: number | null = null, limit = 20): Promise<{ posts: PostView[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const { results } = await d.prepare(
    `SELECT p.id, p.body, p.link, p.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar, COALESCE(pp.headline, '') AS author_headline,
       (SELECT COUNT(*) FROM pro_likes l JOIN hub_members lm ON lm.id = l.member_id WHERE l.post_id = p.id AND ${memberOk("lm")}) AS like_count,
       (SELECT COUNT(*) FROM pro_comments c JOIN hub_members cm ON cm.id = c.member_id WHERE c.post_id = p.id AND c.status = 'visible' AND ${memberOk("cm")}) AS comment_count,
       EXISTS(SELECT 1 FROM pro_likes l WHERE l.post_id = p.id AND l.member_id = ?) AS liked
     FROM pro_posts p JOIN hub_members m ON m.id = p.member_id LEFT JOIN pro_profiles pp ON pp.member_id = m.id
     WHERE p.status = 'visible' AND ${AUTHOR_OK} AND (? IS NULL OR p.id < ?)
     ORDER BY p.id DESC LIMIT ?`,
  ).bind(viewerId, cursor, cursor, lim + 1).all<any>();
  const posts: PostView[] = results.slice(0, lim).map(r => ({
    id: r.id, body: r.body, link: r.link, created_at: r.created_at,
    author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar, headline: r.author_headline },
    like_count: r.like_count, comment_count: r.comment_count, liked: Boolean(r.liked), media: [],
  }));
  if (posts.length) {
    const ids = posts.map(p => p.id);
    const m = await d.prepare(`SELECT post_id, r2_key FROM pro_post_media WHERE post_id IN (${ids.map(() => "?").join(",")}) ORDER BY post_id, position`).bind(...ids).all<{ post_id: number; r2_key: string }>();
    for (const row of m.results) posts.find(p => p.id === row.post_id)!.media.push(row.r2_key);
  }
  return { posts, nextCursor: results.length > lim ? posts[posts.length - 1].id : null };
}

async function visiblePost(d: D1Like, postId: number): Promise<void> {
  const r = await d.prepare(`SELECT 1 AS ok FROM pro_posts p JOIN hub_members m ON m.id = p.member_id WHERE p.id = ? AND p.status = 'visible' AND ${AUTHOR_OK}`).bind(postId).first();
  if (!r) throw new HubError("not_found", "Publication introuvable");
}

export async function toggleLike(d: D1Like, memberId: number, postId: number): Promise<{ liked: boolean; count: number }> {
  await visiblePost(d, postId);
  const removed = await d.prepare("DELETE FROM pro_likes WHERE post_id = ? AND member_id = ? RETURNING 1 AS x").bind(postId, memberId).first();
  if (!removed) await d.prepare("INSERT OR IGNORE INTO pro_likes (post_id, member_id) VALUES (?,?)").bind(postId, memberId).run();
  const c = await d.prepare(`SELECT COUNT(*) AS n FROM pro_likes l JOIN hub_members lm ON lm.id = l.member_id WHERE l.post_id = ? AND ${memberOk("lm")}`).bind(postId).first<{ n: number }>();
  return { liked: !removed, count: c?.n ?? 0 };
}

export async function addComment(d: D1Like, member: MemberRow, postId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(rawBody, PRO_LIMITS.comment, "Commentaire");
  await visiblePost(d, postId);
  if ((await recent(d, "pro_comments", "member_id", member.id, nowMs - HOUR_MS)) >= PRO_LIMITS.commentsPerHour) throw new HubError("rate_limited", "Trop de commentaires, réessayez plus tard");
  const row = await d.prepare("INSERT INTO pro_comments (post_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(postId, member.id, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listComments(d: D1Like, postId: number): Promise<CommentView[]> {
  await visiblePost(d, postId);
  const { results } = await d.prepare(
    `SELECT c.id, c.post_id, c.body, c.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM pro_comments c JOIN hub_members m ON m.id = c.member_id WHERE c.post_id = ? AND c.status = 'visible' AND ${AUTHOR_OK} ORDER BY c.id ASC LIMIT 200`,
  ).bind(postId).all<any>();
  return results.map(r => ({ id: r.id, post_id: r.post_id, body: r.body, created_at: r.created_at, author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar } }));
}

/** Soft delete (status = hidden). Owner or moderator. Jobs are handled by hideJob. */
export async function removeContent(d: D1Like, actor: MemberRow, type: "post" | "comment", id: number): Promise<void> {
  const t = type === "post" ? "pro_posts" : type === "comment" ? "pro_comments" : null;
  if (!t) throw new HubError("invalid", "Type invalide");
  const row = await d.prepare(`SELECT member_id FROM ${t} WHERE id = ? AND status = 'visible'`).bind(id).first<{ member_id: number }>();
  if (!row) throw new HubError("not_found", "Contenu introuvable");
  if (row.member_id !== actor.id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

// ---- reports / admin --------------------------------------------------------

export type TargetType = "post" | "comment" | "job";
const TARGET = { post: "pro_posts", comment: "pro_comments", job: "pro_jobs" } as const;
const VISIBLE = { post: "status = 'visible'", comment: "status = 'visible'", job: "status IN ('open','closed')" } as const;
function target(type: string): TargetType {
  if (!Object.hasOwn(TARGET, type)) throw new HubError("invalid", "Type invalide");
  return type as TargetType;
}

export interface ReportView { id: number; target_type: TargetType; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }

export async function reportContent(d: D1Like, member: MemberRow, rawType: string, id: number, rawReason: string): Promise<void> {
  const type = target(rawType);
  const reason = cleanBody(rawReason, PRO_LIMITS.reason, "Motif");
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${TARGET[type]} WHERE id = ? AND ${VISIBLE[type]}`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare("INSERT OR IGNORE INTO pro_reports (target_type, target_id, member_id, reason) VALUES (?,?,?,?)").bind(type, id, member.id, reason).run();
}

export async function listReports(d: D1Like): Promise<ReportView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, m.display_name AS reporter,
       CASE r.target_type WHEN 'post' THEN (SELECT body FROM pro_posts WHERE id = r.target_id)
         WHEN 'comment' THEN (SELECT body FROM pro_comments WHERE id = r.target_id)
         ELSE (SELECT title FROM pro_jobs WHERE id = r.target_id) END AS body,
       CASE r.target_type WHEN 'post' THEN (SELECT status FROM pro_posts WHERE id = r.target_id)
         WHEN 'comment' THEN (SELECT status FROM pro_comments WHERE id = r.target_id)
         ELSE (SELECT status FROM pro_jobs WHERE id = r.target_id) END AS target_status
     FROM pro_reports r JOIN hub_members m ON m.id = r.member_id ORDER BY r.id DESC LIMIT 100`,
  ).all<ReportView>();
  return results;
}

export async function dismissReport(d: D1Like, id: number): Promise<void> {
  await d.prepare("DELETE FROM pro_reports WHERE id = ?").bind(id).run();
}

/** Admin hide (caller already authorised): no ownership check. */
export async function hideContent(d: D1Like, rawType: string, id: number): Promise<void> {
  const t = TARGET[target(rawType)];
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ?`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

// ---- jobs -------------------------------------------------------------------

export interface JobInput { title: string; company: string; city?: string; type: string; description: string; contact?: unknown }
export interface JobCard { id: number; title: string; company: string; city: string; type: string; status: "open" | "closed"; created_at: string; poster: Person }
export interface JobDetail extends JobCard { description: string; contact: string | null; updated_at: string; mine: boolean }
export interface AdminJobView { id: number; title: string; company: string; status: string; poster: string; created_at: string }

interface CleanJob { title: string; company: string; city: string; type: string; description: string; contact: string | null }
function cleanJob(i: JobInput): CleanJob {
  const title = cleanBody(i.title, PRO_LIMITS.jobTitle, "Titre");
  const company = cleanBody(i.company, PRO_LIMITS.company, "Entreprise");
  const description = cleanBody(i.description, PRO_LIMITS.jobDescription, "Description");
  if (!(JOB_TYPES as readonly string[]).includes(i.type)) throw new HubError("invalid", "Type de contrat invalide");
  const city = text(i.city, PRO_LIMITS.city, "Ville");
  const contact = normalizePhone(i.contact);
  return { title, company, city, type: i.type, description, contact };
}

export async function createJob(d: D1Like, member: MemberRow, input: JobInput, nowMs: number): Promise<{ id: number }> {
  const c = cleanJob(input);
  if ((await recent(d, "pro_jobs", "member_id", member.id, nowMs - DAY_MS)) >= PRO_LIMITS.jobsPerDay) throw new HubError("rate_limited", "Limite de 3 offres par jour atteinte");
  const row = await d.prepare(
    "INSERT INTO pro_jobs (member_id, title, company, city, type, description, contact, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id",
  ).bind(member.id, c.title, c.company, c.city, c.type, c.description, c.contact, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

async function ownedJob(d: D1Like, member: MemberRow, id: number): Promise<void> {
  const r = await d.prepare("SELECT member_id, status FROM pro_jobs WHERE id = ?").bind(id).first<{ member_id: number; status: string }>();
  if (!r || r.status === "hidden") throw new HubError("not_found", "Offre introuvable");
  if (r.member_id !== member.id) throw new HubError("forbidden", "Action non autorisée");
}

export async function updateJob(d: D1Like, member: MemberRow, id: number, input: JobInput, nowMs: number): Promise<void> {
  const c = cleanJob(input);
  await ownedJob(d, member, id);
  await d.prepare("UPDATE pro_jobs SET title=?, company=?, city=?, type=?, description=?, contact=?, updated_at=? WHERE id=?")
    .bind(c.title, c.company, c.city, c.type, c.description, c.contact, iso(nowMs), id).run();
}

export async function setJobStatus(d: D1Like, member: MemberRow, id: number, status: "open" | "closed", nowMs: number): Promise<void> {
  if (status !== "open" && status !== "closed") throw new HubError("invalid", "Statut invalide");
  await ownedJob(d, member, id);
  await d.prepare("UPDATE pro_jobs SET status = ?, updated_at = ? WHERE id = ?").bind(status, iso(nowMs), id).run();
}

/** Soft delete. With an actor: owner or moderator only. Without: admin (caller already authorised). */
export async function hideJob(d: D1Like, id: number, actor?: MemberRow): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM pro_jobs WHERE id = ? AND status <> 'hidden'").bind(id).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Offre introuvable");
  if (actor && actor.id !== r.member_id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE pro_jobs SET status = 'hidden' WHERE id = ?").bind(id).run();
}

export async function listJobs(
  d: D1Like, viewerId: number,
  o: { cursor?: number | null; type?: string; city?: string; q?: string; mine?: boolean; limit?: number } = {},
): Promise<{ jobs: JobCard[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? 20) || 20, 1), 50);
  const type = o.type || null;
  if (type !== null && !(JOB_TYPES as readonly string[]).includes(type)) throw new HubError("invalid", "Type de contrat invalide");
  const city = (o.city ?? "").trim() || null;
  if (city !== null && city.length > PRO_LIMITS.city) throw new HubError("invalid", "Ville trop longue");
  const q = (o.q ?? "").trim();
  let pattern: string | null = null;
  if (q) {
    pattern = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    if (new TextEncoder().encode(pattern).length > PRO_LIMITS.likePatternBytes) throw new HubError("invalid", "Recherche trop longue");
  }
  const cursor = o.cursor ?? null;
  const mine = o.mine ? 1 : 0;
  // public list: open jobs only; "mine" also shows the member's closed jobs
  const { results } = await d.prepare(
    `SELECT j.id, j.title, j.company, j.city, j.type, j.status, j.created_at, m.id AS poster_id, m.display_name AS poster_name, m.avatar_key AS poster_avatar
     FROM pro_jobs j JOIN hub_members m ON m.id = j.member_id
     WHERE ((? = 0 AND j.status = 'open') OR (? = 1 AND j.member_id = ? AND j.status IN ('open','closed'))) AND ${AUTHOR_OK}
       AND (? IS NULL OR j.id < ?) AND (? IS NULL OR j.type = ?) AND (? IS NULL OR lower(j.city) = lower(?))
       AND (? IS NULL OR j.title LIKE ? ESCAPE '\\' OR j.company LIKE ? ESCAPE '\\' OR j.description LIKE ? ESCAPE '\\')
     ORDER BY j.id DESC LIMIT ?`,
  ).bind(mine, mine, viewerId, cursor, cursor, type, type, city, city, pattern, pattern, pattern, pattern, lim + 1).all<any>();
  const jobs: JobCard[] = results.slice(0, lim).map(r => ({
    id: r.id, title: r.title, company: r.company, city: r.city, type: r.type, status: r.status, created_at: r.created_at,
    poster: { id: r.poster_id, display_name: r.poster_name, avatar_key: r.poster_avatar },
  }));
  return { jobs, nextCursor: results.length > lim ? jobs[jobs.length - 1].id : null };
}

export async function getJob(d: D1Like, viewerId: number, id: number): Promise<JobDetail> {
  const r = await d.prepare(
    `SELECT j.*, m.id AS poster_id, m.display_name AS poster_name, m.avatar_key AS poster_avatar, COALESCE(pp.headline, '') AS poster_headline
     FROM pro_jobs j JOIN hub_members m ON m.id = j.member_id LEFT JOIN pro_profiles pp ON pp.member_id = m.id
     WHERE j.id = ? AND j.status IN ('open','closed') AND ${AUTHOR_OK}`,
  ).bind(id).first<any>();
  if (!r) throw new HubError("not_found", "Offre introuvable");
  return {
    id: r.id, title: r.title, company: r.company, city: r.city, type: r.type, status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    description: r.description, contact: r.contact && !r.contact.includes("@") ? r.contact : null, mine: r.member_id === viewerId,
    poster: { id: r.poster_id, display_name: r.poster_name, avatar_key: r.poster_avatar, headline: r.poster_headline },
  };
}

export async function adminListJobs(d: D1Like): Promise<AdminJobView[]> {
  const { results } = await d.prepare(
    "SELECT j.id, j.title, j.company, j.status, m.display_name AS poster, j.created_at FROM pro_jobs j JOIN hub_members m ON m.id = j.member_id ORDER BY j.id DESC LIMIT 100",
  ).all<AdminJobView>();
  return results;
}

// ---- messaging --------------------------------------------------------------

export interface ThreadSummary { id: number; job_id: number; job_title: string | null; other: Person; last_body: string | null; last_message_at: string; unread: number }
export interface MessageView { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
interface ThreadRow { id: number; member_a: number; member_b: number; job_id: number }

/** Thread the member takes part in. Outsiders (admins included) get a 404: existence is not revealed. */
async function participantThread(d: D1Like, member: MemberRow, threadId: number): Promise<ThreadRow> {
  const t = await d.prepare("SELECT id, member_a, member_b, job_id FROM pro_threads WHERE id = ?").bind(threadId).first<ThreadRow>();
  if (!t || (t.member_a !== member.id && t.member_b !== member.id)) throw new HubError("not_found", "Discussion introuvable");
  return t;
}

export async function openThread(d: D1Like, me: MemberRow, input: { to: number; jobId?: number }, nowMs: number): Promise<{ id: number; created: boolean }> {
  const { to } = input;
  const jobId = input.jobId ?? 0;
  if (to === me.id) throw new HubError("invalid", "Vous ne pouvez pas vous écrire à vous-même");
  const target = await d.prepare(`SELECT m.id FROM hub_members m WHERE m.id = ? AND ${AUTHOR_OK}`).bind(to).first();
  if (!target) throw new HubError("not_found", "Membre introuvable");
  let jobStatus = "";
  if (jobId > 0) {
    const j = await d.prepare("SELECT member_id, status FROM pro_jobs WHERE id = ? AND status IN ('open','closed')").bind(jobId).first<{ member_id: number; status: string }>();
    if (!j) throw new HubError("not_found", "Offre introuvable");
    if (j.member_id !== to) throw new HubError("invalid", "Destinataire invalide pour cette offre");
    jobStatus = j.status;
  }
  const [a, b] = me.id < to ? [me.id, to] : [to, me.id];
  const existing = await d.prepare("SELECT id FROM pro_threads WHERE member_a = ? AND member_b = ? AND job_id = ?").bind(a, b, jobId).first<{ id: number }>();
  if (existing) return { id: existing.id, created: false };
  if (jobStatus === "closed") throw new HubError("invalid", "Cette offre est fermée");
  if ((await recent(d, "pro_threads", "created_by", me.id, nowMs - HOUR_MS)) >= PRO_LIMITS.threadsPerHour) throw new HubError("rate_limited", "Trop de nouvelles discussions, réessayez plus tard");
  const row = await d.prepare(
    `INSERT INTO pro_threads (member_a, member_b, job_id, created_by, created_at, last_message_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(member_a, member_b, job_id) DO UPDATE SET job_id = excluded.job_id RETURNING id`,
  ).bind(a, b, jobId, me.id, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id, created: true };
}

export async function sendMessage(d: D1Like, me: MemberRow, threadId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const t = await participantThread(d, me, threadId);
  const body = cleanBody(rawBody, PRO_LIMITS.message, "Message");
  const otherId = t.member_a === me.id ? t.member_b : t.member_a;
  if (!(await d.prepare(`SELECT 1 AS ok FROM hub_members m WHERE m.id = ? AND ${AUTHOR_OK}`).bind(otherId).first())) throw new HubError("forbidden", "Ce membre n'est plus joignable");
  if ((await recent(d, "pro_messages", "sender_id", me.id, nowMs - HOUR_MS)) >= PRO_LIMITS.messagesPerHour) throw new HubError("rate_limited", "Trop de messages, réessayez plus tard");
  const row = await d.prepare("INSERT INTO pro_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(t.id, me.id, body, iso(nowMs)).first<{ id: number }>();
  await d.prepare("UPDATE pro_threads SET last_message_at = ? WHERE id = ?").bind(iso(nowMs), t.id).run();
  return { id: row!.id };
}

export async function listThreads(d: D1Like, memberId: number): Promise<ThreadSummary[]> {
  const { results } = await d.prepare(
    `SELECT t.id, t.job_id, t.last_message_at,
       CASE WHEN j.status = 'hidden' THEN NULL ELSE j.title END AS job_title,
       o.id AS other_id, o.display_name AS other_name, o.avatar_key AS other_avatar,
       (SELECT body FROM pro_messages WHERE thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_body,
       (SELECT COUNT(*) FROM pro_messages WHERE thread_id = t.id AND sender_id <> ? AND read_at IS NULL) AS unread
     FROM pro_threads t
     JOIN hub_members o ON o.id = CASE WHEN t.member_a = ? THEN t.member_b ELSE t.member_a END
     LEFT JOIN pro_jobs j ON j.id = t.job_id
     WHERE (t.member_a = ? OR t.member_b = ?) AND ${memberOk("o")}
       AND (t.created_by = ? OR EXISTS (SELECT 1 FROM pro_messages WHERE thread_id = t.id))
     ORDER BY t.last_message_at DESC, t.id DESC LIMIT 100`,
  ).bind(memberId, memberId, memberId, memberId, memberId).all<any>();
  return results.map(r => ({
    id: r.id, job_id: r.job_id, job_title: r.job_title ?? null,
    other: { id: r.other_id, display_name: r.other_name, avatar_key: r.other_avatar },
    last_body: r.last_body, last_message_at: r.last_message_at, unread: r.unread,
  }));
}

export async function listMessages(d: D1Like, me: MemberRow, threadId: number, before: number | null = null) {
  const t = await participantThread(d, me, threadId);
  const { results } = await d.prepare(
    "SELECT id, sender_id, body, created_at, read_at FROM pro_messages WHERE thread_id = ? AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT 51",
  ).bind(threadId, before, before).all<MessageView>();
  const page = results.slice(0, 50).reverse();
  const otherId = t.member_a === me.id ? t.member_b : t.member_a;
  const o = await d.prepare(`SELECT o.id, o.display_name, o.avatar_key FROM hub_members o WHERE o.id = ? AND ${memberOk("o")}`).bind(otherId).first<Person>();
  if (!o) throw new HubError("not_found", "Conversation introuvable");
  const j = t.job_id > 0
    ? await d.prepare("SELECT id, title FROM pro_jobs WHERE id = ? AND status <> 'hidden'").bind(t.job_id).first<{ id: number; title: string }>()
    : null;
  return { messages: page, nextCursor: results.length > 50 ? page[0].id : null, other: o, job: j ?? null };
}

export async function markThreadRead(d: D1Like, me: MemberRow, threadId: number, nowMs: number): Promise<void> {
  await participantThread(d, me, threadId);
  await d.prepare("UPDATE pro_messages SET read_at = ? WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL").bind(iso(nowMs), threadId, me.id).run();
}

export async function unreadTotal(d: D1Like, memberId: number): Promise<number> {
  const r = await d.prepare(
    `SELECT COUNT(*) AS n FROM pro_messages x JOIN pro_threads t ON t.id = x.thread_id
     JOIN hub_members o ON o.id = CASE WHEN t.member_a = ? THEN t.member_b ELSE t.member_a END
     WHERE (t.member_a = ? OR t.member_b = ?) AND x.sender_id <> ? AND x.read_at IS NULL AND ${memberOk("o")}`,
  ).bind(memberId, memberId, memberId, memberId).first<{ n: number }>();
  return r?.n ?? 0;
}
