import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

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

// Scanner
import Scanner from "./pages/Scanner";
import Checkin from "./pages/Checkin";

// Admin pages
import Admin from "./pages/Admin";
import AdminBenevoles from "./pages/AdminBenevoles";
import AdminCommandes from "./pages/AdminCommandes";
import AdminDons from "./pages/AdminDons";
import AdminJours from "./pages/AdminJours";
import AdminUtilisateurs from "./pages/AdminUtilisateurs";
import AdminGoodies from "./pages/AdminGoodies";
import AdminScan from "./pages/AdminScan";

function Router() {
  return (
    <Switch>
      {/* Public pages */}
      <Route path="/" component={Home} />
      <Route path="/programme" component={Programme} />
      <Route path="/benevole" component={Benevole} />
      <Route path="/goodies" component={Goodies} />
      <Route path="/dons" component={Dons} />
      <Route path="/evenement" component={Evenement} />
      <Route path="/association" component={Association} />
      <Route path="/contact" component={Contact} />
      <Route path="/faq" component={FAQ} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/connexion" component={Login} />
      <Route path="/inscription" component={Signup} />
      
      {/* Scanner (mobile-first) */}
      <Route path="/scanner" component={Scanner} />
      
      {/* Public QR Check-in page */}
      <Route path="/checkin/:token" component={Checkin} />
      
      {/* Admin pages */}
      <Route path="/admin" component={Admin} />
      <Route path="/admin/benevoles" component={AdminBenevoles} />
      <Route path="/admin/commandes" component={AdminCommandes} />
      <Route path="/admin/dons" component={AdminDons} />
      <Route path="/admin/jours" component={AdminJours} />
      <Route path="/admin/utilisateurs" component={AdminUtilisateurs} />
      <Route path="/admin/goodies" component={AdminGoodies} />
      <Route path="/admin/scan" component={AdminScan} />
      
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
