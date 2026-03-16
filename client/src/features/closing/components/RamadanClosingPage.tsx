import { useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================
// ISLAMIC GEOMETRIC PATTERN (SVG overlay)
// ============================================

function IslamicPattern() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ opacity: 0.04, zIndex: 1 }}
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern
            id="islamicPattern"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            {/* Eight-pointed star */}
            <polygon
              points="40,5 47,20 62,20 51,30 55,46 40,37 25,46 29,30 18,20 33,20"
              fill="#D4AF37"
              fillOpacity="0.6"
            />
            <rect x="0" y="0" width="80" height="80" fill="none" stroke="#D4AF37" strokeWidth="0.5" strokeOpacity="0.3" />
            <line x1="0" y1="40" x2="80" y2="40" stroke="#D4AF37" strokeWidth="0.3" strokeOpacity="0.3" />
            <line x1="40" y1="0" x2="40" y2="80" stroke="#D4AF37" strokeWidth="0.3" strokeOpacity="0.3" />
            <line x1="0" y1="0" x2="80" y2="80" stroke="#D4AF37" strokeWidth="0.3" strokeOpacity="0.2" />
            <line x1="80" y1="0" x2="0" y2="80" stroke="#D4AF37" strokeWidth="0.3" strokeOpacity="0.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#islamicPattern)" />
      </svg>
    </div>
  );
}

// ============================================
// DECORATIVE STARS
// ============================================

function Stars() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() > 0.8 ? 3 : 2,
    opacity: 0.2 + Math.random() * 0.5,
    delay: Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-[#D4AF37]"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animation: `twinkle ${2 + star.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// PHOTO SLIDER — Embla Carousel
// ============================================

type EventPhoto = {
  id: number;
  imageUrl: string;
  title: string | null;
};

function PhotoSlider({ photos }: { photos: EventPhoto[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
    dragFree: true,
  });

  // Manual autoplay via interval
  useEffect(() => {
    if (!emblaApi) return;
    const timer = setInterval(() => {
      emblaApi.scrollNext();
    }, 3000);
    return () => clearInterval(timer);
  }, [emblaApi]);

  if (photos.length === 0) return null;

  // Duplicate slides for true infinite feel
  const slides = photos.length < 6 ? [...photos, ...photos, ...photos] : [...photos, ...photos];

  return (
    <div className="overflow-hidden" ref={emblaRef}>
      <div className="flex gap-4">
        {slides.map((photo, index) => (
          <div
            key={`${photo.id}-${index}`}
            className="relative flex-none"
            style={{
              width: "clamp(260px, 22vw, 320px)",
            }}
          >
            <div
              className="rounded-2xl overflow-hidden shadow-xl transition-transform duration-500 ease-out hover:scale-105 cursor-pointer"
              style={{
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(212,175,55,0.15)",
              }}
            >
              <img
                src={photo.imageUrl}
                alt={photo.title ?? "Photo de l'événement"}
                loading="lazy"
                className="w-full object-cover"
                style={{ height: "clamp(180px, 18vw, 240px)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// STATS DASHBOARD — Glassmorphism style
// ============================================

function StatsDashboard() {
  const { data, isLoading } = trpc.ramadan.publicSummary.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const formatNumber = (n: number) =>
    new Intl.NumberFormat("fr-MA").format(n || 0);

  const stats = [
    {
      label: "Repas servis",
      value: data ? formatNumber(data.totalsToDate?.meals ?? 0) : "–",
      icon: "🍽️",
    },
    {
      label: "Participants bénévoles",
      value: data ? formatNumber(data.totalsToDate?.volunteersPresence ?? 0) : "–",
      icon: "🤝",
    },
    {
      label: "Bénéficiaires",
      value: data ? formatNumber(data.totalsToDate?.beneficiaries ?? 0) : "–",
      icon: "❤️",
    },
    {
      label: "Jours de Ramadan",
      value: data?.todayRamadanDay != null ? String(data.todayRamadanDay) : "30",
      icon: "🌙",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl bg-white/10" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="relative rounded-2xl p-6 text-center flex flex-col items-center gap-2 group"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(212,175,55,0.25)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-3xl mb-1 transition-transform duration-300 group-hover:scale-110">
            {stat.icon}
          </div>
          <div
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{
              color: "#D4AF37",
              textShadow: "0 0 24px rgba(212,175,55,0.4)",
              fontFamily: "Cormorant Garamond, Georgia, serif",
            }}
          >
            {stat.value}
          </div>
          <div
            className="text-xs md:text-sm leading-tight"
            style={{ color: "rgba(248,246,241,0.7)" }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// RAMADAN CLOSING PAGE — Main Component
// ============================================

export default function RamadanClosingPage() {
  const { data: photos = [], isLoading: photosLoading } =
    trpc.eventPhotos.listPublic.useQuery(undefined, {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: "linear-gradient(160deg, #0B1D3A 0%, #0f2550 35%, #1a1060 60%, #0e1840 100%)",
        color: "#F8F6F1",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Decorative layer */}
      <IslamicPattern />
      <Stars />

      {/* Crescent moon decoration */}
      <div
        className="absolute top-8 right-8 md:right-16 pointer-events-none select-none"
        style={{ zIndex: 2, fontSize: "clamp(2.5rem, 6vw, 5rem)", opacity: 0.35 }}
      >
        🌙
      </div>
      <div
        className="absolute top-20 left-8 md:left-16 pointer-events-none select-none"
        style={{ zIndex: 2, fontSize: "clamp(1.5rem, 3vw, 2.5rem)", opacity: 0.2 }}
      >
        ✦
      </div>
      <div
        className="absolute top-40 right-24 pointer-events-none select-none"
        style={{ zIndex: 2, fontSize: "1.5rem", opacity: 0.15 }}
      >
        ✦
      </div>

      {/* Content wrapper */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* ========================================
            SECTION 1 — HERO MESSAGE
            ======================================== */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Arabic calligraphy */}
            <div
              className="text-4xl md:text-5xl mb-2 opacity-80"
              style={{ fontFamily: "'Aref Ruqaa', serif", color: "#D4AF37", direction: "rtl" }}
            >
              فطور باب ريان
            </div>

            {/* Title */}
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
              style={{
                fontFamily: "Cormorant Garamond, Georgia, serif",
                color: "#F8F6F1",
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}
            >
              Ftour Bab Rayan
              <span
                style={{ color: "#D4AF37", display: "block", fontSize: "0.75em" }}
              >
                Ramadan 1447
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-lg md:text-xl italic"
              style={{
                color: "#D4AF37",
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontStyle: "italic",
              }}
            >
              Une aventure humaine et spirituelle exceptionnelle
            </p>

            {/* Gold divider */}
            <div className="flex items-center justify-center gap-4">
              <div className="h-px flex-1 max-w-24" style={{ background: "linear-gradient(to right, transparent, #D4AF37)" }} />
              <div className="text-xl" style={{ color: "#D4AF37" }}>✦</div>
              <div className="h-px flex-1 max-w-24" style={{ background: "linear-gradient(to left, transparent, #D4AF37)" }} />
            </div>

            {/* Main message */}
            <div
              className="space-y-4 text-base md:text-lg leading-relaxed text-left"
              style={{ color: "rgba(248,246,241,0.9)" }}
            >
              <p className="text-center font-medium text-lg md:text-xl" style={{ color: "#F8F6F1" }}>
                L'action du Ftour Bab Rayan Ramadan 1447 est officiellement terminée.
              </p>
              <p>
                Durant tout ce mois béni, des milliers de personnes se sont réunies pour partager, donner et servir.
              </p>
              <p>
                Nous remercions profondément toutes celles et ceux qui ont participé à cette aventure incroyable&nbsp;:
              </p>

              <ul className="space-y-2 pl-4">
                {[
                  "les bénévoles présents chaque soir",
                  "les équipes d'organisation",
                  "les donateurs et partenaires",
                  "les visiteurs et participants",
                  "et toutes les personnes qui ont soutenu l'événement de près ou de loin.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span style={{ color: "#D4AF37", marginTop: "0.15em", flexShrink: 0 }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <p>
                Grâce à vous, cette édition restera gravée comme un moment de solidarité, de générosité et de fraternité.
              </p>
              <p className="text-center italic" style={{ color: "#D4AF37", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.1em" }}>
                "Que l'esprit de ce mois continue de rayonner bien au-delà du Ramadan."
              </p>
            </div>

            {/* Scroll invitation */}
            <div
              className="pt-6 text-center"
              style={{ color: "rgba(248,246,241,0.6)", fontSize: "0.95rem" }}
            >
              <p>↓ Revivez quelques moments de cette édition.</p>
            </div>
          </div>
        </section>

        {/* ========================================
            SECTION 2 — PHOTO SLIDER
            ======================================== */}
        {(photosLoading || photos.length > 0) && (
          <section className="py-16 overflow-hidden">
            <div className="mb-10 text-center px-4">
              <h2
                className="text-2xl md:text-3xl font-bold mb-2"
                style={{
                  fontFamily: "Cormorant Garamond, Georgia, serif",
                  color: "#D4AF37",
                }}
              >
                Moments de l'édition
              </h2>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-16" style={{ background: "linear-gradient(to right, transparent, rgba(212,175,55,0.5))" }} />
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#D4AF37" }} />
                <div className="h-px w-16" style={{ background: "linear-gradient(to left, transparent, rgba(212,175,55,0.5))" }} />
              </div>
            </div>

            {photosLoading ? (
              <div className="flex gap-4 px-4 overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-none rounded-2xl"
                    style={{
                      width: "clamp(260px, 22vw, 320px)",
                      height: "clamp(180px, 18vw, 240px)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>
            ) : (
              <PhotoSlider photos={photos} />
            )}
          </section>
        )}

        {/* ========================================
            SECTION 3 — LIVE STATS DASHBOARD
            ======================================== */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center">
              <h2
                className="text-2xl md:text-3xl font-bold mb-2"
                style={{
                  fontFamily: "Cormorant Garamond, Georgia, serif",
                  color: "#D4AF37",
                }}
              >
                L'impact du mois
              </h2>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-16" style={{ background: "linear-gradient(to right, transparent, rgba(212,175,55,0.5))" }} />
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#D4AF37" }} />
                <div className="h-px w-16" style={{ background: "linear-gradient(to left, transparent, rgba(212,175,55,0.5))" }} />
              </div>
            </div>

            <StatsDashboard />
          </div>
        </section>

        {/* ========================================
            FOOTER
            ======================================== */}
        <footer
          className="py-10 px-4 text-center"
          style={{ borderTop: "1px solid rgba(212,175,55,0.15)" }}
        >
          <div
            className="text-4xl mb-4 opacity-60"
            style={{ fontFamily: "'Aref Ruqaa', serif", color: "#D4AF37", direction: "rtl" }}
          >
            فطور باب ريان
          </div>
          <p
            className="text-sm"
            style={{ color: "rgba(248,246,241,0.4)" }}
          >
            Ftour Bab Rayan – Ramadan 1447 · Casablanca, Maroc
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "rgba(248,246,241,0.25)" }}
          >
            Merci à tous les bénévoles, donateurs et participants.
          </p>
        </footer>
      </div>

      {/* Global animation keyframes */}
      <style>{`
        @keyframes twinkle {
          0% { opacity: 0.15; transform: scale(1); }
          100% { opacity: 0.7; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
