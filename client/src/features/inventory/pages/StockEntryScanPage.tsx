import { useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const ALLOWED_ROLES = ["admin", "super_admin", "admin_ops", "admin_boutique", "admin_patisserie", "admin_terroir"];

export default function StockEntryScanPage() {
  const [, params] = useRoute("/stock-entry/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const { isAuthenticated, user, loading } = useAuth();

  const { data, error, isLoading } = trpc.inventory.stockEntry.getBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = `/fr/connexion?redirectTo=${encodeURIComponent(`/stock-entry/${slug}`)}`;
      return;
    }
    if (!ALLOWED_ROLES.includes(user?.role || "")) {
      navigate("/admin");
      return;
    }
    if (data?.id) navigate(`/admin/inventory/stock-entry/${data.id}`);
  }, [loading, isAuthenticated, user?.role, data?.id, navigate, slug]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle>QR Entrée Stock</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isLoading && <p>Vérification du QR…</p>}
          {!!error && <p className="text-red-600">{error.message}</p>}
          {!isLoading && !error && <p>Redirection vers la fiche d'entrée stock…</p>}
          <Link href="/admin/inventory/stock-entry"><Button variant="outline">Ouvrir le dashboard</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
