export type DashboardItem = {
  key: string;
  label: string;
  description?: string;
  category: string;
  sort: number;
  routes?: string[];
  deprecated?: boolean;
};

export const DASHBOARD_ITEMS: DashboardItem[] = [
  { key: "dash.kpis.overview", label: "Vue d'ensemble KPI", category: 'dashboard', sort: 10, routes: ['/admin'] },
  { key: "dash.volunteers.table", label: 'Bénévoles', category: 'operations', sort: 20, routes: ['/admin/benevoles'] },
  { key: "dash.days.management", label: 'Jours Ramadan', category: 'operations', sort: 30, routes: ['/admin/jours'] },
  { key: "dash.reservations.table", label: 'Réservations Ftour', category: 'restaurant', sort: 40, routes: ['/admin/reservations', '/admin/restaurant-reservations'] },
  { key: "dash.reservations.calendar", label: 'Calendrier réservations', category: 'restaurant', sort: 50, routes: ['/admin/reservations-calendar'] },
  { key: "dash.reservations.groups", label: 'Réservations groupes', category: 'restaurant', sort: 60, routes: ['/admin/restaurant/groupes'] },
  { key: "dash.reservations.enterprises", label: 'Réservations entreprises', category: 'restaurant', sort: 70, routes: ['/admin/restaurant/entreprises'] },
  { key: "dash.reservations.scanner", label: 'Scanner réservations', category: 'scanner', sort: 80, routes: ['/admin/scan-reservation'] },
  { key: "dash.restaurants.management", label: 'Restaurants', category: 'restaurant', sort: 90, routes: ['/admin/restaurants'] },
  { key: "dash.orders.goodies", label: 'Commandes goodies', category: 'commerce', sort: 100, routes: ['/admin/commandes'] },
  { key: "dash.catalog.goodies", label: 'Catalogue goodies', category: 'commerce', sort: 110, routes: ['/admin/goodies'] },
  { key: "dash.orders.pastries", label: 'Commandes pâtisserie', category: 'commerce', sort: 120, routes: ['/admin/patisserie', '/admin/pastries'] },
  { key: "dash.catalog.pastries", label: 'Catalogue pâtisserie', category: 'commerce', sort: 130, routes: ['/admin/patisserie/catalogue'] },
  { key: "dash.orders.terroir", label: 'Commandes terroir', category: 'commerce', sort: 140, routes: ['/admin/terroir/orders'] },
  { key: "dash.catalog.terroir", label: 'Catalogue terroir', category: 'commerce', sort: 150, routes: ['/admin/terroir/products'] },
  { key: "dash.payments", label: 'Paiements', category: 'finance', sort: 160, routes: ['/admin/payments'] },
  { key: "dash.donations.kpis", label: 'Dons', category: 'finance', sort: 170, routes: ['/admin/dons'] },
  { key: "dash.qrcodes", label: 'Catalogue QR codes', category: 'scanner', sort: 180, routes: ['/admin/qr-codes'] },
  { key: "dash.scanner", label: 'Scanner unifié', category: 'scanner', sort: 190, routes: ['/scanner'] },
  { key: "dash.gallery", label: 'Galerie', category: 'contenu', sort: 200, routes: ['/admin/galerie', '/admin/galerie/nouveau', '/admin/galerie/:id'] },
  { key: "dash.content", label: 'Contenu', category: 'contenu', sort: 210, routes: ['/admin/contenu'] },
  { key: "dash.messages", label: 'Messages', category: 'support', sort: 220, routes: ['/admin/messages'] },
  { key: "dash.settings.users", label: 'Utilisateurs', category: 'settings', sort: 230, routes: ['/admin/utilisateurs'] },
  { key: "dash.stats.ramadan", label: 'Statistiques Ramadan', category: 'dashboard', sort: 240, routes: ['/admin/ramadan-stats'] },
  { key: "dash.orders.cash", label: 'Commandes cash', category: 'commerce', sort: 250, routes: ['/admin/orders-cash'] },
  { key: "dash.scan.product", label: 'Scanner produits', category: 'scanner', sort: 260, routes: ['/admin/scan-product'] },
  { key: "dash.unified", label: 'Dashboard unifié', category: 'dashboard', sort: 270, routes: ['/admin/unified-dashboard'] },
];

export const DEFAULT_DASHBOARD_KEYS = [
  'dash.kpis.overview',
  'dash.volunteers.table',
  'dash.reservations.table',
  'dash.donations.kpis',
];

export const ALL_DASHBOARD_ITEM_KEYS = DASHBOARD_ITEMS.map(item => item.key);

export const DASHBOARD_ROUTE_PERMISSIONS = DASHBOARD_ITEMS.reduce<Record<string, string>>((acc, item) => {
  for (const route of item.routes ?? []) {
    acc[route] = item.key;
  }
  return acc;
}, {});
