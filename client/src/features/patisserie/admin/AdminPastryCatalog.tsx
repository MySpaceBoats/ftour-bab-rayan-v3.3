import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Loader2, CakeSlice, Edit, Upload, X, Image as ImageIcon, Trash2
} from "lucide-react";
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

export default function AdminPastryCatalog() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPastry, setEditingPastry] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    imageUrl: "",
    category: "",
    sortOrder: 0,
    active: true,
  });

  const { data: pastries, isLoading, refetch } = trpc.pastries.list.useQuery();

  const uploadMutation = trpc.upload.image.useMutation({
    onError: (error: any) => {
      toast.error("Erreur upload: " + error.message);
      setIsUploading(false);
    },
  });

  const handlePastryError = (error: any) => {
    const msg = error?.message || "";
    if (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("n'existe pas encore")) {
      toast.error("La table pâtisseries n'existe pas encore dans la base de données. Contactez l'administrateur pour exécuter la migration SQL.", { duration: 8000 });
    } else {
      toast.error(msg || "Une erreur est survenue");
    }
  };

  const createMutation = trpc.pastries.create.useMutation({
    onSuccess: () => {
      toast.success("Pâtisserie créée avec succès");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: handlePastryError,
  });

  const updateMutation = trpc.pastries.update.useMutation({
    onSuccess: () => {
      toast.success("Pâtisserie mise à jour");
      setEditingPastry(null);
      resetForm();
      refetch();
    },
    onError: handlePastryError,
  });

  const deleteMutation = trpc.pastries.delete.useMutation({
    onSuccess: () => {
      toast.success("Pâtisserie supprimée");
      refetch();
    },
    onError: handlePastryError,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      stock: 0,
      imageUrl: "",
      category: "",
      sortOrder: 0,
      active: true,
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
          folder: 'pastries',
        });

        setFormData(prev => ({ ...prev, imageUrl: result.url }));
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
    setFormData(prev => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreate = () => {
    if (!formData.name || !formData.price) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      price: formData.price,
      stock: formData.stock,
      imageUrl: formData.imageUrl || undefined,
      category: formData.category || undefined,
      sortOrder: formData.sortOrder,
    });
  };

  const handleUpdate = () => {
    if (!editingPastry) return;
    updateMutation.mutate({
      id: editingPastry.id,
      name: formData.name || undefined,
      description: formData.description || undefined,
      price: formData.price || undefined,
      stock: formData.stock,
      imageUrl: formData.imageUrl || undefined,
      category: formData.category || undefined,
      active: formData.active,
      sortOrder: formData.sortOrder,
    });
  };

  const openEditDialog = (pastry: any) => {
    setEditingPastry(pastry);
    setFormData({
      name: pastry.name || "",
      description: pastry.description || "",
      price: pastry.price || 0,
      stock: pastry.stock || 0,
      imageUrl: pastry.image_url || "",
      category: pastry.category || "",
      sortOrder: pastry.sort_order || 0,
      active: pastry.active ?? true,
    });
    setImagePreview(pastry.image_url || null);
  };

  const toggleActive = (pastry: any) => {
    updateMutation.mutate({
      id: pastry.id,
      active: !pastry.active,
    });
  };

  const ImageUploadField = () => (
    <div className="space-y-2">
      <Label>Image du produit</Label>
      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
        {imagePreview || formData.imageUrl ? (
          <div className="relative inline-block">
            <img
              src={imagePreview || formData.imageUrl}
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
      {!imagePreview && !formData.imageUrl && (
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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg">Catalogue Pâtisserie</h1>
              <p className="text-xs text-muted-foreground">
                {pastries?.length || 0} produit(s)
              </p>
            </div>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une pâtisserie
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouvelle pâtisserie</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom du produit *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Cornes de gazelle, Chebakia..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du produit..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Prix (DH) *</Label>
                    <Input
                      type="number"
                      value={formData.price === 0 ? '' : formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      placeholder="50"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <Input
                      type="number"
                      value={formData.stock === 0 ? '' : formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ordre d'affichage</Label>
                    <Input
                      type="number"
                      value={formData.sortOrder === 0 ? '' : formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                <ImageUploadField />

                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Gâteaux, Tartes, Viennoiseries..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Actif</Label>
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  className="w-full"
                  disabled={createMutation.isPending || isUploading}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Créer la pâtisserie
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{pastries?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total produits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {pastries?.filter((p: any) => p.active).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Actifs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {pastries?.filter((p: any) => !p.active).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Inactifs</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pastries && pastries.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Ordre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastries.map((pastry: any) => (
                      <TableRow key={pastry.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
                              {pastry.image_url ? (
                                <img src={pastry.image_url} alt={pastry.name} className="w-full h-full object-cover" />
                              ) : (
                                <CakeSlice className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{pastry.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {pastry.description || "Pas de description"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{pastry.price} DH</TableCell>
                        <TableCell>{pastry.stock ?? 0}</TableCell>
                        <TableCell>{pastry.sort_order || 0}</TableCell>
                        <TableCell>
                          <Badge variant={pastry.active ? "default" : "secondary"}>
                            {pastry.active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog open={editingPastry?.id === pastry.id} onOpenChange={(open) => {
                              if (!open) {
                                setEditingPastry(null);
                                resetForm();
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(pastry)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Modifier la pâtisserie</DialogTitle>
                                </DialogHeader>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Nom du produit *</Label>
                                    <Input
                                      value={formData.name}
                                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                      value={formData.description}
                                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                      rows={3}
                                    />
                                  </div>

                                  <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                      <Label>Prix (DH) *</Label>
                                      <Input
                                        type="number"
                                        value={formData.price === 0 ? '' : formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                        min="0"
                                        step="0.01"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Stock</Label>
                                      <Input
                                        type="number"
                                        value={formData.stock === 0 ? '' : formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                        placeholder="0"
                                        min="0"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Ordre d'affichage</Label>
                                      <Input
                                        type="number"
                                        value={formData.sortOrder === 0 ? '' : formData.sortOrder}
                                        onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                        min="0"
                                      />
                                    </div>
                                  </div>

                                  <ImageUploadField />

                                  <div className="space-y-2">
                                    <Label>Catégorie</Label>
                                    <Input
                                      value={formData.category}
                                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                      placeholder="Gâteaux, Tartes, Viennoiseries..."
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <Label>Actif</Label>
                                    <Switch
                                      checked={formData.active}
                                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                                    />
                                  </div>

                                  <Button
                                    onClick={handleUpdate}
                                    className="w-full"
                                    disabled={updateMutation.isPending || isUploading}
                                  >
                                    {updateMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Edit className="h-4 w-4 mr-2" />
                                    )}
                                    Enregistrer les modifications
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant={pastry.active ? "outline" : "default"}
                              size="sm"
                              onClick={() => toggleActive(pastry)}
                            >
                              {pastry.active ? "Désactiver" : "Activer"}
                            </Button>
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
                                  <AlertDialogTitle>Supprimer cette pâtisserie ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer "{pastry.name}" ?
                                    Cette action désactivera le produit.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate({ id: pastry.id })}
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CakeSlice className="h-12 w-12 mb-4" />
                <p>Aucune pâtisserie trouvée</p>
                <p className="text-sm">Créez votre première pâtisserie pour commencer</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
