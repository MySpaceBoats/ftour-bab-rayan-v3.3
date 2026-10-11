import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as mt from "../meetup-api";
import { fmtWhen, statusBadge } from "../format";

export default function MeetupMinePage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/meetup`;
  const [role, setRole] = useState<"organized" | "joined">("joined");
  const [items, setItems] = useState<mt.MeetupCard[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setItems(await mt.myMeetups(role));
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, [role]);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const tab = (value: "organized" | "joined", text: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${role === value ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
    >
      {text}
    </button>
  );

  return (
    <HubShell me={me}>
      <Link href={base} className="text-sm text-blue-700 underline">← Meetup</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Mes meetups</h1>
        <div className="flex gap-2">{tab("joined", "Inscrits")}{tab("organized", "Organisés")}</div>
      </div>

      {status === "loading" && <LoadingPanel label="Chargement de vos meetups…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger vos meetups."} onRetry={load} />}
      {status === "ready" && items?.length === 0 && (
        <EmptyPanel
          title={role === "joined" ? "Vous n'êtes inscrit à aucun meetup." : "Vous n'avez organisé aucun meetup."}
          description={role === "joined" ? "Parcourez les meetups à venir et rejoignez-en un." : "Proposez une sortie ou une rencontre aux autres bénévoles."}
          action={<Link href={role === "joined" ? base : `${base}/nouveau`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">{role === "joined" ? "Parcourir les meetups" : "Organiser un meetup"}</Link>}
        />
      )}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {status === "ready" && items?.map(m => {
          const badge = statusBadge(m, me.id);
          return (
            <li key={m.id}>
              <Link href={`${base}/${m.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                {m.photo ? <img src={m.photo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">—</span>}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900">{m.title}</span>
                    {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{fmtWhen(m.starts_at, m.ends_at)}</p>
                  <p className="truncate text-sm text-slate-600">{m.city}, {m.country} · {m.going_count}/{m.capacity} inscrits</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </HubShell>
  );
}
