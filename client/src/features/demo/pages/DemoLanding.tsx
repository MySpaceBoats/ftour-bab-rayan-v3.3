import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  HandCoins,
  Handshake,
  UtensilsCrossed,
  Users,
  ShoppingBag,
  CalendarDays,
  Boxes,
  Newspaper,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Landing publique et indexable pour /demo.
 */
export default function DemoLanding() {
  useEffect(() => {
    document.title = "Aperçu interactif — Ftour Bab Rayan";

    const metaDesc = ensureMeta("name", "description");
    metaDesc.setAttribute(
      "content",
      "Découvrez la plateforme de pilotage Ftour Bab Rayan : dashboards, dons, ftours, partenaires, réservations, boutique, inventaire, équipe et témoignages.",
    );

    const ogTitle = ensureMeta("property", "og:title");
    ogTitle.setAttribute("content", "Aperçu interactif — Ftour Bab Rayan");

    const ogDesc = ensureMeta("property", "og:description");
    ogDesc.setAttribute(
      "content",
      "Explorez la plateforme utilisée pour orchestrer l'opération Ftour Bab Rayan.",
    );

    const robots = ensureMeta("name", "robots");
    robots.setAttribute("content", "index,follow");

    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.setAttribute("data-demo-jsonld", "1");
    jsonLd.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Ftour Bab Rayan — Plateforme",
      applicationCategory: "NonprofitApplication",
      operatingSystem: "Web",
      url: "https://www.ftourbabrayan.ma/demo",
      description:
        "Plateforme associative de pilotage des dons, ftours, bénévoles et partenaires de l'opération Ftour Bab Rayan.",
    });
    document.head.appendChild(jsonLd);
    return () => {
      jsonLd.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <header className="px-4 py-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-lg font-bold text-white">
              F
            </span>
            <span className="text-sm font-semibold text-slate-900">Ftour Bab Rayan</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              Retour au site
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 lg:px-10 lg:py-20">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 ring-1 ring-inset ring-orange-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Espace d'aperçu
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              La plateforme qui orchestre{" "}
              <span className="text-orange-600">Ftour Bab Rayan.</span>
            </h1>
            <p className="mt-4 text-base text-slate-600 sm:text-lg">
              Dons, bénévoles, ftours, réservations, boutique, inventaire, équipe
              et témoignages — un outil unique pour piloter l'ensemble de
              l'opération, du tableau de bord stratégique jusqu'au terrain.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/demo/dashboard">
                <Button size="lg" className="bg-orange-600 text-white hover:bg-orange-700">
                  Entrer dans la plateforme
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo/dons">
                <Button variant="outline" size="lg">
                  Voir l'impact des dons
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Environnement d'aperçu · libre d'accès · sans inscription
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-orange-200/50 to-amber-100/40 blur-2xl" />
            <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Aperçu
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    Impact cumulé
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  En direct
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PreviewStat label="Repas servis" value="8 420" tone="emerald" />
                <PreviewStat label="Dons" value="412 000 MAD" tone="orange" />
                <PreviewStat label="Bénévoles" value="128" tone="sky" />
                <PreviewStat label="Partenaires" value="14" tone="violet" />
              </div>
              <div className="mt-4 grid grid-cols-12 items-end gap-1.5">
                {[28, 42, 60, 45, 80, 92, 70, 95, 110, 88, 120, 135].map((h, i) => (
                  <div
                    key={i}
                    className="rounded-t-md bg-gradient-to-t from-orange-400 to-orange-500"
                    style={{ height: `${h / 1.5}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20" aria-labelledby="modules-heading">
          <h2
            id="modules-heading"
            className="text-center text-2xl font-bold text-slate-900 sm:text-3xl"
          >
            Tous les outils de l'opération, au même endroit
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600">
            Une suite complète pour coordonner les équipes, suivre les finances et
            amplifier l'impact social.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              to="/demo/dashboard"
              icon={BarChart3}
              title="Tableau de bord"
              desc="Vision 360° sur les dons, repas servis, bénévoles et partenaires."
            />
            <ModuleCard
              to="/demo/utilisateurs"
              icon={Users}
              title="Utilisateurs"
              desc="Bénévoles, bénéficiaires et donateurs avec fiches détaillées."
            />
            <ModuleCard
              to="/demo/dons"
              icon={HandCoins}
              title="Dons"
              desc="Historique, graphiques et outils de collecte multicanaux."
            />
            <ModuleCard
              to="/demo/ftour"
              icon={UtensilsCrossed}
              title="Ftour"
              desc="Planning des repas, menus et statistiques journalières."
            />
            <ModuleCard
              to="/demo/reservations"
              icon={CalendarDays}
              title="Réservations"
              desc="Particuliers, groupes et entreprises pour l'iftar restaurant."
            />
            <ModuleCard
              to="/demo/boutique"
              icon={ShoppingBag}
              title="Boutique"
              desc="Commandes goodies, terroir et pâtisseries avec suivi en temps réel."
            />
            <ModuleCard
              to="/demo/inventaire"
              icon={Boxes}
              title="Inventaire"
              desc="Stocks, alertes et mouvements produits, sous contrôle."
            />
            <ModuleCard
              to="/demo/equipe"
              icon={UserCheck}
              title="Équipe"
              desc="Trombinoscope des responsables et référents de l'édition."
            />
            <ModuleCard
              to="/demo/blog"
              icon={Newspaper}
              title="Témoignages"
              desc="Histoires de bénévoles, coulisses et paroles de la communauté."
            />
            <ModuleCard
              to="/demo/partenaires"
              icon={Handshake}
              title="Partenaires"
              desc="Entreprises engagées, paliers de partenariat et contributions."
            />
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
          <div className="grid gap-8 md:grid-cols-3">
            <Principle
              title="Pensée pour l'impact"
              body="Chaque module est conçu pour accélérer la coordination sur le terrain et amplifier l'effet de chaque euro collecté."
            />
            <Principle
              title="Prête à l'échelle"
              body="Réservations particulières, groupes, entreprises, boutique multi-catégories : la plateforme absorbe la montée en charge."
            />
            <Principle
              title="Transparence intégrée"
              body="Indicateurs clairs, journaux d'activité en direct, rapports partageables avec les partenaires et donateurs."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:flex-row lg:px-10">
          <span>© Ftour Bab Rayan</span>
          <Link href="/" className="hover:text-slate-700">
            ftourbabrayan.ma
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ensureMeta(attr: "name" | "property", value: string) {
  const existing = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${value}"]`,
  );
  if (existing) return existing;
  const meta = document.createElement("meta");
  meta.setAttribute(attr, value);
  document.head.appendChild(meta);
  return meta;
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "orange" | "emerald" | "sky" | "violet";
}) {
  const tones: Record<typeof tone, string> = {
    orange: "bg-orange-50 text-orange-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
  } as const;
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

function ModuleCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={to}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-orange-300 hover:shadow-md"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{desc}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-orange-600">
        Ouvrir <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-600">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
