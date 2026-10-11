/** Pure logic of the realtime chat (presence, typing relay, push). The Durable Object only wires sockets to it. */
export type ChatSource = "pro" | "market" | "stay";
export type ClientEvent = { type: "typing"; to: number; source: ChatSource; thread_id: number };
export type ServerEvent =
  | { type: "presence_snapshot"; online: number[] }
  | { type: "presence"; id: number; online: boolean }
  | { type: "message"; source: ChatSource; thread_id: number }
  | { type: "typing"; source: ChatSource; thread_id: number; from: number };
export interface Conn { memberId: number; send(data: string): void }

const MAX_FRAME = 512;
const SOURCES = new Set<string>(["pro", "market", "stay"]);
export const isSource = (v: unknown): v is ChatSource => typeof v === "string" && SOURCES.has(v);
const posInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

export const onlineIds = (conns: Conn[]): number[] => [...new Set(conns.map(c => c.memberId))].sort((a, b) => a - b);

export function parseClientEvent(raw: unknown): ClientEvent | null {
  if (typeof raw !== "string" || raw.length > MAX_FRAME) return null;
  let v: any;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== "object" || v.type !== "typing") return null;
  if (!posInt(v.to) || !posInt(v.thread_id) || !isSource(v.source)) return null;
  return { type: "typing", to: v.to, source: v.source, thread_id: v.thread_id };
}

function trySend(c: Conn, data: string): boolean {
  try { c.send(data); return true; } catch { return false; }
}

export function deliver(conns: Conn[], to: number, ev: ServerEvent): number {
  const data = JSON.stringify(ev);
  let n = 0;
  for (const c of conns) if (c.memberId === to && trySend(c, data)) n++;
  return n;
}

export function broadcast(conns: Conn[], ev: ServerEvent): void {
  const data = JSON.stringify(ev);
  for (const c of conns) trySend(c, data);
}

export function presenceOnOpen(conns: Conn[], memberId: number): ServerEvent | null {
  return conns.filter(c => c.memberId === memberId).length === 1 ? { type: "presence", id: memberId, online: true } : null;
}

export function presenceOnClose(remaining: Conn[], memberId: number): ServerEvent | null {
  return remaining.some(c => c.memberId === memberId) ? null : { type: "presence", id: memberId, online: false };
}
