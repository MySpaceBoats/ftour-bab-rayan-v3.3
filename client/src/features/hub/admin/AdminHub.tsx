import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import RequireRole from "@/components/RequireRole";
import * as hub from "../api";
import MarketAdmin from "./MarketAdmin";
import StayAdmin from "./StayAdmin";

export default function AdminHub() {
  const [reports, setReports] = useState<hub.Report[]>([]);
  const [members, setMembers] = useState<hub.AdminMember[]>([]);
  const [announce, setAnnounce] = useState("");
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [r, m] = await Promise.allSettled([hub.adminReports(), hub.adminMembers()]);
    if (r.status === "fulfilled") setReports(r.value); else toast.error((r.reason as Error).message);
    if (m.status === "fulfilled") setMembers(m.value); else toast.error((m.reason as Error).message);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <RequireRole route="/admin/hub">
    <div className="space-y-8 p-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Publier une annonce</h2>
        <Textarea value={announce} onChange={e => setAnnounce(e.target.value)} maxLength={2000} rows={3} placeholder="Annonce visible par tous les bénévoles" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Épingler en haut du fil</label>
        <Button disabled={busy || !announce.trim()} onClick={() => run(async () => { await hub.adminAnnounce(announce, pinned); setAnnounce(""); }, "Annonce publiée")}>Publier</Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Signalements ({reports.length})</h2>
        {!loading && reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
        {reports.map(r => (
          <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
            <p><strong>{r.target_type === "post" ? "Publication" : "Commentaire"} #{r.target_id}</strong> — signalé par {r.reporter} : « {r.reason} »</p>
            <p className="whitespace-pre-wrap break-words rounded bg-muted p-2">{r.body ?? "(contenu supprimé)"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy || r.target_status === "hidden"} onClick={() => window.confirm("Masquer ce contenu ?") && run(() => hub.adminHide(r.target_type, r.target_id), "Contenu masqué")}>
                {r.target_status === "hidden" ? "Déjà masqué" : "Masquer"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => hub.adminDismiss(r.id))}>Ignorer</Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Membres ({members.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Nom</th><th className="p-2">Email</th><th className="p-2">Rôle</th><th className="p-2">Statut</th><th className="p-2" /></tr></thead>
            <tbody>
              {!loading && members.length === 0 && <tr><td colSpan={5} className="p-2 text-muted-foreground">Aucun membre pour l'instant.</td></tr>}
              {members.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.display_name}</td>
                  <td className="p-2">{m.email}</td>
                  <td className="p-2">{m.role}</td>
                  <td className="p-2">{m.status}</td>
                  <td className="p-2 space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => hub.adminUpdateMember(m.id, { role: m.role === "moderator" ? "member" : "moderator" }))}>
                      {m.role === "moderator" ? "Retirer modérateur" : "Nommer modérateur"}
                    </Button>
                    <Button size="sm" disabled={busy} variant={m.status === "active" ? "destructive" : "default"} onClick={() => (m.status !== "active" || window.confirm(`Suspendre ${m.display_name} ?`)) && run(() => hub.adminUpdateMember(m.id, { status: m.status === "active" ? "suspended" : "active" }))}>
                      {m.status === "active" ? "Suspendre" : "Réactiver"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <MarketAdmin />
      <StayAdmin />
    </div>
    </RequireRole>
  );
}
