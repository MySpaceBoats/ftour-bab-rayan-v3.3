import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft, Plus, Loader2, ShoppingBag, Package, Edit, Star, Sparkles
} from "lucide-react";

export default function AdminGoodies() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGoodie, setEditingGoodie] = useState<any>(null);
  
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
  };

  const toggleActive = (goodie: any) => {
    updateMutation.mutate({
      id: goodie.id,
      isActive: !goodie.isActive,
    });
  };

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
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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

                <div className="space-y-2">
                  <Label>URL de l'image</Label>
                  <Input
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

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
                  disabled={createMutation.isPending}
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
                      <TableHead>Stock</TableHead>
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
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              {goodie.imageUrl ? (
                                <img src={goodie.imageUrl} alt={goodie.name} className="w-full h-full object-cover rounded" />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{goodie.name}</div>
                              <div className="text-xs text-muted-foreground">{goodie.category || "Sans catégorie"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold">{goodie.price} DH</span>
                        </TableCell>
                        <TableCell>
                          <span className={goodie.totalStock <= 5 ? "text-red-600 font-bold" : ""}>
                            {goodie.totalStock || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {goodie.isBestSeller && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Star className="h-3 w-3 mr-1" />
                                Best-seller
                              </Badge>
                            )}
                            {goodie.isNew && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Nouveau
                              </Badge>
                            )}
                            {goodie.isRamadanEdition && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Ramadan
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {goodie.isActive ? (
                            <Badge className="bg-green-500">Actif</Badge>
                          ) : (
                            <Badge variant="secondary">Inactif</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(goodie)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
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
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">Aucun produit dans le catalogue</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un produit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editingGoodie !== null} onOpenChange={() => { setEditingGoodie(null); resetForm(); }}>
        <DialogContent className="max-w-lg">
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

            <div className="space-y-2">
              <Label>URL de l'image</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
              onClick={handleUpdate} 
              className="w-full"
              disabled={updateMutation.isPending}
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
    </div>
  );
}
