import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, Star, Trash2 } from "lucide-react";

export default function AdminGalerie() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    "all" | "draft" | "published" | "rejected"
  >("all");
  const [featured, setFeatured] = useState<"all" | "true" | "false">("all");

  const filters = useMemo(
    () => ({
      page,
      pageSize: 12,
      search: search || undefined,
      status: status === "all" ? undefined : status,
      featured: featured === "all" ? undefined : featured === "true",
    }),
    [page, search, status, featured]
  );

  const query = trpc.gallery.listPhotos.useQuery(filters);
  const utils = trpc.useUtils();

  const del = trpc.gallery.deletePhoto.useMutation({
    onSuccess: async () => {
      toast.success("Photo supprimée");
      await utils.gallery.listPhotos.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const togglePublish = trpc.gallery.publish.useMutation({
    onSuccess: async () => {
      toast.success("Statut mis à jour");
      await utils.gallery.listPhotos.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const toggleUnpublish = trpc.gallery.unpublish.useMutation({
    onSuccess: async () => {
      toast.success("Statut mis à jour");
      await utils.gallery.listPhotos.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const toggleReject = trpc.gallery.reject.useMutation({
    onSuccess: async () => {
      toast.success("Photo refusée");
      await utils.gallery.listPhotos.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 12));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Recherche"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="published">Publié</SelectItem>
                <SelectItem value="rejected">Refusé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={featured} onValueChange={(v: any) => setFeatured(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Mise en avant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="true">Featured</SelectItem>
                <SelectItem value="false">Non featured</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {query.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Erreur lors du chargement des photos : {query.error?.message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {query.isLoading && (
            <p className="col-span-full text-sm text-muted-foreground">Chargement…</p>
          )}
          {!query.isLoading && !query.isError && query.data?.items?.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Aucune photo trouvée.</p>
          )}
          {query.data?.items?.map((item: any) => (
            <Card key={item.id}>
              <CardContent className="p-3 space-y-3">
                <img
                  src={item.image_thumb_url ?? item.image_medium_url ?? item.image_original_url ?? undefined}
                  alt={item.title || "photo"}
                  className="h-44 w-full rounded object-cover bg-muted"
                  loading="lazy"
                  onError={e => {
                    const img = e.currentTarget;
                    const original = item.image_original_url ?? undefined;
                    const medium = item.image_medium_url ?? undefined;

                    if (img.src !== medium && medium) {
                      img.src = medium;
                      return;
                    }

                    if (img.src !== original && original) {
                      img.src = original;
                      return;
                    }

                    img.style.display = "none";
                  }}
                />
                <div className="space-y-1">
                  <p className="font-medium line-clamp-1">
                    {item.title || "Sans titre"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={
                        item.status === "published" ? "default" : "secondary"
                      }
                    >
                      {item.status === "published"
                        ? "Validée"
                        : item.status === "rejected"
                          ? "Refusée"
                          : "En attente"}
                    </Badge>
                    {item.is_featured && (
                      <Star className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </div>
                <div
                  className={`grid gap-2 ${
                    item.status === "published" ? "grid-cols-2" : "grid-cols-3"
                  }`}
                >
                  <Link href={`/admin/galerie/${item.id}`}>
                    <Button size="sm" variant="outline" className="w-full">
                      Modifier
                    </Button>
                  </Link>
                  {item.status === "published" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => toggleUnpublish.mutate({ id: item.id })}
                    >
                      Retirer
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => togglePublish.mutate({ id: item.id })}
                      >
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => toggleReject.mutate({ id: item.id })}
                      >
                        Refuser
                      </Button>
                    </>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la photo ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. La photo sera définitivement supprimée du stockage et de la galerie.
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

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
