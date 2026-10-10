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
import * as mt from "../meetup-api";
import { CATEGORIES } from "../format";

const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";
const EMPTY = { title: "", category: "sortie", description: "", country: "", city: "", place: "", startsAt: "", endsAt: "", capacity: "10" };

export default function MeetupFormPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/:lang/benevole/espace/meetup/:id/modifier");
  const editId = match ? Number(params?.id) : null;
  const base = `/${lang}/benevole/espace/meetup`;
  const [f, setF] = useState(EMPTY);
  const [kept, setKept] = useState<{ key: string; url: string | null } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [places, setPlaces] = useState<mt.MeetupPlaces>({ countries: [] });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(editId === null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => { if (me) mt.meetupPlaces().then(setPlaces).catch(() => undefined); }, [me]);

  useEffect(() => {
    if (!me || editId === null) return;
    mt.getMeetup(editId).then(m => {
      if (!m.mine || m.status !== "active") { setLocation(base); return; }
      setF({
        title: m.title, category: m.category, description: m.description, country: m.country, city: m.city, place: m.place,
        startsAt: m.starts_at, endsAt: m.ends_at, capacity: String(m.capacity),
      });
      setKept(m.photo_key ? { key: m.photo_key, url: m.photo } : null);
      setReady(true);
    }).catch(() => setLocation(base));
  }, [me, editId, base, setLocation]);

  if (!me || !ready) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  const countrySuggestions = places.countries.map(c => c.country);
  const citySuggestions = Array.from(new Set(
    places.countries.filter(c => !f.country.trim() || c.country.toLowerCase() === f.country.trim().toLowerCase()).flatMap(c => c.cities),
  ));
  const shownPhoto = preview ?? kept?.url ?? null;
  const hasPhoto = !!file || !!kept;

  const pick = (list: FileList | null) => {
    const img = list ? Array.from(list).find(x => x.type.startsWith("image/")) : undefined;
    if (img) setFile(img);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = Number(f.capacity);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 500) { toast.error("Capacité invalide (1 à 500)"); return; }
    if (!f.startsAt || !f.endsAt) { toast.error("Indiquez le début et la fin du meetup."); return; }
    if (f.endsAt <= f.startsAt) { toast.error("La fin doit suivre le début"); return; }
    setBusy(true);
    try {
      const photo = file ? await hub.uploadImage(file) : kept?.key ?? null;
      const body: mt.MeetupForm = {
        title: f.title, category: f.category as mt.MeetupCategory, description: f.description,
        country: f.country, city: f.city, place: f.place, startsAt: f.startsAt, endsAt: f.endsAt, capacity, photo,
      };
      if (editId === null) { const r = await mt.createMeetup(body); setLocation(`${base}/${r.id}`); }
      else { await mt.updateMeetup(editId, body); setLocation(`${base}/${editId}`); }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HubShell me={me}>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{editId === null ? "Organiser un meetup" : "Modifier le meetup"}</h1>
        <Input aria-label="Titre" required maxLength={80} value={f.title} onChange={set("title")} placeholder="Titre (ex. Balade sur la corniche)" />
        <select aria-label="Catégorie" className={select} value={f.category} onChange={set("category")}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <Textarea aria-label="Description" required maxLength={2000} rows={5} value={f.description} onChange={set("description")} placeholder="Programme, point de rendez-vous, ce qu'il faut apporter…" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label="Pays" required maxLength={60} list="meetup-countries" value={f.country} onChange={set("country")} placeholder="Pays" />
          <Input aria-label="Ville" required maxLength={60} list="meetup-cities" value={f.city} onChange={set("city")} placeholder="Ville" />
          <datalist id="meetup-countries">{countrySuggestions.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="meetup-cities">{citySuggestions.map(c => <option key={c} value={c} />)}</datalist>
          <Input aria-label="Lieu" required maxLength={120} className="sm:col-span-2" value={f.place} onChange={set("place")} placeholder="Lieu précis (adresse, café, parc…)" />
          <label className="text-sm text-slate-700">Début
            <Input aria-label="Début" type="datetime-local" required value={f.startsAt} onChange={set("startsAt")} />
          </label>
          <label className="text-sm text-slate-700">Fin
            <Input aria-label="Fin" type="datetime-local" required min={f.startsAt || undefined} value={f.endsAt} onChange={set("endsAt")} />
          </label>
          <label className="text-sm text-slate-700">Capacité maximale
            <Input aria-label="Capacité maximale" type="number" min={1} max={500} required value={f.capacity} onChange={set("capacity")} />
          </label>
        </div>
        <p className="text-xs text-slate-500">Les horaires sont ceux du lieu du meetup, sans conversion de fuseau.</p>
        <div className="space-y-2">
          {hasPhoto && (
            <div className="relative h-24 w-24">
              {shownPhoto ? <img src={shownPhoto} alt="" className="h-24 w-24 rounded-lg object-cover" /> : <div className="h-24 w-24 rounded-lg bg-slate-200" />}
              <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => { setFile(null); setKept(null); }}><X size={14} /></button>
            </div>
          )}
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => pick(e.target.files)} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus size={16} className="mr-2" /> {hasPhoto ? "Remplacer la photo" : "Ajouter une photo (facultatif)"}</Button>
        </div>
        <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : editId === null ? "Publier le meetup" : "Enregistrer"}</Button>
      </form>
    </HubShell>
  );
}
