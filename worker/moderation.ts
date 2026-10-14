/** Modération IA du Hub sur D1: analyse un contenu, masque ou signale, journalise. Les notifications sont injectées (deps.notify). */
import type { D1Like } from "./gallery-d1";
import type { FetchLike } from "./ai-core";
import { HubError, TEAM_EMAIL, iso } from "./hub-d1";
import { analyse, decide, type Verdict } from "./moderation-core";

export type Target = "post" | "comment";
export interface ModerationEvent {
  id: number; type: Target; targetId: number; memberId: number;
  rule: string; reason: string; confidence: number; excerpt: string; action: "hidden" | "flagged";
}
export interface ModerationDeps { fetch: FetchLike; apiKey?: string; models?: string; nowMs: number; notify?: (e: ModerationEvent) => Promise<void> }

export const TABLE = { post: "hub_posts", comment: "hub_comments" } as const;
const EXCERPT = 200;
const RETRY_BUDGET_MS = 10_000;

async function record(d: D1Like, type: Target, targetId: number, memberId: number, v: Verdict | null, action: "hidden" | "flagged" | "error", nowMs: number): Promise<number | null> {
  const r = await d.prepare(
    `INSERT INTO hub_moderation (target_type, target_id, member_id, rule, confidence, reason, action, created_at) VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(target_type, target_id) DO NOTHING RETURNING id`,
  ).bind(type, targetId, memberId, v?.rule ?? null, v?.confidence ?? null, v?.reason ?? null, action, iso(nowMs)).first<{ id: number }>();
  return r?.id ?? null;
}

export async function moderate(d: D1Like, deps: ModerationDeps, type: Target, targetId: number): Promise<"hidden" | "flagged" | "none" | "skipped" | "error"> {
  if (!deps.apiKey) return "skipped";
  const seen = await d.prepare("SELECT 1 AS ok FROM hub_moderation WHERE target_type = ? AND target_id = ?").bind(type, targetId).first();
  if (seen) return "skipped";
  const row = await d.prepare(
    `SELECT t.member_id, t.body FROM ${TABLE[type]} t JOIN hub_members m ON m.id = t.member_id
     WHERE t.id = ? AND t.status = 'visible' AND m.role <> 'moderator' AND m.email <> ?`,
  ).bind(targetId, TEAM_EMAIL).first<{ member_id: number; body: string }>();
  if (!row) return "skipped";

  let verdict: Verdict | null = null;
  const started = Date.now();
  // waitUntil gives the Worker ~30s after the response: no second pass once the first one used most of it.
  for (let pass = 0; pass < 2 && !verdict && (pass === 0 || Date.now() - started < RETRY_BUDGET_MS); pass++) {
    try { verdict = await analyse(deps.fetch, deps.apiKey, deps.models, row.body); } catch (e) { console.error("[moderation] model failed", e); }
  }
  const stillVisible = async () => !!(await d.prepare(`SELECT 1 AS ok FROM ${TABLE[type]} WHERE id = ? AND status = 'visible'`).bind(targetId).first());
  if (!verdict) { await record(d, type, targetId, row.member_id, null, "error", deps.nowMs); return "error"; }

  const decision = decide(verdict);
  if (decision === "none") return "none";
  // The model took seconds: the author may have deleted the content meanwhile. Write only if it is still visible.
  if (decision === "hidden") {
    const hid = await d.prepare(`UPDATE ${TABLE[type]} SET status = 'hidden' WHERE id = ? AND status = 'visible' RETURNING id`).bind(targetId).first();
    if (!hid) return "skipped"; // deleted meanwhile, or hidden by a simultaneous analysis
  } else if (!(await stillVisible())) return "skipped";
  let id: number | null;
  try {
    id = await record(d, type, targetId, row.member_id, verdict, decision, deps.nowMs);
  } catch (e) {
    if (decision === "hidden") await d.prepare(`UPDATE ${TABLE[type]} SET status = 'visible' WHERE id = ?`).bind(targetId).run();
    throw e; // never leave content hidden without a journal line
  }
  if (id === null) return "skipped"; // lost the race against a simultaneous analysis
  try {
    await deps.notify?.({ id, type, targetId, memberId: row.member_id, rule: verdict.rule!, reason: verdict.reason, confidence: verdict.confidence, excerpt: row.body.slice(0, EXCERPT), action: decision });
  } catch (e) { console.error("[moderation] notify failed", e); }
  return decision;
}

export interface ModerationRow {
  id: number; target_type: Target; target_id: number; rule: string | null; confidence: number | null; reason: string | null;
  action: "hidden" | "flagged" | "restored" | "error"; created_at: string; reviewed_at: string | null; author: string; excerpt: string | null;
}

export async function listModeration(d: D1Like, filter: "review" | "all"): Promise<ModerationRow[]> {
  const { results } = await d.prepare(
    `SELECT mo.id, mo.target_type, mo.target_id, mo.rule, mo.confidence, mo.reason, mo.action, mo.created_at, mo.reviewed_at, m.display_name AS author,
       CASE mo.target_type
         WHEN 'post' THEN (SELECT substr(body, 1, ${EXCERPT}) FROM hub_posts WHERE id = mo.target_id)
         ELSE (SELECT substr(body, 1, ${EXCERPT}) FROM hub_comments WHERE id = mo.target_id) END AS excerpt
     FROM hub_moderation mo JOIN hub_members m ON m.id = mo.member_id
     WHERE (? = 'all' OR (mo.action IN ('hidden','flagged','error') AND mo.reviewed_at IS NULL))
     ORDER BY mo.id DESC LIMIT 100`,
  ).bind(filter).all<ModerationRow>();
  return results;
}

async function loadEvent(d: D1Like, id: number): Promise<(ModerationEvent & { rawAction: string }) | null> {
  const r = await d.prepare("SELECT id, target_type, target_id, member_id, rule, confidence, reason, action FROM hub_moderation WHERE id = ?").bind(id).first<any>();
  if (!r) return null;
  const body = await d.prepare(`SELECT substr(body, 1, ${EXCERPT}) AS b FROM ${TABLE[r.target_type as Target]} WHERE id = ?`).bind(r.target_id).first<{ b: string }>();
  return {
    id: r.id, type: r.target_type, targetId: r.target_id, memberId: r.member_id, rule: r.rule ?? "", reason: r.reason ?? "",
    confidence: r.confidence ?? 0, excerpt: body?.b ?? "", action: "hidden", rawAction: r.action,
  };
}

/** Hidden: content visible again (+ author told by the caller). Flagged: just closes the line. Other states: nothing to restore. */
export async function restoreItem(d: D1Like, id: number, by: string, nowMs: number): Promise<{ event: ModerationEvent; wasHidden: boolean } | null> {
  const e = await loadEvent(d, id);
  if (!e) return null;
  if (e.rawAction !== "hidden" && e.rawAction !== "flagged") throw new HubError("invalid", "Rien à restaurer");
  const wasHidden = e.rawAction === "hidden";
  // Claim the line first: a second admin (or a concurrent confirm) finds it already closed and stops here.
  const claimed = await d.prepare("UPDATE hub_moderation SET action = 'restored', reviewed_at = ?, restored_by = ? WHERE id = ? AND action = ? RETURNING id").bind(iso(nowMs), by, id, e.rawAction).first();
  if (!claimed) throw new HubError("invalid", "Déjà traité");
  if (wasHidden) await d.prepare(`UPDATE ${TABLE[e.type]} SET status = 'visible' WHERE id = ?`).bind(e.targetId).run();
  return { event: e, wasHidden };
}

/** Hidden: closes the review. Flagged: confirms the violation, hides the content (caller notifies like an automatic hide). */
export async function confirmItem(d: D1Like, id: number, nowMs: number): Promise<{ event: ModerationEvent; newlyHidden: boolean } | null> {
  const e = await loadEvent(d, id);
  if (!e) return null;
  if (e.rawAction !== "hidden" && e.rawAction !== "flagged" && e.rawAction !== "error") throw new HubError("invalid", "Rien à confirmer");
  const flagged = e.rawAction === "flagged";
  const claimed = await d.prepare("UPDATE hub_moderation SET action = ?, reviewed_at = ? WHERE id = ? AND action = ? AND reviewed_at IS NULL RETURNING id").bind(flagged ? "hidden" : e.rawAction, iso(nowMs), id, e.rawAction).first();
  if (!claimed) throw new HubError("invalid", "Déjà traité");
  // Only tell the author when the content was really still visible (they may have deleted it meanwhile).
  const newlyHidden = flagged && !!(await d.prepare(`UPDATE ${TABLE[e.type]} SET status = 'hidden' WHERE id = ? AND status = 'visible' RETURNING id`).bind(e.targetId).first());
  return { event: e, newlyHidden };
}
