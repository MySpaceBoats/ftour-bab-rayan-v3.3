/**
 * EventFeedbackForm — Formulaire de feedback multi-dimensionnel Ramadan
 *
 * Formulaire multi-étapes pour collecter le feedback structuré des participants
 * aux événements Ramadan (bénévoles, managers, visiteurs, bénéficiaires…)
 *
 * Architecture :
 *  - Étape 1 : Identification (rôle, type de participation, jour)
 *  - Étapes 2-N : Sections conditionnelles selon rôle/participation
 *  - Sauvegarde brouillon localStorage
 *  - Mode anonyme
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Star,
  Users,
  Shield,
  ChefHat,
  Sparkles,
  MessageSquare,
  Heart,
} from "lucide-react";

// ============================================================
// TYPES & CONSTANTES
// ============================================================

type Role = "VOLUNTEER" | "MANAGER" | "GROUP" | "BENEFICIARY" | "VISITOR" | "PARTNER";
type ParticipationType = "FTOR" | "NIGHT_26" | "VOLUNTEER_EVENT" | "THANK_YOU_EVENT";

interface SectionResponse {
  sectionKey: string;
  rating?: number;
  metadata?: Record<string, string | number | boolean>;
}

interface TextResponse {
  fieldKey: string;
  value: string;
}

interface FormState {
  // Étape 1 — Identification
  role: Role | "";
  participationType: ParticipationType | "";
  eventDay: string;
  name: string;
  email: string;
  isAnonymous: boolean;
  // Sections notées
  sections: Record<string, SectionResponse>;
  // Réponses textuelles
  texts: Record<string, string>;
}

const DRAFT_KEY = "event_feedback_draft";

const ROLES: { value: Role; label: string; icon: string }[] = [
  { value: "VOLUNTEER", label: "Bénévole", icon: "💛" },
  { value: "MANAGER", label: "Responsable / Manager", icon: "🎯" },
  { value: "GROUP", label: "Représentant de groupe", icon: "👥" },
  { value: "BENEFICIARY", label: "Bénéficiaire", icon: "🤲" },
  { value: "VISITOR", label: "Visiteur / Invité", icon: "🌟" },
  { value: "PARTNER", label: "Partenaire", icon: "🤝" },
];

const PARTICIPATION_TYPES: { value: ParticipationType; label: string }[] = [
  { value: "FTOR", label: "Ftour Ramadan (classique)" },
  { value: "NIGHT_26", label: "Nuit du 26" },
  { value: "VOLUNTEER_EVENT", label: "Ftour des bénévoles" },
  { value: "THANK_YOU_EVENT", label: "Événement de remerciements" },
];

// Toutes les sections configurées — visibility controlée par `isVisible`
interface SectionConfig {
  key: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  ratingLabel?: string;
  subQuestions?: { key: string; label: string; max?: number }[];
  isVisible: (role: Role, pType: ParticipationType) => boolean;
}

// ============================================================
// COMPOSANT RATING (étoiles 1–5 ou échelle 1–10)
// ============================================================

function RatingInput({
  value,
  onChange,
  max = 5,
  label,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  max?: number;
  label?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (max === 5) {
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-sm text-gray-600">{label}</span>}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              className="p-0.5 focus:outline-none"
              aria-label={`Note ${n}`}
            >
              <Star
                size={28}
                className={
                  n <= (hovered ?? value ?? 0)
                    ? "fill-[#C9B97A] text-[#C9B97A]"
                    : "text-gray-300"
                }
              />
            </button>
          ))}
          {value !== undefined && (
            <span className="ml-2 self-center text-sm font-medium text-gray-700">{value}/5</span>
          )}
        </div>
      </div>
    );
  }

  // Échelle 0–10 (NPS ou note sur 10)
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max + 1 }, (_, i) => i).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors
              ${
                value === n
                  ? "bg-[#864654] text-white border-[#864654]"
                  : "bg-white text-gray-700 border-gray-300 hover:border-[#C9B97A]"
              }`}
            aria-label={`${n}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>Pas du tout</span>
        <span>Extrêmement</span>
      </div>
    </div>
  );
}

// ============================================================
// BARRE DE PROGRESSION
// ============================================================

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Étape {current} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#C9B97A] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// SECTION CARD
// ============================================================

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-[#864654]">{icon}</span>}
        <h3 className="font-semibold text-[#864654] text-base">{title}</h3>
      </div>
      {description && <p className="text-sm text-gray-500 mb-3">{description}</p>}
      {children}
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function EventFeedbackForm() {
  const totalSteps = 6; // dynamique selon rôle, on affichera au max 6
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<FormState>({
    role: "",
    participationType: "",
    eventDay: "",
    name: "",
    email: "",
    isAnonymous: false,
    sections: {},
    texts: {},
  });

  // ---- Brouillon localStorage ----
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((f) => ({ ...f, ...parsed }));
      }
    } catch {}
  }, []);

  const saveDraft = useCallback((updated: FormState) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
    } catch {}
  }, []);

  function updateForm(patch: Partial<FormState>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }

  function setSection(key: string, patch: Partial<SectionResponse>) {
    setForm((prev) => {
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [key]: { ...(prev.sections[key] ?? { sectionKey: key }), ...patch },
        },
      };
      saveDraft(next);
      return next;
    });
  }

  function setText(key: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, texts: { ...prev.texts, [key]: value } };
      saveDraft(next);
      return next;
    });
  }

  // ---- tRPC mutation ----
  const submitMutation = trpc.eventFeedback.submitEventFeedback.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      localStorage.removeItem(DRAFT_KEY);
      window.scrollTo(0, 0);
    },
    onError: (err) => {
      toast.error(err.message || "Une erreur est survenue. Veuillez réessayer.");
    },
  });

  // ---- Calcul étapes visibles ----
  const role = form.role as Role | "";
  const pType = form.participationType as ParticipationType | "";

  // Sections à afficher selon rôle/participation
  const visibleSectionGroups: {
    stepLabel: string;
    sections: string[];
  }[] = [];

  if (role && pType) {
    // Groupe 1 — Expérience globale + Accueil
    visibleSectionGroups.push({
      stepLabel: "Expérience globale",
      sections: ["global_experience", "organisation", "accueil_entree", "systeme_digital"],
    });

    // Groupe 2 — Restauration
    visibleSectionGroups.push({
      stepLabel: "Restauration & Service",
      sections: [
        "service_tables",
        "cuisine_logistique",
        "nettoyage",
        ...(role === "BENEFICIARY" || role === "VISITOR" ? ["experience_beneficiaires", "tables_enfants"] : []),
        ...(role !== "VISITOR" ? ["distribution_externe"] : []),
      ],
    });

    // Groupe 3 — Logistique & Sécurité
    visibleSectionGroups.push({
      stepLabel: "Logistique & Sécurité",
      sections: [
        "securite",
        "sanitaires",
        "stand_vente",
        "ambiance_musique",
        ...(pType === "NIGHT_26" ? ["nuit_26"] : []),
      ],
    });

    // Groupe 4 — Organisation interne (visible VOLUNTEER, MANAGER, GROUP)
    if (["VOLUNTEER", "MANAGER", "GROUP"].includes(role)) {
      const orgSections = ["gestion_benevoles", "communication_interne", "respect_regles"];
      if (role === "MANAGER" || role === "GROUP") orgSections.push("gestion_groupes");
      if (role === "MANAGER") orgSections.push("feedback_manager");
      visibleSectionGroups.push({ stepLabel: "Organisation interne", sections: orgSections });
    }

    // Groupe 5 — Communication & Événements spéciaux
    const commSections = ["communication_externe"];
    if (pType === "VOLUNTEER_EVENT" || pType === "THANK_YOU_EVENT") commSections.push("evenements_speciaux");
    visibleSectionGroups.push({ stepLabel: "Communication & Impact", sections: commSections });

    // Groupe 6 — Témoignage & Suggestions
    visibleSectionGroups.push({
      stepLabel: "Suggestions & Témoignage",
      sections: [], // gérées via texts
    });
  }

  const stepsCount = role && pType ? 1 + visibleSectionGroups.length : 2;

  // ---- Navigation ----
  function handleNext() {
    if (step === 1 && (!form.role || !form.participationType)) {
      toast.error("Veuillez sélectionner votre rôle et type de participation.");
      return;
    }
    setStep((s) => Math.min(s + 1, stepsCount));
    window.scrollTo(0, 0);
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo(0, 0);
  }

  // ---- Soumission ----
  function handleSubmit() {
    if (!form.role || !form.participationType) {
      toast.error("Données manquantes.");
      return;
    }

    const sections: Array<{ sectionKey: string; rating?: number; metadata?: Record<string, string | number | boolean> }> =
      Object.values(form.sections).filter((s) => s.rating !== undefined || s.metadata);

    const textResponses: Array<{ fieldKey: string; value: string }> = Object.entries(form.texts)
      .filter(([, v]) => v.trim().length > 0)
      .map(([fieldKey, value]) => ({ fieldKey, value: value.trim() }));

    submitMutation.mutate({
      role: form.role as Role,
      participationType: form.participationType as ParticipationType,
      eventDay: form.eventDay ? parseInt(form.eventDay) : undefined,
      name: form.isAnonymous ? undefined : (form.name || undefined),
      email: form.isAnonymous ? undefined : (form.email || undefined),
      isAnonymous: form.isAnonymous,
      sections,
      textResponses,
    });
  }

  // ============================================================
  // RENDU — ÉTAT SUCCÈS
  // ============================================================

  if (submitted) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[#f9f7f0] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <CheckCircle2 size={72} className="mx-auto text-[#C9B97A] mb-4" />
            <h1 className="text-2xl font-bold text-[#864654] mb-2">Merci pour votre feedback !</h1>
            <p className="text-gray-600 mb-6">
              Votre avis est précieux pour améliorer nos événements. Nous allons l'analyser avec
              attention.
            </p>
            <Button
              onClick={() => window.location.href = "/"}
              className="bg-[#864654] hover:bg-[#6B3643] text-white"
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ============================================================
  // RENDU — FORMULAIRE
  // ============================================================

  const sectionGroupIndex = step - 2; // 0-based index dans visibleSectionGroups
  const currentGroup = visibleSectionGroups[sectionGroupIndex];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#f9f7f0] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* En-tête */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#864654]">Votre feedback — Bab Rayan</h1>
            <p className="text-gray-500 text-sm mt-1">
              Aidez-nous à améliorer nos événements Ramadan
            </p>
          </div>

          <ProgressBar current={step} total={stepsCount} />

          <Card className="shadow-md border-0">
            <CardContent className="pt-6 pb-6">

              {/* ====================================================
                  ÉTAPE 1 — IDENTIFICATION
                  ==================================================== */}
              {step === 1 && (
                <div className="space-y-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-[#864654] text-lg flex items-center gap-2">
                      <Users size={20} /> Identification
                    </CardTitle>
                  </CardHeader>

                  {/* Rôle */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Votre rôle *</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => updateForm({ role: r.value })}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-colors
                            ${form.role === r.value
                              ? "bg-[#864654] text-white border-[#864654]"
                              : "bg-white text-gray-700 border-gray-200 hover:border-[#C9B97A]"
                            }`}
                        >
                          <span className="text-xl">{r.icon}</span>
                          <span>{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Type de participation */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Type de participation *</Label>
                    <div className="space-y-2">
                      {PARTICIPATION_TYPES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateForm({ participationType: p.value })}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors
                            ${form.participationType === p.value
                              ? "bg-[#864654] text-white border-[#864654]"
                              : "bg-white text-gray-700 border-gray-200 hover:border-[#C9B97A]"
                            }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jour */}
                  <div>
                    <Label htmlFor="eventDay" className="text-sm font-medium mb-1 block">
                      Jour Ramadan (optionnel)
                    </Label>
                    <Input
                      id="eventDay"
                      type="number"
                      min={1}
                      max={30}
                      placeholder="Ex: 15"
                      value={form.eventDay}
                      onChange={(e) => updateForm({ eventDay: e.target.value })}
                      className="max-w-[120px]"
                    />
                  </div>

                  {/* Mode anonyme */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isAnonymous"
                      checked={form.isAnonymous}
                      onCheckedChange={(v) => updateForm({ isAnonymous: !!v })}
                    />
                    <Label htmlFor="isAnonymous" className="text-sm cursor-pointer">
                      Soumettre de façon anonyme
                    </Label>
                  </div>

                  {/* Identité (si non anonyme) */}
                  {!form.isAnonymous && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-sm font-medium mb-1 block">Prénom & Nom</Label>
                        <Input
                          id="name"
                          value={form.name}
                          onChange={(e) => updateForm({ name: e.target.value })}
                          placeholder="Votre nom"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-sm font-medium mb-1 block">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => updateForm({ email: e.target.value })}
                          placeholder="votre@email.com"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ====================================================
                  ÉTAPES 2–N — SECTIONS (groupées)
                  ==================================================== */}
              {step > 1 && step < stepsCount && currentGroup && (
                <div className="space-y-2">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-[#864654] text-lg">
                      {currentGroup.stepLabel}
                    </CardTitle>
                  </CardHeader>

                  {currentGroup.sections.map((sKey) => (
                    <SectionCard
                      key={sKey}
                      title={SECTION_LABELS[sKey]?.title ?? sKey}
                      description={SECTION_LABELS[sKey]?.description}
                      icon={SECTION_LABELS[sKey]?.icon}
                    >
                      <RatingInput
                        value={form.sections[sKey]?.rating}
                        onChange={(v) => setSection(sKey, { sectionKey: sKey, rating: v })}
                        max={5}
                        label="Note globale"
                      />

                      {/* Sous-questions spéciales */}
                      {sKey === "global_experience" && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Score global de l'expérience (1–10)
                            </p>
                            <RatingInput
                              value={form.sections[sKey]?.metadata?.["global_score"] as number | undefined}
                              onChange={(v) =>
                                setSection(sKey, {
                                  sectionKey: sKey,
                                  metadata: {
                                    ...(form.sections[sKey]?.metadata ?? {}),
                                    global_score: v,
                                  },
                                })
                              }
                              max={10}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Recommanderiez-vous cet événement ? (NPS 0–10)
                            </p>
                            <RatingInput
                              value={form.sections[sKey]?.metadata?.["nps"] as number | undefined}
                              onChange={(v) =>
                                setSection(sKey, {
                                  sectionKey: sKey,
                                  metadata: {
                                    ...(form.sections[sKey]?.metadata ?? {}),
                                    nps: v,
                                  },
                                })
                              }
                              max={10}
                            />
                          </div>
                        </div>
                      )}

                      {/* Sous-questions cuisine */}
                      {sKey === "cuisine_logistique" && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {[
                            { key: "qualite", label: "Qualité" },
                            { key: "quantite", label: "Quantité" },
                            { key: "variete", label: "Variété" },
                            { key: "presentation", label: "Présentation" },
                          ].map((sq) => (
                            <div key={sq.key}>
                              <p className="text-xs text-gray-500 mb-1">{sq.label}</p>
                              <RatingInput
                                value={form.sections[sKey]?.metadata?.[sq.key] as number | undefined}
                                onChange={(v) =>
                                  setSection(sKey, {
                                    sectionKey: sKey,
                                    metadata: {
                                      ...(form.sections[sKey]?.metadata ?? {}),
                                      [sq.key]: v,
                                    },
                                  })
                                }
                                max={5}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sous-questions service tables */}
                      {sKey === "service_tables" && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {[
                            { key: "rapidite", label: "Rapidité" },
                            { key: "amabilite", label: "Amabilité" },
                          ].map((sq) => (
                            <div key={sq.key}>
                              <p className="text-xs text-gray-500 mb-1">{sq.label}</p>
                              <RatingInput
                                value={form.sections[sKey]?.metadata?.[sq.key] as number | undefined}
                                onChange={(v) =>
                                  setSection(sKey, {
                                    sectionKey: sKey,
                                    metadata: {
                                      ...(form.sections[sKey]?.metadata ?? {}),
                                      [sq.key]: v,
                                    },
                                  })
                                }
                                max={5}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  ))}
                </div>
              )}

              {/* ====================================================
                  DERNIÈRE ÉTAPE — Suggestions & Témoignage
                  ==================================================== */}
              {step === stepsCount && (
                <div className="space-y-5">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-[#864654] text-lg flex items-center gap-2">
                      <MessageSquare size={20} /> Suggestions & Témoignage
                    </CardTitle>
                  </CardHeader>

                  <div>
                    <Label className="text-sm font-medium mb-1 block flex items-center gap-1">
                      <Heart size={14} className="text-[#C9B97A]" />
                      Impact personnel (en quoi cet événement vous a-t-il touché ?)
                    </Label>
                    <Textarea
                      rows={3}
                      placeholder="Partagez ce que cet événement a représenté pour vous…"
                      value={form.texts["personal_impact"] ?? ""}
                      onChange={(e) => setText("personal_impact", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-1 block">
                      Suggestion 1 (points à améliorer)
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Ex: améliorer la signalétique à l'entrée…"
                      value={form.texts["suggestion_1"] ?? ""}
                      onChange={(e) => setText("suggestion_1", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-1 block">
                      Suggestion 2 (idée pour l'édition suivante)
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Ex: ajouter une zone dédiée aux enfants…"
                      value={form.texts["suggestion_2"] ?? ""}
                      onChange={(e) => setText("suggestion_2", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-1 block">
                      Suggestion 3 (autre idée)
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Toute autre suggestion bienvenue…"
                      value={form.texts["suggestion_3"] ?? ""}
                      onChange={(e) => setText("suggestion_3", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-1 block flex items-center gap-1">
                      <Sparkles size={14} className="text-[#C9B97A]" />
                      Témoignage libre
                    </Label>
                    <Textarea
                      rows={4}
                      placeholder="Partagez librement votre expérience, vos impressions, vos félicitations…"
                      value={form.texts["testimonial"] ?? ""}
                      onChange={(e) => setText("testimonial", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ====================================================
                  NAVIGATION
                  ==================================================== */}
              <div className="flex justify-between mt-8 pt-4 border-t">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrev}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft size={16} /> Précédent
                  </Button>
                ) : (
                  <div />
                )}

                {step < stepsCount ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-[#864654] hover:bg-[#6B3643] text-white flex items-center gap-1"
                  >
                    Suivant <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                    className="bg-[#864654] hover:bg-[#6B3643] text-white"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Envoi…
                      </>
                    ) : (
                      "Envoyer mon feedback"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-gray-400 mt-4">
            Vos données sont traitées de façon confidentielle par l'association Bab Rayan.
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}

// ============================================================
// LABELS DES SECTIONS
// ============================================================

const SECTION_LABELS: Record<
  string,
  { title: string; description?: string; icon?: React.ReactNode }
> = {
  global_experience: {
    title: "Expérience globale",
    description: "Votre ressenti général sur l'événement",
    icon: <Star size={18} />,
  },
  organisation: {
    title: "Organisation générale",
    description: "Gestion du temps, flux, coordination",
    icon: <Shield size={18} />,
  },
  accueil_entree: {
    title: "Accueil & Entrée",
    description: "Accueil à l'arrivée, fluidité de l'entrée",
    icon: <Users size={18} />,
  },
  systeme_digital: {
    title: "Système digital (QR, email)",
    description: "Fluidité des QR codes, emails de confirmation",
    icon: <Sparkles size={18} />,
  },
  service_tables: {
    title: "Service (tables & serveurs)",
    description: "Qualité du service aux tables",
    icon: <Users size={18} />,
  },
  cuisine_logistique: {
    title: "Cuisine & Logistique alimentaire",
    description: "Qualité, quantité, variété et présentation des plats",
    icon: <ChefHat size={18} />,
  },
  nettoyage: {
    title: "Propreté & Nettoyage",
    description: "Propreté des espaces tout au long de l'événement",
    icon: <Sparkles size={18} />,
  },
  experience_beneficiaires: {
    title: "Expérience bénéficiaires",
    description: "Prise en charge des bénéficiaires",
    icon: <Heart size={18} />,
  },
  tables_enfants: {
    title: "Tables enfants",
    description: "Espace et service dédiés aux enfants",
    icon: <Users size={18} />,
  },
  distribution_externe: {
    title: "Distribution externe (paniers)",
    description: "Organisation de la distribution de paniers",
    icon: <Users size={18} />,
  },
  nuit_26: {
    title: "Nuit du 26 — spécifique",
    description: "Organisation logistique de la Nuit du 26",
    icon: <Sparkles size={18} />,
  },
  gestion_benevoles: {
    title: "Gestion des bénévoles",
    description: "Coordination, briefing et encadrement des bénévoles",
    icon: <Users size={18} />,
  },
  gestion_groupes: {
    title: "Gestion des groupes",
    description: "Coordination des groupes de visiteurs",
    icon: <Users size={18} />,
  },
  feedback_manager: {
    title: "Feedback manager",
    description: "Coordination entre managers, remontées d'information",
    icon: <Shield size={18} />,
  },
  communication_interne: {
    title: "Communication interne",
    description: "Qualité de la communication entre équipes",
    icon: <MessageSquare size={18} />,
  },
  securite: {
    title: "Sécurité",
    description: "Dispositif de sécurité, gestion des incidents",
    icon: <Shield size={18} />,
  },
  sanitaires: {
    title: "Sanitaires",
    description: "Propreté et disponibilité des sanitaires",
    icon: <Sparkles size={18} />,
  },
  stand_vente: {
    title: "Stand vente (goodies, pâtisseries, dons)",
    description: "Organisation du stand de vente",
    icon: <Star size={18} />,
  },
  ambiance_musique: {
    title: "Ambiance & Musique",
    description: "Ambiance générale, sonorisation, décoration",
    icon: <Sparkles size={18} />,
  },
  respect_regles: {
    title: "Respect des règles",
    description: "Respect du règlement intérieur par tous",
    icon: <Shield size={18} />,
  },
  communication_externe: {
    title: "Communication externe (réseaux sociaux, site web)",
    description: "Qualité de la communication avant et pendant l'événement",
    icon: <MessageSquare size={18} />,
  },
  evenements_speciaux: {
    title: "Événements spéciaux",
    description: "Organisation du ftour bénévoles ou de l'événement remerciements",
    icon: <Star size={18} />,
  },
};
