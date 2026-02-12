'use client';

import { useSearchParams } from 'wouter';
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UtensilsCrossed, Plus, Eye, Check, X, CreditCard, Mail, Trash2, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

// ============================================
// ADMIN RESERVATIONS — UNIFIED VIEW WITH tRPC
// ============================================

interface Reservation {
  id: string;
  type: 'particulier' | 'entreprise' | 'groupe';
  date: string;
  places: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: 'pending_validation' | 'confirmed' | 'rejected' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  created_at: string;
}

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReservations, setSelectedReservations] = useState<string[]>([]);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [filters, setFilters] = useState({
    type: searchParams.type || '',
    status: searchParams.status || '',
    payment_status: searchParams.payment_status || '',
    date_from: searchParams.date_from || '',
    date_to: searchParams.date_to || '',
    search: searchParams.search || '',
  });

  // Fetch reservations from tRPC
  const { data: reservations = [], isLoading, error } = trpc.backoffice.reservations.list.useQuery(
    { type: filters.type as any },
    { enabled: !!user }
  );

  // Mutations
  const confirmMutation = trpc.backoffice.reservations.confirm.useMutation();
  const rejectMutation = trpc.backoffice.reservations.reject.useMutation();
  const deleteMutation = trpc.backoffice.reservations.delete.useMutation();
  const markPaidMutation = trpc.backoffice.reservations.markPaid.useMutation();

  // Filter data
  const filteredData = useMemo(() => {
    return (reservations as Reservation[]).filter((res) => {
      if (filters.type && res.type !== filters.type) return false;
      if (filters.status && res.status !== filters.status) return false;
      if (filters.payment_status && res.payment_status !== filters.payment_status) return false;
      if (filters.date_from && res.date < filters.date_from) return false;
      if (filters.date_to && res.date > filters.date_to) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          res.contact_name.toLowerCase().includes(search) ||
          res.contact_email.toLowerCase().includes(search) ||
          res.contact_phone.includes(search)
        );
      }
      return true;
    });
  }, [reservations, filters]);

  // Handle filter change
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams.toString());
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      type: '',
      status: '',
      payment_status: '',
      date_from: '',
      date_to: '',
      search: '',
    });
    setSearchParams('');
  };

  // Actions
  const handleConfirm = useCallback(async (id: string) => {
    try {
      await confirmMutation.mutateAsync({ id });
      // Refetch data
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la confirmation:', error);
    }
  }, [confirmMutation]);

  const handleReject = useCallback(async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors du refus:', error);
    }
  }, [rejectMutation]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette réservation ?')) return;
    try {
      await deleteMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  }, [deleteMutation]);

  const handleMarkPaid = useCallback(async (id: string) => {
    try {
      await markPaidMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors du marquage comme payé:', error);
    }
  }, [markPaidMutation]);

  const handleViewDetail = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailDrawerOpen(true);
  };

  // Table columns
  const columns: Column<Reservation>[] = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '100px',
      render: (value) => {
        const labels = { particulier: 'Particulier', entreprise: 'Entreprise', groupe: 'Groupe' };
        return <span className="capitalize">{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString('fr-FR'),
    },
    {
      key: 'places',
      label: 'Places',
      sortable: true,
      width: '80px',
    },
    {
      key: 'contact_name',
      label: 'Contact',
      sortable: true,
    },
    {
      key: 'contact_email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      width: '120px',
      render: (value) => {
        const styles = {
          pending_validation: 'bg-yellow-100 text-yellow-800',
          confirmed: 'bg-green-100 text-green-800',
          rejected: 'bg-red-100 text-red-800',
          cancelled: 'bg-gray-100 text-gray-800',
        };
        const labels = {
          pending_validation: 'En attente',
          confirmed: 'Confirmée',
          rejected: 'Refusée',
          cancelled: 'Annulée',
        };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
    {
      key: 'payment_status',
      label: 'Paiement',
      sortable: true,
      width: '100px',
      render: (value) => {
        const styles = {
          unpaid: 'bg-orange-100 text-orange-800',
          paid: 'bg-green-100 text-green-800',
          refunded: 'bg-blue-100 text-blue-800',
        };
        const labels = { unpaid: 'Non payé', paid: 'Payé', refunded: 'Remboursé' };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
    {
      key: 'id',
      label: 'Actions',
      width: '200px',
      render: (_, row: Reservation) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewDetail(row)}
            title="Voir détails"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {row.status === 'pending_validation' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700"
                onClick={() => handleConfirm(row.id)}
                disabled={confirmMutation.isPending}
                title="Confirmer"
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleReject(row.id)}
                disabled={rejectMutation.isPending}
                title="Refuser"
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </Button>
            </>
          )}
          {row.payment_status === 'unpaid' && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 hover:text-blue-700"
              onClick={() => handleMarkPaid(row.id)}
              disabled={markPaidMutation.isPending}
              title="Marquer comme payé"
            >
              {markPaidMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => handleDelete(row.id)}
            disabled={deleteMutation.isPending}
            title="Supprimer"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      id: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'particulier', label: 'Particulier' },
        { value: 'entreprise', label: 'Entreprise' },
        { value: 'groupe', label: 'Groupe' },
      ],
    },
    {
      id: 'status',
      label: 'Statut',
      type: 'select',
      options: [
        { value: 'pending_validation', label: 'En attente' },
        { value: 'confirmed', label: 'Confirmée' },
        { value: 'rejected', label: 'Refusée' },
        { value: 'cancelled', label: 'Annulée' },
      ],
    },
    {
      id: 'payment_status',
      label: 'Paiement',
      type: 'select',
      options: [
        { value: 'unpaid', label: 'Non payé' },
        { value: 'paid', label: 'Payé' },
        { value: 'refunded', label: 'Remboursé' },
      ],
    },
    {
      id: 'date_from',
      label: 'Du',
      type: 'date',
    },
    {
      id: 'date_to',
      label: 'Au',
      type: 'date',
    },
    {
      id: 'search',
      label: 'Recherche',
      type: 'text',
      placeholder: 'Nom, email, téléphone...',
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Erreur lors du chargement des réservations</p>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (filteredData.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune réservation trouvée</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <UtensilsCrossed className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Réservations</h1>
                <p className="text-sm text-gray-600">Gérer les réservations restaurant</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Total: <strong>{filteredData.length}</strong> réservation(s)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="container py-6">
        <FilterPanel
          options={filterOptions}
          values={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </div>

      {/* Table */}
      <div className="container pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Liste des réservations</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredData}
              selectable
              selectedIds={selectedReservations}
              onSelectionChange={setSelectedReservations}
            />
          </CardContent>
        </Card>
      </div>

      {/* Detail Drawer */}
      <Dialog open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la réservation</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="text-lg font-semibold capitalize">
                    {selectedReservation.type === 'particulier' ? 'Particulier' : selectedReservation.type === 'entreprise' ? 'Entreprise' : 'Groupe'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p className="text-lg font-semibold">
                    {new Date(selectedReservation.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nombre de places</label>
                  <p className="text-lg font-semibold">{selectedReservation.places}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut</label>
                  <p className="text-lg font-semibold">{selectedReservation.status}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Informations de contact</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nom</label>
                    <p>{selectedReservation.contact_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedReservation.contact_email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Téléphone</label>
                    <p>{selectedReservation.contact_phone}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Paiement</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Statut de paiement</label>
                    <p className="capitalize">{selectedReservation.payment_status}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date de création</label>
                    <p>{new Date(selectedReservation.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => setDetailDrawerOpen(false)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
