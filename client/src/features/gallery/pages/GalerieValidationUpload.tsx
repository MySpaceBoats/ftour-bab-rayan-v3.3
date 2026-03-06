import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";

type ValidationState = "idle" | "loading" | "success" | "already" | "error";

const REDIRECT_DELAY_S = 5;

export default function GalerieValidationUpload() {
  const { lang } = useI18n();
  const [, params] = useRoute("/galerie/validation/:token");
  const [, navigate] = useLocation();
  const token = params?.token ?? "";
  const [state, setState] = useState<ValidationState>("idle");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_S);
  const validateUpload = trpc.gallery.validateUploadByEmail.useMutation();

  useEffect(() => {
    if (!token || validateUpload.isPending || state !== "idle") return;

    setState("loading");
    validateUpload
      .mutateAsync({ token })
      .then(result => {
        if (result.alreadyValidated) {
          setState("already");
          setMessage("Ce lien a déjà été utilisé. Vos photos sont déjà visibles sur la galerie publique.");
        } else {
          setState("success");
          setMessage("Merci ! Vos photos sont maintenant validées et publiées sur la galerie.");
        }
      })
      .catch(error => {
        setState("error");
        setMessage(error?.message || "Lien invalide ou expiré.");
      });
  }, [token, validateUpload, state]);

  // Auto-redirect to gallery after success
  useEffect(() => {
    if (state !== "success" && state !== "already") return;

    let remaining = REDIRECT_DELAY_S;
    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        navigate(`/${lang}/galerie`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, lang, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Validation d'upload galerie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "loading" && <p>Validation en cours...</p>}
            {(state === "success" || state === "already") && (
              <>
                <p className="text-emerald-700">{message}</p>
                <p className="text-sm text-muted-foreground">
                  Redirection vers la galerie dans {countdown} seconde{countdown !== 1 ? "s" : ""}…
                </p>
              </>
            )}
            {state === "error" && <p className="text-red-600">{message}</p>}

            <div className="flex gap-2">
              <Link href={`/${lang}/galerie`}>
                <Button>Voir la galerie</Button>
              </Link>
              <Link href={`/${lang}/benevole/photos`}>
                <Button variant="outline">Uploader d'autres photos</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
