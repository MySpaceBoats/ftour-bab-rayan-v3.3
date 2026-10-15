import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as ai from "../../ai/ai-api";

const ROLE = { user: "Membre", assistant: "Assistant", admin: "Équipe" } as const;

/** « Dossiers IA »: conversations escalated by the assistant. Read, answer (the member gets a bell notification), close. */
export default function AiAdmin() {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [cases, setCases] = useState<ai.AiCaseRow[]>([]);
  const [detail, setDetail] = useState<ai.AiCaseDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setCases(await ai.adminCases(status)); } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }, [status]);
  useEffect(() => { reload(); }, [reload]);

  const open = async (id: number) => {
    try { setDetail(await ai.adminCase(id)); setReply(""); } catch (e) { toast.error((e as Error).message); }
  };
  const run = async (fn: () => Promise<unknown>, ok: string, then?: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast.success(ok); await then?.(); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dossiers IA</h2>
        <div className="flex gap-1">
          {(["open", "closed"] as const).map(s => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => { setStatus(s); setDetail(null); }}>{s === "open" ? "Ouverts" : "Clos"}</Button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">Chargement…</p> : cases.length === 0 ? <p className="text-sm text-slate-500">Aucun dossier.</p> : (
        <ul className="divide-y rounded-lg border bg-white">
          {cases.map(c => (
            <li key={c.id}>
              <button onClick={() => open(c.id)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                <span className="font-medium">{c.member_name}</span> <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString("fr-FR")}</span>
                <span className="block whitespace-pre-line text-slate-600">{c.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {detail && (
        <div className="space-y-2 rounded-lg border bg-white p-3">
          <p className="text-sm font-semibold">Dossier #{detail.id} — {detail.member_name}</p>
          {detail.context && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{detail.context}</pre>}
          <ul className="max-h-72 space-y-1 overflow-auto text-sm">
            {detail.messages.map(m => <li key={m.id}><span className="font-medium">{ROLE[m.role]} :</span> <span className="whitespace-pre-line">{m.body}</span></li>)}
          </ul>
          {detail.status === "open" && (
            <>
              <Textarea value={reply} onChange={e => setReply(e.target.value)} maxLength={2000} placeholder="Réponse au membre…" />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !reply.trim()} onClick={() => run(() => ai.adminReply(detail.id, reply.trim()), "Réponse envoyée", () => open(detail.id))}>Répondre</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => ai.adminClose(detail.id), "Dossier clos", async () => setDetail(null))}>Clore</Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
