import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import HubShell from "../components/HubShell";
import { useHubMember } from "../useHubMember";
import * as ai from "../../ai/ai-api";

const key = (c: ai.Choice) => `${c.source}/${c.id}`;

/** « Assistant »: support + médiation. Pick a conversation to get help with (or none), chat, escalate to an admin. */
export default function AssistantPage() {
  const me = useHubMember();
  const [items, setItems] = useState<ai.Choice[]>([]);
  const [pick, setPick] = useState("");
  const [convId, setConvId] = useState<number | null>(() => Number(new URLSearchParams(window.location.search).get("c")) || null);
  const [msgs, setMsgs] = useState<ai.AiMsg[]>([]);
  const [caseOpen, setCaseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    const c = await ai.conversation(id);
    setMsgs(c.messages);
    setCaseOpen(c.case?.status === "open");
    if (c.source && c.item_id) setPick(`${c.source}/${c.item_id}`);
  }, []);
  useEffect(() => { if (me) ai.choices().then(setItems).catch(e => toast.error((e as Error).message)); }, [me]);
  useEffect(() => { if (me && convId) load(convId).catch(e => { toast.error((e as Error).message); setConvId(null); }); }, [me, convId, load]);
  // an admin may answer at any time: refresh while a case is open
  useEffect(() => {
    if (!convId || !caseOpen) return;
    const t = setInterval(() => { if (!document.hidden) load(convId).catch(() => undefined); }, 20_000);
    return () => clearInterval(t);
  }, [convId, caseOpen, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const send = async (message: string) => {
    if (busy) return;
    setBusy(true);
    setMsgs(m => [...m, { role: "user", body: message }]);
    try {
      const chosen = items.find(i => key(i) === pick);
      const r = await ai.chat(convId ? { message, conversation_id: convId } : { message, ...(chosen ? { source: chosen.source, item_id: chosen.id } : {}) });
      setConvId(r.conversation_id);
      await load(r.conversation_id);
      if (r.escalated) toast.success("Un administrateur a été prévenu.");
    } catch (e) {
      toast.error((e as Error).message);
      if (convId) load(convId).catch(() => undefined); else setMsgs([]);
    } finally { setBusy(false); }
  };

  const escalate = async () => {
    if (!convId || busy) return;
    setBusy(true);
    try { await ai.escalate(convId); setCaseOpen(true); toast.success("Un administrateur a été prévenu."); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const shown: Message[] = msgs.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.role === "admin" ? `**Équipe :** ${m.body}` : m.body }));

  return (
    <HubShell me={me}>
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-xl font-bold">Assistant</h1>
        <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          Cette conversation est lue par l'assistant IA et, en cas d'escalade, par un administrateur. Ne partagez pas de mot de passe.
        </p>
        <label className="block text-sm font-medium">
          Problème avec…
          <select value={pick} onChange={e => setPick(e.target.value)} disabled={!!convId} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60">
            <option value="">Question générale</option>
            {items.map(i => <option key={key(i)} value={key(i)}>{i.label}</option>)}
          </select>
        </label>
        <AIChatBox messages={shown} onSendMessage={send} isLoading={busy} placeholder="Décrivez votre question ou le problème…" height="460px"
          emptyStateMessage="Posez une question sur l'espace ou décrivez un conflit : je vous aide et, si besoin, je préviens un administrateur."
          suggestedPrompts={convId ? undefined : ["Comment fonctionne la Marketplace ?", "Un bénévole ne répond plus à mes messages", "Comment annuler ma demande de séjour ?"]} />
        {caseOpen
          ? <p className="text-sm text-slate-600">Un administrateur suit votre dossier. Vos messages lui sont transmis.</p>
          : <Button variant="outline" size="sm" onClick={escalate} disabled={!convId || busy}>Contacter un administrateur</Button>}
      </div>
    </HubShell>
  );
}
