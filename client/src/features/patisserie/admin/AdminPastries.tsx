import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';
import { Link } from 'wouter';
import {
  Download, Filter, Search, ArrowLeft, Loader2, Eye, CheckCircle, XCircle,
  Package, CakeSlice, Mail, Phone, User
} from 'lucide-react';

export default function AdminPastries() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: orders = [], isLoading, error } = trpc.pastryOrders.list.useQuery({
    status: statusFilter === 'all' ? undefined : (statusFilter as any),
    paymentStatus: paymentFilter === 'all' ? undefined : (paymentFilter as any),
  });

  // Mutations
  const updateStatus = trpc.pastryOrders.updateStatus.useMutation({
    onSuccess: () => {
      utils.pastryOrders.list.invalidate();
      toast.success('Statut mis à jour');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleUpdateStatus = (orderId: number, orderStatus: string, paymentStatus?: string) => {
    updateStatus.mutate({
      orderId,
      orderStatus: orderStatus as any,
      ...(paymentStatus ? { paymentStatus: paymentStatus as any } : {}),
    });
  };

  // Filter orders
  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch =
      order.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone?.includes(searchTerm);

    const orderDate = new Date(order.created_at);
    const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || orderDate <= new Date(dateTo);

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  // Statistics
  const stats = {
    total: filteredOrders.length,
    paid: filteredOrders.filter((o: any) => o.payment_status === 'paid' || o.payment_status === 'confirmed').length,
    pending: filteredOrders.filter((o: any) => o.payment_status === 'pending').length,
    totalAmount: filteredOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0),
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Référence', 'Client', 'Téléphone', 'Email', 'Montant', 'Paiement', 'Statut', 'Date'];
    const rows = filteredOrders.map((order: any) => [
      order.reference, order.customer_name, order.phone, order.email || '',
      order.total_amount, order.payment_method, order.order_status,
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

  const statusBadge = (status: string) => {
    switch (status) {
      case 'handed': case 'delivered': return <Badge className="bg-blue-100 text-blue-800">Remis</Badge>;
      case 'paid': case 'confirmed': return <Badge className="bg-green-100 text-green-800">Confirmé</Badge>;
      case 'reserved': return <Badge className="bg-yellow-100 text-yellow-800">Réservé</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Annulé</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const paymentBadge = (status: string) => {
    switch (status) {
      case 'paid': case 'confirmed': return <Badge className="bg-green-100 text-green-800">Payé</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Annulé</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
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
              <CakeSlice className="w-6 h-6" /> Gestion Pâtisserie
            </h1>
            <p className="text-muted-foreground">Gérez les commandes de pâtisserie solidaire</p>
          </div>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total commandes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
          <p className="text-sm text-muted-foreground">Payées</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          <p className="text-sm text-muted-foreground">En attente</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.totalAmount} DH</p>
          <p className="text-sm text-muted-foreground">Montant total</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" />
          <h2 className="font-semibold">Filtres</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-sm">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Référence, client, tél..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
          </div>
          <div>
            <Label className="text-sm">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="reserved">Réservé</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="handed">Remis</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Paiement</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">De</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">À</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPaymentFilter('all'); setDateFrom(''); setDateTo(''); }}>
            Réinitialiser
          </Button>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-red-600">Erreur: {error.message}</p>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Orders Table */}
      {!isLoading && !error && (
        <Card className="overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CakeSlice className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Aucune commande trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Téléphone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Montant</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Paiement</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm">{order.reference}</td>
                      <td className="px-4 py-3 text-sm">{order.customer_name}</td>
                      <td className="px-4 py-3 text-sm">{order.phone}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{order.total_amount} DH</td>
                      <td className="px-4 py-3">{paymentBadge(order.payment_status)}</td>
                      <td className="px-4 py-3">{statusBadge(order.order_status)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {order.order_status === 'reserved' && (
                            <Button variant="ghost" size="sm" className="text-green-600"
                              onClick={() => handleUpdateStatus(order.id, 'paid', 'confirmed')}
                              disabled={updateStatus.isPending}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {(order.order_status === 'reserved' || order.order_status === 'paid') && (
                            <Button variant="ghost" size="sm" className="text-red-600"
                              onClick={() => handleUpdateStatus(order.id, 'cancelled', 'cancelled')}
                              disabled={updateStatus.isPending}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {order.order_status === 'paid' && (
                            <Button variant="ghost" size="sm" className="text-blue-600"
                              onClick={() => handleUpdateStatus(order.id, 'handed')}
                              disabled={updateStatus.isPending}>
                              <Package className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Detail Drawer */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-lg bg-background h-full overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Détails Commande</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>✕</Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {statusBadge(selectedOrder.order_status)}
                {paymentBadge(selectedOrder.payment_status)}
              </div>

              <Card className="p-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Client</h3>
                <p><strong>Nom:</strong> {selectedOrder.customer_name}</p>
                <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {selectedOrder.phone}</p>
                {selectedOrder.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {selectedOrder.email}</p>}
              </Card>

              <Card className="p-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2"><CakeSlice className="w-4 h-4" /> Commande</h3>
                <p><strong>Référence:</strong> {selectedOrder.reference}</p>
                <p><strong>Montant:</strong> {selectedOrder.total_amount} DH</p>
                <p><strong>Méthode:</strong> {selectedOrder.payment_method}</p>
                <p><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleDateString('fr-FR')}</p>
                {selectedOrder.qr_token && <p><strong>QR Token:</strong> {selectedOrder.qr_token}</p>}
              </Card>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4">
                {selectedOrder.order_status === 'reserved' && (
                  <>
                    <Button className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => { handleUpdateStatus(selectedOrder.id, 'paid', 'confirmed'); setShowDetail(false); }}
                      disabled={updateStatus.isPending}>
                      {updateStatus.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Confirmer le paiement
                    </Button>
                    <Button variant="destructive" className="w-full"
                      onClick={() => { handleUpdateStatus(selectedOrder.id, 'cancelled', 'cancelled'); setShowDetail(false); }}
                      disabled={updateStatus.isPending}>
                      <XCircle className="w-4 h-4 mr-2" /> Annuler la commande
                    </Button>
                  </>
                )}
                {selectedOrder.order_status === 'paid' && (
                  <>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => { handleUpdateStatus(selectedOrder.id, 'handed'); setShowDetail(false); }}
                      disabled={updateStatus.isPending}>
                      {updateStatus.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
                      Marquer comme remis
                    </Button>
                    <Button variant="destructive" className="w-full"
                      onClick={() => { handleUpdateStatus(selectedOrder.id, 'cancelled', 'cancelled'); setShowDetail(false); }}
                      disabled={updateStatus.isPending}>
                      <XCircle className="w-4 h-4 mr-2" /> Annuler la commande
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
