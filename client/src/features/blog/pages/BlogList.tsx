import { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
import {
  Heart,
  Eye,
  Search,
  PenSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/i18n";

// ============================================
// CONSTANTES
// ============================================

const TYPE_LABELS: Record<string, string> = {
  benevole: "Bénévole",
  participant: "Participant",
  equipe: "Équipe",
  autre: "Autre",
};

const CATEGORY_LABELS: Record<string, string> = {
  ressenti: "Ressenti",
  analyse: "Analyse",
  feedback: "Feedback",
  histoire: "Histoire",
  spirituel: "Spirituel",
  organisation: "Organisation",
};

const TYPE_COLORS: Record<string, string> = {
  benevole: "bg-emerald-100 text-emerald-800",
  participant: "bg-blue-100 text-blue-800",
  equipe: "bg-purple-100 text-purple-800",
  autre: "bg-gray-100 text-gray-700",
};

// ============================================
// CARD ARTICLE
// ============================================

type PostCard = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  hook: string | null;
  author_name: string;
  type: string;
  categories: string[];
  likes: number;
  views: number;
  created_at: string;
};

function BlogCard({ post }: { post: PostCard }) {
  const date = new Date(post.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Link href={`/blog/${post.slug}`}>
      <article className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-amber-50 cursor-pointer h-full flex flex-col">
        <div className="px-5 pt-5">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${TYPE_COLORS[post.type] ?? "bg-gray-100 text-gray-700"}`}
          >
            {TYPE_LABELS[post.type] ?? post.type}
          </span>
        </div>

        {/* Contenu */}
        <div className="p-5 flex flex-col flex-1 gap-3">
          {/* Hook */}
          {post.hook && (
            <p className="text-amber-700 font-medium italic text-sm line-clamp-1">
              "{post.hook}"
            </p>
          )}

          <h2 className="font-bold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-gray-500 text-sm line-clamp-2 flex-1">
              {post.excerpt}
            </p>
          )}

          {/* Catégories */}
          {post.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.categories.slice(0, 2).map(cat => (
                <span
                  key={cat}
                  className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
            </div>
          )}

          {/* Footer card */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-auto">
            <div className="text-xs text-gray-400">
              <span className="font-medium text-gray-600">
                {post.author_name}
              </span>
              <span className="mx-1">·</span>
              {date}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {post.likes}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {post.views}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function BlogList() {
  const { lang } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "popular" | "views">("recent");

  const { data, isLoading } = trpc.blog.list.useQuery({
    page,
    pageSize: 9,
    type: type !== "all" ? (type as any) : undefined,
    category: category !== "all" ? (category as any) : undefined,
    sort,
    search: search || undefined,
  });

  function handleFilter() {
    setPage(1);
  }

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/30">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-gradient-to-b from-amber-900 to-amber-700 text-white py-16 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <div className="relative max-w-2xl mx-auto">
            <p className="text-amber-200 text-sm font-medium uppercase tracking-widest mb-3">
              Mémoire collective
            </p>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Voix du Ftour
            </h1>
            <p className="text-amber-100 text-base md:text-lg mb-8 leading-relaxed">
              Des témoignages humains, des histoires vraies, des expériences
              partagées autour de notre table commune.
            </p>
            <Link href={`/${lang}/blog/nouveau`}>
              <Button className="bg-white text-amber-800 hover:bg-amber-50 font-semibold px-6 py-3 rounded-full shadow">
                <PenSquare className="w-4 h-4 mr-2" />
                Partager mon expérience
              </Button>
            </Link>
          </div>
        </section>

        {/* Filtres */}
        <section className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-amber-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher…"
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  handleFilter();
                }}
              />
            </div>

            {/* Filtre type */}
            <Select
              value={type}
              onValueChange={v => {
                setType(v);
                handleFilter();
              }}
            >
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre catégorie */}
            <Select
              value={category}
              onValueChange={v => {
                setCategory(v);
                handleFilter();
              }}
            >
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tri */}
            <Select
              value={sort}
              onValueChange={v => {
                setSort(v as any);
                handleFilter();
              }}
            >
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="popular">Plus aimés</SelectItem>
                <SelectItem value="views">Plus vus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Grille articles */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-80 bg-white rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : data?.posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📖</p>
              <p className="text-gray-500 text-lg">Aucun témoignage trouvé.</p>
              <Link href={`/${lang}/blog/nouveau`}>
                <Button variant="outline" className="mt-4">
                  Soyez le premier à partager
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.posts.map(post => (
                <BlogCard key={post.id} post={post as PostCard} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-12">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
