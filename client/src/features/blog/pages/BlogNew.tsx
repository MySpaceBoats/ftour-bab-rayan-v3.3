import { useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PenSquare, Loader2, CheckCircle } from "lucide-react";

// ============================================
// CONSTANTES
// ============================================

const POST_TYPES = [
  { value: "participant", label: "Participant" },
  { value: "benevole", label: "Bénévole" },
  { value: "equipe", label: "Membre de l'équipe" },
  { value: "autre", label: "Autre" },
] as const;

const CATEGORIES = [
  { value: "ressenti", label: "Ressenti" },
  { value: "analyse", label: "Analyse" },
  { value: "feedback", label: "Feedback" },
  { value: "histoire", label: "Histoire" },
  { value: "spirituel", label: "Spirituel" },
  { value: "organisation", label: "Organisation" },
] as const;

// ============================================
// FORMULAIRE
// ============================================

export default function BlogNew() {
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hook, setHook] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [consented, setConsented] = useState(false);

  const createPost = trpc.blog.create.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      toast.success("Votre témoignage a été soumis avec succès !");
      setTimeout(() => navigate(`/blog/${data.slug}`), 3000);
    },
    onError: (e) => {
      if (e.data?.code === "UNAUTHORIZED") {
        toast.error("Vous devez être connecté pour publier.");
      } else {
        toast.error(e.message);
      }
    },
  });

  function toggleCategory(val: string) {
    setSelectedCategories((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val].slice(0, 4)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || title.length < 5) {
      toast.error("Le titre doit comporter au moins 5 caractères.");
      return;
    }
    if (!type) {
      toast.error("Veuillez choisir un type.");
      return;
    }
    if (selectedCategories.length === 0) {
      toast.error("Sélectionnez au moins une catégorie.");
      return;
    }
    if (!content.trim() || content.length < 50) {
      toast.error("Le contenu doit comporter au moins 50 caractères.");
      return;
    }
    if (!consented) {
      toast.error("Vous devez accepter les conditions de publication.");
      return;
    }

    createPost.mutate({
      title: title.trim(),
      type: type as any,
      categories: selectedCategories as any,
      hook: hook.trim() || undefined,
      content: content.trim(),
      coverImage: coverImage.trim() || undefined,
      consented: true,
    });
  }

  // État succès
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Merci pour votre témoignage !</h1>
            <p className="text-gray-500 mb-2">
              Votre article a bien été soumis. Il sera visible après validation par notre équipe.
            </p>
            <p className="text-sm text-amber-600">Redirection en cours…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/20">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <div className="bg-gradient-to-b from-amber-800 to-amber-700 text-white px-4 py-12 text-center">
          <PenSquare className="w-10 h-10 mx-auto mb-3 opacity-80" />
          <h1 className="text-3xl font-bold mb-2">Partagez votre expérience</h1>
          <p className="text-amber-200 max-w-lg mx-auto text-sm leading-relaxed">
            Votre vécu est précieux. Que vous soyez bénévole, participant ou membre de l'équipe,
            vos mots enrichissent notre mémoire collective.
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-semibold">
              Titre de votre témoignage <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ex : Une soirée qui a changé ma vision…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              className="text-base"
            />
            <p className="text-xs text-gray-400">{title.length}/255</p>
          </div>

          {/* Hook */}
          <div className="space-y-2">
            <Label htmlFor="hook" className="font-semibold">
              Votre expérience en une phrase{" "}
              <span className="text-gray-400 font-normal">(optionnel)</span>
            </Label>
            <Input
              id="hook"
              placeholder="Ex : Ce soir-là, j'ai compris ce qu'est le partage."
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              maxLength={255}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Vous êtes… <span className="text-red-500">*</span>
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir votre profil" />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Catégories */}
          <div className="space-y-3">
            <Label className="font-semibold">
              Catégorie(s) <span className="text-red-500">*</span>{" "}
              <span className="text-gray-400 font-normal">(max 4)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const selected = selectedCategories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleCategory(cat.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      selected
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:border-amber-400 hover:text-amber-700"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenu */}
          <div className="space-y-2">
            <Label htmlFor="content" className="font-semibold">
              Votre témoignage <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="Racontez votre expérience avec le cœur. Qu'avez-vous ressenti ? Qu'avez-vous appris ? Qu'est-ce qui vous a marqué ?

Minimum 50 caractères."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="text-sm leading-relaxed resize-y"
            />
            <p className="text-xs text-gray-400">{content.length} caractères</p>
          </div>

          {/* Image cover (URL) */}
          <div className="space-y-2">
            <Label htmlFor="coverImage" className="font-semibold">
              Image de couverture{" "}
              <span className="text-gray-400 font-normal">(URL optionnelle)</span>
            </Label>
            <Input
              id="coverImage"
              type="url"
              placeholder="https://…"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
            {coverImage && (
              <img
                src={coverImage}
                alt="Aperçu"
                className="w-full h-40 object-cover rounded-lg mt-2"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>

          {/* Consentement */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <Checkbox
                id="consent"
                checked={consented}
                onCheckedChange={(v) => setConsented(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                J'accepte que mon témoignage soit publié sur le site Ftour Bab Rayan après
                validation par l'équipe. Je confirme que le contenu est authentique et que
                j'en suis l'auteur.
              </Label>
            </div>
            <p className="text-xs text-amber-700 pl-6">
              Votre article sera soumis à modération avant publication.
            </p>
          </div>

          {/* Bouton soumettre */}
          <Button
            type="submit"
            size="lg"
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-3 rounded-xl"
            disabled={createPost.isPending || !consented}
          >
            {createPost.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <PenSquare className="w-4 h-4 mr-2" />
                Soumettre mon témoignage
              </>
            )}
          </Button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
