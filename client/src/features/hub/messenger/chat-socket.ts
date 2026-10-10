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
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let ping: ReturnType<typeof setInterval> | undefined;
let pongTimer: ReturnType<typeof setTimeout> | undefined;
const PING_MS = 25_000;
const PONG_WAIT_MS = 10_000;
const RELEASE_DELAY_MS = 2_000;

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
  sock.onopen = () => {
    retry = 1000;
    connected = true;
    fire({ type: "presence_snapshot", online: Array.from(online) });
    // heartbeat: the server answers "ping" with "pong"; silence means a dead link, so reconnect
    clearInterval(ping);
    ping = setInterval(() => {
      if (sock.readyState !== WebSocket.OPEN) return;
      sock.send("ping");
      clearTimeout(pongTimer);
      pongTimer = setTimeout(() => sock.close(), PONG_WAIT_MS);
    }, PING_MS);
  };
  sock.onmessage = ev => {
    if (ev.data === "pong") { clearTimeout(pongTimer); return; }
    let e: ServerEvent;
    try { e = JSON.parse(String(ev.data)); } catch { return; }
    if (e.type === "presence_snapshot") { online.clear(); e.online.forEach(i => online.add(i)); }
    else if (e.type === "presence") { if (e.online) online.add(e.id); else online.delete(e.id); }
    fire(e);
  };
  sock.onclose = () => {
    // a late close of a replaced socket must not touch the state of the new one
    if (ws !== sock) return;
    ws = null;
    clearInterval(ping);
    clearTimeout(pongTimer);
    connected = false;
    online.clear();
    fire({ type: "presence_snapshot", online: [] });
    if (users > 0 && getHubToken()) { timer = setTimeout(open, retry); retry = Math.min(retry * 2, 30_000); }
  };
}

/** Keep the socket open while at least one component needs it. Returns the release function. */
export function retain(): () => void {
  users++;
  clearTimeout(closeTimer);
  open();
  return () => {
    users--;
    // every hub page mounts its own shell: wait a moment so a page change reuses the socket
    if (users === 0) closeTimer = setTimeout(close, RELEASE_DELAY_MS);
  };
}

function close() {
  if (users === 0) teardown();
}

function teardown() {
  clearTimeout(timer);
  clearInterval(ping);
  clearTimeout(pongTimer);
  const sock = ws;
  ws = null;
  connected = false;
  online.clear();
  sock?.close();
}

// logged out or session revoked: stop the socket and do not reconnect (the token is gone)
if (typeof window !== "undefined") window.addEventListener("hub:unauthorized", () => { teardown(); fire({ type: "presence_snapshot", online: [] }); });
export const subscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isOnline = (id: number) => online.has(id);
export const isConnected = () => connected;
export function sendTyping(to: number, source: ChatSource, threadId: number): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "typing", to, source, thread_id: threadId }));
}
