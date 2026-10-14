import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Loader2,
  Star,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PublicGalleryUpload from "@/features/gallery/components/PublicGalleryUpload";

const CURRENT_YEAR = new Date().getFullYear();
const FIRST_EDITION_YEAR = 2015;
const PAGE_SIZE = 30;
const SWIPE_PX = 50;

const getEditionNumber = (year: number) => year - FIRST_EDITION_YEAR + 1;
const slugYear = (slug: string) => parseInt(slug.replace("edition-", ""), 10);
const bestUrl = (p: any) =>
  p.image_medium_url || p.image_original_url || p.image_thumb_url;

/** Thumb → medium → original fallback, then hide. */
function fallbackSrc(e: React.SyntheticEvent<HTMLImageElement>, photo: any) {
  const img = e.currentTarget;
  const chain = [photo.image_thumb_url, photo.image_medium_url, photo.image_original_url]
    .filter(Boolean) as string[];
  const step = Number(img.dataset.step ?? 0) + 1;
  img.dataset.step = String(step);
  if (chain[step]) img.src = chain[step];
  else img.style.visibility = "hidden";
}

function Lightbox({
  list,
  index,
  total,
  canLoadMore,
  onLoadMore,
  onIndex,
  onClose,
}: {
  list: any[];
  index: number;
  total: number;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const photo = list[index];
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    (delta: number) => onIndex((index + delta + list.length) % list.length),
    [index, list.length, onIndex]
  );

  // Keyboard nav, scroll lock, focus restore
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Preload neighbours; fetch next page when nearing the end
  useEffect(() => {
    [index - 1, index + 1].forEach(i => {
      const p = list[(i + list.length) % list.length];
      if (p) new Image().src = bestUrl(p);
    });
    if (canLoadMore && index >= list.length - 3) onLoadMore();
  }, [index, list, canLoadMore, onLoadMore]);

  if (!photo) return null;
  const caption = [photo.title, photo.description].filter(Boolean).join(" — ");

  const download = () => {
    const url = photo.image_original_url;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${photo.title ?? photo.id ?? "photo"}.jpg`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse de photos"
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
      onTouchStart={e => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className="flex items-center justify-between p-3 text-white"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-sm tabular-nums opacity-80">
          {index + 1} / {total}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full bg-white/10 px-3 py-2 hover:bg-white/20 inline-flex items-center gap-2 text-sm"
            onClick={download}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          <button
            ref={closeRef}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2">
        {list.length > 1 && (
          <button
            className="absolute left-2 z-10 text-white bg-white/10 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/20"
            onClick={e => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <img
          key={photo.id}
          src={bestUrl(photo)}
          alt={caption || "Photo"}
          className="max-h-full max-w-full object-contain rounded-lg"
          onClick={e => e.stopPropagation()}
          onError={e => fallbackSrc(e, photo)}
        />
        {list.length > 1 && (
          <button
            className="absolute right-2 z-10 text-white bg-white/10 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/20"
            onClick={e => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="p-3 min-h-12 text-center text-sm text-white/80" onClick={e => e.stopPropagation()}>
        {caption}
      </div>
    </div>
  );
}

export default function Galerie() {
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "featured">("recent");
  const [page, setPage] = useState(1);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [photosList, setPhotosList] = useState<any[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const albums = trpc.public.galleryAlbums.useQuery();

  // Only year-based albums (edition-YYYY), sorted newest first
  const yearAlbums = useMemo(
    () =>
      (albums.data ?? [])
        .filter((a: any) => /^edition-\d{4}$/.test(a.slug))
        .sort((a: any, b: any) => slugYear(b.slug) - slugYear(a.slug)),
    [albums.data]
  );

  // Initial edition: ?edition=YYYY if valid, else most recent non-future year
  // with photos, else most recent non-future year.
  useEffect(() => {
    if (yearAlbums.length === 0 || selectedAlbum) return;
    const wanted = new URLSearchParams(window.location.search).get("edition");
    const fromUrl = yearAlbums.find(
      (a: any) => String(slugYear(a.slug)) === wanted && slugYear(a.slug) <= CURRENT_YEAR
    );
    const accessible = yearAlbums.filter((a: any) => slugYear(a.slug) <= CURRENT_YEAR);
    const target =
      fromUrl ?? accessible.find((a: any) => a.photo_count > 0) ?? accessible[0];
    if (target) setSelectedAlbum(target.slug);
  }, [yearAlbums, selectedAlbum]);

  // Keep the URL shareable
  useEffect(() => {
    if (!selectedAlbum) return;
    const url = new URL(window.location.href);
    url.searchParams.set("edition", String(slugYear(selectedAlbum)));
    window.history.replaceState(null, "", url);
  }, [selectedAlbum]);

  const photos = trpc.public.galleryPhotos.useQuery(
    {
      albumSlug: selectedAlbum ?? undefined,
      tag: tag === "all" ? undefined : tag,
      sort,
      page,
      pageSize: PAGE_SIZE,
    },
    { enabled: Boolean(selectedAlbum) }
  );

  useEffect(() => {
    if (!selectedAlbum) {
      setPhotosList([]);
      return;
    }
    if (!photos.data?.items) return;
    setPhotosList(prev =>
      page === 1 ? photos.data.items : [...prev, ...photos.data.items]
    );
  }, [photos.data?.items, page, selectedAlbum]);

  useEffect(() => {
    setPage(1);
    setPhotosList([]);
    setLightboxIndex(null);
  }, [tag, sort, selectedAlbum]);

  const list = photosList;
  const total = photos.data?.total ?? 0;
  const canLoadMore = list.length < total;
  const loadMore = useCallback(() => {
    if (!photos.isFetching) setPage(p => p + 1);
  }, [photos.isFetching]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    list.forEach((p: any) => (p.tags ?? []).forEach((t: string) => tags.add(t)));
    if (tag !== "all") tags.add(tag); // keep the active filter selectable
    return Array.from(tags).sort();
  }, [list, tag]);

  const selectedYear = selectedAlbum ? slugYear(selectedAlbum) : null;

  const handleTabSelect = (slug: string, year: number) => {
    if (year > CURRENT_YEAR) return;
    setSelectedAlbum(slug);
    setTag("all");
    setSort("recent");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Galerie</h1>
            {selectedYear && (
              <p className="text-sm text-muted-foreground mt-1">
                Édition {getEditionNumber(selectedYear)} · {selectedYear}
                {photos.data && ` · ${total} photo${total > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
          <Button onClick={() => setUploadOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Partager mes photos
          </Button>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Partagez vos photos du Ftour Bab Rayan</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              Vos photos seront visibles dans la galerie après validation par notre équipe.
            </p>
            <PublicGalleryUpload
              onClose={() => setUploadOpen(false)}
              defaultYear={selectedYear}
            />
          </DialogContent>
        </Dialog>

        {/* Edition Tabs */}
        <div className="border-b overflow-x-auto">
          <div className="flex min-w-max" role="tablist" aria-label="Éditions">
            {albums.isLoading ? (
              <div className="flex gap-2 pb-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : albums.isError ? (
              <p className="text-muted-foreground pb-3">
                Impossible de charger les éditions.{" "}
                <button className="underline" onClick={() => albums.refetch()}>
                  Réessayer
                </button>
              </p>
            ) : yearAlbums.length === 0 ? (
              <p className="text-muted-foreground pb-3">Aucun album disponible.</p>
            ) : (
              yearAlbums.map((album: any) => {
                const year = slugYear(album.slug);
                const isFuture = year > CURRENT_YEAR;
                const isSelected = album.slug === selectedAlbum;

                return (
                  <button
                    key={album.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabSelect(album.slug, year)}
                    disabled={isFuture}
                    title={
                      isFuture
                        ? `Édition ${getEditionNumber(year)} — à venir`
                        : `Édition ${getEditionNumber(year)} · ${year}`
                    }
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex flex-col items-center leading-tight",
                      isSelected
                        ? "border-primary text-primary"
                        : isFuture
                        ? "border-transparent text-muted-foreground/35 cursor-not-allowed"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    <span>{getEditionNumber(year)}</span>
                    <span className="text-[11px] font-normal opacity-70">
                      {year}
                      {!isFuture && album.photo_count > 0 && ` · ${album.photo_count}`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Photos for selected edition */}
        {selectedAlbum && (
          <section className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger aria-label="Filtrer par tag">
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
                <SelectTrigger aria-label="Trier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Récent</SelectItem>
                  <SelectItem value="oldest">Ancien</SelectItem>
                  <SelectItem value="featured">Mis en avant d'abord</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {photos.isError ? (
              <div className="py-10 text-center text-muted-foreground space-y-3">
                <p>Impossible de charger les photos.</p>
                <Button variant="outline" onClick={() => photos.refetch()}>
                  Réessayer
                </Button>
              </div>
            ) : photos.isLoading && page === 1 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-44 md:h-56 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground space-y-3">
                <ImageOff className="h-10 w-10 mx-auto opacity-50" />
                <p>
                  {tag !== "all"
                    ? "Aucune photo avec ce tag pour cette édition."
                    : "Aucune photo publiée pour cette édition."}
                </p>
                {tag !== "all" ? (
                  <Button variant="outline" onClick={() => setTag("all")}>
                    Voir toutes les photos
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Soyez le premier à partager
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {list.map((photo: any, idx: number) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightboxIndex(idx)}
                      aria-label={photo.title || `Ouvrir la photo ${idx + 1}`}
                      className="group relative overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <img
                        src={
                          photo.image_thumb_url ||
                          photo.image_medium_url ||
                          photo.image_original_url
                        }
                        alt={`${photo.title || "Photo"} ${photo.description || ""}`.trim()}
                        loading="lazy"
                        decoding="async"
                        className="h-44 md:h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={e => fallbackSrc(e, photo)}
                      />
                      {photo.is_featured && (
                        <Star
                          className="absolute top-2 right-2 h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow"
                          aria-label="Mis en avant"
                        />
                      )}
                      {photo.title && (
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity truncate">
                          {photo.title}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {canLoadMore && (
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <Button onClick={loadMore} disabled={photos.isFetching}>
                      {photos.isFetching && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Charger plus
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {list.length} / {total}
                    </span>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
      <Footer />

      {lightboxIndex !== null && list[lightboxIndex] && (
        <Lightbox
          list={list}
          index={lightboxIndex}
          total={total}
          canLoadMore={canLoadMore}
          onLoadMore={loadMore}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
