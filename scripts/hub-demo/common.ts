/** Shared helpers and the ten fictional volunteers, used by the Fil/Marketplace (build.ts), Hébergement (stay.ts) and Pro (pro.ts) demo seeds. */
export const DEMO_DOMAIN = "demo.ftour.invalid";

/**
 * Marqueur apposé sur tout contenu de démonstration (profils, publications, annonces) : personne ne
 * doit pouvoir confondre ces données avec de vrais bénévoles ou de vraies annonces.
 */
export const DEMO_LABEL = "🧪 Profil test";
export const demoText = (s: string) => `${DEMO_LABEL} — ${s}`;

export const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
export const ago = (minutes: number) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${Math.max(0, Math.round(minutes))} minutes')`;
/** Calendar date (YYYY-MM-DD) relative to today, e.g. inDays(3) / inDays(-20). */
export const inDays = (days: number) => `date('now','${days >= 0 ? "+" : "-"}${Math.abs(days)} days')`;
/** Illustrated avatar (media/avatar-<key>.png), key relative to the hub bucket like every other media key. */
export const avatarKey = (key: string) => `demo/avatar-${key}.png`;
export const mail = (key: string) => `${key}@${DEMO_DOMAIN}`;
export const mid = (key: string) => `(SELECT id FROM hub_members WHERE email = ${q(mail(key))})`;
export const H = 60;

export interface Person { key: string; first: string; last: string; city: string; bio: string; role?: "moderator" }
export const PEOPLE: Person[] = [
  { key: "yasmine", first: "Yasmine", last: "Alaoui", city: "Casablanca", bio: "Bénévole depuis 3 ans, à l'accueil et à la déco." },
  { key: "karim", first: "Karim", last: "Benjelloun", city: "Rabat", bio: "Accueil des familles. Toujours partant pour un coup de main." },
  { key: "salma", first: "Salma", last: "Idrissi", city: "Casablanca", bio: "Coordinatrice bénévole et modératrice de l'espace.", role: "moderator" },
  { key: "omar", first: "Omar", last: "Tazi", city: "Casablanca", bio: "Service et distribution. Fan de dattes." },
  { key: "nadia", first: "Nadia", last: "El Fassi", city: "Marrakech", bio: "Cuisine et pâtisserie. Je suis là surtout les week-ends." },
  { key: "mehdi", first: "Mehdi", last: "Bennani", city: "Casablanca", bio: "Étudiant en ingénierie, renfort logistique." },
  { key: "imane", first: "Imane", last: "Cherkaoui", city: "Mohammedia", bio: "Nouvelle bénévole, ravie d'être là." },
  { key: "reda", first: "Reda", last: "Lahlou", city: "Casablanca", bio: "Livraison et rangement. J'ai une voiture, je covoiture." },
  { key: "hajar", first: "Hajar", last: "Berrada", city: "Fès", bio: "Organisation des équipes et du planning." },
  { key: "anas", first: "Anas", last: "Squalli", city: "Casablanca", bio: "Lycéen motivé, je donne un coup de main où il faut." },
];

/** +2120… : the 0 after the country code means this can never be a real number. */
export const phoneOf = (key: string) => `+2120000000${String(PEOPLE.findIndex(p => p.key === key) + 1).padStart(2, "0")}`;

/** Conversation message: [sender (a = first role, b = second role), minutes ago, text, read]. */
export type Msg = [string, number, string, boolean];

export const D = `(SELECT id FROM hub_members WHERE email LIKE '%@${DEMO_DOMAIN}')`;
export const DOMAIN_LIKE = `'%@${DEMO_DOMAIN}'`;
