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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-none text-foreground">Ftour</span>
            <span className="text-xs text-muted-foreground">Bab Rayan</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {publicLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant={location === link.href ? "secondary" : "ghost"}
                size="sm"
                className="text-sm"
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
                  <Button variant="outline" size="sm">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </>
          ) : (
            <a href={getLoginUrl()}>
              <Button variant="outline" size="sm">
                Connexion
              </Button>
            </a>
          )}
          <Link href="/benevole">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Users className="h-4 w-4 mr-2" />
              S'inscrire
            </Button>
          </Link>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[350px]">
            <div className="flex flex-col gap-6 mt-6">
              {/* Main Links */}
              <nav className="flex flex-col gap-1">
                {publicLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                      <Button
                        variant={location === link.href ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {link.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-border" />

              {/* Secondary Links */}
              <nav className="flex flex-col gap-1">
                {secondaryLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                      <Button
                        variant={location === link.href ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {link.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-border" />

              {/* Auth Actions */}
              <div className="flex flex-col gap-2">
                {isAuthenticated ? (
                  <>
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Administration
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" className="w-full" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Déconnexion
                    </Button>
                  </>
                ) : (
                  <a href={getLoginUrl()}>
                    <Button variant="outline" className="w-full">
                      Connexion
                    </Button>
                  </a>
                )}
                <Link href="/benevole" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-primary hover:bg-primary/90">
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
