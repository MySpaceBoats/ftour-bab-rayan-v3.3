import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useCart } from "@/contexts/CartContext";
import {
  Menu,
  Heart,
  Users,
  Handshake,
  ShoppingBag,
  Home,
  Info,
  LogOut,
  LayoutDashboard,
  Globe,
  Lock,
  ShoppingCart,
  UserCircle2,
  Star,
  X,
} from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { t, lang, setLang, languages, dir } = useI18n();
  const { cartCount, setIsCartOpen } = useCart();

  const isAdmin =
    user?.role &&
    [
      "admin",
      "super_admin",
      "admin_ops",
      "admin_boutique",
      "admin_dons",
      "scanner",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
      "admin_patisserie",
      "admin_terroir",
      "admin_contenu",
      "admin_messages",
    ].includes(user.role);

  const localizedHref = (path: string) => {
    if (path === "/") return `/${lang}`;
    return `/${lang}${path}`;
  };

  const trackNavCtaClick = (label: string) => {
    if (typeof window === "undefined") return;
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", "nav_cta_click", { label });
    }
  };

  const mainLinks = [
    { href: localizedHref("/"), label: t.nav.home, icon: Home },
    { href: localizedHref("/evenement"), label: t.nav.event, icon: Info },
    { href: localizedHref("/benevole"), label: t.nav.volunteer, icon: Users },
    { href: localizedHref("/commerce-solidaire"), label: t.nav.commerceSolidaire, icon: ShoppingBag },
    { href: localizedHref("/dons"), label: "Donation", icon: Heart },
    { href: localizedHref("/equipe-ftour"), label: t.nav.team, icon: Star },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Barre utilitaire supérieure */}
      <div
        style={{ background: "#070E1A", borderBottom: "1px solid rgba(248,250,252,0.06)" }}
      >
        <div className="container flex h-9 items-center justify-end gap-5 text-sm">
          {/* Cart */}
          <button
            onClick={() => {
              if (cartCount > 0) {
                setIsCartOpen(true);
                setLocation(localizedHref("/goodies"));
              } else {
                setLocation(localizedHref("/boutique"));
              }
            }}
            className="relative flex items-center gap-1.5 text-slate-400 hover:text-sky-400 transition-colors duration-150"
            title={t.nav.boutique}
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2.5 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Espace bénévole */}
          {isAuthenticated && !isAdmin && (
            <Link
              href={localizedHref("/profil-benevole")}
              className="flex items-center gap-1.5 text-slate-400 hover:text-sky-400 transition-colors"
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline">Espace bénévole</span>
            </Link>
          )}

          {/* Admin */}
          {isAuthenticated && isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors font-medium"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="text-xs hidden sm:inline">{t.nav.administration}</span>
            </Link>
          )}

          {/* Sélecteur de langue */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center text-slate-400 hover:text-sky-400 transition-colors"
                aria-label={t.topMenu.language}
              >
                <Globe className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={dir === "rtl" ? "start" : "end"}
              style={{ background: "#1E293B", border: "1px solid rgba(248,250,252,0.08)" }}
            >
              {languages.map(language => (
                <DropdownMenuItem
                  key={language.code}
                  onClick={() => setLang(language.code)}
                  className={`text-slate-200 hover:bg-blue-600/20 cursor-pointer ${
                    lang === language.code ? "text-sky-400 bg-blue-600/10" : ""
                  }`}
                >
                  {language.nativeName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connexion privée */}
          <Link
            href={localizedHref("/connexion")}
            className="text-slate-400 hover:text-sky-400 transition-colors"
            title="Privé"
          >
            <Lock className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Barre de navigation principale */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.96)",
          borderBottom: "1px solid rgba(248,250,252,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={localizedHref("/")} className="flex items-center gap-3 group">
            {/* Icône géométrique */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 transition-all duration-200 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                boxShadow: "0 0 16px rgba(37,99,235,0.3)",
              }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M12 3C8.5 3 6 5.5 6 8.5 6 14 12 20 12 20s6-6 6-11.5C18 5.5 15.5 3 12 3z"
                  fill="white"
                  opacity="0.9"
                />
                <path
                  d="M9 9h6M10 12h4M11 15h2"
                  stroke="rgba(15,23,42,0.7)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className="text-base font-bold tracking-tight text-white"
                style={{ fontFamily: "Plus Jakarta Sans, Inter, sans-serif", fontWeight: 700 }}
              >
                Ftour Bab Rayan
              </span>
              <span
                className="text-[10px] text-sky-400 tracking-widest uppercase"
                style={{ fontFamily: "Cormorant Garamond, serif", fontStyle: "italic", letterSpacing: "0.12em" }}
              >
                13e Édition
              </span>
            </div>
          </Link>

          {/* Navigation desktop */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {mainLinks.map(link => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <button
                    className={`relative px-3.5 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                      isActive
                        ? "text-white bg-blue-600/20"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                        style={{ background: "#38BDF8" }}
                      />
                    )}
                    {link.label}
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* CTA desktop */}
          <div className="hidden lg:flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-md hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
                {t.auth.logout}
              </button>
            )}
            <Link href={localizedHref("/dons")}>
              <button
                onClick={() => trackNavCtaClick("faire_un_don")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg border border-white/20 hover:bg-white/8 hover:border-white/40 transition-all duration-150"
              >
                <Heart className="h-4 w-4 text-rose-400" />
                {t.cta.donate}
              </button>
            </Link>
            <Link href={localizedHref("/devenir-partenaire")}>
              <button
                onClick={() => trackNavCtaClick("devenir_partenaire")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-150"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)",
                  boxShadow: "0 2px 12px rgba(37,99,235,0.35)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(37,99,235,0.55)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(37,99,235,0.35)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <Handshake className="h-4 w-4" />
                {t.cta.partner}
              </button>
            </Link>
          </div>

          {/* Mobile burger */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 transition-all"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side={dir === "rtl" ? "left" : "right"}
              className="w-[300px] sm:w-[340px] p-0"
              style={{ background: "#0F172A", border: "none" }}
            >
              {/* Header mobile menu */}
              <div
                className="flex items-center justify-between px-6 py-5"
                style={{ borderBottom: "1px solid rgba(248,250,252,0.08)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "linear-gradient(135deg, #1E3A8A, #2563EB)" }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                      <path d="M12 3C8.5 3 6 5.5 6 8.5 6 14 12 20 12 20s6-6 6-11.5C18 5.5 15.5 3 12 3z" fill="white" opacity="0.9" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-white" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    Ftour Bab Rayan
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-5 px-4 py-6">
                {/* Sélecteur de langue mobile */}
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-slate-500" />
                  <div className="flex gap-1.5">
                    {languages.map(language => (
                      <button
                        key={language.code}
                        onClick={() => setLang(language.code)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          lang === language.code
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-white hover:bg-white/8"
                        }`}
                      >
                        {language.nativeName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Liens principaux */}
                <nav className="flex flex-col gap-0.5">
                  {mainLinks.map(link => {
                    const Icon = link.icon;
                    const isActive = location === link.href;
                    return (
                      <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                        <div
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            isActive
                              ? "bg-blue-600/20 text-white border border-blue-600/20"
                              : "text-slate-300 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? "text-sky-400" : "text-slate-500"}`} />
                          {link.label}
                        </div>
                      </Link>
                    );
                  })}
                </nav>

                <div style={{ height: 1, background: "rgba(248,250,252,0.08)" }} />

                {/* Actions auth & CTA */}
                <div className="flex flex-col gap-2.5">
                  {isAuthenticated && (
                    <>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setIsOpen(false)}>
                          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all">
                            <LayoutDashboard className="h-4 w-4 text-slate-500" />
                            {t.nav.administration}
                          </div>
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all w-full text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        {t.auth.logout}
                      </button>
                    </>
                  )}

                  <Link href={localizedHref("/benevole")} onClick={() => setIsOpen(false)}>
                    <div
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white transition-all"
                      style={{ background: "linear-gradient(135deg, #1D4ED8, #2563EB)", boxShadow: "0 2px 12px rgba(37,99,235,0.4)" }}
                    >
                      <Users className="h-4 w-4" />
                      {t.cta.volunteer}
                    </div>
                  </Link>
                  <Link href={localizedHref("/dons")} onClick={() => setIsOpen(false)}>
                    <div className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white border border-white/15 hover:bg-white/5 transition-all">
                      <Heart className="h-4 w-4 text-rose-400" />
                      {t.cta.donate}
                    </div>
                  </Link>
                  <Link href={localizedHref("/devenir-partenaire")} onClick={() => setIsOpen(false)}>
                    <div className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-sky-400 border border-sky-400/25 hover:bg-sky-400/5 transition-all">
                      <Handshake className="h-4 w-4" />
                      {t.cta.partner}
                    </div>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
