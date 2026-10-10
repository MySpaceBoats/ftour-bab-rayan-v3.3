/**
 * Volunteer meetups (sorties, événements, rencontres) — data layer on Cloudflare D1 (tables mt_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import { z } from "zod";
import type { D1Like } from "./gallery-d1";
import { HubError, iso, isOwnPath, HOUR_MS, type MemberRow } from "./hub-d1";
import { HOST_OK, isIsoDate, nightsBetween } from "./stay-d1";

export const MT_CATEGORIES = ["sortie", "evenement", "rencontre", "autre"] as const;
export const MT_LIMITS = {
  meetupsPerDay: 5, joinsPerHour: 30,
  title: 80, description: 2000, country: 60, city: 60, place: 120, capacityMax: 500,
  maxSpanDays: 30, pageSize: 20, participantsShown: 100,
};
const DAY_MS = 24 * HOUR_MS;
const WALL_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const CURSOR_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})_(\d+)$/;

export type MeetupCategory = (typeof MT_CATEGORIES)[number];
export type MeetupStatus = "active" | "cancelled" | "hidden";
export type ParticipantStatus = "going" | "waitlist";

export interface MeetupOrganizer { id: number; display_name: string; avatar_key: string | null }
export interface MeetupCard {
  id: number; title: string; category: MeetupCategory; country: string; city: string; place: string;
  starts_at: string; ends_at: string; capacity: number; going_count: number; waitlist_count: number;
  status: MeetupStatus; ended: boolean; my_status: ParticipantStatus | null; photo_key: string | null;
  organizer: MeetupOrganizer;
}

// ---- time -----------------------------------------------------------------

/**
 * Casablanca wall clock as YYYY-MM-DDTHH:MM.
 * ponytail: one clock for every country keeps comparisons lexicographic; a few hours of skew for meetups abroad is accepted.
 */
export function nowMinuteCasablanca(nowMs: number): string {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(nowMs));
  return s.replace(/\s+/, "T");
}

// ---- input validation -----------------------------------------------------

const text = (label: string, max: number, collapse = false) =>
  z.string({ required_error: `${label} requis`, invalid_type_error: `${label} invalide` })
    .transform(s => (collapse ? s.trim().replace(/\s+/g, " ") : s.trim()))
    .pipe(z.string().min(1, `${label} requis`).max(max, `${label} trop long (${max} caractères max)`));

const wall = (label: string) =>
  z.string({ required_error: `${label} requise`, invalid_type_error: `${label} invalide` })
    .regex(WALL_RE, `${label} invalide (format AAAA-MM-JJTHH:MM)`)
    .refine(s => isIsoDate(s.slice(0, 10)), `${label} invalide (date inexistante)`);

export const meetupInputSchema = z.object({
  title: text("Titre", MT_LIMITS.title),
  category: z.enum(MT_CATEGORIES, { errorMap: () => ({ message: "Catégorie invalide" }) }),
  description: text("Description", MT_LIMITS.description),
  country: text("Pays", MT_LIMITS.country, true),
  city: text("Ville", MT_LIMITS.city, true),
  place: text("Lieu", MT_LIMITS.place),
  startsAt: wall("Date de début"),
  endsAt: wall("Date de fin"),
  capacity: z.number({ required_error: "Capacité requise", invalid_type_error: "Capacité invalide" })
    .int("Capacité invalide (nombre entier)")
    .min(1, `Capacité invalide (1 à ${MT_LIMITS.capacityMax})`)
    .max(MT_LIMITS.capacityMax, `Capacité invalide (1 à ${MT_LIMITS.capacityMax})`),
  photo: z.string({ invalid_type_error: "Photo invalide" }).nullable().optional(),
}).superRefine((v, ctx) => {
  if (!WALL_RE.test(v.startsAt) || !WALL_RE.test(v.endsAt) || !isIsoDate(v.startsAt.slice(0, 10)) || !isIsoDate(v.endsAt.slice(0, 10))) return;
  if (v.endsAt <= v.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "La fin doit suivre le début" });
    return;
  }
  if (nightsBetween(v.startsAt.slice(0, 10), v.endsAt.slice(0, 10)) > MT_LIMITS.maxSpanDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: `Durée trop longue (${MT_LIMITS.maxSpanDays} jours max)` });
  }
});
export type MeetupInput = z.infer<typeof meetupInputSchema>;

export function parseMeetupInput(raw: unknown): MeetupInput {
  const r = meetupInputSchema.safeParse(raw);
  if (!r.success) throw new HubError("invalid", r.error.issues[0]?.message ?? "Données invalides");
  return r.data;
}

function checkPhoto(member: MemberRow, photo: string | null | undefined): string | null {
  if (photo == null || photo === "") return null;
  if (!isOwnPath(member.id, photo)) throw new HubError("invalid", "Photo invalide");
  return photo;
}

// ---- create / list --------------------------------------------------------

export async function createMeetup(d: D1Like, member: MemberRow, raw: unknown, nowMs: number): Promise<{ id: number }> {
  const c = parseMeetupInput(raw);
  if (c.startsAt < nowMinuteCasablanca(nowMs)) throw new HubError("invalid", "Le début est déjà passé");
  const photo = checkPhoto(member, c.photo);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mt_meetups WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - DAY_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MT_LIMITS.meetupsPerDay) throw new HubError("rate_limited", `Limite de ${MT_LIMITS.meetupsPerDay} meetups par jour atteinte`);
  const row = await d.prepare(
    `INSERT INTO mt_meetups (member_id, title, category, description, country, city, place, starts_at, ends_at, capacity, photo_key, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  ).bind(member.id, c.title, c.category, c.description, c.country, c.city, c.place, c.startsAt, c.endsAt, c.capacity, photo, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

/** Alias: mt = mt_meetups, m = organizer (hub_members, as HOST_OK expects). */
const CARD_SELECT = `SELECT mt.id, mt.title, mt.category, mt.country, mt.city, mt.place, mt.starts_at, mt.ends_at, mt.capacity, mt.status, mt.photo_key,
    (SELECT COUNT(*) FROM mt_participants p WHERE p.meetup_id = mt.id AND p.status = 'going') AS going_count,
    (SELECT COUNT(*) FROM mt_participants p WHERE p.meetup_id = mt.id AND p.status = 'waitlist') AS waitlist_count,
    (SELECT p.status FROM mt_participants p WHERE p.meetup_id = mt.id AND p.member_id = ?) AS my_status,
    m.id AS org_id, m.display_name AS org_name, m.avatar_key AS org_avatar
  FROM mt_meetups mt JOIN hub_members m ON m.id = mt.member_id`;

function toCard(r: any, nowMin: string): MeetupCard {
  return {
    id: r.id, title: r.title, category: r.category, country: r.country, city: r.city, place: r.place,
    starts_at: r.starts_at, ends_at: r.ends_at, capacity: r.capacity,
    going_count: r.going_count ?? 0, waitlist_count: r.waitlist_count ?? 0,
    status: r.status, ended: r.ends_at < nowMin, my_status: r.my_status ?? null, photo_key: r.photo_key ?? null,
    organizer: { id: r.org_id, display_name: r.org_name, avatar_key: r.org_avatar },
  };
}

export interface MeetupSearch { cursor?: string | null; limit?: number }

/** Upcoming (not yet ended) active meetups, soonest first, keyset-paginated on (starts_at, id). */
export async function listMeetups(d: D1Like, viewerId: number, o: MeetupSearch, nowMs: number): Promise<{ meetups: MeetupCard[]; nextCursor: string | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? MT_LIMITS.pageSize) || MT_LIMITS.pageSize, 1), 50);
  const nowMin = nowMinuteCasablanca(nowMs);
  const where: string[] = [HOST_OK, "mt.status = 'active'", "mt.ends_at >= ?"];
  const args: unknown[] = [nowMin];
  if (o.cursor) {
    const c = CURSOR_RE.exec(o.cursor);
    if (!c) throw new HubError("invalid", "Curseur invalide");
    where.push("(mt.starts_at > ? OR (mt.starts_at = ? AND mt.id > ?))");
    args.push(c[1], c[1], Number(c[2]));
  }
  const { results } = await d.prepare(`${CARD_SELECT} WHERE ${where.join(" AND ")} ORDER BY mt.starts_at ASC, mt.id ASC LIMIT ?`)
    .bind(viewerId, ...args, lim + 1).all<any>();
  const page = results.slice(0, lim).map(r => toCard(r, nowMin));
  const last = page[page.length - 1];
  return { meetups: page, nextCursor: results.length > lim && last ? `${last.starts_at}_${last.id}` : null };
}
