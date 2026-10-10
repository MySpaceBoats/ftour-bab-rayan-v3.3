import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import type * as hub from "../api";
import HubShell from "../components/HubShell";
import * as api from "./pro-api";

export type ProTab = "feed" | "jobs" | "messages";
const TABS: { key: ProTab; label: string; to: string }[] = [
  { key: "feed", label: "Feed", to: "" },
  { key: "jobs", label: "Emplois", to: "/emplois" },
  { key: "messages", label: "Messages", to: "/messages" },
];

/** Hub frame + the Pro tab bar (Feed · Emplois · Messages). `active = null` for pages outside the tabs (profiles). */
export default function ProLayout({ me, active, children }: { me: hub.Member; active: ProTab | null; children: ReactNode }) {
  const { lang } = useI18n();
  const base = `/${lang}/benevole/espace/pro`;
  const [unread, setUnread] = useState(0);
  // ponytail: poll every 30 s instead of push notifications (same as HubShell's marketplace counter)
  useEffect(() => {
    let alive = true;
    const tick = () => { api.unreadCount().then(n => { if (alive) setUnread(n); }).catch(() => undefined); };
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <HubShell me={me}>
      <nav aria-label="Navigation Pro" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(t => (
          <Link key={t.key} href={`${base}${t.to}`} aria-current={active === t.key ? "page" : undefined}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold ${active === t.key ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {t.label}
            {t.key === "messages" && unread > 0 && <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-700" aria-label={`${unread} messages non lus`}>{unread}</span>}
          </Link>
        ))}
        <Link href={`${base}/profil`} className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">Mon profil pro</Link>
      </nav>
      {children}
    </HubShell>
  );
}
