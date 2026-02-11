import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { 
  ArrowLeft, Download, Loader2, DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Filter
} from "lucide-react";

type PaymentStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';
type PaymentMethod = 'bank_transfer' | 'check' | 'cash' | 'paypal';
type Module = 'goodies' | 'donations' | 'reservations';

interface PaymentRecord {
  id: number;
  reference: string;
  module: Module;
  customerName: string;
  customerEmail: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export default function AdminPayments() {
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: 'all' as PaymentStatus | 'all',
    module: 'all' as Module | 'all',
    paymentMethod: 'all' as PaymentMethod | 'all',
    search: '',
  });

  // Mock data - in production, this would come from trpc
  const mockPayments: PaymentRecord[] = [
    {
      id: 1,
      reference: 'ORD-2026-001',
      module: 'goodies',
      customerName: 'Ahmed Hassan',
      customerEmail: 'ahmed@example.com',
      amount: 250,
      paymentMethod: 'cash',
      status: 'paid',
      createdAt: new Date('2026-02-05'),
      updatedAt: new Date('2026-02-05'),
    },
    {
      id: 2,
      reference: 'DON-2026-001',
      module: 'donations',
      customerName: 'Fatima Bennani',
      customerEmail: 'fatima@example.com',
      amount: 500,
      paymentMethod: 'bank_transfer',
      status: 'confirmed',
      createdAt: new Date('2026-02-04'),
      updatedAt: new Date('2026-02-04'),
    },
    {
      id: 3,
      reference: 'RES-2026-001',
      module: 'reservations',
      customerName: 'Mohammed Alaoui',
      customerEmail: 'mohammed@example.com',
      amount: 0,
      paymentMethod: 'cash',
      status: 'pending',
      createdAt: new Date('2026-02-06'),
      updatedAt: new Date('2026-02-06'),
    },
  ];

  const filteredPayments = useMemo(() => {
    return mockPayments.filter(payment => {
      // Date filters
      if (filters.dateFrom && new Date(payment.createdAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(payment.createdAt) > new Date(filters.dateTo)) return false;

      // Status filter
      if (filters.status !== 'all' && payment.status !== filters.status) return false;

      // Module filter
      if (filters.module !== 'all' && payment.module !== filters.module) return false;

      // Payment method filter
      if (filters.paymentMethod !== 'all' && payment.paymentMethod !== filters.paymentMethod) return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          payment.reference.toLowerCase().includes(searchLower) ||
          payment.customerName.toLowerCase().includes(searchLower) ||
          payment.customerEmail.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [filters]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const paid = filteredPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pending = filteredPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    const count = filteredPayments.length;

    return { total, paid, pending, count };
  }, [filteredPayments]);

  const getStatusBadge = (status: PaymentStatus) => {
    const statusConfig: Record<PaymentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'En attente', variant: 'secondary' },
      confirmed: { label: 'Confirmé', variant: 'outline' },
      paid: { label: 'Payé', variant: 'default' },
      cancelled: { label: 'Annulé', variant: 'destructive' },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getModuleBadge = (module: Module) => {
    const moduleConfig: Record<Module, string> = {
      goodies: 'Goodies',
      donations: 'Dons',
      reservations: 'Réservations',
    };

    return <Badge variant="outline">{moduleConfig[module]}</Badge>;
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    const methodConfig: Record<PaymentMethod, string> = {
      bank_transfer: 'Virement',
      check: 'Chèque',
      cash: 'Espèces',
      paypal: 'PayPal',
    };

    return methodConfig[method];
  };

  const exportToCSV = () => {
    const headers = ['Référence', 'Module', 'Client', 'Email', 'Montant', 'Méthode', 'Statut', 'Date'];
    const rows = filteredPayments.map(p => [
      p.reference,
      p.module,
      p.customerName,
      p.customerEmail,
      p.amount,
      getPaymentMethodLabel(p.paymentMethod),
      p.status,
      new Date(p.createdAt).toLocaleDateString('fr-FR'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Export CSV téléchargé');
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Gestion des Paiements</h1>
            <p className="text-muted-foreground">Suivi et gestion de tous les paiements</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.total} MAD</div>
              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">{stats.paid} MAD</div>
              <CheckCircle className="h-8 w-8 text-green-600/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-amber-600">{stats.pending} MAD</div>
              <Clock className="h-8 w-8 text-amber-600/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.count}</div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Recherche</Label>
              <Input
                id="search"
                placeholder="Référence, client..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date début</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Date fin</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value as PaymentStatus | 'all' })}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select value={filters.module} onValueChange={(value) => setFilters({ ...filters, module: value as Module | 'all' })}>
                <SelectTrigger id="module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="goodies">Goodies</SelectItem>
                  <SelectItem value="donations">Dons</SelectItem>
                  <SelectItem value="reservations">Réservations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Méthode</Label>
              <Select value={filters.paymentMethod} onValueChange={(value) => setFilters({ ...filters, paymentMethod: value as PaymentMethod | 'all' })}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="bank_transfer">Virement</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setFilters({
                dateFrom: '',
                dateTo: '',
                status: 'all',
                module: 'all',
                paymentMethod: 'all',
                search: '',
              })}
            >
              Réinitialiser
            </Button>
            <Button onClick={exportToCSV} className="ml-auto gap-2">
              <Download className="h-4 w-4" />
              Exporter CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune transaction trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono font-semibold">{payment.reference}</TableCell>
                      <TableCell>{getModuleBadge(payment.module)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.customerName}</div>
                          <div className="text-sm text-muted-foreground">{payment.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{payment.amount} MAD</TableCell>
                      <TableCell>{getPaymentMethodLabel(payment.paymentMethod)}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
