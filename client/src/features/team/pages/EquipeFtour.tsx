import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Users, Loader2 } from "lucide-react";

// ============================================
// CURRENT EDITION
// ============================================
const CURRENT_EDITION = 13;

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
    document.title = "L'équipe du Ftour Bab Rayan – 12ᵉ édition";
    return () => { document.title = prev; };
  }, []);

  const { data: members = [], isLoading, error } = trpc.team.listPublic.useQuery(
    { edition: CURRENT_EDITION },
    { staleTime: 5 * 60 * 1000 }
  );

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
                12ᵉ édition · Ramadan 2025
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                L'équipe de la{" "}
                <span className="text-primary">12ᵉ édition</span>
                <br />
                du Ftour Bab Rayan
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
            {isLoading && (
              <div className="flex justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <div className="text-center py-16 text-muted-foreground">
                <p>Une erreur est survenue lors du chargement de l'équipe.</p>
              </div>
            )}

            {!isLoading && !error && members.length === 0 && (
              <div className="text-center py-24">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  L'équipe sera présentée prochainement.
                </p>
              </div>
            )}

            {!isLoading && members.length > 0 && (
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
