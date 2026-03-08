import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Loader2, Plus, Package, Edit, Layers, Upload, X, Image as ImageIcon, Trash2
} from "lucide-react";

export default function AdminTerroirProducts() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showVariant, setShowVariant] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<any>(null);
  const [editVariantForm, setEditVariantForm] = useState({ label: "", sku: "", priceUnit: 0, stockTotal: 0, isActive: true });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    imageUrl: "",
    isActive: true,
    sortOrder: 0,
  });
  const [variantForm, setVariantForm] = useState({ label: "", sku: "", priceUnit: 0, stockTotal: 0, isActive: true });

  const { data: products, isLoading, refetch } = trpc.terroirModule.adminListProducts.useQuery();

  const uploadMutation = trpc.upload.image.useMutation({
    onError: (error: any) => {
      toast.error("Erreur upload: " + error.message);
      setIsUploading(false);
    },
  });

  const createProduct = trpc.terroirModule.adminCreateProduct.useMutation({
    onSuccess: () => {
      toast.success("Produit créé");
      setShowCreate(false);
      resetForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateProduct = trpc.terroirModule.adminUpdateProduct.useMutation({
    onSuccess: () => {
      toast.success("Produit mis à jour");
      setEditingProduct(null);
      resetForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createVariant = trpc.terroirModule.adminCreateVariant.useMutation({
    onSuccess: () => {
      toast.success("Variante créée");
      setShowVariant(null);
      setVariantForm({ label: "", sku: "", priceUnit: 0, stockTotal: 0, isActive: true });
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateVariant = trpc.terroirModule.adminUpdateVariant.useMutation({
    onSuccess: () => {
      toast.success("Variante mise à jour");
      setEditingVariant(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteProduct = trpc.terroirModule.adminDeleteProduct.useMutation({
    onSuccess: () => {
      toast.success("Produit supprimé");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      category: "",
      imageUrl: "",
      isActive: true,
      sortOrder: 0,
    });
    setImagePreview(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Type de fichier non autorisé. Utilisez PNG, JPEG ou WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux. Maximum 5 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);

      setIsUploading(true);
      try {
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileData: base64,
          folder: 'terroir',
        });

        setForm(prev => ({ ...prev, imageUrl: result.url }));
        toast.success("Image téléchargée avec succès");
      } catch (error) {
        // Error handled by mutation
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm(prev => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreate = () => {
    if (!form.name) {
      toast.error("Veuillez remplir le nom du produit");
      return;
    }
    createProduct.mutate(form);
  };

  const handleUpdate = () => {
    if (!editingProduct) return;
    updateProduct.mutate({
      id: editingProduct.id,
      ...form,
    });
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      imageUrl: product.image_url || "",
      isActive: product.is_active ?? true,
      sortOrder: product.sort_order || 0,
    });
    setImagePreview(product.image_url || null);
  };

  const toggleActive = (product: any) => {
    updateProduct.mutate({
      id: product.id,
      isActive: !product.is_active,
    });
  };

  const openEditVariant = (v: any) => {
    setEditingVariant(v);
    setEditVariantForm({
      label: v.label,
      sku: v.sku ?? "",
      priceUnit: parseFloat(v.price_unit),
      stockTotal: v.stock_total,
      isActive: v.is_active,
    });
  };

  const handleUpdateVariant = () => {
    if (!editingVariant) return;
    updateVariant.mutate({
      id: editingVariant.id,
      label: editVariantForm.label,
      sku: editVariantForm.sku || undefined,
      priceUnit: editVariantForm.priceUnit,
      stockTotal: editVariantForm.stockTotal,
      isActive: editVariantForm.isActive,
    });
  };

  const imageUploadField = (
    <div className="space-y-2">
      <Label>Image du produit</Label>
      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
        {imagePreview || form.imageUrl ? (
          <div className="relative inline-block">
            <img
              src={imagePreview || form.imageUrl}
              alt="Aperçu"
              className="max-h-40 rounded-lg mx-auto"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={removeImage}
            >
              <X className="h-3 w-3" />
            </Button>
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
        ) : (
          <div
            className="cursor-pointer py-6"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cliquez pour télécharger une image
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPEG ou WebP (max 5 Mo)
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {!imagePreview && !form.imageUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4 mr-2" />
          )}
          Choisir une image
        </Button>
      )}
    </div>
  );

  const productFormFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nom du produit *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Huile d'olive, Miel..."
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Description du produit..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Input
            value={form.category}
            onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
            placeholder="huile, miel, épices..."
          />
        </div>
        <div className="space-y-2">
          <Label>Ordre d'affichage</Label>
          <Input
            type="number"
            value={form.sortOrder === 0 ? '' : form.sortOrder}
            onChange={(e) => setForm(prev => ({ ...prev, sortOrder: e.target.value === '' ? 0 : parseInt(e.target.value) }))}
            placeholder="0"
            min="0"
          />
        </div>
      </div>

      {imageUploadField}

      <div className="flex items-center justify-between">
        <Label>Actif</Label>
        <Switch
          checked={form.isActive}
          onCheckedChange={(checked) => setForm(prev => ({ ...prev, isActive: checked }))}
        />
      </div>
    </div>
  );

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_terroir", "admin_ops", "admin_operations"]}>
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
            <Dialog open={showCreate} onOpenChange={(open) => {
              setShowCreate(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nouveau produit</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nouveau produit terroir</DialogTitle></DialogHeader>
                {productFormFields}
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!form.name || createProduct.isPending || isUploading}
                >
                  {createProduct.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Créer le produit
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="container py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{products?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Total produits</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {products?.filter((p: any) => p.is_active).length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Actifs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {products?.reduce((sum: number, p: any) => sum + (p.terroir_product_variants?.length || 0), 0) || 0}
                </div>
                <div className="text-xs text-muted-foreground">Variantes</div>
              </CardContent>
            </Card>
          </div>

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
                        <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-amber-700" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {product.name}
                            <Badge className={product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                              {product.is_active ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                          {product.category && <div className="text-sm text-muted-foreground font-normal">{product.category}</div>}
                          {product.description && <div className="text-xs text-muted-foreground font-normal line-clamp-1">{product.description}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Edit button */}
                        <Dialog open={editingProduct?.id === product.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingProduct(null);
                            resetForm();
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Modifier le produit</DialogTitle></DialogHeader>
                            {productFormFields}
                            <Button
                              onClick={handleUpdate}
                              className="w-full"
                              disabled={updateProduct.isPending || isUploading}
                            >
                              {updateProduct.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Edit className="h-4 w-4 mr-2" />
                              )}
                              Enregistrer les modifications
                            </Button>
                          </DialogContent>
                        </Dialog>

                        <Button size="sm" variant={product.is_active ? "outline" : "default"} onClick={() => toggleActive(product)}>
                          {product.is_active ? "Désactiver" : "Activer"}
                        </Button>

                        {/* Add variant */}
                        <Dialog open={showVariant === product.id} onOpenChange={(v) => setShowVariant(v ? product.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Variante</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Nouvelle variante pour {product.name}</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Label (ex: 250g, 500ml, Pack 3)</Label>
                                <Input value={variantForm.label} onChange={(e) => setVariantForm(prev => ({ ...prev, label: e.target.value }))} />
                              </div>
                              <div>
                                <Label>SKU (optionnel)</Label>
                                <Input value={variantForm.sku} onChange={(e) => setVariantForm(prev => ({ ...prev, sku: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Prix unitaire (DH)</Label>
                                <Input type="number" value={variantForm.priceUnit} onChange={(e) => setVariantForm(prev => ({ ...prev, priceUnit: parseFloat(e.target.value) || 0 }))} />
                              </div>
                              <div>
                                <Label>Stock total</Label>
                                <Input type="number" value={variantForm.stockTotal} onChange={(e) => setVariantForm(prev => ({ ...prev, stockTotal: parseInt(e.target.value) || 0 }))} />
                              </div>
                              <Button className="w-full" onClick={() => createVariant.mutate({ productId: product.id, ...variantForm })} disabled={!variantForm.label || createVariant.isPending}>
                                Créer la variante
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Delete button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer "{product.name}" ?
                                Cette action est irréversible et supprimera aussi toutes les variantes associées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteProduct.mutate({ id: product.id })}
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {product.terroir_product_variants.map((v: any) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-medium">{v.label}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{v.sku || "-"}</TableCell>
                              <TableCell>{parseFloat(v.price_unit).toFixed(2)} DH</TableCell>
                              <TableCell>
                                <span className={(v.stock_total - v.stock_reserved) <= 0 ? "text-red-500 font-medium" : "text-green-700 font-medium"}>
                                  {v.stock_total - v.stock_reserved}
                                </span>
                              </TableCell>
                              <TableCell>{v.stock_reserved}</TableCell>
                              <TableCell>
                                <Badge className={v.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                                  {v.is_active ? "Actif" : "Inactif"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => openEditVariant(v)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
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
              <p className="text-sm text-muted-foreground">Créez votre premier produit pour commencer</p>
            </div>
          )}
        </main>
      </div>

      {/* Edit variant dialog */}
      <Dialog open={editingVariant !== null} onOpenChange={(v) => { if (!v) setEditingVariant(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la variante</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input value={editVariantForm.label} onChange={(e) => setEditVariantForm(prev => ({ ...prev, label: e.target.value }))} />
            </div>
            <div>
              <Label>SKU (optionnel)</Label>
              <Input value={editVariantForm.sku} onChange={(e) => setEditVariantForm(prev => ({ ...prev, sku: e.target.value }))} />
            </div>
            <div>
              <Label>Prix unitaire (DH)</Label>
              <Input type="number" min="0" value={editVariantForm.priceUnit} onChange={(e) => setEditVariantForm(prev => ({ ...prev, priceUnit: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Stock total</Label>
              <Input type="number" min="0" value={editVariantForm.stockTotal} onChange={(e) => setEditVariantForm(prev => ({ ...prev, stockTotal: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Actif</Label>
              <Switch checked={editVariantForm.isActive} onCheckedChange={(checked) => setEditVariantForm(prev => ({ ...prev, isActive: checked }))} />
            </div>
            <Button className="w-full" onClick={handleUpdateVariant} disabled={!editVariantForm.label || updateVariant.isPending}>
              {updateVariant.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RequireRole>
  );
}
