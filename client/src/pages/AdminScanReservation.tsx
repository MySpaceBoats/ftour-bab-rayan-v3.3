import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, Camera, CheckCircle2, XCircle, AlertCircle, ArrowLeft, Search, Users, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { Html5QrcodeScanner } from 'html5-qrcode';

type ScanResult = {
  success: boolean;
  message: string;
  reservation?: any;
};

export default function AdminScanReservation() {
  const [, setLocation] = useLocation();
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(true);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Check-in mutation
  const checkinMutation = trpc.reservations.checkin.useMutation({
    onSuccess: (data) => {
      setLastResult({
        success: true,
        message: 'Check-in réussi !',
        reservation: data.reservation,
      });
      toast.success('Check-in réussi !');
    },
    onError: (error) => {
      setLastResult({
        success: false,
        message: error.message || 'Erreur lors du check-in',
      });
      toast.error(error.message || 'Erreur lors du check-in');
    },
  });

  // Initialize QR scanner
  useEffect(() => {
    if (scanning && scannerContainerRef.current) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          // Extract token from URL or use as-is
          let token = decodedText;
          if (decodedText.includes('/checkin-reservation/')) {
            token = decodedText.split('/checkin-reservation/').pop() || decodedText;
          }
          
          // Stop scanner and process
          scanner.clear();
          setScanning(false);
          checkinMutation.mutate({ qrToken: token });
        },
        (error) => {
          // Ignore scan errors (no QR found)
        }
      );

      scannerRef.current = scanner;

      return () => {
        scanner.clear().catch(() => {});
      };
    }
  }, [scanning]);

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error('Veuillez entrer un code de réservation');
      return;
    }
    setScanning(false);
    checkinMutation.mutate({ referenceCode: manualCode.trim().toUpperCase() });
  };

  const resetScanner = () => {
    setLastResult(null);
    setManualCode('');
    setScanning(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'En attente', variant: 'secondary' },
      confirmed: { label: 'Confirmée', variant: 'default' },
      cancelled: { label: 'Annulée', variant: 'destructive' },
      no_show: { label: 'Absent', variant: 'destructive' },
      checked_in: { label: 'Présent', variant: 'default' },
    };
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <div className="bg-[#5d5a3c] text-[#f5f5dc] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/admin/reservations')}
            className="text-[#f5f5dc] hover:bg-[#4a4730]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Scanner Réservation</h1>
            <p className="text-sm text-[#d4d4aa]">Validez les réservations Ftour</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Result Card */}
        {lastResult && (
          <Card className={`border-2 ${lastResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                {lastResult.success ? (
                  <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                ) : (
                  <XCircle className="w-16 h-16 text-red-500 mb-4" />
                )}
                <h2 className={`text-xl font-bold mb-2 ${lastResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {lastResult.message}
                </h2>
                
                {lastResult.reservation && (
                  <div className="w-full mt-4 space-y-3 text-left bg-white rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#5d5a3c]" />
                      <span className="font-medium">{lastResult.reservation.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#5d5a3c]" />
                      <span>{lastResult.reservation.date}</span>
                    </div>
                    {lastResult.reservation.restaurant && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#5d5a3c]" />
                        <span>{lastResult.reservation.restaurant.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[#6b6b4e]">Places:</span>
                      <span className="font-medium">{lastResult.reservation.seats}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#6b6b4e]">Référence:</span>
                      <span className="font-mono font-medium">{lastResult.reservation.referenceCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#6b6b4e]">Statut:</span>
                      {getStatusBadge(lastResult.reservation.status)}
                    </div>
                  </div>
                )}

                <Button
                  onClick={resetScanner}
                  className="mt-6 bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Scanner une autre réservation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scanner */}
        {!lastResult && (
          <>
            <Card className="border-[#d4d4aa]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#5d5a3c] flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Scanner le QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scanning ? (
                  <div 
                    id="qr-reader" 
                    ref={scannerContainerRef}
                    className="rounded-lg overflow-hidden"
                  />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-[#5d5a3c] border-t-transparent rounded-full"></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card className="border-[#d4d4aa]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#5d5a3c] flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Saisie manuelle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="Code de réservation (ex: RES-XXXXXX)"
                    className="border-[#d4d4aa] font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  />
                  <Button
                    onClick={handleManualSubmit}
                    disabled={checkinMutation.isPending}
                    className="bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
                  >
                    {checkinMutation.isPending ? (
                      <div className="animate-spin w-4 h-4 border-2 border-[#f5f5dc] border-t-transparent rounded-full" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="border-[#d4d4aa] bg-[#f5f5dc]/50">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[#5d5a3c] shrink-0 mt-0.5" />
                  <div className="text-sm text-[#6b6b4e]">
                    <p className="font-medium text-[#5d5a3c] mb-1">Instructions</p>
                    <ul className="space-y-1">
                      <li>• Scannez le QR code sur le téléphone du participant</li>
                      <li>• Ou entrez manuellement le code de réservation</li>
                      <li>• Le check-in n'est possible que le jour de la réservation</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
