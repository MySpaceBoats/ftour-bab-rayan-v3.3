import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Users, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { getRolesForRoute } from "@/shared/rbac/permissions";

interface RequireRoleProps {
  /**
   * Liste explicite de rôles autorisés (legacy).
   * Préférer `route` pour résoudre via le RBAC centralisé.
   */
  allowedRoles?: string[];
  /**
   * Route admin à résoudre via shared/rbac/permissions.ts.
   * Si fourni, les rôles sont résolus automatiquement.
   */
  route?: string;
  children: React.ReactNode;
  redirectTo?: string;
}

export default function RequireRole({
  allowedRoles,
  route,
  children,
  redirectTo = "/admin",
}: RequireRoleProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const [location, navigate] = useLocation();
  const isPublicAdminAccess = location.startsWith("/admin3");

  // Résoudre les rôles : RBAC centralisé (route) > allowedRoles explicite
  const resolvedRoles: readonly string[] = route
    ? getRolesForRoute(route)
    : (allowedRoles ?? []);

  useEffect(() => {
    if (!isPublicAdminAccess && !loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated, isPublicAdminAccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPublicAdminAccess && (!isAuthenticated || !user?.role || !resolvedRoles.includes(user.role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <Users className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les droits nécessaires pour accéder à cette page.
            </p>
            <Link href={redirectTo}>
              <Button variant="outline">Retour</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
