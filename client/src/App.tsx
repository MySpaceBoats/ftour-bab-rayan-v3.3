import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/features/public/pages/NotFound";
import { Route, Switch, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { useI18n, SUPPORTED_LOCALES, type Locale } from "./i18n";

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
import Galerie from "@/features/gallery/pages/Galerie";

// ============================================
// AUTH — features/auth
// ============================================
import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";

// ============================================
// RESTAURANT — features/restaurant
// ============================================
import RestaurantGroupes from "@/features/restaurant/pages/RestaurantGroupes";
import RestaurantParticuliers from "@/features/restaurant/pages/RestaurantParticuliers";
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
import AdminGalerie from "@/features/gallery/admin/AdminGalerie";
import AdminGalerieNouveau from "@/features/gallery/admin/AdminGalerieNouveau";
import AdminGalerieEdit from "@/features/gallery/admin/AdminGalerieEdit";

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
    if (
      location.startsWith("/admin") ||
      location.startsWith("/scanner") ||
      location.startsWith("/checkin")
    ) {
      return;
    }

    const pathParts = location.split("/").filter(Boolean);
    const urlLocale = pathParts[0] as Locale;

    if (SUPPORTED_LOCALES.includes(urlLocale)) {
      if (urlLocale !== lang) {
        setLang(urlLocale);
      }
    }
  }, [location, lang, setLang]);

  useEffect(() => {
    const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as
      | string
      | undefined;
    const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as
      | string
      | undefined;

    if (!endpoint || !websiteId) {
      return;
    }

    if (document.querySelector("script[data-website-id]")) {
      return;
    }

    const script = document.createElement("script");
    script.defer = true;
    script.src = `${endpoint.replace(/\/$/, "")}/umami`;
    script.setAttribute("data-website-id", websiteId);
    document.body.appendChild(script);
  }, []);

  return (
    <Switch>
      {/* ================================================
          ADMIN ROUTES — sans :lang (section 4.2)
          ================================================ */}
      <Route path="/admin" component={AdminDashboard} />
      <Route
        path="/admin/unified-dashboard"
        component={AdminUnifiedDashboard}
      />

      {/* Admin Restaurant */}
      <Route
        path="/admin/restaurant/groupes"
        component={AdminRestaurantGroupes}
      />
      <Route
        path="/admin/restaurant/entreprises"
        component={AdminRestaurantEntreprises}
      />
      <Route path="/admin/restaurants" component={AdminRestaurants} />
      <Route
        path="/admin/restaurant-reservations"
        component={AdminRestaurantReservations}
      />
      <Route
        path="/admin/reservations"
        component={AdminRestaurantReservations}
      />
      <Route path="/admin/company-bookings" component={AdminCompanyBookings} />
      <Route
        path="/admin/reservations-calendar"
        component={AdminReservationsCalendar}
      />
      <Route path="/admin/scan-reservation" component={AdminScanReservation} />

      {/* Admin Pâtisserie */}
      <Route path="/admin/patisserie" component={AdminPastries} />
      <Route path="/admin/pastries" component={AdminPastries} />
      <Route
        path="/admin/patisserie/catalogue"
        component={AdminPastryCatalog}
      />

      {/* Admin Terroir */}
      <Route path="/admin/terroir/products" component={AdminTerroirProducts} />
      <Route path="/admin/terroir/orders" component={AdminTerroirOrders} />

      {/* Admin Goodies */}
      <Route path="/admin/goodies" component={AdminGoodies} />
      <Route path="/admin/commandes" component={AdminCommandes} />

      {/* Admin Dons */}
      <Route path="/admin/dons" component={AdminDons} />

      {/* Admin Ops */}
      <Route path="/admin/benevoles" component={AdminBenevoles} />
      <Route path="/admin/jours" component={AdminJours} />
      <Route path="/admin/scan-product" component={AdminScanProduct} />
      <Route path="/admin/payments" component={AdminPayments} />
      <Route path="/admin/utilisateurs" component={AdminUtilisateurs} />

      {/* Admin QR Codes Catalogue */}
      <Route path="/admin/qr-codes" component={AdminQRCodes} />
      <Route path="/admin/galerie" component={AdminGalerie} />
      <Route path="/admin/galerie/nouveau" component={AdminGalerieNouveau} />
      <Route path="/admin/galerie/:id" component={AdminGalerieEdit} />

      {/* Admin Contenu */}
      <Route path="/admin/contenu" component={AdminContenu} />

      {/* Admin Messages */}
      <Route path="/admin/messages" component={AdminMessages} />

      {/* ================================================
          SCANNER — route unique (section 4.3)
          ================================================ */}
      <Route path="/scanner/patisserie" component={ScannerPatisserie} />
      <Route path="/scanner/unifie" component={ScannerUnifie} />
      <Route path="/scanner/goodies" component={ScannerGoodies} />
      <Route path="/scanner/benevoles" component={ScannerBenevoles} />
      <Route path="/scanner/ftours" component={ScannerFtours} />
      <Route path="/scanner" component={Scanner} />

      {/* ================================================
          PUBLIC CHECK-IN — sans :lang
          ================================================ */}
      <Route path="/checkin/:token" component={Checkin} />
      <Route
        path="/checkin-reservation/:token"
        component={CheckinReservation}
      />

      {/* ================================================
          REDIRECT ROOT → default locale
          ================================================ */}
      <Route path="/">{() => <Redirect to={`/${lang}`} />}</Route>

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
      <Route path="/:lang/galerie" component={Galerie} />
      <Route path="/:lang/connexion" component={Login} />
      <Route path="/:lang/inscription" component={Signup} />

      {/* Restaurant public */}
      <Route
        path="/:lang/restaurant/particuliers"
        component={RestaurantParticuliers}
      />
      <Route path="/:lang/restaurant/groupes" component={RestaurantGroupes} />
      <Route path="/:lang/reservation" component={Reservation} />
      <Route path="/:lang/company-booking" component={CompanyBooking} />
      <Route
        path="/:lang/company-booking-confirmation/:reference"
        component={CompanyBookingConfirmation}
      />
      <Route
        path="/:lang/company-booking-space/:token"
        component={CompanyBookingSpace}
      />

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
      <Route path="/dons">{() => <Redirect to={`/${lang}/dons`} />}</Route>
      <Route path="/evenement">
        {() => <Redirect to={`/${lang}/evenement`} />}
      </Route>
      <Route path="/association">
        {() => <Redirect to={`/${lang}/association`} />}
      </Route>
      <Route path="/contact">
        {() => <Redirect to={`/${lang}/contact`} />}
      </Route>
      <Route path="/faq">{() => <Redirect to={`/${lang}/faq`} />}</Route>
      <Route path="/mentions-legales">
        {() => <Redirect to={`/${lang}/mentions-legales`} />}
      </Route>
      <Route path="/galerie">
        {() => <Redirect to={`/${lang}/galerie`} />}
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
