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
import { ArrowLeft, Plus, Package, Search, Edit, BarChart3, RefreshCw } from "lucide-react";

const PRODUCT_TYPES = [
  { value: "goodie",          label: "Goodie" },
  { value: "goodie_variant",  label: "Goodie (variante)" },
  { value: "pastry",          label: "Pâtisserie" },
  { value: "terroir_product", label: "Produit terroir" },
  { value: "terroir_variant", label: "Terroir (variante)" },
  { value: "autre",           label: "Autre" },
];

const UNITS = [
  { value: "piece", label: "Pièce" },
  { value: "kg",    label: "Kilogramme" },
  { value: "litre", label: "Litre" },
  { value: "box",   label: "Boîte" },
];

const emptyForm = {
  productType: "goodie",
  name: "",
  unit: "piece",
};

export default function AdminInventoryProducts() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showStockDetail, setShowStockDetail] = useState<number | null>(null);

  // Queries
  const { data: products, isLoading, refetch } = trpc.inventory.products.list.useQuery({
    isActive: true,
    productType: filterType !== "all" ? filterType : undefined,
    search: search || undefined,
  }, { staleTime: 30_000 });

  const { data: stockDetail } = trpc.inventory.products.balances.useQuery(
    { productId: showStockDetail! },
    { enabled: showStockDetail !== null }
  );

  const overview = trpc.inventory.stock.overview.useQuery(undefined, { staleTime: 60_000 });

  // Mutations
  const createProduct = trpc.inventory.products.create.useMutation({
    onSuccess: () => { toast.success("Produit créé"); setShowCreate(false); setForm(emptyForm); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateProduct = trpc.inventory.products.update.useMutation({
    onSuccess: () => { toast.success("Produit mis à jour"); setEditingId(null); setForm(emptyForm); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const syncAllCatalogs = trpc.inventory.products.syncAllCatalogs.useMutation({
    onSuccess: (result) => {
      toast.success(`Synchronisation terminée : ${result.synced} produit(s) importé(s)${result.errors > 0 ? `, ${result.errors} erreur(s)` : ''}`);
      refetch();
      overview.refetch();
    },
    onError: (e) => toast.error(`Erreur synchronisation : ${e.message}`),
  });

  // Helpers
  const getProductGlobalStock = (productId: number) => {
    return (overview.data ?? [])
      .filter((b: any) => b.product_id === productId && b.inventory_locations?.type === 'GLOBAL')
      .reduce((s: number, b: any) => s + b.quantity_on_hand, 0);
  };
  const getProductBufferStock = (productId: number) => {
    return (overview.data ?? [])
      .filter((b: any) => b.product_id === productId && b.inventory_locations?.type === 'EVENT_BUFFER')
      .reduce((s: number, b: any) => s + b.quantity_on_hand, 0);
  };
  const getProductPosStock = (productId: number) => {
    return (overview.data ?? [])
      .filter((b: any) => b.product_id === productId && b.inventory_locations?.type === 'POS')
      .reduce((s: number, b: any) => s + b.quantity_on_hand, 0);
  };

  const handleSubmit = () => {
    const payload = {
      productType: form.productType,
      name: form.name,
      sku: null,
      barcode: null,
      category: form.name || null,
      unit: form.unit,
      sourceProductId: null,
      sourceVariantId: null,
    };
    if (editingId !== null) {
      updateProduct.mutate({ id: editingId, ...payload });
    } else {
      createProduct.mutate(payload);
    }
  };

  const openEdit = (p: any) => {
    setForm({
      productType: p.product_type,
      name: p.name,
      unit: p.unit ?? "piece",
    });
    setEditingId(p.id);
    setShowCreate(true);
  };

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_ops", "admin_boutique", "admin_patisserie", "admin_terroir"]}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/inventory">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-green-700" /> Produits & Stock
            </h1>
            <p className="text-muted-foreground text-sm">Catalogue des produits stockables</p>
          </div>
        </div>

        {/* Filters + Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Type de produit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {PRODUCT_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => syncAllCatalogs.mutate()}
            disabled={syncAllCatalogs.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${syncAllCatalogs.isPending ? 'animate-spin' : ''}`} />
            {syncAllCatalogs.isPending ? 'Synchronisation...' : 'Sync catalogues'}
          </Button>
          <Button onClick={() => { setShowCreate(true); setEditingId(null); setForm(emptyForm); }}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau produit
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !(products ?? []).length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucun produit stockable</p>
                <p className="text-sm">Créez un produit ou importez-le depuis le catalogue</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Global</TableHead>
                    <TableHead className="text-right">Buffer</TableHead>
                    <TableHead className="text-right">POS</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products ?? []).map((p: any) => {
                    const g = getProductGlobalStock(p.id);
                    const b = getProductBufferStock(p.id);
                    const pos = getProductPosStock(p.id);
                    const total = g + b + pos;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {PRODUCT_TYPES.find(t => t.value === p.product_type)?.label ?? p.product_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.sku ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <span className={g === 0 ? 'text-red-500' : 'text-blue-600 font-medium'}>{g}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={b === 0 ? 'text-muted-foreground' : 'text-amber-600 font-medium'}>{b}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={pos === 0 ? 'text-muted-foreground' : 'text-green-600 font-medium'}>{pos}</span>
                        </TableCell>
                        <TableCell className="text-right font-bold">{total}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setShowStockDetail(p.id)}>
                              <BarChart3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showCreate} onOpenChange={v => { if (!v) { setShowCreate(false); setEditingId(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom du produit" />
              </div>
              <div>
                <Label>Type de produit *</Label>
                <Select value={form.productType} onValueChange={v => setForm(f => ({ ...f, productType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nom du produit</Label>
                  <Input value={form.name} disabled placeholder="Nom du produit" />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>Annuler</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.name || createProduct.isPending || updateProduct.isPending}
                >
                  {(createProduct.isPending || updateProduct.isPending) ? "Enregistrement..." : (editingId ? "Mettre à jour" : "Créer")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Detail Dialog */}
        <Dialog open={showStockDetail !== null} onOpenChange={v => { if (!v) setShowStockDetail(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détail des stocks par emplacement</DialogTitle>
            </DialogHeader>
            {!stockDetail ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-2">
                {(stockDetail as any[]).length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Aucun stock enregistré</p>
                ) : (
                  (stockDetail as any[]).map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{b.inventory_locations?.name}</p>
                        <Badge variant="outline" className="text-xs mt-0.5">
                          {b.inventory_locations?.type}
                        </Badge>
                      </div>
                      <span className={`font-bold text-lg ${b.quantity_on_hand === 0 ? 'text-red-500' : 'text-green-700'}`}>
                        {b.quantity_on_hand}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
