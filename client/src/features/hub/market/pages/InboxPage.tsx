import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";

export default function InboxPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/marketplace`;
  const [threads, setThreads] = useState<mk.Thread[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setThreads(await mk.listThreads());
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <HubShell me={me}>
      <h1 className="text-xl font-bold text-slate-900">Mes messages</h1>
      {status === "loading" && <LoadingPanel label="Chargement des discussions…" />}
      {status === "error" && <ErrorPanel message={error || "Impossible de charger vos discussions."} onRetry={load} />}
      {status === "ready" && threads?.length === 0 && (
        <EmptyPanel
          title="Aucune discussion."
          description="Ouvrez une annonce qui vous intéresse, puis cliquez sur « Envoyer un message »."
          action={<Link href={base} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Parcourir la marketplace</Link>}
        />
      )}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {status === "ready" && threads?.map(t => (
          <li key={t.id}>
            <Link href={`${base}/messages/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              <Avatar name={t.other.display_name} src={t.other.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-slate-900">{t.other.display_name}</span>{t.unread > 0 && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${t.unread} non lus`}>{t.unread}</span>}</p>
                <p className="truncate text-xs text-slate-500">{t.listing_title}{t.listing_status === "sold" ? " · Vendu" : ""}</p>
                <p className={`truncate text-sm ${t.unread > 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}>{t.last_body ?? "Nouvelle discussion"}</p>
              </div>
              {t.cover && <img src={t.cover} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            </Link>
          </li>
        ))}
      </ul>
    </HubShell>
  );
}
