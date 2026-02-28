import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export default function VolunteerCancellation() {
  const { token } = useParams<{ token: string }>();

  const cancellationMutation = trpc.volunteers.cancelByToken.useMutation();

  useEffect(() => {
    if (!token || cancellationMutation.isPending || cancellationMutation.data) {
      return;
    }

    cancellationMutation.mutate({ token });
  }, [token, cancellationMutation]);

  if (!token) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-14 w-14 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-700 mb-2">Lien invalide</h1>
            <p className="text-red-600">Le lien d'annulation est incomplet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cancellationMutation.isPending) {
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

  if (cancellationMutation.error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-14 w-14 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-700 mb-2">Annulation impossible</h1>
            <p className="text-red-600">
              {cancellationMutation.error.message || "Ce lien d'annulation n'est plus valide."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cancellationMutation.data?.alreadyCancelled) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-amber-200">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertTriangle className="h-14 w-14 text-amber-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-amber-700 mb-2">Inscription déjà annulée</h1>
            <p className="text-amber-700">Votre place avait déjà été libérée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-green-200">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle className="h-14 w-14 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-green-700 mb-2">Inscription annulée</h1>
          <p className="text-green-700">
            Votre inscription bénévole a bien été annulée automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
