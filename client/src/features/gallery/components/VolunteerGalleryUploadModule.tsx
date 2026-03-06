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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

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
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("none");
  const [validationEmail, setValidationEmail] = useState("");
  const albums = trpc.public.galleryAlbums.useQuery();

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
    onSuccess: () => {
      toast.success(
        "Vos photos sont enregistrées. Vérifiez votre email pour valider la publication sur la galerie."
      );
      setItems([]);
      setValidationEmail("");
      // Reset album selection to trigger auto-select of current year
      setSelectedAlbumId("none");
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
    const normalizedEmail = validationEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Merci de renseigner votre adresse email.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      toast.error("Adresse email invalide.");
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

    await upload.mutateAsync({
      validationEmail: validationEmail.trim().toLowerCase(),
      photos,
    });
  };

  const totalSize = useMemo(
    () => items.reduce((acc, i) => acc + i.file.size, 0),
    [items]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajoutez vos photos du Ftour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Les photos envoyées par les bénévoles sont publiées après
            validation.
          </p>

          <div className="space-y-2">
            <Label htmlFor="volunteer-gallery-email">Adresse email de validation</Label>
            <Input
              id="volunteer-gallery-email"
              type="email"
              placeholder="vous@exemple.com"
              value={validationEmail}
              onChange={e => setValidationEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Un email de confirmation vous sera envoyé avec un lien pour autoriser l'affichage public des photos.
            </p>
          </div>

          <Label htmlFor="volunteer-gallery-files">
            Photos (jpeg, png, webp, max 8MB)
          </Label>
          <Input
            id="volunteer-gallery-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={e => onFiles(e.target.files)}
          />
          <div className="text-sm text-muted-foreground">
            {items.length} fichier(s) · {(totalSize / (1024 * 1024)).toFixed(2)}{" "}
            MB
          </div>

          <div className="space-y-2">
            <Label>Édition (album)</Label>
            <Select value={selectedAlbumId} onValueChange={setSelectedAlbumId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une édition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Choisir une édition —</SelectItem>
                {(() => {
                  const recentEditions = editionOptions.filter(
                    e => e.year !== null && e.year >= CURRENT_YEAR - 2
                  );
                  const olderEditions = editionOptions.filter(
                    e => e.year === null || e.year < CURRENT_YEAR - 2
                  );
                  return (
                    <>
                      {recentEditions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Éditions récentes</SelectLabel>
                          {recentEditions.map(edition => (
                            <SelectItem key={edition.id} value={edition.id}>
                              {edition.label}
                              {edition.year === CURRENT_YEAR ? " (en cours)" : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {olderEditions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Anciennes éditions</SelectLabel>
                          {olderEditions.map(edition => (
                            <SelectItem key={edition.id} value={edition.id}>
                              {edition.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </>
                  );
                })()}
              </SelectContent>
            </Select>
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

      <Button
        onClick={submit}
        disabled={items.length === 0 || upload.isPending || !validationEmail.trim()}
      >
        <Upload className="h-4 w-4 mr-2" />
        Envoyer {items.length} photo(s)
      </Button>
    </div>
  );
}
