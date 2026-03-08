import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import { trpc } from "@/lib/trpc";
import QrImage from "@/shared/components/QrImage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ENTRY_TYPES = ["PURCHASE_IN", "DONATION_IN", "PRODUCTION_IN", "INITIAL_LOAD"] as const;

export default function AdminInventoryStockEntryProduct() {
  const [, params] = useRoute("/admin/inventory/stock-entry/:productId");
  const productId = Number(params?.productId || 0);

  const [qty, setQty] = useState("");
  const [entryType, setEntryType] = useState<(typeof ENTRY_TYPES)[number]>("PURCHASE_IN");
  const [note, setNote] = useState("");

  useEffect(() => {
    const previous = localStorage.getItem("stock-entry:last-type");
    if (previous && ENTRY_TYPES.includes(previous as any)) setEntryType(previous as any);
  }, []);

  const { data, refetch } = trpc.inventory.stockEntry.getProductDetail.useQuery({ productId }, { enabled: productId > 0 });
  const submit = trpc.inventory.stockEntry.submit.useMutation({
    onSuccess: () => {
      toast.success("Entrée stock enregistrée. Le stock global a été mis à jour.");
      setQty("");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const onSubmit = () => {
    const q = Number(qty);
    if (!Number.isInteger(q) || q <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    localStorage.setItem("stock-entry:last-type", entryType);
    submit.mutate({ productId, qty: q, entryType, note, reason: "Entrée via QR stock" });
  };

  return (
    <RequireRole route="/admin/inventory/stock-entry">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Entrée Stock Produit</h1>
          <Link href="/admin/inventory/stock-entry"><Button variant="outline">Retour liste</Button></Link>
        </div>

        <Card>
          <CardHeader><CardTitle>{data?.product?.name ?? "Produit"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Catégorie: {data?.product?.category || "—"}</p>
            <p>SKU: {data?.product?.sku || "—"}</p>
            <p className="font-semibold">Stock global actuel: {data?.globalStock ?? 0}</p>
            <QrImage data={`${window.location.origin}/stock-entry/${data?.product?.stock_entry_qr_slug || ""}`} size={220} className="w-32 h-32 border rounded" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ajouter au stock global</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Quantité reçue</Label>
              <Input autoFocus inputMode="numeric" value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ""))} placeholder="ex: 24" />
            </div>
            <div>
              <Label>Type d'entrée</Label>
              <select className="w-full border rounded h-10 px-3" value={entryType} onChange={e => setEntryType(e.target.value as any)}>
                {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Note / motif</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optionnel" />
            </div>
            <Button onClick={onSubmit} disabled={submit.isPending}>Valider l'entrée</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dernières entrées QR</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {(data?.history ?? []).map((h: any) => (
              <div key={h.id} className="border-b pb-2">{new Date(h.created_at).toLocaleString("fr-FR")} • +{h.quantity} • {h.movement_type} • {h.note || h.reason || "—"}</div>
            ))}
          </CardContent>
        </Card>
      </div>
    </RequireRole>
  );
}
