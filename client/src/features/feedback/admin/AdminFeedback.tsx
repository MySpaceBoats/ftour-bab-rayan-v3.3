import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Loader2,
  Star,
  MessageSquare,
  Users,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Bookmark,
  Clock,
  Download,
  Filter,
  TrendingUp,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
} from "recharts";
import * as XLSX from "xlsx";

// ============================================
// CONSTANTES
// ============================================

const MODERATION_CONFIG = {
  pending: { label: "En attente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30" },
  processed: { label: "Traité", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
  to_analyze: { label: "À analyser", icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  important: { label: "Important", icon: Bookmark, color: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/30" },
} as const;

type ModerationKey = keyof typeof MODERATION_CONFIG;

const CHART_COLORS = ["#C9B97A", "#5E8B7E", "#A85B52", "#7E6BAD", "#5E8B3A"];

// ============================================
// HELPERS
// ============================================

function getMainRating(response: any): number | null {
  for (const a of response.feedback_answers ?? []) {
    if (a.answer_rating !== null && a.answer_rating !== undefined) return a.answer_rating;
  }
  return null;
}

function getFirstComment(response: any): string | null {
  for (const a of response.feedback_answers ?? []) {
    if (a.answer_text) return a.answer_text;
  }
  return null;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-gray-600"}`}
        />
      ))}
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

function exportToCSV(responses: any[]) {
  const rows = responses.map((r: any) => ({
    Date: format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: fr }),
    Source: r.source === "email_campaign" ? "Email" : "Page web",
    Anonyme: r.is_anonymous ? "Oui" : "Non",
    Email: r.user_email ?? "",
    Nom: r.user_name ?? "",
    Score: getMainRating(r) ?? "",
    Commentaire: getFirstComment(r) ?? "",
    Modération: MODERATION_CONFIG[r.moderation as ModerationKey]?.label ?? r.moderation,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Feedbacks");
  XLSX.writeFile(wb, `feedbacks-bab-rayan-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

// ============================================
// RESPONSE DETAIL DIALOG
// ============================================

function ResponseDetailDialog({
  response,
  onClose,
  onModerationChange,
}: {
  response: any;
  onClose: () => void;
  onModerationChange: (responseId: number, moderation: ModerationKey) => void;
}) {
  const [moderation, setModeration] = useState<ModerationKey>(response.moderation ?? "pending");
  const config = MODERATION_CONFIG[moderation];
  const ModerationIcon = config.icon;

  const handleModerationChange = (val: string) => {
    const m = val as ModerationKey;
    setModeration(m);
    onModerationChange(response.id, m);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#2D2B15] border-[#F2E9D3]/20 text-[#F2E9D3] max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F2E9D3]">Détail du feedback #{response.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Méta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[#C9B97A]">Date :</span>
              <span className="ml-2">{format(new Date(response.created_at), "dd MMM yyyy HH:mm", { locale: fr })}</span>
            </div>
            <div>
              <span className="text-[#C9B97A]">Source :</span>
              <span className="ml-2">{response.source === "email_campaign" ? "Email" : "Page web"}</span>
            </div>
            <div>
              <span className="text-[#C9B97A]">Identité :</span>
              <span className="ml-2 flex items-center gap-1">
                {response.is_anonymous ? (
                  <><EyeOff className="w-3.5 h-3.5" /> Anonyme</>
                ) : (
                  <><Eye className="w-3.5 h-3.5" /> Identifié</>
                )}
              </span>
            </div>
            {!response.is_anonymous && response.user_email && (
              <div>
                <span className="text-[#C9B97A]">Email :</span>
                <span className="ml-2">{response.user_email}</span>
              </div>
            )}
            {!response.is_anonymous && response.user_name && (
              <div>
                <span className="text-[#C9B97A]">Nom :</span>
                <span className="ml-2">{response.user_name}</span>
              </div>
            )}
          </div>

          {/* Réponses */}
          <div className="border-t border-[#F2E9D3]/10 pt-4 space-y-4">
            {(response.feedback_answers ?? []).map((a: any) => (
              <div key={a.id}>
                <p className="text-[#C9B97A] text-sm mb-1">
                  {a.feedback_questions?.question ?? `Question #${a.question_id}`}
                </p>
                {a.answer_rating !== null && a.answer_rating !== undefined && (
                  <StarDisplay rating={a.answer_rating} />
                )}
                {a.answer_text && (
                  <p className="text-[#F2E9D3]/90 text-sm italic bg-[#3D3B1E] px-3 py-2 rounded">
                    "{a.answer_text}"
                  </p>
                )}
                {a.answer_choice && (
                  <Badge className="bg-[#C9B97A]/20 text-[#C9B97A] border-[#C9B97A]/30">
                    {a.answer_choice}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {/* Modération */}
          <div className="border-t border-[#F2E9D3]/10 pt-4">
            <p className="text-[#C9B97A] text-sm mb-2">Marquer comme :</p>
            <Select value={moderation} onValueChange={handleModerationChange}>
              <SelectTrigger className={`border ${config.bg} text-[#F2E9D3]`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2D2B15] border-[#F2E9D3]/20">
                {Object.entries(MODERATION_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-[#F2E9D3] focus:bg-[#3D3B1E]">
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminFeedback() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "public_page" | "email_campaign">("all");
  const [moderationFilter, setModerationFilter] = useState<"all" | ModerationKey>("all");
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

  const statsQuery = trpc.feedback.getStats.useQuery({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });

  const listQuery = trpc.feedback.listResponses.useQuery({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    moderation: moderationFilter !== "all" ? moderationFilter : undefined,
    limit: 100,
    offset: 0,
  });

  const updateModerationMutation = trpc.feedback.updateModeration.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      listQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  const handleModerationChange = (responseId: number, moderation: ModerationKey) => {
    updateModerationMutation.mutate({ responseId, moderation });
  };

  const stats = statsQuery.data;
  const responses = listQuery.data?.responses ?? [];

  // Build chart data
  const ratingDistribution = [1, 2, 3, 4, 5].map((r) => {
    let count = 0;
    for (const resp of stats?.responses ?? []) {
      for (const a of (resp as any).feedback_answers ?? []) {
        if (a.answer_rating === r) count++;
      }
    }
    return { rating: `${r}⭐`, count };
  });

  const timelineData = (() => {
    const byDay: Record<string, number> = {};
    for (const r of stats?.responses ?? []) {
      const day = (r as any).created_at?.slice(0, 10) ?? "?";
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date: date.slice(5), count }));
  })();

  const sourceData = [
    { name: "Page web", value: (stats?.responses ?? []).filter((r: any) => r.source === "public_page").length },
    { name: "Email", value: (stats?.responses ?? []).filter((r: any) => r.source === "email_campaign").length },
  ].filter((d) => d.value > 0);

  return (
    <div className="min-h-screen bg-[#1A1910] text-[#F2E9D3] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-[#C9B97A] hover:text-[#F2E9D3]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#F2E9D3] flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-[#C9B97A]" />
              Feedbacks
            </h1>
            <p className="text-[#C9B97A]/70 text-sm">Gestion et analyse des retours</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/feedback/campagnes">
            <Button variant="outline" className="border-[#C9B97A]/30 text-[#C9B97A] hover:bg-[#C9B97A]/10">
              Campagnes email
            </Button>
          </Link>
          <Button
            onClick={() => exportToCSV(responses)}
            variant="outline"
            className="border-[#C9B97A]/30 text-[#C9B97A] hover:bg-[#C9B97A]/10"
            disabled={responses.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9B97A]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardContent className="p-4">
                <p className="text-[#C9B97A] text-xs mb-1">Total feedbacks</p>
                <p className="text-3xl font-bold text-[#F2E9D3]">{stats?.total ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardContent className="p-4">
                <p className="text-[#C9B97A] text-xs mb-1 flex items-center gap-1"><Star className="w-3 h-3" /> Note moyenne</p>
                <p className="text-3xl font-bold text-amber-400">{stats?.avgRating ?? 0}/5</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardContent className="p-4">
                <p className="text-[#C9B97A] text-xs mb-1 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Recommandation</p>
                <p className="text-3xl font-bold text-green-400">{stats?.recommendRate ?? 0}%</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardContent className="p-4">
                <p className="text-[#C9B97A] text-xs mb-1 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Anonymes</p>
                <p className="text-3xl font-bold text-[#F2E9D3]">{stats?.anonymous ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardContent className="p-4">
                <p className="text-[#C9B97A] text-xs mb-1 flex items-center gap-1"><Eye className="w-3 h-3" /> Identifiés</p>
                <p className="text-3xl font-bold text-[#F2E9D3]">{stats?.identified ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Rating distribution */}
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#F2E9D3] text-sm">Distribution des notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ratingDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2E9D3/10" />
                    <XAxis dataKey="rating" tick={{ fill: "#C9B97A", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#C9B97A", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#2D2B15", border: "1px solid #C9B97A/30", color: "#F2E9D3" }} />
                    <Bar dataKey="count" fill="#C9B97A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#F2E9D3] text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#C9B97A]" />
                  Évolution (14j)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2E9D3/10" />
                    <XAxis dataKey="date" tick={{ fill: "#C9B97A", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#C9B97A", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#2D2B15", border: "1px solid #C9B97A/30", color: "#F2E9D3" }} />
                    <Line type="monotone" dataKey="count" stroke="#C9B97A" strokeWidth={2} dot={{ fill: "#C9B97A" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Source */}
            <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#F2E9D3] text-sm">Source des feedbacks</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {sourceData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                          {sourceData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#2D2B15", border: "1px solid #C9B97A/30", color: "#F2E9D3" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2">
                      {sourceData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                          <span className="text-[#C9B97A]">{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[#C9B97A]/50 text-sm py-10">Aucune donnée</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Filtres */}
      <Card className="bg-[#2D2B15] border-[#F2E9D3]/10 mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-[#C9B97A] text-xs mb-1">Du</p>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-[#3D3B1E] border border-[#F2E9D3]/20 text-[#F2E9D3] rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <p className="text-[#C9B97A] text-xs mb-1">Au</p>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-[#3D3B1E] border border-[#F2E9D3]/20 text-[#F2E9D3] rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <p className="text-[#C9B97A] text-xs mb-1">Source</p>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
                <SelectTrigger className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3] w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2D2B15] border-[#F2E9D3]/20">
                  <SelectItem value="all" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Toutes sources</SelectItem>
                  <SelectItem value="public_page" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Page web</SelectItem>
                  <SelectItem value="email_campaign" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[#C9B97A] text-xs mb-1">Modération</p>
              <Select value={moderationFilter} onValueChange={(v) => setModerationFilter(v as any)}>
                <SelectTrigger className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3] w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2D2B15] border-[#F2E9D3]/20">
                  <SelectItem value="all" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Tous statuts</SelectItem>
                  {Object.entries(MODERATION_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-[#F2E9D3] focus:bg-[#3D3B1E]">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => { setFromDate(""); setToDate(""); setSourceFilter("all"); setModerationFilter("all"); }}
              variant="ghost"
              size="sm"
              className="text-[#C9B97A]/60 hover:text-[#C9B97A]"
            >
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table des réponses */}
      <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
        <CardHeader>
          <CardTitle className="text-[#F2E9D3] text-lg">
            Réponses ({listQuery.data?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#C9B97A]" />
            </div>
          ) : responses.length === 0 ? (
            <p className="text-center text-[#C9B97A]/50 py-10">Aucun feedback pour ces filtres</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F2E9D3]/10">
                    <th className="text-left py-3 px-3 text-[#C9B97A] font-medium">Date</th>
                    <th className="text-left py-3 px-3 text-[#C9B97A] font-medium">Source</th>
                    <th className="text-left py-3 px-3 text-[#C9B97A] font-medium">Identité</th>
                    <th className="text-left py-3 px-3 text-[#C9B97A] font-medium">Score</th>
                    <th className="text-left py-3 px-3 text-[#C9B97A] font-medium">Commentaire</th>
                    <th className="text-left py-3 px-3 text-[#C9B97A] font-medium">Statut</th>
                    <th className="py-3 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r: any) => {
                    const rating = getMainRating(r);
                    const comment = getFirstComment(r);
                    const mod = MODERATION_CONFIG[r.moderation as ModerationKey] ?? MODERATION_CONFIG.pending;
                    const ModIcon = mod.icon;

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-[#F2E9D3]/5 hover:bg-[#3D3B1E]/50 cursor-pointer"
                        onClick={() => setSelectedResponse(r)}
                      >
                        <td className="py-3 px-3 text-[#F2E9D3]/70 whitespace-nowrap">
                          {format(new Date(r.created_at), "dd MMM yyyy", { locale: fr })}
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={r.source === "email_campaign" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-[#C9B97A]/20 text-[#C9B97A] border-[#C9B97A]/30"}>
                            {r.source === "email_campaign" ? "Email" : "Web"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {r.is_anonymous ? (
                            <span className="flex items-center gap-1 text-[#F2E9D3]/50 text-xs">
                              <EyeOff className="w-3 h-3" /> Anonyme
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[#F2E9D3]/80 text-xs">
                              <Eye className="w-3 h-3" /> {r.user_email ?? r.user_name ?? "Identifié"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {rating !== null ? <StarDisplay rating={rating} /> : <span className="text-[#F2E9D3]/30">—</span>}
                        </td>
                        <td className="py-3 px-3 max-w-[200px]">
                          {comment ? (
                            <span className="text-[#F2E9D3]/70 italic text-xs line-clamp-1">"{comment}"</span>
                          ) : (
                            <span className="text-[#F2E9D3]/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={`text-xs ${mod.bg} ${mod.color} border flex items-center gap-1 w-fit`}>
                            <ModIcon className="w-3 h-3" />
                            {mod.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#C9B97A]/60 hover:text-[#C9B97A] h-7 px-2"
                            onClick={(e) => { e.stopPropagation(); setSelectedResponse(r); }}
                          >
                            Voir
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {selectedResponse && (
        <ResponseDetailDialog
          response={selectedResponse}
          onClose={() => setSelectedResponse(null)}
          onModerationChange={handleModerationChange}
        />
      )}
    </div>
  );
}
