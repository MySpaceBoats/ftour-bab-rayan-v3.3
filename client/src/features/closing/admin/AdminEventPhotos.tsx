import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  GripVertical,
} from "lucide-react";

// ============================================
// ADMIN EVENT PHOTOS
// ============================================

export default function AdminEventPhotos() {
  const utils = trpc.useUtils();
  const query = trpc.eventPhotos.list.useQuery();
  const photos = query.data ?? [];

  // ---- Upload state ----
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    await utils.eventPhotos.list.invalidate();
  };

  // ---- Mutations ----
  const createMutation = trpc.eventPhotos.create.useMutation({
    onSuccess: () => {
      toast.success("Photo ajoutée avec succès");
      setSelectedBase64(null);
      setPreviewUrl(null);
      setUploadTitle("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.eventPhotos.toggleActive.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateOrderMutation = trpc.eventPhotos.update.useMutation({
    onSuccess: () => {
      toast.success("Ordre mis à jour");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.eventPhotos.delete.useMutation({
    onSuccess: () => {
      toast.success("Photo supprimée");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  // ---- File selection ----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop grand (max 10 Mo)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setSelectedBase64(result);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  // ---- Upload submit ----
  const handleUpload = async () => {
    if (!selectedBase64) {
      toast.error("Sélectionnez une image");
      return;
    }
    setUploading(true);
    try {
      await createMutation.mutateAsync({
        imageBase64: selectedBase64,
        title: uploadTitle || undefined,
        displayOrder: photos.length,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Photos Événement</h1>
            <p className="text-sm text-muted-foreground">
              Gérez les photos du slider de la page de clôture Ramadan
            </p>
          </div>
        </div>

        {/* Upload card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Ajouter une photo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="photo-file">Image (JPG, PNG, WebP — max 10 Mo)</Label>
              <Input
                id="photo-file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />
            </div>

            {previewUrl && (
              <div className="relative w-40 h-32 rounded-lg overflow-hidden border">
                <img
                  src={previewUrl}
                  alt="Aperçu"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="photo-title">Titre (optionnel)</Label>
              <Input
                id="photo-title"
                placeholder="Ex: Soirée du 15ème jour"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedBase64 || uploading || createMutation.isPending}
            >
              {(uploading || createMutation.isPending) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours…</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Uploader la photo</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Photos list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Photos ({photos.length})
            </h2>
            {query.isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {!query.isLoading && photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border rounded-xl">
              <ImageIcon className="h-10 w-10 mb-3 opacity-30" />
              <p>Aucune photo pour le moment.</p>
              <p className="text-sm">Ajoutez des photos via le formulaire ci-dessus.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="flex items-center gap-4 rounded-xl border bg-card p-3 shadow-sm"
                >
                  {/* Drag handle (visual only) */}
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 cursor-grab" />

                  {/* Thumbnail */}
                  <div className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={photo.imageUrl}
                      alt={photo.title ?? "Photo"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {photo.title ?? <span className="text-muted-foreground italic">Sans titre</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={photo.isActive ? "default" : "secondary"}>
                        {photo.isActive ? "Actif" : "Inactif"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Ordre: {photo.displayOrder}
                      </span>
                    </div>
                  </div>

                  {/* Order input */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Label className="sr-only">Ordre</Label>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={photo.displayOrder}
                      className="w-16 h-8 text-sm"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val !== photo.displayOrder) {
                          updateOrderMutation.mutate({ id: photo.id, displayOrder: val });
                        }
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle active */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleMutation.mutate({ id: photo.id, isActive: !photo.isActive })}
                      title={photo.isActive ? "Désactiver" : "Activer"}
                    >
                      {photo.isActive ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette photo&nbsp;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. La photo sera définitivement supprimée du slider.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate({ id: photo.id })}
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview link */}
        {photos.length > 0 && (
          <div className="text-sm text-muted-foreground text-center pt-2">
            Prévisualisez la page de clôture en accédant à{" "}
            <a href="/" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              la homepage
            </a>.
          </div>
        )}
      </div>
    </div>
  );
}
