import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Heart, Star, CheckCircle, Loader2, MessageSquare, Lightbulb } from "lucide-react";

// ============================================
// TYPES
// ============================================

type Question = {
  id: number;
  question: string;
  type: "rating" | "text" | "multiple_choice" | "yes_no";
  options: string[] | null;
  required: boolean;
  order_index: number;
};

type Answer = {
  questionId: number;
  answerText?: string;
  answerRating?: number;
  answerChoice?: string;
};

// ============================================
// STAR RATING COMPONENT
// ============================================

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-600 self-center">
          {value}/5
        </span>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function FeedbackPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? undefined;
  const [, navigate] = useLocation();

  const [formId, setFormId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Validate token if present
  const tokenQuery = trpc.feedback.validateToken.useQuery(
    { token: token! },
    { enabled: !!token, retry: false }
  );

  // Load default form
  const defaultFormQuery = trpc.feedback.getDefaultForm.useQuery(undefined, {
    enabled: !token,
  });

  // Pre-fill email from token
  useEffect(() => {
    if (tokenQuery.data?.email) {
      setUserEmail(tokenQuery.data.email);
      if (tokenQuery.data.formId) {
        setFormId(tokenQuery.data.formId);
      }
    }
  }, [tokenQuery.data]);

  useEffect(() => {
    if (defaultFormQuery.data) {
      setFormId(defaultFormQuery.data.id);
    }
  }, [defaultFormQuery.data]);

  const formQuery = trpc.feedback.getForm.useQuery(
    { id: formId! },
    { enabled: !!formId }
  );

  const questions: Question[] = (formQuery.data?.questions ?? []).sort(
    (a: Question, b: Question) => a.order_index - b.order_index
  );

  const submitMutation = trpc.feedback.submitFeedback.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erreur lors de l'envoi du feedback");
    },
  });

  const setAnswer = (questionId: number, partial: Partial<Answer>) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { questionId, ...prev.get(questionId), ...partial });
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formId) {
      toast.error("Formulaire non chargé");
      return;
    }

    // Check required fields
    for (const q of questions) {
      if (q.required && !answers.has(q.id)) {
        toast.error(`Veuillez répondre à la question : "${q.question}"`);
        return;
      }
    }

    if (!isAnonymous && (!userName.trim() || !userEmail.trim())) {
      toast.error("Veuillez renseigner votre nom et votre email, ou cocher la case anonyme.");
      return;
    }

    if (!consent) {
      toast.error("Veuillez accepter le consentement avant d'envoyer votre feedback.");
      return;
    }

    submitMutation.mutate({
      formId,
      isAnonymous,
      userName: isAnonymous ? undefined : userName,
      userEmail: isAnonymous ? undefined : userEmail,
      source: token ? "email_campaign" : "public_page",
      token,
      answers: Array.from(answers.values()),
    });
  };

  // ---- No form available (no active form in DB) → redirect to the public site feedback form ----
  if (!token && defaultFormQuery.isError) {
    navigate("/feedback/new");
    return null;
  }

  // ---- Token error state ----
  if (token && tokenQuery.isError) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20 bg-[#5E5B34]">
          <Card className="max-w-md w-full mx-4 bg-[#4A4829] border-[#F2E9D3]/20">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-[#F2E9D3] mb-2">Lien invalide</h2>
              <p className="text-[#C9B97A]">
                {(tokenQuery.error as any)?.message ?? "Ce lien de feedback est invalide ou a déjà été utilisé."}
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Success state ----
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20 bg-gradient-to-b from-[#5E5B34] to-[#3D3B1E]">
          <Card className="max-w-lg w-full mx-4 bg-[#4A4829] border-[#F2E9D3]/20">
            <CardContent className="p-10 text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-[#F2E9D3] mb-3">Merci pour votre retour !</h2>
              <p className="text-[#C9B97A] leading-relaxed mb-6">
                Votre avis nous aide à améliorer nos actions solidaires.
                <br />
                Chaque retour est précieux pour l'association Bab Rayan.
              </p>
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3].map((i) => (
                  <Heart key={i} className="w-6 h-6 fill-rose-400 text-rose-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <a
                href="/"
                className="inline-block text-[#C9B97A] hover:text-[#F2E9D3] underline text-sm"
              >
                Retour à l'accueil
              </a>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const isLoading = formQuery.isLoading || (!!token && tokenQuery.isLoading) || (!token && defaultFormQuery.isLoading);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gradient-to-b from-[#5E5B34] to-[#3D3B1E] py-12 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header inspirant */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#C9B97A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="w-8 h-8 text-[#C9B97A]" />
            </div>
            <h1 className="text-3xl font-bold text-[#F2E9D3] mb-3">Votre avis compte</h1>
            <p className="text-[#C9B97A] text-lg leading-relaxed italic">
              "Chaque retour est une lumière pour améliorer nos actions.<br />
              Merci de contribuer à cette œuvre collective."
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-[#C9B97A]" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Questions du formulaire */}
              {questions.map((q, idx) => (
                <Card key={q.id} className="bg-[#4A4829] border-[#F2E9D3]/20">
                  <CardContent className="p-6">
                    <Label className="text-[#F2E9D3] font-medium text-base block mb-4">
                      {idx + 1}. {q.question}
                      {q.required && <span className="text-rose-400 ml-1">*</span>}
                    </Label>

                    {q.type === "rating" && (
                      <StarRating
                        value={answers.get(q.id)?.answerRating ?? 0}
                        onChange={(v) => setAnswer(q.id, { answerRating: v })}
                      />
                    )}

                    {q.type === "text" && (
                      <Textarea
                        placeholder="Votre réponse..."
                        value={answers.get(q.id)?.answerText ?? ""}
                        onChange={(e) => setAnswer(q.id, { answerText: e.target.value })}
                        className="bg-[#3D3B1E] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#F2E9D3]/40 min-h-[100px]"
                      />
                    )}

                    {q.type === "multiple_choice" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(q.id, { answerChoice: opt })}
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                              answers.get(q.id)?.answerChoice === opt
                                ? "bg-[#C9B97A]/20 border-[#C9B97A] text-[#F2E9D3]"
                                : "bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3]/70 hover:border-[#C9B97A]/50"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === "yes_no" && (
                      <div className="flex gap-3">
                        {["Oui", "Non"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(q.id, { answerChoice: opt })}
                            className={`flex-1 py-3 rounded-lg border font-medium transition-colors ${
                              answers.get(q.id)?.answerChoice === opt
                                ? opt === "Oui"
                                  ? "bg-green-600/30 border-green-500 text-green-300"
                                  : "bg-red-600/30 border-red-500 text-red-300"
                                : "bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3]/70 hover:border-[#C9B97A]/50"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Anonymat */}
              <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Checkbox
                      id="anonymous"
                      checked={isAnonymous}
                      onCheckedChange={(v) => setIsAnonymous(!!v)}
                      className="border-[#C9B97A] data-[state=checked]:bg-[#C9B97A] mt-0.5"
                    />
                    <Label htmlFor="anonymous" className="text-[#F2E9D3] cursor-pointer leading-snug">
                      Je souhaite envoyer ce feedback <span className="font-semibold">anonymement</span>
                    </Label>
                  </div>

                  {!isAnonymous && (
                    <div className="space-y-4 pt-2 border-t border-[#F2E9D3]/10">
                      <div>
                        <Label className="text-[#C9B97A] text-sm mb-1 block">Nom</Label>
                        <Input
                          placeholder="Votre nom"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="bg-[#3D3B1E] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#F2E9D3]/40"
                        />
                      </div>
                      <div>
                        <Label className="text-[#C9B97A] text-sm mb-1 block">Email</Label>
                        <Input
                          type="email"
                          placeholder="votre@email.com"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          className="bg-[#3D3B1E] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#F2E9D3]/40"
                        />
                      </div>
                      <div>
                        <Label className="text-[#C9B97A] text-sm mb-1 block">Téléphone (optionnel)</Label>
                        <Input
                          type="tel"
                          placeholder="+212 6XX XX XX XX"
                          value={userPhone}
                          onChange={(e) => setUserPhone(e.target.value)}
                          className="bg-[#3D3B1E] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#F2E9D3]/40"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Consentement */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                  className="border-[#C9B97A] data-[state=checked]:bg-[#C9B97A] mt-0.5"
                />
                <Label htmlFor="consent" className="text-[#F2E9D3]/80 text-sm cursor-pointer leading-snug">
                  J'accepte que mon feedback soit utilisé par l'association Bab Rayan pour améliorer
                  l'expérience du Ftour solidaire
                </Label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitMutation.isPending || !formId || !consent}
                className="w-full bg-[#C9B97A] hover:bg-[#B5A56A] text-[#3D3B1E] font-bold py-4 text-lg"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 mr-2" />
                    Envoyer mon feedback
                  </>
                )}
              </Button>

              <p className="text-center text-[#C9B97A]/70 text-sm">
                Merci pour votre retour. Votre avis nous aide à améliorer nos actions solidaires.
              </p>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
