import { useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const YEAR_START = 2015;
const YEAR_END = 2030;
const CURRENT_YEAR = 2026;

const YEARS = Array.from(
  { length: YEAR_END - YEAR_START + 1 },
  (_, i) => YEAR_START + i
);

export default function Galerie() {
  const [selectedYear, setSelectedYear] = useState<number | null>(CURRENT_YEAR);
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "featured">("recent");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const yearScrollRef = useRef<HTMLDivElement>(null);

  // Build album slug from selected year
  const albumSlug = selectedYear ? `edition-${selectedYear}` : undefined;

  const photos = trpc.public.galleryPhotos.useQuery({
    album: albumSlug,
    tag: tag === "all" ? undefined : tag,
    sort,
    page: 1,
    pageSize: 50,
  });

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    (photos.data?.items ?? []).forEach((p: any) =>
      (p.tags ?? []).forEach((t: string) => tags.add(t))
    );
    return Array.from(tags).sort();
  }, [photos.data?.items]);

  const list = photos.data?.items ?? [];
  const current = lightboxIndex !== null ? list[lightboxIndex] : null;

  function scrollYears(direction: "left" | "right") {
    const el = yearScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 space-y-6">
        <h1 className="text-3xl font-bold">Galerie</h1>

        {/* Year navigation */}
        <div className="relative">
          <button
            onClick={() => scrollYears("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-full p-1 shadow-sm hover:bg-muted hidden sm:flex items-center justify-center"
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={yearScrollRef}
            className="flex gap-2 overflow-x-auto scroll-smooth px-1 sm:px-8 pb-2 no-scrollbar"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* "Tous" button */}
            <button
              onClick={() => setSelectedYear(null)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
                selectedYear === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              Tous
            </button>

            {YEARS.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
                  selectedYear === year
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                {year}
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollYears("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-full p-1 shadow-sm hover:bg-muted hidden sm:flex items-center justify-center"
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger>
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les tags</SelectItem>
              {allTags.map(t => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Récent</SelectItem>
              <SelectItem value="oldest">Ancien</SelectItem>
              <SelectItem value="featured">Mis en avant d'abord</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Album title */}
        {selectedYear && (
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">
              Édition {selectedYear}
            </h2>
            <span className="text-sm text-muted-foreground">
              ({photos.data?.total ?? 0} photo{(photos.data?.total ?? 0) !== 1 ? "s" : ""})
            </span>
          </div>
        )}

        {/* Photos grid */}
        {photos.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 md:h-56 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Aucune photo disponible</p>
            <p className="text-sm mt-1">
              {selectedYear
                ? `Aucune photo pour l'édition ${selectedYear} pour l'instant.`
                : "La galerie est vide pour l'instant."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {list.map((photo: any, idx: number) => (
              <button
                key={photo.id}
                onClick={() => setLightboxIndex(idx)}
                className="overflow-hidden rounded-xl bg-muted"
              >
                <img
                  src={photo.image_thumb_url || photo.image_medium_url || photo.image_original_url}
                  alt={`${photo.title || "Photo"} ${photo.description || ""}`.trim()}
                  loading="lazy"
                  className="h-44 md:h-56 w-full object-cover transition-transform hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-1 hover:bg-black/60"
            onClick={() => setLightboxIndex(null)}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            className="absolute left-4 text-white text-3xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/60"
            onClick={e => {
              e.stopPropagation();
              setLightboxIndex(i =>
                i === null ? null : (i - 1 + list.length) % list.length
              );
            }}
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <img
            src={current.image_medium_url || current.image_original_url}
            alt={`${current.title || "Photo"} ${current.description || ""}`.trim()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-4 text-white text-3xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/60"
            onClick={e => {
              e.stopPropagation();
              setLightboxIndex(i =>
                i === null ? null : (i + 1) % list.length
              );
            }}
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Caption */}
          {(current.title || current.description) && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full max-w-xs text-center"
              onClick={e => e.stopPropagation()}
            >
              {current.title}
              {current.title && current.description ? " — " : ""}
              {current.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
