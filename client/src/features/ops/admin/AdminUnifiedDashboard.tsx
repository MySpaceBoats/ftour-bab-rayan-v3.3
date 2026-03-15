import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle, CreditCard, Download, ExternalLink,
  Filter, Loader2, Package, Search, TrendingUp, XCircle,
} from 'lucide-react';

type UnifiedModule = 'entrees' | 'goodies' | 'pastry' | 'terroir' | 'donation';

type UnifiedRow = {
  id: string;
  rawId: number | string;
  reference: string;
  module: UnifiedModule;
  customer: string;
  phone: string;
  amount: number;
  paymentStatus: string;
  businessStatus: string;
  createdAt: string;
};

type CashOrder = {
  id: string;
  reference: string;
  status: string;
  customer_first_name: string;
  customer_last_name: string;
  total_mad: number;
  created_at: string;
};

const MODULE_LINKS: Record<UnifiedModule, string> = {
  goodies: '/admin/commandes',
  pastry: '/admin/patisserie',
  terroir: '/admin/terroir/orders',
  donation: '/admin/dons',
  entrees: '/admin/ops/payments',
};

export default function AdminUnifiedDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');

  const { user } = useAuth();
  const canReadGoodies = ['admin', 'super_admin', 'admin_boutique'].includes(user?.role || '');
  const canReadPastry = ['admin', 'super_admin', 'admin_boutique', 'admin_patisserie'].includes(user?.role || '');
  const canReadTerroir = ['admin', 'super_admin', 'admin_terroir', 'admin_boutique'].includes(user?.role || '');
  const canReadDonations = ['admin', 'super_admin', 'admin_dons'].includes(user?.role || '');
  const canReadEntrees = ['admin', 'super_admin', 'admin_ops', 'scanner', 'admin_boutique', 'admin_dons', 'admin_terroir'].includes(user?.role || '');

  const utils = trpc.useUtils();

  const goodies = trpc.orders.listAll.useQuery(undefined, { enabled: canReadGoodies });
  const pastries = trpc.pastryOrders.list.useQuery({}, { enabled: canReadPastry });
  const terroir = trpc.terroirModule.adminListOrders.useQuery(undefined, { enabled: canReadTerroir });
  const donations = trpc.donations.listAll.useQuery(undefined, { enabled: canReadDonations });

  const [cashOrders, setCashOrders] = useState<CashOrder[]>([]);
  const [cashLoading, setCashLoading] = useState(false);

  const fetchEntrees = useCallback(() => {
    if (!canReadEntrees) return;
    setCashLoading(true);
    fetch('/api/orders')
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur de chargement');
        return res.json();
      })
      .then((data: CashOrder[]) => setCashOrders(Array.isArray(data) ? data : []))
      .catch(() => setCashOrders([]))
      .finally(() => setCashLoading(false));
  }, [canReadEntrees]);

  useEffect(() => { fetchEntrees(); }, [fetchEntrees]);

  // Mutations
  const goodiesMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { toast.success('Statut mis à jour'); utils.orders.listAll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const pastryMutation = trpc.pastryOrders.updateStatus.useMutation({
    onSuccess: () => { toast.success('Statut mis à jour'); utils.pastryOrders.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const terroirMutation = trpc.terroirModule.adminUpdateOrderStatus.useMutation({
    onSuccess: () => { toast.success('Statut mis à jour'); utils.terroirModule.adminListOrders.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const donationMutation = trpc.donations.updateStatus.useMutation({
    onSuccess: () => { toast.success('Statut mis à jour'); utils.donations.listAll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo<UnifiedRow[]>(() => {
    const mappedGoodies = (goodies.data || []).map((o: any) => ({
      id: `goodies-${o.id}`,
      rawId: o.id,
      reference: o.orderReference,
      module: 'goodies' as const,
      customer: o.customerName || '—',
      phone: o.customerPhone || '—',
      amount: Number(o.totalAmount || 0),
      paymentStatus: o.status === 'paid' || o.status === 'delivered' ? 'paid' : 'pending',
      businessStatus: o.status || 'reserved',
      createdAt: o.createdAt,
    }));

    const mappedPastries = (pastries.data || []).map((o: any) => ({
      id: `pastry-${o.id}`,
      rawId: o.id,
      reference: o.reference,
      module: 'pastry' as const,
      customer: o.customer_name || '—',
      phone: o.phone || '—',
      amount: Number(o.total_amount || 0),
      paymentStatus: o.payment_status || 'pending',
      businessStatus: o.order_status || 'reserved',
      createdAt: o.created_at,
    }));

    const mappedTerroir = (terroir.data || []).map((o: any) => ({
      id: `terroir-${o.id}`,
      rawId: o.id,
      reference: o.order_reference,
      module: 'terroir' as const,
      customer: o.customer_name || '—',
      phone: o.customer_phone || '—',
      amount: Number(o.total_amount || 0),
      paymentStatus: o.payment_status || (o.status === 'paid' || o.status === 'picked_up' ? 'paid' : 'pending'),
      businessStatus: o.status || 'created',
      createdAt: o.created_at,
    }));

    const mappedDonations = (donations.data || []).map((d: any) => ({
      id: `don-${d.id}`,
      rawId: d.id,
      reference: d.donationReference,
      module: 'donation' as const,
      customer: d.isAnonymous ? 'Anonyme' : d.donorName,
      phone: d.donorPhone || '—',
      amount: Number(d.amount || 0),
      paymentStatus: d.status === 'received' ? 'paid' : d.status,
      businessStatus: d.status || 'promised',
      createdAt: d.createdAt,
    }));

    const mappedEntrees = cashOrders.map((o) => ({
      id: `entrees-${o.id}`,
      rawId: o.id,
      reference: o.reference,
      module: 'entrees' as const,
      customer: `${o.customer_first_name || ''} ${o.customer_last_name || ''}`.trim() || '—',
      phone: '—',
      amount: Number(o.total_mad || 0),
      paymentStatus: o.status === 'FULFILLED' ? 'paid' : 'pending',
      businessStatus: o.status,
      createdAt: o.created_at,
    }));

    return [...mappedEntrees, ...mappedGoodies, ...mappedPastries, ...mappedTerroir, ...mappedDonations]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cashOrders, goodies.data, pastries.data, terroir.data, donations.data]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || row.reference.toLowerCase().includes(q) || row.customer.toLowerCase().includes(q) || row.phone.includes(searchTerm);
    const matchModule = moduleFilter === 'all' || row.module === moduleFilter;
    const matchPayment = paymentFilter === 'all' || row.paymentStatus === paymentFilter;
    const matchStatus = statusFilter === 'all' || row.businessStatus === statusFilter;
    const matchDate = !dateFrom || new Date(row.createdAt) >= new Date(dateFrom);
    return matchSearch && matchModule && matchPayment && matchStatus && matchDate;
  }), [rows, searchTerm, moduleFilter, paymentFilter, statusFilter, dateFrom]);

  const stats = {
    total: filteredRows.length,
    paid: filteredRows.filter((r) => ['paid', 'confirmed', 'received', 'FULFILLED'].includes(r.paymentStatus)).length,
    pending: filteredRows.filter((r) => !['paid', 'confirmed', 'received', 'FULFILLED'].includes(r.paymentStatus)).length,
    amount: filteredRows.reduce((sum, r) => sum + r.amount, 0),
    byModule: {
      entrees: filteredRows.filter((r) => r.module === 'entrees').length,
      goodies: filteredRows.filter((r) => r.module === 'goodies').length,
      pastry: filteredRows.filter((r) => r.module === 'pastry').length,
      terroir: filteredRows.filter((r) => r.module === 'terroir').length,
      donation: filteredRows.filter((r) => r.module === 'donation').length,
    },
  };

  const isLoading = goodies.isLoading || pastries.isLoading || terroir.isLoading || donations.isLoading || cashLoading;

  const exportCsv = () => {
    const headers = ['Référence', 'Module', 'Client', 'Téléphone', 'Montant', 'Paiement', 'Statut', 'Date'];
    const rowsCsv = filteredRows.map((r) => [
      r.reference,
      r.module,
      r.customer,
      r.phone,
      String(r.amount),
      r.paymentStatus,
      r.businessStatus,
      new Date(r.createdAt).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rowsCsv].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard-unifie-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const renderActions = (row: UnifiedRow) => {
    const id = row.rawId as number;
    const s = row.businessStatus;

    return (
      <div className="flex gap-1">
        <Link href={MODULE_LINKS[row.module]}>
          <Button size="sm" variant="ghost" title="Voir dans le module">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>

        {row.module === 'goodies' && (
          <>
            {s === 'reserved' && (
              <Button size="sm" variant="outline" className="text-green-600" title="Marquer payé"
                onClick={() => goodiesMutation.mutate({ orderId: id, status: 'paid' })}
                disabled={goodiesMutation.isPending}>
                <CreditCard className="h-4 w-4" />
              </Button>
            )}
            {s === 'paid' && (
              <Button size="sm" variant="outline" className="text-emerald-600" title="Marquer remis"
                onClick={() => goodiesMutation.mutate({ orderId: id, status: 'delivered' })}
                disabled={goodiesMutation.isPending}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {s !== 'cancelled' && s !== 'delivered' && (
              <Button size="sm" variant="outline" className="text-red-600" title="Annuler"
                onClick={() => goodiesMutation.mutate({ orderId: id, status: 'cancelled' })}
                disabled={goodiesMutation.isPending}>
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {row.module === 'pastry' && (
          <>
            {s === 'reserved' && (
              <Button size="sm" variant="outline" className="text-green-600" title="Marquer payé"
                onClick={() => pastryMutation.mutate({ orderId: id, orderStatus: 'paid' as any, paymentStatus: 'confirmed' as any })}
                disabled={pastryMutation.isPending}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {s === 'paid' && (
              <Button size="sm" variant="outline" className="text-blue-600" title="Marquer remis"
                onClick={() => pastryMutation.mutate({ orderId: id, orderStatus: 'handed' as any })}
                disabled={pastryMutation.isPending}>
                <Package className="h-4 w-4" />
              </Button>
            )}
            {(s === 'reserved' || s === 'paid') && (
              <Button size="sm" variant="outline" className="text-red-600" title="Annuler"
                onClick={() => pastryMutation.mutate({ orderId: id, orderStatus: 'cancelled' as any, paymentStatus: 'cancelled' as any })}
                disabled={pastryMutation.isPending}>
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {row.module === 'terroir' && (
          <>
            {s === 'created' && (
              <Button size="sm" variant="outline" className="text-green-600" title="Marquer payé"
                onClick={() => terroirMutation.mutate({ id, status: 'paid' })}
                disabled={terroirMutation.isPending}>
                <CreditCard className="h-4 w-4" />
              </Button>
            )}
            {s === 'paid' && (
              <Button size="sm" variant="outline" className="text-blue-600" title="Prête"
                onClick={() => terroirMutation.mutate({ id, status: 'ready' })}
                disabled={terroirMutation.isPending}>
                <Package className="h-4 w-4" />
              </Button>
            )}
            {s === 'ready' && (
              <Button size="sm" variant="outline" className="text-emerald-600" title="Retirée"
                onClick={() => terroirMutation.mutate({ id, status: 'picked_up' })}
                disabled={terroirMutation.isPending}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {s !== 'cancelled' && s !== 'picked_up' && (
              <Button size="sm" variant="outline" className="text-red-600" title="Annuler"
                onClick={() => terroirMutation.mutate({ id, status: 'cancelled' })}
                disabled={terroirMutation.isPending}>
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {row.module === 'donation' && (
          <>
            {s !== 'received' && s !== 'cancelled' && (
              <Button size="sm" variant="outline" className="text-green-600" title="Marquer reçu"
                onClick={() => donationMutation.mutate({ donationId: id, status: 'received' })}
                disabled={donationMutation.isPending}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {s !== 'cancelled' && s !== 'received' && (
              <Button size="sm" variant="outline" className="text-red-600" title="Annuler"
                onClick={() => donationMutation.mutate({ donationId: id, status: 'cancelled' })}
                disabled={donationMutation.isPending}>
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">Dashboard unifié des commandes</h1>
          </div>
          <p className="text-muted-foreground">Entrées, Goodies, Terroir, Dons et Pâtisserie dans une seule vue.</p>
        </div>
      </div>

      <div className="container py-10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-3xl font-bold">{stats.total}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Payées / reçues</p><p className="text-3xl font-bold text-green-600">{stats.paid}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">En attente</p><p className="text-3xl font-bold text-amber-600">{stats.pending}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Montant global</p><p className="text-3xl font-bold">{stats.amount} DH</p></Card>
          <Card className="p-4 text-xs space-y-1">
            <p className="text-sm text-muted-foreground">Modules</p>
            <p>Entrées: {stats.byModule.entrees}</p>
            <p>Goodies: {stats.byModule.goodies}</p>
            <p>Pâtisserie: {stats.byModule.pastry}</p>
            <p>Terroir: {stats.byModule.terroir}</p>
            <p>Dons: {stats.byModule.donation}</p>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2"><Filter className="w-5 h-5" /><h2 className="font-semibold">Filtres</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Référence, client..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Module</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="entrees">Entrées</SelectItem>
                  <SelectItem value="goodies">Goodies</SelectItem>
                  <SelectItem value="pastry">Pâtisserie</SelectItem>
                  <SelectItem value="terroir">Terroir</SelectItem>
                  <SelectItem value="donation">Dons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paiement</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="received">Reçu</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut métier</Label>
              <Input placeholder="ex: delivered, reserved..." value={statusFilter === 'all' ? '' : statusFilter} onChange={(e) => setStatusFilter(e.target.value || 'all')} />
            </div>
            <div>
              <Label>À partir du</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => { setSearchTerm(''); setModuleFilter('all'); setPaymentFilter('all'); setStatusFilter('all'); setDateFrom(''); }}>Réinitialiser</Button>
              <Button onClick={exportCsv}><Download className="w-4 h-4 mr-2" />CSV</Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="py-14 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Référence</th>
                    <th className="px-4 py-3 text-left">Module</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Montant</th>
                    <th className="px-4 py-3 text-left">Paiement</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{row.module}</Badge></td>
                      <td className="px-4 py-3">{row.customer}</td>
                      <td className="px-4 py-3 font-semibold">{row.amount} DH</td>
                      <td className="px-4 py-3">{row.paymentStatus}</td>
                      <td className="px-4 py-3">{row.businessStatus}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(row.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3">{renderActions(row)}</td>
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
