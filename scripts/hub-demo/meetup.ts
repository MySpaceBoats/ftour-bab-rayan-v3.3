/**
 * Demo data for the Meetup tab (mt_* tables): outings, events and gatherings between volunteers in Morocco and
 * abroad. Dates are relative to the day the seed runs (past ones are finished, the others are upcoming), and the set
 * covers every state of the tab: finished, full with a waiting list, cancelled, hidden by the moderation.
 */
import { D, ago, demoText, mid, q, wall } from "./common";

type Category = "sortie" | "evenement" | "rencontre" | "autre";
interface Meetup {
  key: string; org: string; title: string; category: Category; country: string; city: string; place: string;
  /** [days from today, "HH:MM"] local to the place */
  start: [number, string]; end: [number, string]; capacity: number; ageDays: number;
  photo?: string; status?: "cancelled" | "hidden"; description: string;
  going: string[]; waitlist?: string[];
}

const MEETUPS: Meetup[] = [
  { key: "ourika", org: "nadia", title: "Randonnée dans la vallée de l'Ourika", category: "sortie", country: "Maroc", city: "Marrakech", place: "Parking du village de Setti Fatma", start: [-12, "08:30"], end: [-12, "17:00"], capacity: 12, ageDays: 30, photo: "meetup-randonnee-ourika.jpg",
    description: "Journée de marche douce le long de la rivière, avec pique-nique au bord des cascades. Environ 3 heures de marche au total, chaussures de sport conseillées. Co-voiturage depuis Marrakech possible, dites-le dans les commentaires du fil.",
    going: ["omar", "hajar", "mehdi", "reda", "imane", "yasmine", "karim"] },
  { key: "cafe-bilan", org: "salma", title: "Café de retrouvailles et bilan de la saison", category: "rencontre", country: "Maroc", city: "Casablanca", place: "Café des Arcades, boulevard d'Anfa", start: [-6, "16:00"], end: [-6, "19:00"], capacity: 20, ageDays: 18, photo: "meetup-cafe-casablanca.jpg",
    description: "On se retrouve autour d'un thé pour faire le bilan de la saison, partager nos meilleurs souvenirs et recueillir vos idées pour l'an prochain. Aucune obligation de prendre la parole, venez simplement discuter.",
    going: ["yasmine", "karim", "omar", "nadia", "mehdi", "imane", "reda", "hajar"] },
  { key: "foot", org: "karim", title: "Tournoi de foot entre bénévoles", category: "evenement", country: "Maroc", city: "Rabat", place: "Terrain de proximité, quartier Agdal", start: [-20, "18:00"], end: [-20, "20:30"], capacity: 10, ageDays: 40, photo: "meetup-foot-rabat.jpg",
    description: "Mini-tournoi amical à cinq contre cinq, ambiance détente. Les équipes sont tirées au sort sur place, apportez des baskets et une bouteille d'eau. Un goûter est prévu pour tout le monde à la fin.",
    going: ["yasmine", "salma", "omar", "nadia", "mehdi", "imane", "reda", "hajar", "anas"] },
  { key: "paris", org: "mehdi", title: "Petit-déjeuner marocain des bénévoles à Paris", category: "rencontre", country: "France", city: "Paris", place: "Salon de thé La Menthe Fraîche, rue Oberkampf", start: [7, "10:00"], end: [7, "12:30"], capacity: 10, ageDays: 6, photo: "meetup-petit-dej-paris.jpg",
    description: "Pour les bénévoles qui vivent ou passent par Paris : msemen, baghrir et thé à la menthe pour retrouver l'esprit de l'équipe à distance. Venez avec vos idées pour rester en lien toute l'année.",
    going: ["yasmine", "karim", "salma", "nadia"] },
  { key: "atelier-cuisine", org: "nadia", title: "Atelier cuisine : msemen et tajine pour tous", category: "evenement", country: "Maroc", city: "Marrakech", place: "Dar Nadia, quartier Guéliz", start: [4, "15:00"], end: [4, "18:30"], capacity: 6, ageDays: 9, photo: "meetup-atelier-cuisine.jpg",
    description: "On prépare ensemble des msemen puis un tajine de poulet aux olives, et on déguste à la fin. Tous niveaux, tablier fourni. Très demandé : si l'atelier est complet, inscrivez-vous sur la liste d'attente, les places libérées sont attribuées dans l'ordre.",
    going: ["omar", "hajar", "yasmine", "karim", "imane", "anas"], waitlist: ["mehdi", "reda", "salma"] },
  { key: "plage", org: "omar", title: "Nettoyage de plage à Aïn Diab", category: "evenement", country: "Maroc", city: "Casablanca", place: "Plage d'Aïn Diab, devant la Corniche", start: [9, "09:00"], end: [9, "12:30"], capacity: 40, ageDays: 5, photo: "meetup-plage-propre.jpg",
    description: "Matinée citoyenne pour ramasser les déchets sur la plage, gants et sacs fournis. On termine par un petit-déjeuner partagé. Venez en famille, les enfants sont les bienvenus.",
    going: ["nadia", "mehdi", "imane", "reda", "yasmine", "karim", "hajar"] },
  { key: "bruxelles", org: "yasmine", title: "Soirée jeux de société et thé à la menthe", category: "rencontre", country: "Belgique", city: "Bruxelles", place: "Maison de quartier d'Ixelles, salle polyvalente", start: [6, "19:30"], end: [6, "23:00"], capacity: 12, ageDays: 8, photo: "meetup-jeux-bruxelles.jpg",
    description: "Une soirée détendue entre bénévoles de la diaspora autour de jeux de société, de thé et de gâteaux. Apportez votre jeu préféré si vous en avez un. Entrée libre dans la limite des places.",
    going: ["karim", "salma", "omar", "nadia", "reda"] },
  { key: "lyon", org: "reda", title: "Brunch de rentrée des bénévoles à Lyon", category: "rencontre", country: "France", city: "Lyon", place: "Péniche Le Bahut, quai Saint-Antoine", start: [14, "11:00"], end: [14, "14:30"], capacity: 15, ageDays: 4,
    description: "Brunch convivial pour se retrouver à la rentrée et accueillir les nouveaux. Chacun apporte un plat à partager, salé ou sucré. On prévoit quelques options sans gluten.",
    going: ["hajar", "omar", "imane"] },
  { key: "medina-fes", org: "hajar", title: "Marche et photos dans la médina de Fès", category: "sortie", country: "Maroc", city: "Fès", place: "Rendez-vous à Bab Boujloud", start: [11, "09:30"], end: [11, "13:00"], capacity: 10, ageDays: 7, photo: "meetup-medina-fes.jpg",
    description: "Balade guidée par des habitués dans les ruelles de la médina, avec des arrêts photo et une pause thé. Prévoyez des chaussures confortables et un petit budget pour les achats.",
    going: ["nadia", "mehdi", "yasmine", "imane", "salma"] },
  { key: "montreal", org: "imane", title: "Rencontre des bénévoles de la diaspora à Montréal", category: "rencontre", country: "Canada", city: "Montréal", place: "Café Atlas, Plateau-Mont-Royal", start: [18, "14:00"], end: [18, "17:00"], capacity: 25, ageDays: 3, photo: "meetup-diaspora-montreal.jpg",
    description: "Premier rendez-vous des bénévoles installés au Canada ou de passage : on fait connaissance, on parle de nos souvenirs de la saison et de comment aider à distance. Boissons chaudes sur place.",
    going: ["karim", "salma"] },
  { key: "velo", org: "karim", title: "Sortie vélo sur la corniche de Rabat", category: "sortie", country: "Maroc", city: "Rabat", place: "Plage de Rabat, esplanade", start: [3, "08:00"], end: [3, "11:00"], capacity: 15, ageDays: 10, photo: "meetup-velo-corniche.jpg", status: "cancelled",
    description: "Balade à vélo tranquille le long de la corniche, environ 15 km aller-retour. Annulée : une alerte météo annonce du vent fort et de la pluie ce jour-là. Nous proposerons une nouvelle date bientôt.",
    going: ["omar", "mehdi"] },
  { key: "spam", org: "anas", title: "Gagnez 5000 DH par jour : réunion d'information", category: "autre", country: "Maroc", city: "Casablanca", place: "Lieu communiqué en privé", start: [5, "20:00"], end: [5, "21:00"], capacity: 50, ageDays: 2, status: "hidden",
    description: "Réunion pour présenter une opportunité de revenus rapides. Aucune expérience demandée, écrivez-moi en privé pour avoir l'adresse.",
    going: [] },
];

/** Image files used as meetup covers (scripts/hub-demo/media/), for the existence check in the tests. */
export const MEETUP_MEDIA: string[] = MEETUPS.flatMap(m => (m.photo ? [m.photo] : []));

/** The person running the demo: [meetup key, status]. Waits for a seat at the full workshop, joined two others. */
const ME_JOINS: [string, "going" | "waitlist"][] = [["atelier-cuisine", "waitlist"], ["plage", "going"], ["cafe-bilan", "going"]];

const DM = `(SELECT id FROM mt_meetups WHERE member_id IN ${D})`;

export function meetupCleanup(): string[] {
  return [
    `DELETE FROM mt_participants WHERE member_id IN ${D} OR meetup_id IN ${DM};`,
    `DELETE FROM mt_meetups WHERE member_id IN ${D};`,
  ];
}

const meetupRef = (m: Meetup) => `(SELECT id FROM mt_meetups WHERE member_id = ${mid(m.org)} AND title = ${q(m.title)})`;
const DAY = 24 * 60;

/** @param meId SQL expression resolving the real member who should also appear in a few meetups (optional) */
export function meetupSeed(meId?: string): string[] {
  const out: string[] = [];
  for (const m of MEETUPS) {
    const cancelledAt = m.status === "cancelled" ? ago(m.ageDays * DAY - 2 * DAY) : "NULL";
    out.push(
      `INSERT INTO mt_meetups (member_id, title, category, description, country, city, place, starts_at, ends_at, capacity, photo_key, status, cancelled_at, created_at, updated_at) VALUES (${mid(m.org)}, ${q(m.title)}, ${q(m.category)}, ${q(demoText(m.description))}, ${q(m.country)}, ${q(m.city)}, ${q(m.place)}, ${wall(...m.start)}, ${wall(...m.end)}, ${m.capacity}, ${m.photo ? q(`demo/${m.photo}`) : "NULL"}, ${q(m.status ?? "active")}, ${cancelledAt}, ${ago(m.ageDays * DAY)}, ${ago(m.ageDays * DAY)});`,
    );
  }
  // sign-ups in arrival order (the id is the waiting-list order), spread over the days after the meetup was created
  for (const m of MEETUPS) {
    const rows: [string, "going" | "waitlist"][] = [...m.going.map(k => [k, "going"] as [string, "going"]), ...(m.waitlist ?? []).map(k => [k, "waitlist"] as [string, "waitlist"])];
    rows.forEach(([who, status], i) => {
      out.push(
        `INSERT INTO mt_participants (meetup_id, member_id, status, created_at) SELECT ${meetupRef(m)}, ${mid(who)}, ${q(status)}, ${ago(Math.max(60, m.ageDays * DAY - (i + 1) * 90))} WHERE ${meetupRef(m)} IS NOT NULL;`,
      );
    });
  }
  if (meId) {
    for (const [key, status] of ME_JOINS) {
      const m = MEETUPS.find(x => x.key === key)!;
      out.push(
        `INSERT INTO mt_participants (meetup_id, member_id, status, created_at) SELECT ${meetupRef(m)}, ${meId}, ${q(status)}, ${ago(120)} WHERE ${meId} IS NOT NULL AND ${meetupRef(m)} IS NOT NULL;`,
      );
    }
  }
  return out;
}
