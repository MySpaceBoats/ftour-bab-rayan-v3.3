import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  QrCode, CheckCircle, XCircle, AlertTriangle, Camera, Keyboard,
  User, Calendar, MapPin, Loader2, ShoppingBag, Users,
  Utensils, Package, RefreshCw, Phone, Mail, Hash, Clock, Heart,
} from "lucide-react";
import jsQR from "jsqr";

type QrType = 'volunteer' | 'reservation_particulier' | 'reservation_entreprise' | 'reservation_groupe' | 'pastry' | 'terroir' | 'goodies' | 'donation' | 'product_goodie' | 'product_pastry' | 'unknown';

const TYPE_CONFIG: Record<QrType, { label: string; icon: typeof Users; color: string; bg: string }> = {
  volunteer: { label: 'Benevole', icon: Users, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  reservation_particulier: { label: 'Reservation Particulier', icon: Utensils, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  reservation_entreprise: { label: 'Reservation Entreprise', icon: Utensils, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  reservation_groupe: { label: 'Reservation Groupe', icon: Utensils, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  pastry: { label: 'Patisserie', icon: ShoppingBag, color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
  terroir: { label: 'Terroir', icon: Package, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  goodies: { label: 'Goodies', icon: ShoppingBag, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  donation: { label: 'Don', icon: Heart, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  product_goodie: { label: 'Produit Goodies', icon: ShoppingBag, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  product_pastry: { label: 'Produit Patisserie', icon: ShoppingBag, color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
  unknown: { label: 'Inconnu', icon: QrCode, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

interface UniversalScannerCoreProps {
  onBack?: () => void;
}

export default function UniversalScannerCore({ onBack }: UniversalScannerCoreProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Identified entity state
  const [identifiedResult, setIdentifiedResult] = useState<any>(null);
  const [validationDone, setValidationDone] = useState<{ success: boolean; message: string; state?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ============ MUTATIONS ============
  const identifyMutation = trpc.scanner.identify.useMutation({
    onSuccess: (data: any) => {
      setIdentifiedResult(data);
      if (!data.found) {
        toast.error(data.error || 'QR code non reconnu');
      } else if (data.autoValidated) {
        if (data.validationSuccess) {
          setValidationDone({
            success: true,
            message: data.validationMessage,
            state: data.validationState,
          });
          if (data.validationState === 'already_confirmed') {
            toast.warning(data.validationMessage);
          } else {
            toast.success(data.validationMessage);
          }
        } else {
          setValidationDone({
            success: false,
            message: data.validationMessage,
          });
          toast.error(data.validationMessage);
        }
      } else {
        toast.success(`${data.typeLabel} detecte`);
      }
      stopCamera();
    },
    onError: (err) => {
      toast.error(err.message);
      stopCamera();
    },
  });

  const validateMutation = trpc.scanner.validate.useMutation({
    onSuccess: async (data: any) => {
      setValidationDone({ success: true, message: data.message, state: data.state });
      toast.success(data.message);
    },
    onError: (err) => {
      setValidationDone({ success: false, message: err.message });
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (mode === 'camera' && !identifiedResult) {
      startCamera();
    }
    return () => { stopCamera(); };
  }, [mode, identifiedResult]);

  // ============ QR SCANNING ============
  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning || identifiedResult) return;
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
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    if (code && code.data && code.data !== lastScannedCode) {
      setLastScannedCode(code.data);
      setIsScanning(false);
      if (navigator.vibrate) navigator.vibrate(200);
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.frequency.value = 800; osc.type = 'sine'; gain.gain.value = 0.3;
        osc.start(); osc.stop(audioContext.currentTime + 0.1);
      } catch {}
      toast.info("QR code detecte, identification...");
      identifyMutation.mutate({ rawCode: code.data });
      return;
    }
    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [isScanning, identifiedResult, lastScannedCode, identifyMutation]);

  useEffect(() => {
    if (isScanning && mode === 'camera' && !identifiedResult) {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isScanning, mode, identifiedResult, scanQRCode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsScanning(true);
      }
    } catch {
      toast.error("Impossible d'acceder a la camera");
      setMode('manual');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) { toast.error("Veuillez entrer un code QR"); return; }
    identifyMutation.mutate({ rawCode: manualCode.trim() });
  };

  const handleValidate = () => {
    if (!identifiedResult?.found || !identifiedResult.entity) return;
    validateMutation.mutate({
      token: identifiedResult.token,
      type: identifiedResult.type,
      entityId: identifiedResult.entity.id,
    });
  };

  const handleNewScan = () => {
    setIdentifiedResult(null);
    setValidationDone(null);
    setManualCode("");
    setLastScannedCode(null);
    if (mode === 'camera') startCamera();
  };

  const typeConfig = identifiedResult ? TYPE_CONFIG[identifiedResult.type as QrType] || TYPE_CONFIG.unknown : null;

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      {!identifiedResult && (
        <div className="flex gap-2 mb-6">
          <Button variant={mode === 'camera' ? 'default' : 'outline'} onClick={() => setMode('camera')} className="flex-1">
            <Camera className="h-4 w-4 mr-2" />Camera
          </Button>
          <Button variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => { setMode('manual'); stopCamera(); }} className="flex-1">
            <Keyboard className="h-4 w-4 mr-2" />Manuel
          </Button>
        </div>
      )}

      {/* ============ IDENTIFIED RESULT ============ */}
      {identifiedResult && (
        <div className="space-y-4">
          {/* Type Badge */}
          {typeConfig && (
            <div className={`rounded-lg border p-4 ${typeConfig.bg}`}>
              <div className="flex items-center gap-3">
                <typeConfig.icon className={`h-6 w-6 ${typeConfig.color}`} />
                <div>
                  <Badge variant="outline" className={typeConfig.color}>{identifiedResult.typeLabel}</Badge>
                  {identifiedResult.found && identifiedResult.entity?.reference && (
                    <p className="text-xs mt-1 opacity-70">Ref: {identifiedResult.entity.reference}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Not Found */}
          {!identifiedResult.found && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 text-center space-y-3">
                <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h2 className="font-bold text-red-800">QR code non trouve</h2>
                <p className="text-sm text-red-600">{identifiedResult.error}</p>
                <Button onClick={handleNewScan} className="w-full"><RefreshCw className="h-4 w-4 mr-2" />Nouveau scan</Button>
              </CardContent>
            </Card>
          )}

          {/* Found: Entity Details */}
          {identifiedResult.found && identifiedResult.entity && (
            <Card>
              <CardContent className="p-5 space-y-4">
                {/* Person info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold text-lg">{identifiedResult.entity.name}</span>
                  </div>
                  {identifiedResult.entity.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />{identifiedResult.entity.email}
                    </div>
                  )}
                  {identifiedResult.entity.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />{identifiedResult.entity.phone}
                    </div>
                  )}
                </div>

                {/* Type-specific details */}
                <div className="border-t pt-3 space-y-2">
                  {/* Volunteer */}
                  {identifiedResult.type === 'volunteer' && (
                    <>
                      {identifiedResult.entity.dayNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Jour {identifiedResult.entity.dayNumber} — {identifiedResult.entity.dayDate}</span>
                        </div>
                      )}
                      {identifiedResult.entity.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />{identifiedResult.entity.location}
                        </div>
                      )}
                      {identifiedResult.entity.iftarTime && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />Iftar: {identifiedResult.entity.iftarTime}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 text-muted-foreground" />Statut: <Badge variant="outline">{identifiedResult.entity.status}</Badge>
                      </div>
                    </>
                  )}

                  {/* Reservation */}
                  {identifiedResult.type.startsWith('reservation_') && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />{identifiedResult.entity.date}
                      </div>
                      {identifiedResult.entity.guests && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />{identifiedResult.entity.guests} convives
                        </div>
                      )}
                      {identifiedResult.entity.restaurantName && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />{identifiedResult.entity.restaurantName}
                        </div>
                      )}
                      {identifiedResult.entity.slotTime && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />{identifiedResult.entity.slotTime}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 text-muted-foreground" />Statut: <Badge variant="outline">{identifiedResult.entity.status}</Badge>
                      </div>
                    </>
                  )}

                  {/* Donation */}
                  {identifiedResult.type === 'donation' && (
                    <>
                      {identifiedResult.entity.amount != null && (
                        <div className="flex items-center gap-2 text-sm">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          Montant: <span className="font-semibold">{identifiedResult.entity.amount} MAD</span>
                        </div>
                      )}
                      {identifiedResult.entity.paymentMethod && (
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          Paiement: <Badge variant="outline">{identifiedResult.entity.paymentMethod === 'transfer' ? 'Virement' : 'Sur place'}</Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 text-muted-foreground" />Statut: <Badge variant="outline">{identifiedResult.entity.status}</Badge>
                      </div>
                    </>
                  )}

                  {/* Pastry / Terroir / Goodies / Product catalog */}
                  {(identifiedResult.type === 'pastry' || identifiedResult.type === 'terroir' || identifiedResult.type === 'goodies' || identifiedResult.type === 'product_goodie' || identifiedResult.type === 'product_pastry') && (
                    <>
                      {identifiedResult.entity.totalAmount != null && (
                        <div className="flex items-center gap-2 text-sm">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                          Montant: <span className="font-semibold">{identifiedResult.entity.totalAmount} MAD</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 text-muted-foreground" />Statut: <Badge variant="outline">{identifiedResult.entity.status}</Badge>
                      </div>
                      {identifiedResult.entity.items?.map((item: any, i: number) => (
                        <div key={i} className="text-sm pl-6">- {item.name} x {item.quantity}</div>
                      ))}
                      {identifiedResult.entity.usesCount != null && (
                        <div className="text-sm text-muted-foreground">
                          Utilisations: {identifiedResult.entity.usesCount}/{identifiedResult.entity.maxUses}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Already validated warning */}
                {identifiedResult.entity.alreadyValidated && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">
                        {identifiedResult.type === 'volunteer' ? 'Deja confirme' : 'Deja valide'}
                      </p>
                      <p className="text-sm text-amber-600">
                        {identifiedResult.entity.scannedAt
                          ? `${identifiedResult.type === 'volunteer' ? 'Confirme' : 'Valide'} le ${new Date(identifiedResult.entity.scannedAt).toLocaleString('fr-FR')}`
                          : 'Ce QR code a deja ete utilise.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Validation result */}
                {validationDone && (
                  <div className={`rounded-lg p-4 flex items-center gap-3 ${
                    validationDone.success
                      ? validationDone.state === 'already_confirmed'
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {validationDone.success ? (
                      validationDone.state === 'already_confirmed'
                        ? <AlertTriangle className="h-6 w-6 text-amber-600" />
                        : <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <span className={
                      validationDone.success
                        ? validationDone.state === 'already_confirmed'
                          ? 'text-amber-800 font-medium'
                          : 'text-green-800 font-medium'
                        : 'text-red-800 font-medium'
                    }>
                      {validationDone.message}
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {!validationDone && !identifiedResult.entity.alreadyValidated && !identifiedResult.autoValidated && (
                    <Button onClick={handleValidate} disabled={validateMutation.isPending} className="flex-1" size="lg">
                      {validateMutation.isPending ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Validation...</>
                      ) : (
                        <><CheckCircle className="h-5 w-5 mr-2" />Valider</>
                      )}
                    </Button>
                  )}
                  <Button onClick={handleNewScan} variant="outline" className={validationDone || identifiedResult.entity.alreadyValidated || identifiedResult.autoValidated ? 'flex-1' : ''} size="lg">
                    <RefreshCw className="h-4 w-4 mr-2" />Nouveau scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============ CAMERA MODE ============ */}
      {mode === 'camera' && !identifiedResult && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-square bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  {isScanning && (
                    <div className="absolute inset-0 overflow-hidden rounded-xl">
                      <div className="absolute w-full h-1 bg-primary/70 animate-scan-line" />
                    </div>
                  )}
                </div>
              </div>
              {isScanning && (
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm flex items-center justify-center gap-2 mx-auto w-fit">
                    <Loader2 className="h-4 w-4 animate-spin" />Recherche du QR code...
                  </span>
                </div>
              )}
              {identifyMutation.isPending && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" /><span>Identification...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />Detection automatique multi-types
              </p>
              <p className="mt-1">Placez le QR code dans le cadre</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ MANUAL MODE ============ */}
      {mode === 'manual' && !identifiedResult && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Keyboard className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-semibold">Saisie manuelle</h2>
              <p className="text-sm text-muted-foreground">Entrez le code QR, l'URL de validation, ou la reference</p>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Code QR, URL ou reference"
                className="text-center font-mono"
                autoFocus
              />
              <Button type="submit" className="w-full" size="lg" disabled={identifyMutation.isPending}>
                {identifyMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Identification...</>
                ) : (
                  <><QrCode className="h-5 w-5 mr-2" />Identifier et valider</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!identifiedResult && (
        <Card className="bg-muted/50">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />Instructions
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Ce scanner detecte automatiquement le type de QR code</li>
              <li>- Types supportes : benevoles, reservations, goodies, patisserie, terroir, dons</li>
              <li>- Un QR code ne peut etre valide qu'une seule fois</li>
              <li>- En cas de probleme, contactez un administrateur</li>
            </ul>
          </CardContent>
        </Card>
      )}

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
