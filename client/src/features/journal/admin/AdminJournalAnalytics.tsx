/**
 * Journal Analytics Dashboard — /admin/journal/analytics
 * Most frequent problems, tag cloud, per-category breakdown, timeline.
 */

import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  BarChart2,
  AlertTriangle,
  Tag,
  TrendingUp,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Loader2,
} from "lucide-react";
import {
  JOURNAL_TYPE_LABELS,
  JOURNAL_CATEGORY_LABELS,
  JOURNAL_IMPORTANCE_LABELS,
} from "../components/JournalConstants";

// ============================================
// CHART COLORS
// ============================================

const TYPE_CHART_COLORS: Record<string, string> = {
  observation: "#3B82F6",
  problem: "#EF4444",
  solution: "#10B981",
  idea: "#8B5CF6",
  decision: "#F59E0B",
};

const CATEGORY_COLORS = [
  "#6366F1", "#F59E0B", "#10B981", "#EF4444", "#3B82F6", "#8B5CF6",
];

const IMPORTANCE_COLORS: Record<string, string> = {
  low: "#9CA3AF",
  medium: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

// ============================================
// STAT CARD
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ============================================
// SECTION CARD
// ============================================

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-indigo-500" />
        {title}
      </h2>
      {children}
    </div>
  );
}

// ============================================
// TAG CLOUD
// ============================================

function TagCloud({ tags }: { tags: { tag: string; count: number }[] }) {
  if (!tags.length) return <p className="text-sm text-gray-400">Aucun tag.</p>;
  const maxCount = Math.max(...tags.map(t => t.count));

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(({ tag, count }) => {
        const scale = 0.7 + (count / maxCount) * 0.7;
        const opacity = 0.5 + (count / maxCount) * 0.5;
        return (
          <span
            key={tag}
            className="bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2.5 py-1 font-medium"
            style={{ fontSize: `${Math.round(scale * 14)}px`, opacity }}
            title={`${count} entrée${count > 1 ? "s" : ""}`}
          >
            #{tag} <span className="text-indigo-400 text-xs">({count})</span>
          </span>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AdminJournalAnalytics() {
  const { data, isLoading } = trpc.journal.analytics.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) return null;

  // Prepare chart data
  const byTypeData = Object.entries(data.byType).map(([type, count]) => ({
    name: JOURNAL_TYPE_LABELS[type] ?? type,
    count,
    fill: TYPE_CHART_COLORS[type] ?? "#6366F1",
    type,
  })).sort((a, b) => b.count - a.count);

  const byCategoryData = Object.entries(data.byCategory).map(([cat, count], i) => ({
    name: JOURNAL_CATEGORY_LABELS[cat] ?? cat,
    count,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  })).sort((a, b) => b.count - a.count);

  const byImportanceData = Object.entries(data.byImportance).map(([imp, count]) => ({
    name: JOURNAL_IMPORTANCE_LABELS[imp] ?? imp,
    value: count,
    fill: IMPORTANCE_COLORS[imp] ?? "#6366F1",
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/admin/journal">
            <button className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <BarChart2 className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Analytiques du Journal</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={BookOpen}
            label="Entrées totales"
            value={data.totalEntries}
            color="bg-indigo-500"
          />
          <StatCard
            icon={Lightbulb}
            label="Leçons apprises"
            value={data.totalLessons}
            color="bg-amber-500"
          />
          <StatCard
            icon={MessageSquare}
            label="Commentaires"
            value={data.totalComments}
            color="bg-green-500"
          />
          <StatCard
            icon={AlertTriangle}
            label="Entrées critiques"
            value={data.recentCritical}
            color="bg-red-500"
            sub="7 derniers jours"
          />
        </div>

        {/* Timeline */}
        {data.timeline.length > 0 && (
          <SectionCard title="Activité (30 derniers jours)" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => {
                    const [, , day] = d.split("-");
                    return day;
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6366F1" }}
                  name="Entrées"
                />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* Type + Category row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By type */}
          {byTypeData.length > 0 && (
            <SectionCard title="Entrées par type" icon={BarChart2}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byTypeData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Entrées" radius={[0, 4, 4, 0]}>
                    {byTypeData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* By category */}
          {byCategoryData.length > 0 && (
            <SectionCard title="Entrées par catégorie" icon={BarChart2}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byCategoryData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Entrées" radius={[0, 4, 4, 0]}>
                    {byCategoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>

        {/* Importance pie + Tag cloud */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Importance distribution */}
          {byImportanceData.length > 0 && (
            <SectionCard title="Distribution par importance" icon={AlertTriangle}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byImportanceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {byImportanceData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Tag cloud */}
          <SectionCard title="Tags les plus utilisés" icon={Tag}>
            <TagCloud tags={data.topTags} />
          </SectionCard>
        </div>

        {/* Critical entries callout */}
        {data.recentCritical > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">
                {data.recentCritical} entrée{data.recentCritical > 1 ? "s" : ""} critique{data.recentCritical > 1 ? "s" : ""} cette semaine
              </p>
              <p className="text-red-600 text-xs mt-0.5">
                Ces entrées nécessitent une attention immédiate.{" "}
                <Link href="/admin/journal?importance=critical">
                  <span className="underline cursor-pointer hover:text-red-800">Voir les entrées critiques →</span>
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
