/** Modération IA du Hub sur D1: analyse un contenu, masque ou signale, journalise. Les notifications sont injectées (deps.notify). */
import type { D1Like } from "./gallery-d1";
import type { FetchLike } from "./ai-core";
import { TEAM_EMAIL, iso } from "./hub-d1";
import { analyse, decide, type Verdict } from "./moderation-core";

export type Target = "post" | "comment";
export interface ModerationEvent {
  id: number; type: Target; targetId: number; memberId: number;
  rule: string; reason: string; confidence: number; excerpt: string; action: "hidden" | "flagged";
}
export interface ModerationDeps { fetch: FetchLike; apiKey?: string; models?: string; nowMs: number; notify?: (e: ModerationEvent) => Promise<void> }

export const TABLE = { post: "hub_posts", comment: "hub_comments" } as const;
const EXCERPT = 200;

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
  for (let pass = 0; pass < 2 && !verdict; pass++) {
    try { verdict = await analyse(deps.fetch, deps.apiKey, deps.models, row.body); } catch (e) { console.error("[moderation] model failed", e); }
  }
  if (!verdict) { await record(d, type, targetId, row.member_id, null, "error", deps.nowMs); return "error"; }

  const decision = decide(verdict);
  if (decision === "none") return "none";
  const id = await record(d, type, targetId, row.member_id, verdict, decision, deps.nowMs);
  if (id === null) return "skipped"; // lost the race against a simultaneous analysis
  if (decision === "hidden") await d.prepare(`UPDATE ${TABLE[type]} SET status = 'hidden' WHERE id = ?`).bind(targetId).run();
  try {
    await deps.notify?.({ id, type, targetId, memberId: row.member_id, rule: verdict.rule!, reason: verdict.reason, confidence: verdict.confidence, excerpt: row.body.slice(0, EXCERPT), action: decision });
  } catch (e) { console.error("[moderation] notify failed", e); }
  return decision;
}
