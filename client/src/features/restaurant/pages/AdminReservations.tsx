import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface Reservation {
  id: number;
  reference: string;
  type: 'particulier' | 'entreprise' | 'groupe';
  name: string;
  email: string;
  phone: string;
  date: Date;
  seatsTotal: number;
  status: string;
  paymentStatus: string;
  qrStatus: string;
  companyName?: string;
  groupName?: string;
  notes?: string;
  createdAt: Date;
}

export default function AdminReservations() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending_validation');
  const [isLoading, setIsLoading] = useState(false);

  const validateMutation = trpc.restaurantReservations.validate.useMutation();
  const refuseMutation = trpc.restaurantReservations.refuse.useMutation();

  // Mock data - À remplacer par un vrai appel API pour lister les réservations
  useEffect(() => {
    const mockReservations: Reservation[] = [
      {
        id: 1,
        reference: 'RES-P-ABC123',
        type: 'particulier',
        name: 'Jean Dupont',
        email: 'jean@example.com',
        phone: '+212612345678',
        date: new Date('2026-02-20'),
        seatsTotal: 4,
        status: 'pending_validation',
        paymentStatus: 'not_requested',
        qrStatus: 'inactive',
        createdAt: new Date(),
      },
      {
        id: 2,
        reference: 'RES-E-DEF456',
        type: 'entreprise',
        name: 'Marie Martin',
        email: 'marie@company.com',
        phone: '+212612345679',
        date: new Date('2026-03-01'),
        seatsTotal: 50,
        status: 'pending_validation',
        paymentStatus: 'not_requested',
        qrStatus: 'inactive',
        companyName: 'Tech Solutions SA',
        notes: 'Team building event',
        createdAt: new Date(),
      },
      {
        id: 3,
        reference: 'RES-G-GHI789',
        type: 'groupe',
        name: 'Ahmed Bennani',
        email: 'ahmed@group.com',
        phone: '+212612345680',
        date: new Date('2026-02-28'),
        seatsTotal: 20,
        status: 'pending_validation',
        paymentStatus: 'not_requested',
        qrStatus: 'inactive',
        groupName: 'Association Culturelle',
        createdAt: new Date(),
      },
    ];

    setReservations(mockReservations);
  }, []);

  const filteredReservations = reservations.filter(r => r.status === filterStatus);

  const handleValidate = async (reservation: Reservation) => {
    try {
      setIsLoading(true);
      await validateMutation.mutateAsync({
        reference: reservation.reference,
        baseUrl: window.location.origin,
      });

      toast.success('Réservation validée. Email de confirmation envoyé.');
      
      // Mettre à jour le statut localement
      setReservations(prev =>
        prev.map(r =>
          r.id === reservation.id
            ? { ...r, status: 'validated_pending_payment', paymentStatus: 'pending_payment' }
            : r
        )
      );
      setSelectedReservation(null);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la validation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefuse = async (reservation: Reservation) => {
    try {
      setIsLoading(true);
      await refuseMutation.mutateAsync({
        reference: reservation.reference,
      });

      toast.success('Réservation refusée. Email de notification envoyé.');
      
      // Mettre à jour le statut localement
      setReservations(prev =>
        prev.map(r =>
          r.id === reservation.id
            ? { ...r, status: 'refused' }
            : r
        )
      );
      setSelectedReservation(null);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du refus');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#844653] italic">Admin - Réservations Restaurant</h1>
          <p className="text-[#8b8b7a] mt-2">Gérez les demandes de réservation</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des réservations */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Réservations en attente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label>Filtrer par statut</Label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-[#d4a574] rounded"
                  >
                    <option value="pending_validation">En attente de validation</option>
                    <option value="validated_pending_payment">Validée (en attente paiement)</option>
                    <option value="paid_confirmed">Confirmée (paiement reçu)</option>
                    <option value="refused">Refusée</option>
                  </select>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredReservations.length === 0 ? (
                    <p className="text-[#8b8b7a] text-sm">Aucune réservation avec ce statut</p>
                  ) : (
                    filteredReservations.map(reservation => (
                      <div
                        key={reservation.id}
                        onClick={() => setSelectedReservation(reservation)}
                        className={`p-3 border rounded cursor-pointer transition ${
                          selectedReservation?.id === reservation.id
                            ? 'bg-[#844653] text-white border-[#844653]'
                            : 'bg-white border-[#d4a574] hover:bg-[#f9f9f5]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{reservation.reference}</p>
                            <p className="text-sm">{reservation.name}</p>
                            <p className="text-xs text-[#8b8b7a]">
                              {reservation.date.toLocaleDateString('fr-FR')} • {reservation.seatsTotal} places
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-[#d4a574] text-[#844653] rounded">
                            {reservation.type}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Détails de la réservation sélectionnée */}
          {selectedReservation && (
            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle className="text-lg">Détails</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-[#8b8b7a]">Référence</Label>
                    <p className="font-mono text-sm">{selectedReservation.reference}</p>
                  </div>

                  <div>
                    <Label className="text-xs text-[#8b8b7a]">Type</Label>
                    <p className="font-medium capitalize">{selectedReservation.type}</p>
                  </div>

                  <div>
                    <Label className="text-xs text-[#8b8b7a]">Contact</Label>
                    <p className="font-medium">{selectedReservation.name}</p>
                    <p className="text-sm">{selectedReservation.email}</p>
                    <p className="text-sm">{selectedReservation.phone}</p>
                  </div>

                  {selectedReservation.companyName && (
                    <div>
                      <Label className="text-xs text-[#8b8b7a]">Entreprise</Label>
                      <p className="font-medium">{selectedReservation.companyName}</p>
                    </div>
                  )}

                  {selectedReservation.groupName && (
                    <div>
                      <Label className="text-xs text-[#8b8b7a]">Groupe</Label>
                      <p className="font-medium">{selectedReservation.groupName}</p>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-[#8b8b7a]">Date & Places</Label>
                    <p className="font-medium">{selectedReservation.date.toLocaleDateString('fr-FR')}</p>
                    <p className="text-sm">{selectedReservation.seatsTotal} participants</p>
                  </div>

                  {selectedReservation.notes && (
                    <div>
                      <Label className="text-xs text-[#8b8b7a]">Notes</Label>
                      <p className="text-sm">{selectedReservation.notes}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#d4a574] space-y-2">
                    <Button
                      onClick={() => handleValidate(selectedReservation)}
                      disabled={isLoading || selectedReservation.status !== 'pending_validation'}
                      className="w-full bg-[#844653] text-white hover:bg-[#6B3743]"
                    >
                      ✓ Valider
                    </Button>
                    <Button
                      onClick={() => handleRefuse(selectedReservation)}
                      disabled={isLoading || selectedReservation.status !== 'pending_validation'}
                      className="w-full bg-red-600 text-white hover:bg-red-700"
                    >
                      ✕ Refuser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
