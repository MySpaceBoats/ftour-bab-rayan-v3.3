/**
 * Manager election on Cloudflare D1. Eligibility (volunteer participations) stays
 * in the caller: volunteers still live in Supabase.
 * No tRPC / Supabase imports: testable with a fake D1 (see election-d1.test.ts).
 */
import type { D1Like } from "./gallery-d1";

const mapSettings = (r: any) => (r ? { ...r, is_open: Boolean(Number(r.is_open)) } : r);

export async function getSettings(d: D1Like, year: number) {
  await d
    .prepare("INSERT OR IGNORE INTO election_settings (id, election_year, is_open, max_managers) VALUES (?, ?, 0, 10)")
    .bind(crypto.randomUUID(), year)
    .run();
  return mapSettings(await d.prepare("SELECT * FROM election_settings WHERE election_year = ?").bind(year).first());
}

export async function upsertSettings(d: D1Like, year: number, patch: { is_open?: boolean; max_managers?: number }) {
  await getSettings(d, year);
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length) {
    await d
      .prepare(`UPDATE election_settings SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE election_year = ?`)
      .bind(...entries.map(([, v]) => (typeof v === "boolean" ? (v ? 1 : 0) : v)), year)
      .run();
  }
  return getSettings(d, year);
}

export async function isOpen(d: D1Like, year: number): Promise<boolean> {
  const r = await d.prepare("SELECT is_open FROM election_settings WHERE election_year = ?").bind(year).first<{ is_open: number }>();
  return Boolean(Number(r?.is_open));
}

export async function listCandidates(d: D1Like, year: number, opts: { status?: string; newestFirst?: boolean } = {}) {
  const { results } = await d
    .prepare(
      `SELECT * FROM manager_candidates WHERE election_year = ? ${opts.status ? "AND status = ?" : ""}
       ORDER BY created_at ${opts.newestFirst ? "DESC" : "ASC"}`
    )
    .bind(...(opts.status ? [year, opts.status] : [year]))
    .all();
  return results;
}

/** Approved candidates with their vote count, most votes first. */
export async function results(d: D1Like, year: number) {
  const { results: rows } = await d
    .prepare(
      `SELECT c.id, c.first_name, c.last_name, c.photo_url, c.participation_count, c.status,
              (SELECT COUNT(*) FROM manager_votes v WHERE v.candidate_id = c.id) AS votes
       FROM manager_candidates c WHERE c.election_year = ? AND c.status = 'approved'
       ORDER BY votes DESC, c.created_at ASC`
    )
    .bind(year)
    .all();
  return rows;
}

export async function history(d: D1Like) {
  const { results: years } = await d
    .prepare("SELECT election_year, max_managers FROM election_settings ORDER BY election_year DESC")
    .all<{ election_year: number; max_managers: number }>();
  const out: { year: number; managers: any[] }[] = [];
  for (const y of years) {
    const ranked = await results(d, y.election_year);
    if (ranked.length) out.push({ year: y.election_year, managers: ranked.slice(0, y.max_managers) });
  }
  return out;
}

export async function getVote(d: D1Like, email: string, year: number): Promise<string | null> {
  const r = await d
    .prepare("SELECT candidate_id FROM manager_votes WHERE voter_email = ? AND election_year = ?")
    .bind(email, year)
    .first<{ candidate_id: string }>();
  return r?.candidate_id ?? null;
}

export type VoteOutcome = "ok" | "already_voted" | "no_candidate";

export async function castVote(d: D1Like, email: string, candidateId: string, year: number): Promise<VoteOutcome> {
  if (await getVote(d, email, year)) return "already_voted";
  const c = await d
    .prepare("SELECT id FROM manager_candidates WHERE id = ? AND election_year = ? AND status = 'approved'")
    .bind(candidateId, year)
    .first();
  if (!c) return "no_candidate";
  try {
    await d
      .prepare("INSERT INTO manager_votes (id, voter_email, candidate_id, election_year) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(), email, candidateId, year)
      .run();
  } catch (e) {
    // UNIQUE(voter_email, election_year): concurrent double vote
    if (/UNIQUE/i.test(String((e as Error).message))) return "already_voted";
    throw e;
  }
  return "ok";
}

export async function hasCandidacy(d: D1Like, email: string, year: number): Promise<boolean> {
  return !!(await d
    .prepare("SELECT 1 AS x FROM manager_candidates WHERE lower(email) = lower(?) AND election_year = ?")
    .bind(email.trim(), year)
    .first());
}

export interface NewCandidate {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  motivation_text: string | null;
  participation_count: number;
  election_year: number;
}

/** Throws an Error whose message contains "UNIQUE" if the email already applied this year. */
export async function createCandidate(d: D1Like, c: NewCandidate) {
  return d
    .prepare(
      `INSERT INTO manager_candidates (id, first_name, last_name, email, phone, photo_url, motivation_text, participation_count, election_year, status)
       VALUES (?,?,?,?,?,?,?,?,?,'pending') RETURNING *`
    )
    .bind(crypto.randomUUID(), c.first_name, c.last_name, c.email, c.phone, c.photo_url, c.motivation_text, c.participation_count, c.election_year)
    .first();
}

export async function setCandidateStatus(d: D1Like, id: string, status: string) {
  return d.prepare("UPDATE manager_candidates SET status = ? WHERE id = ? RETURNING *").bind(status, id).first();
}

export async function deleteCandidate(d: D1Like, id: string) {
  await d.prepare("DELETE FROM manager_candidates WHERE id = ?").bind(id).run();
}

export async function listVotes(d: D1Like, year: number) {
  const { results: rows } = await d
    .prepare("SELECT id, voter_email, candidate_id, created_at FROM manager_votes WHERE election_year = ? ORDER BY created_at DESC")
    .bind(year)
    .all();
  return rows;
}

export async function stats(d: D1Like, year: number) {
  const r = await d
    .prepare(
      `SELECT (SELECT COUNT(*) FROM manager_candidates WHERE election_year = ?1) AS totalCandidates,
              (SELECT COUNT(*) FROM manager_candidates WHERE election_year = ?1 AND status = 'approved') AS approvedCandidates,
              (SELECT COUNT(*) FROM manager_candidates WHERE election_year = ?1 AND status = 'pending') AS pendingCandidates,
              (SELECT COUNT(*) FROM manager_votes WHERE election_year = ?1) AS totalVotes`
    )
    .bind(year)
    .first<Record<string, number>>();
  return r!;
}
