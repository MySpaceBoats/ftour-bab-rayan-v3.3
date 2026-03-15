import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import RequireRole from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, Loader2, Pencil, Plus, Trash2, Upload, X, ChevronLeft, ChevronRight } from "lucide-react";

type ProductType = "goodies" | "terroir" | "patisserie";

const LABELS: Record<ProductType, string> = {
  goodies: "Goodies",
  terroir: "Terroir",
  patisserie: "Pâtisserie",
};

export default function AdminProductCatalog({ productType }: { productType: ProductType }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    images: [] as string[],
    category: "",
    tags: "",
    status: true,
    isBestSeller: false,
    isRamadanEdition: false,
  });

  const utils = trpc.useUtils();

  const productsQuery = trpc.catalogProducts.adminList.useQuery({ productType });
  const statsQuery = trpc.catalogProducts.adminStats.useQuery({ productType });

  const uploadMutation = trpc.upload.image.useMutation({
    onError: (error: any) => {
      toast.error(`Erreur upload: ${error.message}`);
      setIsUploading(false);
    },
  });

  const removeImage = (index: number) => {
    setForm(prev => {
      const next = prev.images.filter((_, i) => i !== index);
      return { ...prev, images: next };
    });
    setPreviewIndex(i => Math.min(i, Math.max(0, form.images.length - 2)));
  };

  const createMutation = trpc.catalogProducts.create.useMutation({
    onSuccess: () => {
      toast.success("Produit créé");
      setShowCreate(false);
      resetForm();
      productsQuery.refetch();
      statsQuery.refetch();
      utils.qr.catalogQRCodes.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = trpc.catalogProducts.update.useMutation({
    onSuccess: () => {
      toast.success("Produit mis à jour");
      setEditing(null);
      resetForm();
      productsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.catalogProducts.remove.useMutation({
    onSuccess: () => {
      toast.success("Produit supprimé");
      productsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rows = useMemo(() => productsQuery.data || [], [productsQuery.data]);

  const resetForm = () => {
    setForm({ name: "", description: "", price: 0, stock: 0, images: [], category: "", tags: "", status: true, isBestSeller: false, isRamadanEdition: false });
    setPreviewIndex(0);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    const existingImages: string[] = Array.isArray(row.images) && row.images.length > 0
      ? row.images
      : row.image ? [row.image] : [];
    setForm({
      name: row.name || "",
      description: row.description || "",
      price: Number(row.price || 0),
      stock: Number(row.stock || 0),
      images: existingImages,
      category: row.category || "",
      tags: Array.isArray(row.tags) ? row.tags.join(", ") : "",
      status: row.status === "active",
      isBestSeller: !!row.is_best_seller,
      isRamadanEdition: !!row.is_ramadan_edition,
    });
    setPreviewIndex(0);
  };

  const handleCreate = () => {
    createMutation.mutate({
      productType,
      name: form.name,
      description: form.description || undefined,
      price: form.price,
      stock: form.stock,
      images: form.images,
      image: form.images[0] || undefined,
      category: form.category || undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      status: form.status ? "active" : "inactive",
      isBestSeller: form.isBestSeller,
      isRamadanEdition: form.isRamadanEdition,
    });
  };

  const handleUpdate = () => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      name: form.name,
      description: form.description,
      price: form.price,
      stock: form.stock,
      images: form.images,
      image: form.images[0] || "",
      category: form.category,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      status: form.status ? "active" : "inactive",
      isBestSeller: form.isBestSeller,
      isRamadanEdition: form.isRamadanEdition,
    });
  };

  const handleFileSelect = async (e: any) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileData: base64,
          folder: productType,
        });
        uploaded.push(result.url);
      }
      setForm(prev => {
        const next = [...prev.images, ...uploaded];
        return { ...prev, images: next };
      });
      setPreviewIndex(form.images.length); // show first newly added
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formContent = (
    <div className="grid gap-3">
      <Label>Nom</Label>
      <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
      <Label>Description</Label>
      <Textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Prix</Label><Input type="number" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: Number(e.target.value || 0) }))} /></div>
        <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(prev => ({ ...prev, stock: Number(e.target.value || 0) }))} /></div>
      </div>
      <Label>Catégorie</Label>
      <Input value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} />
      <Label>Tags (séparés par virgule)</Label>
      <Input value={form.tags} onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))} />
      {/* Multi-image management */}
      <div className="space-y-2">
        <Label>Photos du produit ({form.images.length})</Label>
        {form.images.length > 0 && (
          <div className="relative border rounded-md overflow-hidden bg-muted" style={{ height: 160 }}>
            <img
              src={form.images[previewIndex]}
              alt={`Aperçu ${previewIndex + 1}`}
              className="w-full h-full object-contain"
            />
            {/* Remove current image */}
            <button
              type="button"
              onClick={() => removeImage(previewIndex)}
              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* Navigation if multiple */}
            {form.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewIndex(i => (i - 1 + form.images.length) % form.images.length)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewIndex(i => (i + 1) % form.images.length)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  {previewIndex + 1}/{form.images.length}
                </div>
              </>
            )}
          </div>
        )}
        {/* Thumbnail strip */}
        {form.images.length > 1 && (
          <div className="flex gap-1 overflow-x-auto py-1">
            {form.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPreviewIndex(i)}
                className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${i === previewIndex ? "border-primary" : "border-transparent"}`}
              >
                <img src={src} alt={`miniature ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {/* Upload button */}
        <div
          className="border-2 border-dashed rounded-md p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading
            ? <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            : <><Upload className="mx-auto h-5 w-5 mb-1" /><p className="text-xs text-muted-foreground">Ajouter des photos (plusieurs fichiers possibles)</p></>
          }
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="image/png,image/jpeg,image/webp" />
      </div>
      <div className="flex items-center gap-2"><Switch checked={form.status} onCheckedChange={v => setForm(prev => ({ ...prev, status: v }))} /><Label>Actif</Label></div>
      <div className="flex items-center gap-2"><Switch checked={form.isBestSeller} onCheckedChange={v => setForm(prev => ({ ...prev, isBestSeller: v }))} /><Label>Best seller</Label></div>
      <div className="flex items-center gap-2"><Switch checked={form.isRamadanEdition} onCheckedChange={v => setForm(prev => ({ ...prev, isRamadanEdition: v }))} /><Label>Édition Ramadan</Label></div>
    </div>
  );

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_boutique", "admin_patisserie", "admin_terroir", "admin_ops", "admin_operations"]}>
      <div className="min-h-screen bg-muted/30 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <div><h1 className="text-2xl font-semibold">Catalogue {LABELS[productType]}</h1><p className="text-sm text-muted-foreground">{rows.length} produit(s)</p></div>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Ajouter un produit</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Ajouter un produit</DialogTitle></DialogHeader>{formContent}<Button onClick={handleCreate}>Créer</Button></DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-6 text-center"><p className="text-3xl font-bold">{statsQuery.data?.total ?? 0}</p><p>Total produits</p></CardContent></Card>
          <Card><CardContent className="p-6 text-center"><p className="text-3xl font-bold text-green-600">{statsQuery.data?.active ?? 0}</p><p>Actifs</p></CardContent></Card>
          <Card><CardContent className="p-6 text-center"><p className="text-3xl font-bold text-amber-600">{statsQuery.data?.bestSellers ?? 0}</p><p>Best sellers</p></CardContent></Card>
          <Card><CardContent className="p-6 text-center"><p className="text-3xl font-bold">{statsQuery.data?.ramadanEdition ?? 0}</p><p>Édition Ramadan</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead><TableHead>Prix</TableHead><TableHead>Catégorie</TableHead><TableHead>Stock</TableHead><TableHead>Tags</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell><div className="flex items-center gap-3">{(row.images?.length > 0 || row.image) ? <div className="relative shrink-0"><img src={row.images?.[0] || row.image} className="h-10 w-10 rounded object-cover" />{row.images?.length > 1 && <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{row.images.length}</span>}</div> : <ImageIcon className="h-5 w-5" />}<div><p>{row.name}</p><p className="text-xs text-muted-foreground line-clamp-1">{row.description || "Pas de description"}</p></div></div></TableCell>
                    <TableCell>{row.price} DH</TableCell>
                    <TableCell>{row.category || "-"}</TableCell>
                    <TableCell>{row.stock ?? 0}</TableCell>
                    <TableCell>{Array.isArray(row.tags) && row.tags.length ? row.tags.join(", ") : "-"}</TableCell>
                    <TableCell><Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status === "active" ? "Actif" : "Inactif"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" onClick={() => updateMutation.mutate({ id: row.id, status: row.status === "active" ? "inactive" : "active" })}>{row.status === "active" ? "Désactiver" : "Activer"}</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="outline" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate({ id: row.id })}>Supprimer</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Modifier le produit</DialogTitle></DialogHeader>
            {formContent}
            <div className="flex gap-2"><Button onClick={handleUpdate}>Enregistrer</Button><Button variant="ghost" onClick={() => { setEditing(null); resetForm(); }}><X className="mr-2 h-4 w-4" />Fermer</Button></div>
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
