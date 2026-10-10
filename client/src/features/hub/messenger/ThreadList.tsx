import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import Avatar from "../components/Avatar";
import { ago } from "../pro/format";
import type { InboxItem, InboxSource } from "../pro/pro-api";
import PresenceDot from "./PresenceDot";
import { SOURCE_LABEL } from "./sources";

export type Filter = "all" | InboxSource;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tout" }, { key: "pro", label: "Pro" }, { key: "market", label: "Marketplace" }, { key: "stay", label: "Séjours" },
];
const BADGE: Record<InboxSource, string> = { pro: "bg-blue-100 text-blue-800", market: "bg-amber-100 text-amber-900", stay: "bg-emerald-100 text-emerald-900" };

export default function ThreadList({ items, filter, onFilter, activeKey, base, isOnline }: {
  items: InboxItem[] | null; filter: Filter; onFilter: (f: Filter) => void; activeKey: string | null; base: string; isOnline: (id: number) => boolean;
}) {
  const shown = items?.filter(i => filter === "all" || i.source === filter) ?? null;
  // one chip per online member we already talk to (latest conversation)
  const seen = new Set<number>();
  const onlineChips = (items ?? []).filter(i => isOnline(i.other.id) && !seen.has(i.other.id) && seen.add(i.other.id));
  return (
    <section aria-label="Discussions" className="space-y-3">
      <h1 className="text-xl font-bold text-slate-900">Messages</h1>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map(f => (
          <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => onFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === f.key ? "bg-blue-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {onlineChips.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">En ligne</p>
          <ul className="mt-1 flex gap-2 overflow-x-auto pb-1">
            {onlineChips.map(i => (
              <li key={i.other.id}>
                <Link href={`${base}/messages/${i.source}/${i.id}`} className="flex w-16 flex-col items-center gap-1 text-center text-xs text-slate-700 hover:underline">
                  <span className="relative"><Avatar name={i.other.display_name} src={i.other.avatar} size={40} /><PresenceDot online className="absolute -bottom-0.5 -right-0.5" /></span>
                  <span className="w-full truncate">{i.other.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {shown === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {shown?.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Aucune discussion. Écrivez à un membre depuis sa fiche, ou ouvrez une offre, une annonce ou un séjour.
        </p>
      )}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {shown?.map(i => {
          const key = `${i.source}/${i.id}`;
          const active = key === activeKey;
          return (
            <li key={key}>
              <Link href={`${base}/messages/${key}`} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 p-3 hover:bg-slate-50 ${active ? "bg-blue-50" : ""}`}>
                <span className="relative shrink-0"><Avatar name={i.other.display_name} src={i.other.avatar} size={44} /><PresenceDot online={isOnline(i.other.id)} className="absolute -bottom-0.5 -right-0.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900">{i.other.display_name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{ago(i.last_message_at)}</span>
                  </p>
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`shrink-0 rounded-full px-2 text-[11px] font-semibold ${BADGE[i.source]}`}>{SOURCE_LABEL[i.source]}</span>
                    {i.context && <span className="truncate">{i.context}</span>}
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${i.unread > 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}>{i.last_body ?? "Nouvelle discussion"}</span>
                    {i.unread > 0 && <span className="shrink-0 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${i.unread} non lus`}>{i.unread}</span>}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
