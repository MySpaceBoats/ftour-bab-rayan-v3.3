/**
 * Create Journal Entry — /admin/journal/new
 * Fast-input form: rich text, tags, dropdowns.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, X, Loader2 } from "lucide-react";
import { Link } from "wouter";
import {
  JOURNAL_TYPE_LABELS,
  JOURNAL_CATEGORY_LABELS,
  JOURNAL_IMPORTANCE_LABELS,
  JOURNAL_TYPES,
  JOURNAL_CATEGORIES,
  JOURNAL_IMPORTANCE_LEVELS,
} from "../components/JournalConstants";

// ============================================
// TAG INPUT
// ============================================

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addTag = (val: string) => {
    const tag = val.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 50);
    if (tag && !tags.includes(tag) && tags.length < 10) {
      onChange([...tags, tag]);
    }
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="border rounded-md px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent min-h-[42px]">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs rounded px-2 py-0.5">
          #{tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        placeholder={tags.length < 10 ? "Ajouter un tag (Entrée)…" : "Max 10 tags"}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => input.trim() && addTag(input)}
        disabled={tags.length >= 10}
      />
    </div>
  );
}

// ============================================
// SUGGESTED TAGS (simple keyword-based)
// ============================================

const SUGGESTED_TAGS: Record<string, string[]> = {
  logistics: ["transport", "matériel", "timing", "espace", "accueil"],
  volunteers: ["formation", "briefing", "rotation", "motivation", "équipe"],
  communication: ["annonce", "whatsapp", "affichage", "réseaux", "email"],
  food: ["quantité", "qualité", "service", "température", "allergènes"],
  participant_experience: ["accueil", "attente", "satisfaction", "ambiance", "retour"],
  technical: ["wifi", "son", "écran", "paiement", "application"],
};

// ============================================
// MAIN PAGE
// ============================================

export default function AdminJournalNew() {
  const [, navigate] = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("observation");
  const [category, setCategory] = useState<string>("logistics");
  const [importance, setImportance] = useState<string>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [eventEdition, setEventEdition] = useState("");

  const suggested = SUGGESTED_TAGS[category] ?? [];

  const createMutation = trpc.journal.createEntry.useMutation({
    onSuccess: (data) => {
      toast.success("Entrée créée avec succès !");
      navigate(`/admin/journal/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de la création.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Titre requis."); return; }
    if (!description.trim()) { toast.error("Description requise."); return; }

    createMutation.mutate({
      title: title.trim(),
      description,
      type: type as any,
      category: category as any,
      importance: importance as any,
      tags,
      eventEdition: eventEdition.trim(),
    });
  };

  const addSuggestedTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back */}
        <Link href="/admin/journal">
          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Retour au journal
          </button>
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Nouvelle entrée</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <Label htmlFor="title" className="text-sm font-medium">Titre *</Label>
              <Input
                id="title"
                placeholder="Résumez l'observation en une phrase…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-1"
                maxLength={255}
                autoFocus
              />
            </div>

            {/* Type + Category row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOURNAL_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{JOURNAL_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Catégorie *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOURNAL_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{JOURNAL_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Importance + Edition row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Importance *</Label>
                <Select value={importance} onValueChange={setImportance}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOURNAL_IMPORTANCE_LEVELS.map(i => (
                      <SelectItem key={i} value={i}>{JOURNAL_IMPORTANCE_LABELS[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edition" className="text-sm font-medium">Édition de l'événement</Label>
                <Input
                  id="edition"
                  placeholder="ex: Ramadan 2026"
                  value={eventEdition}
                  onChange={e => setEventEdition(e.target.value)}
                  className="mt-1"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
              <Textarea
                id="description"
                placeholder="Décrivez en détail l'observation, le problème ou l'idée…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1 min-h-[160px] resize-y"
              />
            </div>

            {/* Tags */}
            <div>
              <Label className="text-sm font-medium">
                Tags
                <span className="text-gray-400 font-normal ml-1">({tags.length}/10)</span>
              </Label>
              <div className="mt-1">
                <TagInput tags={tags} onChange={setTags} />
              </div>

              {/* Suggestions */}
              {suggested.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-gray-400">Suggestions :</span>
                  {suggested.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addSuggestedTag(tag)}
                      disabled={tags.includes(tag)}
                      className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
                ) : (
                  <><PlusCircle className="w-4 h-4" /> Créer l'entrée</>
                )}
              </Button>
              <Link href="/admin/journal">
                <Button type="button" variant="outline">Annuler</Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
