import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { 
  Users, ShoppingBag, Heart, Calendar, QrCode, Settings, 
  ArrowRight, Loader2, BarChart3, Package, MessageSquare,
  UserCog, FileText, Home, LogOut, UtensilsCrossed, Store
} from "lucide-react";

export default function Admin() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  
  const { data: volunteerStats } = trpc.volunteers.stats.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.role && ['admin', 'super_admin', 'admin_ops'].includes(user.role),
  });
  
  const { data: orderStats } = trpc.orders.stats.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.role && ['admin', 'super_admin', 'admin_boutique'].includes(user.role),
  });
  
  const { data: donationStats } = trpc.donations.stats.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.role && ['admin', 'super_admin', 'admin_dons'].includes(user.role),
  });
  
  const { data: days } = trpc.days.list.useQuery();

  const isAdmin = user?.role && ['admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner'].includes(user.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageVolunteers = user?.role && ['admin', 'super_admin', 'admin_ops'].includes(user.role);
  const canManageOrders = user?.role && ['admin', 'super_admin', 'admin_boutique'].includes(user.role);
  const canManageDonations = user?.role && ['admin', 'super_admin', 'admin_dons'].includes(user.role);
  const canScan = user?.role && ['admin', 'super_admin', 'admin_ops', 'scanner'].includes(user.role);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <Users className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les droits nécessaires pour accéder à l'administration.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeDays = days?.filter(d => d.isOpen).length || 0;
  const totalDays = days?.length || 0;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg">Administration</h1>
              <p className="text-xs text-muted-foreground">Ftour Bab Rayan</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name || user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Quick Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {canManageVolunteers && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bénévoles</p>
                    <p className="text-3xl font-bold">{volunteerStats?.total || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {volunteerStats?.present || 0} présents
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canManageOrders && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Commandes</p>
                    <p className="text-3xl font-bold">{orderStats?.total || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(orderStats as any)?.totalAmount || 0} DH
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-secondary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canManageDonations && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dons</p>
                    <p className="text-3xl font-bold">{donationStats?.total || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {donationStats?.receivedAmount || 0} DH reçus
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Jours</p>
                  <p className="text-3xl font-bold">{totalDays}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeDays} disponibles
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Scanner */}
          {canScan && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <QrCode className="h-5 w-5 text-primary" />
                  </div>
                  Scanner QR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Scanner les QR codes des bénévoles pour valider leur présence
                </p>
                <Link href="/scanner">
                  <Button className="w-full">
                    Ouvrir le scanner
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Volunteers Management */}
          {canManageVolunteers && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  Bénévoles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les inscriptions et suivre les présences par jour
                </p>
                <Link href="/admin/benevoles">
                  <Button variant="outline" className="w-full">
                    Gérer les bénévoles
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Orders Management */}
          {canManageOrders && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <Package className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  Commandes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les réservations de goodies et leur statut
                </p>
                <Link href="/admin/commandes">
                  <Button variant="outline" className="w-full">
                    Gérer les commandes
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Donations Management */}
          {canManageDonations && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Heart className="h-5 w-5 text-accent" />
                  </div>
                  Dons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Suivre les promesses de dons et marquer les paiements reçus
                </p>
                <Link href="/admin/dons">
                  <Button variant="outline" className="w-full">
                    Gérer les dons
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Goodies Management */}
          {canManageOrders && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  Catalogue Goodies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les produits, variantes et stocks
                </p>
                <Link href="/admin/goodies">
                  <Button variant="outline" className="w-full">
                    Gérer le catalogue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Pastries Management */}
          {canManageOrders && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <UtensilsCrossed className="h-5 w-5 text-amber-600" />
                  </div>
                  Pâtisserie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les commandes et billets de pâtisserie
                </p>
                <Link href="/admin/pastries">
                  <Button variant="outline" className="w-full">
                    Gérer la pâtisserie
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Company Bookings Management */}
          {canManageOrders && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  Réservation Entreprise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les réservations groupe avec QR codes individuels
                </p>
                <Link href="/admin/company-bookings">
                  <Button variant="outline" className="w-full">
                    Gérer les réservations
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Payments Management */}
          {(canManageOrders || canManageDonations) && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                  Paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Suivi et gestion de tous les paiements avec filtres et export
                </p>
                <Link href="/admin/payments">
                  <Button variant="outline" className="w-full">
                    Gérer les paiements
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Days Management */}
          {isSuperAdmin && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  Calendrier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Configurer les jours du Ramadan et leurs capacités
                </p>
                <Link href="/admin/jours">
                  <Button variant="outline" className="w-full">
                    Gérer le calendrier
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Users Management */}
          {isSuperAdmin && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <UserCog className="h-5 w-5 text-purple-600" />
                  </div>
                  Utilisateurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les rôles et permissions des utilisateurs
                </p>
                <Link href="/admin/utilisateurs">
                  <Button variant="outline" className="w-full">
                    Gérer les utilisateurs
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Messages */}
          {isSuperAdmin && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Consulter les messages de contact reçus
                </p>
                <Link href="/admin/messages">
                  <Button variant="outline" className="w-full">
                    Voir les messages
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Content Management */}
          {isSuperAdmin && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-orange-600" />
                  </div>
                  Contenu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérer les partenaires, témoignages et FAQ
                </p>
                <Link href="/admin/contenu">
                  <Button variant="outline" className="w-full">
                    Gérer le contenu
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ftour Solidaire Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-[#5d5a3c]" />
            Ftour Solidaire
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Réservations Management */}
            {canManageVolunteers && (
              <Card className="card-hover border-[#5d5a3c]/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#5d5a3c]/10 flex items-center justify-center">
                      <UtensilsCrossed className="h-5 w-5 text-[#5d5a3c]" />
                    </div>
                    Réservations Ftour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Gérer les réservations pour les repas Ftour solidaires
                  </p>
                  <Link href="/admin/reservations">
                    <Button variant="outline" className="w-full border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10">
                      Gérer les réservations
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Restaurants Management */}
            {isSuperAdmin && (
              <Card className="card-hover border-[#5d5a3c]/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#5d5a3c]/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-[#5d5a3c]" />
                    </div>
                    Restaurants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configurer les restaurants et leurs capacités
                  </p>
                  <Link href="/admin/restaurants">
                    <Button variant="outline" className="w-full border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10">
                      Gérer les restaurants
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Scanner Réservations */}
            {canScan && (
              <Card className="card-hover border-[#5d5a3c]/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#5d5a3c]/10 flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-[#5d5a3c]" />
                    </div>
                    Scanner Réservations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Scanner les QR codes des réservations Ftour
                  </p>
                  <Link href="/admin/scan-reservation">
                    <Button className="w-full bg-[#5d5a3c] hover:bg-[#5d5a3c]/90">
                      Ouvrir le scanner
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Unified Dashboard Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Tableau de bord unifié
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Unified Dashboard */}
            {isSuperAdmin && (
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    Tous les services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Statistiques et gestion unifiées pour tous les modules (Goodies, Pâtisserie, Dons, Ftour)
                  </p>
                  <Link href="/admin/unified-dashboard">
                    <Button variant="outline" className="w-full">
                      Voir le tableau de bord
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
