import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Camera, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  QrCode,
  RefreshCw
} from "lucide-react";

type ScanResult = {
  status: 'success' | 'already_validated' | 'wrong_date' | 'invalid' | 'error';
  message: string;
  volunteer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
  };
  day?: {
    dayNumber: number;
    date: string;
    iftarTime: string;
    location: string;
  };
};

export default function AdminScan() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [manualToken, setManualToken] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const validateMutation = trpc.checkin.validate.useMutation({
    onSuccess: (data) => {
      const isSuccess = data.success;
      const isAlreadyValidated = data.code === 'ALREADY_VALIDATED';
      const isWrongDate = data.code === 'WRONG_DAY';
      
      setScanResult({
        status: isSuccess ? 'success' : (isAlreadyValidated ? 'already_validated' : (isWrongDate ? 'wrong_date' : 'invalid')),
        message: data.error || 'Validé avec succès',
        volunteer: data.volunteer ? {
          firstName: data.volunteer.firstName,
          lastName: data.volunteer.lastName,
          email: data.volunteer.email,
          phone: data.volunteer.phone,
          city: data.volunteer.city || ''
        } : undefined,
        day: data.volunteer?.day ? {
          dayNumber: data.volunteer.day.dayNumber,
          date: data.volunteer.day.date,
          iftarTime: data.volunteer.day.iftarTime || '',
          location: data.volunteer.day.location || ''
        } : undefined
      });
      if (isSuccess) {
        toast.success("Bénévole validé avec succès !");
      }
    },
    onError: (error) => {
      setScanResult({
        status: 'error',
        message: error.message
      });
      toast.error(error.message);
    }
  });

  // Start camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Extract token from URL
  const extractTokenFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const checkinIndex = pathParts.indexOf('checkin');
      if (checkinIndex !== -1 && pathParts[checkinIndex + 1]) {
        return pathParts[checkinIndex + 1];
      }
    } catch {
      // Not a valid URL, might be just a token
      if (url.length === 32 && /^[a-f0-9]+$/.test(url)) {
        return url;
      }
    }
    return null;
  };

  // Handle manual token submission
  const handleManualSubmit = () => {
    const token = extractTokenFromUrl(manualToken.trim());
    if (token) {
      validateMutation.mutate({ token });
      setManualToken("");
    } else {
      toast.error("Token invalide. Entrez un token ou une URL de check-in valide.");
    }
  };

  // Reset scan result
  const resetScan = () => {
    setScanResult(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Check permissions
  const isScanner = user?.role && ['admin', 'super_admin', 'admin_ops', 'scanner'].includes(user.role);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !isScanner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
            <p className="text-muted-foreground mb-4">
              Vous n'avez pas les permissions nécessaires pour accéder au scanner.
            </p>
            <Link href="/">
              <Button>Retour à l'accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Scanner QR</h1>
            <p className="text-xs text-muted-foreground">Validation des bénévoles</p>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-6">
        {/* Scan Result */}
        {scanResult && (
          <Card className={`border-2 ${
            scanResult.status === 'success' ? 'border-green-500 bg-green-50' :
            scanResult.status === 'already_validated' ? 'border-yellow-500 bg-yellow-50' :
            'border-red-500 bg-red-50'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {scanResult.status === 'success' ? (
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  ) : scanResult.status === 'already_validated' ? (
                    <AlertTriangle className="h-10 w-10 text-yellow-600" />
                  ) : (
                    <XCircle className="h-10 w-10 text-red-600" />
                  )}
                  <div>
                    <h3 className={`text-lg font-bold ${
                      scanResult.status === 'success' ? 'text-green-700' :
                      scanResult.status === 'already_validated' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {scanResult.status === 'success' ? 'Validé !' :
                       scanResult.status === 'already_validated' ? 'Déjà validé' :
                       scanResult.status === 'wrong_date' ? 'Mauvaise date' :
                       'Invalide'}
                    </h3>
                    <p className="text-sm text-muted-foreground">{scanResult.message}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetScan}>
                  <RefreshCw className="h-5 w-5" />
                </Button>
              </div>

              {scanResult.volunteer && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {scanResult.volunteer.firstName} {scanResult.volunteer.lastName}
                    </span>
                  </div>
                  {scanResult.day && (
                    <>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Jour {scanResult.day.dayNumber} - {new Date(scanResult.day.date).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {scanResult.day.iftarTime && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Iftar à {scanResult.day.iftarTime}</span>
                        </div>
                      )}
                      {scanResult.day.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{scanResult.day.location}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Camera Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scanner avec la caméra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraError ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                <p className="text-muted-foreground mb-4">{cameraError}</p>
                <Button onClick={startCamera}>Réessayer</Button>
              </div>
            ) : isScanning ? (
              <div className="space-y-4">
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white rounded-lg opacity-50" />
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Pointez la caméra vers le QR code du bénévole
                </p>
                <Button variant="outline" onClick={stopCamera} className="w-full">
                  Arrêter le scan
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Activez la caméra pour scanner les QR codes
                </p>
                <Button onClick={startCamera} className="gap-2">
                  <Camera className="h-4 w-4" />
                  Activer la caméra
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Saisie manuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Entrez le token ou l'URL du QR code manuellement
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Token ou URL du QR code..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              />
              <Button 
                onClick={handleManualSubmit}
                disabled={!manualToken.trim() || validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Valider"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiques du jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">--</div>
                <div className="text-xs text-muted-foreground">Validés</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">--</div>
                <div className="text-xs text-muted-foreground">Attendus</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
