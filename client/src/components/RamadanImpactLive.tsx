import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-MA').format(value);
}

export default function RamadanImpactLive({ className = "" }: { className?: string }) {
  const { data, isLoading, error } = trpc.ramadan.publicSummary.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <section className={`py-12 ${className}`}>
      <div className="container space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-bold">Ramadan {data?.hijriYear ?? '1447'} - Live dashboard</h2>
            <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              En direct
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => <Skeleton key={idx} className="h-28 w-full" />)}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Impossible de charger les statistiques Ramadan pour le moment.
            </CardContent>
          </Card>
        ) : data?.todayRamadanDay == null ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Les statistiques seront mises à jour pendant Ramadan.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Jour de Ramadan</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.todayRamadanDay}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Repas distribués</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{formatNumber(data.totalsToDate.meals)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Participants Bénévoles</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{formatNumber(data.totalsToDate.volunteersPresence)}</div></CardContent>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
