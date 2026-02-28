import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

/**
 * Page publique d'annulation d'inscription bénévole - /cancel-volunteer/{token}
 *
 * Accessible depuis le lien dans l'email de confirmation.
 * Permet au bénévole d'annuler son inscription en un clic.
 */
export default function CancelVolunteer() {
  const { token } = useParams<{ token: string }>();
  const [confirmed, setConfirmed] = useState(false);

  const cancelMutation = trpc.checkin.cancelVolunteer.useMutation();

  const handleCancel = () => {
    if (!token) return;
    setConfirmed(true);
    cancelMutation.mutate({ token });
  };

  // Pas de token
  if (!token) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">Lien invalide</h2>
            <p className="text-gray-600">
              Ce lien d'annulation n'est pas valide.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chargement
  if (cancelMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Annulation en cours...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Erreur
  if (cancelMutation.isError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">
              Annulation impossible
            </h2>
            <p className="text-gray-600">
              {cancelMutation.error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Succès
  if (cancelMutation.isSuccess && cancelMutation.data) {
    const { volunteer, alreadyCancelled } = cancelMutation.data;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            {alreadyCancelled ? (
              <>
                <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-amber-700 mb-2">
                  Déjà annulée
                </h2>
                <p className="text-gray-600">
                  L'inscription de <strong>{volunteer.firstName} {volunteer.lastName}</strong> a déjà été annulée précédemment.
                </p>
              </>
            ) : (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-green-700 mb-2">
                  Inscription annulée
                </h2>
                <p className="text-gray-600">
                  L'inscription de <strong>{volunteer.firstName} {volunteer.lastName}</strong> a bien été annulée.
                </p>
                <p className="text-sm text-gray-500 mt-4">
                  Merci de nous avoir prévenus. Nous espérons vous revoir bientôt !
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // État initial - Demande de confirmation
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Annuler votre inscription ?
          </h2>
          <p className="text-gray-600 mb-6">
            Vous êtes sur le point d'annuler votre inscription bénévole pour le Ftour Bab Rayan. Cette action est irréversible.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={confirmed}
            >
              Confirmer l'annulation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
