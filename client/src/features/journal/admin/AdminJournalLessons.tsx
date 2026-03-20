/**
 * Lessons Learned — /admin/journal/lessons
 * Structured cards, filters, PDF/CSV export.
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Lightbulb,
  PlusCircle,
  Search,
  Download,
  ArrowLeft,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Target,
  BookMarked,
} from "lucide-react";
import {
  JOURNAL_CATEGORY_LABELS,
  JOURNAL_IMPORTANCE_LABELS,
  JOURNAL_IMPORTANCE_COLORS,
  JOURNAL_IMPORTANCE_DOT,
  JOURNAL_CATEGORIES,
  JOURNAL_IMPORTANCE_LEVELS,
} from "../components/JournalConstants";

// ============================================
// HELPERS
// ============================================

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ============================================
// CSV / PDF EXPORT
// ============================================

function exportCSV(lessons: Lesson[]) {
  const headers = ["ID", "Problème", "Contexte", "Solution", "Résultat", "Recommandation", "Catégorie", "Importance", "Édition", "Date"];
  const rows = lessons.map(l => [
    l.id,
    `"${l.problem.replace(/"/g, '""')}"`,
    `"${(l.context ?? "").replace(/"/g, '""')}"`,
    `"${l.solution.replace(/"/g, '""')}"`,
    `"${(l.outcome ?? "").replace(/"/g, '""')}"`,
    `"${(l.recommendation ?? "").replace(/"/g, '""')}"`,
    l.category ?? "",
    l.importance,
    l.event_edition,
    formatDate(l.created_at),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lecons-apprises-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// CREATE / EDIT LESSON FORM
// ============================================

type LessonFormData = {
  problem: string;
  context: string;
  solution: string;
  outcome: string;
  recommendation: string;
  category: string;
  importance: string;
  eventEdition: string;
};

function LessonForm({
  initialData,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  initialData: LessonFormData;
  onSubmit: (data: LessonFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initialData);
  const set = (field: keyof LessonFormData, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Problème / Contexte observé *</Label>
        <Textarea value={form.problem} onChange={e => set("problem", e.target.value)} className="mt-1 min-h-[80px]" placeholder="Décrivez le problème ou la situation observée…" />
      </div>
      <div>
        <Label className="text-sm font-medium">Contexte détaillé</Label>
        <Textarea value={form.context} onChange={e => set("context", e.target.value)} className="mt-1" placeholder="Informations complémentaires sur le contexte…" />
      </div>
      <div>
        <Label className="text-sm font-medium">Solution appliquée *</Label>
        <Textarea value={form.solution} onChange={e => set("solution", e.target.value)} className="mt-1 min-h-[80px]" placeholder="Quelle solution a été mise en œuvre ?" />
      </div>
      <div>
        <Label className="text-sm font-medium">Résultat obtenu</Label>
        <Textarea value={form.outcome} onChange={e => set("outcome", e.target.value)} className="mt-1" placeholder="Quel résultat a été atteint ?" />
      </div>
      <div>
        <Label className="text-sm font-medium">Recommandation pour les prochaines éditions</Label>
        <Textarea value={form.recommendation} onChange={e => set("recommendation", e.target.value)} className="mt-1" placeholder="Que recommandez-vous pour les prochaines fois ?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Catégorie</Label>
          <Select value={form.category} onValueChange={v => set("category", v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="–" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">–</SelectItem>
              {JOURNAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{JOURNAL_CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Importance</Label>
          <Select value={form.importance} onValueChange={v => set("importance", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JOURNAL_IMPORTANCE_LEVELS.map(i => <SelectItem key={i} value={i}>{JOURNAL_IMPORTANCE_LABELS[i]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium">Édition de l'événement</Label>
        <Input value={form.eventEdition} onChange={e => set("eventEdition", e.target.value)} className="mt-1" placeholder="ex: Ramadan 2026" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => onSubmit(form)}
          disabled={isPending || !form.problem.trim() || !form.solution.trim()}
          className="bg-amber-600 hover:bg-amber-700 gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          {submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

// ============================================
// LESSON CARD
// ============================================

type Lesson = {
  id: number;
  problem: string;
  context: string | null;
  solution: string;
  outcome: string | null;
  recommendation: string | null;
  category: string | null;
  importance: string;
  event_edition: string;
  created_at: string;
  author?: { name: string | null } | null;
};

function LessonCard({
  lesson,
  onDelete,
  onEdit,
}: {
  lesson: Lesson;
  onDelete: (id: number) => void;
  onEdit: (lesson: Lesson) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${JOURNAL_IMPORTANCE_COLORS[lesson.importance]}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${JOURNAL_IMPORTANCE_DOT[lesson.importance]}`} />
            {JOURNAL_IMPORTANCE_LABELS[lesson.importance]}
          </span>
          {lesson.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              {JOURNAL_CATEGORY_LABELS[lesson.category]}
            </span>
          )}
          {lesson.event_edition && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
              {lesson.event_edition}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(lesson.created_at)}</span>
      </div>

      {/* Problem */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Problème
        </div>
        <p className="text-sm text-gray-800">{lesson.problem}</p>
        {lesson.context && (
          <p className="text-xs text-gray-500 mt-0.5 italic">{lesson.context}</p>
        )}
      </div>

      {/* Solution */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Solution
        </div>
        <p className="text-sm text-gray-800">{lesson.solution}</p>
      </div>

      {/* Expandable details */}
      {(lesson.outcome || lesson.recommendation) && (
        <>
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Voir résultat & recommandation →
            </button>
          ) : (
            <>
              {lesson.outcome && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-1">
                    <Target className="w-3.5 h-3.5" />
                    Résultat
                  </div>
                  <p className="text-sm text-gray-700">{lesson.outcome}</p>
                </div>
              )}
              {lesson.recommendation && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 mb-1">
                    <BookMarked className="w-3.5 h-3.5" />
                    Recommandation
                  </div>
                  <p className="text-sm text-gray-700">{lesson.recommendation}</p>
                </div>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Réduire ↑
              </button>
            </>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => onEdit(lesson)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Modifier
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors ml-auto">
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette leçon ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(lesson.id)} className="bg-red-600 hover:bg-red-700">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

const EMPTY_FORM: LessonFormData = {
  problem: "", context: "", solution: "", outcome: "",
  recommendation: "", category: "none", importance: "medium", eventEdition: "",
};

export default function AdminJournalLessons() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [importance, setImportance] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const utils = trpc.useUtils();

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._lessonSearchTimer);
    (window as any)._lessonSearchTimer = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 350);
  };

  const { data, isLoading } = trpc.journal.listLessons.useQuery({
    page,
    pageSize: 12,
    category: category !== "all" ? (category as any) : undefined,
    importance: importance !== "all" ? (importance as any) : undefined,
    search: debouncedSearch || undefined,
  });

  const lessons = (data?.lessons ?? []) as Lesson[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const createMutation = trpc.journal.createLesson.useMutation({
    onSuccess: () => {
      toast.success("Leçon créée !");
      setShowCreate(false);
      utils.journal.listLessons.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.journal.updateLesson.useMutation({
    onSuccess: () => {
      toast.success("Leçon mise à jour.");
      setEditingLesson(null);
      utils.journal.listLessons.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.journal.deleteLesson.useMutation({
    onSuccess: () => {
      toast.success("Leçon supprimée.");
      utils.journal.listLessons.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = (form: LessonFormData) => {
    createMutation.mutate({
      problem: form.problem,
      context: form.context || undefined,
      solution: form.solution,
      outcome: form.outcome || undefined,
      recommendation: form.recommendation || undefined,
      category: form.category !== "none" ? (form.category as any) : undefined,
      importance: form.importance as any,
      eventEdition: form.eventEdition,
    });
  };

  const handleUpdate = (form: LessonFormData) => {
    if (!editingLesson) return;
    updateMutation.mutate({
      id: editingLesson.id,
      problem: form.problem,
      context: form.context || undefined,
      solution: form.solution,
      outcome: form.outcome || undefined,
      recommendation: form.recommendation || undefined,
      category: form.category !== "none" ? (form.category as any) : undefined,
      importance: form.importance as any,
      eventEdition: form.eventEdition,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouvelle leçon apprise</h2>
            <LessonForm
              initialData={EMPTY_FORM}
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
              isPending={createMutation.isPending}
              submitLabel="Créer la leçon"
            />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Modifier la leçon</h2>
            <LessonForm
              initialData={{
                problem: editingLesson.problem,
                context: editingLesson.context ?? "",
                solution: editingLesson.solution,
                outcome: editingLesson.outcome ?? "",
                recommendation: editingLesson.recommendation ?? "",
                category: editingLesson.category ?? "none",
                importance: editingLesson.importance,
                eventEdition: editingLesson.event_edition,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingLesson(null)}
              isPending={updateMutation.isPending}
              submitLabel="Sauvegarder"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link href="/admin/journal">
                <button className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h1 className="text-xl font-bold text-gray-900">Leçons Apprises</h1>
              {total > 0 && <Badge variant="secondary" className="text-xs">{total}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => exportCSV(lessons)}
                disabled={lessons.length === 0}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                onClick={() => setShowCreate(true)}
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Nouvelle leçon</span>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {JOURNAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{JOURNAL_CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={importance} onValueChange={v => { setImportance(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute importance</SelectItem>
                {JOURNAL_IMPORTANCE_LEVELS.map(i => <SelectItem key={i} value={i}>{JOURNAL_IMPORTANCE_LABELS[i]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-20">
            <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Aucune leçon apprise</p>
            <p className="text-gray-400 text-sm mt-1">
              Créez une leçon ou convertissez une entrée du journal.
            </p>
            <Button
              className="mt-4 bg-amber-600 hover:bg-amber-700"
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Créer la première leçon
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lessons.map(lesson => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                  onEdit={(l) => setEditingLesson(l)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
