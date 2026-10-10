/**
 * Professional network data layer on Cloudflare D1 (tables pro_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, cleanBody, iso, isOwnPath, type MemberRow } from "./hub-d1";

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
