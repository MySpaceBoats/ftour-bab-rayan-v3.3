import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";

type StatusTab = "draft" | "published" | "rejected";

export default function AdminGalerie() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("draft");
  const [albumId, setAlbumId] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<"publish" | "reject" | "delete" | null>(null);

  const { data: albums } = trpc.gallery.listAlbums.useQuery();
  const sortedAlbums = useMemo(
    () => [...(albums ?? [])].sort((a: any, b: any) => (b.sort_order ?? 0) - (a.sort_order ?? 0)),
    [albums]
  );

  const makeFilters = (status: StatusTab) => ({
    page,
    pageSize: 12,
    search: search || undefined,
    status,
    albumId: albumId === "all" ? undefined : albumId,
  });

  const queryDraft = trpc.gallery.listPhotos.useQuery(makeFilters("draft"));
  const queryPublished = trpc.gallery.listPhotos.useQuery(makeFilters("published"));
  const queryRejected = trpc.gallery.listPhotos.useQuery(makeFilters("rejected"));

  const activeQuery =
    statusTab === "draft" ? queryDraft :
    statusTab === "published" ? queryPublished :
    queryRejected;

  const utils = trpc.useUtils();
  const invalidateAll = () => {
    utils.gallery.listPhotos.invalidate();
  };

  const del = trpc.gallery.deletePhoto.useMutation({
    onSuccess: () => { toast.success("Photo supprimée"); invalidateAll(); },
    onError: e => toast.error(e.message),
  });
  const publish = trpc.gallery.publish.useMutation({
    onSuccess: () => { toast.success("Photo approuvée"); invalidateAll(); },
    onError: e => toast.error(e.message),
  });
  const unpublish = trpc.gallery.unpublish.useMutation({
    onSuccess: () => { toast.success("Photo retirée"); invalidateAll(); },
    onError: e => toast.error(e.message),
  });
  const reject = trpc.gallery.reject.useMutation({
    onSuccess: () => { toast.success("Photo refusée"); invalidateAll(); },
    onError: e => toast.error(e.message),
  });
  const bulk = trpc.gallery.bulkAction.useMutation({
    onSuccess: (d) => {
      toast.success(`${d.count} photo(s) traitée(s)`);
      setSelected(new Set());
      setBulkConfirm(null);
      invalidateAll();
    },
    onError: e => { toast.error(e.message); setBulkConfirm(null); },
  });

  const totalPages = Math.max(1, Math.ceil((activeQuery.data?.total ?? 0) / 12));
  const items = activeQuery.data?.items ?? [];

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(items.map((i: any) => i.id)));
  const clearSelection = () => setSelected(new Set());

  const pendingCount = queryDraft.data?.total ?? 0;

  const statusLabel: Record<StatusTab, string> = {
    draft: "En attente",
    published: "Approuvées",
    rejected: "Refusées",
  };

  const lightboxList = items;
  const lightboxIdx = lightboxPhoto ? lightboxList.findIndex((p: any) => p.id === lightboxPhoto.id) : -1;

  const prevPhoto = () => {
    if (lightboxIdx > 0) setLightboxPhoto(lightboxList[lightboxIdx - 1]);
  };
  const nextPhoto = () => {
    if (lightboxIdx < lightboxList.length - 1) setLightboxPhoto(lightboxList[lightboxIdx + 1]);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Galerie photo</h1>
          </div>
          <Link href="/admin/galerie/nouveau">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau
            </Button>
          </Link>
        </div>

        {/* Status tabs */}
        <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v as StatusTab); setPage(1); setSelected(new Set()); }}>
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
            <TabsTrigger value="draft" className="flex items-center gap-2">
              En attente
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[1.25rem]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="published">Approuvées</TabsTrigger>
            <TabsTrigger value="rejected">Refusées</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtres — {statusLabel[statusTab]}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Recherche…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={albumId} onValueChange={v => { setAlbumId(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Album" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les albums</SelectItem>
                {sortedAlbums.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
            <div className="flex flex-wrap gap-2 ml-auto">
              {statusTab !== "published" && (
                <Button size="sm" onClick={() => setBulkConfirm("publish")}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approuver
                </Button>
              )}
              {statusTab !== "rejected" && (
                <Button size="sm" variant="outline" onClick={() => setBulkConfirm("reject")}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Refuser
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => setBulkConfirm("delete")}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Supprimer
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {activeQuery.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Erreur : {activeQuery.error?.message}
          </div>
        )}

        {/* Select all row */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={selected.size === items.length}
              onCheckedChange={checked => checked ? selectAll() : clearSelection()}
              aria-label="Tout sélectionner"
            />
            <span className="text-muted-foreground">Tout sélectionner</span>
          </div>
        )}

        {/* Photo grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {activeQuery.isLoading && (
            <div className="col-span-full flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!activeQuery.isLoading && items.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
              Aucune photo dans cet onglet.
            </p>
          )}
          {items.map((item: any) => (
            <Card
              key={item.id}
              className={selected.has(item.id) ? "ring-2 ring-primary" : ""}
            >
              <CardContent className="p-3 space-y-3">
                <div className="relative group">
                  <img
                    src={item.image_thumb_url ?? item.image_medium_url ?? item.image_original_url ?? undefined}
                    alt={item.title || "photo"}
                    className="h-44 w-full rounded object-cover bg-muted cursor-pointer"
                    loading="lazy"
                    onClick={() => setLightboxPhoto(item)}
                    onError={e => {
                      const img = e.currentTarget;
                      const m = item.image_medium_url;
                      const o = item.image_original_url;
                      if (img.src !== m && m) { img.src = m; return; }
                      if (img.src !== o && o) { img.src = o; return; }
                      img.style.display = "none";
                    }}
                  />
                  <button
                    onClick={() => setLightboxPhoto(item)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded opacity-0 group-hover:opacity-100"
                    aria-label="Voir en grand"
                  >
                    <ZoomIn className="h-6 w-6 text-white" />
                  </button>
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="absolute top-2 left-2 bg-white/90"
                    aria-label="Sélectionner"
                  />
                </div>

                <div className="space-y-1">
                  <p className="font-medium line-clamp-1 text-sm">
                    {item.title || "Sans titre"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={
                        item.status === "published" ? "default" :
                        item.status === "rejected" ? "destructive" :
                        "secondary"
                      }
                    >
                      {item.status === "published" ? "Approuvée" :
                       item.status === "rejected" ? "Refusée" :
                       "En attente"}
                    </Badge>
                    {item.is_featured && <Star className="h-3 w-3 text-amber-500" />}
                    {item.uploaded_by && (
                      <span className="truncate max-w-[80px]" title={item.uploaded_by}>
                        {item.uploaded_by}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/admin/galerie/${item.id}`}>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      Modifier
                    </Button>
                  </Link>
                  {item.status !== "published" ? (
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => publish.mutate({ id: item.id })}
                      disabled={publish.isPending}
                    >
                      Approuver
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => unpublish.mutate({ id: item.id })}
                      disabled={unpublish.isPending}
                    >
                      Retirer
                    </Button>
                  )}
                </div>

                {item.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => reject.mutate({ id: item.id })}
                    disabled={reject.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Refuser
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="w-full text-xs" disabled={del.isPending}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la photo ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => del.mutate({ id: item.id })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page}/{totalPages} · {activeQuery.data?.total ?? 0} photo(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Photo zoom lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={open => !open && setLightboxPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black border-0 overflow-hidden">
          {lightboxPhoto && (
            <div className="relative flex items-center justify-center min-h-[60vh]">
              <img
                src={lightboxPhoto.image_medium_url || lightboxPhoto.image_original_url}
                alt={lightboxPhoto.title || "photo"}
                className="max-h-[80vh] max-w-full object-contain"
              />
              <button
                onClick={() => setLightboxPhoto(null)}
                className="absolute top-3 right-3 text-white bg-black/50 rounded-full p-1.5 hover:bg-black/80"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
              {lightboxIdx > 0 && (
                <button
                  onClick={prevPhoto}
                  className="absolute left-3 text-white bg-black/50 rounded-full p-2 hover:bg-black/80"
                  aria-label="Précédent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {lightboxIdx < lightboxList.length - 1 && (
                <button
                  onClick={nextPhoto}
                  className="absolute right-3 text-white bg-black/50 rounded-full p-2 hover:bg-black/80"
                  aria-label="Suivant"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              {lightboxPhoto.title && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm px-4 py-2">
                  <p className="font-medium">{lightboxPhoto.title}</p>
                  {lightboxPhoto.description && (
                    <p className="text-white/70 text-xs mt-0.5">{lightboxPhoto.description}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk action confirmation */}
      <AlertDialog open={!!bulkConfirm} onOpenChange={open => !open && setBulkConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkConfirm === "publish" && `Approuver ${selected.size} photo(s) ?`}
              {bulkConfirm === "reject" && `Refuser ${selected.size} photo(s) ?`}
              {bulkConfirm === "delete" && `Supprimer ${selected.size} photo(s) ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirm === "delete"
                ? "Cette action est irréversible. Les photos seront définitivement supprimées."
                : "Vous pourrez modifier ce statut ultérieurement."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkConfirm(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkConfirm && bulk.mutate({ ids: Array.from(selected), action: bulkConfirm })}
              disabled={bulk.isPending}
              className={bulkConfirm === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
