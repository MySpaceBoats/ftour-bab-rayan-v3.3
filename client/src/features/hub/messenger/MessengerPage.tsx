import { useCallback, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import HubShell from "../components/HubShell";
import { useHubMember } from "../useHubMember";
import * as pro from "../pro/pro-api";
import ConversationPane from "./ConversationPane";
import { SOURCES } from "./sources";
import ThreadList, { type Filter } from "./ThreadList";
import { useChat } from "./useChat";

/** "Mes messages": every conversation of the hub (Pro, Marketplace, Séjours) in one Messenger-style screen. */
export default function MessengerPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace`;
  const [, params] = useRoute("/:lang/benevole/espace/messages/:source/:id");
  const source = params && (SOURCES as string[]).includes(params.source) ? (params.source as pro.InboxSource) : null;
  const id = params ? Number(params.id) : NaN;
  const selected = source && Number.isSafeInteger(id) && id > 0 ? { source, id } : null;
  const [items, setItems] = useState<pro.InboxItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(() => {
    pro.inbox().then(setItems).catch(e => { toast.error((e as Error).message); setItems(prev => prev ?? []); });
  }, []);
  const { isOnline } = useChat(e => { if (e.type === "message") refresh(); });

  useEffect(() => {
    if (!me) return;
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 30_000);
    return () => clearInterval(t);
  }, [me, refresh]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <HubShell me={me}>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={selected ? "hidden lg:block" : ""}>
          <ThreadList items={items} filter={filter} onFilter={setFilter} activeKey={selected ? `${selected.source}/${selected.id}` : null} base={base} isOnline={isOnline} />
        </div>
        <div className={selected ? "" : "hidden lg:block"}>
          {selected ? (
            <div className="space-y-2">
              <Link href={`${base}/messages`} className="text-sm text-blue-700 underline lg:hidden">← Messages</Link>
              <ConversationPane key={`${selected.source}/${selected.id}`} me={me} source={selected.source} id={selected.id} base={base} onActivity={refresh} />
            </div>
          ) : (
            <p className="hidden rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 lg:block">Choisissez une discussion.</p>
          )}
        </div>
      </div>
    </HubShell>
  );
}
