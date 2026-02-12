import { useState, useMemo } from 'react';
import { useSearchParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UtensilsCrossed, Plus, Eye, Check, X, CreditCard, Mail, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

// ============================================
// ADMIN RESERVATIONS — UNIFIED VIEW
// ============================================

interface Reservation {
  id: string;
  type: 'particulier' | 'entreprise' | 'groupe';
  date: string;
  places: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  created_at: string;
}

// Mock data — à remplacer par tRPC
const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'res-001',
    type: 'particulier',
    date: '2026-03-15',
    places: 4,
    contact_name: 'Ahmed Bennani',
    contact_email: 'ahmed@example.com',
    contact_phone: '+212 6 12 34 56 78',
    status: 'confirmed',
    payment_status: 'paid',
    created_at: '2026-02-10',
  },
  {
    id: 'res-002',
    type: 'entreprise',
    date: '2026-03-20',
    places: 25,
    contact_name: 'Fatima Alaoui',
    contact_email: 'fatima@company.com',
    contact_phone: '+212 6 98 76 54 32',
    status: 'pending',
    payment_status: 'unpaid',
    created_at: '2026-02-11',
  },
  {
    id: 'res-003',
    type: 'groupe',
    date: '2026-03-25',
    places: 50,
    contact_name: 'Association Solidarité',
    contact_email: 'contact@asso.com',
    contact_phone: '+212 5 22 12 34 56',
    status: 'confirmed',
    payment_status: 'paid',
    created_at: '2026-02-09',
  },
];

export default function AdminReservationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReservations, setSelectedReservations] = useState<Reservation[]>([]);
  const [filters, setFilters] = useState({
    type: searchParams.type || '',
    status: searchParams.status || '',
    payment_status: searchParams.payment_status || '',
    date_from: searchParams.date_from || '',
    date_to: searchParams.date_to || '',
    search: searchParams.search || '',
  });

  // Filter data
  const filteredData = useMemo(() => {
    return MOCK_RESERVATIONS.filter((res) => {
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
  }, [filters]);

  // Handle filter change
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Update URL params
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
          pending: 'bg-yellow-100 text-yellow-800',
          confirmed: 'bg-green-100 text-green-800',
          rejected: 'bg-red-100 text-red-800',
          cancelled: 'bg-gray-100 text-gray-800',
        };
        const labels = {
          pending: 'En attente',
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
        { value: 'pending', label: 'En attente' },
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
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="w-8 h-8 text-amber-700" />
              <h1 className="text-3xl font-bold text-foreground">Réservations</h1>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle réservation
            </Button>
          </div>
          <p className="text-muted-foreground">Gérer toutes les réservations (Particuliers, Entreprises, Groupes)</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{MOCK_RESERVATIONS.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-2xl font-bold">{MOCK_RESERVATIONS.filter((r) => r.status === 'pending').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Confirmées</p>
              <p className="text-2xl font-bold">{MOCK_RESERVATIONS.filter((r) => r.status === 'confirmed').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Payées</p>
              <p className="text-2xl font-bold">{MOCK_RESERVATIONS.filter((r) => r.payment_status === 'paid').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <FilterPanel
          filters={filterOptions}
          values={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          className="mb-8"
        />

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des réservations ({filteredData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<Reservation>
              data={filteredData}
              columns={columns}
              selectable={true}
              onSelectionChange={setSelectedReservations}
              emptyMessage="Aucune réservation trouvée"
            />

            {/* Bulk Actions */}
            {selectedReservations.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg flex items-center justify-between">
                <p className="text-sm font-semibold">{selectedReservations.length} réservation(s) sélectionnée(s)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Check className="w-4 h-4" />
                    Confirmer
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <X className="w-4 h-4" />
                    Refuser
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CreditCard className="w-4 h-4" />
                    Marquer payé
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Mail className="w-4 h-4" />
                    Envoyer email
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
