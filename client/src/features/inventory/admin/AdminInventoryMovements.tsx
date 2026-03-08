import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, History, Filter, SlidersHorizontal, Plus, Minus } from "lucide-react";

const MOVEMENT_TYPES = [
  { value: "INITIAL_LOAD",     label: "Chargement initial" },
  { value: "PURCHASE_IN",      label: "Achat / Réception" },
  { value: "DONATION_IN",      label: "Don reçu" },
  { value: "PRODUCTION_IN",    label: "Production interne" },
  { value: "TRANSFER_OUT",     label: "Transfert sortant" },
  { value: "TRANSFER_IN",      label: "Transfert entrant" },
  { value: "SALE",             label: "Vente" },
  { value: "RETURN_IN",        label: "Retour entrant" },
  { value: "RETURN_OUT",       label: "Retour sortant" },
  { value: "ADJUSTMENT_PLUS",  label: "Ajustement +" },
  { value: "ADJUSTMENT_MINUS", label: "Ajustement -" },
];

const TYPE_COLORS: Record<string, string> = {
  INITIAL_LOAD:    "bg-gray-100 text-gray-700",
  PURCHASE_IN:     "bg-blue-100 text-blue-700",
  DONATION_IN:     "bg-blue-100 text-blue-700",
  PRODUCTION_IN:   "bg-blue-100 text-blue-700",
  TRANSFER_OUT:    "bg-amber-100 text-amber-700",
  TRANSFER_IN:     "bg-amber-100 text-amber-700",
  SALE:            "bg-red-100 text-red-700",
  RETURN_IN:       "bg-green-100 text-green-700",
  RETURN_OUT:      "bg-green-100 text-green-700",
  ADJUSTMENT_PLUS: "bg-purple-100 text-purple-700",
  ADJUSTMENT_MINUS:"bg-purple-100 text-purple-700",
};

const IS_OUTGOING = new Set(['SALE', 'TRANSFER_OUT', 'RETURN_OUT', 'ADJUSTMENT_MINUS']);

const PAGE_SIZE = 30;

// Ajustement modal
const emptyAdjustForm = { productId: "", locationId: "", delta: "0", reason: "", note: "" };

export default function AdminInventoryMovements() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    movementType: "",
    dateFrom: "",
    dateTo: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [addStockMode, setAddStockMode] = useState(false);
  const [addStockForm, setAddStockForm] = useState({ productId: "", locationId: "", quantity: "", movementType: "INITIAL_LOAD", reason: "" });

  const { data: products } = trpc.inventory.products.list.useQuery({ isActive: true }, { staleTime: 60_000 });
  const { data: locations } = trpc.inventory.locations.list.useQuery({ isActive: true }, { staleTime: 60_000 });

  const { data, isLoading, refetch } = trpc.inventory.movements.list.useQuery({
    movementType: filters.movementType as any || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }, { staleTime: 30_000 });

  const adjust = trpc.inventory.stock.adjust.useMutation({
    onSuccess: () => { toast.success("Ajustement effectué"); setShowAdjust(false); setAdjustForm(emptyAdjustForm); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addStock = trpc.inventory.stock.addStock.useMutation({
    onSuccess: () => { toast.success("Stock ajouté"); setAddStockMode(false); setAddStockForm({ productId: "", locationId: "", quantity: "", movementType: "INITIAL_LOAD", reason: "" }); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const movements = data?.movements ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_ops", "admin_boutique", "admin_patisserie", "admin_terroir"]}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/inventory">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-green-700" /> Journal des mouvements
            </h1>
            <p className="text-muted-foreground text-sm">{total} mouvement(s) au total</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="h-4 w-4 mr-1" /> Filtres
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddStockMode(true)}>
              <Plus className="h-4 w-4 mr-1" /> Entrée stock
            </Button>
            <Button size="sm" onClick={() => setShowAdjust(true)}>
              Ajustement manuel
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Type de mouvement</Label>
                  <Select value={filters.movementType} onValueChange={v => { setFilters(f => ({ ...f, movementType: v === "all" ? "" : v })); setPage(0); }}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {MOVEMENT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date de début</Label>
                  <Input type="date" value={filters.dateFrom} onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(0); }} />
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Input type="date" value={filters.dateTo} onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(0); }} />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setFilters({ movementType: "", dateFrom: "", dateTo: "" }); setPage(0); }}>
                Réinitialiser les filtres
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Movements table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !movements.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucun mouvement trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Motif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m: any) => {
                      const isOut = IS_OUTGOING.has(m.movement_type);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[m.movement_type] ?? 'bg-gray-100 text-gray-600'}`}>
                              {MOVEMENT_TYPES.find(t => t.value === m.movement_type)?.label ?? m.movement_type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium max-w-[140px] truncate">{m.inventory_products?.name ?? `#${m.product_id}`}</div>
                            {m.inventory_products?.sku && <div className="text-xs text-muted-foreground">{m.inventory_products.sku}</div>}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                              {isOut ? '-' : '+'}{m.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.from_location?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.to_location?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.inventory_events?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.sale_order_id ?? m.reference_id ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{m.reason ?? '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
            <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Suivant
            </Button>
          </div>
        )}

        {/* Adjust Dialog */}
        <Dialog open={showAdjust} onOpenChange={v => { if (!v) setShowAdjust(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Ajustement manuel de stock</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                Cet ajustement est journalisé. Le motif est obligatoire.
              </div>
              <div>
                <Label>Produit *</Label>
                <Select value={adjustForm.productId} onValueChange={v => setAdjustForm(f => ({ ...f, productId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(products ?? []).map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Emplacement *</Label>
                <Select value={adjustForm.locationId} onValueChange={v => setAdjustForm(f => ({ ...f, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(locations ?? []).map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.type} — {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Delta quantité * (positif = ajout, négatif = retrait)</Label>
                <Input
                  type="number"
                  value={adjustForm.delta}
                  onChange={e => setAdjustForm(f => ({ ...f, delta: e.target.value }))}
                  placeholder="Ex: +10 ou -5"
                />
              </div>
              <div>
                <Label>Motif * (obligatoire)</Label>
                <Input value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Comptage physique, perte..." />
              </div>
              <div>
                <Label>Note (optionnel)</Label>
                <Input value={adjustForm.note} onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAdjust(false)}>Annuler</Button>
                <Button
                  onClick={() => adjust.mutate({
                    productId: parseInt(adjustForm.productId),
                    locationId: parseInt(adjustForm.locationId),
                    qtyDelta: parseInt(adjustForm.delta),
                    reason: adjustForm.reason,
                    note: adjustForm.note || undefined,
                  })}
                  disabled={!adjustForm.productId || !adjustForm.locationId || !adjustForm.delta || !adjustForm.reason || adjustForm.delta === "0" || adjust.isPending}
                >
                  {adjust.isPending ? "Enregistrement..." : "Confirmer l'ajustement"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add stock Dialog */}
        <Dialog open={addStockMode} onOpenChange={v => { if (!v) setAddStockMode(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Entrée en stock</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Produit *</Label>
                <Select value={addStockForm.productId} onValueChange={v => setAddStockForm(f => ({ ...f, productId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(products ?? []).map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Emplacement de destination *</Label>
                <Select value={addStockForm.locationId} onValueChange={v => setAddStockForm(f => ({ ...f, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(locations ?? []).map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.type} — {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantité *</Label>
                <Input type="number" min={1} value={addStockForm.quantity} onChange={e => setAddStockForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>Type d'entrée *</Label>
                <Select value={addStockForm.movementType} onValueChange={v => setAddStockForm(f => ({ ...f, movementType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INITIAL_LOAD">Chargement initial</SelectItem>
                    <SelectItem value="PURCHASE_IN">Achat / Réception</SelectItem>
                    <SelectItem value="DONATION_IN">Don reçu</SelectItem>
                    <SelectItem value="PRODUCTION_IN">Production interne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motif</Label>
                <Input value={addStockForm.reason} onChange={e => setAddStockForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Livraison fournisseur" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddStockMode(false)}>Annuler</Button>
                <Button
                  onClick={() => addStock.mutate({
                    productId: parseInt(addStockForm.productId),
                    locationId: parseInt(addStockForm.locationId),
                    quantity: parseInt(addStockForm.quantity),
                    movementType: addStockForm.movementType as any,
                    reason: addStockForm.reason || undefined,
                  })}
                  disabled={!addStockForm.productId || !addStockForm.locationId || !addStockForm.quantity || addStock.isPending}
                >
                  {addStock.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
