import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n";
import * as hub from "../api";

/** Header bell: unread badge, latest notifications, mark read. Content is rendered as plain text nodes only. */
export default function NotificationBell({ unread, onChange }: { unread: number; onChange: (n: number) => void }) {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<hub.HubNotification[] | null>(null);

  const load = async () => {
    try {
      const r = await hub.getNotifications();
      setItems(r.notifications);
    } catch (e) { toast.error((e as Error).message); }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) { setItems(null); load(); }
  };

  const openItem = async (n: hub.HubNotification) => {
    setOpen(false);
    if (!n.read) {
      try { onChange(await hub.markNotificationsRead([n.id])); } catch (e) { toast.error((e as Error).message); }
    }
    // only app-relative links are followed
    if (n.link && n.link.startsWith("/") && !n.link.startsWith("//")) setLocation(`/${lang}${n.link}`);
  };

  const readAll = async () => {
    try {
      onChange(await hub.markNotificationsRead());
      setItems(list => list?.map(n => ({ ...n, read: true })) ?? null);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={`Notifications, ${unread} non lues`}
        className="relative cursor-pointer rounded-lg p-2 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Bell size={20} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white" aria-hidden>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent data-theme="light" align="end" className="w-80 border-slate-200 bg-white p-0 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <button type="button" onClick={readAll} disabled={unread === 0} className="text-xs text-blue-700 underline disabled:text-slate-400 disabled:no-underline">Tout marquer comme lu</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin text-blue-700" aria-label="Chargement" /></div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Aucune notification</p>
          ) : (
            <ul>
              {items.map(n => (
                <li key={n.id} className="border-b border-slate-100 last:border-0">
                  <button type="button" onClick={() => openItem(n)} className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${n.read ? "" : "bg-blue-50/60"}`}>
                    <span className={`block text-sm ${n.read ? "text-slate-700" : "font-bold text-slate-900"}`}>{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-slate-600">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString("fr-FR")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
