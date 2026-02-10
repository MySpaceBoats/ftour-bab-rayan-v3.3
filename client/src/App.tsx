import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useI18n, SUPPORTED_LOCALES, type Locale } from "./i18n";

// Public pages
import Home from "./pages/Home";
import Programme from "./pages/Programme";
import Benevole from "./pages/Benevole";
import Goodies from "./pages/Goodies";
import Dons from "./pages/Dons";
import Evenement from "./pages/Evenement";
import Association from "./pages/Association";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import MentionsLegales from "./pages/MentionsLegales";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Reservation from "./pages/Reservation";
import Pastries from "./pages/Pastries";
import ProduitsTerroir from "./pages/ProduitsTerroir";
import BuyGoodie from "./pages/BuyGoodie";
import BuyPastry from "./pages/BuyPastry";

// Scanner
import Scanner from "./pages/Scanner";
import Checkin from "./pages/Checkin";
import ScannerGoodies from "./pages/ScannerGoodies";
import ScannerFtours from "./pages/ScannerFtours";
import ScannerBenevoles from "./pages/ScannerBenevoles";

// Admin pages
import Admin from "./pages/Admin";
import AdminBenevoles from "./pages/AdminBenevoles";
import AdminCommandes from "./pages/AdminCommandes";
import AdminDons from "./pages/AdminDons";
import AdminJours from "./pages/AdminJours";
import AdminUtilisateurs from "./pages/AdminUtilisateurs";
import AdminGoodies from "./pages/AdminGoodies";
import AdminScan from "./pages/AdminScan";
import AdminReservations from "./pages/AdminReservations";
import AdminRestaurants from "./pages/AdminRestaurants";
import AdminScanReservation from "./pages/AdminScanReservation";
import AdminPayments from "./pages/AdminPayments";
import AdminScanProduct from "./pages/AdminScanProduct";
import AdminPastries from "./pages/AdminPastries";
import AdminUnifiedDashboard from "./pages/AdminUnifiedDashboard";
import AdminRestaurantParticuliers from "./pages/AdminRestaurantParticuliers";
import AdminRestaurantEntreprises from "./pages/AdminRestaurantEntreprises";
import AdminRestaurantGroupes from "./pages/AdminRestaurantGroupes";
import AdminTerroirOrders from "./pages/AdminTerroirOrders";
import AdminTerroirProducts from "./pages/AdminTerroirProducts";
import CheckinReservation from "./pages/CheckinReservation";
import CompanyBooking from "./pages/CompanyBooking";
import CompanyBookingConfirmation from "./pages/CompanyBookingConfirmation";
import CompanyBookingSpace from "./pages/CompanyBookingSpace";
import AdminCompanyBookings from "./pages/AdminCompanyBookings";

// Language-aware route wrapper
function LocalizedRoutes() {
  const [location] = useLocation();
  const { lang, setLang } = useI18n();
  
  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  // Extract locale from URL path (only for non-admin routes)
  useEffect(() => {
    // Skip locale detection for admin, scanner, and checkin routes
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
      {/* Admin pages - MUST be before /:lang to avoid being captured */}
      <Route path="/admin" component={Admin} />
      <Route path="/admin/benevoles" component={AdminBenevoles} />
      <Route path="/admin/commandes" component={AdminCommandes} />
      <Route path="/admin/dons" component={AdminDons} />
      <Route path="/admin/jours" component={AdminJours} />
      <Route path="/admin/utilisateurs" component={AdminUtilisateurs} />
      <Route path="/admin/goodies" component={AdminGoodies} />
      <Route path="/admin/scan" component={AdminScan} />
      <Route path="/admin/payments" component={AdminPayments} />
      <Route path="/admin/reservations" component={AdminReservations} />
      <Route path="/admin/restaurants" component={AdminRestaurants} />
      <Route path="/admin/scan-reservation" component={AdminScanReservation} />
      <Route path="/admin/scan-product" component={AdminScanProduct} />
      <Route path="/admin/pastries" component={AdminPastries} />
      <Route path="/admin/unified-dashboard" component={AdminUnifiedDashboard} />
      <Route path="/admin/restaurant/particuliers" component={AdminRestaurantParticuliers} />
      <Route path="/admin/restaurant/entreprises" component={AdminRestaurantEntreprises} />
      <Route path="/admin/restaurant/groupes" component={AdminRestaurantGroupes} />
      <Route path="/admin/terroir/orders" component={AdminTerroirOrders} />
      <Route path="/admin/terroir/products" component={AdminTerroirProducts} />
      <Route path="/admin/company-bookings" component={AdminCompanyBookings} />
      
      {/* Scanner (mobile-first) - no locale prefix */}
      <Route path="/scanner" component={Scanner} />
      <Route path="/scanner/goodies" component={ScannerGoodies} />
      <Route path="/scanner/ftours" component={ScannerFtours} />
      <Route path="/scanner/benevoles" component={ScannerBenevoles} />
      
      {/* Public QR Check-in page - no locale prefix */}
      <Route path="/checkin/:token" component={Checkin} />
      <Route path="/checkin-reservation/:token" component={CheckinReservation} />
      
      {/* Redirect root to default locale */}
      <Route path="/">
        {() => <Redirect to={`/${lang}`} />}
      </Route>
      
      {/* Localized public pages */}
      <Route path="/:lang" component={Home} />
      <Route path="/:lang/programme" component={Programme} />
      <Route path="/:lang/benevole" component={Benevole} />
      <Route path="/:lang/goodies" component={Goodies} />
      <Route path="/:lang/produits-terroir" component={ProduitsTerroir} />
      <Route path="/:lang/pastries" component={Pastries} />
      <Route path="/:lang/dons" component={Dons} />
      <Route path="/:lang/evenement" component={Evenement} />
      <Route path="/:lang/association" component={Association} />
      <Route path="/:lang/contact" component={Contact} />
      <Route path="/:lang/faq" component={FAQ} />
      <Route path="/:lang/mentions-legales" component={MentionsLegales} />
      <Route path="/:lang/connexion" component={Login} />
      <Route path="/:lang/inscription" component={Signup} />
      <Route path="/:lang/reservation" component={Reservation} />
      <Route path="/:lang/company-booking" component={CompanyBooking} />
      <Route path="/:lang/company-booking-confirmation/:reference" component={CompanyBookingConfirmation} />
      <Route path="/:lang/company-booking-space/:token" component={CompanyBookingSpace} />
      <Route path="/:lang/buy/goodie/:id" component={BuyGoodie} />
      <Route path="/:lang/buy/pastry/:id" component={BuyPastry} />
      
      {/* Legacy routes - redirect to localized versions */}
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
        {() => <Redirect to={`/${lang}/pastries`} />}
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
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <LocalizedRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
