import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as hub from "../api";

const LABEL = { hidden: "Masqué", flagged: "À vérifier", restored: "Restauré", error: "Erreur d'analyse" } as const;

/** « Modération IA »: decisions taken by the AI on feed posts and comments. Restore a mistaken hide, or confirm a violation. */
export default function ModerationAdmin() {
  const [filter, setFilter] = useState<"review" | "all">("review");
  const [items, setItems] = useState<hub.ModerationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setItems(await hub.adminModeration(filter)); } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }, [filter]);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Modération IA</h2>
        <div className="flex gap-1">
          {(["review", "all"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "review" ? "À revoir" : "Toutes"}</Button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">Chargement…</p> : items.length === 0 ? <p className="text-sm text-slate-500">Aucune décision.</p> : (
        <ul className="divide-y rounded-lg border bg-white">
          {items.map(i => (
            <li key={i.id} className="space-y-1 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.author}</span>
                <span className="text-xs text-slate-500">{i.target_type === "post" ? "publication" : "commentaire"} · {new Date(i.created_at).toLocaleString("fr-FR")}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{LABEL[i.action]}</span>
                {i.rule && <span className="text-xs text-slate-600">{i.rule}{i.confidence != null ? ` · ${Math.round(i.confidence * 100)} %` : ""}</span>}
              </div>
              {i.reason && <p className="text-slate-600">{i.reason}</p>}
              {i.excerpt && <p className="whitespace-pre-line rounded bg-slate-50 p-2 text-xs">{i.excerpt}</p>}
              {(i.action === "hidden" || i.action === "flagged") && !i.reviewed_at && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => hub.adminModerationRestore(i.id), i.action === "hidden" ? "Contenu restauré" : "Signalement ignoré")}>
                    {i.action === "hidden" ? "Restaurer" : "Ignorer"}
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => run(() => hub.adminModerationConfirm(i.id), i.action === "hidden" ? "Décision confirmée" : "Contenu masqué")}>
                    {i.action === "hidden" ? "Confirmer" : "Masquer"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
