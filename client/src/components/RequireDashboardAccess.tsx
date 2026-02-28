import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAllowedDashboardKeys } from '@/dashboard/access';

interface RequireDashboardAccessProps {
  itemKey?: string;
  children: React.ReactNode;
}

export default function RequireDashboardAccess({ itemKey, children }: RequireDashboardAccessProps) {
  const { isLoading, hasAccess } = useAllowedDashboardKeys();

  if (!itemKey) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess(itemKey)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="h-10 w-10 mx-auto text-red-600" />
            <h1 className="text-xl font-semibold">Non autorisé</h1>
            <p className="text-muted-foreground">Cette section du dashboard n'est pas activée pour votre compte.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
