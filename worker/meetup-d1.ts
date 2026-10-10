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


// ---- cards / list ---------------------------------------------------------

/** Alias: mt = mt_meetups, m = organizer (hub_members, as HOST_OK expects). */
const cardSelect = (extra = "") => `SELECT mt.id, mt.title, mt.category, mt.country, mt.city, mt.place, mt.starts_at, mt.ends_at, mt.capacity, mt.status, mt.photo_key${extra},
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

export interface MeetupSearch { cursor?: string | null; country?: string; city?: string; category?: string; from?: string | null; to?: string | null; limit?: number }

function optionalDate(raw: string | null | undefined, label: string): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (!isIsoDate(raw)) throw new HubError("invalid", `${label} invalide (format AAAA-MM-JJ)`);
  return raw;
}

/** Upcoming (not yet ended) active meetups, soonest first, keyset-paginated on (starts_at, id). */
export async function listMeetups(d: D1Like, viewerId: number, o: MeetupSearch, nowMs: number): Promise<{ meetups: MeetupCard[]; nextCursor: string | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? MT_LIMITS.pageSize) || MT_LIMITS.pageSize, 1), 50);
  const nowMin = nowMinuteCasablanca(nowMs);
  if (o.category && !(MT_CATEGORIES as readonly string[]).includes(o.category)) throw new HubError("invalid", "Catégorie invalide");
  const from = optionalDate(o.from, "Date de début");
  const to = optionalDate(o.to, "Date de fin");
  if (from && to && to < from) throw new HubError("invalid", "La date de fin doit suivre la date de début");
  const where: string[] = [HOST_OK, "mt.status = 'active'", "mt.ends_at >= ?"];
  const args: unknown[] = [from ? `${from}T00:00` : nowMin];
  if (to) { where.push("substr(mt.starts_at, 1, 10) <= ?"); args.push(to); }
  if (o.country?.trim()) { where.push("lower(mt.country) = lower(?)"); args.push(o.country.trim()); }
  if (o.city?.trim()) { where.push("lower(mt.city) = lower(?)"); args.push(o.city.trim()); }
  if (o.category) { where.push("mt.category = ?"); args.push(o.category); }
  if (o.cursor) {
    const c = CURSOR_RE.exec(o.cursor);
    if (!c) throw new HubError("invalid", "Curseur invalide");
    where.push("(mt.starts_at > ? OR (mt.starts_at = ? AND mt.id > ?))");
    args.push(c[1], c[1], Number(c[2]));
  }
  const { results } = await d.prepare(`${cardSelect()} WHERE ${where.join(" AND ")} ORDER BY mt.starts_at ASC, mt.id ASC LIMIT ?`)
    .bind(viewerId, ...args, lim + 1).all<any>();
  const page = results.slice(0, lim).map(r => toCard(r, nowMin));
  const last = page[page.length - 1];
  return { meetups: page, nextCursor: results.length > lim && last ? `${last.starts_at}_${last.id}` : null };
}

// SQLite lower() folds ASCII only: group places the same way so a dropdown value always matches its own filter.
const asciiLower = (s: string) => s.replace(/[A-Z]/g, c => c.toLowerCase());

/** Countries (each with its cities) that really have an upcoming meetup, for the filter dropdowns. */
export async function listMeetupPlaces(d: D1Like, nowMs: number): Promise<{ countries: { country: string; cities: string[] }[] }> {
  const { results } = await d.prepare(
    `SELECT DISTINCT mt.country, mt.city FROM mt_meetups mt JOIN hub_members m ON m.id = mt.member_id
     WHERE ${HOST_OK} AND mt.status = 'active' AND mt.ends_at >= ? ORDER BY mt.id ASC LIMIT 2000`,
  ).bind(nowMinuteCasablanca(nowMs)).all<{ country: string; city: string }>();
  const byCountry = new Map<string, { country: string; cities: Map<string, string> }>();
  for (const r of results) {
    const ck = asciiLower(r.country);
    const entry = byCountry.get(ck) ?? { country: r.country, cities: new Map<string, string>() };
    if (!entry.cities.has(asciiLower(r.city))) entry.cities.set(asciiLower(r.city), r.city);
    byCountry.set(ck, entry);
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "fr");
  return {
    countries: [...byCountry.values()]
      .map(e => ({ country: e.country, cities: [...e.cities.values()].sort(sort) }))
      .sort((a, b) => sort(a.country, b.country)),
  };
}

// ---- detail ---------------------------------------------------------------

export interface MeetupDetail extends MeetupCard {
  description: string; spots_left: number; mine: boolean;
  participants: MeetupOrganizer[]; waitlist: MeetupOrganizer[];
}

async function listParticipants(d: D1Like, meetupId: number, status: ParticipantStatus): Promise<MeetupOrganizer[]> {
  const { results } = await d.prepare(
    `SELECT m.id, m.display_name, m.avatar_key FROM mt_participants p JOIN hub_members m ON m.id = p.member_id
     WHERE p.meetup_id = ? AND p.status = ? AND m.status = 'active' ORDER BY p.id ASC LIMIT ?`,
  ).bind(meetupId, status, MT_LIMITS.participantsShown).all<MeetupOrganizer>();
  return results.map(r => ({ id: r.id, display_name: r.display_name, avatar_key: r.avatar_key }));
}

/** Active or cancelled meetups are readable; hidden ones and those of suspended organizers are not. Never selects an email. */
export async function getMeetup(d: D1Like, viewerId: number, id: number, nowMs: number): Promise<MeetupDetail> {
  const r = await d.prepare(`${cardSelect(", mt.description, mt.member_id")} WHERE mt.id = ? AND mt.status IN ('active','cancelled') AND ${HOST_OK}`)
    .bind(viewerId, id).first<any>();
  if (!r) throw new HubError("not_found", "Meetup introuvable");
  const mine = r.member_id === viewerId;
  const card = toCard(r, nowMinuteCasablanca(nowMs));
  return {
    ...card, description: r.description, mine,
    spots_left: Math.max(0, card.capacity - card.going_count),
    participants: await listParticipants(d, id, "going"),
    waitlist: mine ? await listParticipants(d, id, "waitlist") : [],
  };
}

// ---- update / cancel ------------------------------------------------------

/** Promote the oldest waiting members into every free seat of a meetup (bind: meetupId x3). Shared by update and leave. */
const FILL_SEATS_SQL = `UPDATE mt_participants SET status = 'going' WHERE id IN (
  SELECT id FROM mt_participants WHERE meetup_id = ? AND status = 'waitlist' ORDER BY id ASC
  LIMIT max(0, (SELECT capacity FROM mt_meetups WHERE id = ?) - (SELECT COUNT(*) FROM mt_participants WHERE meetup_id = ? AND status = 'going')))`;
const fillSeats = (d: D1Like, meetupId: number) => d.prepare(FILL_SEATS_SQL).bind(meetupId, meetupId, meetupId);

async function ownedMeetup(d: D1Like, member: MemberRow, id: number): Promise<{ status: MeetupStatus; starts_at: string }> {
  const r = await d.prepare("SELECT member_id, status, starts_at FROM mt_meetups WHERE id = ?").bind(id).first<{ member_id: number; status: MeetupStatus; starts_at: string }>();
  if (!r || r.status === "hidden") throw new HubError("not_found", "Meetup introuvable");
  if (r.member_id !== member.id) throw new HubError("forbidden", "Action non autorisée");
  return r;
}

export async function updateMeetup(d: D1Like, member: MemberRow, id: number, raw: unknown, nowMs: number): Promise<void> {
  const cur = await ownedMeetup(d, member, id);
  if (cur.status !== "active") throw new HubError("invalid", "Ce meetup n'est plus modifiable");
  const c = parseMeetupInput(raw);
  if (c.startsAt !== cur.starts_at && c.startsAt < nowMinuteCasablanca(nowMs)) throw new HubError("invalid", "Le début est déjà passé");
  const photo = checkPhoto(member, c.photo);
  const going = await d.prepare("SELECT COUNT(*) AS n FROM mt_participants WHERE meetup_id = ? AND status = 'going'").bind(id).first<{ n: number }>();
  if (c.capacity < (going?.n ?? 0)) throw new HubError("invalid", `Capacité inférieure au nombre d'inscrits (${going?.n})`);
  await d.batch([
    d.prepare(
      `UPDATE mt_meetups SET title=?, category=?, description=?, country=?, city=?, place=?, starts_at=?, ends_at=?, capacity=?, photo_key=?, updated_at=? WHERE id=?`,
    ).bind(c.title, c.category, c.description, c.country, c.city, c.place, c.startsAt, c.endsAt, c.capacity, photo, iso(nowMs), id),
    fillSeats(d, id),
  ]);
}

export async function cancelMeetup(d: D1Like, member: MemberRow, id: number, nowMs: number): Promise<void> {
  const cur = await ownedMeetup(d, member, id);
  if (cur.status !== "active") throw new HubError("invalid", "Ce meetup est déjà annulé");
  await d.prepare("UPDATE mt_meetups SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?").bind(iso(nowMs), iso(nowMs), id).run();
}

// ---- join / leave ---------------------------------------------------------

export async function joinMeetup(d: D1Like, member: MemberRow, id: number, nowMs: number): Promise<{ status: ParticipantStatus }> {
  const mtg = await d.prepare(
    `SELECT mt.member_id, mt.status, mt.ends_at FROM mt_meetups mt JOIN hub_members m ON m.id = mt.member_id
     WHERE mt.id = ? AND mt.status IN ('active','cancelled') AND ${HOST_OK}`,
  ).bind(id).first<{ member_id: number; status: MeetupStatus; ends_at: string }>();
  if (!mtg) throw new HubError("not_found", "Meetup introuvable");
  if (mtg.member_id === member.id) throw new HubError("invalid", "Vous organisez ce meetup");
  if (mtg.status === "cancelled") throw new HubError("invalid", "Ce meetup est annulé");
  if (mtg.ends_at < nowMinuteCasablanca(nowMs)) throw new HubError("invalid", "Ce meetup est terminé");
  if (await d.prepare("SELECT 1 AS ok FROM mt_participants WHERE meetup_id = ? AND member_id = ?").bind(id, member.id).first()) throw new HubError("invalid", "Vous participez déjà");
  // ponytail: leave/join toggling is not counted (only rows still present), enough against bulk joining
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mt_participants WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MT_LIMITS.joinsPerHour) throw new HubError("rate_limited", "Trop d'inscriptions, réessayez plus tard");
  // One statement decides the seat from the live count: concurrent joins can never overbook.
  const row = await d.prepare(
    `INSERT OR IGNORE INTO mt_participants (meetup_id, member_id, status, created_at)
     SELECT mt.id, ?, CASE WHEN (SELECT COUNT(*) FROM mt_participants p WHERE p.meetup_id = mt.id AND p.status = 'going') < mt.capacity THEN 'going' ELSE 'waitlist' END, ?
     FROM mt_meetups mt WHERE mt.id = ? AND mt.status = 'active'
     RETURNING status`,
  ).bind(member.id, iso(nowMs), id).first<{ status: ParticipantStatus }>();
  if (!row) throw new HubError("invalid", "Vous participez déjà");
  return { status: row.status };
}

export async function leaveMeetup(d: D1Like, member: MemberRow, id: number): Promise<{ ok: true }> {
  const p = await d.prepare("SELECT 1 AS ok FROM mt_participants WHERE meetup_id = ? AND member_id = ?").bind(id, member.id).first();
  if (!p) throw new HubError("not_found", "Vous ne participez pas à ce meetup");
  await d.batch([
    d.prepare("DELETE FROM mt_participants WHERE meetup_id = ? AND member_id = ?").bind(id, member.id),
    fillSeats(d, id),
  ]);
  return { ok: true };
}

// ---- mes meetups ----------------------------------------------------------

/** role "organized": what I organise; "joined": what I signed up for (my_status tells going or waitlist). Past ones included. */
export async function listMyMeetups(d: D1Like, memberId: number, role: string, nowMs: number): Promise<MeetupCard[]> {
  if (role !== "organized" && role !== "joined") throw new HubError("invalid", "Filtre invalide");
  const scope = role === "organized"
    ? "mt.member_id = ?"
    : `EXISTS (SELECT 1 FROM mt_participants q WHERE q.meetup_id = mt.id AND q.member_id = ?) AND ${HOST_OK}`;
  const { results } = await d.prepare(
    `${cardSelect()} WHERE ${scope} AND mt.status IN ('active','cancelled') ORDER BY mt.starts_at DESC, mt.id DESC LIMIT 100`,
  ).bind(memberId, memberId).all<any>();
  const nowMin = nowMinuteCasablanca(nowMs);
  return results.map(r => toCard(r, nowMin));
}

// ---- admin ----------------------------------------------------------------

export interface AdminMeetup {
  id: number; title: string; category: string; country: string; city: string; starts_at: string;
  capacity: number; status: MeetupStatus; organizer: string; going_count: number; waitlist_count: number;
}

export async function adminListMeetups(d: D1Like): Promise<AdminMeetup[]> {
  const { results } = await d.prepare(
    `SELECT mt.id, mt.title, mt.category, mt.country, mt.city, mt.starts_at, mt.capacity, mt.status, m.display_name AS organizer,
       (SELECT COUNT(*) FROM mt_participants p WHERE p.meetup_id = mt.id AND p.status = 'going') AS going_count,
       (SELECT COUNT(*) FROM mt_participants p WHERE p.meetup_id = mt.id AND p.status = 'waitlist') AS waitlist_count
     FROM mt_meetups mt JOIN hub_members m ON m.id = mt.member_id ORDER BY mt.id DESC LIMIT 100`,
  ).all<AdminMeetup>();
  return results;
}

async function assertExists(d: D1Like, id: number): Promise<void> {
  if (!(await d.prepare("SELECT 1 AS ok FROM mt_meetups WHERE id = ?").bind(id).first())) throw new HubError("not_found", "Meetup introuvable");
}

/** Soft delete: the meetup disappears everywhere. */
export async function hideMeetup(d: D1Like, id: number): Promise<void> {
  await assertExists(d, id);
  await d.prepare("UPDATE mt_meetups SET status = 'hidden' WHERE id = ?").bind(id).run();
}

/** Hard delete: participants first, so the result does not depend on the foreign-key pragma. */
export async function deleteMeetup(d: D1Like, id: number): Promise<void> {
  await assertExists(d, id);
  await d.batch([
    d.prepare("DELETE FROM mt_participants WHERE meetup_id = ?").bind(id),
    d.prepare("DELETE FROM mt_meetups WHERE id = ?").bind(id),
  ]);
}
