import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, X } from "lucide-react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import * as ai from "../../ai/ai-api";

const key = (c: ai.Choice) => `${c.source}/${c.id}`;

/** Floating assistant of the volunteer hub: support + dispute mediation. Stays a small window on every hub page. */
export default function AssistantWidget({ open, onOpenChange, conversationId }: { open: boolean; onOpenChange: (o: boolean) => void; conversationId: number | null }) {
  const [items, setItems] = useState<ai.Choice[]>([]);
  const [pick, setPick] = useState("");
  const [convId, setConvId] = useState<number | null>(conversationId);
  const [msgs, setMsgs] = useState<ai.AiMsg[]>([]);
  const [caseOpen, setCaseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (conversationId) setConvId(conversationId); }, [conversationId]);
  const load = useCallback(async (id: number) => {
    const c = await ai.conversation(id);
    setMsgs(c.messages);
    setCaseOpen(c.case?.status === "open");
    if (c.source && c.item_id) setPick(`${c.source}/${c.item_id}`);
  }, []);
  useEffect(() => { if (open) ai.choices().then(setItems).catch(e => toast.error((e as Error).message)); }, [open]);
  useEffect(() => { if (open && convId) load(convId).catch(e => { toast.error((e as Error).message); setConvId(null); }); }, [open, convId, load]);
  // an admin may answer at any time: refresh while a case is open
  useEffect(() => {
    if (!open || !convId || !caseOpen) return;
    const t = setInterval(() => { if (!document.hidden) load(convId).catch(() => undefined); }, 20_000);
    return () => clearInterval(t);
  }, [open, convId, caseOpen, load]);

  const send = async (message: string) => {
    if (busy) return;
    setBusy(true);
    setMsgs(m => [...m, { role: "user", body: message }]);
    try {
      const chosen = items.find(i => key(i) === pick);
      const r = await ai.chat(convId ? { message, conversation_id: convId } : { message, ...(chosen ? { source: chosen.source, item_id: chosen.id } : {}) });
      setConvId(r.conversation_id);
      await load(r.conversation_id);
      if (r.escalated) toast.success("Votre demande a été envoyée au support.");
    } catch (e) {
      toast.error((e as Error).message);
      if (convId) load(convId).catch(() => undefined); else setMsgs([]);
    } finally { setBusy(false); }
  };

  const escalate = async () => {
    if (!convId || busy) return;
    setBusy(true);
    try { await ai.escalate(convId); setCaseOpen(true); toast.success("Votre demande a été envoyée au support."); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const shown: Message[] = msgs.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.role === "admin" ? `Équipe : ${m.body}` : m.body }));
  const pos = "fixed bottom-20 left-3 z-50 lg:bottom-5 lg:left-5";

  if (!open) {
    return (
      <button onClick={() => onOpenChange(true)} aria-label="Assistant IA" className={`${pos} flex h-12 w-12 items-center justify-center rounded-full bg-blue-800 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2`}>
        <Sparkles size={22} aria-hidden />
      </button>
    );
  }
  return (
    <div className={`${pos} flex max-h-[80vh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96`} role="dialog" aria-label="Assistant IA">
      <div className="flex items-center justify-between bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
        Assistant IA
        <button onClick={() => onOpenChange(false)} aria-label="Réduire" className="rounded p-1 hover:bg-blue-700"><X size={16} aria-hidden /></button>
      </div>
      <div className="space-y-2 overflow-y-auto p-3">
        <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
          Conversation lue par l'assistant IA et, en cas d'escalade, par l'équipe. Ne partagez pas de mot de passe.
        </p>
        <label className="block text-xs font-medium">
          Problème avec…
          <select value={pick} onChange={e => setPick(e.target.value)} disabled={!!convId} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60">
            <option value="">Question générale</option>
            {items.map(i => <option key={key(i)} value={key(i)}>{i.label}</option>)}
          </select>
        </label>
        <AIChatBox messages={shown} onSendMessage={send} isLoading={busy} placeholder="Votre question ou le problème…" height="320px"
          emptyStateMessage="Posez une question sur l'espace ou décrivez un conflit : je vous aide et, si besoin, je préviens l'équipe."
          suggestedPrompts={convId ? undefined : ["Comment fonctionne la Marketplace ?", "Un bénévole ne répond plus à mes messages"]} />
        {caseOpen
          ? <p className="text-xs text-slate-600">L'équipe suit votre dossier. Vos messages lui sont transmis.</p>
          : <Button variant="outline" size="sm" onClick={escalate} disabled={!convId || busy}>Contacter un administrateur</Button>}
      </div>
    </div>
  );
}
