import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, QrCode, Check, Mail, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

// ============================================
// ADMIN BÉNÉVOLES — UNIFIED VIEW
// ============================================

interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  created_at: string;
}

interface VolunteerShift {
  id: string;
  volunteer_id: string;
  volunteer_name: string;
  date: string;
  shift: 'morning' | 'afternoon' | 'evening';
  confirmed: boolean;
  qr_generated: boolean;
  present: boolean;
}

// Mock data
const MOCK_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-001',
    name: 'Ahmed Bennani',
    email: 'ahmed@example.com',
    phone: '+212 6 12 34 56 78',
    status: 'active',
    created_at: '2026-01-15',
  },
  {
    id: 'vol-002',
    name: 'Fatima Alaoui',
    email: 'fatima@example.com',
    phone: '+212 6 98 76 54 32',
    status: 'active',
    created_at: '2026-01-20',
  },
  {
    id: 'vol-003',
    name: 'Mohammed Idrissi',
    email: 'mohammed@example.com',
    phone: '+212 6 55 44 33 22',
    status: 'inactive',
    created_at: '2025-12-01',
  },
];

const MOCK_SHIFTS: VolunteerShift[] = [
  {
    id: 'shift-001',
    volunteer_id: 'vol-001',
    volunteer_name: 'Ahmed Bennani',
    date: '2026-03-15',
    shift: 'morning',
    confirmed: true,
    qr_generated: true,
    present: false,
  },
  {
    id: 'shift-002',
    volunteer_id: 'vol-002',
    volunteer_name: 'Fatima Alaoui',
    date: '2026-03-15',
    shift: 'afternoon',
    confirmed: true,
    qr_generated: true,
    present: true,
  },
  {
    id: 'shift-003',
    volunteer_id: 'vol-001',
    volunteer_name: 'Ahmed Bennani',
    date: '2026-03-16',
    shift: 'evening',
    confirmed: false,
    qr_generated: false,
    present: false,
  },
];

export default function AdminBenevolePage() {
  const [activeTab, setActiveTab] = useState<'volunteers' | 'shifts'>('volunteers');
  const [selectedVolunteers, setSelectedVolunteers] = useState<Volunteer[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<VolunteerShift[]>([]);
  const [volunteerFilters, setVolunteerFilters] = useState({
    status: '',
  });
  const [shiftFilters, setShiftFilters] = useState({
    shift: '',
    confirmed: '',
    present: '',
  });

  // Filter volunteers
  const filteredVolunteers = useMemo(() => {
    return MOCK_VOLUNTEERS.filter((vol) => {
      if (volunteerFilters.status && vol.status !== volunteerFilters.status) return false;
      return true;
    });
  }, [volunteerFilters]);

  // Filter shifts
  const filteredShifts = useMemo(() => {
    return MOCK_SHIFTS.filter((shift) => {
      if (shiftFilters.shift && shift.shift !== shiftFilters.shift) return false;
      if (shiftFilters.confirmed === 'confirmed' && !shift.confirmed) return false;
      if (shiftFilters.confirmed === 'not_confirmed' && shift.confirmed) return false;
      if (shiftFilters.present === 'present' && !shift.present) return false;
      if (shiftFilters.present === 'absent' && shift.present) return false;
      return true;
    });
  }, [shiftFilters]);

  // Volunteer columns
  const volunteerColumns: Column<Volunteer>[] = [
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
      key: 'phone',
      label: 'Téléphone',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      width: '100px',
      render: (value) => {
        const styles = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
        };
        const labels = { active: 'Actif', inactive: 'Inactif' };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Inscrit',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString('fr-FR'),
    },
  ];

  // Shift columns
  const shiftColumns: Column<VolunteerShift>[] = [
    {
      key: 'volunteer_name',
      label: 'Bénévole',
      sortable: true,
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString('fr-FR'),
    },
    {
      key: 'shift',
      label: 'Créneau',
      sortable: true,
      width: '100px',
      render: (value) => {
        const labels = { morning: 'Matin', afternoon: 'Midi', evening: 'Soir' };
        return labels[value as keyof typeof labels];
      },
    },
    {
      key: 'confirmed',
      label: 'Confirmé',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span className={value ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
          {value ? '✓ Oui' : '✗ Non'}
        </span>
      ),
    },
    {
      key: 'qr_generated',
      label: 'QR',
      sortable: true,
      width: '80px',
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-gray-500'}>
          {value ? '✓' : '✗'}
        </span>
      ),
    },
    {
      key: 'present',
      label: 'Présent',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span className={value ? 'text-green-600 font-semibold' : 'text-gray-500'}>
          {value ? '✓ Oui' : '✗ Non'}
        </span>
      ),
    },
  ];

  // Filter options
  const volunteerFilterOptions: FilterOption[] = [
    {
      id: 'status',
      label: 'Statut',
      type: 'select',
      options: [
        { value: 'active', label: 'Actif' },
        { value: 'inactive', label: 'Inactif' },
      ],
    },
  ];

  const shiftFilterOptions: FilterOption[] = [
    {
      id: 'shift',
      label: 'Créneau',
      type: 'select',
      options: [
        { value: 'morning', label: 'Matin' },
        { value: 'afternoon', label: 'Midi' },
        { value: 'evening', label: 'Soir' },
      ],
    },
    {
      id: 'confirmed',
      label: 'Confirmé',
      type: 'select',
      options: [
        { value: 'confirmed', label: 'Confirmé' },
        { value: 'not_confirmed', label: 'Non confirmé' },
      ],
    },
    {
      id: 'present',
      label: 'Présence',
      type: 'select',
      options: [
        { value: 'present', label: 'Présent' },
        { value: 'absent', label: 'Absent' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-700" />
              <h1 className="text-3xl font-bold text-foreground">Bénévoles</h1>
            </div>
            {activeTab === 'volunteers' && (
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nouveau bénévole
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">Gérer bénévoles et créneaux</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="volunteers">Bénévoles</TabsTrigger>
            <TabsTrigger value="shifts">Créneaux</TabsTrigger>
          </TabsList>

          {/* Volunteers Tab */}
          <TabsContent value="volunteers" className="space-y-8">
            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total bénévoles</p>
                  <p className="text-2xl font-bold">{MOCK_VOLUNTEERS.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Actifs</p>
                  <p className="text-2xl font-bold">{MOCK_VOLUNTEERS.filter((v) => v.status === 'active').length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Créneaux assignés</p>
                  <p className="text-2xl font-bold">{MOCK_SHIFTS.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <FilterPanel
              filters={volunteerFilterOptions}
              values={volunteerFilters}
              onFilterChange={(key, value) => setVolunteerFilters((prev) => ({ ...prev, [key]: value }))}
              onReset={() => setVolunteerFilters({ status: '' })}
            />

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Bénévoles ({filteredVolunteers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<Volunteer>
                  data={filteredVolunteers}
                  columns={volunteerColumns}
                  selectable={true}
                  onSelectionChange={setSelectedVolunteers}
                  emptyMessage="Aucun bénévole trouvé"
                />

                {/* Bulk Actions */}
                {selectedVolunteers.length > 0 && (
                  <div className="mt-6 p-4 bg-muted rounded-lg flex items-center justify-between">
                    <p className="text-sm font-semibold">{selectedVolunteers.length} bénévole(s) sélectionné(s)</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Mail className="w-4 h-4" />
                        Envoyer email
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
          </TabsContent>

          {/* Shifts Tab */}
          <TabsContent value="shifts" className="space-y-8">
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total créneaux</p>
                  <p className="text-2xl font-bold">{MOCK_SHIFTS.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Confirmés</p>
                  <p className="text-2xl font-bold">{MOCK_SHIFTS.filter((s) => s.confirmed).length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">QR générés</p>
                  <p className="text-2xl font-bold">{MOCK_SHIFTS.filter((s) => s.qr_generated).length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Présents</p>
                  <p className="text-2xl font-bold">{MOCK_SHIFTS.filter((s) => s.present).length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <FilterPanel
              filters={shiftFilterOptions}
              values={shiftFilters}
              onFilterChange={(key, value) => setShiftFilters((prev) => ({ ...prev, [key]: value }))}
              onReset={() => setShiftFilters({ shift: '', confirmed: '', present: '' })}
            />

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Créneaux ({filteredShifts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<VolunteerShift>
                  data={filteredShifts}
                  columns={shiftColumns}
                  selectable={true}
                  onSelectionChange={setSelectedShifts}
                  emptyMessage="Aucun créneau trouvé"
                />

                {/* Bulk Actions */}
                {selectedShifts.length > 0 && (
                  <div className="mt-6 p-4 bg-muted rounded-lg flex items-center justify-between">
                    <p className="text-sm font-semibold">{selectedShifts.length} créneau(x) sélectionné(s)</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Check className="w-4 h-4" />
                        Confirmer
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <QrCode className="w-4 h-4" />
                        Générer QR
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Check className="w-4 h-4" />
                        Marquer présent
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
