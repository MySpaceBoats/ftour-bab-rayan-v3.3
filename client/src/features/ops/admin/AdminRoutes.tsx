import { Switch, Route } from 'wouter';
import AdminFrame from './_shell/AdminFrame';

// ── Ops Admin ────────────────────────────────────────────────
import AdminDashboard from './AdminDashboard';
import AdminBenevoles from './AdminBenevoles';
import AdminGroupesBenevoles from './AdminGroupesBenevoles';
import AdminJours from './AdminJours';
import AdminScanProduct from './AdminScanProduct';
import AdminPayments from './AdminPayments';
import AdminUtilisateurs from './AdminUtilisateurs';
import AdminUnifiedDashboard from './AdminUnifiedDashboard';
import AdminQRCodes from './AdminQRCodes';
import AdminRamadanStats from './AdminRamadanStats';
import AdminMemberCards from './AdminMemberCards';
import AdminUnifiedCatalog from './AdminUnifiedCatalog';
import AdminAuditLogs from './AdminAuditLogs';

// ── Restaurant ────────────────────────────────────────────────
import AdminRestaurantGroupes from '@/features/restaurant/admin/AdminRestaurantGroupes';
import AdminRestaurantEntreprises from '@/features/restaurant/admin/AdminRestaurantEntreprises';
import AdminRestaurants from '@/features/restaurant/admin/AdminRestaurants';
import AdminScanReservation from '@/features/restaurant/admin/AdminScanReservation';
import AdminReservationsCalendar from '@/features/restaurant/admin/AdminReservationsCalendar';

// ── Pâtisserie ────────────────────────────────────────────────
import AdminPastries from '@/features/patisserie/admin/AdminPastries';
import AdminPastryCatalog from '@/features/patisserie/admin/AdminPastryCatalog';

// ── Terroir ───────────────────────────────────────────────────
import AdminTerroirProducts from '@/features/terroir/admin/AdminTerroirProducts';
import AdminTerroirOrders from '@/features/terroir/admin/AdminTerroirOrders';

// ── Goodies / Commerce ────────────────────────────────────────
import AdminGoodies from '@/features/goodies/admin/AdminGoodies';
import AdminCommandes from '@/features/goodies/admin/AdminCommandes';

// ── Dons ──────────────────────────────────────────────────────
import AdminDons from '@/features/dons/admin/AdminDons';

// ── Inventory ─────────────────────────────────────────────────
import AdminInventory from '@/features/inventory/admin/AdminInventory';
import AdminInventoryProducts from '@/features/inventory/admin/AdminInventoryProducts';
import AdminInventoryEvents from '@/features/inventory/admin/AdminInventoryEvents';
import AdminInventoryMovements from '@/features/inventory/admin/AdminInventoryMovements';
import AdminInventoryStockEntry from '@/features/inventory/admin/AdminInventoryStockEntry';
import AdminInventoryStockEntryProduct from '@/features/inventory/admin/AdminInventoryStockEntryProduct';

// ── Cash orders ───────────────────────────────────────────────
import AdminCashOrders from '@/features/menu/admin/AdminCashOrders';

// ── Galerie ───────────────────────────────────────────────────
import AdminGalerie from '@/features/gallery/admin/AdminGalerie';
import AdminGalerieNouveau from '@/features/gallery/admin/AdminGalerieNouveau';
import AdminGalerieEdit from '@/features/gallery/admin/AdminGalerieEdit';

// ── Contenu & Communication ───────────────────────────────────
import AdminContenu from '@/features/contenu/admin/AdminContenu';
import AdminMessages from '@/features/messages/admin/AdminMessages';
import AdminBlog from '@/features/blog/admin/AdminBlog';
import AdminFeedback from '@/features/feedback/admin/AdminFeedback';
import AdminFeedbackCampagnes from '@/features/feedback/admin/AdminFeedbackCampagnes';
import AdminEventFeedback from '@/features/feedback/admin/AdminEventFeedback';

// ── Solidarité & Équipe ───────────────────────────────────────
import AdminFtour from '@/features/ftour/admin/AdminFtour';
import AdminTeam from '@/features/team/admin/AdminTeam';
import AdminElections from '@/features/election/admin/AdminElections';
import AdminEventPhotos from '@/features/closing/admin/AdminEventPhotos';

/** Canonical admin paths (no prefix). Rendered once for both /admin and /admin3. */
function AdminSwitch() {
  return (
    <Switch>
      {/* Dashboard */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin3" component={AdminDashboard} />
      <Route path="/admin/unified-dashboard" component={AdminUnifiedDashboard} />
      <Route path="/admin3/unified-dashboard" component={AdminUnifiedDashboard} />

      {/* Restaurant */}
      <Route path="/admin/restaurant/groupes" component={AdminRestaurantGroupes} />
      <Route path="/admin3/restaurant/groupes" component={AdminRestaurantGroupes} />
      <Route path="/admin/restaurant/entreprises" component={AdminRestaurantEntreprises} />
      <Route path="/admin3/restaurant/entreprises" component={AdminRestaurantEntreprises} />
      <Route path="/admin/restaurants" component={AdminRestaurants} />
      <Route path="/admin3/restaurants" component={AdminRestaurants} />
      <Route path="/admin/reservations-calendar" component={AdminReservationsCalendar} />
      <Route path="/admin3/reservations-calendar" component={AdminReservationsCalendar} />
      <Route path="/admin/scan-reservation" component={AdminScanReservation} />
      <Route path="/admin3/scan-reservation" component={AdminScanReservation} />

      {/* Pâtisserie */}
      <Route path="/admin/patisserie" component={AdminPastries} />
      <Route path="/admin3/patisserie" component={AdminPastries} />
      <Route path="/admin/pastries" component={AdminPastries} />
      <Route path="/admin3/pastries" component={AdminPastries} />
      <Route path="/admin/patisserie/catalogue" component={AdminPastryCatalog} />
      <Route path="/admin3/patisserie/catalogue" component={AdminPastryCatalog} />

      {/* Terroir */}
      <Route path="/admin/terroir/products" component={AdminTerroirProducts} />
      <Route path="/admin3/terroir/products" component={AdminTerroirProducts} />
      <Route path="/admin/terroir/orders" component={AdminTerroirOrders} />
      <Route path="/admin3/terroir/orders" component={AdminTerroirOrders} />

      {/* Goodies / Commerce */}
      <Route path="/admin/goodies" component={AdminGoodies} />
      <Route path="/admin3/goodies" component={AdminGoodies} />
      <Route path="/admin/catalogue/goodies">{() => <AdminGoodies />}</Route>
      <Route path="/admin3/catalogue/goodies">{() => <AdminGoodies />}</Route>
      <Route path="/admin/catalogue/terroir">{() => <AdminTerroirProducts />}</Route>
      <Route path="/admin3/catalogue/terroir">{() => <AdminTerroirProducts />}</Route>
      <Route path="/admin/catalogue/patisserie">{() => <AdminPastryCatalog />}</Route>
      <Route path="/admin3/catalogue/patisserie">{() => <AdminPastryCatalog />}</Route>
      <Route path="/admin/commandes" component={AdminCommandes} />
      <Route path="/admin3/commandes" component={AdminCommandes} />
      <Route path="/admin/orders-cash" component={AdminCashOrders} />
      <Route path="/admin3/orders-cash" component={AdminCashOrders} />

      {/* Dons */}
      <Route path="/admin/dons" component={AdminDons} />
      <Route path="/admin3/dons" component={AdminDons} />

      {/* Bénévoles & Équipe */}
      <Route path="/admin/benevoles" component={AdminBenevoles} />
      <Route path="/admin3/benevoles" component={AdminBenevoles} />
      <Route path="/admin/benevoles-groupes" component={AdminGroupesBenevoles} />
      <Route path="/admin3/benevoles-groupes" component={AdminGroupesBenevoles} />
      <Route path="/admin/jours" component={AdminJours} />
      <Route path="/admin3/jours" component={AdminJours} />
      <Route path="/admin/ramadan-stats" component={AdminRamadanStats} />
      <Route path="/admin3/ramadan-stats" component={AdminRamadanStats} />
      <Route path="/admin/cards" component={AdminMemberCards} />
      <Route path="/admin3/cards" component={AdminMemberCards} />
      <Route path="/admin/ftour" component={AdminFtour} />
      <Route path="/admin3/ftour" component={AdminFtour} />
      <Route path="/admin/elections" component={AdminElections} />
      <Route path="/admin3/elections" component={AdminElections} />
      <Route path="/admin/event-photos" component={AdminEventPhotos} />
      <Route path="/admin3/event-photos" component={AdminEventPhotos} />

      {/* Catalogue unifié */}
      <Route path="/admin/catalogue-unifie" component={AdminUnifiedCatalog} />
      <Route path="/admin3/catalogue-unifie" component={AdminUnifiedCatalog} />

      {/* QR Codes */}
      <Route path="/admin/qr-codes" component={AdminQRCodes} />
      <Route path="/admin3/qr-codes" component={AdminQRCodes} />
      <Route path="/admin/scan-product" component={AdminScanProduct} />
      <Route path="/admin3/scan-product" component={AdminScanProduct} />

      {/* Inventory */}
      <Route path="/admin/inventory/stock-entry/:productId" component={AdminInventoryStockEntryProduct} />
      <Route path="/admin3/inventory/stock-entry/:productId" component={AdminInventoryStockEntryProduct} />
      <Route path="/admin/inventory/stock-entry" component={AdminInventoryStockEntry} />
      <Route path="/admin3/inventory/stock-entry" component={AdminInventoryStockEntry} />
      <Route path="/admin/inventory/products" component={AdminInventoryProducts} />
      <Route path="/admin3/inventory/products" component={AdminInventoryProducts} />
      <Route path="/admin/inventory/events" component={AdminInventoryEvents} />
      <Route path="/admin3/inventory/events" component={AdminInventoryEvents} />
      <Route path="/admin/inventory/movements" component={AdminInventoryMovements} />
      <Route path="/admin3/inventory/movements" component={AdminInventoryMovements} />
      <Route path="/admin/inventory" component={AdminInventory} />
      <Route path="/admin3/inventory" component={AdminInventory} />

      {/* Galerie */}
      <Route path="/admin/galerie/nouveau" component={AdminGalerieNouveau} />
      <Route path="/admin3/galerie/nouveau" component={AdminGalerieNouveau} />
      <Route path="/admin/galerie/:id" component={AdminGalerieEdit} />
      <Route path="/admin3/galerie/:id" component={AdminGalerieEdit} />
      <Route path="/admin/galerie" component={AdminGalerie} />
      <Route path="/admin3/galerie" component={AdminGalerie} />

      {/* Contenu & Communication */}
      <Route path="/admin/contenu" component={AdminContenu} />
      <Route path="/admin3/contenu" component={AdminContenu} />
      <Route path="/admin/messages" component={AdminMessages} />
      <Route path="/admin3/messages" component={AdminMessages} />
      <Route path="/admin/blog" component={AdminBlog} />
      <Route path="/admin3/blog" component={AdminBlog} />
      <Route path="/admin/equipe" component={AdminTeam} />
      <Route path="/admin3/equipe" component={AdminTeam} />
      <Route path="/admin/feedback/campagnes" component={AdminFeedbackCampagnes} />
      <Route path="/admin3/feedback/campagnes" component={AdminFeedbackCampagnes} />
      <Route path="/admin/feedback/evenement" component={AdminEventFeedback} />
      <Route path="/admin3/feedback/evenement" component={AdminEventFeedback} />
      <Route path="/admin/feedback" component={AdminFeedback} />
      <Route path="/admin3/feedback" component={AdminFeedback} />

      {/* Système */}
      <Route path="/admin/utilisateurs" component={AdminUtilisateurs} />
      <Route path="/admin3/utilisateurs" component={AdminUtilisateurs} />
      <Route path="/admin/payments" component={AdminPayments} />
      <Route path="/admin3/payments" component={AdminPayments} />
      <Route path="/admin/logs" component={AdminAuditLogs} />
      <Route path="/admin3/logs" component={AdminAuditLogs} />
    </Switch>
  );
}

export default function AdminRoutes() {
  return (
    <AdminFrame>
      <AdminSwitch />
    </AdminFrame>
  );
}
