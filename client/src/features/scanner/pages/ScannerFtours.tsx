import { useState } from 'react';
import { QrCode, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ScannerFtours() {
  const [scans, setScans] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Générer QR code pour cette page
  const qrUrl = `${window.location.origin}/scanner/ftours`;
  const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;

  const handleScan = () => {
    setScans(scans + 1);
    setLastScanTime(new Date());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
            <QrCode className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Scanner Ftours</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Scanner QR Codes</h1>
          <p className="text-lg text-muted-foreground">Restaurant Solidaire - Accès Sans Authentification</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: QR Code Display */}
          <Card className="border-2 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code Scanner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-white p-6 rounded-lg flex justify-center">
                <img 
                  src={qrCodeImage}
                  alt="Scanner QR Code"
                  className="w-64 h-64"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Scannez ce code QR pour accéder au scanner
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  URL: {qrUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right: Statistics */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-muted-foreground">Total des scans</p>
                  <p className="text-5xl font-bold text-primary">{scans}</p>
                </div>

                {lastScanTime && (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-muted-foreground">Dernier scan</p>
                    <p className="text-lg font-medium">
                      {lastScanTime.toLocaleTimeString('fr-FR')}
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleScan}
                  className="w-full mt-6"
                  size="lg"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Simuler un scan
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Accès sans authentification</p>
                    <p className="text-sm text-blue-800 mt-1">
                      Cette page est accessible publiquement. Partagez le QR code ci-dessus pour permettre aux scanners de valider les codes des participants au Restaurant Solidaire.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Instructions d'utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-muted-foreground">
                <span className="font-medium">Afficher le QR code</span> : Affichez ce QR code sur un écran ou imprimez-le
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Scanner accède</span> : Scannez le QR code avec un appareil mobile
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Validation</span> : Scannez les codes QR des participants pour valider leur accès au repas
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Suivi en temps réel</span> : Consultez les statistiques de scans en temps réel
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
