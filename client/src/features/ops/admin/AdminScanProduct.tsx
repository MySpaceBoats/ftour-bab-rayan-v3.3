import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  QrCode, ShoppingCart, Check, Camera, Keyboard, Loader2,
  ArrowLeft, RefreshCw, Minus, Plus, Package, AlertTriangle,
} from 'lucide-react';
import { Link } from 'wouter';
import jsQR from 'jsqr';

type ScanStep = 'scan' | 'product' | 'success';

function extractProductId(rawCode: string): number | null {
  // Try direct number
  const directNum = parseInt(rawCode, 10);
  if (!isNaN(directNum) && directNum > 0 && String(directNum) === rawCode.trim()) {
    return directNum;
  }

  // Try URL pattern: /buy/goodie/:id or /goodies/:id or goodie-:id
  const urlMatch = rawCode.match(/\/(?:buy\/)?goodi(?:e|es)\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  // Try goodie-{id} pattern
  const prefixMatch = rawCode.match(/^goodie[- _](\d+)$/i);
  if (prefixMatch) return parseInt(prefixMatch[1], 10);

  // Try JSON format { id: N } or { goodieId: N }
  try {
    const parsed = JSON.parse(rawCode);
    if (parsed.id) return parseInt(parsed.id, 10);
    if (parsed.goodieId) return parseInt(parsed.goodieId, 10);
  } catch {}

  // Try URL query param: ?id=N or ?productId=N
  const paramMatch = rawCode.match(/[?&](?:id|productId|goodieId)=(\d+)/i);
  if (paramMatch) return parseInt(paramMatch[1], 10);

  return null;
}

export default function AdminScanProduct() {
  const [step, setStep] = useState<ScanStep>('scan');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { data: productList, isLoading: productLoading } = trpc.goodies.list.useQuery();
  const product = productList?.find((p: any) => p.id === productId) ?? null;

  const createOrderMutation = trpc.orders.create.useMutation();

  // ============ CAMERA QR SCANNING ============

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsScanning(true);
      }
    } catch {
      toast.error("Impossible d'accéder à la caméra");
      setMode('manual');
    }
  }, []);

  const processScannedCode = useCallback((rawCode: string) => {
    const id = extractProductId(rawCode);
    if (id) {
      setProductId(id);
      setStep('product');
      toast.success('Produit détecté !');
    } else {
      toast.error('QR code non reconnu comme un produit');
      setLastScannedCode(null);
    }
  }, []);

  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

    if (code && code.data && code.data !== lastScannedCode) {
      setLastScannedCode(code.data);
      setIsScanning(false);
      // Audio + vibration feedback
      if (navigator.vibrate) navigator.vibrate(200);
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(audioContext.currentTime + 0.15);
      } catch {}
      stopCamera();
      processScannedCode(code.data);
      return;
    }
    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [isScanning, lastScannedCode, stopCamera, processScannedCode]);

  useEffect(() => {
    if (step === 'scan' && mode === 'camera') {
      startCamera();
    }
    return () => { stopCamera(); };
  }, [step, mode, startCamera, stopCamera]);

  useEffect(() => {
    if (isScanning && mode === 'camera' && step === 'scan') {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isScanning, mode, step, scanQRCode]);

  // ============ HANDLERS ============

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error('Veuillez entrer un code QR ou un ID produit');
      return;
    }
    processScannedCode(manualCode.trim());
  };

  const handleCreateOrder = async () => {
    if (!product || !customerName.trim() || !customerPhone.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrderMutation.mutateAsync({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || 'surplace@ftourbabrayan.ma',
        customerPhone: customerPhone.trim(),
        items: [
          {
            goodieId: product.id,
            quantity,
            unitPrice: product.price,
          },
        ],
        paymentMethod: paymentMethod as 'cash' | 'bank_transfer' | 'cheque',
        deliveryMode: 'pickup',
      });

      setStep('success');
      toast.success('Commande ajoutée avec succès !');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewScan = () => {
    setStep('scan');
    setProductId(null);
    setQuantity(1);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setManualCode('');
    setLastScannedCode(null);
  };

  // ============ RENDER ============

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/admin/commandes">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan Produit
            </h1>
            <p className="text-xs opacity-80">Scanner un QR code produit pour vente sur place</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">

        {/* ============ STEP 1: SCAN ============ */}
        {step === 'scan' && (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === 'camera' ? 'default' : 'outline'}
                onClick={() => setMode('camera')}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Caméra
              </Button>
              <Button
                variant={mode === 'manual' ? 'default' : 'outline'}
                onClick={() => { setMode('manual'); stopCamera(); }}
                className="flex-1"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Manuel
              </Button>
            </div>

            {/* Camera mode */}
            {mode === 'camera' && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative aspect-square bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />
                        {isScanning && (
                          <div className="absolute inset-0 overflow-hidden rounded-xl">
                            <div className="absolute w-full h-1 bg-purple-400/70 animate-scan-line" />
                          </div>
                        )}
                      </div>
                    </div>
                    {isScanning && (
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm flex items-center justify-center gap-2 mx-auto w-fit">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Recherche du QR code produit...
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <p>Placez le QR code du produit dans le cadre</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual mode */}
            {mode === 'manual' && (
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center">
                      <Keyboard className="h-8 w-8 text-purple-600" />
                    </div>
                    <h2 className="font-semibold">Saisie manuelle</h2>
                    <p className="text-sm text-muted-foreground">
                      Entrez l'ID du produit ou le contenu du QR code
                    </p>
                  </div>
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="ID produit, URL, ou code QR"
                      className="text-center font-mono"
                      autoFocus
                    />
                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                      <QrCode className="h-5 w-5 mr-2" />
                      Rechercher le produit
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Formats de QR code supportés
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- ID numérique du produit (ex: 5)</li>
                  <li>- URL du produit (ex: .../buy/goodie/5)</li>
                  <li>- Format goodie-ID (ex: goodie-5)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ STEP 2: PRODUCT + QUANTITY ============ */}
        {step === 'product' && (
          <div className="space-y-4">
            {/* Product info */}
            {productLoading ? (
              <Card>
                <CardContent className="p-8 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </CardContent>
              </Card>
            ) : product ? (
              <>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {product.imageUrl && (
                      <div className="aspect-video bg-muted">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-2 text-purple-700 bg-purple-50 border-purple-200">
                            <Package className="h-3 w-3 mr-1" />
                            {product.category || 'Goodie'}
                          </Badge>
                          <h2 className="text-xl font-bold">{product.name}</h2>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-purple-600">
                        {product.price} DH
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quantity selector */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <Label className="text-base font-semibold">Quantité</Label>
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <span className="text-4xl font-bold w-20 text-center">{quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="text-center">
                      <span className="text-lg text-muted-foreground">Total : </span>
                      <span className="text-2xl font-bold text-purple-600">{(product.price * quantity).toFixed(2)} DH</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer info */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-semibold text-base">Informations client</h3>
                    <div>
                      <Label>Nom du client *</Label>
                      <Input
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Nom complet"
                      />
                    </div>
                    <div>
                      <Label>Email (optionnel)</Label>
                      <Input
                        type="email"
                        value={customerEmail}
                        onChange={e => setCustomerEmail(e.target.value)}
                        placeholder="email@exemple.com"
                      />
                    </div>
                    <div>
                      <Label>Téléphone *</Label>
                      <Input
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        placeholder="06 XX XX XX XX"
                      />
                    </div>
                    <div>
                      <Label>Méthode de paiement</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Espèces</SelectItem>
                          <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                          <SelectItem value="cheque">Chèque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleNewScan}
                    className="flex-1"
                    size="lg"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Nouveau scan
                  </Button>
                  <Button
                    onClick={handleCreateOrder}
                    disabled={isSubmitting || !customerName.trim() || !customerPhone.trim()}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</>
                    ) : (
                      <><ShoppingCart className="h-4 w-4 mr-2" />Ajouter la commande</>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Product not found */
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <Package className="h-8 w-8 text-red-500" />
                  </div>
                  <h2 className="font-bold text-red-800">Produit non trouvé</h2>
                  <p className="text-sm text-red-600">
                    Aucun produit avec l'ID #{productId} n'a été trouvé dans le catalogue.
                  </p>
                  <Button onClick={handleNewScan} className="w-full" variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réessayer
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ============ STEP 3: SUCCESS ============ */}
        {step === 'success' && (
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-green-800">Commande créée !</h2>
                <p className="text-green-700">
                  La commande a été ajoutée au tableau de bord des commandes goodies.
                </p>
                {product && (
                  <div className="bg-white rounded-lg p-4 text-left space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produit</span>
                      <span className="font-semibold">{product.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantité</span>
                      <span className="font-semibold">{quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client</span>
                      <span className="font-semibold">{customerName}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-bold text-purple-600">{(product.price * quantity).toFixed(2)} DH</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={handleNewScan}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scanner un autre produit
              </Button>
              <Link href="/admin/commandes" className="flex-1">
                <Button variant="outline" className="w-full" size="lg">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Voir les commandes
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(0); }
          50% { transform: translateY(250px); }
          100% { transform: translateY(0); }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
