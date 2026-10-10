import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";

const POLL_MS = 10_000;

export default function ConversationPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/marketplace/messages/:threadId");
  const threadId = Number(params?.threadId);
  const base = `/${lang}/benevole/espace/marketplace`;
  const [data, setData] = useState<Awaited<ReturnType<typeof mk.listMessages>> | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await mk.listMessages(threadId);
      setData(r);
      if (r.messages.some(m => m.sender_id !== me?.id && !m.read_at)) mk.markRead(threadId).catch(() => undefined);
    } catch {
      setData(null);
    }
  }, [threadId, me?.id]);

  // ponytail: polling every 10 s instead of websockets; fine for a small community
  useEffect(() => {
    if (!me || !Number.isSafeInteger(threadId)) return;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [me, threadId, load]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (!me || data === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (data === null) return <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Discussion introuvable. <Link href={`${base}/messages`} className="text-blue-700 underline">Mes messages</Link></p></HubShell>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    // ref guard: state `busy` alone can lag behind a fast double Enter
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    try { await mk.sendMessage(threadId, draft); setDraft(""); await load(); } catch (err) { toast.error((err as Error).message); } finally { sending.current = false; setBusy(false); }
  };

  return (
    <HubShell me={me}>
      <Link href={`${base}/messages`} className="text-sm text-blue-700 underline">← Mes messages</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-200 p-3">
          <Avatar name={data.other.display_name} src={data.other.avatar} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{data.other.display_name}</p>
            <Link href={`${base}/${data.listing.id}`} className="block truncate text-xs text-blue-700 underline">{data.listing.title}</Link>
          </div>
        </header>
        <div className="max-h-[60vh] min-h-[16rem] space-y-2 overflow-y-auto bg-slate-50 p-3">
          {data.nextCursor !== null && <p className="text-center text-xs text-slate-400">Messages plus anciens non affichés</p>}
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
        <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
          <Input aria-label="Votre message" value={draft} maxLength={1000} onChange={e => setDraft(e.target.value)} placeholder="Écrivez un message…" className="rounded-full" />
          <Button type="submit" aria-label="Envoyer" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !draft.trim()}><Send size={16} /></Button>
        </form>
      </div>
    </HubShell>
  );
}
