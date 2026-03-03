import { useMemo, useState } from "react";
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
import { Upload, X } from "lucide-react";

type UploadItem = {
  file: File;
  preview: string;
  progress: number;
};

export default function VolunteerGalleryUploadModule() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<string>("none");
  const albums = trpc.public.galleryAlbums.useQuery();
  const editionOptions = useMemo(
    () =>
      Array.from({ length: 2030 - 2015 + 1 }, (_, index) =>
        String(2015 + index)
      ),
    []
  );

  const albumIdByEdition = useMemo(() => {
    const map = new Map<string, string>();

    for (const album of albums.data ?? []) {
      const name = typeof album.name === "string" ? album.name : "";
      const slug = typeof album.slug === "string" ? album.slug : "";

      for (const edition of editionOptions) {
        if (name.includes(edition) || slug.includes(edition)) {
          map.set(edition, album.id);
        }
      }
    }

    return map;
  }, [albums.data, editionOptions]);

  const upload = trpc.gallery.uploadPhotos.useMutation({
    onSuccess: () => {
      toast.success(
        "Merci ! Vos photos ont bien été envoyées pour validation."
      );
      setItems([]);
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
    if (selectedEdition === "none") {
      toast.error("Merci de choisir l'édition (album) avant l'envoi.");
      return;
    }
    if (items.length === 0) return;
    const photos: any[] = [];

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
        eventDate: selectedEdition,
        albumId: albumIdByEdition.get(selectedEdition),
        sortOrder: 0,
        status: "draft",
        isFeatured: false,
      });
      setItems(prev =>
        prev.map((it, idx) => (idx === i ? { ...it, progress: 100 } : it))
      );
    }

    await upload.mutateAsync({ photos });
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
            <Select value={selectedEdition} onValueChange={setSelectedEdition}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une édition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choisir une édition</SelectItem>
                {editionOptions.map(edition => (
                  <SelectItem key={edition} value={edition}>
                    Édition {edition}
                  </SelectItem>
                ))}
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
        disabled={items.length === 0 || upload.isPending}
      >
        <Upload className="h-4 w-4 mr-2" />
        Envoyer {items.length} photo(s)
      </Button>
    </div>
  );
}
