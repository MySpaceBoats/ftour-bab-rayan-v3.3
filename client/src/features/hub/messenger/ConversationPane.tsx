import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Avatar from "../components/Avatar";
import { HubApiError, type Member } from "../api";
import type { InboxSource } from "../pro/pro-api";
import { sendTyping } from "./chat-socket";
import PresenceDot from "./PresenceDot";
import { ADAPTERS, type Convo } from "./sources";
import { useChat } from "./useChat";

const TYPING_SHOW_MS = 4000;
const TYPING_SEND_MS = 2500;

export default function ConversationPane({ me, source, id, base, onActivity }: {
  me: Member; source: InboxSource; id: number; base: string; onActivity: () => void;
}) {
  const adapter = ADAPTERS[source];
  const apply = new URLSearchParams(useSearch()).get("postuler") === "1";
  const [data, setData] = useState<Convo | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const prefilled = useRef(false);
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);
  const hasData = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTypingSent = useRef(0);
  const otherId = useRef<number | null>(null);

  const load = useCallback(async () => {
    const mine = ++reqId.current;
    try {
      const r = await adapter.load(id);
      if (mine !== reqId.current) return;
      hasData.current = true;
      otherId.current = r.other.id;
      setData(r);
      if (r.messages.some(m => m.sender_id !== me.id && !m.read_at)) adapter.read(id).then(onActivity).catch(() => undefined);
    } catch (e) {
      if (mine !== reqId.current) return;
      if (e instanceof HubApiError && e.status === 404) { hasData.current = false; setData(null); }
      else if (!hasData.current) toast.error((e as Error).message);
    }
  }, [adapter, id, me.id, onActivity]);

  const { isOnline, connected } = useChat(e => {
    if (e.type === "message" && e.source === source && e.thread_id === id) load();
    if (e.type === "typing" && e.source === source && e.thread_id === id && e.from === otherId.current) {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), TYPING_SHOW_MS);
    }
  });

  // new conversation: reset local state (the parent also remounts this pane per thread via `key`)
  useEffect(() => {
    hasData.current = false;
    otherId.current = null;
    prefilled.current = false;
    setData(undefined);
    setDraft("");
    setTyping(false);
    load();
    return () => clearTimeout(typingTimer.current);
  }, [source, id, load]);

  // push does the instant work; polling is the safety net (and the only path when the socket is down)
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(); }, connected ? 30_000 : 5_000);
    return () => clearInterval(t);
  }, [connected, load]);

  // "Postuler": pre-fill once, only when the conversation is still empty
  useEffect(() => {
    if (apply && source === "pro" && data && !prefilled.current && data.messages.length === 0 && data.context) {
      prefilled.current = true;
      setDraft(`Bonjour, je suis intéressé(e) par l'offre « ${data.context} ». Pouvons-nous échanger ?`);
    }
  }, [apply, source, data]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (data === undefined) return <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (data === null) return <p className="rounded-xl bg-white p-8 text-center text-slate-600">Discussion introuvable. <Link href={`${base}/messages`} className="text-blue-700 underline">Messages</Link></p>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    // ref guard: state `busy` alone can lag behind a fast double Enter
    const text = draft;
    if (!text.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    try { await adapter.send(id, text); setDraft(d => (d === text ? "" : d)); await load(); onActivity(); } catch (err) { toast.error((err as Error).message); } finally { sending.current = false; setBusy(false); }
  };
  const onType = (v: string) => {
    setDraft(v);
    const t = Date.now();
    if (v && t - lastTypingSent.current > TYPING_SEND_MS) { lastTypingSent.current = t; sendTyping(data.other.id, source, id); }
  };
  const online = isOnline(data.other.id);

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100vh-9rem)]">
      <header className="flex items-center gap-3 border-b border-slate-200 p-3">
        <span className="relative shrink-0"><Avatar name={data.other.display_name} src={data.other.avatar} size={40} /><PresenceDot online={online} className="absolute -bottom-0.5 -right-0.5" /></span>
        <div className="min-w-0">
          <Link href={`${base}/pro/membre/${data.other.id}`} className="font-semibold text-slate-900 hover:underline">{data.other.display_name}</Link>
          <p className="text-xs" aria-live="polite">
            {typing ? <span className="text-blue-700">écrit…</span> : <span className={online ? "text-emerald-700" : "text-slate-500"}>{online ? "En ligne" : "Hors ligne"}</span>}
          </p>
          {data.context && (
            <p className="truncate text-xs text-slate-500">
              {data.context}{data.link && <> · <Link href={`${base}/${data.link.path}`} className="text-blue-700 underline">{data.link.label}</Link></>}
            </p>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {data.messages.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun message. Dites bonjour !</p>}
        {data.messages.map(m => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? "bg-blue-700 text-white" : "bg-white text-slate-900 shadow-sm"}`}>{m.body}</p>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {data.closed ? (
        <p className="border-t border-slate-200 p-3 text-center text-sm text-slate-500">Cette demande est close.</p>
      ) : (
        <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
          <Input aria-label="Votre message" value={draft} maxLength={1000} onChange={e => onType(e.target.value)} placeholder="Écrivez un message…" className="rounded-full" />
          <Button type="submit" aria-label="Envoyer" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !draft.trim()}><Send size={16} /></Button>
        </form>
      )}
    </div>
  );
}
