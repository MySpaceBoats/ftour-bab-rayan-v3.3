import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, Check, AlertCircle, UtensilsCrossed, Package, Users } from 'lucide-react';

// ============================================
// SCANNER CONSOLIDÉ — 3 ONGLETS
// ============================================

export default function AdminScannerConsolidated() {
  const [activeTab, setActiveTab] = useState<'restaurant' | 'produits' | 'benevoles'>('restaurant');
  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState('');

  const handleQrScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    setScanResult(null);

    if (!qrInput.trim()) {
      setScanError('Veuillez scanner ou entrer un code QR');
      return;
    }

    try {
      // Parse QR token to determine type
      const token = qrInput.trim();
      
      // Detect type from token prefix
      let scanType = 'unknown';
      if (token.startsWith('vol-')) scanType = 'volunteer';
      else if (token.startsWith('res-') || token.startsWith('rp-') || token.startsWith('re-') || token.startsWith('rg-')) scanType = 'reservation';
      else if (token.startsWith('prod-')) scanType = 'product';

      // Simulate scan result (in production, call API)
      setScanResult({
        type: scanType,
        token: token,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        status: 'success',
      });

      setQrInput('');
    } catch (error) {
      setScanError('Erreur lors du scan. Veuillez réessayer.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <QrCode className="w-8 h-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-foreground">Scanner Unifié</h1>
          </div>
          <p className="text-muted-foreground">Valider réservations, produits, et bénévoles en un seul endroit</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Scanner Input */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Lire un code QR</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleQrScan} className="space-y-4">
              <div>
                <Label htmlFor="qr-input">Code QR ou Token</Label>
                <Input
                  id="qr-input"
                  type="text"
                  placeholder="Scannez un code QR ou entrez un token..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  autoFocus
                  className="mt-2"
                />
              </div>
              <Button type="submit" className="w-full">
                <QrCode className="w-4 h-4 mr-2" />
                Valider le scan
              </Button>
            </form>

            {/* Scan Result */}
            {scanResult && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-900">Scan réussi</p>
                </div>
                <p className="text-sm text-green-800">
                  Type: <strong>{scanResult.type}</strong> | {scanResult.timestamp}
                </p>
              </div>
            )}

            {/* Scan Error */}
            {scanError && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="font-semibold text-red-900">Erreur</p>
                </div>
                <p className="text-sm text-red-800">{scanError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="restaurant" className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              <span className="hidden sm:inline">Restaurant</span>
            </TabsTrigger>
            <TabsTrigger value="produits" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Produits</span>
            </TabsTrigger>
            <TabsTrigger value="benevoles" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Bénévoles</span>
            </TabsTrigger>
          </TabsList>

          {/* Restaurant Tab */}
          <TabsContent value="restaurant">
            <Card>
              <CardHeader>
                <CardTitle>Validation Réservations Restaurant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Scannez le QR code d'une réservation restaurant pour la valider.
                </p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Types de réservations : Particuliers (RES-P-), Entreprises (RES-E-), Groupes (RES-G-)
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Historique des scans</h3>
                  <p className="text-sm text-muted-foreground">Aucun scan enregistré</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="produits">
            <Card>
              <CardHeader>
                <CardTitle>Validation Produits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Scannez le QR code d'une commande de produits (Goodies, Terroir, Pâtisserie) pour la valider.
                </p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Produits : Goodies, Terroir, Pâtisserie
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Historique des scans</h3>
                  <p className="text-sm text-muted-foreground">Aucun scan enregistré</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Volunteers Tab */}
          <TabsContent value="benevoles">
            <Card>
              <CardHeader>
                <CardTitle>Validation Bénévoles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Scannez le QR code d'un bénévole pour enregistrer sa présence.
                </p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Tokens bénévoles : vol-XXXXXXXX
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Historique des scans</h3>
                  <p className="text-sm text-muted-foreground">Aucun scan enregistré</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
