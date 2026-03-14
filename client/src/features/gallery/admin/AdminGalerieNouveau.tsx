import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Upload, X } from "lucide-react";

type Item = {
  file: File;
  preview: string;
  progress: number;
  tags?: string;
  yearOrEdition?: string;
  sortOrder: number;
  status: "draft" | "published" | "rejected";
  isFeatured: boolean;
};

const YEAR_RE = /\b(20\d{2}|19\d{2})\b/;

export default function AdminGalerieNouveau() {
  const [items, setItems] = useState<Item[]>([]);
  const { data: albums, isLoading: albumsLoading } = trpc.gallery.listAlbums.useQuery();
  const [albumId, setAlbumId] = useState<string>("none");

  const { editionAlbums, generalAlbums } = useMemo(() => {
    const all = albums ?? [];
    const editions = all
      .filter((a: any) => YEAR_RE.test(String(a.name ?? "") + " " + String(a.slug ?? "")))
      .sort((a: any, b: any) => (b.sort_order ?? 0) - (a.sort_order ?? 0));
    const general = all.filter(
      (a: any) => !YEAR_RE.test(String(a.name ?? "") + " " + String(a.slug ?? ""))
    );
    return { editionAlbums: editions, generalAlbums: general };
  }, [albums]);

  // Auto-select the current year's edition album when albums are loaded
  useEffect(() => {
    if (albumId !== "none") return;
    const currentYear = new Date().getFullYear();
    const currentYearAlbum = (albums ?? []).find(
      (a: any) => a.slug === `edition-${currentYear}`
    );
    if (currentYearAlbum?.id) setAlbumId(currentYearAlbum.id);
  }, [albums, albumId]);
  const upload = trpc.gallery.uploadPhotos.useMutation({
    onSuccess: () => toast.success("Upload terminé"),
    onError: e => toast.error(e.message),
  });

  const onFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length > 20) return toast.error("Maximum 20 photos par lot");
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    const next: Item[] = [];
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
        sortOrder: 0,
        status: "published",
        isFeatured: false,
      });
    }
    setItems(prev => [...prev, ...next]);
  };

  const submit = async () => {
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
        eventDate: item.yearOrEdition,
        tags: item.tags
          ? item.tags
              .split(",")
              .map(t => t.trim())
              .filter(Boolean)
          : [],
        albumId: albumId === "none" ? null : albumId,
        sortOrder: item.sortOrder,
        status: item.status,
        isFeatured: item.isFeatured,
      });
      setItems(prev =>
        prev.map((it, idx) => (idx === i ? { ...it, progress: 100 } : it))
      );
    }

    await upload.mutateAsync({ photos });
    setItems([]);
  };

  const totalSize = useMemo(
    () => items.reduce((acc, i) => acc + i.file.size, 0),
    [items]
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/galerie">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Nouvel upload galerie</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dropzone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label htmlFor="files">Photos (jpeg, png, webp, max 8MB)</Label>
            <Input
              id="files"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={e => onFiles(e.target.files)}
            />
            <div className="text-sm text-muted-foreground">
              {items.length} fichier(s) ·{" "}
              {(totalSize / (1024 * 1024)).toFixed(2)} MB
            </div>
            <div className="max-w-xs">
              <Label>Album / Édition</Label>
              {albumsLoading ? (
                <div className="h-9 flex items-center px-3 border rounded-md text-sm text-muted-foreground bg-muted/30">
                  Chargement des albums…
                </div>
              ) : (
                <Select value={albumId} onValueChange={setAlbumId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun album" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {editionAlbums.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Éditions par année</SelectLabel>
                        {editionAlbums.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {generalAlbums.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Albums généraux</SelectLabel>
                        {generalAlbums.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
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
                <div className="text-xs text-muted-foreground">
                  {item.file.type} · {(item.file.size / 1024).toFixed(1)} Ko
                </div>
                <Progress value={item.progress} />
                <Input
                  placeholder="Tags (virgule)"
                  value={item.tags ?? ""}
                  onChange={e =>
                    setItems(prev =>
                      prev.map((it, i) =>
                        i === idx ? { ...it, tags: e.target.value } : it
                      )
                    )
                  }
                />
                <Input
                  placeholder="Année xxxx ou édition xxxx"
                  value={item.yearOrEdition ?? ""}
                  onChange={e =>
                    setItems(prev =>
                      prev.map((it, i) =>
                        i === idx
                          ? { ...it, yearOrEdition: e.target.value }
                          : it
                      )
                    )
                  }
                />
                <div className="flex items-center justify-between text-sm">
                  <span>Featured</span>
                  <Switch
                    checked={item.isFeatured}
                    onCheckedChange={v =>
                      setItems(prev =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, isFeatured: v } : it
                        )
                      )
                    }
                  />
                </div>
                <Select
                  value={item.status}
                  onValueChange={(v: "draft" | "published" | "rejected") =>
                    setItems(prev =>
                      prev.map((it, i) =>
                        i === idx ? { ...it, status: v } : it
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">En attente</SelectItem>
                    <SelectItem value="published">Validée</SelectItem>
                    <SelectItem value="rejected">Refusée</SelectItem>
                  </SelectContent>
                </Select>
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
          Uploader {items.length} photo(s)
        </Button>
      </div>
    </div>
  );
}
