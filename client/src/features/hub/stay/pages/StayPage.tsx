import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2, Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as st from "../stay-api";
import { KINDS, PRICE_TYPES, availabilityLabel, label, priceLabel, todayIso } from "../format";

const select = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export default function StayPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/hebergement`;
  const [items, setItems] = useState<st.StayCard[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState("");
  const [city, setCity] = useState("");
  const [priceType, setPriceType] = useState("");
  const [guests, setGuests] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mine, setMine] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (cursor: number | null = null) => {
    const id = ++reqId.current;
    if (!cursor) { setNext(null); setStatus("loading"); setError(""); } else setLoadingMore(true);
    try {
      const r = await st.listStays({
        cursor, kind, q: debouncedQ, city, priceType,
        guests: guests ? Number(guests) : undefined,
        from: from || undefined, to: to || undefined, mine,
      });
      if (id !== reqId.current) return;
      setItems(prev => (cursor ? [...(prev ?? []), ...r.listings] : r.listings));
      setNext(r.nextCursor);
      setStatus("ready");
    } catch (e) {
      if (id !== reqId.current) return;
      if (cursor) {
        // the page already on screen stays usable: only the extra page failed
        toast.error((e as Error).message);
      } else {
        setError((e as Error).message);
        setStatus("error");
      }
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  }, [kind, debouncedQ, city, priceType, guests, from, to, mine]);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const filtered = !!(kind || debouncedQ.trim() || city.trim() || priceType || (guests && guests !== "1") || from || to || mine);
  const resetFilters = () => { setQ(""); setKind(""); setCity(""); setPriceType(""); setGuests(""); setFrom(""); setTo(""); setMine(false); };

  return (
    <HubShell me={me}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Hébergement</h1>
        <div className="flex gap-2">
          <Link href={`${base}/demandes`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Mes demandes</Link>
          <Link href={`${base}/nouveau`} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} aria-hidden /> Proposer</Link>
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
        Un bénévole vous héberge près du lieu de l'événement ? Publiez une chambre, un canapé ou un studio, ou demandez un séjour
        gratuitement ou contre une petite participation. Les échanges se font entre bénévoles vérifiés.
      </p>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative lg:col-span-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden />
          <Input aria-label="Rechercher" className="pl-9" value={q} maxLength={40} onChange={e => setQ(e.target.value)} placeholder="Rechercher une ville, un quartier, un titre…" />
        </div>
        <select aria-label="Type de logement" className={select} value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">Tous les logements</option>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <Input aria-label="Ville" maxLength={60} value={city} onChange={e => setCity(e.target.value)} placeholder="Ville" />
        <select aria-label="Prix" className={select} value={priceType} onChange={e => setPriceType(e.target.value)}>
          <option value="">Tous les prix</option>
          {PRICE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Voyageurs</span>
          <Input aria-label="Nombre de voyageurs" type="number" min={1} max={12} className="w-20" value={guests} onChange={e => setGuests(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Arrivée</span>
          <Input aria-label="Date d'arrivée" type="date" min={todayIso()} value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="whitespace-nowrap">Départ</span>
          <Input aria-label="Date de départ" type="date" min={from || todayIso()} value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Mes logements</label>
      </div>

      {status === "loading" && <LoadingPanel label="Chargement des logements…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger les logements."} onRetry={() => load()} />}

      {status === "ready" && items?.length === 0 && (
        filtered ? (
          <EmptyPanel
            title="Aucun logement ne correspond à votre recherche."
            description="Essayez d'autres dates, une autre ville ou retirez des filtres."
            action={<Button variant="outline" onClick={resetFilters}>Réinitialiser les filtres</Button>}
          />
        ) : (
          <EmptyPanel
            title="Aucun logement proposé pour l'instant."
            description="Soyez le premier à héberger un bénévole pendant l'événement."
            action={<Link href={`${base}/nouveau`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Proposer un logement</Link>}
          />
        )
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {status === "ready" && items?.map(l => (
          <Link key={l.id} href={`${base}/${l.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md">
            <div className="relative aspect-[4/3] bg-slate-100">
              {l.cover ? <img src={l.cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Pas de photo</div>}
              {l.status === "paused" && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">En pause</span>}
            </div>
            <div className="space-y-1 p-3">
              <p className="font-bold text-slate-900">{priceLabel(l.price_type, l.price)}</p>
              <p className="line-clamp-2 text-sm font-medium text-slate-800">{l.title}</p>
              <p className="text-xs text-slate-500">
                {label(KINDS, l.kind)}{l.city ? ` · ${l.city}` : ""}{l.area ? ` · ${l.area}` : ""}
              </p>
              <p className="text-xs text-slate-500">
                Jusqu'à {l.capacity} voyageur{l.capacity > 1 ? "s" : ""} · {availabilityLabel(l.available_from, l.available_to)}
              </p>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <p className="flex min-w-0 items-center gap-1 text-xs text-slate-500"><Avatar name={l.host.display_name} src={l.host.avatar} size={18} /><span className="truncate">{l.host.display_name}</span></p>
                {l.review_count > 0 && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-amber-600" aria-label={`Note ${l.rating} sur 5, ${l.review_count} avis`}>
                    <Star size={13} className="fill-amber-500 text-amber-500" aria-hidden /> {l.rating} ({l.review_count})
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {status === "ready" && next !== null && (
        <Button variant="outline" className="w-full bg-white" onClick={() => load(next)} disabled={loadingMore}>
          {loadingMore ? <><Loader2 size={16} className="mr-2 animate-spin" aria-hidden />Chargement…</> : "Voir plus"}
        </Button>
      )}
    </HubShell>
  );
}
