import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();

export default function Galerie() {
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "featured">("recent");
  const [page, setPage] = useState(1);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [photosList, setPhotosList] = useState<any[]>([]);

  const albums = trpc.public.galleryAlbums.useQuery();

  // Only year-based albums (edition-YYYY), sorted newest first
  const yearAlbums = useMemo(() => {
    return (albums.data ?? [])
      .filter((a: any) => /^edition-\d{4}$/.test(a.slug))
      .sort((a: any, b: any) => {
        const yearA = parseInt(a.slug.replace("edition-", ""));
        const yearB = parseInt(b.slug.replace("edition-", ""));
        return yearB - yearA;
      });
  }, [albums.data]);

  // Auto-select the most recent accessible (non-future) year
  useEffect(() => {
    if (yearAlbums.length > 0 && !selectedAlbum) {
      const firstAccessible = yearAlbums.find((a: any) => {
        const year = parseInt(a.slug.replace("edition-", ""));
        return year <= CURRENT_YEAR;
      });
      if (firstAccessible) setSelectedAlbum(firstAccessible.slug);
    }
  }, [yearAlbums, selectedAlbum]);

  const photos = trpc.public.galleryPhotos.useQuery(
    {
      albumSlug: selectedAlbum ?? undefined,
      tag: tag === "all" ? undefined : tag,
      sort,
      page,
      pageSize: 30,
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
  }, [tag, sort, selectedAlbum]);

  const list = photosList;
  const total = photos.data?.total ?? 0;
  const canLoadMore = list.length < total;
  const current = lightboxIndex !== null ? list[lightboxIndex] : null;

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    list.forEach((p: any) =>
      (p.tags ?? []).forEach((t: string) => tags.add(t))
    );
    return Array.from(tags).sort();
  }, [list]);

  const handleTabSelect = (slug: string, year: number) => {
    if (year > CURRENT_YEAR) return;
    setSelectedAlbum(slug);
    setTag("all");
    setSort("recent");
    setPage(1);
    setPhotosList([]);
    setLightboxIndex(null);
  };

  const downloadCurrentPhoto = () => {
    if (!current?.image_original_url) return;
    const anchor = document.createElement("a");
    anchor.href = current.image_original_url;
    anchor.download = `${current.slug ?? current.id ?? "photo"}.jpg`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 space-y-6">
        <h1 className="text-3xl font-bold">Galerie</h1>

        {/* Year Tabs */}
        <div className="border-b overflow-x-auto">
          <div className="flex min-w-max">
            {albums.isLoading ? (
              <div className="flex gap-2 pb-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : yearAlbums.length === 0 ? (
              <p className="text-muted-foreground pb-3">Aucun album disponible.</p>
            ) : (
              yearAlbums.map((album: any) => {
                const year = parseInt(album.slug.replace("edition-", ""));
                const isFuture = year > CURRENT_YEAR;
                const isSelected = album.slug === selectedAlbum;

                return (
                  <button
                    key={album.id}
                    onClick={() => handleTabSelect(album.slug, year)}
                    disabled={isFuture}
                    title={isFuture ? `Édition ${year} — à venir` : undefined}
                    className={cn(
                      "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      isSelected
                        ? "border-primary text-primary"
                        : isFuture
                        ? "border-transparent text-muted-foreground/35 cursor-not-allowed"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    {year}
                    {!isFuture && album.photo_count > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({album.photo_count})
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Photos for selected year */}
        {selectedAlbum && (
          <section className="space-y-4">
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

            {photos.isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 md:h-56 rounded-xl bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className="text-muted-foreground py-10">
                Aucune photo publiée pour cette édition.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {list.map((photo: any, idx: number) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightboxIndex(idx)}
                      className="overflow-hidden rounded-xl bg-muted"
                    >
                      <img
                        src={
                          photo.image_thumb_url ||
                          photo.image_medium_url ||
                          photo.image_original_url
                        }
                        alt={`${photo.title || "Photo"} ${photo.description || ""}`.trim()}
                        loading="lazy"
                        className="h-44 md:h-56 w-full object-cover transition-transform hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
                {canLoadMore && (
                  <div className="flex justify-center pt-2">
                    <Button onClick={() => setPage(prev => prev + 1)}>
                      Charger plus
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
      <Footer />

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

          <button
            className="absolute top-4 left-4 text-white bg-black/40 rounded-full px-3 py-2 hover:bg-black/60 inline-flex items-center gap-2"
            onClick={e => {
              e.stopPropagation();
              downloadCurrentPhoto();
            }}
          >
            <Download className="h-4 w-4" />
            Télécharger
          </button>
        </div>
      )}
    </div>
  );
}
