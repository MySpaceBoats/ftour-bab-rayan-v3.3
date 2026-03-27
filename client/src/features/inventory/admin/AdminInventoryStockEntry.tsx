import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, QrCode, Search, RefreshCw, Eye, Power } from "lucide-react";
import QrImage from "@/shared/components/QrImage";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SCANNER_CONFIG_KEY = "inventory-scanner-config";

function qrUrl(slug: string) {
  return `${window.location.origin}/stock-entry/${slug}`;
}

export default function AdminInventoryStockEntry() {
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState<string>("none");
  const [posLocationId, setPosLocationId] = useState<string>("none");
  const { data, isLoading, refetch } =
    trpc.inventory.stockEntry.listProducts.useQuery({ search, isActive: true });
  const { data: history } = trpc.inventory.stockEntry.history.useQuery({
    limit: 20,
  });
  const { data: events } = trpc.inventory.events.list.useQuery({});
  const parsedEventId = eventId !== "none" ? Number(eventId) : undefined;
  const { data: posLocations } = trpc.inventory.locations.list.useQuery(
    { type: "POS", eventId: parsedEventId, isActive: true },
    { enabled: !!parsedEventId }
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCANNER_CONFIG_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        eventId?: number;
        posLocationId?: number;
      };
      if (parsed.eventId) setEventId(String(parsed.eventId));
      if (parsed.posLocationId) setPosLocationId(String(parsed.posLocationId));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    const payload = {
      eventId: eventId !== "none" ? Number(eventId) : null,
      posLocationId: posLocationId !== "none" ? Number(posLocationId) : null,
    };
    localStorage.setItem(SCANNER_CONFIG_KEY, JSON.stringify(payload));
  }, [eventId, posLocationId]);

  const selectedEventName = useMemo(
    () =>
      (events ?? []).find((e: any) => String(e.id) === eventId)?.name ?? null,
    [events, eventId]
  );
  const selectedPosName = useMemo(
    () =>
      (posLocations ?? []).find((p: any) => String(p.id) === posLocationId)
        ?.name ?? null,
    [posLocations, posLocationId]
  );

  const regenerate = trpc.inventory.stockEntry.regenerateQr.useMutation({
    onSuccess: () => {
      toast.success("QR régénéré");
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const toggle = trpc.inventory.stockEntry.setQrEnabled.useMutation({
    onSuccess: () => {
      toast.success("Statut QR mis à jour");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const products = data?.products ?? [];

  const downloadQr = async (name: string, slug: string) => {
    const dataUrl = await QRCode.toDataURL(qrUrl(slug), {
      margin: 2,
      width: 360,
      errorCorrectionLevel: "H",
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-entree-stock-${name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.click();
  };

  const printOne = async (slug: string) => {
    const url = qrUrl(slug);
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: "H",
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><body style='font-family:sans-serif;padding:24px'><h2>QR Entrée Stock</h2><img src='${dataUrl}'/><p>${url}</p><script>window.print()</script></body></html>`
    );
    w.document.close();
  };

  return (
    <RequireRole route="/admin/inventory/stock-entry">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <QrCode className="h-6 w-6 text-green-700" />
              QR Entrée Stock
            </h1>
            <p className="text-sm text-muted-foreground">
              Flux logistique séparé du QR catalogue de vente.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/inventory">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Inventory
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimer planche
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration du scanner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La configuration est sauvegardée sur cet appareil. Lors d’un scan
              QR d’entrée stock, l’événement et le point de vente seront
              affectés automatiquement.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Événement</Label>
                <Select
                  value={eventId}
                  onValueChange={value => {
                    setEventId(value);
                    setPosLocationId("none");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un événement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {(events ?? []).map((event: any) => (
                      <SelectItem key={event.id} value={String(event.id)}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Point de vente (POS)</Label>
                <Select
                  value={posLocationId}
                  onValueChange={setPosLocationId}
                  disabled={eventId === "none"}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        eventId === "none"
                          ? "Choisir d’abord un événement"
                          : "Sélectionner un POS"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {(posLocations ?? []).map((pos: any) => (
                      <SelectItem key={pos.id} value={String(pos.id)}>
                        {pos.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={selectedEventName ? "default" : "outline"}>
                Événement: {selectedEventName ?? "Non configuré"}
              </Badge>
              <Badge variant={selectedPosName ? "default" : "outline"}>
                POS: {selectedPosName ?? "Non configuré"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher produit / SKU"
              className="max-w-md"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p: any) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{p.category || "—"}</Badge>
                  <Badge variant="secondary">
                    Stock global: {p.global_stock}
                  </Badge>
                  <Badge
                    variant={
                      p.stock_entry_qr_enabled ? "default" : "destructive"
                    }
                  >
                    {p.stock_entry_qr_enabled ? "QR actif" : "QR inactif"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  SKU: {p.sku || "—"}
                </p>
                <QrImage
                  data={qrUrl(p.stock_entry_qr_slug)}
                  size={220}
                  alt={`QR entrée stock ${p.name}`}
                  className="w-28 h-28 border rounded"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/admin/inventory/stock-entry/${p.id}`}>
                    <Button size="sm" variant="outline">
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void downloadQr(p.name, p.stock_entry_qr_slug)
                    }
                  >
                    Télécharger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void printOne(p.stock_entry_qr_slug)}
                  >
                    Imprimer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => regenerate.mutate({ productId: p.id })}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Régénérer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toggle.mutate({
                        productId: p.id,
                        enabled: !p.stock_entry_qr_enabled,
                      })
                    }
                  >
                    <Power className="h-3 w-3 mr-1" />
                    {p.stock_entry_qr_enabled ? "Désactiver" : "Activer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historique des entrées QR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(history ?? []).map((m: any) => (
              <div key={m.id} className="border-b pb-2">
                {new Date(m.created_at).toLocaleString("fr-FR")} •{" "}
                {m.inventory_products?.name} • +{m.quantity} • {m.movement_type}{" "}
                • source {m.reference_type}
              </div>
            ))}
            {!isLoading && !history?.length && (
              <p className="text-muted-foreground">Aucune entrée QR.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </RequireRole>
  );
}
