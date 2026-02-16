import { useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Calendar, Users, Clock, Phone, AlertCircle, Home, Mail } from 'lucide-react';

export default function CheckinReservation() {
  const [, params] = useRoute('/checkin-reservation/:token');
  const [, setLocation] = useLocation();
  const token = params?.token || '';

  // Fetch reservation by QR token from the new MySQL/Drizzle system
  const { data: reservation, isLoading, error } = trpc.restaurantReservations.getByQrToken.useQuery(
    { qrToken: token },
    { enabled: !!token }
  );

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
      pending_validation: {
        label: 'En attente de validation',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50 border-yellow-200',
        icon: <Clock className="w-16 h-16 text-yellow-500" />,
      },
      validated_pending_payment: {
        label: 'Reservation confirmee - Paiement en attente',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200',
        icon: <CheckCircle2 className="w-16 h-16 text-blue-500" />,
      },
      paid_confirmed: {
        label: 'Reservation confirmee',
        color: 'text-green-700',
        bgColor: 'bg-green-50 border-green-200',
        icon: <CheckCircle2 className="w-16 h-16 text-green-500" />,
      },
      refused: {
        label: 'Reservation refusee',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
        icon: <XCircle className="w-16 h-16 text-red-500" />,
      },
      cancelled: {
        label: 'Reservation annulee',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
        icon: <XCircle className="w-16 h-16 text-red-500" />,
      },
      completed: {
        label: 'Ftour termine',
        color: 'text-green-700',
        bgColor: 'bg-green-50 border-green-200',
        icon: <CheckCircle2 className="w-16 h-16 text-green-500" />,
      },
      no_show: {
        label: 'Absent',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
        icon: <XCircle className="w-16 h-16 text-red-500" />,
      },
    };
    return configs[status] || configs.pending_validation;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#5d5a3c] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[#6b6b4e]">Chargement de la reservation...</p>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-red-700 mb-2">Reservation non trouvee</h1>
              <p className="text-red-600 mb-6">
                Ce QR code n'est pas valide ou la reservation a ete supprimee.
              </p>
              <Button
                onClick={() => setLocation('/fr')}
                className="bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
              >
                <Home className="w-4 h-4 mr-2" />
                Retour a l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(reservation.status);
  const formatDate = (date: any) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <div className="bg-[#5d5a3c] text-[#f5f5dc] p-6 text-center">
        <h1 className="text-2xl font-bold">Ftour Bab Rayan</h1>
        <p className="text-[#d4d4aa] mt-1">Reservation Ftour Solidaire</p>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        {/* Status Card */}
        <Card className={`border-2 ${statusConfig.bgColor}`}>
          <CardContent className="pt-6">
            <div className="text-center">
              {statusConfig.icon}
              <h2 className={`text-xl font-bold mt-4 ${statusConfig.color}`}>
                {statusConfig.label}
              </h2>
            </div>
          </CardContent>
        </Card>

        {/* Reservation Details */}
        <Card className="border-[#d4d4aa]">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center pb-4 border-b border-[#d4d4aa]">
              <p className="text-sm text-[#6b6b4e]">Reference</p>
              <p className="text-2xl font-mono font-bold text-[#5d5a3c]">{reservation.reference}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#5d5a3c]" />
                <div>
                  <p className="text-sm text-[#6b6b4e]">Nom</p>
                  <p className="font-medium text-[#5d5a3c]">{reservation.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#5d5a3c]" />
                <div>
                  <p className="text-sm text-[#6b6b4e]">Date</p>
                  <p className="font-medium text-[#5d5a3c]">{formatDate(reservation.date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#5d5a3c]" />
                <div>
                  <p className="text-sm text-[#6b6b4e]">Nombre de couverts</p>
                  <p className="font-medium text-[#5d5a3c]">{reservation.seatsTotal} personne(s)</p>
                </div>
              </div>

              {reservation.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-[#5d5a3c]" />
                  <div>
                    <p className="text-sm text-[#6b6b4e]">Telephone</p>
                    <p className="font-medium text-[#5d5a3c]">{reservation.phone}</p>
                  </div>
                </div>
              )}

              {reservation.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#5d5a3c]" />
                  <div>
                    <p className="text-sm text-[#6b6b4e]">Email</p>
                    <p className="font-medium text-[#5d5a3c]">{reservation.email}</p>
                  </div>
                </div>
              )}

              {reservation.groupName && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#5d5a3c]" />
                  <div>
                    <p className="text-sm text-[#6b6b4e]">Groupe</p>
                    <p className="font-medium text-[#5d5a3c]">{reservation.groupName}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        {(reservation.status === 'validated_pending_payment' || reservation.status === 'paid_confirmed') && (
          <Card className="border-[#d4d4aa] bg-[#f5f5dc]/50">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-[#5d5a3c] shrink-0 mt-0.5" />
                <div className="text-sm text-[#6b6b4e]">
                  <p className="font-medium text-[#5d5a3c] mb-1">Instructions</p>
                  <ul className="space-y-1">
                    <li>Presentez ce QR code a l'entree du restaurant</li>
                    <li>Arrivez 15 minutes avant l'heure du Ftour</li>
                    <li>Respectez le nombre de places reservees</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back to Home */}
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/fr')}
            className="border-[#5d5a3c] text-[#5d5a3c]"
          >
            <Home className="w-4 h-4 mr-2" />
            Retour a l'accueil
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#5d5a3c] text-[#d4d4aa] p-4 text-center text-sm mt-8">
        <p>Association Bab Rayan</p>
        <p>4 rue Bayt Lham, quartier Palmier, Casablanca</p>
        <p>+212 664-887978</p>
      </div>
    </div>
  );
}
