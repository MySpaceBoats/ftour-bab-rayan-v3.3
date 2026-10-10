/** Durable Object holding the hub WebSockets: presence, message push, typing relay. State lives in the sockets (hibernation API). */
import { broadcast, deliver, onlineIds, parseClientEvent, presenceOnClose, presenceOnOpen, type ChatSource, type Conn, type ServerEvent } from "./hub-chat-core";

interface ChatState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  getTags(ws: WebSocket): string[];
}
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

export class HubChat {
  constructor(private state: ChatState, _env: unknown) {}

  private conns(except?: WebSocket): Conn[] {
    return this.state.getWebSockets().filter(w => w !== except).map(w => ({ memberId: Number(this.state.getTags(w)[0]), send: (s: string) => w.send(s) }));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/notify" && request.method === "POST") {
      const b = (await request.json().catch(() => null)) as { to?: number; source?: ChatSource; thread_id?: number } | null;
      if (!b || !Number.isSafeInteger(b.to) || !Number.isSafeInteger(b.thread_id) || !b.source) return new Response(null, { status: 400 });
      deliver(this.conns(), b.to!, { type: "message", source: b.source, thread_id: b.thread_id! });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/ws" && request.headers.get("upgrade") === "websocket") {
      const memberId = Number(request.headers.get("x-member-id"));
      if (!Number.isSafeInteger(memberId) || memberId <= 0) return new Response(null, { status: 400 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.state.acceptWebSocket(server, [String(memberId)]);
      const conns = this.conns();
      const snapshot: ServerEvent = { type: "presence_snapshot", online: onlineIds(conns) };
      server.send(JSON.stringify(snapshot));
      const ev = presenceOnOpen(conns, memberId);
      if (ev) broadcast(conns, ev);
      return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": "hub" } } as ResponseInit);
    }
    return new Response(null, { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const ev = parseClientEvent(message);
    if (!ev) return;
    const from = Number(this.state.getTags(ws)[0]);
    deliver(this.conns(), ev.to, { type: "typing", source: ev.source, thread_id: ev.thread_id, from });
  }

  private gone(ws: WebSocket): void {
    const id = Number(this.state.getTags(ws)[0]);
    const rest = this.conns(ws);
    const ev = presenceOnClose(rest, id);
    if (ev) broadcast(rest, ev);
  }

  webSocketClose(ws: WebSocket): void {
    this.gone(ws);
    try { ws.close(); } catch { /* already closed */ }
  }

  webSocketError(ws: WebSocket): void {
    this.gone(ws);
  }
}
