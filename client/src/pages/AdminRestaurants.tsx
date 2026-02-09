import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { MapPin, Phone, Users, Plus, Pencil, Trash2, Utensils, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface RestaurantFormData {
  name: string;
  address: string;
  phone: string;
  description: string;
  capacity: number;
  active: boolean;
}

const defaultFormData: RestaurantFormData = {
  name: '',
  address: '',
  phone: '',
  description: '',
  capacity: 50,
  active: true,
};

export default function AdminRestaurants() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<RestaurantFormData>(defaultFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // Fetch restaurants
  const { data: restaurants, isLoading, refetch } = trpc.restaurants.list.useQuery({});

  // Mutations
  const createRestaurant = trpc.restaurants.create.useMutation({
    onSuccess: () => {
      toast.success('Restaurant créé avec succès');
      refetch();
      setShowDialog(false);
      setFormData(defaultFormData);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  const updateRestaurant = trpc.restaurants.update.useMutation({
    onSuccess: () => {
      toast.success('Restaurant mis à jour');
      refetch();
      setShowDialog(false);
      setEditingId(null);
      setFormData(defaultFormData);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const deleteRestaurant = trpc.restaurants.delete.useMutation({
    onSuccess: () => {
      toast.success('Restaurant supprimé');
      refetch();
      setShowDeleteConfirm(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  const handleEdit = (restaurant: any) => {
    setEditingId(restaurant.id);
    setFormData({
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone || '',
      description: restaurant.description || '',
      capacity: restaurant.capacity,
      active: restaurant.active,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    if (!formData.address.trim()) {
      toast.error("L'adresse est requise");
      return;
    }
    if (formData.capacity > 50) {
      toast.error('La capacité maximale est de 50 places');
      return;
    }

    if (editingId) {
      updateRestaurant.mutate({
        id: editingId,
        ...formData,
      });
    } else {
      createRestaurant.mutate(formData);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#5d5a3c]">Restaurants solidaires</h1>
            <p className="text-[#6b6b4e]">Gérez les lieux de Ftour</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-[#5d5a3c] text-[#5d5a3c]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData(defaultFormData);
                setShowDialog(true);
              }}
              className="bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un restaurant
            </Button>
          </div>
        </div>

        {/* Restaurants Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-[#5d5a3c] border-t-transparent rounded-full"></div>
          </div>
        ) : restaurants && restaurants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((restaurant: any) => (
              <Card key={restaurant.id} className={`border-[#d4d4aa] ${!restaurant.active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-[#5d5a3c] flex items-center gap-2">
                      <Utensils className="w-5 h-5" />
                      {restaurant.name}
                    </CardTitle>
                    <Badge variant={restaurant.active ? 'default' : 'secondary'}>
                      {restaurant.active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-[#6b6b4e]">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{restaurant.address}</span>
                  </div>
                  {restaurant.phone && (
                    <div className="flex items-center gap-2 text-sm text-[#6b6b4e]">
                      <Phone className="w-4 h-4" />
                      <span>{restaurant.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-[#6b6b4e]">
                    <Users className="w-4 h-4" />
                    <span>Capacité: {restaurant.capacity} places</span>
                  </div>
                  {restaurant.description && (
                    <p className="text-sm text-[#6b6b4e] line-clamp-2">{restaurant.description}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(restaurant)}
                      className="flex-1 border-[#5d5a3c] text-[#5d5a3c]"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(restaurant.id)}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-[#d4d4aa]">
            <CardContent className="py-12 text-center">
              <Utensils className="w-12 h-12 mx-auto mb-4 text-[#6b6b4e] opacity-50" />
              <p className="text-[#6b6b4e]">Aucun restaurant configuré</p>
              <Button
                onClick={() => {
                  setEditingId(null);
                  setFormData(defaultFormData);
                  setShowDialog(true);
                }}
                className="mt-4 bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter le premier restaurant
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#5d5a3c]">
                {editingId ? 'Modifier le restaurant' : 'Nouveau restaurant'}
              </DialogTitle>
              <DialogDescription>
                {editingId ? 'Modifiez les informations du restaurant' : 'Ajoutez un nouveau lieu de Restaurant Solidaire'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-[#5d5a3c]">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Restaurant Bab Rayan"
                  className="mt-1 border-[#d4d4aa]"
                />
              </div>
              <div>
                <Label htmlFor="address" className="text-[#5d5a3c]">Adresse *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="4 rue Bayt Lham, quartier Palmier, Casablanca"
                  className="mt-1 border-[#d4d4aa]"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-[#5d5a3c]">Téléphone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+212 664-887978"
                  className="mt-1 border-[#d4d4aa]"
                />
              </div>
              <div>
                <Label htmlFor="capacity" className="text-[#5d5a3c]">Capacité (places)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 100 })}
                  min={1}
                  className="mt-1 border-[#d4d4aa]"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-[#5d5a3c]">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du lieu..."
                  className="mt-1 border-[#d4d4aa]"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active" className="text-[#5d5a3c]">Restaurant actif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createRestaurant.isPending || updateRestaurant.isPending}
                className="bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
              >
                {(createRestaurant.isPending || updateRestaurant.isPending) ? (
                  <div className="animate-spin w-4 h-4 border-2 border-[#f5f5dc] border-t-transparent rounded-full mr-2" />
                ) : null}
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">Supprimer le restaurant</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer ce restaurant ? Cette action est irréversible et supprimera également toutes les réservations associées.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => showDeleteConfirm && deleteRestaurant.mutate({ id: showDeleteConfirm })}
                disabled={deleteRestaurant.isPending}
              >
                {deleteRestaurant.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                ) : null}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
