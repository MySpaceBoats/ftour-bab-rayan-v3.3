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
  ShoppingBag,
  Home,
  Info,
  LogOut,
  LayoutDashboard,
  Globe,
  Lock,
  ShoppingCart,
  UtensilsCrossed,
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
    ].includes(user.role);

  // Fonction pour générer les URLs localisées
  const localizedHref = (path: string) => {
    if (path === "/") return `/${lang}`;
    return `/${lang}${path}`;
  };

  // Nouveau menu principal selon le cahier des charges
  const mainLinks = [
    { href: localizedHref("/"), label: t.nav.home, icon: Home },
    { href: localizedHref("/evenement"), label: t.nav.event, icon: Info },
    {
      href: localizedHref("/reservation"),
      label: t.nav.restaurant,
      icon: UtensilsCrossed,
    },
    { href: localizedHref("/benevole"), label: t.nav.volunteer, icon: Users },
    { href: localizedHref("/galerie"), label: "Galerie", icon: Info },
    {
      href: localizedHref("/boutique"),
      label: t.nav.boutique,
      icon: ShoppingBag,
    },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top Menu (niveau 0) - Menu utilitaire */}
      <div className="bg-[#3A3820] border-b border-[#F2E9D3]/10">
        <div className="container flex h-9 items-center justify-end gap-4 text-sm">
          {/* Cart Icon - Boutique solidaire */}
          <button
            onClick={() => {
              if (cartCount > 0) {
                setIsCartOpen(true);
                setLocation(localizedHref("/goodies"));
              } else {
                setLocation(localizedHref("/boutique"));
              }
            }}
            className="relative flex items-center gap-1 text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors"
            title={t.nav.boutique}
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#F2E9D3] text-[#4A4829] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Admin Link - icône cadenas avec tooltip "Privé" */}
          <Link
            href={localizedHref("/connexion")}
            className="text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors"
            title="Privé"
          >
            <Lock className="h-4 w-4" />
          </Link>

          {/* Admin Link - visible uniquement pour les admins connectés */}
          {isAuthenticated && isAdmin && (
            <Link
              href="/admin"
              className="text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors font-semibold"
            >
              <LayoutDashboard className="h-3 w-3 inline mr-1" />
              {t.nav.administration}
            </Link>
          )}

          {/* Sélecteur de langue */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors" aria-label={t.topMenu.language} title={t.topMenu.language}>
                <Globe className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={dir === "rtl" ? "start" : "end"}
              className="bg-[#4A4829] border-[#F2E9D3]/20"
            >
              {languages.map(language => (
                <DropdownMenuItem
                  key={language.code}
                  onClick={() => setLang(language.code)}
                  className={`text-[#F2E9D3] hover:bg-[#5E5B34] cursor-pointer ${
                    lang === language.code ? "bg-[#5E5B34]" : ""
                  }`}
                >
                  {language.nativeName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Menu Principal (niveau 1) */}
      <div className="bg-[#4A4829] border-b border-[#F2E9D3]/20">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={localizedHref("/")} className="flex items-center gap-3">
            <div className="flex flex-col">
              <span
                className="text-lg font-bold leading-none text-[#F2E9D3]"
                style={{ fontFamily: "Caveat, cursive" }}
              >
                {t.home.heroTitle}
              </span>
              <span
                className="text-xs text-[#CDBB8A]"
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontStyle: "italic",
                }}
              >
                {t.home.heroSubtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {mainLinks.map(link => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-sm text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34] ${
                    location === link.href ? "bg-[#5E5B34] text-[#CDBB8A]" : ""
                  }`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden lg:flex items-center gap-2">
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34]"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.auth.logout}
              </Button>
            )}
            {/* CTA Principal : Devenir bénévole */}
            <Link href={localizedHref("/benevole")}>
              <Button
                size="sm"
                className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3] font-semibold"
              >
                <Users className="h-4 w-4 mr-2" />
                {t.cta.volunteer}
              </Button>
            </Link>
            {/* CTA Secondaire : Faire un don */}
            <Link href={localizedHref("/dons")}>
              <Button
                size="sm"
                variant="outline"
                className="border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829] font-semibold"
              >
                <Heart className="h-4 w-4 mr-2" />
                {t.cta.donate}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="text-[#F2E9D3] hover:bg-[#5E5B34]"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side={dir === "rtl" ? "left" : "right"}
              className="w-[300px] sm:w-[350px] bg-[#4A4829] border-l border-[#F2E9D3]/20"
            >
              <div className="flex flex-col gap-6 mt-6">
                {/* Language Selector Mobile */}
                <div className="flex items-center gap-2 pb-4 border-b border-[#F2E9D3]/20">
                  <Globe className="h-4 w-4 text-[#CDBB8A]" />
                  <div className="flex gap-2">
                    {languages.map(language => (
                      <button
                        key={language.code}
                        onClick={() => setLang(language.code)}
                        className={`px-2 py-1 rounded text-sm ${
                          lang === language.code
                            ? "bg-[#5E5B34] text-[#F2E9D3]"
                            : "text-[#CDBB8A] hover:text-[#F2E9D3]"
                        }`}
                      >
                        {language.nativeName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Links */}
                <nav className="flex flex-col gap-1">
                  {mainLinks.map(link => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                      >
                        <Button
                          variant="ghost"
                          className={`w-full justify-start text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34] ${
                            location === link.href
                              ? "bg-[#5E5B34] text-[#CDBB8A]"
                              : ""
                          }`}
                        >
                          <Icon className="h-4 w-4 mr-3" />
                          {link.label}
                        </Button>
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-[#F2E9D3]/20" />

                {/* Auth & CTA Actions */}
                <div className="flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setIsOpen(false)}>
                          <Button
                            variant="outline"
                            className="w-full border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                          >
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            {t.nav.administration}
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        className="w-full text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34]"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {t.auth.logout}
                      </Button>
                    </>
                  ) : null}

                  {/* CTA Buttons Mobile */}
                  <Link
                    href={localizedHref("/benevole")}
                    onClick={() => setIsOpen(false)}
                  >
                    <Button className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3] font-semibold">
                      <Users className="h-4 w-4 mr-2" />
                      {t.cta.volunteer}
                    </Button>
                  </Link>
                  <Link
                    href={localizedHref("/dons")}
                    onClick={() => setIsOpen(false)}
                  >
                    <Button
                      variant="outline"
                      className="w-full border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829] font-semibold"
                    >
                      <Heart className="h-4 w-4 mr-2" />
                      {t.cta.donate}
                    </Button>
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
