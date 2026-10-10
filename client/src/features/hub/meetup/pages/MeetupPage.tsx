import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as mt from "../meetup-api";
import { CATEGORIES, fmtWhen, label, statusBadge } from "../format";

const select = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export default function MeetupPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/meetup`;
  const [items, setItems] = useState<mt.MeetupCard[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [places, setPlaces] = useState<mt.MeetupPlaces | null>(null);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const reqId = useRef(0);

  // the dropdowns come from the meetups that really exist, loaded once
  useEffect(() => {
    if (me) mt.meetupPlaces().then(setPlaces).catch(() => setPlaces({ countries: [] }));
  }, [me]);

  const cities = useMemo(() => {
    if (!places) return [];
    const list = country ? places.countries.find(c => c.country === country)?.cities ?? [] : places.countries.flatMap(c => c.cities);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "fr"));
  }, [places, country]);

  // a city that no longer exists for the chosen country is dropped
  useEffect(() => { if (places && city && !cities.includes(city)) setCity(""); }, [places, cities, city]);

  const load = useCallback(async (cursor: string | null = null) => {
    const id = ++reqId.current;
    if (!cursor) { setNext(null); setStatus("loading"); setError(""); } else setLoadingMore(true);
    try {
      const r = await mt.listMeetups(cursor, { country, city, category, from, to });
      if (id !== reqId.current) return;
      setItems(prev => (cursor ? [...(prev ?? []), ...r.meetups] : r.meetups));
      setNext(r.nextCursor);
      setStatus("ready");
    } catch (e) {
      if (id !== reqId.current) return;
      if (cursor) toast.error((e as Error).message);
      else { setError((e as Error).message); setStatus("error"); }
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  }, [country, city, category, from, to]);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const filtered = !!(country || city || category || from || to);
  const resetFilters = () => { setCountry(""); setCity(""); setCategory(""); setFrom(""); setTo(""); };

  return (
    <HubShell me={me}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Meetup</h1>
        <div className="flex gap-2">
          <Link href={`${base}/mes-meetups`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Mes meetups</Link>
          <Link href={`${base}/nouveau`} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} aria-hidden /> Organiser</Link>
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
        Sorties, événements, rencontres entre bénévoles, près de chez vous. Choisissez un pays, une ville ou une date, puis rejoignez un meetup.
      </p>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <select aria-label="Pays" className={select} value={country} onChange={e => setCountry(e.target.value)}>
          <option value="">Tous les pays</option>
          {places?.countries.map(c => <option key={c.country} value={c.country}>{c.country}</option>)}
        </select>
        <select aria-label="Ville" className={select} value={city} onChange={e => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Catégorie" className={select} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Du</span>
          <Input aria-label="Du" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Au</span>
          <Input aria-label="Au" type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} />
        </label>
      </div>

      {status === "loading" && <LoadingPanel label="Chargement des meetups…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger les meetups."} onRetry={() => load()} />}

      {status === "ready" && items?.length === 0 && (
        filtered ? (
          <EmptyPanel
            title="Aucun meetup ne correspond à votre recherche."
            description="Essayez un autre pays, d'autres dates ou retirez des filtres."
            action={<Button variant="outline" onClick={resetFilters}>Réinitialiser les filtres</Button>}
          />
        ) : (
          <EmptyPanel
            title="Aucun meetup à venir pour l'instant."
            description="Soyez le premier à proposer une sortie ou une rencontre."
            action={<Link href={`${base}/nouveau`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Organiser un meetup</Link>}
          />
        )
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {status === "ready" && items?.map(m => {
          const badge = statusBadge(m, me.id);
          const full = m.going_count >= m.capacity;
          return (
            <Link key={m.id} href={`${base}/${m.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md">
              <div className="relative aspect-[4/3] bg-slate-100">
                {m.photo ? <img src={m.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Pas de photo</div>}
                {full && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">Complet{m.waitlist_count > 0 ? ` · ${m.waitlist_count} en attente` : ""}</span>}
                {badge && <span className={`absolute right-2 top-2 rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span>}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 font-bold text-slate-900">{m.title}</p>
                <p className="text-xs font-semibold text-blue-800">{label(CATEGORIES, m.category)}</p>
                <p className="text-sm text-slate-700">{fmtWhen(m.starts_at, m.ends_at)}</p>
                <p className="text-xs text-slate-500">{m.city}, {m.country}</p>
                <p className="text-xs text-slate-500">{m.going_count}/{m.capacity} inscrits</p>
              </div>
            </Link>
          );
        })}
      </div>
      {status === "ready" && next !== null && (
        <Button variant="outline" className="w-full bg-white" onClick={() => load(next)} disabled={loadingMore}>
          {loadingMore ? <><Loader2 size={16} className="mr-2 animate-spin" aria-hidden />Chargement…</> : "Voir plus"}
        </Button>
      )}
    </HubShell>
  );
}
