import { useEffect } from "react";
import { Link, useParams } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Heart, Share2, ArrowLeft, Eye, Calendar, User } from "lucide-react";
import { toast } from "sonner";
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

// ============================================
// CARTE ARTICLE SIMILAIRE
// ============================================

function RelatedCard({ post }: { post: any }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <div className="group flex gap-3 p-3 rounded-xl hover:bg-amber-50 transition-colors cursor-pointer">
        <div className="w-16 h-16 rounded-lg bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-xl">
          ✍️
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-800 line-clamp-2 group-hover:text-amber-700 transition-colors">
            {post.title}
          </p>
          <p className="text-xs text-gray-400 mt-1">{post.author_name}</p>
        </div>
      </div>
    </Link>
  );
}

// ============================================
// PAGE ARTICLE
// ============================================

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useI18n();

  const {
    data: post,
    isLoading,
    isError,
  } = trpc.blog.bySlug.useQuery({ slug: slug ?? "" }, { enabled: !!slug });

  const { data: related } = trpc.blog.related.useQuery(
    { postId: post?.id ?? 0, type: (post?.type as any) ?? "participant" },
    { enabled: !!post }
  );

  const { data: likeData, refetch: refetchLike } = trpc.blog.hasLiked.useQuery(
    { postId: post?.id ?? 0 },
    { enabled: !!post }
  );

  const incrementViews = trpc.blog.incrementViews.useMutation();
  const toggleLike = trpc.blog.toggleLike.useMutation({
    onSuccess: res => {
      refetchLike();
      toast.success(res.liked ? "Témoignage aimé ❤️" : "Like retiré");
    },
    onError: e => {
      if (e.data?.code === "UNAUTHORIZED") {
        toast.error("Connectez-vous pour aimer cet article.");
      } else {
        toast.error(e.message);
      }
    },
  });

  // Incrémenter vues au chargement
  useEffect(() => {
    if (slug) {
      incrementViews.mutate({ slug });
    }
  }, [slug]);

  function handleShare() {
    if (navigator.share) {
      navigator
        .share({
          title: post?.title,
          text: post?.hook ?? post?.excerpt ?? "",
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Lien copié !");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Chargement du témoignage…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <p className="text-6xl mb-4">📭</p>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Témoignage introuvable
            </h1>
            <p className="text-gray-500 mb-6">
              Cet article n'existe pas ou a été supprimé.
            </p>
            <Link href="/blog">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour aux témoignages
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const date = new Date(post.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        {/* Cover hero */}
        <div className="relative w-full bg-gradient-to-b from-amber-900 to-amber-700 overflow-hidden">
          <div className="relative max-w-3xl mx-auto px-4 py-14 text-center text-white">
            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1 rounded-full">
                {TYPE_LABELS[post.type] ?? post.type}
              </span>
              {(post.categories as string[]).map(cat => (
                <span
                  key={cat}
                  className="bg-amber-500/30 text-amber-100 text-xs px-2 py-1 rounded-full"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
            </div>

            {/* Titre */}
            <h1 className="text-2xl md:text-4xl font-bold leading-tight mb-4">
              {post.title}
            </h1>

            {/* Hook */}
            {post.hook && (
              <p className="text-amber-200 italic text-lg mb-6">
                "{post.hook}"
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap justify-center gap-4 text-amber-200 text-sm">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.author_name}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {date}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {post.views} vue{post.views !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Corps + sidebar */}
        <div className="max-w-5xl mx-auto px-4 py-10 flex gap-10 items-start">
          {/* Contenu principal */}
          <article className="flex-1 min-w-0">
            {/* Back */}
            <Link href="/blog">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-amber-700 transition-colors mb-6">
                <ArrowLeft className="w-4 h-4" />
                Tous les témoignages
              </button>
            </Link>

            {/* Texte riche */}
            <div
              className="prose prose-amber max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:leading-relaxed prose-p:text-gray-800 prose-strong:text-gray-900 prose-li:text-gray-800 prose-blockquote:text-gray-800"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Actions */}
            <div className="flex items-center gap-3 mt-10 pt-6 border-t border-gray-100">
              <Button
                variant={likeData?.liked ? "default" : "outline"}
                size="sm"
                className={
                  likeData?.liked
                    ? "bg-rose-500 hover:bg-rose-600 text-white"
                    : ""
                }
                onClick={() => toggleLike.mutate({ postId: post.id })}
                disabled={toggleLike.isPending}
              >
                <Heart
                  className={`w-4 h-4 mr-1.5 ${likeData?.liked ? "fill-current" : ""}`}
                />
                {post.likes +
                  (toggleLike.data?.liked === true && !likeData?.liked
                    ? 1
                    : toggleLike.data?.liked === false && likeData?.liked
                      ? -1
                      : 0)}{" "}
                J'aime
              </Button>

              <Button variant="outline" size="sm" className="text-gray-800" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-1.5" />
                Partager
              </Button>

              <Link href={`/${lang}/blog/nouveau`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-amber-700 hover:bg-amber-50"
                >
                  ✍️ Partager mon expérience
                </Button>
              </Link>
            </div>
          </article>

          {/* Sidebar — articles similaires */}
          {related && related.length > 0 && (
            <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24">
              <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">
                Témoignages similaires
              </h3>
              <div className="space-y-2">
                {related.map(r => (
                  <RelatedCard key={r.id} post={r} />
                ))}
              </div>
            </aside>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
