import type { ReactNode } from "react";
import { Link } from "wouter";
import { Home, LogOut, Newspaper, Store, User } from "lucide-react";
import { useI18n } from "@/i18n";
import * as hub from "../api";
import Avatar from "./Avatar";

/** Dedicated app frame for the volunteer space: top bar, side columns (desktop), tab bar (mobile). */
export default function HubShell({ me, right, children }: { me: hub.Member; right?: ReactNode; children: ReactNode }) {
  const { lang } = useI18n();
  const base = `/${lang}/benevole/espace`;
  const logout = async () => {
    await hub.logout().catch(() => undefined);
    window.location.assign(base);
  };
  const link = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";

  return (
    <div className="min-h-screen bg-slate-100 pb-16 lg:pb-0">
      <header className="sticky top-0 z-40 bg-blue-800 text-white shadow">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href={base} className="flex items-center gap-2 font-bold">
            <img src="/logo-bab-rayan.svg" alt="" className="h-8 w-8 rounded bg-white p-0.5" />
            Espace bénévole
          </Link>
          <details className="relative">
            <summary aria-label="Menu du compte" className="flex cursor-pointer list-none items-center gap-2">
              <span className="hidden text-sm sm:inline">{me.display_name}</span>
              <Avatar name={me.display_name} src={me.avatar} size={36} />
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-lg bg-white py-1 text-sm text-slate-800 shadow-lg ring-1 ring-slate-200">
              <Link href={`${base}/profil`} className="block px-4 py-2 hover:bg-slate-100">Mon profil</Link>
              <Link href={`/${lang}`} className="block px-4 py-2 hover:bg-slate-100">Retour au site</Link>
              <button type="button" onClick={logout} className="block w-full px-4 py-2 text-left hover:bg-slate-100">Se déconnecter</button>
            </div>
          </details>
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
              <Link href={base} className={link}><Newspaper size={18} /> Fil d'actualité</Link>
              <Link href={`${base}/marketplace`} className={link}><Store size={18} /> Marketplace</Link>
              <Link href={`${base}/profil`} className={link}><User size={18} /> Mon profil</Link>
              <Link href={`/${lang}`} className={link}><Home size={18} /> Retour au site</Link>
              <button type="button" onClick={logout} className={`${link} w-full`}><LogOut size={18} /> Se déconnecter</button>
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">{children}</main>

        {right && <aside className="hidden xl:block"><div className="sticky top-[72px] space-y-3">{right}</div></aside>}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white text-xs text-slate-700 lg:hidden" aria-label="Navigation mobile">
        <Link href={base} className="flex flex-col items-center gap-0.5 py-2"><Newspaper size={20} />Fil</Link>
        <Link href={`${base}/marketplace`} className="flex flex-col items-center gap-0.5 py-2"><Store size={20} />Marketplace</Link>
        <Link href={`${base}/profil`} className="flex flex-col items-center gap-0.5 py-2"><User size={20} />Profil</Link>
        <Link href={`/${lang}`} className="flex flex-col items-center gap-0.5 py-2"><Home size={20} />Site</Link>
      </nav>
    </div>
  );
}
