import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import HubShell from "../../components/HubShell";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as mt from "../meetup-api";
import { CATEGORIES, fmtWhen, label } from "../format";

export default function MeetupPage() {
  const me = useHubMember();
  const [items, setItems] = useState<mt.MeetupCard[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (cursor: string | null = null) => {
    const id = ++reqId.current;
    if (!cursor) { setNext(null); setStatus("loading"); setError(""); } else setLoadingMore(true);
    try {
      const r = await mt.listMeetups(cursor);
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
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <HubShell me={me}>
      <h1 className="text-xl font-bold text-slate-900">Meetup</h1>

      {status === "loading" && <LoadingPanel label="Chargement des meetups…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger les meetups."} onRetry={() => load()} />}
      {status === "ready" && items?.length === 0 && <EmptyPanel title="Aucun meetup à venir pour l'instant." />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {status === "ready" && items?.map(m => (
          <div key={m.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-[4/3] bg-slate-100">
              {m.photo ? <img src={m.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Pas de photo</div>}
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-2 font-bold text-slate-900">{m.title}</p>
              <p className="text-xs font-semibold text-blue-800">{label(CATEGORIES, m.category)}</p>
              <p className="text-sm text-slate-700">{fmtWhen(m.starts_at, m.ends_at)}</p>
              <p className="text-xs text-slate-500">{m.city}, {m.country}</p>
              <p className="text-xs text-slate-500">{m.going_count}/{m.capacity} inscrits</p>
            </div>
          </div>
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
