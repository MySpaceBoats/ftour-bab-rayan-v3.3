import { useState } from 'react';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Filter } from 'lucide-react';

export default function AdminCompanyBookings() {
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0,
  });

  const { data: bookings, isLoading } = trpc.companyBookings.list.useQuery({
    status: filters.status || undefined,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    limit: filters.limit,
    offset: filters.offset,
  });

  const handleExportCSV = () => {
    if (!bookings || bookings.length === 0) return;

    const csv = [
      ['Référence', 'Entreprise', 'Contact', 'Email', 'Téléphone', 'Participants', 'Date', 'Statut', 'Paiement'],
      ...bookings.map((b: any) => [
        b.reference,
        b.companyName,
        b.contactName,
        b.contactEmail,
        b.contactPhone,
        b.participantsCount,
        new Date(b.date).toLocaleDateString('fr-FR'),
        b.status,
        b.paymentStatus,
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Réservations Entreprise</h1>
        <p className="text-muted-foreground">Gérez toutes les réservations des entreprises</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Statut</label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Date début</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Date fin</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              />
            </div>

            <div className="flex items-end">
              <Button className="w-full" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Réservations ({bookings?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : bookings && bookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Référence</th>
                    <th className="text-left py-3 px-4 font-semibold">Entreprise</th>
                    <th className="text-left py-3 px-4 font-semibold">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold">Participants</th>
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Statut</th>
                    <th className="text-left py-3 px-4 font-semibold">Paiement</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking: any) => (
                    <tr key={booking.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-sm">{booking.reference}</td>
                      <td className="py-3 px-4">{booking.companyName}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{booking.contactName}</p>
                          <p className="text-sm text-muted-foreground">{booking.contactEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">{booking.participantsCount}</td>
                      <td className="py-3 px-4">{new Date(booking.date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status === 'confirmed' ? 'Confirmée' :
                           booking.status === 'pending' ? 'En attente' : 'Annulée'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                          booking.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.paymentStatus === 'paid' ? 'Payée' :
                           booking.paymentStatus === 'pending' ? 'En attente' : 'Échouée'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm">Voir détails</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucune réservation trouvée
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
