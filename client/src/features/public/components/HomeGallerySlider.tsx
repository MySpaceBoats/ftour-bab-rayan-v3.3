import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

const AUTOPLAY_MS = 4500;

/** Slider des photos publiées de la galerie, remplit son parent (hauteur et largeur 100 %). `fallback` s'affiche s'il n'y a aucune photo. */
export default function HomeGallerySlider({ fallback }: { fallback: React.ReactNode }) {
  const { data } = trpc.public.galleryPhotos.useQuery({ sort: "featured", pageSize: 12 }, { staleTime: 5 * 60_000 });
  const photos = (data?.items ?? []).filter((p: any) => p.image_medium_url || p.image_original_url || p.image_thumb_url);
  const [ref, api] = useEmblaCarousel({ loop: true });
  const [paused, setPaused] = useState(false);
  const prev = useCallback(() => api?.scrollPrev(), [api]);
  const next = useCallback(() => api?.scrollNext(), [api]);

  useEffect(() => {
    if (!api || paused || photos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [api, paused, photos.length]);

  if (!photos.length) return <>{fallback}</>;

  return (
    <div
      className="relative w-full h-full group"
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos de la galerie"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div ref={ref} className="overflow-hidden w-full h-full">
        <div className="flex h-full">
          {photos.map((p: any, i: number) => (
            <div key={p.id} className="flex-[0_0_100%] min-w-0 h-full" role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${photos.length}`}>
              <img
                src={p.image_medium_url || p.image_original_url || p.image_thumb_url}
                alt={p.title || "Ftour Bab Rayan"}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={prev} aria-label="Photo précédente" className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#6B3643]/70 text-[#F2E9D3] flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={next} aria-label="Photo suivante" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#6B3643]/70 text-[#F2E9D3] flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
