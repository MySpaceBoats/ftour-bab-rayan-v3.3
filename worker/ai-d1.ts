/** Assistant IA on D1 (tables ai_*): rate limits, conversations, dispute context, admin cases. No HTTP imports; time is always passed in (nowMs). */
import type { D1Like } from "./gallery-d1";
import { HubError, iso, type MemberRow } from "./hub-d1";
import * as P from "./pro-d1";
import * as M from "./market-d1";
import * as S from "./stay-d1";
import * as X from "./messenger-d1";
import { clip } from "./ai-core";

export const LIMITS = {
  publicPerWindow: 10, publicWindowMs: 10 * 60_000, memberPerHour: 30, userChars: 500,
  historyTurns: 6, ctxChars: 4000, ctxMessages: 20, retentionDays: 90,
};
export type Role = "user" | "assistant" | "admin";
export type Ref = { source: X.Source; id: number };
export const isSource = (v: unknown): v is X.Source => v === "pro" || v === "market" || v === "stay";
const DAY = 86_400_000;

/** Counts hits of `key` inside the window, then records one. ponytail: count-then-insert is not atomic; a burst can overshoot by a few. */
export async function hit(d: D1Like, key: string, limit: number, windowMs: number, nowMs: number): Promise<void> {
  await d.prepare("DELETE FROM ai_hits WHERE at < ?").bind(iso(nowMs - DAY)).run();
  const r = await d.prepare("SELECT COUNT(*) AS n FROM ai_hits WHERE key = ? AND at > ?").bind(key, iso(nowMs - windowMs)).first<{ n: number }>();
  if ((r?.n ?? 0) >= limit) throw new HubError("rate_limited", "Trop de messages, réessayez plus tard");
  await d.prepare("INSERT INTO ai_hits (key, at) VALUES (?,?)").bind(key, iso(nowMs)).run();
}

/** Newest lines that fit the budget, oldest first. */
function tail(lines: string[], budget: number): string {
  const out: string[] = [];
  let n = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = clip(lines[i], 500);
    if (n + l.length + 1 > budget) break;
    out.unshift(l);
    n += l.length + 1;
  }
  return out.join("\n");
}

/** Dispute context for the model. Reuses each module's participant check: a non-participant gets not_found. */
export async function itemContext(d: D1Like, me: MemberRow, ref: Ref): Promise<string> {
  let kind: string, title: string | null, status: string | null, other: string, msgs: { sender_id: number; body: string }[];
  if (ref.source === "pro") {
    const r = await P.listMessages(d, me, ref.id);
    kind = r.job ? "Offre d'emploi" : "Message direct"; title = r.job?.title ?? null; status = null; other = r.other.display_name; msgs = r.messages;
  } else if (ref.source === "market") {
    const r = await M.listMessages(d, me, ref.id);
    kind = "Annonce Marketplace"; title = r.listing.title; status = r.listing.status; other = r.other.display_name; msgs = r.messages;
  } else {
    const r = await S.listRequestMessages(d, me, ref.id);
    kind = "Demande d'hébergement"; title = r.request.listing.title; status = r.request.status; other = r.other.display_name; msgs = r.messages;
  }
  const head = [`Type: ${kind}`, title && `Sujet: ${title}`, status && `Statut: ${status}`, `Autre partie: ${other}`, "Derniers messages (MEMBRE = la personne qui vous parle, AUTRE = l'autre partie):"].filter(Boolean).join("\n");
  const lines = msgs.slice(-LIMITS.ctxMessages).map(m => `${m.sender_id === me.id ? "MEMBRE" : "AUTRE"}: ${m.body}`);
  return `${head}\n${tail(lines, LIMITS.ctxChars)}`;
}

export async function choices(d: D1Like, memberId: number): Promise<{ source: X.Source; id: number; label: string }[]> {
  return (await X.inbox(d, memberId)).map(i => ({ source: i.source, id: i.id, label: `${i.context ? `${i.context} — ` : ""}${i.other.display_name}` }));
}

export async function openConversation(d: D1Like, me: MemberRow, ref: Ref | null, nowMs: number): Promise<number> {
  if (ref) await itemContext(d, me, ref); // not_found for non-participants
  const r = await d.prepare("INSERT INTO ai_conversations (member_id, source, item_id, created_at, updated_at) VALUES (?,?,?,?,?) RETURNING id")
    .bind(me.id, ref?.source ?? null, ref?.id ?? null, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return r!.id;
}

export interface ConvRow { id: number; member_id: number; source: X.Source | null; item_id: number | null }
export async function getOwned(d: D1Like, memberId: number, convId: number): Promise<ConvRow> {
  const r = await d.prepare("SELECT id, member_id, source, item_id FROM ai_conversations WHERE id = ? AND member_id = ?").bind(convId, memberId).first<ConvRow>();
  if (!r) throw new HubError("not_found", "Conversation introuvable");
  return r;
}

export async function addMessage(d: D1Like, convId: number, role: Role, body: string, nowMs: number): Promise<void> {
  await d.batch([
    d.prepare("INSERT INTO ai_messages (conversation_id, role, body, created_at) VALUES (?,?,?,?)").bind(convId, role, clip(body, 4000), iso(nowMs)),
    d.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").bind(iso(nowMs), convId),
  ]);
}

export async function history(d: D1Like, convId: number, turns: number): Promise<{ role: "user" | "assistant"; body: string }[]> {
  const { results } = await d.prepare("SELECT role, body FROM ai_messages WHERE conversation_id = ? AND role IN ('user','assistant') ORDER BY id DESC LIMIT ?")
    .bind(convId, turns * 2).all<{ role: "user" | "assistant"; body: string }>();
  return results.reverse();
}

export interface MessageRow { id: number; role: Role; body: string; created_at: string }
export async function messages(d: D1Like, convId: number): Promise<MessageRow[]> {
  const { results } = await d.prepare("SELECT id, role, body, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id LIMIT 200").bind(convId).all<MessageRow>();
  return results;
}

export async function caseOf(d: D1Like, convId: number): Promise<{ id: number; status: "open" | "closed" } | null> {
  return d.prepare("SELECT id, status FROM ai_cases WHERE conversation_id = ?").bind(convId).first<{ id: number; status: "open" | "closed" }>();
}

/** One case per conversation: idempotent while open, reopened (with a fresh summary) when it was closed. */
export async function createCase(d: D1Like, convId: number, memberId: number, summary: string, nowMs: number): Promise<{ id: number; created: boolean }> {
  const ex = await caseOf(d, convId);
  if (ex?.status === "open") return { id: ex.id, created: false };
  if (ex) {
    await d.prepare("UPDATE ai_cases SET status = 'open', closed_at = NULL, summary = ? WHERE id = ?").bind(clip(summary, 2000), ex.id).run();
    return { id: ex.id, created: true };
  }
  const r = await d.prepare(
    "INSERT INTO ai_cases (conversation_id, member_id, source, item_id, summary, created_at) SELECT id, member_id, source, item_id, ?, ? FROM ai_conversations WHERE id = ? AND member_id = ? RETURNING id",
  ).bind(clip(summary, 2000), iso(nowMs), convId, memberId).first<{ id: number }>();
  if (!r) throw new HubError("not_found", "Conversation introuvable");
  return { id: r.id, created: true };
}

export interface CaseListRow { id: number; status: "open" | "closed"; summary: string; source: X.Source | null; item_id: number | null; created_at: string; member_name: string }
export async function listCases(d: D1Like, status: "open" | "closed"): Promise<CaseListRow[]> {
  const { results } = await d.prepare(
    `SELECT c.id, c.status, c.summary, c.source, c.item_id, c.created_at, m.display_name AS member_name
     FROM ai_cases c JOIN hub_members m ON m.id = c.member_id WHERE c.status = ? ORDER BY c.id DESC LIMIT 100`,
  ).bind(status).all<CaseListRow>();
  return results;
}

export async function caseMeta(d: D1Like, id: number): Promise<{ conversation_id: number; member_id: number }> {
  const r = await d.prepare("SELECT conversation_id, member_id FROM ai_cases WHERE id = ?").bind(id).first<{ conversation_id: number; member_id: number }>();
  if (!r) throw new HubError("not_found", "Dossier introuvable");
  return r;
}

export interface CaseDetail extends CaseListRow { conversation_id: number; messages: MessageRow[]; context: string | null }
export async function getCase(d: D1Like, id: number): Promise<CaseDetail> {
  const meta = await caseMeta(d, id);
  const row = (await d.prepare(
    `SELECT c.id, c.status, c.summary, c.source, c.item_id, c.created_at, m.display_name AS member_name
     FROM ai_cases c JOIN hub_members m ON m.id = c.member_id WHERE c.id = ?`,
  ).bind(id).first<CaseListRow>())!;
  let context: string | null = null;
  if (row.source && row.item_id) {
    const me = await d.prepare("SELECT * FROM hub_members WHERE id = ?").bind(meta.member_id).first<MemberRow>();
    // the thread may be gone or hidden since: the case stays readable without context
    context = me ? await itemContext(d, me, { source: row.source, id: row.item_id }).catch(() => null) : null;
  }
  return { ...row, conversation_id: meta.conversation_id, messages: await messages(d, meta.conversation_id), context };
}

export async function closeCase(d: D1Like, id: number, nowMs: number): Promise<void> {
  await caseMeta(d, id);
  await d.prepare("UPDATE ai_cases SET status = 'closed', closed_at = ? WHERE id = ?").bind(iso(nowMs), id).run();
}

/** Drops conversations idle for 90 days, except those with an open case (their messages cascade). */
export async function purge(d: D1Like, nowMs: number): Promise<void> {
  await d.prepare("DELETE FROM ai_conversations WHERE updated_at < ? AND id NOT IN (SELECT conversation_id FROM ai_cases WHERE status = 'open')")
    .bind(iso(nowMs - LIMITS.retentionDays * DAY)).run();
}
