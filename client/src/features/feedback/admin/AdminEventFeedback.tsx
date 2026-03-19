/**
 * AdminEventFeedback — Dashboard admin pour le feedback événementiel Ramadan
 *
 * Fonctionnalités :
 *   • Cards de score moyen par section (heatmap)
 *   • NPS global + score moyen
 *   • Scores par rôle et par jour (graphiques)
 *   • Tags automatiques les plus fréquents
 *   • Tableau filtrable des réponses
 *   • Détail d'une réponse (modal)
 *   • Export CSV
 *   • Filtres : rôle, type, jour, date, score min
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Star,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  TrendingUp,
  Users,
  CheckCircle2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

// ============================================================
// TYPES
// ============================================================

type Role = "VOLUNTEER" | "MANAGER" | "GROUP" | "BENEFICIARY" | "VISITOR" | "PARTNER";
type ParticipationType = "FTOR" | "NIGHT_26" | "VOLUNTEER_EVENT" | "THANK_YOU_EVENT";
type Moderation = "pending" | "processed" | "to_analyze" | "important";

const ROLE_LABELS: Record<Role, string> = {
  VOLUNTEER: "Bénévole",
  MANAGER: "Manager",
  GROUP: "Groupe",
  BENEFICIARY: "Bénéficiaire",
  VISITOR: "Visiteur",
  PARTNER: "Partenaire",
};

const PTYPE_LABELS: Record<ParticipationType, string> = {
  FTOR: "Ftour",
  NIGHT_26: "Nuit du 26",
  VOLUNTEER_EVENT: "Ftour bénévoles",
  THANK_YOU_EVENT: "Remerciements",
};

const SECTION_LABELS: Record<string, string> = {
  global_experience: "Expérience globale",
  organisation: "Organisation",
  accueil_entree: "Accueil & Entrée",
  systeme_digital: "Système digital",
  service_tables: "Service tables",
  cuisine_logistique: "Cuisine",
  nettoyage: "Propreté",
  experience_beneficiaires: "Expérience bénéficiaires",
  tables_enfants: "Tables enfants",
  distribution_externe: "Distribution externe",
  nuit_26: "Nuit du 26",
  gestion_benevoles: "Gestion bénévoles",
  gestion_groupes: "Gestion groupes",
  feedback_manager: "Feedback manager",
  communication_interne: "Comm. interne",
  securite: "Sécurité",
  sanitaires: "Sanitaires",
  stand_vente: "Stand vente",
  ambiance_musique: "Ambiance",
  respect_regles: "Règles",
  communication_externe: "Comm. externe",
  evenements_speciaux: "Événements spéciaux",
};

// ============================================================
// UTILITAIRES
// ============================================================

function getScoreColor(score: number, max = 5): string {
  const pct = score / max;
  if (pct >= 0.8) return "text-green-600 bg-green-50";
  if (pct >= 0.6) return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
}

function getScoreBg(score: number, max = 5): string {
  const pct = score / max;
  if (pct >= 0.8) return "bg-green-500";
  if (pct >= 0.6) return "bg-yellow-500";
  return "bg-red-500";
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-200";
    case "warning":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

function exportToCsv(rows: any[]) {
  if (rows.length === 0) {
    toast.error("Aucune donnée à exporter");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] ?? "";
          const str = typeof v === "object" ? JSON.stringify(v) : String(v);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `event_feedback_${format(new Date(), "yyyyMMdd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// COMPOSANT DETAIL MODAL
// ============================================================

function FeedbackDetailModal({
  item,
  onClose,
  onModerationChange,
}: {
  item: any;
  onClose: () => void;
  onModerationChange: (id: number, m: Moderation) => void;
}) {
  const updateMutation = trpc.eventFeedback.updateEventFeedbackModeration.useMutation({
    onSuccess: (_, vars) => {
      onModerationChange(vars.feedbackId, vars.moderation);
      toast.success("Modération mise à jour");
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-[#5E5B34]">Détail du feedback #{item.id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Métadonnées */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Rôle :</span> <strong>{ROLE_LABELS[item.role as Role] ?? item.role}</strong></div>
            <div><span className="text-gray-500">Participation :</span> <strong>{PTYPE_LABELS[item.participation_type as ParticipationType] ?? item.participation_type}</strong></div>
            <div><span className="text-gray-500">Jour :</span> <strong>{item.event_day ?? "—"}</strong></div>
            <div><span className="text-gray-500">Anonyme :</span> <strong>{item.is_anonymous ? "Oui" : "Non"}</strong></div>
            {item.email && <div className="col-span-2"><span className="text-gray-500">Email :</span> {item.email}</div>}
            {item.name && <div className="col-span-2"><span className="text-gray-500">Nom :</span> {item.name}</div>}
            <div><span className="text-gray-500">Score global :</span> <strong>{item.global_score ?? "—"}/10</strong></div>
            <div><span className="text-gray-500">NPS :</span> <strong>{item.nps_score ?? "—"}/10</strong></div>
            <div className="col-span-2">
              <span className="text-gray-500">Date :</span>{" "}
              {item.created_at ? format(new Date(item.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
            </div>
          </div>

          {/* Sections */}
          {item.sections?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Sections notées</p>
              <div className="space-y-1">
                {item.sections.map((s: any) => (
                  <div key={s.section_key} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <span>{SECTION_LABELS[s.section_key] ?? s.section_key}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getScoreColor(s.rating ?? 0, 5)}`}>
                      {s.rating ?? "—"}/5
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Réponses textuelles */}
          {item.textResponses?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Réponses textuelles</p>
              <div className="space-y-2">
                {item.textResponses.map((t: any) => (
                  <div key={t.field_key} className="text-sm">
                    <p className="text-gray-500 text-xs uppercase mb-0.5">{t.field_key.replace(/_/g, " ")}</p>
                    <p className="italic text-gray-700">"{t.value}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {item.tags?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Tags automatiques</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t: any, i: number) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 rounded-full text-xs border ${getSeverityBadge(t.severity)}`}
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Modération */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Modération</p>
            <div className="flex gap-2 flex-wrap">
              {(["pending", "processed", "to_analyze", "important"] as Moderation[]).map((m) => (
                <button
                  key={m}
                  onClick={() => updateMutation.mutate({ feedbackId: item.id, moderation: m })}
                  disabled={updateMutation.isPending}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors
                    ${item.moderation === m
                      ? "bg-[#5E5B34] text-white border-[#5E5B34]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-[#C9B97A]"
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function AdminEventFeedback() {
  // ---- Filtres ----
  const [filters, setFilters] = useState({
    role: "" as Role | "",
    participationType: "" as ParticipationType | "",
    eventDay: "",
    fromDate: "",
    toDate: "",
    moderation: "" as Moderation | "",
    maxGlobalScore: "",
  });
  const [listOffset, setListOffset] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("heatmap");

  // ---- tRPC queries ----
  const analyticsInput = useMemo(() => ({
    role: filters.role || undefined,
    participationType: (filters.participationType || undefined) as ParticipationType | undefined,
    eventDay: filters.eventDay ? parseInt(filters.eventDay) : undefined,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
  }), [filters]);

  const listInput = useMemo(() => ({
    role: (filters.role || undefined) as Role | undefined,
    participationType: (filters.participationType || undefined) as ParticipationType | undefined,
    eventDay: filters.eventDay ? parseInt(filters.eventDay) : undefined,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
    moderation: (filters.moderation || undefined) as Moderation | undefined,
    maxGlobalScore: filters.maxGlobalScore ? parseInt(filters.maxGlobalScore) : undefined,
    limit: 50,
    offset: listOffset,
  }), [filters, listOffset]);

  const analyticsQuery = trpc.eventFeedback.getEventFeedbackAnalytics.useQuery(analyticsInput);
  const listQuery = trpc.eventFeedback.getEventFeedbackList.useQuery(listInput);
  const exportQuery = trpc.eventFeedback.exportEventFeedbackCsv.useQuery(analyticsInput, {
    enabled: false,
  });

  const analytics = analyticsQuery.data;
  const listData = listQuery.data;

  // ---- Modération locale (optimistic) ----
  const [localModerations, setLocalModerations] = useState<Record<number, Moderation>>({});

  function handleModerationChange(id: number, m: Moderation) {
    setLocalModerations((prev) => ({ ...prev, [id]: m }));
  }

  // ---- Export CSV ----
  async function handleExport() {
    const result = await exportQuery.refetch();
    if (result.data) exportToCsv(result.data.rows);
  }

  // ---- Filtre helper ----
  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setListOffset(0);
  }

  function clearFilters() {
    setFilters({ role: "", participationType: "", eventDay: "", fromDate: "", toDate: "", moderation: "", maxGlobalScore: "" });
    setListOffset(0);
  }

  const hasFilters = Object.values(filters).some((v) => v !== "");

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#5E5B34]">Feedback Événement Ramadan</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Analyse multi-dimensionnelle des retours participants
          </p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          className="flex items-center gap-2 border-[#C9B97A] text-[#5E5B34]"
        >
          <Download size={16} /> Export CSV
        </Button>
      </div>

      {/* Filtres */}
      <Card className="mb-6 border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Rôle</Label>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm"
                value={filters.role}
                onChange={(e) => setFilter("role", e.target.value)}
              >
                <option value="">Tous</option>
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Participation</Label>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm"
                value={filters.participationType}
                onChange={(e) => setFilter("participationType", e.target.value)}
              >
                <option value="">Tous</option>
                {Object.entries(PTYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Jour Ramadan</Label>
              <Input
                type="number"
                min={1}
                max={30}
                placeholder="1-30"
                value={filters.eventDay}
                onChange={(e) => setFilter("eventDay", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Score max</Label>
              <Input
                type="number"
                min={1}
                max={10}
                placeholder="≤ score"
                value={filters.maxGlobalScore}
                onChange={(e) => setFilter("maxGlobalScore", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Du</Label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilter("fromDate", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Au</Label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilter("toDate", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Effacer les filtres
            </button>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total réponses",
            value: analytics?.total ?? "—",
            icon: <Users size={20} />,
            color: "text-blue-600",
          },
          {
            label: "Score moyen",
            value: analytics?.avgGlobalScore ? `${analytics.avgGlobalScore}/10` : "—",
            icon: <Star size={20} />,
            color: "text-[#C9B97A]",
          },
          {
            label: "NPS",
            value: analytics?.nps !== undefined ? `${analytics.nps > 0 ? "+" : ""}${analytics.nps}` : "—",
            icon: <TrendingUp size={20} />,
            color: analytics?.nps !== undefined && analytics.nps >= 0 ? "text-green-600" : "text-red-500",
          },
          {
            label: "Alertes tags",
            value: analytics?.topTags?.filter((t) => t.severity !== "info").length ?? "—",
            icon: <AlertTriangle size={20} />,
            color: "text-orange-500",
          },
        ].map((kpi, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{String(kpi.value)}</p>
                </div>
                <span className={`${kpi.color} opacity-60`}>{kpi.icon}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Heatmap sections */}
      <Card className="mb-6 border-0 shadow-sm">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpandedSection(expandedSection === "heatmap" ? null : "heatmap")}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-[#5E5B34]">Scores par section (heatmap)</CardTitle>
            {expandedSection === "heatmap" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </CardHeader>
        {expandedSection === "heatmap" && (
          <CardContent>
            {analyticsQuery.isLoading ? (
              <p className="text-sm text-gray-400">Chargement…</p>
            ) : analytics?.avgBySection?.length ? (
              <div className="space-y-2">
                {analytics.avgBySection.map((s) => {
                  const pct = Math.round((s.avgRating / 5) * 100);
                  return (
                    <div key={s.sectionKey} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-36 shrink-0">
                        {SECTION_LABELS[s.sectionKey] ?? s.sectionKey}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getScoreBg(s.avgRating, 5)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-10 text-right ${getScoreColor(s.avgRating, 5)}`}>
                        {s.avgRating}/5
                      </span>
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {s.responseCount} rép.
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Aucune donnée disponible</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Graphiques scores par rôle et par jour */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Par rôle */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#5E5B34]">Scores par rôle</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.scoresByRole?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.scoresByRole} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="role"
                    tickFormatter={(v) => ROLE_LABELS[v as Role]?.slice(0, 8) ?? v}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any) => [`${v}/10`, "Score moyen"]}
                    labelFormatter={(l) => ROLE_LABELS[l as Role] ?? l}
                  />
                  <Bar dataKey="avgScore" fill="#C9B97A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-10 text-center">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        {/* Par jour */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#5E5B34]">Évolution par jour</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.scoresByDay?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={analytics.scoresByDay} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tickFormatter={(v) => `J${v}`} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any) => [`${v}/10`, "Score moyen"]}
                    labelFormatter={(l) => `Jour ${l}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#5E5B34"
                    strokeWidth={2}
                    dot={{ fill: "#C9B97A", r: 4 }}
                    name="Score moyen"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-10 text-center">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tags fréquents */}
      {analytics?.topTags?.length ? (
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#5E5B34]">Tags les plus fréquents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analytics.topTags.map((t, i) => (
                <span
                  key={i}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-medium ${getSeverityBadge(t.severity)}`}
                >
                  {t.severity === "critical" && <AlertTriangle size={11} />}
                  {t.severity === "warning" && <AlertTriangle size={11} />}
                  {t.severity === "info" && <Info size={11} />}
                  {t.tag.replace(/_/g, " ")}
                  <span className="ml-1 opacity-60">×{t.count}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Tableau des réponses */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-[#5E5B34]">
              Réponses ({listData?.total ?? "…"})
            </CardTitle>
            <div className="flex gap-2">
              <select
                className="text-xs border rounded px-2 py-1"
                value={filters.moderation}
                onChange={(e) => setFilter("moderation", e.target.value)}
              >
                <option value="">Toutes modérations</option>
                <option value="pending">En attente</option>
                <option value="processed">Traité</option>
                <option value="to_analyze">À analyser</option>
                <option value="important">Important</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>
          ) : (listData?.items ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Aucune réponse trouvée</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500 text-xs">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Rôle</th>
                      <th className="text-left py-2 pr-3">Participation</th>
                      <th className="text-left py-2 pr-3">Jour</th>
                      <th className="text-left py-2 pr-3">Score</th>
                      <th className="text-left py-2 pr-3">NPS</th>
                      <th className="text-left py-2 pr-3">Modération</th>
                      <th className="text-left py-2">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.items.map((item: any) => {
                      const effectiveModeration = localModerations[item.id] ?? item.moderation;
                      const criticalTags = (item.tags ?? []).filter((t: any) => t.severity === "critical").length;

                      return (
                        <tr
                          key={item.id}
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedItem(item)}
                        >
                          <td className="py-2 pr-3 whitespace-nowrap text-gray-500 text-xs">
                            {item.created_at
                              ? format(new Date(item.created_at), "dd/MM HH:mm", { locale: fr })
                              : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">
                              {ROLE_LABELS[item.role as Role] ?? item.role}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-600">
                            {PTYPE_LABELS[item.participation_type as ParticipationType] ?? item.participation_type}
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-600">J{item.event_day ?? "—"}</td>
                          <td className="py-2 pr-3">
                            {item.global_score !== null ? (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(item.global_score, 10)}`}>
                                {item.global_score}/10
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 pr-3 text-xs">{item.nps_score ?? "—"}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs border ${getSeverityBadge(
                              effectiveModeration === "important" ? "critical" :
                              effectiveModeration === "to_analyze" ? "warning" : "info"
                            )}`}>
                              {effectiveModeration}
                            </span>
                          </td>
                          <td className="py-2">
                            {criticalTags > 0 && (
                              <span className="flex items-center gap-0.5 text-red-600 text-xs">
                                <AlertTriangle size={12} /> {criticalTags}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>
                  {listOffset + 1}–{Math.min(listOffset + 50, listData.total)} sur {listData.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={listOffset === 0}
                    onClick={() => setListOffset(Math.max(0, listOffset - 50))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={listOffset + 50 >= listData.total}
                    onClick={() => setListOffset(listOffset + 50)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal détail */}
      {selectedItem && (
        <FeedbackDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onModerationChange={handleModerationChange}
        />
      )}
    </div>
  );
}
