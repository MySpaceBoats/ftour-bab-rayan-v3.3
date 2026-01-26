import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Menu, X, Heart, Users, ShoppingBag, Calendar, Home, Info, Phone, HelpCircle, Building2, LogOut, LayoutDashboard } from "lucide-react";

const publicLinks = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/evenement", label: "L'événement", icon: Info },
  { href: "/programme", label: "Programme", icon: Calendar },
  { href: "/benevole", label: "Devenir bénévole", icon: Users },
  { href: "/goodies", label: "Goodies", icon: ShoppingBag },
  { href: "/dons", label: "Faire un don", icon: Heart },
];

const secondaryLinks = [
  { href: "/association", label: "Association", icon: Building2 },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/contact", label: "Contact", icon: Phone },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const isAdmin = user?.role && ['admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner'].includes(user.role);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#4A4829] border-b border-[#F2E9D3]/20">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          {/* Logo mains + cœur hachuré */}
          <div className="flex h-10 w-10 items-center justify-center">
            <svg viewBox="0 0 40 40" className="h-10 w-10">
              {/* Mains stylisées */}
              <path 
                d="M20 8c-2 0-4 1-5 3-1-2-3-3-5-3-4 0-7 3-7 7 0 8 12 16 12 16s12-8 12-16c0-4-3-7-7-7z" 
                fill="none" 
                stroke="#F2E9D3" 
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Lignes hachurées dans le cœur */}
              <line x1="12" y1="14" x2="16" y2="18" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
              <line x1="14" y1="12" x2="18" y2="16" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
              <line x1="16" y1="14" x2="20" y2="18" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-none text-[#F2E9D3]" style={{ fontFamily: 'Caveat, cursive' }}>Ftour Bab Rayan</span>
            <span className="text-xs text-[#CDBB8A]" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>12e édition — 2026</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {publicLinks.map((link) => (
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

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link href="/admin">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                  >
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34]"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </>
          ) : (
            <Link href="/connexion">
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
              >
                Connexion
              </Button>
            </Link>
          )}
          <Link href="/benevole">
            <Button 
              size="sm" 
              className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3]"
            >
              <Users className="h-4 w-4 mr-2" />
              Devenir bénévole
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
          <SheetContent side="right" className="w-[300px] sm:w-[350px] bg-[#4A4829] border-l border-[#F2E9D3]/20">
            <div className="flex flex-col gap-6 mt-6">
              {/* Main Links */}
              <nav className="flex flex-col gap-1">
                {publicLinks.map((link) => {
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

              {/* Secondary Links */}
              <nav className="flex flex-col gap-1">
                {secondaryLinks.map((link) => {
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

              {/* Auth Actions */}
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
                          Administration
                        </Button>
                      </Link>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full text-[#F2E9D3] hover:text-[#CDBB8A] hover:bg-[#5E5B34]" 
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Déconnexion
                    </Button>
                  </>
                ) : (
                  <Link href="/connexion" onClick={() => setIsOpen(false)}>
                    <Button 
                      variant="outline" 
                      className="w-full border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                    >
                      Connexion
                    </Button>
                  </Link>
                )}
                <Link href="/benevole" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3]">
                    <Users className="h-4 w-4 mr-2" />
                    Devenir bénévole
                  </Button>
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
