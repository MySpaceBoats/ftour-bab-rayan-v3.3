import { useEffect, useMemo, useRef } from "react";
import { Link, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";

export default function GroupReservationEmailConfirmation() {
  const [match, params] = useRoute(
    "/reservation-groupe/confirmation-email/:token"
  );
  const { lang } = useI18n();
  const token = params?.token || "";

  const mutation = trpc.restaurantReservations.confirmGroupEmail.useMutation();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!match || !token || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    mutation.mutate({ token });
  }, [match, token, mutation]);

  const status = useMemo(() => {
    if (!match || !token) return "invalid";
    if (mutation.isSuccess) return "success";
    if (mutation.isError) return "error";
    return "idle";
  }, [match, token, mutation.isSuccess, mutation.isError]);

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Confirmation de réservation groupe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "invalid" && (
              <p className="text-sm text-red-700">
                Lien de confirmation invalide.
              </p>
            )}

            {status === "idle" && (
              <p className="text-sm text-[#844653]">
                Vérification de votre lien de confirmation en cours...
              </p>
            )}

            {status === "success" && (
              <div className="space-y-2">
                <p className="font-medium text-green-700">
                  ✅ Votre email est confirmé.
                </p>
                <p className="text-sm text-[#844653]">
                  Votre demande de réservation groupe a été transmise à
                  l&apos;administration restaurant.
                </p>
              </div>
            )}

            {status === "error" && (
              <p className="text-sm text-red-700">
                {mutation.error?.message || "Impossible de confirmer ce lien."}
              </p>
            )}

            <Button asChild variant="outline" className="w-full">
              <Link href={`/${lang}`}>Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
