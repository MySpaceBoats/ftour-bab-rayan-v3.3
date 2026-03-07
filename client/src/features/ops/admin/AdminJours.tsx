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
  ArrowLeft, Calendar, Plus, Loader2, Users, CheckCircle, XCircle, Edit, Trash2
} from "lucide-react";

export default function AdminJours() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [bulkCreate, setBulkCreate] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    date: "",
    dayNumber: 1,
    capacity: 120,
    location: "",
    iftarTime: "18:30",
    notes: "",
  });

  const [bulkFormData, setBulkFormData] = useState({
    startDate: "",
    daysCount: 30,
    capacity: 120,
    location: "",
    iftarTime: "18:30",
  });

  const { data: days, isLoading, refetch } = trpc.days.list.useQuery();

  const createMutation = trpc.days.create.useMutation({
    onSuccess: () => {
      toast.success("Jour créé avec succès");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const bulkCreateMutation = trpc.days.bulkCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} jours créés avec succès`);
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.days.update.useMutation({
    onSuccess: () => {
      toast.success("Jour mis à jour");
      setEditingDay(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const setOpenStatusMutation = trpc.days.setOpenStatus.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(variables.isOpen ? "Jour ouvert" : "Jour fermé");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.days.delete.useMutation({
    onSuccess: () => {
      toast.success("Jour supprimé");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      date: "",
      dayNumber: 1,
      capacity: 120,
      location: "",
      iftarTime: "18:30",
      notes: "",
    });
    setBulkFormData({
      startDate: "",
      daysCount: 30,
      capacity: 120,
      location: "",
      iftarTime: "18:30",
    });
  };

  const handleCreate = () => {
    if (bulkCreate) {
      if (!bulkFormData.startDate) {
        toast.error("Veuillez sélectionner une date de début");
        return;
      }
      bulkCreateMutation.mutate(bulkFormData);
    } else {
      if (!formData.date) {
        toast.error("Veuillez sélectionner une date");
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const toggleDayOpen = (dayId: number, currentIsOpen: boolean) => {
    setOpenStatusMutation.mutate({ id: dayId, isOpen: !currentIsOpen });
  };

  const handleDeleteDay = (dayId: number) => {
    if (confirm("\u00cates-vous s\u00fbr de vouloir supprimer ce jour ? Cette action est irr\u00e9versible.")) {
      deleteMutation.mutate({ id: dayId });
    }
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
              <h1 className="font-bold text-lg">Gestion du calendrier</h1>
              <p className="text-xs text-muted-foreground">
                {days?.length || 0} jour(s) configuré(s)
              </p>
            </div>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Ajouter des jours</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={bulkCreate}
                    onCheckedChange={setBulkCreate}
                  />
                  <Label>Création en masse (30 jours)</Label>
                </div>

                {bulkCreate ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date de début</Label>
                        <Input
                          type="date"
                          value={bulkFormData.startDate}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, startDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre de jours</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={bulkFormData.daysCount}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, daysCount: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Capacité par jour</Label>
                        <Input
                          type="number"
                          min={1}
                          value={bulkFormData.capacity}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, capacity: parseInt(e.target.value) })}
                        />
                      </div>
                    <div className="space-y-2">
                      <Label>Lieu</Label>
                      <Input
                        value={bulkFormData.location}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, location: e.target.value })}
                        placeholder="Adresse de l'événement"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Heure d'iftar</Label>
                        <Input
                          type="time"
                          value={bulkFormData.iftarTime}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, iftarTime: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Numéro du jour</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={formData.dayNumber}
                          onChange={(e) => setFormData({ ...formData, dayNumber: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Capacité maximale</Label>
                        <Input
                          type="number"
                          min={1}
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                        />
                      </div>
                    <div className="space-y-2">
                      <Label>Lieu</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Adresse de l'événement"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Heure d'iftar</Label>
                        <Input
                          type="time"
                          value={formData.iftarTime}
                          onChange={(e) => setFormData({ ...formData, iftarTime: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleCreate} 
                  className="w-full"
                  disabled={createMutation.isPending || bulkCreateMutation.isPending}
                >
                  {(createMutation.isPending || bulkCreateMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {bulkCreate ? "Créer les jours" : "Créer le jour"}
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
              <div className="text-2xl font-bold">{days?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total jours</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {days?.filter((d: any) => d.isOpen).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Ouverts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {days?.filter((d: any) => !d.isOpen).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Fermés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {days?.reduce((acc: number, d: any) => acc + (d.registeredCount || 0), 0) || 0}
              </div>
              <div className="text-xs text-muted-foreground">Inscrits total</div>
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
            ) : days && days.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jour</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Capacité</TableHead>
                      <TableHead>Inscrits</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.map((day: any) => (
                      <TableRow key={day.id}>
                        <TableCell>
                          <span className="font-bold">Jour {day.dayNumber}</span>
                        </TableCell>
                        <TableCell>
                          {new Date(day.date).toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </TableCell>
                        <TableCell>{day.capacity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className={(day.registeredCount || 0) >= day.capacity ? "text-red-600 font-bold" : ""}>
                              {day.registeredCount || 0}/{day.capacity}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {day.isOpen ? (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ouvert
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Fermé
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleDayOpen(day.id, day.isOpen)}
                              disabled={setOpenStatusMutation.isPending}
                            >
                              {day.isOpen ? "Fermer" : "Ouvrir"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteDay(day.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
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
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">Aucun jour configuré</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Configurer le calendrier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
