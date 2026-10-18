import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, MessagesSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as sl from "../salon-api";

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SalonsPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, navigate] = useLocation();
  const base = `/${lang}/benevole/espace/salons`;
  const [items, setItems] = useState<sl.SalonCard[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (cursor: string | null = null) => {
    const id = ++reqId.current;
    if (!cursor) { setStatus("loading"); setError(""); } else setLoadingMore(true);
    try {
      const r = await sl.listSalons(cursor);
      if (id !== reqId.current) return;
      setItems(prev => (cursor ? [...(prev ?? []), ...r.salons] : r.salons));
      setNext(r.nextCursor);
      setStatus("ready");
    } catch (e) {
      if (id !== reqId.current) return;
      if (cursor) toast.error((e as Error).message);
      else { setError((e as Error).message); setStatus("error"); }
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  }, []);

  useEffect(() => { if (me) void load(); }, [me, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { id } = await sl.createSalon({ title, topic });
      navigate(`${base}/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  if (!me) return null;
  return (
    <HubShell me={me}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-bold"><MessagesSquare size={22} aria-hidden /> Salons</h1>
          <Button onClick={() => setCreating(c => !c)} aria-expanded={creating}>
            <Plus size={16} className="mr-1" aria-hidden /> Nouveau salon
          </Button>
        </div>

        {creating && (
          <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium">
              Titre
              <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required className="mt-1" />
            </label>
            <label className="block text-sm font-medium">
              Sujet
              <Textarea value={topic} onChange={e => setTopic(e.target.value)} maxLength={500} rows={3} required className="mt-1" />
            </label>
            <Button type="submit" disabled={busy || !title.trim() || !topic.trim()}>
              {busy && <Loader2 size={16} className="mr-2 animate-spin" aria-hidden />} Créer le salon
            </Button>
          </form>
        )}

        {status === "loading" && <LoadingPanel label="Chargement des salons…" />}
        {status === "error" && <ErrorPanel message={error || "Impossible de charger les salons."} onRetry={() => void load()} />}
        {status === "ready" && items?.length === 0 && <EmptyPanel title="Aucun salon pour l'instant" description="Crée le premier salon et lance la discussion." />}
        {status === "ready" && !!items?.length && (
          <ul className="space-y-3">
            {items.map(s => (
              <li key={s.id}>
                <Link href={`${base}/${s.id}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300">
                  <Avatar name={s.creator.display_name} src={s.creator.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.title}</span>
                    <span className="line-clamp-2 text-sm text-slate-600">{s.topic}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {s.creator.display_name} · {s.post_count} message{s.post_count > 1 ? "s" : ""}{s.last_post_at ? ` · dernier ${when(s.last_post_at)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {next && (
          <div className="text-center">
            <Button variant="outline" className="bg-white" onClick={() => void load(next)} disabled={loadingMore}>
              {loadingMore && <Loader2 size={16} className="mr-2 animate-spin" aria-hidden />} Voir plus
            </Button>
          </div>
        )}
      </div>
    </HubShell>
  );
}
