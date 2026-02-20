import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Users, ShoppingBag, Heart, Calendar, QrCode,
  ArrowRight, Loader2, BarChart3, Package, MessageSquare,
  UserCog, FileText, Home, LogOut, UtensilsCrossed, Store,
  UsersRound, CakeSlice, type LucideIcon
} from "lucide-react";

// ============================================
// MODULE REGISTRY
// ============================================

type ModuleDefinition = {
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  allowedRoles: string[];
  variant?: 'default' | 'primary' | 'accent';
  buttonClass?: string;
};

type SectionDefinition = {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  modules: ModuleDefinition[];
  borderClass?: string;
};

const ALL_ADMIN_ROLES = ['admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner', 'admin_restaurant', 'admin_patisserie', 'admin_terroir'];

const sections: SectionDefinition[] = [
  {
    title: "Restaurant",
    icon: UtensilsCrossed,
    iconColor: "text-[#5d5a3c]",
    borderClass: "border-[#5d5a3c]/20",
    modules: [
      {
        label: "Réservations Groupes ou Entreprises",
        description: "Réservations groupes ou entreprises (assos, familles, délégations, entreprises) soumises à confirmation",
        route: "/admin/restaurant/groupes",
        icon: UsersRound,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: ['admin', 'super_admin', 'admin_restaurant'],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
      {
        label: "Réservations Entreprises",
        description: "Réservations entreprises (10-120 places) soumises à confirmation",
        route: "/admin/restaurant/entreprises",
        icon: Users,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: ['admin', 'super_admin', 'admin_restaurant'],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
      {
        label: "Réservations Ftour",
        description: "Gérer les réservations pour les repas Ftour Solidaires",
        route: "/admin/reservations",
        icon: UtensilsCrossed,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: ['admin', 'super_admin', 'admin_ops'],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
      {
        label: "Restaurants",
        description: "Configurer les restaurants et leurs capacités",
        route: "/admin/restaurants",
        icon: Store,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: ['super_admin'],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
      {
        label: "Scanner Réservations",
        description: "Scanner les QR codes des réservations Ftour",
        route: "/admin/scan-reservation",
        icon: QrCode,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: ['admin', 'super_admin', 'admin_ops', 'scanner'],
        variant: 'primary',
        buttonClass: "bg-[#5d5a3c] hover:bg-[#5d5a3c]/90 text-white",
      },
    ],
  },
  {
    title: "Commerce",
    modules: [
      {
        label: "Commandes Goodies",
        description: "Gérer les réservations de goodies et leur statut",
        route: "/admin/commandes",
        icon: Package,
        iconColor: "text-secondary-foreground",
        iconBg: "bg-secondary/20",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique'],
      },
      {
        label: "Catalogue Goodies",
        description: "Gérer les produits, variantes et stocks",
        route: "/admin/goodies",
        icon: ShoppingBag,
        iconColor: "text-secondary-foreground",
        iconBg: "bg-secondary/20",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique'],
      },
      {
        label: "Commandes Pâtisserie",
        description: "Gérer les commandes et billets de pâtisserie",
        route: "/admin/pastries",
        icon: UtensilsCrossed,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique', 'admin_patisserie'],
      },
      {
        label: "Catalogue Pâtisserie",
        description: "Ajouter, modifier et gérer les produits pâtisserie",
        route: "/admin/patisserie/catalogue",
        icon: CakeSlice,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique', 'admin_patisserie'],
      },
      {
        label: "Commandes Terroir",
        description: "Suivi des commandes de produits du terroir",
        route: "/admin/terroir/orders",
        icon: Package,
        iconColor: "text-emerald-700",
        iconBg: "bg-emerald-100",
        allowedRoles: ['admin', 'super_admin', 'admin_terroir'],
      },
      {
        label: "Catalogue Terroir",
        description: "Gérer les produits du terroir, variantes et stocks",
        route: "/admin/terroir/products",
        icon: ShoppingBag,
        iconColor: "text-emerald-700",
        iconBg: "bg-emerald-100",
        allowedRoles: ['admin', 'super_admin', 'admin_terroir'],
      },
      {
        label: "Réservation Entreprise",
        description: "Gérer les réservations groupe avec QR codes individuels",
        route: "/admin/company-bookings",
        icon: Users,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-100",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique'],
      },
      {
        label: "Paiements",
        description: "Suivi et gestion de tous les paiements avec filtres et export",
        route: "/admin/payments",
        icon: BarChart3,
        iconColor: "text-green-600",
        iconBg: "bg-green-100",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique', 'admin_dons', 'admin_terroir'],
      },
      {
        label: "QR Codes Catalogue",
        description: "Tous les QR codes produits (goodies, pâtisserie, terroir, dons)",
        route: "/admin/qr-codes",
        icon: QrCode,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-100",
        allowedRoles: ['admin', 'super_admin', 'admin_boutique', 'admin_patisserie', 'admin_terroir', 'admin_dons'],
      },
    ],
  },
  {
    title: "Solidarité",
    modules: [
      {
        label: "Dons",
        description: "Suivre les promesses de dons et marquer les paiements reçus",
        route: "/admin/dons",
        icon: Heart,
        iconColor: "text-accent",
        iconBg: "bg-accent/10",
        allowedRoles: ['admin', 'super_admin', 'admin_dons'],
      },
    ],
  },
  {
    title: "Task Force",
    modules: [
      {
        label: "Bénévoles",
        description: "Gérer les inscriptions et suivre les présences par jour",
        route: "/admin/benevoles",
        icon: Users,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
        allowedRoles: ['admin', 'super_admin', 'admin_ops'],
      },
      {
        label: "Scanner QR",
        description: "Scanner les QR codes des bénévoles pour valider leur présence",
        route: "/scanner",
        icon: QrCode,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
        allowedRoles: ['admin', 'super_admin', 'admin_ops', 'scanner'],
        variant: 'primary',
      },
    ],
  },
  {
    title: "Goodies",
    modules: [
      {
        label: "Calendrier",
        description: "Configurer les jours du Ramadan et leurs capacités",
        route: "/admin/jours",
        icon: Calendar,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        allowedRoles: ['super_admin'],
      },
      {
        label: "Scanner Produits",
        description: "Scanner les QR codes des produits et commandes",
        route: "/admin/scan-product",
        icon: QrCode,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-100",
        allowedRoles: ['admin', 'super_admin', 'admin_ops', 'scanner'],
      },
    ],
  },
  {
    title: "Système",
    modules: [
      {
        label: "Utilisateurs",
        description: "Gérer les rôles et permissions des utilisateurs",
        route: "/admin/utilisateurs",
        icon: UserCog,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-100",
        allowedRoles: ['super_admin'],
      },
      {
        label: "Messages",
        description: "Consulter les messages de contact reçus",
        route: "/admin/messages",
        icon: MessageSquare,
        iconColor: "text-green-600",
        iconBg: "bg-green-100",
        allowedRoles: ['super_admin'],
      },
      {
        label: "Contenu",
        description: "Gérer les partenaires, témoignages et FAQ",
        route: "/admin/contenu",
        icon: FileText,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-100",
        allowedRoles: ['super_admin'],
      },
      {
        label: "Tableau de bord unifié",
        description: "Statistiques et gestion unifiées pour tous les modules",
        route: "/admin/unified-dashboard",
        icon: BarChart3,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        allowedRoles: ['super_admin'],
      },
    ],
  },
];

// ============================================
// COMPONENT
// ============================================

export default function Admin() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = user?.role && ALL_ADMIN_ROLES.includes(user.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageVolunteers = user?.role && ['admin', 'super_admin', 'admin_ops'].includes(user.role);
  const canManageOrders = user?.role && ['admin', 'super_admin', 'admin_boutique'].includes(user.role);
  const canManageDonations = user?.role && ['admin', 'super_admin', 'admin_dons'].includes(user.role);
  const canManageRestaurant = user?.role && ['admin', 'super_admin', 'admin_restaurant', 'admin_ops'].includes(user.role);

  const { data: volunteerStats } = trpc.volunteers.stats.useQuery(undefined, {
    enabled: isAuthenticated && !!canManageVolunteers,
  });

  const { data: orderStats } = trpc.orders.stats.useQuery(undefined, {
    enabled: isAuthenticated && !!canManageOrders,
  });

  const { data: donationStats } = trpc.donations.stats.useQuery(undefined, {
    enabled: isAuthenticated && !!canManageDonations,
  });

  const { data: restaurantParticuliers } = trpc.restaurantReservations.adminListParticuliers.useQuery(undefined, {
    enabled: isAuthenticated && !!canManageRestaurant,
  });
  const { data: restaurantGroupes } = trpc.restaurantReservations.adminListGroupes.useQuery(undefined, {
    enabled: isAuthenticated && !!canManageRestaurant,
  });
  const { data: restaurantEntreprises } = trpc.restaurantReservations.adminListEntreprises.useQuery(undefined, {
    enabled: isAuthenticated && !!canManageRestaurant,
  });

  const allRestaurantReservations = useMemo(() => {
    if (!canManageRestaurant) return [];
    const all = [
      ...(restaurantParticuliers || []).map((r: any) => ({ ...r, type: r.type || 'particulier' })),
      ...(restaurantGroupes || []).map((r: any) => ({ ...r, type: r.type || 'groupe' })),
      ...(restaurantEntreprises || []).map((r: any) => ({ ...r, type: r.type || 'entreprise' })),
    ];
    return all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [canManageRestaurant, restaurantParticuliers, restaurantGroupes, restaurantEntreprises]);

  const restaurantStats = canManageRestaurant ? {
    total: allRestaurantReservations.length,
    pending: allRestaurantReservations.filter((r: any) => r.status === 'pending_validation' || r.status === 'submitted').length,
    totalSeats: allRestaurantReservations.reduce((sum: number, r: any) => sum + (r.seatsTotal || 0), 0),
  } : null;

  const { data: days } = trpc.days.list.useQuery();

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

  const userRole = user?.role || '';
  const activeDays = days?.filter(d => d.isOpen).length || 0;
  const totalDays = days?.length || 0;

  // Filter sections: only show sections that have at least one visible module
  const visibleSections = sections
    .map(section => ({
      ...section,
      modules: section.modules.filter(m => m.allowedRoles.includes(userRole)),
    }))
    .filter(section => section.modules.length > 0);

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
              <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace(/_/g, ' ')}</p>
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

          {canManageRestaurant && restaurantStats && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Réservations</p>
                    <p className="text-3xl font-bold">{restaurantStats.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {restaurantStats.pending} en attente • {restaurantStats.totalSeats} places
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#5d5a3c]/10 flex items-center justify-center">
                    <UtensilsCrossed className="h-6 w-6 text-[#5d5a3c]" />
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

        {/* Restaurant Reservations - Names & Seats */}
        {canManageRestaurant && allRestaurantReservations.length > 0 && (
          <Card className="mb-8 border-[#5d5a3c]/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[#5d5a3c]">
                <UtensilsCrossed className="h-5 w-5" />
                Réservations Restaurant
                <Badge variant="secondary" className="ml-2">{allRestaurantReservations.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-semibold text-muted-foreground">Nom</th>
                      <th className="pb-2 font-semibold text-muted-foreground">Places</th>
                      <th className="pb-2 font-semibold text-muted-foreground hidden sm:table-cell">Type</th>
                      <th className="pb-2 font-semibold text-muted-foreground hidden md:table-cell">Statut</th>
                      <th className="pb-2 font-semibold text-muted-foreground hidden lg:table-cell">Date Ftour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allRestaurantReservations.map((res: any) => (
                      <tr key={`${res.type}-${res.id}`} className="hover:bg-muted/50">
                        <td className="py-2 pr-4">
                          <p className="font-medium">{res.name}</p>
                          {(res.groupName || res.companyName) && (
                            <p className="text-xs text-muted-foreground">{res.groupName || res.companyName}</p>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-semibold">{res.seatsTotal || 0}</span>
                        </td>
                        <td className="py-2 pr-4 hidden sm:table-cell">
                          <Badge variant="outline" className={
                            res.type === 'entreprise' ? 'border-purple-300 text-purple-700' :
                            res.type === 'groupe' ? 'border-orange-300 text-orange-700' :
                            'border-blue-300 text-blue-700'
                          }>
                            {res.type === 'entreprise' ? 'Entreprise' : res.type === 'groupe' ? 'Groupe' : 'Particulier'}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 hidden md:table-cell">
                          <Badge className={
                            res.status === 'paid_confirmed' || res.status === 'confirmed' ? 'bg-green-600' :
                            res.status === 'refused' || res.status === 'cancelled' ? 'bg-red-600' :
                            res.status === 'validated_pending_payment' || res.status === 'pending_confirmation' ? 'bg-amber-500' :
                            res.status === 'completed' ? 'bg-emerald-600' :
                            'bg-gray-500'
                          }>
                            {res.status === 'pending_validation' || res.status === 'submitted' ? 'En attente' :
                             res.status === 'validated_pending_payment' || res.status === 'pending_confirmation' ? 'Paiement attendu' :
                             res.status === 'paid_confirmed' || res.status === 'confirmed' ? 'Confirmée' :
                             res.status === 'refused' ? 'Refusée' :
                             res.status === 'cancelled' ? 'Annulée' :
                             res.status === 'completed' ? 'Terminée' :
                             res.status === 'no_show' ? 'No show' :
                             res.status}
                          </Badge>
                        </td>
                        <td className="py-2 hidden lg:table-cell text-muted-foreground">
                          {res.date ? new Date(res.date).toLocaleDateString('fr-FR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-3 border-t flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Total : <span className="font-semibold text-foreground">{restaurantStats?.totalSeats || 0} places</span>
                </p>
                <Link href="/admin/restaurant/groupes">
                  <Button variant="outline" size="sm" className="border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10">
                    Voir tout
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Module Sections */}
        {visibleSections.map((section) => (
          <div key={section.title} className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              {section.icon && <section.icon className={`h-5 w-5 ${section.iconColor || ''}`} />}
              {section.title}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.modules.map((mod) => (
                <Card key={mod.route} className={`card-hover ${section.borderClass || ''}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${mod.iconBg} flex items-center justify-center`}>
                        <mod.icon className={`h-5 w-5 ${mod.iconColor}`} />
                      </div>
                      {mod.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {mod.description}
                    </p>
                    <Link href={mod.route}>
                      <Button
                        variant={mod.variant === 'primary' ? 'default' : 'outline'}
                        className={`w-full ${mod.buttonClass || ''}`}
                      >
                        {mod.variant === 'primary' ? 'Ouvrir' : 'Gérer'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
