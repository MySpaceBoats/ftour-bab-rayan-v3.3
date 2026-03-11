import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

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
  const [resendEmail, setResendEmail] = useState("");
  const validateUpload = trpc.gallery.validateUploadByEmail.useMutation();
  const resendValidation = trpc.gallery.resendValidationEmail.useMutation({
    onSuccess: () => toast.success("Email de validation renvoyé !"),
    onError: e => toast.error(e.message),
  });

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
            {state === "error" && (
              <div className="space-y-3">
                <p className="text-red-600">{message}</p>
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Si votre lien a expiré, vous pouvez en recevoir un nouveau :
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="resend-email" className="text-sm">Votre adresse email</Label>
                      <Input
                        id="resend-email"
                        type="email"
                        placeholder="vous@exemple.com"
                        value={resendEmail}
                        onChange={e => setResendEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      className="self-end"
                      variant="outline"
                      disabled={!resendEmail || resendValidation.isPending}
                      onClick={() => resendValidation.mutate({ email: resendEmail })}
                    >
                      {resendValidation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Renvoyer
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
