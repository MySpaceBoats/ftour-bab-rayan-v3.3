import { getHubToken } from "../api";

export type ChatSource = "pro" | "market" | "stay";
export type ServerEvent =
  | { type: "presence_snapshot"; online: number[] }
  | { type: "presence"; id: number; online: boolean }
  | { type: "message"; source: ChatSource; thread_id: number }
  | { type: "typing"; source: ChatSource; thread_id: number; from: number };
type Listener = (e: ServerEvent) => void;

const online = new Set<number>();
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let connected = false;
let users = 0;
let retry = 1000;
let timer: ReturnType<typeof setTimeout> | undefined;

function url(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) || "/api/trpc";
  const u = new URL(base, window.location.origin);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/hub/ws";
  u.search = "";
  return u.toString();
}

const fire = (e: ServerEvent) => listeners.forEach(l => { try { l(e); } catch { /* a bad listener must not break the others */ } });

function open() {
  const token = getHubToken();
  if (!token || ws || users === 0) return;
  let sock: WebSocket;
  try { sock = new WebSocket(url(), ["hub", token]); } catch { return; }
  ws = sock;
  sock.onopen = () => { retry = 1000; connected = true; fire({ type: "presence_snapshot", online: Array.from(online) }); };
  sock.onmessage = ev => {
    let e: ServerEvent;
    try { e = JSON.parse(String(ev.data)); } catch { return; }
    if (e.type === "presence_snapshot") { online.clear(); e.online.forEach(i => online.add(i)); }
    else if (e.type === "presence") { if (e.online) online.add(e.id); else online.delete(e.id); }
    fire(e);
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    connected = false;
    online.clear();
    fire({ type: "presence_snapshot", online: [] });
    if (users > 0 && getHubToken()) { timer = setTimeout(open, retry); retry = Math.min(retry * 2, 30_000); }
  };
}

/** Keep the socket open while at least one component needs it. Returns the release function. */
export function retain(): () => void {
  users++;
  open();
  return () => {
    users--;
    if (users === 0) { clearTimeout(timer); ws?.close(); ws = null; connected = false; online.clear(); }
  };
}
export const subscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isOnline = (id: number) => online.has(id);
export const isConnected = () => connected;
export function sendTyping(to: number, source: ChatSource, threadId: number): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "typing", to, source, thread_id: threadId }));
}
