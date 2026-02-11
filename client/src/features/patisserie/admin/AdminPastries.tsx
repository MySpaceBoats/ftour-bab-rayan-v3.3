import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { Download, Filter, Search } from 'lucide-react';

interface PastryOrder {
  id: number;
  reference: string;
  customer_name: string;
  phone: string;
  email?: string;
  total_amount: number;
  payment_method: string;
  business_status: string;
  payment_status: string;
  created_at: string;
}

export default function AdminPastries() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: orders = [], isLoading } = trpc.pastryOrders.list.useQuery({
    status: statusFilter === 'all' ? undefined : (statusFilter as any),
    paymentStatus: paymentFilter === 'all' ? undefined : (paymentFilter as any),
  });

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone.includes(searchTerm);

    const orderDate = new Date(order.created_at);
    const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || orderDate <= new Date(dateTo);

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  // Statistics
  const stats = {
    total: filteredOrders.length,
    paid: filteredOrders.filter(o => o.payment_status === 'paid').length,
    pending: filteredOrders.filter(o => o.payment_status === 'pending').length,
    totalAmount: filteredOrders.reduce((sum, o) => sum + o.total_amount, 0),
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Référence', 'Client', 'Téléphone', 'Email', 'Montant', 'Paiement', 'Statut', 'Date'];
    const rows = filteredOrders.map(order => [
      order.reference,
      order.customer_name,
      order.phone,
      order.email || '',
      order.total_amount,
      order.payment_method,
      order.business_status,
      new Date(order.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pastries-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-8 border-b">
        <div className="container">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestion Pâtisserie</h1>
          <p className="text-muted-foreground">Gérez les commandes de pâtisserie solidaire</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total commandes</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Payées</p>
            <p className="text-3xl font-bold text-green-600">{stats.paid}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">En attente</p>
            <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Montant total</p>
            <p className="text-3xl font-bold text-primary">{stats.totalAmount} DH</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5" />
            <h2 className="font-semibold text-lg">Filtres</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="text-sm">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Référence, client, téléphone..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="reserved">Réservé</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="delivered">Livré</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Paiement</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="failed">Échoué</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">De</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm">À</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPaymentFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Réinitialiser
            </Button>
            <Button onClick={handleExportCSV} className="ml-auto">
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </Card>

        {/* Orders Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucune commande trouvée</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Référence</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Client</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Téléphone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Montant</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Paiement</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Statut</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-3 font-mono text-sm">{order.reference}</td>
                      <td className="px-6 py-3 text-sm">{order.customer_name}</td>
                      <td className="px-6 py-3 text-sm">{order.phone}</td>
                      <td className="px-6 py-3 text-sm font-semibold">{order.total_amount} DH</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          order.payment_status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : order.payment_status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {order.payment_status === 'paid' ? 'Payé' : order.payment_status === 'pending' ? 'En attente' : 'Échoué'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          order.business_status === 'delivered'
                            ? 'bg-blue-100 text-blue-800'
                            : order.business_status === 'confirmed'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.business_status === 'delivered' ? 'Livré' : order.business_status === 'confirmed' ? 'Confirmé' : 'Réservé'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
