import { useState } from 'react';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Download, QrCode, Users, BarChart3 } from 'lucide-react';

export default function CompanyBookingSpace() {
  const { t } = useI18n();
  const [bookingReference, setBookingReference] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  const { data: booking, isLoading } = trpc.companyBookings.getByReference.useQuery(
    { reference: bookingReference },
    { enabled: !!bookingReference }
  );

  const { data: stats } = trpc.companyBookings.getStats.useQuery(
    { bookingId: booking?.id || 0 },
    { enabled: !!booking?.id }
  );

  const handleDownloadQRCodes = () => {
    // Implémentation du téléchargement des QR codes
    console.log('Téléchargement des QR codes...');
  };

  const handlePrintQRCodes = () => {
    // Implémentation de l'impression des QR codes
    window.print();
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t.companyBooking.companySpace}</h1>
          <p className="text-lg text-muted-foreground">{t.companyBooking.manageParticipants}</p>
        </div>

        {/* Access Form */}
        {!booking && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Accéder à votre espace</CardTitle>
              <CardDescription>Entrez votre référence de réservation pour accéder à votre espace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: REF-2026-001"
                  value={bookingReference}
                  onChange={(e) => setBookingReference(e.target.value)}
                />
                <Button onClick={() => setBookingReference(bookingReference)}>
                  Accéder
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Details */}
        {booking && (
          <>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Détails de la réservation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Entreprise</p>
                    <p className="font-semibold">{booking.companyName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Référence</p>
                    <p className="font-semibold">{booking.reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de participants</p>
                    <p className="font-semibold">{booking.numberOfTickets}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    <p className="font-semibold">{booking.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            {stats && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Statistiques
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total billets</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billets scannés</p>
                      <p className="text-2xl font-bold">{stats.checkedIn}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Taux de présence</p>
                      <p className="text-2xl font-bold">
                        {stats.total > 0 
                          ? Math.round((stats.checkedIn / stats.total) * 100) 
                          : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* QR Codes Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Codes QR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button onClick={handleDownloadQRCodes} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger les QR codes
                  </Button>
                  <Button onClick={handlePrintQRCodes} className="flex-1">
                    Imprimer les QR codes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {isLoading && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Chargement...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
