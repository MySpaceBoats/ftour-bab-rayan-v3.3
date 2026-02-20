import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { ArrowLeft, XCircle, Loader2 } from "lucide-react";
import { hasRouteAccess } from "@/shared/rbac/permissions";
import UniversalScannerCore from "@/components/UniversalScannerCore";

export default function Scanner() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const isAuthorized = hasRouteAccess(user?.role, '/scanner');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Acces non autorise</h1>
            <p className="text-muted-foreground">Vous n'avez pas les droits necessaires pour acceder au scanner.</p>
            <Button onClick={() => navigate('/')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Retour a l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="font-bold text-lg">Scanner Universel</h1>
            <p className="text-xs opacity-80">Benevoles - Reservations - Commandes - Dons</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <UniversalScannerCore onBack={() => navigate('/admin')} />
      </main>
    </div>
  );
}
