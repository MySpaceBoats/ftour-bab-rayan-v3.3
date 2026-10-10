import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, LogOut, Mail, Newspaper, Store, User } from "lucide-react";
import { useI18n } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as hub from "../api";
import Avatar from "./Avatar";
import * as mk from "../market/market-api";

/** Dedicated app frame for the volunteer space: top bar, side columns (desktop), tab bar (mobile). */
export default function HubShell({ me, right, children }: { me: hub.Member; right?: ReactNode; children: ReactNode }) {
  const { lang } = useI18n();
  const [path] = useLocation();
  const base = `/${lang}/benevole/espace`;
  const feed = base;
  const market = `${base}/marketplace`;
  const messages = `${market}/messages`;
  const profile = `${base}/profil`;
  const [unread, setUnread] = useState(0);
  // ponytail: poll the unread counter every 30 s instead of push notifications
  useEffect(() => {
    let alive = true;
    const tick = () => { mk.unreadCount().then(n => { if (alive) setUnread(n); }).catch(() => undefined); };
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const logout = async () => {
    await hub.logout().catch(() => undefined);
    window.location.assign(base);
  };
  const link = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";
  const activeLink = `${link} bg-blue-50 font-semibold text-blue-800 hover:bg-blue-50`;
  const tab = "flex flex-col items-center gap-0.5 py-2";
  const activeTab = `${tab} font-semibold text-blue-800`;

  // The feed link must stay exact, otherwise it would also match every nested route.
  const isFeed = path === feed || path === `${feed}/`;
  const isMessages = path.startsWith(messages);
  const isMarket = path.startsWith(market) && !isMessages;
  const isProfile = path.startsWith(profile);

  const navLinks = [
    { href: feed, label: "Fil d'actualité", icon: <Newspaper size={18} aria-hidden />, active: isFeed },
    { href: market, label: "Marketplace", icon: <Store size={18} aria-hidden />, active: isMarket },
    { href: messages, label: "Mes messages", icon: <Mail size={18} aria-hidden />, active: isMessages, badge: unread },
    { href: profile, label: "Mon profil", icon: <User size={18} aria-hidden />, active: isProfile },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-16 lg:pb-0">
      <a
        href="#hub-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-blue-800 focus:shadow-lg"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-40 bg-blue-800 text-white shadow">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href={feed} className="flex items-center gap-2 font-bold">
            <img src="/logo-bab-rayan.svg" alt="" className="h-8 w-8 rounded bg-white p-0.5" />
            Espace bénévole
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Menu du compte de ${me.display_name}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="hidden text-sm sm:inline">{me.display_name}</span>
              <Avatar name={me.display_name} src={me.avatar} size={36} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{me.display_name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={profile} className="cursor-pointer">Mon profil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={messages} className="cursor-pointer" aria-current={isMessages ? "page" : undefined}>
                  Mes messages{unread > 0 ? ` (${unread})` : ""}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${lang}`} className="cursor-pointer">Retour au site</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout} className="cursor-pointer">
                <LogOut size={16} aria-hidden /> Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-3 py-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="hidden lg:block">
          <div className="sticky top-[72px] space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <div className="flex justify-center"><Avatar name={me.display_name} src={me.avatar} size={72} /></div>
              <p className="mt-2 font-semibold text-slate-900">{me.display_name}</p>
              {me.bio && <p className="mt-1 text-sm text-slate-600 break-words">{me.bio}</p>}
            </div>
            <nav className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Navigation de l'espace">
              {navLinks.map(l => (
                <Link key={l.href} href={l.href} className={l.active ? activeLink : link} aria-current={l.active ? "page" : undefined}>
                  {l.icon} {l.label}
                  {!!l.badge && l.badge > 0 && (
                    <span className="ml-auto rounded-full bg-blue-700 px-2 text-xs font-semibold text-white" aria-label={`${l.badge} messages non lus`}>{l.badge}</span>
                  )}
                </Link>
              ))}
              <Link href={`/${lang}`} className={link}><Home size={18} aria-hidden /> Retour au site</Link>
              <button type="button" onClick={logout} className={`${link} w-full`}><LogOut size={18} aria-hidden /> Se déconnecter</button>
            </nav>
          </div>
        </aside>

        <main id="hub-main" className="min-w-0 space-y-4">{children}</main>

        {right && <aside className="hidden xl:block"><div className="sticky top-[72px] space-y-3">{right}</div></aside>}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white text-xs text-slate-700 lg:hidden" aria-label="Navigation mobile">
        {navLinks.map(l => (
          <Link key={l.href} href={l.href} className={l.active ? activeTab : tab} aria-current={l.active ? "page" : undefined}>
            <span className="relative">
              {l.icon}
              {!!l.badge && l.badge > 0 && <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden />}
            </span>
            {l.label === "Fil d'actualité" ? "Fil" : l.label === "Mes messages" ? "Messages" : l.label === "Mon profil" ? "Profil" : l.label}
            {!!l.badge && l.badge > 0 && <span className="sr-only">{l.badge} messages non lus</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
