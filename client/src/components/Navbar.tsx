import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { 
  Menu, Heart, Users, ShoppingBag, Home, Info, Phone, Building2, 
  LogOut, LayoutDashboard, Search, Globe, X, ChevronDown
} from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { t, lang, setLang, languages, dir } = useI18n();

  const isAdmin = user?.role && ['admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner'].includes(user.role);

  // Fonction pour générer les URLs localisées
  const localizedHref = (path: string) => {
    if (path === '/') return `/${lang}`;
    return `/${lang}${path}`;
  };

  // Nouveau menu principal selon le cahier des charges
  const mainLinks = [
    { href: localizedHref('/'), label: t.nav.home, icon: Home },
    { href: localizedHref('/evenement'), label: t.nav.event, icon: Info },
    { href: localizedHref('/benevole'), label: t.nav.volunteer, icon: Users },
    { href: localizedHref('/reservation'), label: t.nav.restaurant || 'Restaurant Solidaire', icon: Building2 },
    { href: localizedHref('/goodies'), label: t.nav.goodies, icon: ShoppingBag },
    { href: localizedHref('/association'), label: t.association.title, icon: Building2 },
    { href: localizedHref('/contact'), label: t.nav.contact, icon: Phone },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redirect to search results page
      window.location.href = `/recherche?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Close search on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top Menu (niveau 0) - Menu utilitaire */}
      <div className="bg-[#3A3820] border-b border-[#F2E9D3]/10">
        <div className="container flex h-9 items-center justify-end gap-4 text-sm">
          {/* Recherche */}
          <div className="relative flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2 animate-in slide-in-from-right-2">
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder={t.nav.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 w-48 bg-[#4A4829] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#CDBB8A]/60 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-[#CDBB8A] hover:text-[#F2E9D3]"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1 text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Support Link - pointe vers la page de connexion pour les admins */}
          <Link href={localizedHref('/connexion')} className="text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors">
            {t.nav.support}
          </Link>
          
          {/* Admin Link - visible uniquement pour les admins connectés */}
          {isAuthenticated && isAdmin && (
            <Link href="/admin" className="text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors font-semibold">
              <LayoutDashboard className="h-3 w-3 inline mr-1" />
              {t.nav.administration}
            </Link>
          )}

          {/* Téléphone */}
          <a 
            href="tel:+212664887978" 
            className="hidden sm:flex items-center gap-1 text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors"
          >
            <Phone className="h-3 w-3" />
            <span>+212 664-887978</span>
          </a>

          {/* Sélecteur de langue */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-[#CDBB8A] hover:text-[#F2E9D3] transition-colors">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{languages.find(l => l.code === lang)?.name}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={dir === 'rtl' ? 'start' : 'end'} className="bg-[#4A4829] border-[#F2E9D3]/20">
              {languages.map((language) => (
                <DropdownMenuItem
                  key={language.code}
                  onClick={() => setLang(language.code)}
                  className={`text-[#F2E9D3] hover:bg-[#5E5B34] cursor-pointer ${
                    lang === language.code ? 'bg-[#5E5B34]' : ''
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
          <Link href={localizedHref('/')} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center">
              <svg viewBox="0 0 40 40" className="h-10 w-10">
                <path 
                  d="M20 8c-2 0-4 1-5 3-1-2-3-3-5-3-4 0-7 3-7 7 0 8 12 16 12 16s12-8 12-16c0-4-3-7-7-7z" 
                  fill="none" 
                  stroke="#F2E9D3" 
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="12" y1="14" x2="16" y2="18" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
                <line x1="14" y1="12" x2="18" y2="16" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
                <line x1="16" y1="14" x2="20" y2="18" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-none text-[#F2E9D3]" style={{ fontFamily: 'Caveat, cursive' }}>
                {t.home.heroTitle}
              </span>
              <span className="text-xs text-[#CDBB8A]" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
                {t.home.heroSubtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {mainLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-sm text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34] ${
                    location === link.href ? 'bg-[#5E5B34] text-[#CDBB8A]' : ''
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
            <Link href={localizedHref('/benevole')}>
              <Button 
                size="sm" 
                className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3] font-semibold"
              >
                <Users className="h-4 w-4 mr-2" />
                {t.cta.volunteer}
              </Button>
            </Link>
            {/* CTA Secondaire : Faire un don */}
            <Link href={localizedHref('/dons')}>
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
              <Button variant="ghost" size="icon" className="text-[#F2E9D3] hover:bg-[#5E5B34]">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side={dir === 'rtl' ? 'left' : 'right'} 
              className="w-[300px] sm:w-[350px] bg-[#4A4829] border-l border-[#F2E9D3]/20"
            >
              <div className="flex flex-col gap-6 mt-6">
                {/* Language Selector Mobile */}
                <div className="flex items-center gap-2 pb-4 border-b border-[#F2E9D3]/20">
                  <Globe className="h-4 w-4 text-[#CDBB8A]" />
                  <div className="flex gap-2">
                    {languages.map((language) => (
                      <button
                        key={language.code}
                        onClick={() => setLang(language.code)}
                        className={`px-2 py-1 rounded text-sm ${
                          lang === language.code 
                            ? 'bg-[#5E5B34] text-[#F2E9D3]' 
                            : 'text-[#CDBB8A] hover:text-[#F2E9D3]'
                        }`}
                      >
                        {language.nativeName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Links */}
                <nav className="flex flex-col gap-1">
                  {mainLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                        <Button
                          variant="ghost"
                          className={`w-full justify-start text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34] ${
                            location === link.href ? 'bg-[#5E5B34] text-[#CDBB8A]' : ''
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

                {/* Phone */}
                <a 
                  href="tel:+212664887978" 
                  className="flex items-center gap-2 text-[#CDBB8A] hover:text-[#F2E9D3] px-4"
                >
                  <Phone className="h-4 w-4" />
                  <span>+212 664-887978</span>
                </a>

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
                  <Link href={localizedHref('/benevole')} onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3] font-semibold">
                      <Users className="h-4 w-4 mr-2" />
                      {t.cta.volunteer}
                    </Button>
                  </Link>
                  <Link href={localizedHref('/dons')} onClick={() => setIsOpen(false)}>
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
