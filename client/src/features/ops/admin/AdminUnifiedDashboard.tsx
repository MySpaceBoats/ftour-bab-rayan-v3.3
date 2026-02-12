import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n';
import { Download, Filter, Search, TrendingUp } from 'lucide-react';

interface UnifiedOrder {
  id: number;
  reference: string;
  module: 'goodies' | 'pastry' | 'donation' | 'ftour';
  customer_name: string;
  phone: string;
  email?: string;
  total_amount: number;
  payment_method: string;
  business_status: string;
  payment_status: string;
  channel: 'online' | 'on_site_qr' | 'on_site_admin';
  created_at: string;
}

// Mock data for demonstration
const mockOrders: UnifiedOrder[] = [
  {
    id: 1,
    reference: 'GOD-001',
    module: 'goodies',
    customer_name: 'Ahmed Hassan',
    phone: '+212612345678',
    email: 'ahmed@example.com',
    total_amount: 150,
    payment_method: 'cash',
    business_status: 'delivered',
    payment_status: 'paid',
    channel: 'online',
    created_at: '2026-02-08T10:00:00Z',
  },
  {
    id: 2,
    reference: 'PAS-001',
    module: 'pastry',
    customer_name: 'Fatima Zahra',
    phone: '+212698765432',
    email: 'fatima@example.com',
    total_amount: 200,
    payment_method: 'bank_transfer',
    business_status: 'confirmed',
    payment_status: 'pending',
    channel: 'on_site_qr',
    created_at: '2026-02-08T11:30:00Z',
  },
  {
    id: 3,
    reference: 'DON-001',
    module: 'donation',
    customer_name: 'Mohammed Ali',
    phone: '+212612111111',
    total_amount: 500,
    payment_method: 'paypal',
    business_status: 'confirmed',
    payment_status: 'paid',
    channel: 'online',
    created_at: '2026-02-08T14:00:00Z',
  },
];

export default function AdminUnifiedDashboard() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter orders
  const filteredOrders = mockOrders.filter(order => {
    const matchesSearch =
      order.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone.includes(searchTerm);

    const matchesModule = moduleFilter === 'all' || order.module === moduleFilter;
    const matchesStatus = statusFilter === 'all' || order.business_status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
    const matchesChannel = channelFilter === 'all' || order.channel === channelFilter;

    const orderDate = new Date(order.created_at);
    const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || orderDate <= new Date(dateTo);

    return (
      matchesSearch &&
      matchesModule &&
      matchesStatus &&
      matchesPayment &&
      matchesChannel &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  // Statistics
  const stats = {
    total: filteredOrders.length,
    paid: filteredOrders.filter(o => o.payment_status === 'paid').length,
    pending: filteredOrders.filter(o => o.payment_status === 'pending').length,
    totalAmount: filteredOrders.reduce((sum, o) => sum + o.total_amount, 0),
    byModule: {
      goodies: filteredOrders.filter(o => o.module === 'goodies').length,
      pastry: filteredOrders.filter(o => o.module === 'pastry').length,
      donation: filteredOrders.filter(o => o.module === 'donation').length,
      ftour: filteredOrders.filter(o => o.module === 'ftour').length,
    },
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Référence', 'Module', 'Client', 'Téléphone', 'Email', 'Montant', 'Paiement', 'Statut', 'Canal', 'Date'];
    const rows = filteredOrders.map(order => [
      order.reference,
      order.module,
      order.customer_name,
      order.phone,
      order.email || '',
      order.total_amount,
      order.payment_method,
      order.business_status,
      order.channel,
      new Date(order.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unified-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getModuleLabel = (module: string) => {
    const labels: Record<string, string> = {
      goodies: 'Goodies',
      pastry: 'Pâtisserie',
      donation: 'Donation',
      ftour: 'Ftour',
    };
    return labels[module] || module;
  };

  const getChannelLabel = (channel: string) => {
    const labels: Record<string, string> = {
      online: 'En ligne',
      on_site_qr: 'QR Code',
      on_site_admin: 'Admin',
    };
    return labels[channel] || channel;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">Dashboard Unifié</h1>
          </div>
          <p className="text-muted-foreground">Vue centralisée de tous les services (Goodies, Pâtisserie, Dons, Ftour)</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total</p>
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
            <p className="text-sm text-muted-foreground mb-1">Montant</p>
            <p className="text-3xl font-bold text-primary">{stats.totalAmount} DH</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Modules</p>
            <div className="text-xs space-y-1">
              <p>G:{stats.byModule.goodies} P:{stats.byModule.pastry}</p>
              <p>D:{stats.byModule.donation} F:{stats.byModule.ftour}</p>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5" />
            <h2 className="font-semibold text-lg">Filtres</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-sm">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Référence, client..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Module</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="goodies">Goodies</SelectItem>
                  <SelectItem value="pastry">Pâtisserie</SelectItem>
                  <SelectItem value="donation">Donation</SelectItem>
                  <SelectItem value="ftour">Ftour</SelectItem>
                </SelectContent>
              </Select>
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
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Canal</Label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="online">En ligne</SelectItem>
                  <SelectItem value="on_site_qr">QR Code</SelectItem>
                  <SelectItem value="on_site_admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Période</Label>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="De" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setModuleFilter('all');
                setStatusFilter('all');
                setPaymentFilter('all');
                setChannelFilter('all');
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Référence</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Module</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Client</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Montant</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Paiement</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Statut</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Canal</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-3 font-mono text-sm">{order.reference}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {getModuleLabel(order.module)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">{order.customer_name}</td>
                    <td className="px-6 py-3 text-sm font-semibold">{order.total_amount} DH</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        order.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.payment_status === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        {order.business_status === 'delivered' ? 'Livré' : order.business_status === 'confirmed' ? 'Confirmé' : 'Réservé'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">{getChannelLabel(order.channel)}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
