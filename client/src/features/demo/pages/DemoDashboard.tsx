import { useMemo } from "react";
import {
  HandCoins,
  Users,
  UtensilsCrossed,
  Handshake,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatMAD, formatNumber, formatRelativeTime } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";

const PIE_COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa"];

export default function DemoDashboard() {
  const data = useDemoData();

  const stats = useMemo(() => {
    const totalDonations = data.donations
      .filter((d) => d.status === "valide")
      .reduce((acc, d) => acc + d.amount, 0);
    const totalMeals = data.ftourDays.reduce((acc, d) => acc + d.servedMeals, 0);
    const benevoles = data.users.filter((u) => u.role === "benevole").length;
    const partenaires = data.partners.length;

    const donationsByDay = new Map<string, number>();
    data.donations.forEach((d) => {
      const key = d.createdAt.slice(0, 10);
      donationsByDay.set(key, (donationsByDay.get(key) ?? 0) + d.amount);
    });
    const sortedDays = Array.from(donationsByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
    const donationsSeries = sortedDays.map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      amount,
    }));

    const ftourSeries = data.ftourDays.slice(-14).map((d) => ({
      date: new Date(d.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      repas: d.servedMeals,
      benevoles: d.volunteersCount,
    }));

    const partnerTierStats = ["platine", "or", "argent", "bronze"].map((tier) => ({
      name: tier.charAt(0).toUpperCase() + tier.slice(1),
      value: data.partners.filter((p) => p.tier === tier).length,
    }));

    return {
      totalDonations,
      totalMeals,
      benevoles,
      partenaires,
      donationsSeries,
      ftourSeries,
      partnerTierStats,
    };
  }, [data]);

  return (
    <DemoLayout
      title="Tableau de bord"
      subtitle="Vue d'ensemble de l'activité de l'association"
      tooltip="Les KPI agrègent l'ensemble des modules : dons, ftours, bénévoles, partenaires, réservations et boutique."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Dons collectés"
          value={formatMAD(stats.totalDonations)}
          trend={{ value: 12.4 }}
          icon={HandCoins}
          accent="orange"
        />
        <KpiCard
          label="Repas servis"
          value={formatNumber(stats.totalMeals)}
          trend={{ value: 8.1 }}
          icon={UtensilsCrossed}
          accent="emerald"
        />
        <KpiCard
          label="Bénévoles actifs"
          value={formatNumber(stats.benevoles)}
          trend={{ value: 3.2 }}
          icon={Users}
          accent="sky"
        />
        <KpiCard
          label="Partenaires"
          value={formatNumber(stats.partenaires)}
          trend={{ value: -1.6 }}
          icon={Handshake}
          accent="violet"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Dons cumulés — 14 derniers jours
              </h2>
              <p className="text-xs text-slate-500">
                Évolution des contributions quotidiennes
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-orange-500" aria-hidden="true" />
          </header>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.donationsSeries}>
                <defs>
                  <linearGradient id="demo-don" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(v: number) => [formatMAD(v), "Dons"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#demo-don)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Partenaires par niveau
            </h2>
            <p className="text-xs text-slate-500">
              Répartition des entreprises engagées
            </p>
          </header>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.partnerTierStats}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {stats.partnerTierStats.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={24} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Activité ftour — Repas servis vs Bénévoles
            </h2>
            <p className="text-xs text-slate-500">
              Comparatif sur les 14 derniers jours
            </p>
          </header>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ftourSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend />
                <Bar dataKey="repas" fill="#10b981" radius={[4, 4, 0, 0]} name="Repas" />
                <Bar dataKey="benevoles" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Bénévoles" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Activité récente</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              En direct
            </span>
          </header>
          <ul className="space-y-3 text-sm">
            {data.activity.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{item.label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {item.actor} · {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DemoLayout>
  );
}
