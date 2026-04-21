import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, TrendingUp, Crown, Award } from "lucide-react";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatDate, formatMAD, formatNumber } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import type { PartnerTier } from "../data/types";

const TIER_LABELS: Record<PartnerTier, string> = {
  platine: "Platine",
  or: "Or",
  argent: "Argent",
  bronze: "Bronze",
};

const TIER_ORDER: PartnerTier[] = ["platine", "or", "argent", "bronze"];

const TIER_STYLES: Record<PartnerTier, string> = {
  platine: "bg-slate-100 text-slate-800 ring-slate-300",
  or: "bg-amber-100 text-amber-800 ring-amber-300",
  argent: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  bronze: "bg-orange-100 text-orange-800 ring-orange-300",
};

export default function DemoPartenaires() {
  const data = useDemoData();

  const stats = useMemo(() => {
    const total = data.partners.reduce((a, p) => a + p.contribution, 0);
    const tiersData = TIER_ORDER.map((tier) => {
      const items = data.partners.filter((p) => p.tier === tier);
      return {
        tier: TIER_LABELS[tier],
        count: items.length,
        total: items.reduce((a, p) => a + p.contribution, 0),
      };
    });
    const topPartners = [...data.partners]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 5);
    const platineCount = data.partners.filter((p) => p.tier === "platine").length;
    return { total, tiersData, topPartners, platineCount };
  }, [data.partners]);

  const sortedPartners = useMemo(
    () => [...data.partners].sort((a, b) => b.contribution - a.contribution),
    [data.partners],
  );

  return (
    <DemoLayout
      title="Partenaires"
      subtitle="Entreprises engagées dans l'opération ftour"
      tooltip="Les entreprises listées ici sont fictives. Leurs contributions illustrent les paliers possibles de sponsoring."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Partenaires actifs"
          value={formatNumber(data.partners.length)}
          icon={Building2}
          accent="sky"
          trend={{ value: 3.4 }}
        />
        <KpiCard
          label="Contribution totale"
          value={formatMAD(stats.total)}
          icon={TrendingUp}
          accent="orange"
          trend={{ value: 11.2 }}
        />
        <KpiCard
          label="Partenaires Platine"
          value={formatNumber(stats.platineCount)}
          icon={Crown}
          accent="violet"
          trend={{ value: 0 }}
        />
        <KpiCard
          label="Contribution moyenne"
          value={formatMAD(
            data.partners.length ? Math.round(stats.total / data.partners.length) : 0,
          )}
          icon={Award}
          accent="emerald"
          trend={{ value: 4.7 }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Contribution par niveau
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.tiersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="tier" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "total" ? [formatMAD(v), "Total"] : [v, "Partenaires"]
                  }
                />
                <Bar dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 5 contributeurs</h2>
          <ul className="space-y-2">
            {stats.topPartners.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">{p.name}</div>
                  <div className="truncate text-xs text-slate-500">{p.sector}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatMAD(p.contribution)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    {TIER_LABELS[p.tier]}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Liste complète</h2>
          <p className="text-xs text-slate-500">
            Entreprises partenaires simulées — données 100% fictives
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedPartners.map((p) => (
            <article
              key={p.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/40 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-2xl ring-1 ring-inset ring-slate-200">
                  {p.logo}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900">{p.name}</h3>
                  <p className="truncate text-xs text-slate-500">
                    {p.sector} · {p.city}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TIER_STYLES[p.tier]}`}
                >
                  {TIER_LABELS[p.tier]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-white p-2 ring-1 ring-inset ring-slate-100">
                  <div className="text-slate-500">Contribution</div>
                  <div className="font-semibold text-slate-900">
                    {formatMAD(p.contribution)}
                  </div>
                </div>
                <div className="rounded-md bg-white p-2 ring-1 ring-inset ring-slate-100">
                  <div className="text-slate-500">Partenaire depuis</div>
                  <div className="font-semibold text-slate-900">
                    {formatDate(p.since)}
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2 text-xs text-slate-600">
                <div className="font-medium text-slate-800">{p.contactName}</div>
                <div className="truncate text-slate-500">{p.contactEmail}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DemoLayout>
  );
}
