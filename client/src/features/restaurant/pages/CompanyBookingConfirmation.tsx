import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download, Eye } from 'lucide-react';

export default function CompanyBookingConfirmation() {
  const { t } = useI18n();
  const [, params] = useRoute('/company-booking-confirmation/:reference');
  const [, navigate] = useLocation();
  const [showTickets, setShowTickets] = useState(false);

  const { data: booking, isLoading } = trpc.companyBookings.getByReference.useQuery(
    { reference: params?.reference || '' },
    { enabled: !!params?.reference }
  );

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Réservation non trouvée</h1>
          <Button onClick={() => navigate('/company-booking')}>Retour</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">{t.companyBooking.reservationCreated}</h1>
          <p className="text-lg text-muted-foreground">
            Référence: <strong>{booking.reference}</strong>
          </p>
        </div>

        {/* Booking Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Détails de la réservation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Entreprise</p>
                <p className="font-semibold">{booking.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="font-semibold">{booking.contactName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nombre de participants</p>
                <p className="font-semibold">{booking.participantsCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-semibold">{new Date(booking.date).toLocaleDateString('fr-FR')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <p className="font-semibold">{t.companyBooking.statusPending}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paiement</p>
                <p className="font-semibold">{t.companyBooking.paymentStatusPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t.companyBooking.participantsList}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTickets(!showTickets)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {showTickets ? 'Masquer' : 'Afficher'}
              </Button>
            </CardTitle>
          </CardHeader>
          {showTickets && (
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {booking.tickets?.map((ticket: any, idx: number) => (
                  <div key={ticket.id} className="p-3 bg-muted rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Participant {idx + 1}</p>
                      <p className="text-sm text-muted-foreground">Code: {ticket.ticketCode}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Actions */}
        <div className="flex gap-4 flex-col sm:flex-row">
          <Button className="flex-1" onClick={() => navigate('/company-booking-space')}>
            {t.companyBooking.companySpace}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </div>

        {/* Info Message */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            Un email de confirmation a été envoyé à <strong>{booking.contactEmail}</strong>. 
            Vous pouvez accéder à votre espace entreprise pour gérer les participants et télécharger les QR codes.
          </p>
        </div>
      </div>
    </div>
  );
}
