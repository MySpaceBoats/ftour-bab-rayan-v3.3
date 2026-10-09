/**
 * Team directory, contact messages and partner leads on Cloudflare D1.
 * No tRPC / Supabase imports: testable with a fake D1 (see site-d1.test.ts).
 */
import type { D1Like } from "./gallery-d1";

const bool = (v: unknown) => Boolean(Number(v));

// ---- team ----------------------------------------------------------------

const mapTeam = (r: any) => (r ? { ...r, is_active: bool(r.is_active) } : r);

export async function listTeam(d: D1Like, opts: { edition?: number; onlyActive?: boolean }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.edition) { where.push("edition = ?"); params.push(opts.edition); }
  if (opts.onlyActive) where.push("is_active = 1");
  const { results } = await d
    .prepare(`SELECT * FROM ftour_team_members ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY display_order ASC`)
    .bind(...params)
    .all();
  return results.map(mapTeam);
}

export interface NewTeamMember {
  firstName: string;
  lastName: string;
  role: string | null;
  citation: string | null;
  photoUrl: string | null;
  displayOrder: number;
  edition: number;
}

export async function createTeam(d: D1Like, m: NewTeamMember) {
  return mapTeam(
    await d
      .prepare(
        `INSERT INTO ftour_team_members (first_name, last_name, role, citation, photo_url, display_order, edition, is_active)
         VALUES (?,?,?,?,?,?,?,1) RETURNING *`
      )
      .bind(m.firstName, m.lastName, m.role, m.citation, m.photoUrl, m.displayOrder, m.edition)
      .first()
  );
}

/** patch keys are column names; undefined values are skipped. */
export async function updateTeam(d: D1Like, id: number, patch: Record<string, unknown>) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  const set = [...entries.map(([k]) => `${k} = ?`), "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"].join(", ");
  const vals = entries.map(([, v]) => (typeof v === "boolean" ? (v ? 1 : 0) : v));
  return mapTeam(await d.prepare(`UPDATE ftour_team_members SET ${set} WHERE id = ? RETURNING *`).bind(...vals, id).first());
}

export async function deleteTeam(d: D1Like, id: number) {
  await d.prepare("DELETE FROM ftour_team_members WHERE id = ?").bind(id).run();
}

export async function reorderTeam(d: D1Like, orderedIds: number[]) {
  if (orderedIds.length === 0) return;
  await d.batch(orderedIds.map((id, i) => d.prepare("UPDATE ftour_team_members SET display_order = ? WHERE id = ?").bind(i, id)));
}

// ---- contact -------------------------------------------------------------

export interface NewContact { name: string; email: string; phone?: string; subject?: string; message: string }

export async function insertContact(d: D1Like, c: NewContact) {
  const row = await d
    .prepare("INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?,?,?,?,?) RETURNING id")
    .bind(c.name, c.email, c.phone ?? null, c.subject ?? null, c.message)
    .first<{ id: number }>();
  if (!row) throw new Error("contact insert failed");
  return row;
}

export async function listContacts(d: D1Like) {
  const { results } = await d.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC").all();
  return results.map((m: any) => ({ ...m, is_read: bool(m.is_read) }));
}

export async function markContactRead(d: D1Like, id: number) {
  await d.prepare("UPDATE contact_messages SET is_read = 1 WHERE id = ?").bind(id).run();
}

// ---- partner leads -------------------------------------------------------

export interface NewPartnerLead {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  city?: string;
  partnershipType?: string;
  budgetRange?: string;
  message?: string;
  source?: string;
  locale?: string;
}

export async function insertPartnerLead(d: D1Like, p: NewPartnerLead): Promise<string> {
  const id = crypto.randomUUID();
  await d
    .prepare(
      `INSERT INTO partner_leads (id, company_name, contact_name, email, phone, city, partnership_type, budget_range, message, source, locale)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(id, p.companyName, p.contactName, p.email, p.phone ?? null, p.city ?? null, p.partnershipType ?? null,
      p.budgetRange ?? null, p.message ?? null, p.source ?? "website", p.locale ?? null)
    .run();
  return id;
}
