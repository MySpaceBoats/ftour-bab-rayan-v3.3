import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, Search, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type ReservationType = 'all' | 'particulier' | 'entreprise' | 'groupe';
type ReservationStatus = 'all' | 'pending_validation' | 'validated_pending_payment' | 'paid_confirmed' | 'refused';

export default function AdminRestaurantReservations() {
  const [typeFilter, setTypeFilter] = useState<ReservationType>('all');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Fetch reservations based on type
  const { data: particuliers = [] } = trpc.restaurantModule.adminListParticuliers.useQuery();
  const { data: entreprises = [] } = trpc.restaurantModule.adminListEntreprises.useQuery();
  const { data: groupes = [] } = trpc.restaurantModule.adminListGroupes.useQuery();

  // Combine all reservations
  const allReservations = useMemo(() => {
    const all = [
      ...particuliers.map((r: any) => ({ ...r, type: 'particulier' })),
      ...entreprises.map((r: any) => ({ ...r, type: 'entreprise' })),
      ...groupes.map((r: any) => ({ ...r, type: 'groupe' })),
    ];
    return all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [particuliers, entreprises, groupes]);

  // Filter reservations
  const filteredReservations = useMemo(() => {
    return allReservations.filter((res: any) => {
      const matchesType = typeFilter === 'all' || res.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
      const text = `${res.reference} ${res.contact_name} ${res.contact_email} ${res.contact_phone}`.toLowerCase();
      const matchesSearch = searchQuery === '' || text.includes(searchQuery.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [allReservations, typeFilter, statusFilter, searchQuery]);

  const selectedReservation = filteredReservations.find((res: any) => res.id === selectedId) || null;

  // Validate reservation
  const validateMutation = trpc.restaurantModule.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success('Réservation validée');
      setSelectedId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la validation');
    },
  });

  // Refuse reservation
  const refuseMutation = trpc.restaurantModule.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success('Réservation refusée');
      setSelectedId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors du refus');
    },
  });

  const handleValidate = (id: number) => {
    validateMutation.mutate({
      id,
      status: 'validated_pending_payment',
    });
  };

  const handleRefuse = (id: number) => {
    refuseMutation.mutate({
      id,
      status: 'refused',
    });
  };

  const exportCsv = () => {
    if (filteredReservations.length === 0) {
      toast.error('Aucune réservation à exporter');
      return;
    }

    const header = ['Référence', 'Type', 'Statut', 'Contact', 'Email', 'Téléphone', 'Places', 'Date', 'Notes'];
    const rows = filteredReservations.map((res: any) => [
      res.reference,
      res.type,
      res.status,
      res.contact_name,
      res.contact_email,
      res.contact_phone,
      res.seats_total || res.participants_count || '-',
      new Date(res.created_at).toLocaleString('fr-FR'),
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
        return <Badge variant="outline">En attente</Badge>;
      case 'validated_pending_payment':
        return <Badge variant="secondary">Validée</Badge>;
      case 'paid_confirmed':
        return <Badge className="bg-green-600">Confirmée</Badge>;
      case 'refused':
        return <Badge variant="destructive">Refusée</Badge>;
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
                <Button variant={typeFilter === 'particulier' ? 'default' : 'outline'} onClick={() => setTypeFilter('particulier')} size="sm">
                  Particuliers
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
                  Validées
                </Button>
                <Button variant={statusFilter === 'paid_confirmed' ? 'default' : 'outline'} onClick={() => setStatusFilter('paid_confirmed')} size="sm">
                  Confirmées
                </Button>
              </div>

              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
            </div>

            <div className="space-y-3">
              {filteredReservations.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune réservation trouvée.</p>
              )}

              {filteredReservations.map((res: any) => (
                <button
                  key={res.id}
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
                  <p className="text-sm text-muted-foreground">{res.contact_name} • {res.contact_email}</p>
                  <p className="text-sm text-muted-foreground">{new Date(res.created_at).toLocaleString('fr-FR')}</p>
                </button>
              ))}
            </div>
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
                  <p className="font-medium">{selectedReservation.contact_name}</p>
                  <p className="text-sm">{selectedReservation.contact_email}</p>
                  <p className="text-sm">{selectedReservation.contact_phone}</p>
                </div>

                {selectedReservation.organization_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Entreprise/Groupe</p>
                    <p className="font-medium">{selectedReservation.organization_name}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Places</p>
                    <p className="font-medium">{selectedReservation.seats_total || selectedReservation.participants_count || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{new Date(selectedReservation.reservation_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>

                {selectedReservation.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <Textarea value={selectedReservation.notes} readOnly className="min-h-[80px]" />
                  </div>
                )}

                {selectedReservation.status === 'pending_validation' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleValidate(selectedReservation.id)}
                      disabled={validateMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Valider
                    </Button>
                    <Button
                      onClick={() => handleRefuse(selectedReservation.id)}
                      disabled={refuseMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Refuser
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
