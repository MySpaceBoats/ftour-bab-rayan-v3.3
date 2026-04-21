import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { UtensilsCrossed, Users, CalendarDays, Percent } from "lucide-react";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatNumber } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import type { DemoFtourDay } from "../data/types";

export default function DemoFtour() {
  const data = useDemoData();
  const [selected, setSelected] = useState<DemoFtourDay | null>(
    data.ftourDays.at(-1) ?? null,
  );

  const stats = useMemo(() => {
    const totalServed = data.ftourDays.reduce((a, d) => a + d.servedMeals, 0);
    const totalPlanned = data.ftourDays.reduce((a, d) => a + d.plannedMeals, 0);
    const totalVolunteers = data.ftourDays.reduce(
      (a, d) => a + d.volunteersCount,
      0,
    );
    const avgPerDay = data.ftourDays.length
      ? Math.round(totalServed / data.ftourDays.length)
      : 0;
    const fillRate = totalPlanned ? Math.round((totalServed / totalPlanned) * 100) : 0;
    const series = data.ftourDays.map((d) => ({
      date: new Date(d.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      prevus: d.plannedMeals,
      servis: d.servedMeals,
      benevoles: d.volunteersCount,
    }));
    return { totalServed, avgPerDay, totalVolunteers, fillRate, series };
  }, [data.ftourDays]);

  return (
    <DemoLayout
      title="Ftour"
      subtitle="Planning des repas, bénéficiaires et statistiques journalières"
      tooltip="Chaque ligne représente un jour simulé. Sélectionnez un jour pour voir le menu servi et la fréquentation."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Repas servis"
          value={formatNumber(stats.totalServed)}
          icon={UtensilsCrossed}
          accent="emerald"
          trend={{ value: 6.8 }}
        />
        <KpiCard
          label="Moy. / jour"
          value={formatNumber(stats.avgPerDay)}
          icon={CalendarDays}
          accent="orange"
          trend={{ value: 2.4 }}
        />
        <KpiCard
          label="Bénévoles mobilisés"
          value={formatNumber(stats.totalVolunteers)}
          icon={Users}
          accent="sky"
          trend={{ value: 5.0 }}
        />
        <KpiCard
          label="Taux de service"
          value={`${stats.fillRate}%`}
          icon={Percent}
          accent="violet"
          trend={{ value: 1.1 }}
        />
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Évolution repas prévus vs servis
        </h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.series}>
              <defs>
                <linearGradient id="ftour-s" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ftour-p" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Legend />
              <Area
                type="monotone"
                dataKey="prevus"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#ftour-p)"
                name="Prévus"
              />
              <Area
                type="monotone"
                dataKey="servis"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#ftour-s)"
                name="Servis"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white xl:col-span-2">
          <header className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Planning Ramadan</h2>
            <p className="text-xs text-slate-500">
              Journées simulées — cliquez sur une ligne pour voir le détail
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Prévus</th>
                  <th className="px-4 py-3 text-right">Servis</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">Bénévoles</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">Taux</th>
                </tr>
              </thead>
              <tbody>
                {[...data.ftourDays].reverse().map((d) => {
                  const rate = d.plannedMeals
                    ? Math.round((d.servedMeals / d.plannedMeals) * 100)
                    : 0;
                  const isActive = selected?.id === d.id;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className={`cursor-pointer border-b border-slate-50 ${
                        isActive ? "bg-orange-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {new Date(d.date).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatNumber(d.plannedMeals)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {formatNumber(d.servedMeals)}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-slate-700 md:table-cell">
                        {d.volunteersCount}
                      </td>
                      <td className="hidden px-4 py-3 text-right md:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            rate >= 90
                              ? "bg-emerald-100 text-emerald-700"
                              : rate >= 70
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Détail du jour</h3>
          {selected ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-lg bg-orange-50 p-3">
                <div className="text-xs font-medium text-orange-700">Date</div>
                <div className="text-base font-semibold text-orange-900">
                  {new Date(selected.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
              <DetailRow label="Repas prévus" value={formatNumber(selected.plannedMeals)} />
              <DetailRow label="Repas servis" value={formatNumber(selected.servedMeals)} />
              <DetailRow
                label="Bénéficiaires"
                value={formatNumber(selected.beneficiariesCount)}
              />
              <DetailRow label="Bénévoles" value={formatNumber(selected.volunteersCount)} />
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">Menu du jour</div>
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {selected.menu}
                </p>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { step: "00:00", v: 0 },
                      { step: "Accueil", v: Math.round(selected.servedMeals * 0.25) },
                      { step: "Service", v: Math.round(selected.servedMeals * 0.75) },
                      { step: "Clôture", v: selected.servedMeals },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="step" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} width={40} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name="Cumul"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sélectionnez un jour dans le planning.</p>
          )}
        </aside>
      </div>
    </DemoLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
