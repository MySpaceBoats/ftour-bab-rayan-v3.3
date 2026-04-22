import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Users,
  Building2,
  User,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatDate, formatMAD, formatNumber } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import type {
  DemoReservation,
  ReservationStatus,
  ReservationType,
} from "../data/types";

const TYPE_LABELS: Record<ReservationType, string> = {
  particulier: "Particulier",
  groupe: "Groupe",
  entreprise: "Entreprise",
};

const TYPE_STYLES: Record<ReservationType, string> = {
  particulier: "bg-sky-100 text-sky-700 ring-sky-200",
  groupe: "bg-violet-100 text-violet-700 ring-violet-200",
  entreprise: "bg-amber-100 text-amber-700 ring-amber-200",
};

const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmee: "Confirmée",
  en_attente: "En attente",
  annulee: "Annulée",
  terminee: "Terminée",
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  confirmee: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  en_attente: "bg-amber-100 text-amber-700 ring-amber-200",
  annulee: "bg-rose-100 text-rose-700 ring-rose-200",
  terminee: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function DemoReservations() {
  const data = useDemoData();
  const [filter, setFilter] = useState<ReservationType | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.reservations.filter((r) => {
      if (filter !== "all" && r.type !== filter) return false;
      if (!q) return true;
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [data.reservations, filter, query]);

  const stats = useMemo(() => {
    const total = data.reservations.reduce((a, r) => a + r.guests, 0);
    const revenue = data.reservations
      .filter((r) => r.status !== "annulee")
      .reduce((a, r) => a + r.totalAmount, 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = data.reservations.filter((r) => r.date === today).length;
    const upcomingByDay = new Map<string, number>();
    data.reservations.forEach((r) => {
      if (r.date >= today) {
        upcomingByDay.set(r.date, (upcomingByDay.get(r.date) ?? 0) + r.guests);
      }
    });
    const series = Array.from(upcomingByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10)
      .map(([date, guests]) => ({
        date: new Date(date).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        couverts: guests,
      }));
    return { total, revenue, todayCount, series };
  }, [data.reservations]);

  return (
    <DemoLayout
      title="Réservations"
      subtitle="Particuliers, groupes et entreprises — iftar restaurant"
      tooltip="Suivi des réservations à venir et passées. Filtrez par type ou recherchez par nom/référence."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Réservations"
          value={formatNumber(data.reservations.length)}
          icon={CalendarDays}
          accent="orange"
          trend={{ value: 8.4 }}
        />
        <KpiCard
          label="Couverts totaux"
          value={formatNumber(stats.total)}
          icon={Users}
          accent="sky"
          trend={{ value: 12.1 }}
        />
        <KpiCard
          label="Aujourd'hui"
          value={formatNumber(stats.todayCount)}
          icon={Clock}
          accent="emerald"
          trend={{ value: 2.3 }}
        />
        <KpiCard
          label="CA prévisionnel"
          value={formatMAD(stats.revenue)}
          icon={Building2}
          accent="violet"
          trend={{ value: 6.8 }}
        />
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Couverts attendus — prochains jours
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="couverts" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as ReservationType | "all")}>
            <TabsList>
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="particulier">Particuliers</TabsTrigger>
              <TabsTrigger value="groupe">Groupes</TabsTrigger>
              <TabsTrigger value="entreprise">Entreprises</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Rechercher par nom, référence, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:w-72"
          />
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Réf.</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="hidden px-4 py-3 md:table-cell">Date</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">Couverts</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">Montant</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 30).map((r) => (
                <ReservationRow key={r.id} r={r} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Aucune réservation correspondante.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DemoLayout>
  );
}

function ReservationRow({ r }: { r: DemoReservation }) {
  const TypeIcon = r.type === "entreprise" ? Building2 : r.type === "groupe" ? Users : User;
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50">
      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.reference}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{r.customerName}</div>
        <div className="text-xs text-slate-500">{r.email}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`${TYPE_STYLES[r.type]} ring-1 ring-inset`}>
          <TypeIcon className="mr-1 h-3 w-3" />
          {TYPE_LABELS[r.type]}
        </Badge>
      </td>
      <td className="hidden px-4 py-3 text-slate-700 md:table-cell">
        <div className="font-medium text-slate-900">{formatDate(r.date)}</div>
        <div className="text-xs text-slate-500">{r.time}</div>
      </td>
      <td className="hidden px-4 py-3 text-right font-semibold text-slate-900 md:table-cell">
        {r.guests}
      </td>
      <td className="hidden px-4 py-3 text-right font-semibold text-slate-900 md:table-cell">
        {formatMAD(r.totalAmount)}
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={`${STATUS_STYLES[r.status]} ring-1 ring-inset`}
        >
          {r.status === "confirmee" && <CheckCircle2 className="mr-1 h-3 w-3" />}
          {r.status === "en_attente" && <Clock className="mr-1 h-3 w-3" />}
          {r.status === "annulee" && <XCircle className="mr-1 h-3 w-3" />}
          {STATUS_LABELS[r.status]}
        </Badge>
      </td>
    </tr>
  );
}
