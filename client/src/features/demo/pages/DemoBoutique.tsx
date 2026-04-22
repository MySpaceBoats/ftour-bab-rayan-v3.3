import { useMemo, useState } from "react";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ChefHat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatMAD, formatNumber, formatRelativeTime } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import type { OrderCategory, OrderStatus } from "../data/types";

const CATEGORY_LABELS: Record<OrderCategory, string> = {
  goodies: "Goodies",
  terroir: "Terroir",
  patisserie: "Pâtisserie",
};

const CATEGORY_COLORS: Record<OrderCategory, string> = {
  goodies: "#f97316",
  terroir: "#10b981",
  patisserie: "#8b5cf6",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  en_preparation: "En préparation",
  prete: "Prête",
  livree: "Livrée",
  annulee: "Annulée",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  en_preparation: "bg-amber-100 text-amber-700 ring-amber-200",
  prete: "bg-sky-100 text-sky-700 ring-sky-200",
  livree: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  annulee: "bg-rose-100 text-rose-700 ring-rose-200",
};

export default function DemoBoutique() {
  const data = useDemoData();
  const [cat, setCat] = useState<OrderCategory | "all">("all");

  const filtered = useMemo(() => {
    if (cat === "all") return data.orders;
    return data.orders.filter((o) => o.category === cat);
  }, [data.orders, cat]);

  const stats = useMemo(() => {
    const validOrders = data.orders.filter((o) => o.status !== "annulee");
    const revenue = validOrders.reduce((a, o) => a + o.total, 0);
    const byCat: Record<OrderCategory, number> = {
      goodies: 0,
      terroir: 0,
      patisserie: 0,
    };
    validOrders.forEach((o) => {
      byCat[o.category] += o.total;
    });
    const catData = (Object.keys(byCat) as OrderCategory[]).map((k) => ({
      name: CATEGORY_LABELS[k],
      value: byCat[k],
      color: CATEGORY_COLORS[k],
    }));
    const byMonth = new Map<string, number>();
    data.orders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + o.total);
    });
    const monthSeries = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, amount]) => {
        const [y, m] = key.split("-");
        return {
          month: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
            month: "short",
          }),
          amount,
        };
      });
    return { revenue, catData, monthSeries, validOrders };
  }, [data.orders]);

  return (
    <DemoLayout
      title="Boutique"
      subtitle="Commandes goodies, terroir et pâtisseries"
      tooltip="Pilotez vos commandes en ligne, suivez la préparation et identifiez vos produits les plus performants."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Commandes totales"
          value={formatNumber(data.orders.length)}
          icon={ShoppingBag}
          accent="orange"
          trend={{ value: 15.4 }}
        />
        <KpiCard
          label="Chiffre d'affaires"
          value={formatMAD(stats.revenue)}
          icon={Package}
          accent="emerald"
          trend={{ value: 10.2 }}
        />
        <KpiCard
          label="Commandes livrées"
          value={formatNumber(
            data.orders.filter((o) => o.status === "livree").length,
          )}
          icon={Truck}
          accent="sky"
          trend={{ value: 7.6 }}
        />
        <KpiCard
          label="Panier moyen"
          value={formatMAD(
            stats.validOrders.length
              ? Math.round(stats.revenue / stats.validOrders.length)
              : 0,
          )}
          icon={ChefHat}
          accent="violet"
          trend={{ value: 3.1 }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Évolution du chiffre d'affaires
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip formatter={(v: number) => [formatMAD(v), "CA"]} />
                <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Répartition par catégorie
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.catData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {stats.catData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMAD(v)} />
                <Legend verticalAlign="bottom" height={24} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={cat} onValueChange={(v) => setCat(v as OrderCategory | "all")}>
            <TabsList>
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="goodies">Goodies</TabsTrigger>
              <TabsTrigger value="terroir">Terroir</TabsTrigger>
              <TabsTrigger value="patisserie">Pâtisserie</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Réf.</th>
                <th className="px-4 py-3">Client</th>
                <th className="hidden px-4 py-3 md:table-cell">Catégorie</th>
                <th className="hidden px-4 py-3 lg:table-cell">Articles</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="hidden px-4 py-3 md:table-cell">Créée</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 30).map((o) => (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {o.reference}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{o.customerName}</div>
                    <div className="text-xs text-slate-500">{o.city}</div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[o.category]}22`,
                        color: CATEGORY_COLORS[o.category],
                      }}
                    >
                      {CATEGORY_LABELS[o.category]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-700 lg:table-cell">
                    {o.items.map((it) => (
                      <div key={it.productName} className="text-xs">
                        {it.quantity}× {it.productName}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMAD(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`${STATUS_STYLES[o.status]} ring-1 ring-inset`}
                    >
                      {o.status === "livree" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {o.status === "annulee" && <XCircle className="mr-1 h-3 w-3" />}
                      {STATUS_LABELS[o.status]}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                    {formatRelativeTime(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DemoLayout>
  );
}
