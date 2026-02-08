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
                  placeholder="Ex: CBR-2026-123456"
                  value={bookingReference}
                  onChange={(e) => setBookingReference(e.target.value)}
                />
                <Button onClick={() => setSelectedBooking(booking)}>Accéder</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {booking && (
          <>
            {/* Booking Info */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{booking.companyName}</CardTitle>
                <CardDescription>Référence: {booking.reference}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="font-semibold">{booking.contactName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold text-sm">{booking.contactEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-semibold">{booking.contactPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">{new Date(booking.date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t.companyBooking.totalParticipants}</p>
                        <p className="text-2xl font-bold">{stats.totalParticipants}</p>
                      </div>
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t.companyBooking.checkedInCount}</p>
                        <p className="text-2xl font-bold text-green-600">{stats.checkedInCount}</p>
                      </div>
                      <QrCode className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t.companyBooking.absentCount}</p>
                        <p className="text-2xl font-bold text-orange-600">{stats.absentCount}</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t.companyBooking.cancelledCount}</p>
                        <p className="text-2xl font-bold text-red-600">{stats.cancelledCount}</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tickets List */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t.companyBooking.participantsList}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleDownloadQRCodes}>
                      <Download className="w-4 h-4 mr-2" />
                      {t.companyBooking.downloadPDF}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handlePrintQRCodes}>
                      <QrCode className="w-4 h-4 mr-2" />
                      {t.companyBooking.printQRCodes}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {booking.tickets?.map((ticket, idx) => (
                    <div key={ticket.id} className="p-4 bg-muted rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{t.companyBooking.participantName} {idx + 1}</p>
                        <p className="text-sm text-muted-foreground">Code: {ticket.ticketCode}</p>
                        <p className="text-xs text-muted-foreground mt-1">QR Token: {ticket.qrToken}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          ticket.checkedInAt ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.checkedInAt ? t.companyBooking.checkedIn : t.companyBooking.notCheckedIn}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setBookingReference('')}>
                Accéder à une autre réservation
              </Button>
              <Button className="flex-1" onClick={() => window.location.href = '/'}>
                Retour à l'accueil
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
