'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Eye, Trash2, Loader2, Download } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

interface Donation {
  id: string;
  amount: number;
  donor_name: string;
  donor_email: string;
  status: 'pending' | 'confirmed' | 'received';
  receipt_generated: boolean;
  created_at: string;
}

export default function AdminDonsPage() {
  const { user } = useAuth();
  const [selectedDonations, setSelectedDonations] = useState<string[]>([]);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    receipt_status: '',
    search: '',
  });

  const { data: donations = [], isLoading } = trpc.backoffice.dons.list.useQuery({}, { enabled: !!user });
  const confirmMutation = trpc.backoffice.dons.confirm.useMutation();
  const generateReceiptMutation = trpc.backoffice.dons.generateReceipt.useMutation();
  const deleteMutation = trpc.backoffice.dons.delete.useMutation();
  const exportMutation = trpc.backoffice.dons.export.useMutation();

  const filteredData = useMemo(() => {
    return (donations as Donation[]).filter((don) => {
      if (filters.status && don.status !== filters.status) return false;
      if (filters.receipt_status === 'with_receipt' && !don.receipt_generated) return false;
      if (filters.receipt_status === 'without_receipt' && don.receipt_generated) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return don.donor_name.toLowerCase().includes(search) || don.donor_email.toLowerCase().includes(search);
      }
      return true;
    });
  }, [donations, filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ status: '', receipt_status: '', search: '' });
  };

  const handleConfirm = useCallback(async (id: string) => {
    try {
      await confirmMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [confirmMutation]);

  const handleGenerateReceipt = useCallback(async (id: string) => {
    try {
      await generateReceiptMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [generateReceiptMutation]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Êtes-vous sûr ?')) return;
    try {
      await deleteMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [deleteMutation]);

  const handleViewDetail = (donation: Donation) => {
    setSelectedDonation(donation);
    setDetailDrawerOpen(true);
  };

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
      width: '100px',
      render: (value) => `${value} DH`,
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
          received: 'bg-blue-100 text-blue-800',
        };
        const labels = { pending: 'En attente', confirmed: 'Confirmé', received: 'Reçu' };
        return <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: 'receipt_generated',
      label: 'Reçu',
      sortable: true,
      width: '80px',
      render: (value) => <span className={value ? 'text-green-600 font-semibold' : 'text-red-600'}>{value ? 'Généré' : 'Non'}</span>,
    },
    {
      key: 'id',
      label: 'Actions',
      width: '250px',
      render: (_, row: Donation) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewDetail(row)}>
            <Eye className="h-4 w-4" />
          </Button>
          {row.status === 'pending' && (
            <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleConfirm(row.id)} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
            </Button>
          )}
          {!row.receipt_generated && (
            <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleGenerateReceipt(row.id)} disabled={generateReceiptMutation.isPending}>
              {generateReceiptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(row.id)} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  const filterOptions: FilterOption[] = [
    {
      id: 'status',
      label: 'Statut',
      type: 'select',
      options: [
        { value: 'pending', label: 'En attente' },
        { value: 'confirmed', label: 'Confirmé' },
        { value: 'received', label: 'Reçu' },
      ],
    },
    {
      id: 'receipt_status',
      label: 'Reçu',
      type: 'select',
      options: [
        { value: 'with_receipt', label: 'Avec reçu' },
        { value: 'without_receipt', label: 'Sans reçu' },
      ],
    },
    {
      id: 'search',
      label: 'Recherche',
      type: 'text',
      placeholder: 'Nom ou email...',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-red-50 to-pink-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="h-6 w-6 text-red-700" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dons</h1>
                <p className="text-sm text-gray-600">Gérer les donations</p>
              </div>
            </div>
            <Button onClick={() => exportMutation.mutateAsync({})} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Exporter
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Total: <strong>{filteredData.length}</strong> don(s) | Montant: <strong>{filteredData.reduce((sum, d) => sum + d.amount, 0)} DH</strong>
          </p>
        </div>
      </div>

      <div className="container py-6">
        <FilterPanel options={filterOptions} values={filters} onChange={handleFilterChange} onReset={handleResetFilters} />
      </div>

      <div className="container pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Liste des dons</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun don trouvé</p>
              </div>
            ) : (
              <DataTable columns={columns} data={filteredData} selectable selectedIds={selectedDonations} onSelectionChange={setSelectedDonations} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du don</DialogTitle>
          </DialogHeader>
          {selectedDonation && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Montant</label>
                  <p className="text-lg font-semibold">{selectedDonation.amount} DH</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut</label>
                  <p className="text-lg font-semibold">{selectedDonation.status}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Informations du donateur</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nom</label>
                    <p>{selectedDonation.donor_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedDonation.donor_email}</p>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Reçu</h3>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut du reçu</label>
                  <p>{selectedDonation.receipt_generated ? 'Généré' : 'Non généré'}</p>
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
