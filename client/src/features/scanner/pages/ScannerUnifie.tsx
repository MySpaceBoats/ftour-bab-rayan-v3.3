import { useState } from 'react';
import { QrCode, CheckCircle, AlertCircle, ShoppingBag, Package, CakeSlice } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CATEGORIES = [
  {
    key: 'goodies',
    label: 'Goodies',
    icon: ShoppingBag,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    gradient: 'from-orange-50 to-amber-50',
    buttonClass: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    key: 'patisserie',
    label: 'Patisserie',
    icon: CakeSlice,
    color: 'text-pink-700',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    gradient: 'from-pink-50 to-rose-50',
    buttonClass: 'bg-pink-600 hover:bg-pink-700',
  },
  {
    key: 'terroir',
    label: 'Terroir',
    icon: Package,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    gradient: 'from-emerald-50 to-green-50',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
  },
] as const;

export default function ScannerUnifie() {
  const [scans, setScans] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // QR code pour le scanner unifie
  const qrUrl = `${window.location.origin}/scanner/unifie`;
  const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;

  const handleScan = () => {
    setScans(scans + 1);
    setLastScanTime(new Date());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100/20 via-background to-indigo-100/20 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100/30 mb-4">
            <QrCode className="h-5 w-5 text-violet-700" />
            <span className="text-sm font-medium">Scanner Unifie</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Scanner Unifie</h1>
          <p className="text-lg text-muted-foreground">
            Goodies &middot; Patisserie &middot; Terroir
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: QR Code Display */}
          <Card className="border-2 border-violet-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code - Scanner Unifie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-white p-6 rounded-lg flex justify-center">
                <img
                  src={qrCodeImage}
                  alt="Scanner Unifie QR Code"
                  className="w-64 h-64"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Scannez ce code QR pour acceder au scanner unifie
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  URL: {qrUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right: Statistics */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200">
              <CardHeader>
                <CardTitle className="text-2xl">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-muted-foreground">Total des scans</p>
                  <p className="text-5xl font-bold text-violet-700">{scans}</p>
                </div>

                {lastScanTime && (
                  <div className="space-y-2 pt-4 border-t border-violet-200">
                    <p className="text-muted-foreground">Dernier scan</p>
                    <p className="text-lg font-medium">
                      {lastScanTime.toLocaleTimeString('fr-FR')}
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleScan}
                  className="w-full mt-6 bg-violet-600 hover:bg-violet-700"
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
                    <p className="font-medium text-blue-900">Scanner multi-categories</p>
                    <p className="text-sm text-blue-800 mt-1">
                      Ce scanner unifie permet de valider les QR codes de toutes les categories : Goodies, Patisserie et Terroir en un seul point d'entree.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Categories prises en charge</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Card key={cat.key} className={`${cat.border} border-2`}>
                  <CardContent className="pt-6 text-center space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full ${cat.bg} flex items-center justify-center`}>
                      <Icon className={`h-8 w-8 ${cat.color}`} />
                    </div>
                    <h3 className={`text-lg font-semibold ${cat.color}`}>{cat.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Validation des commandes {cat.label.toLowerCase()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
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
                <span className="font-medium">Afficher le QR code</span> : Affichez ce QR code sur un ecran ou imprimez-le
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Scanner accede</span> : Scannez le QR code avec un appareil mobile
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Detection automatique</span> : Le scanner detecte automatiquement le type de QR code (goodies, patisserie ou terroir)
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Validation</span> : Validez les commandes en un scan, quel que soit le type de produit
              </li>
              <li className="text-muted-foreground">
                <span className="font-medium">Suivi en temps reel</span> : Consultez les statistiques de scans en temps reel
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
