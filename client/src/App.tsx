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
// RAMADAN CLOSING PAGE
// ============================================
import RamadanClosingPage from "@/features/closing/components/RamadanClosingPage";

// ============================================
// PUBLIC PAGES — features/public
// ============================================
import Home from "@/features/public/pages/Home";
import Programme from "@/features/public/pages/Programme";
import Benevole from "@/features/public/pages/Benevole";
import Evenement from "@/features/public/pages/Evenement";
import Association from "@/features/public/pages/Association";
import Contact from "@/features/public/pages/Contact";
import DevenirPartenaire from "@/features/public/pages/DevenirPartenaire";
import FAQ from "@/features/public/pages/FAQ";
import MentionsLegales from "@/features/public/pages/MentionsLegales";
import RibDownload from "@/features/public/pages/RibDownload";
import Temoignages from "@/features/public/pages/Temoignages";
import Galerie from "@/features/gallery/pages/Galerie";
import BenevoleGalerieUpload from "@/features/gallery/pages/BenevoleGalerieUpload";
import HubPage from "@/features/hub/pages/HubPage";
import MarketPage from "@/features/hub/market/pages/MarketPage";
import InboxPage from "@/features/hub/market/pages/InboxPage";
import ConversationPage from "@/features/hub/market/pages/ConversationPage";
import ListingDetailPage from "@/features/hub/market/pages/ListingDetailPage";
import ListingFormPage from "@/features/hub/market/pages/ListingFormPage";
import HubProfilePage from "@/features/hub/pages/HubProfilePage";
import GalerieValidationUpload from "@/features/gallery/pages/GalerieValidationUpload";

// ============================================
// AUTH — features/auth
// ============================================
import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";
import ForgotPassword from "@/features/auth/pages/ForgotPassword";
import DemoAccess from "@/features/auth/pages/DemoAccess";

// ============================================
// DEMO SANDBOX — features/demo
// ============================================
import DemoLanding from "@/features/demo/pages/DemoLanding";
import DemoDashboard from "@/features/demo/pages/DemoDashboard";
import DemoUtilisateurs from "@/features/demo/pages/DemoUtilisateurs";
import DemoDons from "@/features/demo/pages/DemoDons";
import DemoFtour from "@/features/demo/pages/DemoFtour";
import DemoPartenaires from "@/features/demo/pages/DemoPartenaires";
import DemoReservations from "@/features/demo/pages/DemoReservations";
import DemoBoutique from "@/features/demo/pages/DemoBoutique";
import DemoInventaire from "@/features/demo/pages/DemoInventaire";
import DemoEquipe from "@/features/demo/pages/DemoEquipe";
import DemoBlog from "@/features/demo/pages/DemoBlog";

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
import GroupReservationEmailConfirmation from "@/features/restaurant/pages/GroupReservationEmailConfirmation";
import AdminReservationValidation from "@/features/restaurant/pages/AdminReservationValidation";
import ReservationProofUpload from "@/features/restaurant/pages/ReservationProofUpload";

// ============================================
// PATISSERIE — features/patisserie
// ============================================
import Pastries from "@/features/patisserie/pages/Pastries";

// ============================================
// TERROIR — features/terroir
// ============================================
import Terroir from "@/features/terroir/pages/Terroir";
import TerroirQRPage from "@/features/terroir/pages/TerroirQRPage";

// ============================================
// BOUTIQUE — features/boutique
// ============================================
import BoutiqueSolidaire from "@/features/boutique/pages/BoutiqueSolidaire";
import CommerceSolidaire from "@/features/boutique/pages/CommerceSolidaire";

// ============================================
// GOODIES — features/goodies
// ============================================
import Goodies from "@/features/goodies/pages/Goodies";
import BoutiqueProductTypePage from "@/features/boutique/pages/BoutiqueProductTypePage";
import Cart from "@/features/goodies/pages/Cart";
import { Checkout as UnifiedCheckout } from "@/features/goodies/pages/Checkout";
import GoodiesQRPage from "@/features/goodies/pages/GoodiesQRPage";

// ============================================
// DONS — features/dons
// ============================================
import Dons from "@/features/dons/pages/Dons";

// ============================================
// OPS — features/ops
// ============================================
import AdminRoutes from "@/features/ops/admin/AdminRoutes";

// ============================================
// SCANNER — features/scanner
// ============================================
import Scanner from "@/features/scanner/pages/Scanner";
import Checkin from "@/features/scanner/pages/Checkin";
import CancelVolunteer from "@/features/scanner/pages/CancelVolunteer";
import ScannerPatisserie from "@/features/scanner/pages/ScannerPatisserie";
import ScannerUnifie from "@/features/scanner/pages/ScannerUnifie";
import ScannerGoodies from "@/features/scanner/pages/ScannerGoodies";
import ScannerBenevoles from "@/features/scanner/pages/ScannerBenevoles";
import ScannerFtours from "@/features/scanner/pages/ScannerFtours";

// ============================================
// INVENTORY — features/inventory
// ============================================
import StockEntryScanPage from "@/features/inventory/pages/StockEntryScanPage";

import MenuSolidaire from "@/features/menu/pages/MenuSolidaire";
import VolunteerCancellation from "@/features/volunteer/pages/VolunteerCancellation";
import MenuCheckout from "@/features/menu/pages/MenuCheckout";
import MenuProof from "@/features/menu/pages/MenuProof";
import VolunteerProfilePage from "@/features/volunteer/pages/VolunteerProfile";

import WhatsAppFloatingButton from "./components/WhatsAppFloatingButton";

// ============================================
// FTOUR BÉNÉVOLES — features/ftour
// ============================================
import FtourConfirmation from "@/features/ftour/pages/FtourConfirmation";

// ============================================
// TEAM TROMBINOSCOPE — features/team
// ============================================
import EquipeFtour from "@/features/team/pages/EquipeFtour";

// ============================================
// BLOG COMMUNAUTAIRE — features/blog
// ============================================
import BlogList from "@/features/blog/pages/BlogList";
import BlogPost from "@/features/blog/pages/BlogPost";
import BlogNew from "@/features/blog/pages/BlogNew";

// ============================================
// FEEDBACK — features/feedback
// ============================================
import FeedbackPage from "@/features/feedback/pages/FeedbackPage";
import SiteFeedbackPage from "@/features/feedback/pages/SiteFeedbackPage";
import EventFeedbackForm from "@/features/feedback/pages/EventFeedbackForm";

// ============================================
// ELECTION MANAGERS — features/election
// ============================================
import ElectionManagers from "@/features/election/pages/ElectionManagers";
import CandidatureManager from "@/features/election/pages/CandidatureManager";
import ResultatsElection from "@/features/election/pages/ResultatsElection";
import ManagersHistory from "@/features/election/pages/ManagersHistory";

// ============================================
// ROUTES
// ============================================

function LocalizedRoutes() {
  const [location, setLocation] = useLocation();
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
    if (typeof window === "undefined") return;

    if (location.startsWith("/admin3")) {
      sessionStorage.setItem("public-admin3-mode", "1");
      return;
    }

    const publicAdmin3Mode = sessionStorage.getItem("public-admin3-mode") === "1";
    if (!publicAdmin3Mode) return;
    if (!location.startsWith("/admin/")) return;

    setLocation(location.replace(/^\/admin(\/|$)/, "/admin3$1"));
  }, [location, setLocation]);

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
          ADMIN ROUTES — wrapped by AdminFrame shell
          Both /admin and /admin3 handled inside AdminRoutes
          ================================================ */}
      <Route path="/admin/*" component={AdminRoutes} />
      <Route path="/admin" component={AdminRoutes} />
      <Route path="/admin3/*" component={AdminRoutes} />
      <Route path="/admin3" component={AdminRoutes} />

      {/* ================================================
          SCANNER — route unique (section 4.3)
          ================================================ */}
      <Route path="/scanner/patisserie" component={ScannerPatisserie} />
      <Route path="/scanner/unifie" component={ScannerUnifie} />
      <Route path="/scanner/goodies" component={ScannerGoodies} />
      <Route path="/scanner/benevoles" component={ScannerBenevoles} />
      <Route path="/scanner/ftours" component={ScannerFtours} />
      <Route path="/scanner" component={Scanner} />

      {/* QR Code commande goodies */}
      <Route path="/qr/goodies/:reference" component={GoodiesQRPage} />

      {/* QR Code commande terroir */}
      <Route path="/qr/terroir/:reference" component={TerroirQRPage} />

      <Route path="/stock-entry/:slug" component={StockEntryScanPage} />

      {/* ================================================
          PUBLIC CHECK-IN — sans :lang
          ================================================ */}
      {/* Ftour Bénévoles — confirmation publique */}
      <Route path="/ftour/confirm/:token" component={FtourConfirmation} />

      <Route path="/checkin/:token" component={Checkin} />
      <Route path="/cancel-volunteer/:token" component={CancelVolunteer} />
      <Route
        path="/checkin-reservation/:token"
        component={CheckinReservation}
      />
      <Route
        path="/reservation-groupe/confirmation-email/:token"
        component={GroupReservationEmailConfirmation}
      />
      <Route
        path="/reservation/valider/:token"
        component={AdminReservationValidation}
      />
      <Route path="/reservations/preuve" component={ReservationProofUpload} />
      <Route
        path="/galerie/validation/:token"
        component={GalerieValidationUpload}
      />

      {/* ================================================
          HOMEPAGE
          ================================================ */}
      {/* ================================================
          DEMO — /demo/* (espace d'aperçu interactif)
          ================================================ */}
      <Route path="/demo-access" component={DemoAccess} />
      <Route path="/demo/dashboard" component={DemoDashboard} />
      <Route path="/demo/utilisateurs" component={DemoUtilisateurs} />
      <Route path="/demo/dons" component={DemoDons} />
      <Route path="/demo/ftour" component={DemoFtour} />
      <Route path="/demo/reservations" component={DemoReservations} />
      <Route path="/demo/boutique" component={DemoBoutique} />
      <Route path="/demo/inventaire" component={DemoInventaire} />
      <Route path="/demo/equipe" component={DemoEquipe} />
      <Route path="/demo/blog" component={DemoBlog} />
      <Route path="/demo/partenaires" component={DemoPartenaires} />
      <Route path="/demo" component={DemoLanding} />

      <Route path="/" component={Home} />

      {/* Blog Communautaire */}
      <Route path="/blog/nouveau" component={BlogNew} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/blog" component={BlogList} />

      {/* Page feedback publique */}
      <Route path="/feedback/evenement" component={EventFeedbackForm} />
      <Route path="/feedback/new" component={SiteFeedbackPage} />
      <Route path="/feedback" component={FeedbackPage} />

      {/* Menu solidaire QR unique */}
      <Route path="/menu" component={MenuSolidaire} />
      <Route path="/shop">{() => <Redirect to="/menu" />}</Route>
      <Route path="/menu/checkout" component={MenuCheckout} />
      <Route path="/proof/:reference" component={MenuProof} />

      {/* ================================================
          PUBLIC ROUTES — sous /:lang (section 4.1)
          ================================================ */}
      <Route path="/:lang" component={Home} />
      <Route path="/:lang/programme" component={Programme} />
      <Route path="/:lang/benevole" component={Benevole} />
      <Route path="/:lang/benevole/photos" component={BenevoleGalerieUpload} />
      <Route path="/:lang/benevole/espace/marketplace/messages/:threadId" component={ConversationPage} />
      <Route path="/:lang/benevole/espace/marketplace/messages" component={InboxPage} />
      <Route path="/:lang/benevole/espace/marketplace/nouveau" component={ListingFormPage} />
      <Route path="/:lang/benevole/espace/marketplace/:id/modifier" component={ListingFormPage} />
      <Route path="/:lang/benevole/espace/marketplace/:id" component={ListingDetailPage} />
      <Route path="/:lang/benevole/espace/marketplace" component={MarketPage} />
      <Route path="/:lang/benevole/espace/profil" component={HubProfilePage} />
      <Route path="/:lang/benevole/espace" component={HubPage} />
      <Route path="/:lang/evenement" component={Evenement} />
      <Route path="/:lang/association" component={Association} />
      <Route path="/:lang/contact" component={Contact} />
      <Route path="/:lang/devenir-partenaire" component={DevenirPartenaire} />
      <Route path="/:lang/faq" component={FAQ} />
      <Route path="/:lang/mentions-legales" component={MentionsLegales} />
      <Route path="/:lang/RIB" component={RibDownload} />
      <Route path="/:lang/galerie" component={Galerie} />
      <Route path="/:lang/connexion" component={Login} />
      <Route path="/:lang/inscription" component={Signup} />
      <Route
        path="/:lang/reinitialiser-mot-de-passe"
        component={ForgotPassword}
      />
      <Route path="/:lang/profil-benevole" component={VolunteerProfilePage} />

      {/* Blog Communautaire */}
      <Route path="/:lang/blog/nouveau" component={BlogNew} />
      <Route path="/:lang/blog/:slug" component={BlogPost} />
      <Route path="/:lang/blog" component={BlogList} />

      {/* Alias FR: Témoignage */}
      <Route path="/:lang/temoignage/nouveau" component={BlogNew} />
      <Route path="/:lang/temoignage/:slug" component={BlogPost} />
      <Route path="/:lang/temoignage" component={Temoignages} />

      {/* Équipe Ftour – Trombinoscope */}
      <Route path="/:lang/equipe-ftour" component={EquipeFtour} />

      {/* Election Managers */}
      <Route path="/:lang/election-managers" component={ElectionManagers} />
      <Route path="/:lang/candidature-manager" component={CandidatureManager} />
      <Route path="/:lang/resultats-election" component={ResultatsElection} />
      <Route path="/:lang/managers" component={ManagersHistory} />

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

      {/* Commerce Solidaire (hub unifié boutique + restaurant) */}
      <Route path="/:lang/commerce-solidaire" component={CommerceSolidaire} />

      {/* Boutique Solidaire (hub) */}
      <Route path="/:lang/boutique" component={BoutiqueSolidaire} />

      {/* Commerce public */}
      <Route path="/:lang/boutique/goodies">{() => <BoutiqueProductTypePage productType="goodies" />}</Route>
      <Route path="/:lang/boutique/terroir">{() => <BoutiqueProductTypePage productType="terroir" />}</Route>
      <Route path="/:lang/boutique/patisserie">{() => <BoutiqueProductTypePage productType="patisserie" />}</Route>
      <Route path="/:lang/patisserie" component={Pastries} />
      <Route path="/:lang/terroir" component={Terroir} />
      <Route path="/:lang/goodies" component={Goodies} />
      <Route path="/:lang/cart/:type" component={Cart} />
      <Route path="/:lang/checkout/:type" component={UnifiedCheckout} />
      <Route path="/:lang/buy/goodie/:id">
        {() => <Redirect to={`/${lang}/goodies`} />}
      </Route>
      <Route path="/:lang/buy/pastry/:id">
        {() => <Redirect to={`/${lang}/patisserie`} />}
      </Route>
      <Route path="/:lang/buy/terroir/:id">
        {() => <Redirect to={`/${lang}/terroir`} />}
      </Route>

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
      <Route path="/boutique/goodies">{() => <Redirect to={`/${lang}/boutique/goodies`} />}</Route>
      <Route path="/boutique/terroir">{() => <Redirect to={`/${lang}/boutique/terroir`} />}</Route>
      <Route path="/boutique/patisserie">{() => <Redirect to={`/${lang}/boutique/patisserie`} />}</Route>
      <Route path="/goodies">
        {() => <Redirect to={`/${lang}/goodies`} />}
      </Route>
      <Route path="/pastries">
        {() => <Redirect to={`/${lang}/patisserie`} />}
      </Route>
      <Route path="/terroir">
        {() => <Redirect to={`/${lang}/terroir`} />}
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
      <Route path="/devenir-partenaire">
        {() => <Redirect to={`/${lang}/devenir-partenaire`} />}
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
      <Route path="/reinitialiser-mot-de-passe">
        {() => <Redirect to={`/${lang}/reinitialiser-mot-de-passe`} />}
      </Route>
      <Route path="/profil-benevole">
        {() => <Redirect to={`/${lang}/profil-benevole`} />}
      </Route>
      <Route path="/blog">
        {() => <Redirect to={`/${lang}/${lang === "fr" ? "temoignage" : "blog"}`} />}
      </Route>
      <Route path="/fr/blog/nouveau">
        {() => <Redirect to="/fr/temoignage/nouveau" />}
      </Route>
      <Route path="/fr/blog/:slug">
        {(params) => <Redirect to={`/fr/temoignage/${params.slug}`} />}
      </Route>
      <Route path="/fr/blog">
        {() => <Redirect to="/fr/temoignage" />}
      </Route>
      <Route path="/equipe-ftour">
        {() => <Redirect to={`/${lang}/equipe-ftour`} />}
      </Route>
      <Route path="/election-managers">
        {() => <Redirect to={`/${lang}/election-managers`} />}
      </Route>
      <Route path="/candidature-manager">
        {() => <Redirect to={`/${lang}/candidature-manager`} />}
      </Route>
      <Route path="/resultats-election">
        {() => <Redirect to={`/${lang}/resultats-election`} />}
      </Route>
      <Route path="/managers">
        {() => <Redirect to={`/${lang}/managers`} />}
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
