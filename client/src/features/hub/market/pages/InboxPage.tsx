import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";

export default function InboxPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/marketplace`;
  const [threads, setThreads] = useState<mk.Thread[] | null>(null);

  useEffect(() => {
    if (!me) return;
    mk.listThreads().then(setThreads).catch(e => { toast.error((e as Error).message); setThreads([]); });
  }, [me]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <HubShell me={me}>
      <h1 className="text-xl font-bold text-slate-900">Mes messages</h1>
      {threads === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {threads?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune discussion. Ouvrez une annonce et cliquez sur « Envoyer un message ».</p>}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {threads?.map(t => (
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
