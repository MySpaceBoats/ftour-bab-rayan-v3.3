import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FileItem = {
  file: File;
  preview: string;
  progress: number;
  compressed?: string; // base64 data URL after compression
};

const MAX_FILES = 10;
const MAX_SIZE_MB = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COMPRESS_MAX_PX = 1920;
const COMPRESS_QUALITY = 0.82;

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > COMPRESS_MAX_PX || height > COMPRESS_MAX_PX) {
        const ratio = Math.min(COMPRESS_MAX_PX / width, COMPRESS_MAX_PX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(mimeType, COMPRESS_QUALITY));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface Props {
  onClose?: () => void;
}

export default function PublicGalleryUpload({ onClose }: Props) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const albums = trpc.public.galleryAlbums.useQuery();

  const yearAlbums = useMemo(() => {
    return (albums.data ?? [])
      .map((a: any) => {
        const m = /^edition-(\d{4})$/.exec(a.slug ?? "");
        return m ? { year: parseInt(m[1], 10), id: a.id } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.year - a.year) as { year: number; id: string }[];
  }, [albums.data]);

  useEffect(() => {
    if (!selectedYear && yearAlbums.length > 0) {
      const now = new Date().getFullYear();
      const cur = yearAlbums.find(a => a.year === now) ?? yearAlbums[0];
      setSelectedYear(cur.year);
    }
  }, [yearAlbums, selectedYear]);

  const upload = trpc.gallery.publicUpload.useMutation({
    onSuccess: () => setDone(true),
    onError: e => toast.error(e.message),
  });

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const accepted: FileItem[] = [];

    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Format non supporté : ${file.name}`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`Trop volumineux (>${MAX_SIZE_MB}MB) : ${file.name}`);
        continue;
      }
      if (items.length + accepted.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} photos par envoi`);
        break;
      }
      accepted.push({ file, preview: URL.createObjectURL(file), progress: 0 });
    }
    setItems(prev => [...prev, ...accepted]);
  }, [items.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeItem = (idx: number) => {
    setItems(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const submit = async () => {
    if (items.length === 0) return;

    const albumEntry = yearAlbums.find(a => a.year === selectedYear);
    const albumId = albumEntry?.id;

    const photos: any[] = [];
    for (let i = 0; i < items.length; i++) {
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 10 } : it));
      let compressed: string;
      try {
        compressed = await compressImage(items[i].file);
      } catch {
        // Fall back to raw base64 if compression fails
        compressed = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(items[i].file);
        });
      }
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 80 } : it));
      photos.push({
        fileName: items[i].file.name,
        fileType: items[i].file.type,
        fileData: compressed,
        albumId,
        eventDate: selectedYear ? String(selectedYear) : undefined,
      });
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 100 } : it));
    }

    try {
      await upload.mutateAsync({ photos });
    } catch {
      // error handled by onError
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <div>
          <p className="text-lg font-semibold">Photos reçues, merci !</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vos photos seront visibles après validation par notre équipe.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { setDone(false); setItems([]); }}>
            <Upload className="h-4 w-4 mr-2" />
            Envoyer d'autres photos
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>Fermer</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
        )}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => addFiles(e.target.files)}
          disabled={upload.isPending}
        />
        <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium">Glissez vos photos ici</p>
        <p className="text-sm text-muted-foreground mt-1">
          ou cliquez pour parcourir — JPEG, PNG, WebP · max {MAX_SIZE_MB}MB · {MAX_FILES} photos
        </p>
      </div>

      {/* Edition selector */}
      {yearAlbums.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium shrink-0">Édition :</span>
          <Select
            value={selectedYear ? String(selectedYear) : ""}
            onValueChange={v => setSelectedYear(parseInt(v, 10))}
            disabled={upload.isPending}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Choisir l'édition" />
            </SelectTrigger>
            <SelectContent>
              {yearAlbums.map(({ year }) => (
                <SelectItem key={year} value={String(year)}>
                  Édition {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Preview grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, idx) => (
            <div key={`${item.file.name}-${idx}`} className="relative group rounded-lg overflow-hidden bg-muted">
              <img
                src={item.preview}
                alt={item.file.name}
                className="h-32 w-full object-cover"
              />
              {item.progress > 0 && item.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 p-1">
                  <Progress value={item.progress} className="h-1" />
                </div>
              )}
              {!upload.isPending && (
                <button
                  onClick={() => removeItem(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Retirer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {upload.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Compression et envoi en cours…
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={submit}
          disabled={items.length === 0 || upload.isPending}
          className="flex-1 sm:flex-none"
        >
          {upload.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi…</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />
            {items.length === 0 ? "Sélectionnez des photos" : `Envoyer ${items.length} photo${items.length > 1 ? "s" : ""}`}</>
          )}
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose} disabled={upload.isPending}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
