import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Users,
  ShoppingBag,
  Heart,
  Calendar,
  QrCode,
  ArrowRight,
  Loader2,
  BarChart3,
  Package,
  MessageSquare,
  UserCog,
  FileText,
  Home,
  LogOut,
  UtensilsCrossed,
  Store,
  UsersRound,
  CakeSlice,
  CalendarDays,
  Images,
  Trophy,
  Moon,
  BookOpen,
  type LucideIcon,
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
  variant?: "default" | "primary" | "accent";
  buttonClass?: string;
};

type SectionDefinition = {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  modules: ModuleDefinition[];
  borderClass?: string;
};

const ALL_ADMIN_ROLES = [
  "admin",
  "super_admin",
  "admin_ops",
  "admin_operations",
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
];

const sections: SectionDefinition[] = [
  {
    title: "Restaurant",
    icon: UtensilsCrossed,
    iconColor: "text-[#5d5a3c]",
    borderClass: "border-[#5d5a3c]/20",
    modules: [
      {
        label: "Réservations Groupes ou Entreprises",
        description:
          "Réservations groupes ou entreprises (assos, familles, délégations, entreprises) soumises à confirmation",
        route: "/admin/restaurant/groupes",
        icon: UsersRound,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_restaurant",
          "vue_restaurant",
          "manager_restaurant",
        ],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
      {
        label: "Calendrier Réservations",
        description:
          "Vue calendrier des réservations par jour avec places et groupes",
        route: "/admin/reservations-calendar",
        icon: CalendarDays,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_restaurant",
          "vue_restaurant",
          "manager_restaurant",
        ],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
      {
        label: "Restaurants",
        description: "Configurer les restaurants et leurs capacités",
        route: "/admin/restaurants",
        icon: Store,
        iconColor: "text-[#5d5a3c]",
        iconBg: "bg-[#5d5a3c]/10",
        allowedRoles: ["super_admin"],
        buttonClass: "border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c]/10",
      },
    ],
  },
  {
    title: "Commerce",
    modules: [
      {
        label: "Catalogue unifié",
        description:
          "Ajouter et piloter goodies, pâtisseries et terroir depuis un seul dashboard",
        route: "/admin/catalogue-unifie",
        icon: ShoppingBag,
        iconColor: "text-indigo-700",
        iconBg: "bg-indigo-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_boutique",
          "admin_patisserie",
          "admin_terroir",
        ],
      },
      {
        label: "Commandes Goodies",
        description: "Gérer les réservations de goodies et leur statut",
        route: "/admin/commandes",
        icon: Package,
        iconColor: "text-secondary-foreground",
        iconBg: "bg-secondary/20",
        allowedRoles: ["admin", "super_admin", "admin_boutique", "admin_ops", "admin_operations"],
      },
      {
        label: "Catalogue Goodies",
        description: "Gérer les produits, variantes et stocks",
        route: "/admin/goodies",
        icon: ShoppingBag,
        iconColor: "text-secondary-foreground",
        iconBg: "bg-secondary/20",
        allowedRoles: ["admin", "super_admin", "admin_boutique", "admin_ops", "admin_operations"],
      },
      {
        label: "Commandes Pâtisserie",
        description: "Gérer les commandes et billets de pâtisserie",
        route: "/admin/pastries",
        icon: UtensilsCrossed,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_boutique",
          "admin_patisserie",
          "admin_ops",
          "admin_operations",
        ],
      },
      {
        label: "Catalogue Pâtisserie",
        description: "Ajouter, modifier et gérer les produits pâtisserie",
        route: "/admin/patisserie/catalogue",
        icon: CakeSlice,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_boutique",
          "admin_patisserie",
          "admin_ops",
          "admin_operations",
        ],
      },
      {
        label: "Commandes Terroir",
        description: "Suivi des commandes de produits du terroir",
        route: "/admin/terroir/orders",
        icon: Package,
        iconColor: "text-emerald-700",
        iconBg: "bg-emerald-100",
        allowedRoles: ["admin", "super_admin", "admin_terroir", "admin_boutique", "admin_ops", "admin_operations"],
      },
      {
        label: "Catalogue Terroir",
        description: "Gérer les produits du terroir, variantes et stocks",
        route: "/admin/terroir/products",
        icon: ShoppingBag,
        iconColor: "text-emerald-700",
        iconBg: "bg-emerald-100",
        allowedRoles: ["admin", "super_admin", "admin_terroir", "admin_boutique", "admin_ops", "admin_operations"],
      },
      {
        label: "QR Codes Catalogue",
        description:
          "Tous les QR codes produits (goodies, pâtisserie, terroir, dons)",
        route: "/admin/qr-codes",
        icon: QrCode,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_boutique",
          "admin_patisserie",
          "admin_terroir",
          "admin_dons",
        ],
      },
      {
        label: "Tableau de bord unifié",
        description: "Statistiques et gestion unifiées pour tous les modules",
        route: "/admin/unified-dashboard",
        icon: BarChart3,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_boutique",
          "admin_patisserie",
          "admin_terroir",
          "admin_dons",
          "admin_ops",
          "scanner",
        ],
      },
      {
        label: "Scanner Produits",
        description: "Scanner les QR codes des produits et commandes",
        route: "/admin/scan-product",
        icon: QrCode,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_ops",
          "admin_operations",
          "scanner",
        ],
      },
    ],
  },
  {
    title: "Solidarité",
    modules: [
      {
        label: "Dons",
        description:
          "Suivre les promesses de dons et marquer les paiements reçus",
        route: "/admin/dons",
        icon: Heart,
        iconColor: "text-accent",
        iconBg: "bg-accent/10",
        allowedRoles: ["admin", "super_admin", "admin_dons", "admin_ops", "admin_operations"],
      },
    ],
  },
  {
    title: "Task Force",
    modules: [
      {
        label: "Calendrier",
        description: "Configurer les jours du Ramadan et leurs capacités",
        route: "/admin/jours",
        icon: Calendar,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_operations"],
      },
      {
        label: "Bénévoles",
        description: "Gérer les inscriptions et suivre les présences par jour",
        route: "/admin/benevoles",
        icon: Users,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_operations"],
      },
      {
        label: "Groupes bénévoles",
        description:
          "Traiter les demandes groupes: pièces jointes, validation et refus",
        route: "/admin/benevoles-groupes",
        icon: Users,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_operations"],
      },
      {
        label: "Election Managers",
        description:
          "Valider les candidatures, suivre les votes et piloter l'élection annuelle des managers",
        route: "/admin/elections",
        icon: Trophy,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_operations"],
      },
      {
        label: "Stats Ramadan",
        description:
          "Saisie quotidienne et cumuls des indicateurs Ftour Ramadan",
        route: "/admin/ramadan-stats",
        icon: Calendar,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_operations"],
      },
      {
        label: "Scanner QR",
        description:
          "Scanner les QR codes des bénévoles pour valider leur présence",
        route: "/scanner",
        icon: QrCode,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_ops",
          "admin_operations",
          "scanner",
        ],
        variant: "primary",
      },
      {
        label: "Galerie photo",
        description: "Uploader, publier et organiser les photos du site public",
        route: "/admin/galerie",
        icon: Images,
        iconColor: "text-sky-700",
        iconBg: "bg-sky-100",
        allowedRoles: ["admin", "super_admin", "admin_ops"],
      },
      {
        label: "Équipe Ftour",
        description: "Gérer le trombinoscope des managers et membres de l'équipe par édition",
        route: "/admin/equipe",
        icon: UsersRound,
        iconColor: "text-emerald-700",
        iconBg: "bg-emerald-100",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_contenu"],
      },
      {
        label: "Cartes membres",
        description:
          "Suivre les statuts, paiements et livraisons des cartes membres",
        route: "/admin/cards",
        icon: FileText,
        iconColor: "text-teal-700",
        iconBg: "bg-teal-100",
        allowedRoles: ALL_ADMIN_ROLES,
      },
    ],
  },
  {
    title: "Gestion de stock",
    modules: [
      {
        label: "Gestion de stock",
        description: "Suivi multi-niveaux du stock : global, buffer événement et points de vente",
        route: "/admin/inventory",
        icon: Package,
        iconColor: "text-green-700",
        iconBg: "bg-green-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_ops",
          "admin_boutique",
          "admin_patisserie",
          "admin_terroir",
        ],
      },
      {
        label: "Produits & Stock",
        description: "Catalogue des produits stockables avec niveaux de stock par emplacement",
        route: "/admin/inventory/products",
        icon: Package,
        iconColor: "text-green-700",
        iconBg: "bg-green-100",
        allowedRoles: [
          "admin",
          "super_admin",
          "admin_ops",
          "admin_boutique",
          "admin_patisserie",
          "admin_terroir",
        ],
      },
    ],
  },
  {
    title: "Feedback",
    modules: [
      {
        label: "Dashboard Feedbacks",
        description: "Consulter et analyser les retours de bénévoles et clients avec statistiques et graphiques",
        route: "/admin/feedback",
        icon: MessageSquare,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: ["admin", "super_admin", "admin_ops"],
      },
      {
        label: "Campagnes email",
        description: "Créer et envoyer des campagnes de demande de feedback par email aux bénévoles et clients",
        route: "/admin/feedback/campagnes",
        icon: BarChart3,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        allowedRoles: ["admin", "super_admin", "admin_ops"],
      },
    ],
  },
  {
    title: "Page de clôture Ramadan",
    icon: Moon,
    iconColor: "text-[#D4AF37]",
    borderClass: "border-[#D4AF37]/20",
    modules: [
      {
        label: "Photos Événement",
        description: "Uploader et gérer les photos affichées dans le slider de la page de clôture Ramadan 1447",
        route: "/admin/event-photos",
        icon: Images,
        iconColor: "text-[#D4AF37]",
        iconBg: "bg-amber-50",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_contenu"],
        buttonClass: "border-[#D4AF37] text-[#D4AF37] hover:bg-amber-50",
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
        allowedRoles: ["super_admin", "admin_ops", "admin_operations"],
      },
      {
        label: "Messages",
        description: "Consulter les messages de contact reçus",
        route: "/admin/messages",
        icon: MessageSquare,
        iconColor: "text-green-600",
        iconBg: "bg-green-100",
        allowedRoles: ["super_admin"],
      },
      {
        label: "Contenu",
        description: "Gérer les partenaires, témoignages et FAQ",
        route: "/admin/contenu",
        icon: FileText,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-100",
        allowedRoles: ["super_admin", "admin_contenu"],
      },
      {
        label: "Blog communautaire",
        description: "Modérer, approuver ou refuser les publications du blog",
        route: "/admin/blog",
        icon: BookOpen,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-100",
        allowedRoles: ["admin", "super_admin", "admin_ops", "admin_contenu"],
      },
      {
        label: "Logs / Journal",
        description: "Consulter les actions critiques (auth, CRUD, admin) et exporter en CSV",
        route: "/admin/logs",
        icon: FileText,
        iconColor: "text-slate-700",
        iconBg: "bg-slate-100",
        allowedRoles: ["admin", "super_admin"],
      },
    ],
  },
];

// ============================================
// COMPONENT
// ============================================

export default function Admin() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const isPublicAdminAccess = location === "/admin3";

  const isAdmin = Boolean(user?.role && ALL_ADMIN_ROLES.includes(user.role));
  const isSuperAdmin = user?.role === "super_admin" || isPublicAdminAccess;
  const canManageVolunteers =
    isPublicAdminAccess ||
    (user?.role &&
    ["admin", "super_admin", "admin_ops", "admin_operations"].includes(
      user.role
    ));
  const canReadAdminDashboard =
    isPublicAdminAccess ||
    (user?.role &&
    [
      "admin",
      "super_admin",
      "admin_ops",
      "admin_operations",
      "admin_boutique",
      "admin_dons",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
      "admin_patisserie",
      "admin_terroir",
      "admin_contenu",
      "admin_messages",
      "scanner",
    ].includes(user.role));

  const { data: volunteerStats } = trpc.volunteers.stats.useQuery(undefined, {
    enabled: isAuthenticated && !isPublicAdminAccess && !!canManageVolunteers,
  });

  const { data: adminDashboard } = useQuery({
    queryKey: ["admin-dashboard", 1, 50],
    enabled: isAuthenticated && !isPublicAdminAccess && !!canReadAdminDashboard,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch('/api/admin-dashboard?page=1&pageSize=50');
      if (!response.ok) {
        throw new Error('Failed to fetch admin dashboard payload');
      }
      return response.json() as Promise<{
        stats: {
          reservations: number;
          volunteers: number;
          payments: number;
          notifications: number;
        };
      }>;
    },
  });

  const { data: days } = trpc.days.list.useQuery(undefined, {
    enabled: isAuthenticated || !isPublicAdminAccess,
  });

  useEffect(() => {
    if (!isPublicAdminAccess && !authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated, isPublicAdminAccess]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPublicAdminAccess && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <Users className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les droits nécessaires pour accéder à
              l'administration.
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userRole = isPublicAdminAccess ? "super_admin" : (user?.role || "");
  const getModuleHref = (route: string) =>
    isPublicAdminAccess ? route.replace(/^\/admin(\/|$)/, "/admin3$1") : route;
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
              <p className="text-sm font-medium">
                {user?.name || user?.email || "Accès public admin3"}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {(user?.role || "public_access")?.replace(/_/g, " ")}
              </p>
            </div>
            {!isPublicAdminAccess && (
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            )}
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
                    <p className="text-3xl font-bold">
                      {volunteerStats?.total || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {volunteerStats?.present || 0} présents ·{" "}
                      {volunteerStats?.confirmed || 0} confirmés ·{" "}
                      {volunteerStats?.registered || 0} inscrits
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canReadAdminDashboard && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paiements</p>
                    <p className="text-3xl font-bold">
                      {adminDashboard?.stats?.payments || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Dernières 50 lignes paginées</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-secondary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canReadAdminDashboard && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Notifications</p>
                    <p className="text-3xl font-bold">
                      {adminDashboard?.stats?.notifications || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Messages récents</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canReadAdminDashboard && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Réservations
                    </p>
                    <p className="text-3xl font-bold">
                      {adminDashboard?.stats?.reservations || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sources consolidées (BFF)
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

        {/* Module Sections */}
        {visibleSections.map(section => (
          <div key={section.title} className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              {section.icon && (
                <section.icon
                  className={`h-5 w-5 ${section.iconColor || ""}`}
                />
              )}
              {section.title}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.modules.map(mod => (
                <Card
                  key={mod.route}
                  className={`card-hover ${section.borderClass || ""}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg ${mod.iconBg} flex items-center justify-center`}
                      >
                        <mod.icon className={`h-5 w-5 ${mod.iconColor}`} />
                      </div>
                      {mod.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {mod.description}
                    </p>
                    <Link href={getModuleHref(mod.route)}>
                      <Button
                        variant={
                          mod.variant === "primary" ? "default" : "outline"
                        }
                        className={`w-full ${mod.buttonClass || ""}`}
                      >
                        {mod.variant === "primary" ? "Ouvrir" : "Gérer"}
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
