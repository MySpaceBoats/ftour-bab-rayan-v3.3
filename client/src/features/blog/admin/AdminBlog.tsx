import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  BarChart3,
} from "lucide-react";

// ============================================
// CONSTANTES
// ============================================

const TYPE_LABELS: Record<string, string> = {
  benevole: "Bénévole",
  participant: "Participant",
  equipe: "Équipe",
  autre: "Autre",
};

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

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Publié", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Refusé", className: "bg-red-100 text-red-800" },
};

// ============================================
// COMPOSANT CARTE POST ADMIN
// ============================================

type AdminPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  author_name: string;
  type: string;
  categories: string[];
  status: string;
  likes: number;
  views: number;
  created_at: string;
  rejection_note: string | null;
};

function PostRow({
  post,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  isLoading,
}: {
  post: AdminPost;
  onEdit: () => void;
  onApprove: () => void;
  onReject: (note: string) => void;
  onDelete: () => void;
  isLoading: boolean;
}) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const date = new Date(post.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const statusBadge = STATUS_BADGES[post.status] ?? STATUS_BADGES.pending;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge.className}`}
              >
                {statusBadge.label}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {TYPE_LABELS[post.type] ?? post.type}
              </span>
            </div>

            <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 line-clamp-1">
              {post.title}
            </h3>

            {post.excerpt && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                {post.excerpt}
              </p>
            )}

            <div className="text-xs text-gray-400">
              Par{" "}
              <span className="font-medium text-gray-600">
                {post.author_name}
              </span>
              {" · "}
              {date}
              {" · "}
              {post.views} vues {" · "}
              {post.likes} likes
            </div>

            {post.rejection_note && (
              <p className="text-xs text-red-600 mt-1 italic">
                Note refus: {post.rejection_note}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" title="Voir">
                <Eye className="w-4 h-4" />
              </Button>
            </a>

            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={onEdit}
              disabled={isLoading}
              title="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </Button>

            {post.status !== "approved" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={onApprove}
                disabled={isLoading}
                title="Approuver"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            )}

            {post.status !== "rejected" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                onClick={() => setShowRejectDialog(true)}
                disabled={isLoading}
                title="Refuser"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  disabled={isLoading}
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce témoignage ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. L'article "{post.title}" sera
                    définitivement supprimé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={onDelete}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Dialog refus */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser ce témoignage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Vous pouvez ajouter une note pour expliquer le motif du refus
              (optionnel).
            </p>
            <Textarea
              placeholder="Note de refus (optionnelle)…"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                onReject(rejectNote);
                setShowRejectDialog(false);
                setRejectNote("");
              }}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// PAGE ADMIN BLOG
// ============================================

export default function AdminBlog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    hook: "",
    content: "",
    type: "participant",
    status: "pending",
    rejectionNote: "",
    categories: [] as string[],
  });

  const utils = trpc.useUtils();

  const { data: stats } = trpc.blog.stats.useQuery();
  const { data: postToEdit, isFetching: isLoadingPostToEdit } =
    trpc.blog.adminGetById.useQuery(
      { id: editingPostId ?? 0 },
      { enabled: editingPostId !== null }
    );

  const { data, isLoading } = trpc.blog.adminList.useQuery({
    page,
    pageSize: 15,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    sort: "recent",
  });

  const approve = trpc.blog.approve.useMutation({
    onSuccess: async () => {
      toast.success("Article approuvé et publié !");
      await utils.blog.adminList.invalidate();
      await utils.blog.stats.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const reject = trpc.blog.reject.useMutation({
    onSuccess: async () => {
      toast.success("Article refusé.");
      await utils.blog.adminList.invalidate();
      await utils.blog.stats.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const del = trpc.blog.delete.useMutation({
    onSuccess: async () => {
      toast.success("Article supprimé.");
      await utils.blog.adminList.invalidate();
      await utils.blog.stats.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const updatePost = trpc.blog.update.useMutation({
    onSuccess: async () => {
      toast.success("Article modifié avec succès.");
      setEditingPostId(null);
      await utils.blog.adminList.invalidate();
      await utils.blog.stats.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (!postToEdit) return;

    setEditForm({
      title: postToEdit.title || "",
      hook: postToEdit.hook || "",
      content: postToEdit.content || "",
      type: postToEdit.type || "participant",
      status: postToEdit.status || "pending",
      rejectionNote: postToEdit.rejection_note || "",
      categories: Array.isArray(postToEdit.categories)
        ? (postToEdit.categories as string[])
        : [],
    });
  }, [postToEdit]);

  function toggleCategory(val: string) {
    setEditForm(prev => ({
      ...prev,
      categories: prev.categories.includes(val)
        ? prev.categories.filter(cat => cat !== val)
        : [...prev.categories, val].slice(0, 4),
    }));
  }

  function submitEdit() {
    if (!editingPostId) return;

    if (!editForm.title.trim() || editForm.title.trim().length < 5) {
      toast.error("Le titre doit contenir au moins 5 caractères.");
      return;
    }
    if (!editForm.content.trim() || editForm.content.trim().length < 50) {
      toast.error("Le contenu doit contenir au moins 50 caractères.");
      return;
    }
    if (editForm.categories.length === 0) {
      toast.error("Sélectionnez au moins une catégorie.");
      return;
    }

    updatePost.mutate({
      id: editingPostId,
      title: editForm.title.trim(),
      hook: editForm.hook.trim() || undefined,
      content: editForm.content.trim(),
      type: editForm.type as "participant" | "benevole" | "equipe" | "autre",
      status: editForm.status as "pending" | "approved" | "rejected",
      categories: editForm.categories as (
        | "ressenti"
        | "analyse"
        | "feedback"
        | "histoire"
        | "spirituel"
        | "organisation"
      )[],
      rejectionNote: editForm.rejectionNote.trim() || undefined,
    });
  }

  const isMutating =
    approve.isPending ||
    reject.isPending ||
    del.isPending ||
    updatePost.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Blog Communautaire
            </h1>
            <p className="text-sm text-gray-500">Modération des témoignages</p>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Admin
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total",
                value: stats.total,
                icon: <BarChart3 className="w-4 h-4" />,
                color: "text-gray-600",
              },
              {
                label: "En attente",
                value: stats.pending,
                icon: <Clock className="w-4 h-4" />,
                color: "text-yellow-600",
              },
              {
                label: "Publiés",
                value: stats.approved,
                icon: <CheckCircle className="w-4 h-4" />,
                color: "text-emerald-600",
              },
              {
                label: "Refusés",
                value: stats.rejected,
                icon: <XCircle className="w-4 h-4" />,
                color: "text-red-500",
              },
            ].map(s => (
              <div
                key={s.label}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className={`flex items-center gap-2 mb-1 ${s.color}`}>
                  {s.icon}
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher un article…"
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={v => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Publiés</SelectItem>
              <SelectItem value="rejected">Refusés</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={v => {
              setTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="benevole">Bénévole</SelectItem>
              <SelectItem value="participant">Participant</SelectItem>
              <SelectItem value="equipe">Équipe</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">Aucun article trouvé.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.posts.map(post => (
              <PostRow
                key={post.id}
                post={post as AdminPost}
                isLoading={isMutating}
                onEdit={() => setEditingPostId(post.id)}
                onApprove={() => approve.mutate({ id: post.id })}
                onReject={note =>
                  reject.mutate({ id: post.id, note: note || undefined })
                }
                onDelete={() => del.mutate({ id: post.id })}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex justify-center items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={editingPostId !== null}
        onOpenChange={open => {
          if (!open) setEditingPostId(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
          </DialogHeader>

          {isLoadingPostToEdit && !postToEdit ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Chargement de l'article…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Titre
                </label>
                <Input
                  value={editForm.title}
                  maxLength={255}
                  onChange={e =>
                    setEditForm(prev => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Phrase d'accroche (optionnel)
                </label>
                <Input
                  value={editForm.hook}
                  maxLength={255}
                  onChange={e =>
                    setEditForm(prev => ({ ...prev, hook: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <Select
                    value={editForm.type}
                    onValueChange={v =>
                      setEditForm(prev => ({ ...prev, type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Statut
                  </label>
                  <Select
                    value={editForm.status}
                    onValueChange={v =>
                      setEditForm(prev => ({ ...prev, status: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="approved">Publié</SelectItem>
                      <SelectItem value="rejected">Refusé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Catégories (max 4)
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const selected = editForm.categories.includes(cat.value);
                    return (
                      <Button
                        key={cat.value}
                        variant="outline"
                        type="button"
                        className={
                          selected
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : ""
                        }
                        onClick={() => toggleCategory(cat.value)}
                      >
                        {cat.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Contenu
                </label>
                <Textarea
                  value={editForm.content}
                  rows={10}
                  onChange={e =>
                    setEditForm(prev => ({ ...prev, content: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Note de refus (optionnel)
                </label>
                <Textarea
                  value={editForm.rejectionNote}
                  maxLength={500}
                  rows={3}
                  onChange={e =>
                    setEditForm(prev => ({
                      ...prev,
                      rejectionNote: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPostId(null)}>
              Annuler
            </Button>
            <Button
              onClick={submitEdit}
              disabled={isLoadingPostToEdit || updatePost.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
