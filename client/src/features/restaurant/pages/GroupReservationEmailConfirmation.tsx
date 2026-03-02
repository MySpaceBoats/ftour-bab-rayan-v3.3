import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";

export default function GroupReservationEmailConfirmation() {
  const [match, params] = useRoute("/reservation-groupe/confirmation-email/:token");
  const { lang } = useI18n();
  const token = params?.token || "";

  const mutation = trpc.restaurantReservations.confirmGroupEmail.useMutation();

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
              <>
                <p className="text-sm text-[#5d5a3c]">
                  Cliquez ci-dessous pour confirmer votre adresse email et transmettre votre demande à l&apos;administration.
                </p>
                <Button
                  className="w-full bg-[#5d5a3c] text-white hover:bg-[#4a4830]"
                  onClick={() => mutation.mutate({ token })}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Confirmation en cours..." : "Confirmer ma réservation"}
                </Button>
              </>
            )}

            {status === "success" && (
              <div className="space-y-2">
                <p className="font-medium text-green-700">
                  ✅ Votre email est confirmé.
                </p>
                <p className="text-sm text-[#5d5a3c]">
                  Votre demande de réservation groupe a été transmise à l&apos;administration restaurant.
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
