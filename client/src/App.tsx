import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/features/public/pages/NotFound";
import { Route, Switch, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { useI18n, SUPPORTED_LOCALES, type Locale } from "./i18n";
import RequireRole from "./components/RequireRole";

// ============================================
// PUBLIC PAGES — features/public
// ============================================
import Home from "@/features/public/pages/Home";
import Programme from "@/features/public/pages/Programme";
import Benevole from "@/features/public/pages/Benevole";
import Evenement from "@/features/public/pages/Evenement";
import Association from "@/features/public/pages/Association";
import Contact from "@/features/public/pages/Contact";
import FAQ from "@/features/public/pages/FAQ";
import MentionsLegales from "@/features/public/pages/MentionsLegales";

// ============================================
// AUTH — features/auth
// ============================================
import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";

// ============================================
// RESTAURANT — features/restaurant
// ============================================
import RestaurantGroupes from "@/features/restaurant/pages/RestaurantGroupes";
import CompanyBooking from "@/features/restaurant/pages/CompanyBooking";
import CompanyBookingConfirmation from "@/features/restaurant/pages/CompanyBookingConfirmation";
import CompanyBookingSpace from "@/features/restaurant/pages/CompanyBookingSpace";
import Reservation from "@/features/restaurant/pages/Reservation";
import CheckinReservation from "@/features/restaurant/pages/CheckinReservation";
import AdminRestaurantGroupes from "@/features/restaurant/admin/AdminRestaurantGroupes";
import AdminRestaurantEntreprises from "@/features/restaurant/admin/AdminRestaurantEntreprises";
import AdminRestaurants from "@/features/restaurant/admin/AdminRestaurants";
import AdminRestaurantReservations from "@/features/restaurant/admin/AdminRestaurantReservations";
import AdminCompanyBookings from "@/features/restaurant/admin/AdminCompanyBookings";
import AdminScanReservation from "@/features/restaurant/admin/AdminScanReservation";
import AdminReservationsCalendar from "@/features/restaurant/admin/AdminReservationsCalendar";

// ============================================
// PATISSERIE — features/patisserie
// ============================================
import Pastries from "@/features/patisserie/pages/Pastries";
import BuyPastry from "@/features/patisserie/pages/BuyPastry";
import AdminPastries from "@/features/patisserie/admin/AdminPastries";
import AdminPastryCatalog from "@/features/patisserie/admin/AdminPastryCatalog";

// ============================================
// TERROIR — features/terroir
// ============================================
import ProduitsTerroir from "@/features/terroir/pages/ProduitsTerroir";
import AdminTerroirProducts from "@/features/terroir/admin/AdminTerroirProducts";
import AdminTerroirOrders from "@/features/terroir/admin/AdminTerroirOrders";

// ============================================
// BOUTIQUE — features/boutique
// ============================================
import BoutiqueSolidaire from "@/features/boutique/pages/BoutiqueSolidaire";

// ============================================
// GOODIES — features/goodies
// ============================================
import Goodies from "@/features/goodies/pages/Goodies";
import BuyGoodie from "@/features/goodies/pages/BuyGoodie";
import Cart from "@/features/goodies/pages/Cart";
import { Checkout as UnifiedCheckout } from "@/features/goodies/pages/Checkout";
import AdminGoodies from "@/features/goodies/admin/AdminGoodies";
import AdminCommandes from "@/features/goodies/admin/AdminCommandes";

// ============================================
// DONS — features/dons
// ============================================
import Dons from "@/features/dons/pages/Dons";
import AdminDons from "@/features/dons/admin/AdminDons";

// ============================================
// OPS — features/ops
// ============================================
import AdminDashboard from "@/features/ops/admin/AdminDashboard";
import AdminBenevoles from "@/features/ops/admin/AdminBenevoles";
import AdminJours from "@/features/ops/admin/AdminJours";

import AdminScanProduct from "@/features/ops/admin/AdminScanProduct";
import AdminPayments from "@/features/ops/admin/AdminPayments";
import AdminUtilisateurs from "@/features/ops/admin/AdminUtilisateurs";
import AdminUnifiedDashboard from "@/features/ops/admin/AdminUnifiedDashboard";
import AdminQRCodes from "@/features/ops/admin/AdminQRCodes";

// ============================================
// SCANNER — features/scanner
// ============================================
import Scanner from "@/features/scanner/pages/Scanner";
import Checkin from "@/features/scanner/pages/Checkin";
import ScannerPatisserie from "@/features/scanner/pages/ScannerPatisserie";
import ScannerUnifie from "@/features/scanner/pages/ScannerUnifie";
import ScannerGoodies from "@/features/scanner/pages/ScannerGoodies";
import ScannerBenevoles from "@/features/scanner/pages/ScannerBenevoles";
import ScannerFtours from "@/features/scanner/pages/ScannerFtours";

// ============================================
// CONTENU — features/contenu
// ============================================
import AdminContenu from "@/features/contenu/admin/AdminContenu";

// ============================================
// MESSAGES — features/messages
// ============================================
import AdminMessages from "@/features/messages/admin/AdminMessages";

import WhatsAppFloatingButton from "./components/WhatsAppFloatingButton";

// ============================================
// ROUTES
// ============================================

function LocalizedRoutes() {
  const [location] = useLocation();
  const { lang, setLang } = useI18n();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // Extract locale from URL path (only for non-admin routes)
  useEffect(() => {
    if (location.startsWith('/admin') || location.startsWith('/scanner') || location.startsWith('/checkin')) {
      return;
    }

    const pathParts = location.split('/').filter(Boolean);
    const urlLocale = pathParts[0] as Locale;

    if (SUPPORTED_LOCALES.includes(urlLocale)) {
      if (urlLocale !== lang) {
        setLang(urlLocale);
      }
    }
  }, [location, lang, setLang]);

  return (
    <Switch>
      {/* ================================================
          ADMIN ROUTES — sans :lang (section 4.2)
          All wrapped with RequireRole for access control
          ================================================ */}
      <Route path="/admin">{() => <RequireRole route="/admin"><AdminDashboard /></RequireRole>}</Route>
      <Route path="/admin/unified-dashboard">{() => <RequireRole route="/admin/unified-dashboard"><AdminUnifiedDashboard /></RequireRole>}</Route>

      {/* Admin Restaurant */}
      <Route path="/admin/restaurant/groupes">{() => <RequireRole route="/admin/restaurant/groupes"><AdminRestaurantGroupes /></RequireRole>}</Route>
      <Route path="/admin/restaurant/entreprises">{() => <RequireRole route="/admin/restaurant/entreprises"><AdminRestaurantEntreprises /></RequireRole>}</Route>
      <Route path="/admin/restaurants">{() => <RequireRole route="/admin/restaurants"><AdminRestaurants /></RequireRole>}</Route>
      <Route path="/admin/restaurant-reservations">{() => <RequireRole route="/admin/restaurant-reservations"><AdminRestaurantReservations /></RequireRole>}</Route>
      <Route path="/admin/reservations">{() => <RequireRole route="/admin/reservations"><AdminRestaurantReservations /></RequireRole>}</Route>
      <Route path="/admin/company-bookings">{() => <RequireRole route="/admin/company-bookings"><AdminCompanyBookings /></RequireRole>}</Route>
      <Route path="/admin/reservations-calendar">{() => <RequireRole route="/admin/reservations-calendar"><AdminReservationsCalendar /></RequireRole>}</Route>
      <Route path="/admin/scan-reservation">{() => <RequireRole route="/admin/scan-reservation"><AdminScanReservation /></RequireRole>}</Route>

      {/* Admin Pâtisserie */}
      <Route path="/admin/patisserie">{() => <RequireRole route="/admin/patisserie"><AdminPastries /></RequireRole>}</Route>
      <Route path="/admin/pastries">{() => <RequireRole route="/admin/pastries"><AdminPastries /></RequireRole>}</Route>
      <Route path="/admin/patisserie/catalogue">{() => <RequireRole route="/admin/patisserie/catalogue"><AdminPastryCatalog /></RequireRole>}</Route>

      {/* Admin Terroir */}
      <Route path="/admin/terroir/products">{() => <RequireRole route="/admin/terroir/products"><AdminTerroirProducts /></RequireRole>}</Route>
      <Route path="/admin/terroir/orders">{() => <RequireRole route="/admin/terroir/orders"><AdminTerroirOrders /></RequireRole>}</Route>

      {/* Admin Goodies */}
      <Route path="/admin/goodies">{() => <RequireRole route="/admin/goodies"><AdminGoodies /></RequireRole>}</Route>
      <Route path="/admin/commandes">{() => <RequireRole route="/admin/commandes"><AdminCommandes /></RequireRole>}</Route>

      {/* Admin Dons */}
      <Route path="/admin/dons">{() => <RequireRole route="/admin/dons"><AdminDons /></RequireRole>}</Route>

      {/* Admin Ops */}
      <Route path="/admin/benevoles">{() => <RequireRole route="/admin/benevoles"><AdminBenevoles /></RequireRole>}</Route>
      <Route path="/admin/jours">{() => <RequireRole route="/admin/jours"><AdminJours /></RequireRole>}</Route>
      <Route path="/admin/scan-product">{() => <RequireRole route="/admin/scan-product"><AdminScanProduct /></RequireRole>}</Route>
      <Route path="/admin/payments">{() => <RequireRole route="/admin/payments"><AdminPayments /></RequireRole>}</Route>
      <Route path="/admin/utilisateurs">{() => <RequireRole route="/admin/utilisateurs"><AdminUtilisateurs /></RequireRole>}</Route>

      {/* Admin QR Codes Catalogue */}
      <Route path="/admin/qr-codes">{() => <RequireRole route="/admin/qr-codes"><AdminQRCodes /></RequireRole>}</Route>

      {/* Admin Contenu */}
      <Route path="/admin/contenu">{() => <RequireRole route="/admin/contenu"><AdminContenu /></RequireRole>}</Route>

      {/* Admin Messages */}
      <Route path="/admin/messages">{() => <RequireRole route="/admin/messages"><AdminMessages /></RequireRole>}</Route>

      {/* ================================================
          SCANNER — route unique (section 4.3)
          ================================================ */}
      <Route path="/scanner/patisserie">{() => <RequireRole route="/scanner/patisserie"><ScannerPatisserie /></RequireRole>}</Route>
      <Route path="/scanner/unifie">{() => <RequireRole route="/scanner/unifie"><ScannerUnifie /></RequireRole>}</Route>
      <Route path="/scanner/goodies">{() => <RequireRole route="/scanner/goodies"><ScannerGoodies /></RequireRole>}</Route>
      <Route path="/scanner/benevoles">{() => <RequireRole route="/scanner/benevoles"><ScannerBenevoles /></RequireRole>}</Route>
      <Route path="/scanner/ftours">{() => <RequireRole route="/scanner/ftours"><ScannerFtours /></RequireRole>}</Route>
      <Route path="/scanner">{() => <RequireRole route="/scanner"><Scanner /></RequireRole>}</Route>

      {/* ================================================
          PUBLIC CHECK-IN — sans :lang
          ================================================ */}
      <Route path="/checkin/:token" component={Checkin} />
      <Route path="/checkin-reservation/:token" component={CheckinReservation} />

      {/* ================================================
          REDIRECT ROOT → default locale
          ================================================ */}
      <Route path="/">
        {() => <Redirect to={`/${lang}`} />}
      </Route>

      {/* ================================================
          PUBLIC ROUTES — sous /:lang (section 4.1)
          ================================================ */}
      <Route path="/:lang" component={Home} />
      <Route path="/:lang/programme" component={Programme} />
      <Route path="/:lang/benevole" component={Benevole} />
      <Route path="/:lang/evenement" component={Evenement} />
      <Route path="/:lang/association" component={Association} />
      <Route path="/:lang/contact" component={Contact} />
      <Route path="/:lang/faq" component={FAQ} />
      <Route path="/:lang/mentions-legales" component={MentionsLegales} />
      <Route path="/:lang/connexion" component={Login} />
      <Route path="/:lang/inscription" component={Signup} />

      {/* Restaurant public */}
      <Route path="/:lang/restaurant/groupes" component={RestaurantGroupes} />
      <Route path="/:lang/reservation" component={Reservation} />
      <Route path="/:lang/company-booking" component={CompanyBooking} />
      <Route path="/:lang/company-booking-confirmation/:reference" component={CompanyBookingConfirmation} />
      <Route path="/:lang/company-booking-space/:token" component={CompanyBookingSpace} />

      {/* Boutique Solidaire (hub) */}
      <Route path="/:lang/boutique" component={BoutiqueSolidaire} />

      {/* Commerce public */}
      <Route path="/:lang/patisserie" component={Pastries} />
      <Route path="/:lang/terroir" component={ProduitsTerroir} />
      <Route path="/:lang/goodies" component={Goodies} />
      <Route path="/:lang/cart/:type" component={Cart} />
      <Route path="/:lang/checkout/:type" component={UnifiedCheckout} />
      <Route path="/:lang/buy/goodie/:id" component={BuyGoodie} />
      <Route path="/:lang/buy/pastry/:id" component={BuyPastry} />

      {/* Dons public */}
      <Route path="/:lang/dons" component={Dons} />

      {/* ================================================
          LEGACY ROUTES — redirects vers /:lang/*
          ================================================ */}
      <Route path="/programme">
        {() => <Redirect to={`/${lang}/programme`} />}
      </Route>
      <Route path="/benevole">
        {() => <Redirect to={`/${lang}/benevole`} />}
      </Route>
      <Route path="/goodies">
        {() => <Redirect to={`/${lang}/goodies`} />}
      </Route>
      <Route path="/pastries">
        {() => <Redirect to={`/${lang}/patisserie`} />}
      </Route>
      <Route path="/dons">
        {() => <Redirect to={`/${lang}/dons`} />}
      </Route>
      <Route path="/evenement">
        {() => <Redirect to={`/${lang}/evenement`} />}
      </Route>
      <Route path="/association">
        {() => <Redirect to={`/${lang}/association`} />}
      </Route>
      <Route path="/contact">
        {() => <Redirect to={`/${lang}/contact`} />}
      </Route>
      <Route path="/faq">
        {() => <Redirect to={`/${lang}/faq`} />}
      </Route>
      <Route path="/mentions-legales">
        {() => <Redirect to={`/${lang}/mentions-legales`} />}
      </Route>
      <Route path="/connexion">
        {() => <Redirect to={`/${lang}/connexion`} />}
      </Route>
      <Route path="/inscription">
        {() => <Redirect to={`/${lang}/inscription`} />}
      </Route>
      <Route path="/reservation">
        {() => <Redirect to={`/${lang}/reservation`} />}
      </Route>

      {/* ================================================
          404
          ================================================ */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <LocalizedRoutes />
            <WhatsAppFloatingButton />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
