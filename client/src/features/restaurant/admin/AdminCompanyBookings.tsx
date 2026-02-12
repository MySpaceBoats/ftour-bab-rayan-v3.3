import { useState } from 'react';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Filter, Loader2, CheckCircle, XCircle, Eye, AlertTriangle,
  Building2, Users, Calendar, Mail, Phone
} from 'lucide-react';

export default function AdminCompanyBookings() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0,
  });
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: bookings, isLoading, error } = trpc.companyBookings.list.useQuery({
    status: filters.status || undefined,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    limit: filters.limit,
    offset: filters.offset,
  });

  // Mutations
  const updateStatus = trpc.companyBookings.updateStatus.useMutation({
    onSuccess: () => {
      utils.companyBookings.list.invalidate();
      toast.success('Statut mis à jour');
      setShowDetail(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelBooking = trpc.companyBookings.updateStatus.useMutation({
    onSuccess: () => {
      utils.companyBookings.list.invalidate();
      toast.success('Réservation annulée');
      setShowDetail(false);
    },
       onError: (err: any) => toast.error(err.message),
  });

  const handleConfirm = (id: number) => {
    updateStatus.mutate({ id, status: 'confirmed' });
  };

  const handleCancel = (id: number) => {
    cancelBooking.mutate({ id, status: 'cancelled' });
  };

  const handleExportCSV = () => {
    if (!bookings || bookings.length === 0) return;
    const csv = [
      ['Référence', 'Entreprise', 'ICE', 'Secteur', 'Contact', 'Email', 'Téléphone', 'Participants', 'Date', 'Statut', 'Paiement', 'Notes'],
      ...bookings.map((b: any) => [
        b.reference, b.companyName, b.companyICE || '', b.companySector || '',
        b.contactName, b.contactEmail, b.contactPhone, b.participantsCount,
        new Date(b.date).toLocaleDateString('fr-FR'), b.status, b.paymentStatus, b.notes || '',
      ])
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Stats
  const stats = bookings ? {
    total: bookings.length,
    pending: bookings.filter((b: any) => b.status === 'pending').length,
    confirmed: bookings.filter((b: any) => b.status === 'confirmed').length,
    cancelled: bookings.filter((b: any) => b.status === 'cancelled').length,
    totalParticipants: bookings.reduce((sum: number, b: any) => sum + (b.participantsCount || 0), 0),
  } : { total: 0, pending: 0, confirmed: 0, cancelled: 0, totalParticipants: 0 };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge className="bg-green-100 text-green-800">Confirmée</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Annulée</Badge>;
      case 'no_show': return <Badge className="bg-gray-100 text-gray-800">Absent</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const paymentBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-800">Payée</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      default: return <Badge className="bg-red-100 text-red-800">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Réservations Entreprise
            </h1>
            <p className="text-muted-foreground">Gérez les réservations des entreprises et groupes corporate</p>
          </div>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p><p className="text-sm text-muted-foreground">En attente</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p><p className="text-sm text-muted-foreground">Confirmées</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p><p className="text-sm text-muted-foreground">Annulées</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.totalParticipants}</p><p className="text-sm text-muted-foreground">Participants</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="w-4 h-4" /> Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Statut</label>
              <Select value={filters.status || 'all'} onValueChange={(v) => setFilters({...filters, status: v === 'all' ? '' : v})}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Date début</label>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium">Date fin</label>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={() => setFilters({ status: '', startDate: '', endDate: '', limit: 50, offset: 0 })}>
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-red-600">Erreur: {error.message}</CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Réservations ({bookings?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings && bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Référence</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Entreprise</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Participants</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Statut</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Paiement</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking: any) => (
                      <tr key={booking.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-sm">{booking.reference}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{booking.companyName}</p>
                          {booking.companySector && <p className="text-xs text-muted-foreground">{booking.companySector}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{booking.contactName}</p>
                          <p className="text-xs text-muted-foreground">{booking.contactEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-center">{booking.participantsCount}</td>
                        <td className="py-3 px-4">{new Date(booking.date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 px-4">{statusBadge(booking.status)}</td>
                        <td className="py-3 px-4">{paymentBadge(booking.paymentStatus)}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBooking(booking); setShowDetail(true); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {booking.status === 'pending' && (
                              <>
                                <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleConfirm(booking.id)}
                                  disabled={updateStatus.isPending}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleCancel(booking.id)}
                                  disabled={cancelBooking.isPending}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {booking.status === 'confirmed' && (
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleCancel(booking.id)}
                                disabled={cancelBooking.isPending}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Aucune réservation entreprise trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Drawer */}
      {showDetail && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-lg bg-background h-full overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Détails Réservation</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>✕</Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {statusBadge(selectedBooking.status)}
                {paymentBadge(selectedBooking.paymentStatus)}
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Entreprise</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Nom:</strong> {selectedBooking.companyName}</p>
                  {selectedBooking.companyICE && <p><strong>ICE:</strong> {selectedBooking.companyICE}</p>}
                  {selectedBooking.companySector && <p><strong>Secteur:</strong> {selectedBooking.companySector}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Contact</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Nom:</strong> {selectedBooking.contactName}</p>
                  <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {selectedBooking.contactEmail}</p>
                  <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {selectedBooking.contactPhone}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Réservation</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Référence:</strong> {selectedBooking.reference}</p>
                  <p><strong>Date:</strong> {new Date(selectedBooking.date).toLocaleDateString('fr-FR')}</p>
                  <p className="flex items-center gap-2"><Users className="w-3 h-3" /> <strong>{selectedBooking.participantsCount}</strong> participants</p>
                  {selectedBooking.notes && <p><strong>Notes:</strong> {selectedBooking.notes}</p>}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4">
                {selectedBooking.status === 'pending' && (
                  <>
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleConfirm(selectedBooking.id)}
                      disabled={updateStatus.isPending}>
                      {updateStatus.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Confirmer la réservation
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => handleCancel(selectedBooking.id)}
                      disabled={cancelBooking.isPending}>
                      {cancelBooking.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Annuler la réservation
                    </Button>
                  </>
                )}
                {selectedBooking.status === 'confirmed' && (
                  <Button variant="destructive" className="w-full" onClick={() => handleCancel(selectedBooking.id)}
                    disabled={cancelBooking.isPending}>
                    {cancelBooking.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Annuler la réservation
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
