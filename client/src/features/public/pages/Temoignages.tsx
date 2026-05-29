import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Quote, Star, MapPin, Heart, PenSquare } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";

// ============================================
// DONNÉES — Témoignages (public marocain & européen)
// ============================================

type Temoignage = {
  id: number;
  nom: string;
  role: string;
  ville: string;
  pays: string;
  drapeau: string;
  contenu: string;
  citation: string;
  note: number;
  categorie: "benevole" | "participant" | "diaspora" | "partenaire";
  edition: string;
  likes: number;
};

const TEMOIGNAGES: Temoignage[] = [
  {
    id: 1,
    nom: "Khadija Benali",
    role: "Bénévole depuis 3 éditions",
    ville: "Casablanca",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "benevole",
    edition: "Édition 12",
    note: 5,
    likes: 47,
    citation: "C'est bien plus qu'un ftour, c'est une école de vie.",
    contenu:
      "Je participe au Ftour Bab Rayan depuis la 10ème édition et chaque année c'est une expérience qui me transforme profondément. Voir autant de familles réunies autour d'une même table, sans distinction de classe sociale, c'est quelque chose que peu d'événements en ville arrivent à offrir. En tant que bénévole au service, j'ai appris la patience, l'humilité et surtout la joie de donner sans attendre de retour. Cette édition 12 était encore plus belle que les précédentes — l'organisation était irréprochable et l'ambiance vraiment familiale. Je reviendrai l'année prochaine, c'est certain.",
  },
  {
    id: 2,
    nom: "Mehdi Chraibi",
    role: "Participant avec sa famille",
    ville: "Rabat",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "participant",
    edition: "Édition 12",
    note: 5,
    likes: 63,
    citation: "Mes enfants ont compris ce soir-là ce que veut dire partager.",
    contenu:
      "Nous sommes venus pour la première fois cette année avec mes deux enfants de 8 et 11 ans. Je voulais leur montrer concrètement ce que signifie la solidarité durant le Ramadan, au-delà des discours. L'accueil chaleureux des bénévoles, la qualité de la nourriture préparée avec amour, et surtout l'atmosphère de fraternité — tout cela les a marqués. Mon fils aîné m'a dit au retour : \"Papa, l'année prochaine je veux aider moi aussi.\" C'est la plus belle des leçons qu'il pouvait retenir.",
  },
  {
    id: 3,
    nom: "Yasmine El Mansouri",
    role: "Coordination logistique",
    ville: "Casablanca",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "benevole",
    edition: "Éditions 11 & 12",
    note: 5,
    likes: 38,
    citation: "On donne de notre temps, mais on reçoit tellement plus.",
    contenu:
      "Coordonner la logistique pour un ftour de cette envergure, c'est un défi de taille. Mais l'équipe Bab Rayan rend les choses tellement bien organisées que le stress se transforme vite en énergie collective. Ce que j'aime par-dessus tout, c'est la diversité des bénévoles : des jeunes étudiants, des professionnels, des retraités, tous unis pour le même objectif. L'édition 12 a accueilli des centaines de personnes dans une sérénité remarquable. Je suis fière de faire partie de cette aventure humaine extraordinaire.",
  },
  {
    id: 4,
    nom: "Sophie Renard",
    role: "Bénévole expatriée française",
    ville: "Casablanca",
    pays: "France",
    drapeau: "🇫🇷",
    categorie: "benevole",
    edition: "Édition 12",
    note: 5,
    likes: 71,
    citation: "J'ai compris ici ce que le mot 'iftar' signifie vraiment.",
    contenu:
      "Je vis à Casablanca depuis deux ans pour mon travail et j'avais entendu parler du Ftour Bab Rayan par des collègues. Honnêtement, je ne savais pas à quoi m'attendre. Mais dès les premières minutes, j'ai été enveloppée par une chaleur humaine que je n'oublierai pas de sitôt. Participer en tant que bénévole pour servir les plats m'a permis de vivre le Ramadan de l'intérieur, aux côtés de familles merveilleuses. C'est l'une des expériences les plus riches depuis mon arrivée au Maroc. Je reviens l'année prochaine, sans hésitation.",
  },
  {
    id: 5,
    nom: "Rachid Ouazzani",
    role: "Donateur de la diaspora",
    ville: "Lyon",
    pays: "France",
    drapeau: "🇫🇷",
    categorie: "diaspora",
    edition: "Éditions 10, 11 & 12",
    note: 5,
    likes: 84,
    citation: "Soutenir Bab Rayan depuis la France, c'est rester connecté à mes racines.",
    contenu:
      "Je suis originaire de Casablanca et je vis en France depuis plus de 20 ans. Chaque année pendant le Ramadan, je me sens loin de chez moi. Mais grâce à Bab Rayan, j'ai trouvé un moyen concret de contribuer depuis la diaspora. Je soutiens financièrement le projet depuis trois éditions, et les retours que j'ai de ma famille restée à Casablanca sont toujours touchants. L'association est transparente, rigoureuse, et l'impact est réel. C'est une façon pour moi de garder le lien avec ma culture et de transmettre quelque chose d'important à mes enfants nés ici.",
  },
  {
    id: 6,
    nom: "Imane Tazi",
    role: "Étudiante bénévole",
    ville: "Casablanca",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "benevole",
    edition: "Édition 12",
    note: 5,
    likes: 56,
    citation: "Mon premier ftour bénévole — une nuit que je n'oublierai jamais.",
    contenu:
      "Je suis en 2ème année à l'école d'ingénieurs et une amie m'a convaincue de m'inscrire. J'avoue avoir hésité au départ, craignant de ne pas être à la hauteur. Mais dès l'arrivée sur place, j'ai été prise en charge par une équipe bienveillante qui m'a expliqué tout avec patience. Ce soir-là, à servir les assiettes sous les étoiles de la médina, j'ai ressenti quelque chose de très fort — une connexion humaine rare. J'ai rencontré des gens incroyables, bénévoles comme convives. Le Ramadan prend un tout autre sens quand on le vit de cette façon.",
  },
  {
    id: 7,
    nom: "Thomas Dubois",
    role: "Journaliste, couverture presse",
    ville: "Paris",
    pays: "France",
    drapeau: "🇫🇷",
    categorie: "participant",
    edition: "Édition 12",
    note: 5,
    likes: 92,
    citation: "Le Ftour Bab Rayan, c'est la solidarité au sens le plus noble du terme.",
    contenu:
      "Je suis venu couvrir le Ftour Bab Rayan pour un reportage sur la solidarité en période de Ramadan. Ce que j'ai découvert a largement dépassé mes attentes journalistiques. L'organisation est d'une précision remarquable pour un événement de cette ampleur. Mais surtout, l'humanité qui s'en dégage est palpable. Des bénévoles qui donnent de leur énergie sans compter, des familles qui rompent le jeûne ensemble, des sourires sincères à chaque table. J'ai posé mon carnet plusieurs fois pour simplement vivre le moment. Un événement qui redonne foi en la capacité des gens à se retrouver.",
  },
  {
    id: 8,
    nom: "Fatima-Zahra Alaoui",
    role: "Équipe de cuisine — 4 éditions",
    ville: "Casablanca",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "benevole",
    edition: "Éditions 9 à 12",
    note: 5,
    likes: 119,
    citation: "Préparer ces plats pour des centaines de personnes, c'est ma façon de prier.",
    contenu:
      "Je suis dans l'équipe cuisine depuis la 9ème édition. On commence à préparer bien avant le ftour et on termine bien après — les jambes fatiguées mais le cœur plein. Il y a quelque chose de profondément spirituel à préparer ces mets traditionnels — la harira, les chebakia, les dattes — sachant qu'ils vont nourrir des centaines de personnes qui attendent de rompre le jeûne. Les regards reconnaissants des convives valent mille fois plus que n'importe quel remerciement. C'est une tradition que je porterai encore longtemps.",
  },
  {
    id: 9,
    nom: "Nadia Berrada",
    role: "Participante venue de Bruxelles",
    ville: "Bruxelles",
    pays: "Belgique",
    drapeau: "🇧🇪",
    categorie: "diaspora",
    edition: "Édition 12",
    note: 5,
    likes: 78,
    citation: "Je suis rentrée au pays pour ce Ramadan — Bab Rayan en était le temps fort.",
    contenu:
      "J'habite à Bruxelles depuis 15 ans mais je reviens toujours au Maroc pour le Ramadan. Cette année, ma cousine m'a emmené au Ftour Bab Rayan et ce fut une révélation. La générosité de l'association, la qualité de l'accueil, la beauté du cadre — tout était magnifique. Être assise à cette grande table partagée avec des inconnus qui sont devenus, le temps d'un ftour, presque de la famille : c'est une expérience unique. J'ai réalisé à quel point la solidarité du Ramadan peut prendre des formes aussi belles et concrètes. Merci Bab Rayan.",
  },
  {
    id: 10,
    nom: "Amine Haddad",
    role: "Bénéficiaire devenu bénévole",
    ville: "Casablanca",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "benevole",
    edition: "Éditions 8 à 12",
    note: 5,
    likes: 143,
    citation: "J'ai d'abord reçu, aujourd'hui je donne — c'est le plus beau chemin.",
    contenu:
      "Il y a quelques années, j'étais dans une période difficile de ma vie et j'avais rompu le jeûne ici grâce à la générosité de l'association. Aujourd'hui, la situation a changé et j'ai voulu rendre ce que j'avais reçu. Je suis bénévole depuis 5 éditions maintenant. Bab Rayan ne m'a pas seulement nourri un soir de Ramadan — elle m'a donné un exemple de ce que la solidarité peut être. Je veux que d'autres vivent cette même expérience. C'est pourquoi je reviens, et c'est pourquoi je parle de cette association à tous ceux que je connais.",
  },
  {
    id: 11,
    nom: "Laura Müller",
    role: "Étudiante en échange universitaire",
    ville: "Casablanca",
    pays: "Allemagne",
    drapeau: "🇩🇪",
    categorie: "participant",
    edition: "Édition 12",
    note: 5,
    likes: 67,
    citation: "Aucun livre ne m'a appris autant sur le Ramadan que cette soirée.",
    contenu:
      "Je fais un semestre d'études à Casablanca et une camarade marocaine m'a invitée au Ftour Bab Rayan. Je ne savais pas grand-chose du Ramadan avant cette soirée. Ce que j'y ai découvert — la signification du jeûne, la joie de la rupture collective, la fraternité entre des inconnus — m'a profondément touché. L'équipe bénévole était si attentionnée et désireuse de partager leur culture. Je suis rentrée dans ma chambre ce soir-là avec le sentiment d'avoir vécu quelque chose de vraiment important. C'est le meilleur souvenir de mon séjour au Maroc.",
  },
  {
    id: 12,
    nom: "Omar Benchekroun",
    role: "Partenaire & sponsor local",
    ville: "Casablanca",
    pays: "Maroc",
    drapeau: "🇲🇦",
    categorie: "partenaire",
    edition: "Éditions 11 & 12",
    note: 5,
    likes: 51,
    citation: "Investir dans Bab Rayan, c'est investir dans le lien social de notre ville.",
    contenu:
      "En tant qu'entrepreneur casablancais, j'ai voulu que mon entreprise s'engage concrètement dans la vie sociale de la ville, surtout pendant le Ramadan. Bab Rayan s'est imposée comme le partenaire évident : sérieux, transparent, et avec un impact mesurable et réel. La 12ème édition était un succès remarquable. Voir les familles, les bénévoles, les donateurs tous réunis autour de cette même cause, c'est exactement ce dont notre société a besoin. Je suis fier de soutenir cette initiative et je l'encourage à toutes les entreprises de la région.",
  },
];

// ============================================
// CONSTANTES UI
// ============================================

const CATEGORIE_LABELS: Record<Temoignage["categorie"], string> = {
  benevole: "Bénévole",
  participant: "Participant",
  diaspora: "Diaspora",
  partenaire: "Partenaire",
};

const CATEGORIE_COLORS: Record<Temoignage["categorie"], string> = {
  benevole: "bg-emerald-100 text-emerald-800",
  participant: "bg-blue-100 text-blue-800",
  diaspora: "bg-violet-100 text-violet-800",
  partenaire: "bg-amber-100 text-amber-800",
};

// ============================================
// SOUS-COMPOSANTS
// ============================================

function StarRating({ note }: { note: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Note : ${note} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < note ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function TemoignageCard({ t }: { t: Temoignage }) {
  const initials = t.nom
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-amber-50 flex flex-col gap-4 p-6 hover:shadow-md transition-shadow duration-300 h-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-tight truncate">{t.nom}</p>
          <p className="text-sm text-gray-500 leading-tight">{t.role}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>
              {t.drapeau} {t.ville}, {t.pays}
            </span>
          </div>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${CATEGORIE_COLORS[t.categorie]}`}
        >
          {CATEGORIE_LABELS[t.categorie]}
        </span>
      </div>

      {/* Citation */}
      <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-4 py-3">
        <Quote className="w-4 h-4 text-amber-500 mb-1" />
        <p className="text-amber-900 font-semibold italic text-sm leading-snug">
          {t.citation}
        </p>
      </div>

      {/* Contenu */}
      <p className="text-gray-700 text-sm leading-relaxed flex-1">{t.contenu}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
        <StarRating note={t.note} />
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {t.likes}
          </span>
          <span className="font-medium">{t.edition}</span>
        </div>
      </div>
    </article>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function Temoignages() {
  const { lang } = useI18n();

  const marocains = TEMOIGNAGES.filter(t => t.pays === "Maroc");
  const europeens = TEMOIGNAGES.filter(t => t.pays !== "Maroc");
  const benevoles = TEMOIGNAGES.filter(t => t.categorie === "benevole");
  const autres = TEMOIGNAGES.filter(t => t.categorie !== "benevole");
  const pays = new Set(TEMOIGNAGES.map(t => t.pays)).size;

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/30">
      <Navbar />

      <main className="flex-1">
        {/* ============================
            HERO
        ============================ */}
        <section className="relative bg-gradient-to-b from-amber-900 to-amber-700 text-white py-20 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
          <div className="relative max-w-3xl mx-auto">
            <p className="text-amber-200 text-sm font-medium uppercase tracking-widest mb-4">
              Voix du Ftour
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Ils ont vécu<br />
              <span className="text-amber-300">le Ftour Bab Rayan</span>
            </h1>
            <p className="text-amber-100 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              Des témoignages authentiques de bénévoles, participants et donateurs — du Maroc et d'Europe — qui ont partagé cette expérience humaine unique.
            </p>
            <Link href={`/${lang}/blog/nouveau`}>
              <button className="inline-flex items-center gap-2 bg-white text-amber-800 hover:bg-amber-50 font-semibold px-6 py-3 rounded-full shadow transition-colors duration-200">
                <PenSquare className="w-4 h-4" />
                Partager mon témoignage
              </button>
            </Link>
          </div>

          {/* Stats */}
          <div className="relative mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { label: "Témoignages", value: `${TEMOIGNAGES.length}` },
              { label: "Pays représentés", value: `${pays}` },
              { label: "Bénévoles", value: `${benevoles.length}` },
              { label: "Note moyenne", value: "★ 5/5" },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl py-4 px-3">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-amber-200 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================
            RÉPARTITION GÉOGRAPHIQUE
        ============================ */}
        <section className="max-w-6xl mx-auto px-4 pt-10 pb-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-amber-100 p-5 text-center shadow-sm">
              <p className="text-3xl font-bold text-amber-700">{marocains.length}</p>
              <p className="text-sm text-gray-500 mt-1">🇲🇦 Voix du Maroc</p>
            </div>
            <div className="bg-white rounded-2xl border border-violet-100 p-5 text-center shadow-sm">
              <p className="text-3xl font-bold text-violet-600">{europeens.length}</p>
              <p className="text-sm text-gray-500 mt-1">🇪🇺 Voix d'Europe</p>
            </div>
          </div>
        </section>

        {/* ============================
            BÉNÉVOLES
        ============================ */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="mb-7">
            <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
              Bénévoles
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              Ceux qui donnent de leur temps
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benevoles.map(t => (
              <TemoignageCard key={t.id} t={t} />
            ))}
          </div>
        </section>

        {/* ============================
            PARTICIPANTS · DIASPORA · PARTENAIRES
        ============================ */}
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <div className="mb-7">
            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
              Participants · Diaspora · Partenaires
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              Ceux qui ont vécu et soutenu l'aventure
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {autres.map(t => (
              <TemoignageCard key={t.id} t={t} />
            ))}
          </div>
        </section>

        {/* ============================
            CALL TO ACTION
        ============================ */}
        <section className="bg-gradient-to-r from-amber-700 to-amber-900 text-white py-14 px-4 text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Vous aussi, vous avez vécu le Ftour Bab Rayan ?
            </h2>
            <p className="text-amber-100 text-base mb-8 leading-relaxed">
              Partagez votre expérience et rejoignez la mémoire collective de notre communauté.
            </p>
            <Link href={`/${lang}/blog/nouveau`}>
              <button className="inline-flex items-center gap-2 bg-white text-amber-800 hover:bg-amber-50 font-semibold px-8 py-3 rounded-full shadow transition-colors duration-200">
                <PenSquare className="w-4 h-4" />
                Partager mon témoignage
              </button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
