import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute, useSearch } from "wouter";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";

const POLL_MS = 10_000;

export default function ProConversationPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/pro/messages/:threadId");
  const apply = new URLSearchParams(useSearch()).get("postuler") === "1";
  const threadId = Number(params?.threadId);
  const base = `/${lang}/benevole/espace/pro`;
  const [data, setData] = useState<api.Conversation | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const prefilled = useRef(false);
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getMessages(threadId);
      setData(r);
      if (r.messages.some(m => m.sender_id !== me?.id && !m.read_at)) api.markRead(threadId).catch(() => undefined);
    } catch { setData(null); }
  }, [threadId, me?.id]);

  // ponytail: polling every 10 s instead of websockets; fine for a small community
  useEffect(() => {
    if (!me || !Number.isSafeInteger(threadId)) return;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [me, threadId, load]);

  // "Postuler": pre-fill once, only when the conversation is still empty
  useEffect(() => {
    if (apply && data && !prefilled.current && data.messages.length === 0 && data.job) {
      prefilled.current = true;
      setDraft(`Bonjour, je suis intéressé(e) par l'offre « ${data.job.title} ». Pouvons-nous échanger ?`);
    }
  }, [apply, data]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (!me || data === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (data === null) return <ProLayout me={me} active="messages"><p className="rounded-xl bg-white p-8 text-center text-slate-600">Discussion introuvable. <Link href={`${base}/messages`} className="text-blue-700 underline">Messages</Link></p></ProLayout>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    // ref guard: state `busy` alone can lag behind a fast double Enter
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    try { await api.sendMessage(threadId, draft); setDraft(""); await load(); } catch (err) { toast.error((err as Error).message); } finally { sending.current = false; setBusy(false); }
  };

  return (
    <ProLayout me={me} active="messages">
      <Link href={`${base}/messages`} className="text-sm text-blue-700 underline">← Messages</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-200 p-3">
          <Avatar name={data.other.display_name} src={data.other.avatar} size={40} />
          <div className="min-w-0">
            <Link href={`${base}/membre/${data.other.id}`} className="font-semibold text-slate-900 hover:underline">{data.other.display_name}</Link>
            {data.job && <Link href={`${base}/emplois/${data.job.id}`} className="block truncate text-xs text-blue-700 underline">Offre : {data.job.title}</Link>}
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
    </ProLayout>
  );
}
