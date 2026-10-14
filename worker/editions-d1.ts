/** Editions of the event: one active at a time; an archived edition keeps all its data, read-only and closed to registrations. */
import type { D1Like } from "./gallery-d1";

export type EditionStatus = "draft" | "active" | "archived";
export interface EditionRow { edition: number; status: EditionStatus; archived_at: string | null; days: number; volunteers: number }
export interface CalendarInput { startDate: string; endDate: string; capacity: number; iftarTime?: string | null; location?: string | null }

/** Business-rule violation, shown as is to the admin. */
export class EditionError extends Error {}

const MAX_DAYS = 40;
const DAY_MS = 86_400_000;

const statusOf = async (d: D1Like, edition: number) =>
  (await d.prepare("SELECT status FROM edition_settings WHERE edition = ?").bind(edition).first<{ status: EditionStatus }>())?.status ?? null;

/** The active edition, or null when there is none (or before the editions migration was applied). */
export async function activeEdition(d: D1Like): Promise<number | null> {
  try {
    return (await d.prepare("SELECT edition FROM edition_settings WHERE status = 'active' ORDER BY edition LIMIT 1").first<{ edition: number }>())?.edition ?? null;
  } catch {
    return null;
  }
}

/** Edition to filter days on: null = do not filter (migration not applied yet), -1 = no edition is active (shows nothing). */
export async function editionFilter(d: D1Like): Promise<number | null> {
  try {
    const row = await d.prepare("SELECT edition FROM edition_settings WHERE status = 'active' ORDER BY edition LIMIT 1").first<{ edition: number }>();
    return row?.edition ?? -1;
  } catch {
    return null;
  }
}

/** Columns to add when a day is created by hand: it belongs to the active edition. */
export async function newDayEdition(d: D1Like): Promise<{ edition?: number }> {
  const edition = await editionFilter(d);
  if (edition === null) return {};
  if (edition < 0) throw new EditionError("Aucune édition active : activez-en une dans la page Éditions");
  return { edition };
}

export async function listEditions(d: D1Like): Promise<EditionRow[]> {
  const { results } = await d
    .prepare(
      `SELECT s.edition, s.status, s.archived_at,
         (SELECT COUNT(*) FROM t_ramadan_days r WHERE r.edition = s.edition) AS days,
         (SELECT COUNT(*) FROM t_volunteers v JOIN t_ramadan_days r ON r.id = v.day_id WHERE r.edition = s.edition) AS volunteers
       FROM edition_settings s ORDER BY s.edition`
    )
    .all<EditionRow>();
  return results;
}

export async function archiveEdition(d: D1Like, edition: number): Promise<void> {
  const status = await statusOf(d, edition);
  if (!status) throw new EditionError("Édition introuvable");
  if (status === "archived") throw new EditionError("Cette édition est déjà archivée");
  await d.batch([
    d.prepare("UPDATE edition_settings SET status = 'archived', archived_at = ? WHERE edition = ?").bind(new Date().toISOString(), edition),
    d.prepare("UPDATE t_ramadan_days SET is_open = 0 WHERE edition = ?").bind(edition),
  ]);
}

/** Back to a draft: nothing becomes active by itself and the days stay closed. */
export async function unarchiveEdition(d: D1Like, edition: number): Promise<void> {
  if ((await statusOf(d, edition)) !== "archived") throw new EditionError("Cette édition n'est pas archivée");
  await d.prepare("UPDATE edition_settings SET status = 'draft', archived_at = NULL WHERE edition = ?").bind(edition).run();
}

const parseDay = (s: string): number | null => (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? Date.parse(`${s}T00:00:00Z`) : null);

/** Creates the days of a draft edition (closed to registration: the daily rolling window opens them). Returns how many were created. */
export async function setupCalendar(d: D1Like, edition: number, cal: CalendarInput): Promise<number> {
  const status = await statusOf(d, edition);
  if (!status) throw new EditionError("Édition introuvable");
  if (status !== "draft") throw new EditionError("Le calendrier ne se prépare que sur une édition en brouillon");
  const start = parseDay(cal.startDate);
  const end = parseDay(cal.endDate);
  if (start === null || end === null || end < start || (end - start) / DAY_MS + 1 > MAX_DAYS)
    throw new EditionError(`Dates invalides (début avant fin, ${MAX_DAYS} jours maximum)`);
  if (!Number.isInteger(cal.capacity) || cal.capacity < 1) throw new EditionError("Capacité invalide");

  const existing = await d.prepare("SELECT COUNT(*) AS n FROM t_ramadan_days WHERE edition = ?").bind(edition).first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) throw new EditionError("Cette édition a déjà des jours");

  const dates: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) dates.push(new Date(t).toISOString().slice(0, 10));
  const placeholders = dates.map(() => "?").join(",");
  const clash = await d.prepare(`SELECT COUNT(*) AS n FROM t_ramadan_days WHERE substr(date, 1, 10) IN (${placeholders})`).bind(...dates).first<{ n: number }>();
  if ((clash?.n ?? 0) > 0) throw new EditionError("Certaines de ces dates sont déjà utilisées par une autre édition");

  await d.batch(
    dates.map((date, i) =>
      d
        .prepare("INSERT INTO t_ramadan_days (edition, day_number, date, capacity, is_open, iftar_time, location) VALUES (?,?,?,?,0,?,?)")
        .bind(edition, i + 1, date, cal.capacity, cal.iftarTime || null, cal.location || null)
    )
  );
  return dates.length;
}

export async function activateEdition(d: D1Like, edition: number): Promise<void> {
  const status = await statusOf(d, edition);
  if (!status) throw new EditionError("Édition introuvable");
  if (status === "active") return;
  if (status === "archived") throw new EditionError("Désarchivez cette édition avant de l'activer");
  const current = await activeEdition(d);
  if (current !== null) throw new EditionError(`Archivez d'abord l'édition ${current} (une seule édition active à la fois)`);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM t_ramadan_days WHERE edition = ?").bind(edition).first<{ n: number }>();
  if ((n?.n ?? 0) === 0) throw new EditionError("Cette édition n'a aucun jour : préparez d'abord son calendrier");
  await d.prepare("UPDATE edition_settings SET status = 'active' WHERE edition = ?").bind(edition).run();
}
