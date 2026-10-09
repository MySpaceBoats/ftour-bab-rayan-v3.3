/**
 * Donations on Cloudflare D1 (table donations_v2). Rows keep the Supabase snake_case shape;
 * `amount` is TEXT (callers already parseFloat it). No tRPC / Supabase imports: testable with a fake D1.
 */
import type { D1Like } from "./gallery-d1";

const mapRow = (r: any) => (r ? { ...r, is_anonymous: Boolean(Number(r.is_anonymous)), accepts_updates: Boolean(Number(r.accepts_updates)) } : r);

export async function byReference(d: D1Like, ref: string) {
  return mapRow(await d.prepare("SELECT * FROM donations_v2 WHERE donation_reference = ?").bind(ref).first());
}

export async function byId(d: D1Like, id: number) {
  return mapRow(await d.prepare("SELECT * FROM donations_v2 WHERE id = ?").bind(id).first());
}

export interface NewDonation {
  reference: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  amount: string;
  paymentMethod: "transfer" | "on_site" | "cheque" | "cash";
  status: "promised" | "pending";
  message?: string;
  isAnonymous: boolean;
  acceptsUpdates: boolean;
}

export async function createDonation(d: D1Like, n: NewDonation): Promise<{ id: number }> {
  const row = await d
    .prepare(
      `INSERT INTO donations_v2 (donation_reference, donor_name, donor_email, donor_phone, amount, payment_method, status, message, is_anonymous, accepts_updates)
       VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`
    )
    .bind(n.reference, n.donorName, n.donorEmail, n.donorPhone ?? null, n.amount, n.paymentMethod, n.status,
      n.message ?? null, n.isAnonymous ? 1 : 0, n.acceptsUpdates ? 1 : 0)
    .first<{ id: number }>();
  if (!row) throw new Error("donation insert failed");
  return row;
}

export async function listAll(d: D1Like) {
  const { results } = await d.prepare("SELECT * FROM donations_v2 ORDER BY created_at DESC, id DESC").all();
  return results.map(mapRow);
}

/** Keeps processed_by when none is given. */
export async function setStatus(d: D1Like, id: number, status: string, processedBy?: number | null) {
  await d
    .prepare(
      `UPDATE donations_v2 SET status = ?, processed_by = COALESCE(?, processed_by),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    )
    .bind(status, processedBy ?? null, id)
    .run();
}

/** Sum of received donations (amount is TEXT: cast in SQL). */
export async function receivedTotal(d: D1Like): Promise<number> {
  const r = await d
    .prepare("SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS t FROM donations_v2 WHERE status = 'received'")
    .first<{ t: number }>();
  return r?.t ?? 0;
}

export async function stats(d: D1Like) {
  const r = await d
    .prepare(
      `SELECT COUNT(*) AS count,
        COALESCE(SUM(CAST(amount AS REAL)), 0) AS total,
        COALESCE(SUM(CASE WHEN status = 'received' THEN CAST(amount AS REAL) END), 0) AS received,
        COALESCE(SUM(CASE WHEN status IN ('pending','promised') THEN CAST(amount AS REAL) END), 0) AS pending
       FROM donations_v2`
    )
    .first<{ count: number; total: number; received: number; pending: number }>();
  return r!;
}
