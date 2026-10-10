import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import * as hub from "@/features/hub/api";

const MAX_PHOTOS = 4;

export default function MyPhotosPanel() {
  const { lang } = useI18n();
  const [photos, setPhotos] = useState<hub.Photo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  const load = useCallback(async () => {
    try {
      setPhotos(await hub.getMyPhotos());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const all = [...files, ...Array.from(list)].filter(f => f.type.startsWith("image/"));
    if (all.length > MAX_PHOTOS) toast.info("4 photos maximum");
    setFiles(all.slice(0, MAX_PHOTOS));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await hub.uploadSiteImage(f));
      await hub.createPost(caption.trim() || "Nouvelles photos", paths, true);
      toast.success("Photos partagées avec la communauté");
      setCaption("");
      setFiles([]);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p className="rounded-md bg-stone-100 p-3 text-sm text-stone-600">{loadError}</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={2000} rows={2} aria-label="Légende" placeholder="Légende (facultatif)" />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative h-20 w-20">
                <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => pick(e.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={files.length >= MAX_PHOTOS || busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={18} className="mr-1.5" /> Photo{files.length > 0 ? ` (${files.length}/${MAX_PHOTOS})` : ""}
          </Button>
          <Button type="button" onClick={submit} disabled={busy || !files.length}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Partager"}
          </Button>
        </div>
      </div>

      {photos === null ? (
        <Loader2 className="animate-spin text-stone-400" />
      ) : photos.length === 0 ? (
        <p className="text-sm text-stone-500">Aucune photo partagée pour le moment.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.filter(p => p.url).map(p => (
            <img key={p.path} src={p.url!} alt="Photo partagée" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </div>
      )}

      <Link href={`/${lang}/benevole/espace`} className="text-sm text-blue-700 underline">Voir le fil de l'espace bénévole</Link>
    </div>
  );
}
