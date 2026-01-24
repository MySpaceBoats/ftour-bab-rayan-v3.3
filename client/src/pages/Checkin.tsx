import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle, XCircle, AlertTriangle, Loader2, 
  User, Calendar, Clock, MapPin, Shield, RefreshCw 
} from "lucide-react";

/**
 * Page publique de validation QR code - /checkin/{token}
 * 
 * Cette page est accessible sans authentification et permet de :
 * 1. Vérifier la validité du QR code (token existe, bonne date, pas déjà validé)
 * 2. Afficher les informations du bénévole de manière minimale
 * 3. Permettre la validation de présence par un organisateur
 * 
 * Design mobile-first optimisé pour usage terrain
 */
export default function Checkin() {
  const { token } = useParams<{ token: string }>();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);
  
  // Requête pour vérifier le token
  const { data, isLoading, error, refetch } = trpc.checkin.verify.useQuery(
    { token: token || '' },
    { 
      enabled: !!token,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  
  // Mutation pour valider la présence
  const validateMutation = trpc.checkin.validate.useMutation({
    onSuccess: () => {
      setValidationResult('success');
      refetch();
    },
    onError: () => {
      setValidationResult('error');
    },
  });
  
  const handleValidate = async () => {
    if (!token) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      await validateMutation.mutateAsync({ token });
    } finally {
      setIsValidating(false);
    }
  };
  
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Vérification en cours...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Validation du QR code
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Error state - Invalid token
  if (error || !data) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-14 w-14 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-red-700 mb-2">
              QR Code Invalide
            </h1>
            <p className="text-red-600 mb-6">
              {error?.message || "Ce QR code n'existe pas ou a été invalidé."}
            </p>
            <div className="bg-red-100 rounded-lg p-4 text-left text-sm text-red-700">
              <p className="font-medium mb-2">Causes possibles :</p>
              <ul className="list-disc list-inside space-y-1">
                <li>QR code expiré ou annulé</li>
                <li>Lien incomplet ou modifié</li>
                <li>Inscription non trouvée</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { volunteer, day, status } = data;
  
  // Guard against missing volunteer data
  if (!volunteer) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-14 w-14 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-red-700 mb-2">Erreur</h1>
            <p className="text-red-600">Données du bénévole non disponibles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Already validated state
  if (status === 'already_validated') {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-amber-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-14 w-14 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-amber-700 mb-2">
              Déjà Validé
            </h1>
            <p className="text-amber-600 mb-6">
              Ce QR code a déjà été utilisé pour valider la présence.
            </p>
            
            <div className="bg-white rounded-lg p-4 text-left space-y-3 border border-amber-200">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Bénévole</p>
                  <p className="font-medium">{volunteer.firstName} {volunteer.lastName}</p>
                </div>
              </div>
              {volunteer.scannedAt && (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Validé le</p>
                    <p className="font-medium">
                      {new Date(volunteer.scannedAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-xs text-amber-600 mt-4">
              <Shield className="h-3 w-3 inline mr-1" />
              Protection anti-doublon activée
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Wrong date state
  if (status === 'wrong_date') {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-orange-200">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-14 w-14 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-orange-700 mb-2">
              Mauvaise Date
            </h1>
            <p className="text-orange-600 mb-6">
              Ce QR code n'est pas valable aujourd'hui.
            </p>
            
            <div className="bg-white rounded-lg p-4 text-left space-y-3 border border-orange-200">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Bénévole</p>
                  <p className="font-medium">{volunteer.firstName} {volunteer.lastName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Date de validité</p>
                  <p className="font-medium">
                    {day && new Date(day.date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-orange-600 mt-4">
              Le QR code est valable uniquement le jour indiqué
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Valid state - Ready to validate
  const isValid = status === 'valid';
  
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      validationResult === 'success' ? 'bg-green-50' : 'bg-green-50'
    }`}>
      <Card className={`w-full max-w-md ${
        validationResult === 'success' ? 'border-green-300' : 'border-green-200'
      }`}>
        <CardContent className="pt-8 pb-8 text-center">
          {/* Success icon */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
            validationResult === 'success' ? 'bg-green-200' : 'bg-green-100'
          }`}>
            <CheckCircle className={`h-14 w-14 ${
              validationResult === 'success' ? 'text-green-700' : 'text-green-600'
            }`} />
          </div>
          
          <h1 className={`text-2xl font-bold mb-2 ${
            validationResult === 'success' ? 'text-green-800' : 'text-green-700'
          }`}>
            {validationResult === 'success' ? 'Présence Validée !' : 'QR Code Valide'}
          </h1>
          
          <p className="text-green-600 mb-6">
            {validationResult === 'success' 
              ? 'La présence a été enregistrée avec succès.'
              : 'Ce bénévole peut participer aujourd\'hui.'}
          </p>
          
          {/* Volunteer info card */}
          <div className="bg-white rounded-lg p-4 text-left space-y-3 border border-green-200 mb-6">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Bénévole</p>
                <p className="font-semibold text-lg">{volunteer.firstName} {volunteer.lastName}</p>
              </div>
            </div>
            
            {day && (
              <>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Jour {day.dayNumber} du Ramadan</p>
                    <p className="font-medium">
                      {new Date(day.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                  </div>
                </div>
                
                {day.iftarTime && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Heure d'Iftar</p>
                      <p className="font-medium">{day.iftarTime}</p>
                    </div>
                  </div>
                )}
                
                {day.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Lieu</p>
                      <p className="font-medium">{day.location}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Validate button */}
          {validationResult !== 'success' && isValid && (
            <Button 
              onClick={handleValidate}
              disabled={isValidating}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Validation...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Valider la présence
                </>
              )}
            </Button>
          )}
          
          {validationResult === 'success' && (
            <div className="space-y-3">
              <div className="bg-green-100 rounded-lg p-3 text-green-700 text-sm">
                <CheckCircle className="h-4 w-4 inline mr-2" />
                Présence enregistrée à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Scanner un autre QR
              </Button>
            </div>
          )}
          
          {validationResult === 'error' && (
            <div className="bg-red-100 rounded-lg p-3 text-red-700 text-sm mb-4">
              <XCircle className="h-4 w-4 inline mr-2" />
              Erreur lors de la validation. Veuillez réessayer.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Ftour Bab Rayan - Système de validation QR
        </p>
      </div>
    </div>
  );
}
