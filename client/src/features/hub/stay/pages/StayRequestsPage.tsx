import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Loader2, Users } from "lucide-react";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as st from "../stay-api";
import { REQUEST_STATUS, fmtDate, label, nights } from "../format";

const BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-slate-200 text-slate-700",
};

export default function StayRequestsPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/hebergement`;
  const [role, setRole] = useState<"guest" | "host">("guest");
  const [items, setItems] = useState<st.StayRequestSummary[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setItems(await st.listStayRequests(role));
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, [role]);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const tab = (value: "guest" | "host", text: string) => (
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
      <Link href={base} className="text-sm text-blue-700 underline">← Hébergement</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Mes demandes de séjour</h1>
        <div className="flex gap-2">{tab("guest", "Envoyées")}{tab("host", "Reçues")}</div>
      </div>

      {status === "loading" && <LoadingPanel label="Chargement des demandes…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger vos demandes."} onRetry={load} />}
      {status === "ready" && items?.length === 0 && (
        <EmptyPanel
          title={role === "guest" ? "Aucune demande envoyée." : "Aucune demande reçue."}
          description={role === "guest" ? "Parcourez les logements proposés puis envoyez une demande de séjour." : "Publiez un logement pour recevoir des demandes de bénévoles."}
          action={<Link href={base} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">{role === "guest" ? "Parcourir les logements" : "Proposer un logement"}</Link>}
        />
      )}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {status === "ready" && items?.map(r => (
          <li key={r.id}>
            <Link href={`${base}/demandes/${r.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              {r.cover ? <img src={r.cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">—</span>}
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-900">{r.listing_title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{label(REQUEST_STATUS, r.status)}</span>
                </p>
                <p className="flex items-center gap-3 truncate text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden /> {fmtDate(r.start_date)} → {fmtDate(r.end_date)} ({nights(r.start_date, r.end_date)} nuits)</span>
                  <span className="inline-flex items-center gap-1"><Users size={13} aria-hidden /> {r.guests}</span>
                </p>
                <p className="truncate text-sm text-slate-600">
                  {role === "guest" ? "Hôte" : "Voyageur"} : {r.other.display_name}
                  {r.host_reply ? ` · « ${r.host_reply} »` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                {r.unread > 0 && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${r.unread} non lus`}>{r.unread}</span>}
                <Avatar name={r.other.display_name} src={r.other.avatar} size={36} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HubShell>
  );
}
