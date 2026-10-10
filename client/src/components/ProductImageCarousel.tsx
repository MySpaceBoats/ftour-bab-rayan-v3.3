import { useState } from "react";
import { Package, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { CarouselApi } from "@/components/ui/carousel";

interface ProductImageCarouselProps {
  /** Primary image URL (legacy single-image support) */
  image?: string | null;
  /** Array of image URLs for carousel */
  images?: string[] | null;
  alt: string;
  /** CSS classes applied to the outer container */
  className?: string;
  /** Show the fit/cover toggle button */
  showFitToggle?: boolean;
}

/**
 * Product image display with optional multi-image carousel and fit/cover toggle.
 * - If there is only one image, displays it without carousel controls.
 * - If there are multiple images, renders a carousel with prev/next arrows and dot indicators.
 * - The fit toggle switches between object-cover (crop) and object-contain (full image visible).
 */
export default function ProductImageCarousel({
  image,
  images,
  alt,
  className = "",
  showFitToggle = true,
}: ProductImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");

  // Build the resolved list of images
  const allImages: string[] = (() => {
    if (images && images.length > 0) return images;
    if (image) return [image];
    return [];
  })();

  const hasMultiple = allImages.length > 1;

  const scrollTo = (index: number) => {
    api?.scrollTo(index);
    setCurrent(index);
  };

  const scrollPrev = () => {
    const prev = (current - 1 + allImages.length) % allImages.length;
    scrollTo(prev);
  };

  const scrollNext = () => {
    const next = (current + 1) % allImages.length;
    scrollTo(next);
  };

  if (allImages.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <Package className="h-16 w-16 text-[#F2E9D3]/30" />
      </div>
    );
  }

  const imgClass = fitMode === "contain"
    ? "w-full h-full object-contain bg-[#542A34]"
    : "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300";

  if (!hasMultiple) {
    // Single image — no carousel, just the image + optional fit toggle
    return (
      <div className={`relative w-full h-full ${className}`}>
        <img src={allImages[0]} alt={alt} className={imgClass} />
        {showFitToggle && (
          <button
            onClick={e => { e.stopPropagation(); setFitMode(m => m === "cover" ? "contain" : "cover"); }}
            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
            title={fitMode === "cover" ? "Voir l'image entière" : "Recadrer l'image"}
          >
            {fitMode === "cover" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  }

  // Multiple images — full carousel
  return (
    <div className={`relative w-full h-full ${className}`}>
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        className="w-full h-full"
      >
        <CarouselContent className="-ml-0 h-full">
          {allImages.map((src, i) => (
            <CarouselItem key={i} className="pl-0 h-full">
              <img
                src={src}
                alt={`${alt} ${i + 1}`}
                className={imgClass}
                style={fitMode === "contain" ? { transition: "none" } : undefined}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Previous / Next arrows */}
      <button
        onClick={e => { e.stopPropagation(); scrollPrev(); }}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
        aria-label="Image précédente"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); scrollNext(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
        aria-label="Image suivante"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
        {allImages.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); scrollTo(i); }}
            className={`rounded-full transition-all ${
              i === current
                ? "bg-white w-4 h-1.5"
                : "bg-white/50 w-1.5 h-1.5 hover:bg-white/80"
            }`}
            aria-label={`Aller à l'image ${i + 1}`}
          />
        ))}
      </div>

      {/* Image counter */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
        {current + 1}/{allImages.length}
      </div>

      {/* Fit toggle */}
      {showFitToggle && (
        <button
          onClick={e => { e.stopPropagation(); setFitMode(m => m === "cover" ? "contain" : "cover"); }}
          className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
          title={fitMode === "cover" ? "Voir l'image entière" : "Recadrer l'image"}
        >
          {fitMode === "cover" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}
