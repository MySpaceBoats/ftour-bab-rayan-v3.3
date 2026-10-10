import { useState } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Heart, Loader2, Star } from "lucide-react";

const TYPE_VALUES = [
  "volunteer",
  "event",
  "restaurant",
  "product",
  "general",
] as const;
const SOURCE_VALUES = [
  "home",
  "volunteer",
  "event",
  "restaurant",
  "product",
] as const;

type FeedbackType = (typeof TYPE_VALUES)[number];
type PageSource = (typeof SOURCE_VALUES)[number];

function isFeedbackType(value: string | null): value is FeedbackType {
  return !!value && TYPE_VALUES.includes(value as FeedbackType);
}

function isPageSource(value: string | null): value is PageSource {
  return !!value && SOURCE_VALUES.includes(value as PageSource);
}

export default function SiteFeedbackPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const typeParam = params.get("type");
  const sourceParam = params.get("source");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const feedbackType: FeedbackType = isFeedbackType(typeParam)
    ? typeParam
    : "general";
  const pageSource: PageSource = isPageSource(sourceParam)
    ? sourceParam
    : feedbackType === "volunteer"
      ? "volunteer"
      : feedbackType === "event"
        ? "event"
        : feedbackType === "restaurant"
          ? "restaurant"
          : feedbackType === "product"
            ? "product"
            : "home";

  const submitMutation = trpc.feedback.submitSiteFeedback.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'envoi"),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return toast.error("Veuillez sélectionner une note.");
    if (!consent) return toast.error("Veuillez accepter le consentement.");
    if (!isAnonymous) {
      if (!name.trim()) return toast.error("Veuillez renseigner votre nom.");
      if (!email.trim()) return toast.error("Veuillez renseigner votre email.");
    }

    submitMutation.mutate({
      name: isAnonymous ? undefined : name,
      email: isAnonymous ? undefined : email,
      phone: isAnonymous ? undefined : phone || undefined,
      feedbackType,
      rating,
      comment,
      pageSource,
      isAnonymous,
      consent: true,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gradient-to-b from-[#864654] to-[#592C37] py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-[#6B3643] border-[#F2E9D3]/20">
            <CardHeader>
              <CardTitle className="text-[#F2E9D3] text-2xl">
                Laisser un feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-8 text-[#F2E9D3] space-y-4">
                  <Heart className="w-10 h-10 mx-auto fill-rose-400 text-rose-400" />
                  <p>Merci pour votre retour ❤️</p>
                  <p className="text-[#C9B97A]">
                    Votre feedback aide Bab Rayan à améliorer l’expérience du
                    Ftour.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="flex gap-2 items-start">
                    <Checkbox
                      checked={isAnonymous}
                      onCheckedChange={v => {
                        const checked = !!v;
                        setIsAnonymous(checked);
                        if (checked) {
                          setName("");
                          setEmail("");
                          setPhone("");
                        }
                      }}
                      id="anonymous"
                    />
                    <Label htmlFor="anonymous" className="text-[#F2E9D3]">
                      Envoi anonyme (nom, email et téléphone non obligatoires)
                    </Label>
                  </div>
                  <div>
                    <Label className="text-[#C9B97A]">Nom</Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required={!isAnonymous}
                      disabled={isAnonymous}
                    />
                  </div>
                  <div>
                    <Label className="text-[#C9B97A]">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required={!isAnonymous}
                      disabled={isAnonymous}
                    />
                  </div>
                  <div>
                    <Label className="text-[#C9B97A]">
                      Téléphone (optionnel)
                    </Label>
                    <Input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      disabled={isAnonymous}
                    />
                  </div>
                  <input type="hidden" value={feedbackType} />
                  <div>
                    <Label className="text-[#C9B97A] block mb-2">Note</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                        >
                          <Star
                            className={`w-7 h-7 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-400"}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#C9B97A]">Commentaire</Label>
                    <Textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      required
                      placeholder="Partagez votre expérience avec nous..."
                    />
                  </div>
                  <div className="flex gap-2 items-start">
                    <Checkbox
                      checked={consent}
                      onCheckedChange={v => setConsent(!!v)}
                      id="consent"
                    />
                    <Label htmlFor="consent" className="text-[#F2E9D3]">
                      J’accepte que mon feedback soit utilisé pour améliorer
                      l’expérience Ftour Bab Rayan
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                        Envoi...
                      </>
                    ) : (
                      "Envoyer mon feedback"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
