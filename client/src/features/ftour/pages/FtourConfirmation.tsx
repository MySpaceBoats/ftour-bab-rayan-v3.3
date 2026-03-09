import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  ChefHat,
  Loader2,
} from "lucide-react";

// ============================================
// TYPES & CONSTANTES
// ============================================

const FOOD_TYPE_LABELS: Record<string, string> = {
  plats_sales: "Plats salés",
  plats_sucres: "Plats sucrés",
  boissons: "Boissons",
};

const CUSTOM_OPTION = "__custom__";

// ============================================
// PAGE CONFIRMATION FTOUR
// ============================================

export default function FtourConfirmation() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [attending, setAttending] = useState<boolean | null>(null);
  const [foodType, setFoodType] = useState<string>("");
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [customFood, setCustomFood] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAttending, setSubmittedAttending] = useState(false);

  // --- Données ---
  const { data: invitation, isLoading, error } = trpc.ftour.getInvitationByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  const { data: foodOptions = {} } = trpc.ftour.getFoodOptions.useQuery();

  // --- Mutation ---
  const confirmMutation = trpc.ftour.confirmInvitation.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setSubmittedAttending(attending ?? false);
    },
    onError: (err) => {
      toast.error(err.message || "Une erreur s'est produite");
    },
  });

  const handleSubmit = () => {
    if (attending === null) {
      toast.error("Veuillez indiquer votre présence");
      return;
    }

    const finalFoodName = selectedFood === CUSTOM_OPTION ? customFood : selectedFood;

    if (attending && foodType && !finalFoodName.trim()) {
      toast.error("Veuillez préciser votre apport culinaire");
      return;
    }

    confirmMutation.mutate({
      token: token ?? "",
      attending,
      foodContribution:
        attending && foodType && finalFoodName.trim()
          ? {
              foodType: foodType as any,
              foodName: finalFoodName.trim(),
              quantity: quantity.trim() || undefined,
              notes: notes.trim() || undefined,
            }
          : undefined,
    });
  };

  const currentFoodList =
    foodType && foodOptions[foodType] ? (foodOptions[foodType] as string[]) : [];

  // --- Rendu ---

  if (!token) {
    return <ErrorState message="Lien invalide." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !invitation) {
    return <ErrorState message={error?.message ?? "Invitation non trouvée ou lien expiré."} />;
  }

  // Déjà répondu
  if (invitation.status !== "pending" && !submitted) {
    const isConfirmed = invitation.status === "confirmed";
    return (
      <PageLayout>
        <div className="text-center">
          {isConfirmed ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          )}
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {isConfirmed ? "Présence déjà confirmée !" : "Réponse déjà enregistrée"}
          </h2>
          <p className="text-gray-500 text-sm">
            {isConfirmed
              ? "Merci, ta participation a bien été enregistrée. À bientôt !"
              : "Ton absence a été notée. Merci de nous l'avoir fait savoir."}
          </p>
        </div>
      </PageLayout>
    );
  }

  // Succès après soumission
  if (submitted) {
    return (
      <PageLayout>
        <div className="text-center">
          {submittedAttending ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Présence confirmée !
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                BarakAllah fik{" "}
                <strong>{invitation.firstName}</strong> 🙏
                <br />
                On se retrouve le <strong>mercredi 18 mars 2026</strong> à{" "}
                <strong>La Table du Jardin by Bab Rayan</strong>.
              </p>
              {foodType && (selectedFood || customFood) && (
                <div className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
                  <ChefHat className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-800 font-medium">
                    Apport confirmé ✓
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Réponse enregistrée
              </h2>
              <p className="text-gray-500 text-sm">
                Pas de souci, merci de nous l'avoir fait savoir.
                <br />
                On espère te revoir bientôt !
              </p>
            </>
          )}
        </div>
      </PageLayout>
    );
  }

  // Formulaire de confirmation
  return (
    <PageLayout>
      {/* En-tête */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Bonjour {invitation.firstName} 👋
        </h2>
        <p className="text-sm text-gray-500">
          Tu es invité(e) à un moment spécial avec les bénévoles de Bab Rayan.
        </p>
      </div>

      {/* Détails de l'événement */}
      {invitation.event && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <h3 className="text-sm font-semibold text-green-800 mb-3">
            {invitation.event.title}
          </h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-sm text-green-700">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{invitation.event.location}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-green-700">
              <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {new Date(invitation.event.eventDate).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          {invitation.event.description && (
            <p className="mt-3 text-xs text-green-600">{invitation.event.description}</p>
          )}
        </div>
      )}

      {/* Question présence */}
      <div className="mb-6">
        <Label className="text-base font-semibold text-gray-800 mb-3 block">
          Seras-tu présent(e) ?
        </Label>
        <RadioGroup
          value={attending === null ? "" : attending ? "yes" : "no"}
          onValueChange={(v) => {
            setAttending(v === "yes");
            if (v === "no") {
              setFoodType("");
              setSelectedFood("");
              setCustomFood("");
            }
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-green-50 transition-colors">
            <RadioGroupItem value="yes" id="yes" />
            <Label htmlFor="yes" className="cursor-pointer flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Je serai présent(e)
            </Label>
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
            <RadioGroupItem value="no" id="no" />
            <Label htmlFor="no" className="cursor-pointer flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              Je ne pourrai pas venir
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Section contribution — visible si présent */}
      {attending === true && (
        <div className="mb-6 space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              Contribution au Ftour (optionnel)
            </h3>
          </div>

          {/* Type de contribution */}
          <div>
            <Label htmlFor="food-type" className="text-sm font-medium text-gray-700">
              Type de contribution
            </Label>
            <Select
              value={foodType}
              onValueChange={(v) => {
                setFoodType(v);
                setSelectedFood("");
                setCustomFood("");
              }}
            >
              <SelectTrigger id="food-type" className="mt-1">
                <SelectValue placeholder="Choisir un type…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FOOD_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Choix du plat */}
          {foodType && (
            <div>
              <Label htmlFor="food-name" className="text-sm font-medium text-gray-700">
                Choisir un plat
              </Label>
              <Select
                value={selectedFood}
                onValueChange={(v) => {
                  setSelectedFood(v);
                  if (v !== CUSTOM_OPTION) setCustomFood("");
                }}
              >
                <SelectTrigger id="food-name" className="mt-1">
                  <SelectValue placeholder="Sélectionner un plat…" />
                </SelectTrigger>
                <SelectContent>
                  {currentFoodList.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_OPTION}>
                    ✏️ Autre (saisir manuellement)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Saisie manuelle */}
          {selectedFood === CUSTOM_OPTION && (
            <div>
              <Label htmlFor="custom-food" className="text-sm font-medium text-gray-700">
                Préciser votre apport
              </Label>
              <Input
                id="custom-food"
                placeholder="Ex: Samoussa, Mhancha…"
                className="mt-1"
                value={customFood}
                onChange={(e) => setCustomFood(e.target.value)}
              />
            </div>
          )}

          {/* Quantité */}
          {foodType && selectedFood && (
            <div>
              <Label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                Quantité approximative (optionnel)
              </Label>
              <Input
                id="quantity"
                placeholder="Ex: 20 pièces, 1 grand plat…"
                className="mt-1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          )}

          {/* Commentaire */}
          {foodType && (
            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                Commentaire (optionnel)
              </Label>
              <Textarea
                id="notes"
                placeholder="Informations complémentaires…"
                className="mt-1 resize-none"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Bouton valider */}
      {attending !== null && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validation en cours…
            </>
          ) : (
            "Valider ma participation"
          )}
        </Button>
      )}
    </PageLayout>
  );
}

// ============================================
// COMPOSANTS UTILITAIRES
// ============================================

function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-8 pb-16 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #166534 0%, #15803d 100%)",
            padding: "24px",
            borderRadius: "12px 12px 0 0",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#fff", margin: 0, fontSize: "22px", fontWeight: "bold" }}>
            Ftour <span style={{ color: "#fbbf24" }}>Bab Rayan</span>
          </h1>
          <p style={{ color: "#bbf7d0", margin: "4px 0 0", fontSize: "13px" }}>
            Bénévoles – Invitation spéciale
          </p>
        </div>

        {/* Contenu */}
        <div className="bg-white rounded-b-xl shadow-md p-6">{children}</div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Association Bab Rayan · 4 rue Bayt Lahm, Casablanca
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <PageLayout>
      <div className="text-center py-4">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Lien invalide</h2>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </PageLayout>
  );
}
