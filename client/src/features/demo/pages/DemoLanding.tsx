import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  HandCoins,
  Handshake,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Landing page publique indexable pour /demo.
 * - SEO friendly : titre, meta description, JSON-LD
 * - Explique la valeur de la démo sans rien casser de la prod
 */
export default function DemoLanding() {
  useEffect(() => {
    document.title = "Démo interactive — Ftour Bab Rayan";

    const metaDesc = ensureMeta("name", "description");
    metaDesc.setAttribute(
      "content",
      "Explorez librement la plateforme Ftour Bab Rayan en mode démo : dashboard, dons, bénévoles, ftours et partenaires — avec des données 100% fictives.",
    );

    const ogTitle = ensureMeta("property", "og:title");
    ogTitle.setAttribute("content", "Démo interactive — Ftour Bab Rayan");

    const ogDesc = ensureMeta("property", "og:description");
    ogDesc.setAttribute(
      "content",
      "Testez toutes les fonctionnalités sans inscription. Aucune donnée réelle, aucun risque.",
    );

    const robots = ensureMeta("name", "robots");
    robots.setAttribute("content", "index,follow");

    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.setAttribute("data-demo-jsonld", "1");
    jsonLd.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Ftour Bab Rayan — Demo",
      applicationCategory: "NonprofitApplication",
      operatingSystem: "Web",
      url: "https://www.ftourbabrayan.ma/demo",
      description:
        "Version de démonstration simulée de la plateforme Ftour Bab Rayan avec données fictives.",
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              Sandbox public · Aucune donnée réelle
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Explorez Ftour Bab Rayan{" "}
              <span className="text-orange-600">comme si c'était réel.</span>
            </h1>
            <p className="mt-4 text-base text-slate-600 sm:text-lg">
              Une démonstration interactive complète du système associatif — dashboard,
              dons, bénévoles, ftours et partenaires — entièrement simulée côté navigateur.
              Aucun compte, aucun risque, aucun lien avec nos données de production.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/demo/dashboard">
                <Button size="lg" className="bg-orange-600 text-white hover:bg-orange-700">
                  Lancer la démo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo/dons">
                <Button variant="outline" size="lg">
                  Voir les dons simulés
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Sandbox total · Stockage local · Aucune API serveur appelée
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-orange-200/50 to-amber-100/40 blur-2xl" />
            <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Aperçu
                  </div>
                  <div className="text-base font-semibold text-slate-900">Impact cumulé</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live simulé
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
          <h2 id="modules-heading" className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Tout le système est accessible librement
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600">
            5 modules clés, entièrement simulés. Modifiez, ajoutez, réinitialisez à volonté.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              to="/demo/dashboard"
              icon={BarChart3}
              title="Tableau de bord"
              desc="KPI fictifs, graphiques interactifs et activité live simulée."
            />
            <ModuleCard
              to="/demo/utilisateurs"
              icon={Users}
              title="Utilisateurs"
              desc="Bénévoles, bénéficiaires et donateurs avec fiches éditables."
            />
            <ModuleCard
              to="/demo/dons"
              icon={HandCoins}
              title="Dons"
              desc="Historique complet, charts Recharts et ajout de faux dons."
            />
            <ModuleCard
              to="/demo/ftour"
              icon={UtensilsCrossed}
              title="Ftour"
              desc="Planning des repas, menus et statistiques journalières."
            />
            <ModuleCard
              to="/demo/partenaires"
              icon={Handshake}
              title="Partenaires"
              desc="Entreprises fictives, paliers et contributions simulées."
            />
            <ModuleCard
              to="/demo/dashboard"
              icon={ShieldCheck}
              title="Sandbox"
              desc="Reset et régénération des données en un clic."
            />
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
          <div className="grid gap-8 md:grid-cols-3">
            <Principle
              title="100% simulé"
              body="Toutes les données sont générées aléatoirement et stockées uniquement dans votre navigateur (localStorage)."
            />
            <Principle
              title="Zéro risque"
              body="Aucune API réelle n'est appelée. Aucune écriture serveur. Idéal pour démonstrations commerciales et partenaires."
            />
            <Principle
              title="Reset à volonté"
              body="« Générer de nouvelles données » ou « Reset démo » à tout moment depuis n'importe quelle page."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:flex-row lg:px-10">
          <span>© Ftour Bab Rayan — Espace de démonstration</span>
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
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</div>
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
