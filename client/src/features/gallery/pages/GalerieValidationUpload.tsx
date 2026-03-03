import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type ValidationState = "idle" | "loading" | "success" | "already" | "error";

export default function GalerieValidationUpload() {
  const [, params] = useRoute("/galerie/validation/:token");
  const token = params?.token ?? "";
  const [state, setState] = useState<ValidationState>("idle");
  const [message, setMessage] = useState("");
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
          return;
        }
        setState("success");
        setMessage("Merci ! Vos photos sont maintenant validées et publiées sur la galerie.");
      })
      .catch(error => {
        setState("error");
        setMessage(error?.message || "Lien invalide ou expiré.");
      });
  }, [token, validateUpload, state]);

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
              <p className="text-emerald-700">{message}</p>
            )}
            {state === "error" && <p className="text-red-600">{message}</p>}

            <div className="flex gap-2">
              <Link href="/fr/galerie">
                <Button>Voir la galerie</Button>
              </Link>
              <Link href="/fr/benevole/photos">
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
