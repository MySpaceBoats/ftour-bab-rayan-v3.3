/**
 * Journal Entry Detail — /admin/journal/:id
 * Full entry view with comments, "mark as useful", convert to lesson.
 */

import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ArrowLeft,
  ThumbsUp,
  MessageSquare,
  Lightbulb,
  Trash2,
  Edit3,
  Loader2,
  Clock,
  User,
  Tag,
  ChevronRight,
} from "lucide-react";
import {
  JOURNAL_TYPE_LABELS,
  JOURNAL_CATEGORY_LABELS,
  JOURNAL_IMPORTANCE_LABELS,
  JOURNAL_TYPE_COLORS,
  JOURNAL_IMPORTANCE_COLORS,
  JOURNAL_IMPORTANCE_DOT,
  JOURNAL_TYPES,
  JOURNAL_CATEGORIES,
  JOURNAL_IMPORTANCE_LEVELS,
} from "../components/JournalConstants";

// ============================================
// HELPERS
// ============================================

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ============================================
// COMMENT ITEM
// ============================================

type Comment = {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  author: { id: number; name: string | null } | null;
  author_id: number;
};

function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  onDelete,
}: {
  comment: Comment;
  currentUserId: number;
  isAdmin: boolean;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const utils = trpc.useUtils();

  const updateMutation = trpc.journal.updateComment.useMutation({
    onSuccess: () => {
      toast.success("Commentaire modifié.");
      setEditing(false);
      utils.journal.listComments.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const canEdit = isAdmin || comment.author_id === currentUserId;

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 text-sm font-semibold">
        {(comment.author?.name || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">{comment.author?.name || "Anonyme"}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(comment.created_at)}</span>
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate({ id: comment.id, content })}
                disabled={updateMutation.isPending || !content.trim()}
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sauvegarder"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setContent(comment.content); }} className="h-7 text-xs">
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>

      {canEdit && !editing && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors"
            title="Modifier"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(comment.id)}
            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// CONVERT TO LESSON DIALOG
// ============================================

function ConvertToLessonDialog({
  entryId,
  onSuccess,
}: {
  entryId: string;
  onSuccess: (lessonId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [solution, setSolution] = useState("");
  const [outcome, setOutcome] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const mutation = trpc.journal.convertToLesson.useMutation({
    onSuccess: (data) => {
      toast.success("Converti en leçon apprise !");
      setOpen(false);
      onSuccess(data.id);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
        onClick={() => setOpen(true)}
      >
        <Lightbulb className="w-4 h-4" />
        Convertir en leçon
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Convertir en leçon apprise</h2>

            <div>
              <Label className="text-sm font-medium">Solution apportée *</Label>
              <Textarea
                placeholder="Quelle solution a été mise en place ?"
                value={solution}
                onChange={e => setSolution(e.target.value)}
                className="mt-1 min-h-[100px]"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Résultat obtenu</Label>
              <Textarea
                placeholder="Quel a été le résultat ?"
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Recommandation pour les prochaines éditions</Label>
              <Textarea
                placeholder="Que recommandez-vous pour les prochaines fois ?"
                value={recommendation}
                onChange={e => setRecommendation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => mutation.mutate({ entryId, solution, outcome, recommendation })}
                disabled={mutation.isPending || !solution.trim()}
                className="bg-amber-600 hover:bg-amber-700 gap-2"
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                Créer la leçon
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// EDIT ENTRY PANEL
// ============================================

function EditEntryPanel({
  entry,
  onClose,
}: {
  entry: {
    id: string;
    title: string;
    description: string;
    type: string;
    category: string;
    importance: string;
    tags: string[];
    event_edition: string;
  };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [description, setDescription] = useState(entry.description);
  const [type, setType] = useState(entry.type);
  const [category, setCategory] = useState(entry.category);
  const [importance, setImportance] = useState(entry.importance);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const utils = trpc.useUtils();

  const mutation = trpc.journal.updateEntry.useMutation({
    onSuccess: () => {
      toast.success("Entrée mise à jour.");
      utils.journal.getEntry.invalidate({ id: entry.id });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 50);
    if (tag && !tags.includes(tag) && tags.length < 10) setTags([...tags, tag]);
    setTagInput("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Modifier l'entrée</h2>

        <div>
          <Label className="text-sm font-medium">Titre</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOURNAL_TYPES.map(t => <SelectItem key={t} value={t}>{JOURNAL_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOURNAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{JOURNAL_CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Importance</Label>
          <Select value={importance} onValueChange={setImportance}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JOURNAL_IMPORTANCE_LEVELS.map(i => <SelectItem key={i} value={i}>{JOURNAL_IMPORTANCE_LABELS[i]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 min-h-[120px]" />
        </div>

        <div>
          <Label className="text-sm font-medium">Tags</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="Nouveau tag…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>+</Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs rounded px-2 py-0.5">
                #{tag}
                <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}>
                  <span className="text-xs">×</span>
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => mutation.mutate({ id: entry.id, title, description, type: type as any, category: category as any, importance: importance as any, tags })}
            disabled={mutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sauvegarder"}
          </Button>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AdminJournalEntry() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const entryId = params.id;

  const [showEdit, setShowEdit] = useState(false);
  const [newComment, setNewComment] = useState("");

  const utils = trpc.useUtils();

  const { data: entry, isLoading } = trpc.journal.getEntry.useQuery({ id: entryId });
  const { data: comments = [] } = trpc.journal.listComments.useQuery({ entryId });
  const { data: voteData } = trpc.journal.hasVotedUseful.useQuery({ entryId });

  const toggleUsefulMutation = trpc.journal.toggleUseful.useMutation({
    onSuccess: () => {
      utils.journal.getEntry.invalidate({ id: entryId });
      utils.journal.hasVotedUseful.invalidate({ entryId });
    },
  });

  const addCommentMutation = trpc.journal.addComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.journal.listComments.invalidate({ entryId });
      toast.success("Commentaire ajouté.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCommentMutation = trpc.journal.deleteComment.useMutation({
    onSuccess: () => {
      utils.journal.listComments.invalidate({ entryId });
      toast.success("Commentaire supprimé.");
    },
  });

  const deleteEntryMutation = trpc.journal.deleteEntry.useMutation({
    onSuccess: () => {
      toast.success("Entrée supprimée.");
      navigate("/admin/journal");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Entrée introuvable.</p>
          <Link href="/admin/journal">
            <Button className="mt-4" variant="outline">Retour au journal</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isUseful = voteData?.isUseful ?? false;
  // Assume currentUserId and role would come from auth context; using a placeholder
  // In production, inject from useSession or similar
  const currentUserId = (entry as any).author_id ?? 0;
  const isAdmin = true; // simplified — real implementation would check ctx

  return (
    <div className="min-h-screen bg-gray-50">
      {showEdit && (
        <EditEntryPanel
          entry={entry as any}
          onClose={() => setShowEdit(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
          <Link href="/admin/journal">
            <span className="hover:text-indigo-600 cursor-pointer">Journal</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-600 truncate max-w-[200px]">{entry.title}</span>
        </div>

        {/* Entry card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${JOURNAL_IMPORTANCE_COLORS[entry.importance]}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${JOURNAL_IMPORTANCE_DOT[entry.importance]}`} />
              {JOURNAL_IMPORTANCE_LABELS[entry.importance]}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${JOURNAL_TYPE_COLORS[entry.type]}`}>
              {JOURNAL_TYPE_LABELS[entry.type]}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              {JOURNAL_CATEGORY_LABELS[entry.category]}
            </span>
            {(entry as any).event_edition && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                {(entry as any).event_edition}
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-3">{entry.title}</h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {(entry as any).author?.name || "Inconnu"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDateTime(entry.created_at)}
            </span>
          </div>

          {/* Description */}
          <div
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: entry.description }}
          />

          {/* Tags */}
          {(entry as any).tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {(entry as any).tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-gray-100">
            <Button
              variant={isUseful ? "default" : "outline"}
              size="sm"
              className={`gap-1.5 ${isUseful ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
              onClick={() => toggleUsefulMutation.mutate({ entryId })}
              disabled={toggleUsefulMutation.isPending}
            >
              <ThumbsUp className="w-4 h-4" />
              Utile
              {(entry as any).useful_count > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5">{(entry as any).useful_count}</Badge>
              )}
            </Button>

            <ConvertToLessonDialog
              entryId={entryId}
              onSuccess={(id) => navigate(`/admin/journal/lessons`)}
            />

            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEdit(true)}>
              <Edit3 className="w-4 h-4" />
              Modifier
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 ml-auto">
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Tous les commentaires associés seront également supprimés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteEntryMutation.mutate({ id: entryId })}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Comments section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Commentaires
            {comments.length > 0 && (
              <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
            )}
          </h2>

          {/* Existing comments */}
          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">Aucun commentaire pour le moment.</p>
          ) : (
            <div className="mb-4">
              {(comments as Comment[]).map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onDelete={(id) => deleteCommentMutation.mutate({ id })}
                />
              ))}
            </div>
          )}

          {/* Add comment */}
          <div className="space-y-2">
            <Textarea
              placeholder="Ajouter un commentaire…"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button
              size="sm"
              onClick={() => addCommentMutation.mutate({ entryId, content: newComment })}
              disabled={addCommentMutation.isPending || !newComment.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              Commenter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
