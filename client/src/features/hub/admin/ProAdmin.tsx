import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as api from "../pro/pro-api";

const KIND = { post: "Publication", comment: "Commentaire", job: "Offre" } as const;

export default function ProAdmin() {
  const [reports, setReports] = useState<api.ProReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setReports(await api.adminReports()); } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Pro : signalements ({reports.length})</h2>
      {!loading && reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
      {reports.map(r => (
        <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
          <p><strong>{KIND[r.target_type]} #{r.target_id}</strong> — signalé par {r.reporter} : « {r.reason} »</p>
          <p className="whitespace-pre-wrap break-words rounded bg-muted p-2">{r.body ?? "(contenu supprimé)"}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy || r.target_status === "hidden"} onClick={() => window.confirm("Masquer ce contenu ?") && run(() => api.adminHide(r.target_type, r.target_id), "Contenu masqué")}>
              {r.target_status === "hidden" ? "Déjà masqué" : "Masquer"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.adminDismiss(r.id))}>Ignorer</Button>
          </div>
        </div>
      ))}
    </section>
  );
}
