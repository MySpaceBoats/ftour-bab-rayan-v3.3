import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, Search, CheckCircle, XCircle, Loader2, Percent } from 'lucide-react';
import { toast } from 'sonner';

type ReservationType = 'all' | 'particulier' | 'entreprise' | 'groupe';
type ReservationStatus = 'all' | 'pending_validation' | 'validated_pending_payment' | 'paid_confirmed' | 'refused' | 'cancelled' | 'completed' | 'no_show';

export default function AdminRestaurantReservations() {
  const [typeFilter, setTypeFilter] = useState<ReservationType>('all');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [depositInput, setDepositInput] = useState<string>('');

  // Fetch reservations via restaurantReservations router
  const { data: particuliers = [], isLoading: loadingP, isError: errorP, refetch: refetchP } = trpc.restaurantReservations.adminListParticuliers.useQuery(undefined, { retry: 1 });
  const { data: entreprises = [], isLoading: loadingE, isError: errorE, refetch: refetchE } = trpc.restaurantReservations.adminListEntreprises.useQuery(undefined, { retry: 1 });
  const { data: groupes = [], isLoading: loadingG, isError: errorG, refetch: refetchG } = trpc.restaurantReservations.adminListGroupes.useQuery(undefined, { retry: 1 });

  const isLoading = loadingP || loadingE || loadingG;
  const hasError = errorP || errorE || errorG;

  const refetchAll = () => {
    refetchP();
    refetchE();
    refetchG();
  };

  // Combine all reservations
  const allReservations = useMemo(() => {
    const all = [
      ...particuliers.map((r: any) => ({ ...r, type: r.type || 'particulier' })),
      ...entreprises.map((r: any) => ({ ...r, type: r.type || 'entreprise' })),
      ...groupes.map((r: any) => ({ ...r, type: r.type || 'groupe' })),
    ];
    return all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [particuliers, entreprises, groupes]);

  // Filter reservations
  const filteredReservations = useMemo(() => {
    return allReservations.filter((res: any) => {
      const matchesType = typeFilter === 'all' || res.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
      const text = `${res.reference} ${res.name} ${res.email} ${res.phone} ${res.groupName || ''} ${res.companyName || ''}`.toLowerCase();
      const matchesSearch = searchQuery === '' || text.includes(searchQuery.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [allReservations, typeFilter, statusFilter, searchQuery]);

  const selectedReservation = filteredReservations.find((res: any) => res.id === selectedId) || null;

  // Validate reservation
  const validateMutation = trpc.restaurantReservations.validate.useMutation({
    onSuccess: () => {
      toast.success('Réservation validée, email de confirmation envoyé');
      setSelectedId(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la validation');
    },
  });

  // Refuse reservation
  const refuseMutation = trpc.restaurantReservations.refuse.useMutation({
    onSuccess: () => {
      toast.success('Réservation refusée, email de notification envoyé');
      setSelectedId(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors du refus');
    },
  });

  // Update status
  const updateStatusMutation = trpc.restaurantReservations.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      setSelectedId(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  // Update deposit percentage
  const depositMutation = trpc.restaurantReservations.adminUpdateDepositPercentage.useMutation({
    onSuccess: () => {
      toast.success('Pourcentage d\'acompte mis à jour, statut ajusté');
      setDepositInput('');
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const handleDepositUpdate = (id: number) => {
    const pct = parseInt(depositInput, 10);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Veuillez entrer un pourcentage entre 0 et 100');
      return;
    }
    depositMutation.mutate({ id, percentage: pct });
  };

  const handleValidate = (reference: string) => {
    validateMutation.mutate({
      reference,
      baseUrl: window.location.origin,
    });
  };

  const handleRefuse = (reference: string) => {
    refuseMutation.mutate({ reference });
  };

  const exportCsv = () => {
    if (filteredReservations.length === 0) {
      toast.error('Aucune réservation à exporter');
      return;
    }

    const header = ['Référence', 'Type', 'Statut', 'Contact', 'Email', 'Téléphone', 'Places', 'Date Ftour', 'Acompte %', 'Créé le', 'Notes'];
    const rows = filteredReservations.map((res: any) => [
      res.reference,
      res.type,
      res.status,
      res.name,
      res.email || '',
      res.phone,
      res.seatsTotal || '-',
      res.date ? new Date(res.date).toLocaleDateString('fr-FR') : '-',
      res.depositPercentage || 0,
      res.createdAt ? new Date(res.createdAt).toLocaleString('fr-FR') : '-',
      (res.notes || '').replace(/\n/g, ' '),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservations_restaurant_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Export CSV téléchargé');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_validation':
      case 'submitted':
        return <Badge variant="outline">En attente</Badge>;
      case 'validated_pending_payment':
      case 'pending_confirmation':
        return <Badge variant="secondary">Paiement attendu</Badge>;
      case 'paid_confirmed':
      case 'confirmed':
        return <Badge className="bg-green-600">Confirmée</Badge>;
      case 'refused':
      case 'rejected':
        return <Badge variant="destructive">Refusée</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulée</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-600">Terminée</Badge>;
      case 'no_show':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">No show</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'particulier':
        return <Badge className="bg-blue-600">Particulier</Badge>;
      case 'entreprise':
        return <Badge className="bg-purple-600">Entreprise</Badge>;
      case 'groupe':
        return <Badge className="bg-orange-600">Groupe</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Réservations Restaurant</h1>
            <p className="text-xs text-muted-foreground">{filteredReservations.length} réservation(s)</p>
          </div>
        </div>
      </header>

      <main className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Liste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une réservation..."
                  className="pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={typeFilter === 'all' ? 'default' : 'outline'} onClick={() => setTypeFilter('all')} size="sm">
                  Tous
                </Button>
                <Button variant={typeFilter === 'entreprise' ? 'default' : 'outline'} onClick={() => setTypeFilter('entreprise')} size="sm">
                  Entreprises
                </Button>
                <Button variant={typeFilter === 'groupe' ? 'default' : 'outline'} onClick={() => setTypeFilter('groupe')} size="sm">
                  Groupes
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')} size="sm">
                  Tous statuts
                </Button>
                <Button variant={statusFilter === 'pending_validation' ? 'default' : 'outline'} onClick={() => setStatusFilter('pending_validation')} size="sm">
                  En attente
                </Button>
                <Button variant={statusFilter === 'validated_pending_payment' ? 'default' : 'outline'} onClick={() => setStatusFilter('validated_pending_payment')} size="sm">
                  Paiement attendu
                </Button>
                <Button variant={statusFilter === 'paid_confirmed' ? 'default' : 'outline'} onClick={() => setStatusFilter('paid_confirmed')} size="sm">
                  Confirmées
                </Button>
                <Button variant={statusFilter === 'refused' ? 'default' : 'outline'} onClick={() => setStatusFilter('refused')} size="sm">
                  Refusées
                </Button>
              </div>

              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : hasError ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-red-600 font-medium">Erreur lors du chargement des réservations</p>
                <Button variant="outline" onClick={refetchAll}>Réessayer</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReservations.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune réservation trouvée.</p>
                )}

                {filteredReservations.map((res: any) => (
                  <button
                    key={`${res.type}-${res.id}`}
                    onClick={() => setSelectedId(res.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedId === res.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-medium">{res.reference}</p>
                      <div className="flex gap-1">
                        {getTypeBadge(res.type)}
                        {getStatusBadge(res.status)}
                      </div>
                    </div>
                    {(res.groupName || res.companyName) && (
                      <p className="font-semibold text-sm">{res.groupName || res.companyName}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{res.name} {res.email ? `• ${res.email}` : ''}</p>
                    <p className="text-sm">
                      <span className="font-medium">{res.seatsTotal || 0} places</span>
                      <span className="text-muted-foreground"> • Ftour {formatDate(res.date)} • Créé {formatDate(res.createdAt)}</span>
                      {res.depositPercentage > 0 && (
                        <span className={`ml-2 font-medium ${res.depositPercentage >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                          • Acompte {res.depositPercentage}%
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détail</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedReservation && <p className="text-sm text-muted-foreground">Sélectionnez une réservation.</p>}
            {selectedReservation && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Référence</p>
                  <p className="font-semibold">{selectedReservation.reference}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    {getTypeBadge(selectedReservation.type)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Statut</p>
                    {getStatusBadge(selectedReservation.status)}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="font-medium">{selectedReservation.name}</p>
                  <p className="text-sm">{selectedReservation.email}</p>
                  <p className="text-sm">{selectedReservation.phone}</p>
                </div>

                {(selectedReservation.companyName || selectedReservation.groupName) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Entreprise/Groupe</p>
                    <p className="font-medium">{selectedReservation.companyName || selectedReservation.groupName}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Places</p>
                    <p className="font-medium">{selectedReservation.seatsTotal || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date Ftour</p>
                    <p className="font-medium">{formatDate(selectedReservation.date)}</p>
                  </div>
                </div>

                {selectedReservation.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <Textarea value={selectedReservation.notes} readOnly className="min-h-[80px]" />
                  </div>
                )}

                {/* Deposit percentage section */}
                {!['refused', 'cancelled'].includes(selectedReservation.status) && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">Acompte reçu</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              (selectedReservation.depositPercentage || 0) >= 100
                                ? 'bg-green-600'
                                : (selectedReservation.depositPercentage || 0) > 0
                                ? 'bg-amber-500'
                                : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(selectedReservation.depositPercentage || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold min-w-[40px] text-right">
                        {selectedReservation.depositPercentage || 0}%
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0-100"
                        value={depositInput}
                        onChange={(e) => setDepositInput(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button
                        size="sm"
                        onClick={() => handleDepositUpdate(selectedReservation.id)}
                        disabled={depositMutation.isPending || !depositInput}
                      >
                        <Percent className="h-3 w-3 mr-1" />
                        Mettre à jour
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(selectedReservation.depositPercentage || 0) >= 100
                        ? 'Acompte complet - réservation confirmée'
                        : (selectedReservation.depositPercentage || 0) > 0
                        ? 'Acompte partiel - en attente du solde'
                        : 'Aucun acompte reçu'}
                    </p>
                  </div>
                )}

                {(selectedReservation.status === 'pending_validation' || selectedReservation.status === 'submitted') && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleValidate(selectedReservation.reference)}
                      disabled={validateMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Valider
                    </Button>
                    <Button
                      onClick={() => handleRefuse(selectedReservation.reference)}
                      disabled={refuseMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Refuser
                    </Button>
                  </div>
                )}

                {(['validated_pending_payment', 'pending_confirmation', 'paid_confirmed', 'confirmed'].includes(selectedReservation.status)) && (
                  <Button
                    onClick={() => updateStatusMutation.mutate({ id: selectedReservation.id, status: 'completed' })}
                    disabled={updateStatusMutation.isPending}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer terminée
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
