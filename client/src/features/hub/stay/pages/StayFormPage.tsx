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
import * as st from "../stay-api";
import { AMENITIES, KINDS, PRICE_TYPES } from "../format";

const MAX = 6;
const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

interface Kept { key: string; url: string | null }

export default function StayFormPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/:lang/benevole/espace/hebergement/:id/modifier");
  const editId = match ? Number(params?.id) : null;
  const base = `/${lang}/benevole/espace/hebergement`;
  const [f, setF] = useState({ title: "", description: "", kind: "chambre", city: "", area: "", capacity: "1", rooms: "1", priceType: "gratuit", price: "", availableFrom: "", availableTo: "", phone: "", whatsapp: false });
  const [amenities, setAmenities] = useState<string[]>(["wifi"]);
  const [kept, setKept] = useState<Kept[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(editId === null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map(x => URL.createObjectURL(x)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    if (!me || editId === null) return;
    st.getStay(editId).then(l => {
      if (!l.mine) { setLocation(base); return; }
      setF({
        title: l.title, description: l.description, kind: l.kind, city: l.city, area: l.area,
        capacity: String(l.capacity), rooms: String(l.rooms), priceType: l.price_type, price: l.price ? String(l.price) : "",
        availableFrom: l.available_from ?? "", availableTo: l.available_to ?? "", phone: l.contact?.phone ?? "", whatsapp: l.contact?.whatsapp ?? false,
      });
      setAmenities(l.amenities);
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
    if (kept.length + files.length + imgs.length > MAX) toast.info(`${MAX} photos maximum`);
    setFiles(prev => [...prev, ...imgs].slice(0, MAX - kept.length));
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleAmenity = (value: string) => setAmenities(prev => (prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = Number(f.capacity);
    const rooms = Number(f.rooms);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 12) { toast.error("Capacité invalide (1 à 12 voyageurs)"); return; }
    if (!Number.isSafeInteger(rooms) || rooms < 0 || rooms > 10) { toast.error("Nombre de pièces invalide (0 à 10)"); return; }
    const priceStr = f.price.trim();
    const price = f.priceType === "gratuit" ? 0 : Number(priceStr);
    if (f.priceType !== "gratuit" && (!priceStr || !Number.isSafeInteger(price) || price < 0)) { toast.error("Prix invalide (nombre entier en MAD par nuit)"); return; }
    if (f.priceType === "prix" && price < 1) { toast.error("Indiquez un prix par nuit supérieur à 0."); return; }
    if (f.availableFrom && f.availableTo && f.availableTo < f.availableFrom) { toast.error("La fin de disponibilité doit suivre son début."); return; }
    setBusy(true);
    try {
      const uploaded = await Promise.all(files.map(hub.uploadImage));
      const body: st.StayForm = {
        title: f.title, description: f.description, kind: f.kind, city: f.city, area: f.area,
        capacity, rooms, priceType: f.priceType, price, amenities,
        availableFrom: f.availableFrom, availableTo: f.availableTo,
        phone: f.phone, whatsapp: f.whatsapp, media: [...kept.map(k => k.key), ...uploaded],
      };
      if (editId === null) { const r = await st.createStay(body); setLocation(`${base}/${r.id}`); }
      else { await st.updateStay(editId, body); setLocation(`${base}/${editId}`); }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HubShell me={me}>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{editId === null ? "Proposer un logement" : "Modifier le logement"}</h1>
        <Input aria-label="Titre" required maxLength={80} value={f.title} onChange={set("title")} placeholder="Titre (ex. Chambre d'amis près du centre)" />
        <Textarea aria-label="Description" required maxLength={2000} rows={5} value={f.description} onChange={set("description")} placeholder="Décrivez le logement : couchage, accès, règles de la maison, heure d'arrivée…" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Type de logement" className={select} value={f.kind} onChange={set("kind")}>{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <Input aria-label="Ville" maxLength={60} value={f.city} onChange={set("city")} placeholder="Ville" />
          <Input aria-label="Quartier" maxLength={60} value={f.area} onChange={set("area")} placeholder="Quartier (facultatif)" />
          <Input aria-label="Nombre de pièces" type="number" min={0} max={10} value={f.rooms} onChange={set("rooms")} placeholder="Nombre de pièces" />
          <Input aria-label="Capacité" type="number" min={1} max={12} required value={f.capacity} onChange={set("capacity")} placeholder="Voyageurs accueillis" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Type de prix" className={select} value={f.priceType} onChange={set("priceType")}>{PRICE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          {f.priceType !== "gratuit" && (
            <Input aria-label="Prix par nuit en MAD" inputMode="numeric" value={f.price} onChange={set("price")} placeholder="Montant par nuit en MAD (0 = gratuit)" />
          )}
        </div>
        <p className="text-xs text-slate-500">Aucun paiement ne passe par le site : le montant éventuel se règle directement entre bénévoles.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">Disponible à partir du
            <Input aria-label="Disponible à partir du" type="date" value={f.availableFrom} onChange={set("availableFrom")} />
          </label>
          <label className="text-sm text-slate-700">Disponible jusqu'au
            <Input aria-label="Disponible jusqu'au" type="date" min={f.availableFrom || undefined} value={f.availableTo} onChange={set("availableTo")} />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-800">Équipements</legend>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {AMENITIES.map(a => (
              <label key={a.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={amenities.includes(a.value)} onChange={() => toggleAmenity(a.value)} /> {a.label}
              </label>
            ))}
          </div>
        </fieldset>
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
        <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : editId === null ? "Publier le logement" : "Enregistrer"}</Button>
      </form>
    </HubShell>
  );
}
