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
  ArrowLeft, Plus, Loader2, Package, Edit, Star, Sparkles, Upload, X, Image as ImageIcon
} from "lucide-react";

export default function AdminGoodies() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGoodie, setEditingGoodie] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    imageUrl: "",
    category: "",
    isActive: true,
    sortOrder: 0,
  });

  const { data: goodies, isLoading, refetch } = trpc.goodies.listAll.useQuery();

  const uploadMutation = trpc.upload.image.useMutation({
    onError: (error: any) => {
      toast.error("Erreur upload: " + error.message);
      setIsUploading(false);
    },
  });

  const createMutation = trpc.goodies.create.useMutation({
    onSuccess: () => {
      toast.success("Produit créé avec succès");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.goodies.update.useMutation({
    onSuccess: () => {
      toast.success("Produit mis à jour");
      setEditingGoodie(null);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      category: "",
      isActive: true,
      sortOrder: 0,
    });
    setImagePreview(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Type de fichier non autorisé. Utilisez PNG, JPEG ou WebP.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux. Maximum 5 Mo.");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      
      // Upload to Supabase
      setIsUploading(true);
      try {
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileData: base64,
          folder: 'goodies',
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
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingGoodie) return;
    updateMutation.mutate({
      id: editingGoodie.id,
      ...formData,
    });
  };

  const openEditDialog = (goodie: any) => {
    setEditingGoodie(goodie);
    setFormData({
      name: goodie.name,
      description: goodie.description || "",
      price: goodie.price || 0,
      imageUrl: goodie.imageUrl || "",
      category: goodie.category || "",
      isActive: goodie.isActive ?? true,
      sortOrder: goodie.sortOrder || 0,
    });
    setImagePreview(goodie.imageUrl || null);
  };

  const toggleActive = (goodie: any) => {
    updateMutation.mutate({
      id: goodie.id,
      isActive: !goodie.isActive,
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
              <h1 className="font-bold text-lg">Catalogue Goodies</h1>
              <p className="text-xs text-muted-foreground">
                {goodies?.length || 0} produit(s)
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
                Ajouter un produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouveau produit</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom du produit *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="T-shirt Ftour Bab Rayan"
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prix (DH) *</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ordre d'affichage</Label>
                    <Input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <ImageUploadField />

                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Vêtements, Accessoires..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Actif</Label>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                  </div>
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
                  Créer le produit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{goodies?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total produits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {goodies?.filter((g: any) => g.isActive).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Actifs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {goodies?.filter((g: any) => g.isBestSeller).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Best-sellers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {goodies?.filter((g: any) => g.isRamadanEdition).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Édition Ramadan</div>
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
            ) : goodies && goodies.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goodies.map((goodie: any) => (
                      <TableRow key={goodie.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
                              {goodie.imageUrl ? (
                                <img src={goodie.imageUrl} alt={goodie.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{goodie.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {goodie.description || "Pas de description"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{goodie.price} DH</TableCell>
                        <TableCell>{goodie.category || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {goodie.isBestSeller && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Best-seller
                              </Badge>
                            )}
                            {goodie.isRamadanEdition && (
                              <Badge variant="secondary" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Ramadan
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={goodie.isActive ? "default" : "secondary"}>
                            {goodie.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog open={editingGoodie?.id === goodie.id} onOpenChange={(open) => {
                              if (!open) {
                                setEditingGoodie(null);
                                resetForm();
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(goodie)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Modifier le produit</DialogTitle>
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

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Prix (DH) *</Label>
                                      <Input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Ordre d'affichage</Label>
                                      <Input
                                        type="number"
                                        value={formData.sortOrder}
                                        onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                                      />
                                    </div>
                                  </div>

                                  <ImageUploadField />

                                  <div className="space-y-2">
                                    <Label>Catégorie</Label>
                                    <Input
                                      value={formData.category}
                                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <Label>Actif</Label>
                                    <Switch
                                      checked={formData.isActive}
                                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
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
                              variant={goodie.isActive ? "outline" : "default"} 
                              size="sm"
                              onClick={() => toggleActive(goodie)}
                            >
                              {goodie.isActive ? "Désactiver" : "Activer"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-4" />
                <p>Aucun produit trouvé</p>
                <p className="text-sm">Créez votre premier produit pour commencer</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
