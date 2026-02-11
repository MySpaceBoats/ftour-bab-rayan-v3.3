import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/app/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar, Users, MapPin, Phone, Mail, CheckCircle2, XCircle, Clock, Download, Search, Filter, Eye, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'checked_in';

const statusColors: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
  checked_in: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<ReservationStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  no_show: 'Non présenté',
  checked_in: 'Présent',
};

export default function AdminReservations() {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch data
  const { data: reservations, isLoading, refetch } = trpc.reservations.list.useQuery({
    date: dateFilter || undefined,
    restaurantId: restaurantFilter !== 'all' ? parseInt(restaurantFilter) : undefined,
    status: statusFilter !== 'all' ? statusFilter as ReservationStatus : undefined,
  });

  const { data: restaurants } = trpc.restaurants.list.useQuery({});
  const { data: stats } = trpc.reservations.getStats.useQuery({
    date: dateFilter || undefined,
    restaurantId: restaurantFilter !== 'all' ? parseInt(restaurantFilter) : undefined,
  });

  // Mutations
  const updateStatus = trpc.reservations.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const checkinReservation = trpc.reservations.checkin.useMutation({
    onSuccess: () => {
      toast.success('Check-in effectué');
      refetch();
      setShowDetailsDialog(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du check-in');
    },
  });

  // Filter reservations by search query
  const filteredReservations = reservations?.filter((r: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.fullName.toLowerCase().includes(query) ||
      r.phone.includes(query) ||
      r.referenceCode.toLowerCase().includes(query) ||
      r.email?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleExportCSV = () => {
    if (!filteredReservations || filteredReservations.length === 0) {
      toast.error('Aucune réservation à exporter');
      return;
    }

    const headers = ['Référence', 'Date', 'Restaurant', 'Nom', 'Téléphone', 'Email', 'Places', 'Statut', 'Créé le'];
    const rows = filteredReservations.map((r: any) => [
      r.referenceCode,
      r.date,
      r.restaurant?.name || '',
      r.fullName,
      r.phone,
      r.email || '',
      r.seats,
      statusLabels[r.status as ReservationStatus],
      new Date(r.createdAt).toLocaleString('fr-FR'),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservations_${dateFilter || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Export CSV téléchargé');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#5d5a3c]">Réservations Ftour</h1>
            <p className="text-[#6b6b4e]">Gérez les réservations des restaurants solidaires</p>
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
              onClick={handleExportCSV}
              className="bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-[#d4d4aa]">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-[#5d5a3c]">{stats?.total || 0}</div>
              <div className="text-sm text-[#6b6b4e]">Total</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-700">{stats?.confirmed || 0}</div>
              <div className="text-sm text-green-600">Confirmées</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-700">{stats?.checkedIn || 0}</div>
              <div className="text-sm text-blue-600">Présents</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-700">{stats?.pending || 0}</div>
              <div className="text-sm text-yellow-600">En attente</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-700">{stats?.cancelled || 0}</div>
              <div className="text-sm text-red-600">Annulées</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-[#d4d4aa]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-[#5d5a3c]">
              <Filter className="w-5 h-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-[#6b6b4e] mb-1 block">Date</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border-[#d4d4aa]"
                />
              </div>
              <div>
                <label className="text-sm text-[#6b6b4e] mb-1 block">Restaurant</label>
                <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                  <SelectTrigger className="border-[#d4d4aa]">
                    <SelectValue placeholder="Tous les restaurants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les restaurants</SelectItem>
                    {restaurants?.map((r: any) => (
                      <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#6b6b4e] mb-1 block">Statut</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="border-[#d4d4aa]">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="confirmed">Confirmée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                    <SelectItem value="no_show">Non présenté</SelectItem>
                    <SelectItem value="checked_in">Présent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#6b6b4e] mb-1 block">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b4e]" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom, téléphone, référence..."
                    className="pl-10 border-[#d4d4aa]"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reservations Table */}
        <Card className="border-[#d4d4aa]">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#5d5a3c] border-t-transparent rounded-full"></div>
              </div>
            ) : filteredReservations && filteredReservations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f5f5f0]">
                      <TableHead className="text-[#5d5a3c]">Référence</TableHead>
                      <TableHead className="text-[#5d5a3c]">Date</TableHead>
                      <TableHead className="text-[#5d5a3c]">Restaurant</TableHead>
                      <TableHead className="text-[#5d5a3c]">Nom</TableHead>
                      <TableHead className="text-[#5d5a3c]">Téléphone</TableHead>
                      <TableHead className="text-[#5d5a3c]">Places</TableHead>
                      <TableHead className="text-[#5d5a3c]">Statut</TableHead>
                      <TableHead className="text-[#5d5a3c]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReservations.map((reservation: any) => (
                      <TableRow key={reservation.id} className="hover:bg-[#f5f5f0]">
                        <TableCell className="font-mono text-sm">{reservation.referenceCode}</TableCell>
                        <TableCell>{formatDate(reservation.date)}</TableCell>
                        <TableCell>{reservation.restaurant?.name || '-'}</TableCell>
                        <TableCell className="font-medium">{reservation.fullName}</TableCell>
                        <TableCell>{reservation.phone}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-[#5d5a3c] text-[#5d5a3c]">
                            {reservation.seats} {reservation.seats > 1 ? 'places' : 'place'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[reservation.status as ReservationStatus]}>
                            {statusLabels[reservation.status as ReservationStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setShowDetailsDialog(true);
                              }}
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4 text-[#5d5a3c]" />
                            </Button>
                            {reservation.status === 'confirmed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => checkinReservation.mutate({ referenceCode: reservation.referenceCode })}
                                title="Check-in"
                              >
                                <UserCheck className="w-4 h-4 text-green-600" />
                              </Button>
                            )}
                            {reservation.status !== 'cancelled' && reservation.status !== 'checked_in' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStatus.mutate({ id: reservation.id, status: 'cancelled' })}
                                title="Annuler"
                              >
                                <XCircle className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-[#6b6b4e]">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune réservation trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#5d5a3c]">Détails de la réservation</DialogTitle>
              <DialogDescription>
                Référence: {selectedReservation?.referenceCode}
              </DialogDescription>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Date</label>
                    <p className="font-medium text-[#5d5a3c]">{formatDate(selectedReservation.date)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Restaurant</label>
                    <p className="font-medium text-[#5d5a3c]">{selectedReservation.restaurant?.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Nom complet</label>
                    <p className="font-medium text-[#5d5a3c]">{selectedReservation.fullName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Téléphone</label>
                    <p className="font-medium text-[#5d5a3c]">{selectedReservation.phone}</p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Email</label>
                    <p className="font-medium text-[#5d5a3c]">{selectedReservation.email || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Places</label>
                    <p className="font-medium text-[#5d5a3c]">{selectedReservation.seats}</p>
                  </div>
                </div>
                {selectedReservation.notes && (
                  <div>
                    <label className="text-sm text-[#6b6b4e]">Notes</label>
                    <p className="font-medium text-[#5d5a3c]">{selectedReservation.notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-[#6b6b4e]">Statut:</label>
                  <Badge className={statusColors[selectedReservation.status as ReservationStatus]}>
                    {statusLabels[selectedReservation.status as ReservationStatus]}
                  </Badge>
                </div>
                
                {/* QR Code */}
                <div className="text-center border-t pt-4">
                  <p className="text-sm text-[#6b6b4e] mb-2">QR Code de la réservation</p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://ftourbabrayan.ma/checkin-reservation/${selectedReservation.qrToken}`)}`}
                    alt="QR Code"
                    className="mx-auto rounded-lg"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              {selectedReservation?.status === 'confirmed' && (
                <Button
                  onClick={() => checkinReservation.mutate({ referenceCode: selectedReservation.referenceCode })}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Check-in
                </Button>
              )}
              {selectedReservation?.status !== 'cancelled' && selectedReservation?.status !== 'checked_in' && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    updateStatus.mutate({ id: selectedReservation.id, status: 'cancelled' });
                    setShowDetailsDialog(false);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDetailsDialog(false)}
              >
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
