import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { ago, JOB_TYPES, typeLabel } from "../format";

const select = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export default function ProJobsPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/pro/emplois`;
  const [items, setItems] = useState<api.JobCard[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState({ q: "", city: "" });
  const [mine, setMine] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ q, city }), 250);
    return () => clearTimeout(t);
  }, [q, city]);

  const load = useCallback(async (cursor: number | null = null) => {
    const id = ++reqId.current;
    if (!cursor) setNext(null);
    try {
      const r = await api.listJobs({ cursor, type, city: debounced.city, q: debounced.q, mine });
      if (id !== reqId.current) return;
      setItems(prev => (cursor ? [...(prev ?? []), ...r.jobs] : r.jobs));
      setNext(r.nextCursor);
    } catch (e) {
      if (id !== reqId.current) return;
      toast.error((e as Error).message);
      if (!cursor) setItems([]);
    }
  }, [type, debounced, mine]);
  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <ProLayout me={me} active="jobs">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Offres d'emploi</h1>
        <Link href={`${base}/nouveau`} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} /> Publier</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[10rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <Input aria-label="Rechercher" className="pl-9" value={q} maxLength={24} onChange={e => setQ(e.target.value)} placeholder="Poste, entreprise…" />
        </div>
        <Input aria-label="Ville" className="w-36" value={city} maxLength={60} onChange={e => setCity(e.target.value)} placeholder="Ville" />
        <select aria-label="Type de contrat" className={select} value={type} onChange={e => setType(e.target.value)}>
          <option value="">Tous les contrats</option>
          {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Mes offres</label>
      </div>

      {items === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {items?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune offre pour l'instant.</p>}

      <ul className="space-y-3">
        {items?.map(j => (
          <li key={j.id}>
            <Link href={`${base}/${j.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{j.title}</p>
                  <p className="text-sm text-slate-700">{j.company}</p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">{typeLabel(j.type)}</span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                {j.city && <span className="flex items-center gap-1"><MapPin size={12} />{j.city}</span>}
                <span className="flex items-center gap-1"><Avatar name={j.poster.display_name} src={j.poster.avatar} size={16} />{j.poster.display_name}</span>
                <span>{ago(j.created_at)}</span>
                {j.status === "closed" && <span className="font-semibold text-slate-700">Fermée</span>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {next !== null && <Button variant="outline" className="w-full bg-white" onClick={() => load(next)}>Voir plus</Button>}
    </ProLayout>
  );
}
