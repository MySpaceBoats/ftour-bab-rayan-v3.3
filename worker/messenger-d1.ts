/** Unified messenger: one inbox over Pro threads, Marketplace threads and Stay requests. Tables stay in their modules. */
import type { D1Like } from "./gallery-d1";
import * as P from "./pro-d1";
import * as M from "./market-d1";
import * as S from "./stay-d1";

export type Source = "pro" | "market" | "stay";
export interface InboxItem { source: Source; id: number; other: P.Person; context: string | null; last_body: string | null; last_message_at: string; unread: number }

const LIMIT = 100;
const BODY_MAX = 140;
const cut = (s: string | null) => (s && s.length > BODY_MAX ? s.slice(0, BODY_MAX) : s);
const marks = (n: number) => Array(n).fill("?").join(",");

async function lastStayMessages(d: D1Like, ids: number[]): Promise<Map<number, { body: string; created_at: string }>> {
  if (!ids.length) return new Map();
  const { results } = await d.prepare(
    `SELECT request_id, body, created_at FROM st_request_messages
     WHERE id IN (SELECT MAX(id) FROM st_request_messages WHERE status = 'visible' AND request_id IN (${marks(ids.length)}) GROUP BY request_id)`,
  ).bind(...ids).all<{ request_id: number; body: string; created_at: string }>();
  return new Map(results.map(r => [r.request_id, r]));
}

async function eligibleSet(d: D1Like, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { results } = await d.prepare(`SELECT m.id FROM hub_members m WHERE m.id IN (${marks(ids.length)}) AND ${P.memberOk("m")}`).bind(...ids).all<{ id: number }>();
  return new Set(results.map(r => r.id));
}

export async function inbox(d: D1Like, memberId: number): Promise<InboxItem[]> {
  const [pro, mk, stay] = await Promise.all([P.listThreads(d, memberId), M.listThreads(d, memberId), S.listMyRequests(d, memberId, "all")]);
  const last = await lastStayMessages(d, stay.map(r => r.id));
  const { results: pend } = await d.prepare("SELECT id FROM st_requests WHERE host_id = ? AND status = 'pending'").bind(memberId).all<{ id: number }>();
  const pending = new Set(pend.map(r => r.id));
  const items: InboxItem[] = [
    ...pro.map(t => ({ source: "pro" as const, id: t.id, other: t.other, context: t.job_title, last_body: cut(t.last_body), last_message_at: t.last_message_at, unread: t.unread })),
    ...mk.map(t => ({ source: "market" as const, id: t.id, other: { id: t.other.id, display_name: t.other.display_name, avatar_key: t.other.avatar_key }, context: t.listing_title, last_body: cut(t.last_body), last_message_at: t.last_message_at, unread: t.unread })),
    ...stay.map(r => ({
      source: "stay" as const, id: r.id, other: r.other, context: r.listing_title,
      last_body: cut(last.get(r.id)?.body ?? null), last_message_at: last.get(r.id)?.created_at ?? r.created_at, unread: r.unread + (pending.has(r.id) ? 1 : 0),
    })),
  ];
  const ok = await eligibleSet(d, [...new Set(items.map(i => i.other.id))]);
  return items
    .filter(i => ok.has(i.other.id))
    .sort((x, y) => (x.last_message_at < y.last_message_at ? 1 : x.last_message_at > y.last_message_at ? -1 : y.id - x.id))
    .slice(0, LIMIT);
}

/** Unread counts that agree with the inbox: conversations with a suspended/ineligible member never count. */
export async function unreadAll(d: D1Like, memberId: number): Promise<number> {
  const ok = P.memberOk("o");
  const [a, mk, st] = await Promise.all([
    P.unreadTotal(d, memberId),
    d.prepare(
      `SELECT COUNT(*) AS n FROM mk_messages x JOIN mk_threads t ON t.id = x.thread_id JOIN mk_listings l ON l.id = t.listing_id
       JOIN hub_members o ON o.id = CASE WHEN t.buyer_id = ? THEN t.seller_id ELSE t.buyer_id END
       WHERE (t.buyer_id = ? OR t.seller_id = ?) AND x.sender_id <> ? AND x.read_at IS NULL AND l.status <> 'hidden' AND ${ok}`,
    ).bind(memberId, memberId, memberId, memberId).first<{ n: number }>(),
    d.prepare(
      `SELECT
         (SELECT COUNT(*) FROM st_request_messages x JOIN st_requests q ON q.id = x.request_id JOIN st_listings l ON l.id = q.listing_id
            JOIN hub_members o ON o.id = CASE WHEN q.guest_id = ? THEN q.host_id ELSE q.guest_id END
            WHERE (q.guest_id = ? OR q.host_id = ?) AND x.sender_id <> ? AND x.read_at IS NULL AND x.status = 'visible' AND l.status <> 'hidden' AND ${ok})
         + (SELECT COUNT(*) FROM st_requests q JOIN st_listings l ON l.id = q.listing_id JOIN hub_members o ON o.id = q.guest_id
            WHERE q.host_id = ? AND q.status = 'pending' AND l.status <> 'hidden' AND ${ok}) AS n`,
    ).bind(memberId, memberId, memberId, memberId, memberId).first<{ n: number }>(),
  ]);
  return a + (mk?.n ?? 0) + (st?.n ?? 0);
}

const OTHER_SQL: Record<Source, string> = {
  pro: "SELECT CASE WHEN member_a = ? THEN member_b ELSE member_a END AS r, member_a AS x, member_b AS y FROM pro_threads WHERE id = ?",
  market: "SELECT CASE WHEN buyer_id = ? THEN seller_id ELSE buyer_id END AS r, buyer_id AS x, seller_id AS y FROM mk_threads WHERE id = ?",
  stay: "SELECT CASE WHEN guest_id = ? THEN host_id ELSE guest_id END AS r, guest_id AS x, host_id AS y FROM st_requests WHERE id = ?",
};

/** The other participant of a thread, derived from the stored row. Null if the sender is not a participant. */
export async function recipientOf(d: D1Like, source: Source, id: number, senderId: number): Promise<number | null> {
  const row = await d.prepare(OTHER_SQL[source]).bind(senderId, id).first<{ r: number; x: number; y: number }>();
  if (!row || (row.x !== senderId && row.y !== senderId)) return null;
  return row.r;
}

export async function isEligible(d: D1Like, memberId: number): Promise<boolean> {
  return !!(await d.prepare(`SELECT 1 AS ok FROM hub_members m WHERE m.id = ? AND ${P.memberOk("m")}`).bind(memberId).first());
}
