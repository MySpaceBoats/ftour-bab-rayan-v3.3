import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { QrCode, CheckCircle, XCircle, AlertTriangle, Camera, Keyboard, ArrowLeft, User, Calendar, Clock, Loader2 } from "lucide-react";

export default function Scanner() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    volunteer?: {
      firstName: string;
      lastName: string;
      status: string;
    };
    day?: {
      dayNumber: number;
      date: Date;
    };
    message?: string;
  } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const checkInMutation = trpc.volunteers.checkIn.useMutation({
    onSuccess: (data) => {
      setScanResult({
        success: true,
        volunteer: data.volunteer ? {
          firstName: data.volunteer.firstName,
          lastName: data.volunteer.lastName,
          status: data.volunteer.status,
        } : undefined,
      });
      toast.success("Présence validée !");
    },
    onError: (error) => {
      setScanResult({
        success: false,
        message: error.message,
      });
      toast.error(error.message);
    },
  });

  const volunteerQuery = trpc.volunteers.getByQrCode.useQuery(
    { qrCode: manualCode },
    { enabled: false }
  );

  // Check authorization
  const isAuthorized = user?.role && ['admin', 'super_admin', 'admin_ops', 'scanner'].includes(user.role);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (mode === 'camera' && isAuthorized) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode, isAuthorized]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error("Impossible d'accéder à la caméra");
      setMode('manual');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error("Veuillez entrer un code QR");
      return;
    }
    checkInMutation.mutate({ qrCode: manualCode.trim() });
  };

  const handleNewScan = () => {
    setScanResult(null);
    setManualCode("");
    if (mode === 'camera') {
      startCamera();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les droits nécessaires pour accéder au scanner.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg">Scanner QR</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
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

        {/* Scan Result */}
        {scanResult && (
          <Card className={`mb-6 border-2 ${scanResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
            <CardContent className="p-6 text-center space-y-4">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${scanResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
                {scanResult.success ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              
              {scanResult.success && scanResult.volunteer ? (
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-green-800">Présence validée</h2>
                  <div className="bg-white rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">
                        {scanResult.volunteer.firstName} {scanResult.volunteer.lastName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-red-800">Erreur</h2>
                  <p className="text-red-700">{scanResult.message}</p>
                </div>
              )}

              <Button onClick={handleNewScan} className="w-full">
                <QrCode className="h-4 w-4 mr-2" />
                Nouveau scan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Camera Mode */}
        {mode === 'camera' && !scanResult && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  </div>
                </div>

                {/* Scanning indicator */}
                {isScanning && (
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                      Placez le QR code dans le cadre
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-4 text-center text-sm text-muted-foreground">
                <p>La détection automatique du QR code est en cours de développement.</p>
                <p>Utilisez le mode manuel pour l'instant.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && !scanResult && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Keyboard className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-semibold">Saisie manuelle</h2>
                <p className="text-sm text-muted-foreground">
                  Entrez le code QR du bénévole
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Code QR (ex: abc123xyz...)"
                  className="text-center font-mono"
                  autoFocus
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={checkInMutation.isPending}
                >
                  {checkInMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Valider la présence
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6 bg-muted/50">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Instructions
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Vérifiez que le QR code correspond au jour actuel</li>
              <li>• Un QR code ne peut être scanné qu'une seule fois</li>
              <li>• En cas de problème, contactez un administrateur</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
