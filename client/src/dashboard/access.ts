import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
export { hasDashboardAccess, filterDashboardItems } from '@shared/dashboard/access';
import { hasDashboardAccess } from '@shared/dashboard/access';

export function useAllowedDashboardKeys() {
  const query = trpc.users.myDashboardKeys.useQuery();

  const allowedKeys = useMemo(
    () => new Set(query.data ?? []),
    [query.data]
  );

  return {
    ...query,
    allowedKeys,
    hasAccess: (key: string) => hasDashboardAccess(key, allowedKeys),
  };
}
