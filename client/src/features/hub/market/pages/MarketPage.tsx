import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";
import { CATEGORIES, CONDITIONS, label, price } from "../format";

const select = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export default function MarketPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/marketplace`;
  const [items, setItems] = useState<mk.ListingCard[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
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
      const r = await mk.listListings({ cursor, category, q: debouncedQ, mine });
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
  }, [category, debouncedQ, mine]);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const filtered = !!category || !!debouncedQ.trim() || mine;
  const resetFilters = () => { setCategory(""); setQ(""); setMine(false); };

  return (
    <HubShell me={me}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Marketplace</h1>
        <Link href={`${base}/nouveau`} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} aria-hidden /> Vendre</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[10rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden />
          <Input aria-label="Rechercher" className="pl-9" value={q} maxLength={24} onChange={e => setQ(e.target.value)} placeholder="Rechercher un objet…" />
        </div>
        <select aria-label="Catégorie" className={select} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Mes annonces</label>
      </div>

      {status === "loading" && <LoadingPanel label="Chargement des annonces…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger la marketplace."} onRetry={() => load()} />}

      {status === "ready" && items?.length === 0 && (
        filtered ? (
          <EmptyPanel
            title="Aucune annonce ne correspond à votre recherche."
            description="Essayez un autre mot-clé ou une autre catégorie."
            action={<Button variant="outline" onClick={resetFilters}>Réinitialiser les filtres</Button>}
          />
        ) : (
          <EmptyPanel
            title="Aucune annonce pour l'instant."
            description="Soyez le premier à proposer un objet à la communauté des bénévoles."
            action={<Link href={`${base}/nouveau`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Publier une annonce</Link>}
          />
        )
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {status === "ready" && items?.map(l => (
          <Link key={l.id} href={`${base}/${l.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md">
            <div className="relative aspect-square bg-slate-100">
              {l.cover ? <img src={l.cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400">Pas de photo</div>}
              {l.status === "sold" && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">Vendu</span>}
            </div>
            <div className="space-y-1 p-3">
              <p className="font-bold text-slate-900">{price(l.price)}</p>
              <p className="line-clamp-2 text-sm text-slate-800">{l.title}</p>
              <p className="text-xs text-slate-500">{label(CATEGORIES, l.category)} · {label(CONDITIONS, l.condition)}{l.city ? ` · ${l.city}` : ""}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500"><Avatar name={l.seller.display_name} src={l.seller.avatar} size={18} />{l.seller.display_name}</p>
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
