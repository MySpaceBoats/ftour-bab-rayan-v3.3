'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Eye, Check, X, Loader2, QrCode } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift_date: string;
  shift_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  qr_generated: boolean;
  present: boolean;
  created_at: string;
}

export default function AdminBenevolePage() {
  const { user } = useAuth();
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    qr_status: '',
    presence_status: '',
    search: '',
  });

  const { data: volunteers = [], isLoading } = trpc.backoffice.benevoles.list.useQuery({}, { enabled: !!user });
  const confirmMutation = trpc.backoffice.benevoles.confirm.useMutation();
  const generateQRMutation = trpc.backoffice.benevoles.generateQR.useMutation();
  const markPresentMutation = trpc.backoffice.benevoles.markPresent.useMutation();
  const cancelMutation = trpc.backoffice.benevoles.cancel.useMutation();

  const filteredData = useMemo(() => {
    return (volunteers as Volunteer[]).filter((vol) => {
      if (filters.status && vol.status !== filters.status) return false;
      if (filters.qr_status === 'with_qr' && !vol.qr_generated) return false;
      if (filters.qr_status === 'without_qr' && vol.qr_generated) return false;
      if (filters.presence_status === 'present' && !vol.present) return false;
      if (filters.presence_status === 'absent' && vol.present) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return vol.name.toLowerCase().includes(search) || vol.email.toLowerCase().includes(search);
      }
      return true;
    });
  }, [volunteers, filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ status: '', qr_status: '', presence_status: '', search: '' });
  };

  const handleConfirm = useCallback(async (id: string) => {
    try {
      await confirmMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [confirmMutation]);

  const handleGenerateQR = useCallback(async (id: string) => {
    try {
      await generateQRMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [generateQRMutation]);

  const handleMarkPresent = useCallback(async (id: string) => {
    try {
      await markPresentMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [markPresentMutation]);

  const handleCancel = useCallback(async (id: string) => {
    if (!confirm('Êtes-vous sûr ?')) return;
    try {
      await cancelMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [cancelMutation]);

  const handleViewDetail = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setDetailDrawerOpen(true);
  };

  const columns: Column<Volunteer>[] = [
    {
      key: 'name',
      label: 'Nom',
      sortable: true,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'shift_date',
      label: 'Date',
      sortable: true,
      width: '100px',
      render: (value) => new Date(value).toLocaleDateString('fr-FR'),
    },
    {
      key: 'shift_time',
      label: 'Créneau',
      sortable: true,
      width: '100px',
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
          cancelled: 'bg-red-100 text-red-800',
        };
        const labels = { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé' };
        return <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: 'present',
      label: 'Présent',
      sortable: true,
      width: '80px',
      render: (value) => <span className={value ? 'text-green-600 font-semibold' : 'text-red-600'}>{value ? 'Oui' : 'Non'}</span>,
    },
    {
      key: 'id',
      label: 'Actions',
      width: '250px',
      render: (_, row: Volunteer) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewDetail(row)}>
            <Eye className="h-4 w-4" />
          </Button>
          {row.status === 'pending' && (
            <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleConfirm(row.id)} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          )}
          {!row.qr_generated && (
            <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleGenerateQR(row.id)} disabled={generateQRMutation.isPending}>
              {generateQRMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            </Button>
          )}
          {row.status === 'confirmed' && !row.present && (
            <Button size="sm" variant="outline" className="text-purple-600" onClick={() => handleMarkPresent(row.id)} disabled={markPresentMutation.isPending}>
              {markPresentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Présent'}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleCancel(row.id)} disabled={cancelMutation.isPending}>
            {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
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
        { value: 'cancelled', label: 'Annulé' },
      ],
    },
    {
      id: 'qr_status',
      label: 'QR Code',
      type: 'select',
      options: [
        { value: 'with_qr', label: 'Avec QR' },
        { value: 'without_qr', label: 'Sans QR' },
      ],
    },
    {
      id: 'presence_status',
      label: 'Présence',
      type: 'select',
      options: [
        { value: 'present', label: 'Présent' },
        { value: 'absent', label: 'Absent' },
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
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bénévoles</h1>
              <p className="text-sm text-gray-600">Gérer les bénévoles et créneaux</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Total: <strong>{filteredData.length}</strong> bénévole(s) | Confirmés: <strong>{filteredData.filter(v => v.status === 'confirmed').length}</strong>
          </p>
        </div>
      </div>

      <div className="container py-6">
        <FilterPanel options={filterOptions} values={filters} onChange={handleFilterChange} onReset={handleResetFilters} />
      </div>

      <div className="container pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Liste des bénévoles</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun bénévole trouvé</p>
              </div>
            ) : (
              <DataTable columns={columns} data={filteredData} selectable selectedIds={selectedVolunteers} onSelectionChange={setSelectedVolunteers} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du bénévole</DialogTitle>
          </DialogHeader>
          {selectedVolunteer && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut</label>
                  <p className="text-lg font-semibold">{selectedVolunteer.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Présent</label>
                  <p className="text-lg font-semibold">{selectedVolunteer.present ? 'Oui' : 'Non'}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Informations personnelles</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nom</label>
                    <p>{selectedVolunteer.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedVolunteer.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Téléphone</label>
                    <p>{selectedVolunteer.phone}</p>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Créneau</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date</label>
                    <p>{new Date(selectedVolunteer.shift_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Heure</label>
                    <p>{selectedVolunteer.shift_time}</p>
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
