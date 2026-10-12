import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VIDEO_TYPES, pickMedia } from "../media";
import * as hub from "../api";
import Avatar from "./Avatar";

const MAX_PHOTOS = 4;

export default function Composer({ me, onPosted }: { me: hub.Member; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const r = pickMedia(files, Array.from(list), MAX_PHOTOS);
    if (r.error) toast.error(r.error);
    else if (r.info) toast.info(r.info);
    setFiles(r.files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const paths = await Promise.all(files.map(hub.uploadMedia));
      await hub.createPost(body, paths);
      setBody("");
      setFiles([]);
      onPosted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const firstName = me.display_name.split(/\s+/)[0];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <Avatar name={me.display_name} src={me.avatar} size={40} />
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={2000}
          rows={2}
          aria-label="Votre message"
          placeholder={`Quoi de neuf, ${firstName} ?`}
          className="min-h-[3rem] flex-1 resize-none rounded-2xl border-0 bg-slate-100 focus-visible:ring-2"
        />
      </div>
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
          {files.map((f, i) => (
            <div key={i} className="relative h-20">
              {f.type.startsWith("video/")
                ? <video src={previews[i]} muted playsInline className="h-20 w-28 rounded-lg bg-black object-cover" />
                : <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />}
              <button type="button" aria-label="Retirer le média" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
        <input ref={fileRef} type="file" accept={`image/jpeg,image/png,image/webp,image/gif,${VIDEO_TYPES.join(",")}`} multiple hidden onChange={e => pick(e.target.files)} />
        <Button type="button" variant="ghost" size="sm" className="text-emerald-700 hover:bg-emerald-50" disabled={files.length >= MAX_PHOTOS || files.some(f => f.type.startsWith("video/"))} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={18} className="mr-1.5" /> Photo / vidéo{files.length > 0 ? ` (${files.length})` : ""}
        </Button>
        <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Publier"}
        </Button>
      </div>
    </div>
  );
}
