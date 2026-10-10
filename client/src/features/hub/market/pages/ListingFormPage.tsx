import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import { useHubMember } from "../../useHubMember";
import * as hub from "../../api";
import * as mk from "../market-api";
import { CATEGORIES, CONDITIONS } from "../format";

const MAX = 4;
const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

interface Kept { key: string; url: string | null }

export default function ListingFormPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/:lang/benevole/espace/marketplace/:id/modifier");
  const editId = match ? Number(params?.id) : null;
  const base = `/${lang}/benevole/espace/marketplace`;
  const [f, setF] = useState({ title: "", description: "", price: "", category: "autre", condition: "bon", city: "", phone: "", whatsapp: false });
  const [kept, setKept] = useState<Kept[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(editId === null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map(x => URL.createObjectURL(x)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    if (!me || editId === null) return;
    mk.getListing(editId).then(l => {
      if (!l.mine) { setLocation(base); return; }
      setF({ title: l.title, description: l.description, price: String(l.price), category: l.category, condition: l.condition, city: l.city, phone: l.contact?.phone ?? "", whatsapp: l.contact?.whatsapp ?? false });
      setKept((l.media_keys ?? []).map((key, i) => ({ key, url: l.media[i] ?? null })));
      setReady(true);
    }).catch(() => setLocation(base));
  }, [me, editId, base, setLocation]);

  if (!me || !ready) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  const total = kept.length + files.length;

  const pick = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(x => x.type.startsWith("image/"));
    if (kept.length + files.length + imgs.length > MAX) toast.info("4 photos maximum");
    setFiles(prev => [...prev, ...imgs].slice(0, MAX - kept.length));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(f.price);
    if (!Number.isSafeInteger(priceNum) || priceNum < 0) { toast.error("Prix invalide (nombre entier en MAD, 0 = gratuit)"); return; }
    setBusy(true);
    try {
      const uploaded = await Promise.all(files.map(hub.uploadImage));
      const body: mk.ListingForm = { ...f, price: priceNum, media: [...kept.map(k => k.key), ...uploaded] };
      if (editId === null) { const r = await mk.createListing(body); setLocation(`${base}/${r.id}`); }
      else { await mk.updateListing(editId, body); setLocation(`${base}/${editId}`); }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HubShell me={me}>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{editId === null ? "Vendre un objet" : "Modifier l'annonce"}</h1>
        <Input aria-label="Titre" required maxLength={80} value={f.title} onChange={set("title")} placeholder="Titre (ex. Vélo enfant 6-8 ans)" />
        <Textarea aria-label="Description" required maxLength={2000} rows={5} value={f.description} onChange={set("description")} placeholder="Décrivez l'objet : état, taille, raison de la vente…" />
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label="Prix en MAD" required inputMode="numeric" value={f.price} onChange={set("price")} placeholder="Prix en MAD (0 = gratuit)" />
          <Input aria-label="Ville" maxLength={60} value={f.city} onChange={set("city")} placeholder="Ville" />
          <select aria-label="Catégorie" className={select} value={f.category} onChange={set("category")}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select aria-label="État" className={select} value={f.condition} onChange={set("condition")}>{CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
        <div className="space-y-2">
          <Input aria-label="Téléphone (facultatif)" value={f.phone} onChange={set("phone")} placeholder="Téléphone (facultatif) — format +212…" />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.whatsapp} onChange={e => setF(p => ({ ...p, whatsapp: e.target.checked }))} /> Joignable sur WhatsApp (numéro au format international)</label>
          <p className="text-xs text-slate-500">Votre numéro sera visible des autres membres de l'espace bénévole.</p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {kept.map(k => (
              <div key={k.key} className="relative h-20 w-20">
                {k.url ? <img src={k.url} alt="" className="h-20 w-20 rounded-lg object-cover" /> : <div className="h-20 w-20 rounded-lg bg-slate-200" />}
                <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setKept(kept.filter(x => x.key !== k.key))}><X size={14} /></button>
              </div>
            ))}
            {files.map((x, i) => (
              <div key={i} className="relative h-20 w-20">
                <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button>
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => pick(e.target.files)} />
          <Button type="button" variant="outline" disabled={total >= MAX} onClick={() => fileRef.current?.click()}><ImagePlus size={16} className="mr-2" /> Ajouter des photos ({total}/{MAX})</Button>
        </div>
        <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : editId === null ? "Publier l'annonce" : "Enregistrer"}</Button>
      </form>
    </HubShell>
  );
}
