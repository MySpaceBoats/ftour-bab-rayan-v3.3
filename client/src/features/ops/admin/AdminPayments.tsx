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
import { toast } from "sonner";
import {
  ArrowLeft, Download, Loader2, DollarSign, TrendingUp, CheckCircle, Clock,
  XCircle, Filter, AlertCircle, Banknote, Eye, X,
} from "lucide-react";

type PaymentStatus = 'pending' | 'validated' | 'cancelled' | 'processing' | 'cheque_cashed';
type PaymentMethod = 'bank_transfer' | 'cheque' | 'cash' | 'paypal';

export default function AdminPayments() {
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: 'all' as PaymentStatus | 'all',
    paymentMethod: 'all' as PaymentMethod | 'all',
    search: '',
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Real tRPC data
  const { data: payments = [], isLoading, error } = trpc.payments.list.useQuery({
    status: filters.status !== 'all' ? filters.status : undefined,
    paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
  });
  const { data: stats } = trpc.payments.getStats.useQuery();

  // Mutations
  const validatePayment = trpc.payments.validate.useMutation({
    onSuccess: () => {
      utils.payments.list.invalidate();
      utils.payments.getStats.invalidate();
      toast.success('Paiement validé');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelPayment = trpc.payments.cancel.useMutation({
    onSuccess: () => {
      utils.payments.list.invalidate();
      utils.payments.getStats.invalidate();
      setSelectedId(null);
      toast.success('Paiement annulé');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const markCheque = trpc.payments.markChequeAsCashed.useMutation({
    onSuccess: () => {
      utils.payments.list.invalidate();
      utils.payments.getStats.invalidate();
      toast.success('Chèque marqué comme encaissé');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Filter locally (date + search)
  const filteredPayments = useMemo(() => {
    return (payments as any[]).filter((payment: any) => {
      if (filters.dateFrom && new Date(payment.createdAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(payment.createdAt) > new Date(filters.dateTo)) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const text = `${payment.paymentReference || ''} ${payment.userName || ''} ${payment.email || ''}`.toLowerCase();
        if (!text.includes(searchLower)) return false;
      }
      return true;
    });
  }, [payments, filters.dateFrom, filters.dateTo, filters.search]);

  const selectedPayment = filteredPayments.find((p: any) => p.id === selectedId) || null;

  // Helpers
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'En attente', variant: 'secondary' },
      validated: { label: 'Validé', variant: 'default' },
      paid: { label: 'Payé', variant: 'default' },
      cancelled: { label: 'Annulé', variant: 'destructive' },
      processing: { label: 'En cours', variant: 'outline' },
      cheque_cashed: { label: 'Chèque encaissé', variant: 'default' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    const map: Record<string, string> = {
      bank_transfer: 'Virement',
      cheque: 'Chèque',
      cash: 'Espèces',
      paypal: 'PayPal',
    };
    return map[method] || method;
  };

  const exportToCSV = () => {
    if (filteredPayments.length === 0) { toast.error('Aucune transaction à exporter'); return; }
    const headers = ['Référence', 'Client', 'Email', 'Montant', 'Devise', 'Méthode', 'Statut', 'Date'];
    const rows = filteredPayments.map((p: any) => [
      p.paymentReference || `#${p.id}`, p.userName || '', p.email || '',
      p.amount || 0, p.currency || 'MAD', getPaymentMethodLabel(p.paymentMethod || ''),
      p.status || '', new Date(p.createdAt || '').toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `paiements-${new Date().toISOString().split('T')[0]}.csv`);
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
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Gestion des Paiements</h1>
            <p className="text-muted-foreground">Suivi et gestion de tous les paiements</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Erreur: {error.message}</p>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Montant total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{((stats as any)?.totalAmount ?? 0).toLocaleString('fr-FR')} MAD</div>
              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Validés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">{(stats as any)?.totalValidated ?? 0}</div>
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
              <div className="text-2xl font-bold text-amber-600">{(stats as any)?.totalPending ?? 0}</div>
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
              <div className="text-2xl font-bold">{(stats as any)?.totalPayments ?? filteredPayments.length}</div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Recherche</Label>
              <Input id="search" placeholder="Référence, client..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date début</Label>
              <Input id="dateFrom" type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date fin</Label>
              <Input id="dateTo" type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value as PaymentStatus | 'all' })}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="validated">Validé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                  <SelectItem value="processing">En cours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Méthode</Label>
              <Select value={filters.paymentMethod} onValueChange={(value) => setFilters({ ...filters, paymentMethod: value as PaymentMethod | 'all' })}>
                <SelectTrigger id="paymentMethod"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="bank_transfer">Virement</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setFilters({ dateFrom: '', dateTo: '', status: 'all', paymentMethod: 'all', search: '' })}>Réinitialiser</Button>
            <Button onClick={exportToCSV} className="ml-auto gap-2"><Download className="h-4 w-4" /> Exporter CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payments Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Transactions ({filteredPayments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune transaction trouvée</TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map((payment: any) => (
                        <TableRow key={payment.id} className={selectedId === payment.id ? 'bg-primary/5' : ''}>
                          <TableCell className="font-mono font-semibold text-xs">{payment.paymentReference || `#${payment.id}`}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{payment.userName || 'Inconnu'}</div>
                              <div className="text-xs text-muted-foreground">{payment.email || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{(payment.amount || 0).toLocaleString('fr-FR')} {payment.currency || 'MAD'}</TableCell>
                          <TableCell>{getPaymentMethodLabel(payment.paymentMethod || '')}</TableCell>
                          <TableCell>{getStatusBadge(payment.status || 'pending')}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(payment.createdAt || '').toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedId(payment.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detail Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Détail</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPayment ? (
                <p className="text-sm text-muted-foreground">Sélectionnez un paiement pour voir les détails.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    {getStatusBadge(selectedPayment.status || 'pending')}
                    <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Référence</span><span className="font-mono">{selectedPayment.paymentReference || `#${selectedPayment.id}`}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Nom</span><span>{selectedPayment.userName || 'Inconnu'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{selectedPayment.email || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Téléphone</span><span>{selectedPayment.phone || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span className="font-bold">{(selectedPayment.amount || 0).toLocaleString('fr-FR')} {selectedPayment.currency || 'MAD'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Méthode</span><span>{getPaymentMethodLabel(selectedPayment.paymentMethod || '')}</span></div>
                    {selectedPayment.description && <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span>{selectedPayment.description}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(selectedPayment.createdAt || '').toLocaleString('fr-FR')}</span></div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    {selectedPayment.status === 'pending' && (
                      <>
                        <Button onClick={() => validatePayment.mutate({ paymentId: selectedPayment.id })} disabled={validatePayment.isPending} className="w-full">
                          {validatePayment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Valider le paiement
                        </Button>
                        <Button variant="destructive" onClick={() => { if (confirm('Annuler ce paiement ?')) cancelPayment.mutate({ paymentId: selectedPayment.id }); }} disabled={cancelPayment.isPending} className="w-full">
                          {cancelPayment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Annuler
                        </Button>
                      </>
                    )}
                    {selectedPayment.status === 'validated' && selectedPayment.paymentMethod === 'cheque' && (
                      <Button onClick={() => markCheque.mutate({ paymentId: selectedPayment.id })} disabled={markCheque.isPending} className="w-full">
                        {markCheque.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
                        Marquer chèque encaissé
                      </Button>
                    )}
                    {(selectedPayment.status === 'validated' || selectedPayment.status === 'cheque_cashed') && (
                      <p className="text-sm text-green-600 text-center flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> Paiement confirmé</p>
                    )}
                    {selectedPayment.status === 'cancelled' && (
                      <p className="text-sm text-red-600 text-center flex items-center justify-center gap-1"><XCircle className="w-4 h-4" /> Paiement annulé</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
