import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, XCircle, Loader2 } from "lucide-react";
import UniversalScannerCore from "@/components/UniversalScannerCore";

export default function AdminScan() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const isScanner = user?.role && ['admin', 'super_admin', 'admin_ops', 'scanner'].includes(user.role);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !isScanner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Acces refuse</h2>
            <p className="text-muted-foreground mb-4">
              Vous n'avez pas les permissions necessaires pour acceder au scanner.
            </p>
            <Link href="/">
              <Button>Retour a l'accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Scanner Universel</h1>
            <p className="text-xs text-muted-foreground">Benevoles - Reservations - Commandes - Dons</p>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto">
        <UniversalScannerCore onBack={() => navigate('/admin')} />
      </main>
    </div>
  );
}
