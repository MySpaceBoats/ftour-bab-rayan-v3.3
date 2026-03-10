import { useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Camera,
  CheckCircle,
  AlertCircle,
  Trophy,
  Star,
  Upload,
} from "lucide-react";
import PrivateRoute from "@/features/volunteer/components/PrivateRoute";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  useMyEligibility,
  useSubmitCandidacyMutation,
  useGetPhotoUploadUrl,
} from "../electionApi";
import { toast } from "sonner";

const MAX_MOTIVATION = 500;

export default function CandidatureManager() {
  return (
    <PrivateRoute redirectTo="/candidature-manager">
      <CandidatureManagerContent />
    </PrivateRoute>
  );
}

function CandidatureManagerContent() {
  const { user } = useAuth();
  const eligibilityQuery = useMyEligibility();
  const submitMutation = useSubmitCandidacyMutation();
  const getUploadUrl = useGetPhotoUploadUrl();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    motivation_text: "",
    photo_url: "",
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Seuls les formats JPG, PNG et WebP sont acceptés.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La photo ne doit pas dépasser 5 MB.");
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const { signedUrl, publicUrl } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        contentType: file.type,
      });

      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!res.ok) throw new Error("Upload échoué");

      setForm(prev => ({ ...prev, photo_url: publicUrl }));
      toast.success("Photo uploadée !");
    } catch {
      toast.error("Erreur lors de l'upload de la photo.");
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eligibilityQuery.data?.eligible) {
      toast.error("Vous n'êtes pas éligible pour vous présenter.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        photo_url: form.photo_url || undefined,
        motivation_text: form.motivation_text || undefined,
      });
      setSubmitted(true);
      toast.success("Candidature soumise ! Elle sera examinée par l'équipe Bab Rayan.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la soumission.";
      toast.error(msg);
    }
  };

  const isLoading = eligibilityQuery.isLoading;
  const eligible = eligibilityQuery.data?.eligible ?? false;
  const participationCount = eligibilityQuery.data?.participationCount ?? 0;
  const minRequired = eligibilityQuery.data?.minRequired ?? 3;

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-stone-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-green-100 rounded-full p-4 inline-flex mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-3">
              Candidature soumise !
            </h2>
            <p className="text-stone-600">
              Votre candidature est en cours d'examen par l'équipe Bab Rayan.
              Vous serez notifié(e) dès qu'elle sera validée.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Trophy className="h-4 w-4" />
            Candidature Manager Ramadan {new Date().getFullYear()}
          </div>
          <h1 className="text-3xl font-bold text-stone-900">
            Se présenter comme manager
          </h1>
          <p className="text-stone-600 mt-2">
            Les managers Bab Rayan coordonnent les équipes de bénévoles durant le Ramadan.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : !eligible ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Candidature non éligible.</strong>
              <br />
              Vous devez avoir participé à au moins {minRequired} événements Bab Rayan.
              <br />
              Vos participations actuelles : <strong>{participationCount}/{minRequired}</strong>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Eligibility badge */}
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, Math.floor(participationCount / 3)) }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  ))}
                  <span className="font-medium ml-1">
                    Éligible — {participationCount} participations confirmées
                  </span>
                </div>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle>Votre candidature</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Photo */}
                  <div className="flex flex-col items-center gap-3">
                    <Avatar className="h-24 w-24 border-2 border-stone-200">
                      <AvatarImage src={photoPreview ?? undefined} />
                      <AvatarFallback className="bg-amber-100 text-amber-800 text-xl font-bold">
                        {form.first_name[0] ?? "?"}{form.last_name[0] ?? ""}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-full">
                      <Label htmlFor="photo-upload">
                        Photo de profil (JPG, PNG, WebP — max 5 MB)
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="photo-upload"
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="cursor-pointer"
                          disabled={uploading}
                        />
                        {uploading && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
                        {form.photo_url && !uploading && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prénom / Nom */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first-name">Prénom *</Label>
                      <Input
                        id="first-name"
                        required
                        value={form.first_name}
                        onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                        placeholder="Prénom"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last-name">Nom *</Label>
                      <Input
                        id="last-name"
                        required
                        value={form.last_name}
                        onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                        placeholder="Nom"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  {/* Téléphone */}
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+212 6xx xxx xxx"
                    />
                  </div>

                  {/* Motivation */}
                  <div>
                    <Label htmlFor="motivation">
                      Texte de motivation
                      <span className="text-stone-400 font-normal ml-1">
                        ({form.motivation_text.length}/{MAX_MOTIVATION} caractères)
                      </span>
                    </Label>
                    <Textarea
                      id="motivation"
                      rows={4}
                      maxLength={MAX_MOTIVATION}
                      value={form.motivation_text}
                      onChange={e => setForm(p => ({ ...p, motivation_text: e.target.value }))}
                      placeholder="Expliquez pourquoi vous souhaitez devenir manager Bab Rayan..."
                      className="resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={submitMutation.isPending || uploading}
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Soumission en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Soumettre ma candidature
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-stone-500 text-center">
                    Votre candidature sera examinée par l'équipe Bab Rayan avant d'être publiée.
                  </p>
                </CardContent>
              </Card>
            </form>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
