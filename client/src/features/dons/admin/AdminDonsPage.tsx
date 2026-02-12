import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Mail, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

// ============================================
// ADMIN DONS — UNIFIED VIEW
// ============================================

interface Donation {
  id: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  receipt_generated: boolean;
  created_at: string;
}

// Mock data
const MOCK_DONATIONS: Donation[] = [
  {
    id: 'don-001',
    donor_name: 'Ahmed Bennani',
    donor_email: 'ahmed@example.com',
    amount: 500,
    payment_status: 'paid',
    receipt_generated: true,
    created_at: '2026-02-10',
  },
  {
    id: 'don-002',
    donor_name: 'Fatima Alaoui',
    donor_email: 'fatima@example.com',
    amount: 1000,
    payment_status: 'paid',
    receipt_generated: true,
    created_at: '2026-02-09',
  },
  {
    id: 'don-003',
    donor_name: 'Mohammed Idrissi',
    donor_email: 'mohammed@example.com',
    amount: 250,
    payment_status: 'pending',
    receipt_generated: false,
    created_at: '2026-02-08',
  },
];

export default function AdminDonsPage() {
  const [selectedDonations, setSelectedDonations] = useState<Donation[]>([]);
  const [filters, setFilters] = useState({
    payment_status: '',
    receipt_status: '',
    amount_min: '',
    amount_max: '',
  });

  // Filter data
  const filteredData = useMemo(() => {
    return MOCK_DONATIONS.filter((don) => {
      if (filters.payment_status && don.payment_status !== filters.payment_status) return false;
      if (filters.receipt_status === 'generated' && !don.receipt_generated) return false;
      if (filters.receipt_status === 'not_generated' && don.receipt_generated) return false;
      if (filters.amount_min && don.amount < parseInt(filters.amount_min)) return false;
      if (filters.amount_max && don.amount > parseInt(filters.amount_max)) return false;
      return true;
    });
  }, [filters]);

  // Table columns
  const columns: Column<Donation>[] = [
    {
      key: 'donor_name',
      label: 'Donateur',
      sortable: true,
    },
    {
      key: 'donor_email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'amount',
      label: 'Montant',
      sortable: true,
      width: '120px',
      render: (value) => `${value} DH`,
    },
    {
      key: 'payment_status',
      label: 'Paiement',
      sortable: true,
      width: '120px',
      render: (value) => {
        const styles = {
          pending: 'bg-yellow-100 text-yellow-800',
          paid: 'bg-green-100 text-green-800',
          failed: 'bg-red-100 text-red-800',
        };
        const labels = { pending: 'En attente', paid: 'Payé', failed: 'Échoué' };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
    {
      key: 'receipt_generated',
      label: 'Reçu',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span className={value ? 'text-green-600 font-semibold' : 'text-gray-500'}>
          {value ? '✓ Généré' : '✗ Non généré'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString('fr-FR'),
    },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      id: 'payment_status',
      label: 'Statut paiement',
      type: 'select',
      options: [
        { value: 'pending', label: 'En attente' },
        { value: 'paid', label: 'Payé' },
        { value: 'failed', label: 'Échoué' },
      ],
    },
    {
      id: 'receipt_status',
      label: 'Reçu',
      type: 'select',
      options: [
        { value: 'generated', label: 'Généré' },
        { value: 'not_generated', label: 'Non généré' },
      ],
    },
  ];

  const totalDonations = filteredData.reduce((sum, don) => sum + don.amount, 0);
  const paidDonations = filteredData.filter((d) => d.payment_status === 'paid').reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-50 to-red-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-foreground">Dons</h1>
          </div>
          <p className="text-muted-foreground">Gérer les dons et générer les reçus</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total dons</p>
              <p className="text-2xl font-bold">{filteredData.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Montant total</p>
              <p className="text-2xl font-bold">{totalDonations} DH</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Montant reçu</p>
              <p className="text-2xl font-bold">{paidDonations} DH</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Reçus générés</p>
              <p className="text-2xl font-bold">{filteredData.filter((d) => d.receipt_generated).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <FilterPanel
          filters={filterOptions}
          values={filters}
          onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ payment_status: '', receipt_status: '', amount_min: '', amount_max: '' })}
          className="mb-8"
        />

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des dons ({filteredData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<Donation>
              data={filteredData}
              columns={columns}
              selectable={true}
              onSelectionChange={setSelectedDonations}
              emptyMessage="Aucun don trouvé"
            />

            {/* Bulk Actions */}
            {selectedDonations.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg flex items-center justify-between">
                <p className="text-sm font-semibold">{selectedDonations.length} don(s) sélectionné(s)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Mail className="w-4 h-4" />
                    Envoyer reçu
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Supprimer
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
