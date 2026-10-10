import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as hub from "../../api";
import Avatar from "../../components/Avatar";
import * as api from "../pro-api";

const MAX_PHOTOS = 4;

export default function ProComposer({ me, onPosted }: { me: hub.Member; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const all = [...files, ...Array.from(list)].filter(f => f.type.startsWith("image/"));
    if (all.length > MAX_PHOTOS) toast.info("4 photos maximum");
    setFiles(all.slice(0, MAX_PHOTOS));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const media = await Promise.all(files.map(hub.uploadImage));
      await api.createPost({ body, link: link.trim(), media });
      setBody(""); setLink(""); setShowLink(false); setFiles([]);
      onPosted();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <Avatar name={me.display_name} src={me.avatar} size={40} />
        <Textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={2} aria-label="Votre publication"
          placeholder="Partagez une actualité, une réussite, une question…" className="min-h-[3rem] flex-1 resize-none rounded-2xl border-0 bg-slate-100 focus-visible:ring-2" />
      </div>
      {showLink && <Input aria-label="Lien" className="mt-3" type="url" inputMode="url" maxLength={300} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={f.name + i} className="relative h-20 w-20">
              <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
        <div className="flex gap-1">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={e => pick(e.target.files)} />
          <Button type="button" variant="ghost" size="sm" disabled={files.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}><ImagePlus size={18} className="mr-1.5" />Photo</Button>
          <Button type="button" variant="ghost" size="sm" aria-pressed={showLink} onClick={() => setShowLink(!showLink)}><Link2 size={18} className="mr-1.5" />Lien</Button>
        </div>
        <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Publier"}
        </Button>
      </div>
    </div>
  );
}
