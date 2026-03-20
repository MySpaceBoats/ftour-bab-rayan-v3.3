/**
 * Journal List Page — /admin/journal
 * Table + card view of all journal entries with filters and search.
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  PlusCircle,
  Search,
  BookOpen,
  BarChart2,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Tag,
  Clock,
  ThumbsUp,
} from "lucide-react";
import {
  JOURNAL_TYPE_LABELS,
  JOURNAL_CATEGORY_LABELS,
  JOURNAL_IMPORTANCE_LABELS,
  JOURNAL_TYPE_COLORS,
  JOURNAL_IMPORTANCE_COLORS,
  JOURNAL_IMPORTANCE_DOT,
  JOURNAL_TYPES,
  JOURNAL_CATEGORIES,
  JOURNAL_IMPORTANCE_LEVELS,
} from "../components/JournalConstants";

// ============================================
// HELPERS
// ============================================

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ============================================
// ENTRY CARD
// ============================================

type Entry = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  importance: string;
  tags: string[];
  event_edition: string;
  useful_count: number;
  created_at: string;
  author: { name: string | null } | null;
};

function EntryCard({ entry }: { entry: Entry }) {
  const snippet = entry.description.replace(/<[^>]*>/g, "").slice(0, 120);

  return (
    <Link href={`/admin/journal/${entry.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${JOURNAL_IMPORTANCE_COLORS[entry.importance]}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${JOURNAL_IMPORTANCE_DOT[entry.importance]}`} />
                {JOURNAL_IMPORTANCE_LABELS[entry.importance]}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${JOURNAL_TYPE_COLORS[entry.type]}`}>
                {JOURNAL_TYPE_LABELS[entry.type]}
              </span>
            </div>
            {entry.useful_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <ThumbsUp className="w-3 h-3" />
                {entry.useful_count}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">{entry.title}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{snippet}{snippet.length >= 120 ? "…" : ""}</p>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {JOURNAL_CATEGORY_LABELS[entry.category]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(entry.created_at)}
            </span>
          </div>

          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.slice(0, 4).map(tag => (
                <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
              {entry.tags.length > 4 && (
                <span className="text-xs text-gray-400">+{entry.tags.length - 4}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AdminJournal() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [importance, setImportance] = useState<string>("all");
  const [sort, setSort] = useState<"latest" | "importance" | "oldest">("latest");
  const [page, setPage] = useState(1);

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._journalSearchTimer);
    (window as any)._journalSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const { data, isLoading } = trpc.journal.listEntries.useQuery({
    page,
    pageSize: 18,
    type: type !== "all" ? (type as any) : undefined,
    category: category !== "all" ? (category as any) : undefined,
    importance: importance !== "all" ? (importance as any) : undefined,
    search: debouncedSearch || undefined,
    sort,
  });

  const entries = data?.entries ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">Journal d'Événement</h1>
              {total > 0 && (
                <Badge variant="secondary" className="text-xs">{total}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/journal/analytics">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BarChart2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Analytiques</span>
                </Button>
              </Link>
              <Link href="/admin/journal/lessons">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Lightbulb className="w-4 h-4" />
                  <span className="hidden sm:inline">Leçons</span>
                </Button>
              </Link>
              <Link href="/admin/journal/new">
                <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Nouvelle entrée</span>
                  <span className="sm:hidden">Nouveau</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <Select value={type} onValueChange={v => { setType(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {JOURNAL_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{JOURNAL_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {JOURNAL_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{JOURNAL_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={importance} onValueChange={v => { setImportance(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Importance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute importance</SelectItem>
                {JOURNAL_IMPORTANCE_LEVELS.map(i => (
                  <SelectItem key={i} value={i}>{JOURNAL_IMPORTANCE_LABELS[i]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={v => { setSort(v as any); setPage(1); }}>
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Trier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Plus récent</SelectItem>
                <SelectItem value="importance">Importance</SelectItem>
                <SelectItem value="oldest">Plus ancien</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-lg border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Aucune entrée trouvée</p>
            <p className="text-gray-400 text-sm mt-1">Commencez par créer une nouvelle entrée.</p>
            <Link href="/admin/journal/new">
              <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Créer la première entrée
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Critical alert banner */}
            {entries.some(e => e.importance === "critical") && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Des entrées critiques nécessitent votre attention.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map(entry => (
                <EntryCard key={entry.id} entry={entry as Entry} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
