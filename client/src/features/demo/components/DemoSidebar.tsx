import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Users,
  HandCoins,
  UtensilsCrossed,
  Handshake,
  Home as HomeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/demo/dashboard", label: "Tableau de bord", icon: BarChart3 },
  { href: "/demo/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/demo/dons", label: "Dons", icon: HandCoins },
  { href: "/demo/ftour", label: "Ftour", icon: UtensilsCrossed },
  { href: "/demo/partenaires", label: "Partenaires", icon: Handshake },
];

interface DemoSidebarProps {
  onNavigate?: () => void;
}

export function DemoSidebar({ onNavigate }: DemoSidebarProps) {
  const [location] = useLocation();

  return (
    <nav
      className="flex h-full flex-col gap-1 p-3"
      aria-label="Navigation démo"
    >
      <div className="mb-2 px-2 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-lg font-bold text-white">
            F
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">Ftour Bab Rayan</div>
            <div className="text-[11px] font-medium text-orange-600">Démo interactive</div>
          </div>
        </Link>
      </div>

      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200"
                : "text-slate-700 hover:bg-slate-100",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-orange-600" : "text-slate-500 group-hover:text-slate-700",
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-auto border-t border-slate-100 pt-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          <HomeIcon className="h-4 w-4" aria-hidden="true" />
          Retour au site public
        </Link>
      </div>
    </nav>
  );
}
