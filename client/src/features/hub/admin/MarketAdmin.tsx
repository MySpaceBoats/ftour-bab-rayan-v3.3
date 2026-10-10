import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as mk from "../market/market-api";
import { price } from "../market/format";

export default function MarketAdmin() {
  const [listings, setListings] = useState<mk.AdminListing[]>([]);
  const [reports, setReports] = useState<mk.MkReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [l, r] = await Promise.allSettled([mk.adminListings(), mk.adminMarketReports()]);
    if (l.status === "fulfilled") setListings(l.value); else toast.error((l.reason as Error).message);
    if (r.status === "fulfilled") setReports(r.value); else toast.error((r.reason as Error).message);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Marketplace : signalements ({reports.length})</h2>
        {!loading && reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
        {reports.map(r => (
          <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
            <p><strong>{r.target_type === "listing" ? "Annonce" : "Commentaire"} #{r.target_id}</strong> — signalé par {r.reporter} : « {r.reason} »</p>
            <p className="whitespace-pre-wrap break-words rounded bg-muted p-2">{r.body ?? "(contenu supprimé)"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy || r.target_status === "hidden"} onClick={() => window.confirm("Masquer ce contenu ?") && run(() => mk.adminMarketHide(r.target_type, r.target_id), "Contenu masqué")}>
                {r.target_status === "hidden" ? "Déjà masqué" : "Masquer"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => mk.adminMarketDismiss(r.id))}>Ignorer</Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Marketplace : annonces ({listings.length})</h2>
        {!loading && listings.length === 0 && <p className="text-sm text-muted-foreground">Aucune annonce.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Titre</th><th className="p-2">Vendeur</th><th className="p-2">Prix</th><th className="p-2">Statut</th><th className="p-2" /></tr></thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-2 break-words">{l.title}</td>
                  <td className="p-2">{l.seller}</td>
                  <td className="p-2 whitespace-nowrap">{price(l.price)}</td>
                  <td className="p-2">{l.status}</td>
                  <td className="p-2">
                    <Button size="sm" variant="destructive" disabled={busy || l.status === "hidden"} onClick={() => window.confirm(`Masquer l'annonce « ${l.title} » ?`) && run(() => mk.adminMarketHide("listing", l.id), "Annonce masquée")}>Masquer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
