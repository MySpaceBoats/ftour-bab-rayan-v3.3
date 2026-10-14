import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Same numbering as the gallery: edition 1 = 2015
const FIRST_EDITION_YEAR = 2015;
const editionYear = (edition: number) => FIRST_EDITION_YEAR + edition - 1;

// ============================================
// MEMBER CARD
// ============================================
function MemberCard({ member, index }: { member: any; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase();
  const delay = (index % 8) * 80; // stagger per row

  return (
    <div
      ref={ref}
      className="group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
        {/* Photo */}
        <div className="relative">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={fullName}
              loading="lazy"
              className="w-24 h-24 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300">
              <span className="text-primary font-bold text-2xl">{initials}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1">
          <h3 className="font-bold text-foreground text-base leading-tight">{fullName}</h3>
          {member.role && (
            <p className="text-xs font-medium text-primary/80 uppercase tracking-wide">{member.role}</p>
          )}
        </div>

        {/* Citation */}
        {member.citation && (
          <p className="text-sm text-muted-foreground italic leading-relaxed border-t border-border/50 pt-3 w-full">
            &ldquo;{member.citation}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// PAGE
// ============================================
export default function EquipeFtour() {
  useEffect(() => {
    const prev = document.title;
    document.title = "L'équipe du Ftour Bab Rayan";
    return () => { document.title = prev; };
  }, []);

  const { data: all = [], isLoading, error, refetch } = trpc.team.listPublic.useQuery(
    {},
    { staleTime: 5 * 60 * 1000 }
  );

  const byEdition = useMemo(() => {
    const map = new Map<number, typeof all>();
    for (const m of all) map.set(m.edition, [...(map.get(m.edition) ?? []), m]);
    return map;
  }, [all]);
  const editions = useMemo(() => Array.from(byEdition.keys()).sort((a, b) => b - a), [byEdition]);

  // ?edition=N if valid, else the most recent edition with members
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (selected !== null || editions.length === 0) return;
    const wanted = Number(new URLSearchParams(window.location.search).get("edition"));
    setSelected(editions.includes(wanted) ? wanted : editions[0]);
  }, [editions, selected]);

  const selectEdition = (edition: number) => {
    setSelected(edition);
    const url = new URL(window.location.href);
    url.searchParams.set("edition", String(edition));
    window.history.replaceState(null, "", url);
  };

  const members = selected !== null ? byEdition.get(selected) ?? [] : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Users className="h-4 w-4" />
                {selected !== null ? `Édition ${selected} · ${editionYear(selected)}` : "Nos équipes"}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                L'équipe{selected !== null ? " de la " : " du "}
                {selected !== null && <span className="text-primary">{selected}ᵉ édition</span>}
                {selected !== null && <br />}
                {selected !== null ? "du Ftour Bab Rayan" : "Ftour Bab Rayan"}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Chaque édition du Ftour Bab Rayan est rendue possible grâce à l'engagement de
                bénévoles extraordinaires. Découvrez les visages et les mots de celles et ceux
                qui font vivre cette aventure humaine.
              </p>
            </div>
          </div>
        </section>

        {/* ── Content ── */}
        <section className="py-16">
          <div className="container">
            {editions.length > 1 && (
              <div className="border-b overflow-x-auto mb-10">
                <div className="flex min-w-max justify-center" role="tablist" aria-label="Éditions">
                  {editions.map(edition => (
                    <button
                      key={edition}
                      role="tab"
                      aria-selected={edition === selected}
                      onClick={() => selectEdition(edition)}
                      className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex flex-col items-center leading-tight",
                        edition === selected
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                      )}
                    >
                      <span>{edition}</span>
                      <span className="text-[11px] font-normal opacity-70">
                        {editionYear(edition)} · {byEdition.get(edition)?.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <div className="text-center py-16 text-muted-foreground">
                <p>Une erreur est survenue lors du chargement de l'équipe.</p>
                <button className="underline mt-2" onClick={() => refetch()}>Réessayer</button>
              </div>
            )}

            {!isLoading && !error && all.length === 0 && (
              <div className="text-center py-24">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  L'équipe sera présentée prochainement.
                </p>
              </div>
            )}

            {!isLoading && !error && members.length > 0 && (
              <>
                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-start">
                  {members.map((member, i) => (
                    <MemberCard key={member.id} member={member} index={i} />
                  ))}
                </div>

                {/* Footer note */}
                <p className="text-center text-sm text-muted-foreground mt-12">
                  Merci à tous les {members.length} membres de l'équipe pour leur engagement et leur générosité.
                </p>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
