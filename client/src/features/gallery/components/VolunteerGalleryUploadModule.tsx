import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, Images, Loader2, Mail, Upload, X } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/_core/hooks/useAuth";

type UploadItem = {
  file: File;
  preview: string;
  progress: number;
};

type EditionAlbumOption = {
  id: string;
  label: string;
  year: number | null;
};

const CURRENT_YEAR = new Date().getFullYear();

export default function VolunteerGalleryUploadModule() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("none");
  const [uploadedAlbumSlug, setUploadedAlbumSlug] = useState<string | null>(null);
  const [needsEmailValidation, setNeedsEmailValidation] = useState(false);
  const albums = trpc.public.galleryAlbums.useQuery();
  const resendValidation = trpc.gallery.resendValidationEmail.useMutation({
    onSuccess: () => toast.success("Email de validation renvoyé !"),
    onError: e => toast.error(e.message),
  });

  const editionOptions = useMemo<EditionAlbumOption[]>(() => {
    const parseYear = (album: any) => {
      const fields = [
        typeof album?.name === "string" ? album.name : "",
        typeof album?.slug === "string" ? album.slug : "",
      ];
      const yearMatch = fields.join(" ").match(/\b(20\d{2}|19\d{2})\b/);
      return yearMatch ? Number(yearMatch[1]) : null;
    };

    return (albums.data ?? [])
      .map((album: any) => {
        const year = parseYear(album);
        return {
          id: album.id as string,
          label:
            typeof album?.name === "string" && album.name.trim().length > 0
              ? album.name
              : "Album sans titre",
          year,
          slug: album.slug as string,
        };
      })
      .sort((a, b) => {
        if (a.year && b.year) {
          return b.year - a.year;
        }
        if (a.year) return -1;
        if (b.year) return 1;
        return a.label.localeCompare(b.label, "fr");
      });
  }, [albums.data]);

  // Auto-select current year's album when albums load
  useEffect(() => {
    if (selectedAlbumId !== "none" || editionOptions.length === 0) return;
    const currentEdition = editionOptions.find(e => e.year === CURRENT_YEAR);
    if (currentEdition) {
      setSelectedAlbumId(currentEdition.id);
    }
  }, [editionOptions, selectedAlbumId]);

  const upload = trpc.gallery.uploadPhotos.useMutation({
    onSuccess: (data, variables) => {
      // Find the album slug for the gallery link
      const albumId = variables.photos[0]?.albumId;
      const album = (editionOptions as any[]).find((e: any) => e.id === albumId);
      setUploadedAlbumSlug(album?.slug ?? `edition-${CURRENT_YEAR}`);
      setNeedsEmailValidation(data.needsValidation);
      setItems([]);
      setSelectedAlbumId("none");
      if (data.needsValidation) {
        toast.success("Photos reçues ! Vérifiez votre email pour les publier.");
      } else {
        toast.success("Vos photos sont enregistrées et publiées.");
      }
    },
    onError: e => toast.error(e.message),
  });

  const onFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length > 20) return toast.error("Maximum 20 photos par lot");
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    const next: UploadItem[] = [];
    for (const file of files) {
      if (!allowed.includes(file.type)) {
        toast.error(`Format non supporté: ${file.name}`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`Trop volumineux (>8MB): ${file.name}`);
        continue;
      }
      next.push({
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
      });
    }
    setItems(prev => [...prev, ...next]);
  };

  const submit = async () => {
    if (selectedAlbumId === "none") {
      toast.error("Merci de choisir l'édition (album) avant l'envoi.");
      return;
    }
    if (items.length === 0) return;
    const photos: any[] = [];

    const selectedEdition = editionOptions.find(
      album => album.id === selectedAlbumId
    );

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = e => {
          const ratio = e.lengthComputable
            ? Math.round((e.loaded / e.total) * 100)
            : 30;
          setItems(prev =>
            prev.map((it, idx) => (idx === i ? { ...it, progress: ratio } : it))
          );
        };
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(item.file);
      });

      photos.push({
        fileName: item.file.name,
        fileType: item.file.type,
        fileData: dataUrl,
        eventDate: selectedEdition?.year
          ? String(selectedEdition.year)
          : undefined,
        albumId: selectedAlbumId,
        sortOrder: 0,
        status: "draft",
        isFeatured: false,
      });
      setItems(prev =>
        prev.map((it, idx) => (idx === i ? { ...it, progress: 100 } : it))
      );
    }

    try {
      await upload.mutateAsync({ photos });
    } catch {
      // Error already handled by onError callback
    }
  };

  const totalSize = useMemo(
    () => items.reduce((acc, i) => acc + i.file.size, 0),
    [items]
  );

  // Success state after upload
  if (uploadedAlbumSlug) {
    if (needsEmailValidation) {
      return (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900">Photos reçues – validation requise</h3>
                <p className="text-sm text-amber-800 mt-1">
                  Un email de confirmation a été envoyé à <strong>{user?.email}</strong>.
                  Cliquez sur le lien dans l'email pour publier vos photos sur la galerie.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (user?.email) resendValidation.mutate({ email: user.email });
                }}
                disabled={resendValidation.isPending}
              >
                {resendValidation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Renvoyer l'email
              </Button>
              <Button
                variant="outline"
                onClick={() => { setUploadedAlbumSlug(null); setNeedsEmailValidation(false); }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Uploader d'autres photos
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">Photos publiées avec succès !</h3>
              <p className="text-sm text-green-700 mt-1">
                Vos photos sont maintenant visibles dans la galerie.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${lang}/galerie`}>
              <Button>
                <Images className="h-4 w-4 mr-2" />
                Voir la galerie
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => setUploadedAlbumSlug(null)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Uploader d'autres photos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajoutez vos photos du Ftour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="volunteer-gallery-files">
            Photos (jpeg, png, webp, max 8MB)
          </Label>
          <Input
            id="volunteer-gallery-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={upload.isPending}
            onChange={e => onFiles(e.target.files)}
          />
          <div className="text-sm text-muted-foreground">
            {items.length} fichier(s) · {(totalSize / (1024 * 1024)).toFixed(2)}{" "}
            MB
          </div>

          <div className="space-y-2">
            <Label>Édition (album)</Label>
            {albums.isLoading ? (
              <div className="h-9 flex items-center px-3 border rounded-md text-sm text-muted-foreground bg-muted/30">
                Chargement des éditions…
              </div>
            ) : albums.isError ? (
              <div className="h-9 flex items-center px-3 border border-destructive/50 rounded-md text-sm text-destructive">
                Impossible de charger les éditions
              </div>
            ) : (
              <Select
                value={selectedAlbumId}
                onValueChange={setSelectedAlbumId}
                disabled={upload.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une édition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Choisir une édition —</SelectItem>
                  {editionOptions
                    .filter(e => e.year !== null && e.year <= CURRENT_YEAR)
                    .map(edition => (
                      <SelectItem key={edition.id} value={edition.id}>
                        {edition.label}
                        {edition.year === CURRENT_YEAR ? " (en cours)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => (
          <Card key={`${item.file.name}-${idx}`}>
            <CardContent className="p-3 space-y-2">
              <img
                src={item.preview}
                alt={item.file.name}
                className="h-40 w-full rounded object-cover"
              />
              <Progress value={item.progress} />
              <Button
                variant="outline"
                className="w-full"
                disabled={upload.isPending}
                onClick={() =>
                  setItems(prev => prev.filter((_, i) => i !== idx))
                }
              >
                <X className="h-4 w-4 mr-2" />
                Retirer
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {upload.isPending && (
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Upload en cours, merci de patienter…</span>
        </div>
      )}

      <Button
        onClick={submit}
        disabled={items.length === 0 || upload.isPending}
      >
        {upload.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {items.length === 0
              ? "Sélectionnez des photos"
              : `Envoyer ${items.length} photo(s)`}
          </>
        )}
      </Button>
    </div>
  );
}
