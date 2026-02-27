import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export function useRequireAuth(redirectTo: string) {
  const auth = useAuth();

  useEffect(() => {
    if (auth.loading) return;
    if (auth.isAuthenticated) return;

    const lang = window.location.pathname.split("/").filter(Boolean)[0] || "fr";
    const target = `/${lang}/connexion?redirectTo=${encodeURIComponent(redirectTo)}`;
    window.location.href = target;
  }, [auth.isAuthenticated, auth.loading, redirectTo]);

  return auth;
}

export default function PrivateRoute({
  children,
  redirectTo,
}: {
  children: ReactNode;
  redirectTo: string;
}) {
  const auth = useRequireAuth(redirectTo);

  if (auth.loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!auth.isAuthenticated) return null;
  return <>{children}</>;
}
