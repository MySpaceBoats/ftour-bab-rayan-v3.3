import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import {
  ArrowLeft, Loader2, Plus, Package, Edit, Layers
} from "lucide-react";

export default function AdminTerroirProducts() {
  const [showCreate, setShowCreate] = useState(false);
  const [showVariant, setShowVariant] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", isActive: true, sortOrder: 0 });
  const [variantForm, setVariantForm] = useState({ label: "", sku: "", priceUnit: 0, stockTotal: 0, isActive: true });

  const { data: products, isLoading, refetch } = trpc.terroirModule.adminListProducts.useQuery();

  const createProduct = trpc.terroirModule.adminCreateProduct.useMutation({
    onSuccess: () => { toast.success("Produit créé"); setShowCreate(false); setForm({ name: "", description: "", category: "", isActive: true, sortOrder: 0 }); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateProduct = trpc.terroirModule.adminUpdateProduct.useMutation({
    onSuccess: () => { toast.success("Produit mis à jour"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const createVariant = trpc.terroirModule.adminCreateVariant.useMutation({
    onSuccess: () => { toast.success("Variante créée"); setShowVariant(null); setVariantForm({ label: "", sku: "", priceUnit: 0, stockTotal: 0, isActive: true }); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_terroir"]}>
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="container flex h-16 items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="flex-1">
              <h1 className="font-bold text-lg">Catalogue Terroir</h1>
              <p className="text-xs text-muted-foreground">{products?.length || 0} produit(s)</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nouveau produit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau produit terroir</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nom</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Catégorie</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="huile, miel, épices..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                    <Label>Actif</Label>
                  </div>
                  <Button className="w-full" onClick={() => createProduct.mutate(form)} disabled={!form.name || createProduct.isPending}>
                    Créer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="container py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="space-y-6">
              {products.map((product: any) => (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-amber-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {product.name}
                            <Badge className={product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                              {product.is_active ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                          {product.category && <div className="text-sm text-muted-foreground font-normal">{product.category}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateProduct.mutate({ id: product.id, isActive: !product.is_active })}>
                          {product.is_active ? "Désactiver" : "Activer"}
                        </Button>
                        <Dialog open={showVariant === product.id} onOpenChange={(v) => setShowVariant(v ? product.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Variante</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Nouvelle variante pour {product.name}</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Label (ex: 250g, 500ml, Pack 3)</Label>
                                <Input value={variantForm.label} onChange={(e) => setVariantForm({ ...variantForm, label: e.target.value })} />
                              </div>
                              <div>
                                <Label>SKU (optionnel)</Label>
                                <Input value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} />
                              </div>
                              <div>
                                <Label>Prix unitaire (DH)</Label>
                                <Input type="number" value={variantForm.priceUnit} onChange={(e) => setVariantForm({ ...variantForm, priceUnit: parseFloat(e.target.value) || 0 })} />
                              </div>
                              <div>
                                <Label>Stock total</Label>
                                <Input type="number" value={variantForm.stockTotal} onChange={(e) => setVariantForm({ ...variantForm, stockTotal: parseInt(e.target.value) || 0 })} />
                              </div>
                              <Button className="w-full" onClick={() => createVariant.mutate({ productId: product.id, ...variantForm })} disabled={!variantForm.label || createVariant.isPending}>
                                Créer la variante
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {product.terroir_product_variants && product.terroir_product_variants.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variante</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Prix</TableHead>
                            <TableHead>Stock dispo</TableHead>
                            <TableHead>Réservé</TableHead>
                            <TableHead>Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {product.terroir_product_variants.map((v: any) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-medium">{v.label}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{v.sku || "-"}</TableCell>
                              <TableCell>{parseFloat(v.price_unit).toFixed(2)} DH</TableCell>
                              <TableCell>{v.stock_total - v.stock_reserved}</TableCell>
                              <TableCell>{v.stock_reserved}</TableCell>
                              <TableCell>
                                <Badge className={v.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                                  {v.is_active ? "Actif" : "Inactif"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        <Layers className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        Aucune variante. Ajoutez des variantes pour ce produit.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Aucun produit terroir</p>
            </div>
          )}
        </main>
      </div>
    </RequireRole>
  );
}
