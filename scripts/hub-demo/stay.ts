/**
 * Demo data for the Hébergement tab (st_* tables): rooms and beds offered between volunteers, stay requests in
 * every state, their conversations, and reviews. Dates are relative to the day the seed runs.
 */
import { D, ago, demoText, inDays, mid, phoneOf, q } from "./common";

interface StayListing {
  key: string; host: string; title: string; kind: string; city: string; area: string; capacity: number; rooms: number;
  priceType: "gratuit" | "participation" | "prix"; price: number; amenities: string[];
  from: number | null; to: number | null; status?: "paused"; whatsapp: boolean; ageDays: number; description: string; media: string[];
}
const STAYS: StayListing[] = [
  { key: "chambre-maarif", host: "yasmine", title: "Chambre calme près du Maârif", kind: "chambre", city: "Casablanca", area: "Maârif", capacity: 2, rooms: 1, priceType: "participation", price: 50, amenities: ["wifi", "cuisine", "salle_de_bain", "clim", "lessive"], from: null, to: 90, whatsapp: true, ageDays: 28,
    description: "Chambre claire dans mon appartement, à 10 minutes à pied de la salle où se tient le service. Lit double, bureau, ventilateur et clim. Je rentre tard les soirs de service, les horaires décalés ne dérangent donc personne. Participation de 50 MAD la nuit, thé et petit-déjeuner compris.", media: ["stay-chambre-maarif.jpg"] },
  { key: "canape-gauthier", host: "yasmine", title: "Canapé-lit de dépannage, Gauthier", kind: "canape", city: "Casablanca", area: "Gauthier", capacity: 1, rooms: 1, priceType: "gratuit", price: 0, amenities: ["wifi", "cuisine"], from: null, to: 60, whatsapp: false, ageDays: 20,
    description: "Pour dépanner une nuit ou deux si vous finissez tard ou venez de loin. Canapé-lit confortable dans le salon, accès à la cuisine et à la salle de bain. C'est gratuit, juste un coup de main au rangement du matin 😉", media: ["stay-canape-gauthier.jpg"] },
  { key: "studio-agdal", host: "karim", title: "Studio indépendant à Agdal", kind: "studio", city: "Rabat", area: "Agdal", capacity: 2, rooms: 1, priceType: "prix", price: 250, amenities: ["wifi", "cuisine", "salle_de_bain", "clim", "chauffage", "parking"], from: null, to: 120, whatsapp: false, ageDays: 35,
    description: "Studio meublé avec entrée indépendante, kitchenette équipée et salle d'eau privative. À 5 minutes à pied du tramway, parfait pour les déplacements à Rabat. Place de parking dans la cour. Linge de lit fourni, ménage fait avant chaque arrivée.", media: ["stay-studio-agdal.jpg"] },
  { key: "maison-gueliz", host: "nadia", title: "Maison familiale avec patio, Guéliz", kind: "maison", city: "Marrakech", area: "Guéliz", capacity: 6, rooms: 3, priceType: "participation", price: 80, amenities: ["wifi", "cuisine", "salle_de_bain", "clim", "famille_ok", "animaux_ok", "parking"], from: null, to: 100, whatsapp: true, ageDays: 45,
    description: "Maison de famille avec patio ombragé, trois chambres et une grande cuisine où l'on cuisine ensemble. Idéale pour une famille ou un petit groupe de bénévoles. Participation de 80 MAD par nuit, les enfants et les animaux sont les bienvenus. Je prépare le petit-déjeuner (msemen maison le week-end).", media: ["stay-maison-gueliz.jpg"] },
  { key: "tente-palmeraie", host: "nadia", title: "Tente berbère dans le jardin, Palmeraie", kind: "tente", city: "Marrakech", area: "Palmeraie", capacity: 4, rooms: 0, priceType: "gratuit", price: 0, amenities: ["famille_ok", "animaux_ok"], from: 10, to: 45, whatsapp: false, ageDays: 14,
    description: "Une grande tente berbère installée dans mon jardin, matelas et couvertures fournis. Sanitaires dans la maison, thé à la menthe offert. Une expérience simple pour qui aime dormir sous les étoiles. Gratuit, apportez simplement un bon sourire.", media: ["stay-tente-palmeraie.jpg"] },
  { key: "appart-fes", host: "hajar", title: "Appartement lumineux, Ville Nouvelle", kind: "appartement", city: "Fès", area: "Ville Nouvelle", capacity: 4, rooms: 2, priceType: "prix", price: 300, amenities: ["wifi", "cuisine", "salle_de_bain", "chauffage", "famille_ok", "lessive"], from: null, to: 120, whatsapp: true, ageDays: 70,
    description: "Appartement de deux chambres au 3e étage, proche du centre et de la médina (taxi petit en 10 minutes). Salon lumineux, cuisine équipée, chauffage pour les soirées fraîches. Je peux vous conseiller des adresses de confiance dans la médina.", media: ["stay-appart-fes.jpg"] },
  { key: "chambre-mohammedia", host: "imane", title: "Chambre simple chez ma famille, Mohammedia", kind: "chambre", city: "Mohammedia", area: "Centre", capacity: 2, rooms: 1, priceType: "gratuit", price: 0, amenities: ["wifi", "cuisine", "famille_ok", "lessive"], from: -2, to: 40, whatsapp: true, ageDays: 10,
    description: "Ma famille propose une chambre simple, à dix minutes à pied de la plage et de la gare. Repas partagés avec nous si vous le souhaitez (on rompt le jeûne tous ensemble). Gratuit : l'accueil fait partie de l'esprit du bénévolat.", media: ["stay-chambre-mohammedia.jpg"] },
  { key: "appart-oasis", host: "omar", title: "Appartement 2 pièces, quartier Oasis", kind: "appartement", city: "Casablanca", area: "Oasis", capacity: 3, rooms: 2, priceType: "prix", price: 350, amenities: ["wifi", "cuisine", "salle_de_bain", "clim", "parking", "accessible"], from: 0, to: 30, status: "paused", whatsapp: false, ageDays: 6,
    description: "Appartement de plain-pied avec accès sans marches, deux chambres et parking. L'annonce est en pause quelques jours pour cause de travaux de peinture, elle reviendra bientôt.", media: ["stay-appart-oasis.jpg"] },
];

/** Image files (scripts/hub-demo/media/): keys below must match generate-media.mjs. */
export const STAY_MEDIA: Record<string, string[]> = Object.fromEntries(STAYS.map(s => [s.key, s.media]));

type StayMsg = [string, number, string, boolean]; // [g = guest | h = host, hours after the request, text, read]
interface Req {
  key: string; listing: string; guest: string; start: number; end: number; guests: number; message: string;
  status: "pending" | "accepted" | "declined" | "cancelled"; reply?: string; createdH: number; msgs: StayMsg[];
  review?: { rating: number; body: string; daysAfter: number };
}
const REQS: Req[] = [
  { key: "mehdi-maarif", listing: "chambre-maarif", guest: "mehdi", start: -20, end: -17, guests: 1, createdH: 24 * 26,
    message: "Bonjour Yasmine, j'ai des examens à Casablanca et le service finit tard. Ta chambre serait parfaite pour 3 nuits.", status: "accepted",
    reply: "Avec plaisir ! La clé est chez la voisine si je ne suis pas là.",
    msgs: [["h", 2, "Bienvenue Mehdi ! Je finis à 23h30 les soirs de service, on peut rentrer ensemble.", true], ["g", 3, "Super, merci beaucoup !", true], ["h", 5, "Le Wi-Fi est dans le salon, le code est affiché sur le frigo.", true]],
    review: { rating: 5, body: "Chambre propre et calme, Yasmine est adorable. Rentrer à deux après le service, c'est bien plus agréable. Je recommande !", daysAfter: 1 } },
  { key: "reda-maarif", listing: "chambre-maarif", guest: "reda", start: -10, end: -8, guests: 1, createdH: 24 * 14,
    message: "Bonsoir, ma voiture est au garage et les transports de nuit sont rares après le service. Une chambre pour deux nuits, c'est possible ?", status: "accepted",
    reply: "Oui, pas de souci. Je te laisse le double des clés.",
    msgs: [["h", 1, "Aucun souci Reda, tu peux arriver dès 22h.", true], ["g", 2, "Merci, à jeudi alors.", true]],
    review: { rating: 4, body: "Très bon accueil. La chambre est petite mais très confortable, et le thé du matin fait vraiment plaisir.", daysAfter: 1 } },
  { key: "reda-agdal", listing: "studio-agdal", guest: "reda", start: -30, end: -27, guests: 1, createdH: 24 * 38,
    message: "Bonjour Karim, je viens à Rabat pour un rendez-vous administratif et je cherche un endroit calme pour trois nuits.", status: "accepted",
    reply: "Le studio est libre, bienvenue !",
    msgs: [["h", 1, "Je t'envoie l'adresse et le plan pour le tramway.", true], ["g", 2, "Parfait, merci. J'arrive vers 19h.", true]],
    review: { rating: 4, body: "Studio fonctionnel et très propre, bien situé. Le parking dans la cour est un vrai plus.", daysAfter: 2 } },
  { key: "salma-gueliz", listing: "maison-gueliz", guest: "salma", start: -40, end: -36, guests: 3, createdH: 24 * 50,
    message: "Bonjour Nadia, nous serions trois bénévoles à venir à Marrakech pour un salon professionnel de quatre jours.", status: "accepted",
    reply: "Avec grand plaisir, la maison est prête !",
    msgs: [["h", 2, "Je vous prépare trois chambres. Des allergies alimentaires à signaler ?", true], ["g", 3, "Non, rien de particulier. Merci pour l'accueil !", true], ["h", 5, "Alors rendez-vous à la maison, je vous attends avec le thé.", true]],
    review: { rating: 5, body: "Une maison magnifique et une hôtesse formidable. Le patio le soir, les msemen le matin... on a adoré. À refaire sans hésiter.", daysAfter: 1 } },
  { key: "omar-fes", listing: "appart-fes", guest: "omar", start: -25, end: -22, guests: 2, createdH: 24 * 32,
    message: "Bonjour Hajar, ma sœur et moi visitons Fès trois jours. Votre appartement est-il disponible ?", status: "accepted",
    reply: "Il est libre, je vous le réserve avec plaisir.",
    msgs: [["h", 2, "Je vous conseille de prendre un petit taxi depuis la gare, c'est à 10 minutes.", true], ["g", 4, "Merci, ça nous aide beaucoup !", true]],
    review: { rating: 5, body: "Appartement lumineux, bien équipé, et Hajar nous a donné de super adresses dans la médina.", daysAfter: 1 } },
  { key: "salma-fes", listing: "appart-fes", guest: "salma", start: -60, end: -57, guests: 1, createdH: 24 * 70,
    message: "Bonjour, je viens à Fès pour une formation de coordination. Trois nuits, seule. C'est possible ?", status: "accepted",
    reply: "Oui bien sûr, bienvenue.",
    msgs: [["h", 1, "Parfait, je vous laisse le code de la boîte à clés.", true]],
    review: { rating: 4, body: "Séjour calme et pratique, accueil chaleureux. Le chauffage m'a bien servi le soir.", daysAfter: 2 } },
  { key: "mehdi-agdal", listing: "studio-agdal", guest: "mehdi", start: 7, end: 10, guests: 1, createdH: 30, status: "pending",
    message: "Bonjour Karim, j'ai un entretien de stage à Rabat dans une semaine. Le studio sera-t-il libre ces trois nuits ?",
    msgs: [["g", 1, "Je peux arriver la veille de l'entretien si ça vous arrange.", true], ["h", 6, "Pas de souci, je vérifie mon agenda et je te confirme ce soir.", false]] },
  { key: "imane-tente", listing: "tente-palmeraie", guest: "imane", start: 14, end: 16, guests: 2, createdH: 24 * 4, status: "declined",
    message: "Bonjour Nadia, ma cousine et moi aimerions essayer la tente deux nuits. Est-elle libre ?",
    reply: "Désolée, la tente est réservée à un groupe ces dates. Regarde la maison, il reste de la place !",
    msgs: [["h", 5, "Désolée, je viens de recevoir une demande d'un groupe pour ces dates.", true], ["g", 6, "Pas de souci, merci d'avoir répondu vite !", true]] },
  { key: "anas-mohammedia", listing: "chambre-mohammedia", guest: "anas", start: 3, end: 5, guests: 1, createdH: 24 * 2, status: "accepted",
    message: "Bonjour, je participe à un tournoi de basket à Mohammedia le week-end prochain et je cherche un endroit pour dormir.",
    reply: "Bienvenue Anas ! Ma mère te prépare déjà la chambre.",
    msgs: [["h", 1, "Ma famille sera ravie de t'accueillir. Tu manges avec nous le soir ?", true], ["g", 3, "Avec plaisir, merci beaucoup !", true], ["h", 20, "On rompt vers 19h, viens avec ton sac de sport, on t'attend.", false], ["g", 22, "Ça marche, j'arrive vendredi en fin d'après-midi.", false]] },
  { key: "yasmine-fes", listing: "appart-fes", guest: "yasmine", start: 20, end: 23, guests: 2, createdH: 5, status: "pending",
    message: "Bonjour Hajar, je voudrais visiter Fès avec mon mari. L'appartement est-il libre à ces dates ?",
    msgs: [["g", 1, "Merci de me dire si vous avez un lit bébé, nous serons peut-être accompagnés de ma nièce.", false]] },
  { key: "karim-oasis", listing: "appart-oasis", guest: "karim", start: 10, end: 12, guests: 2, createdH: 24 * 3, status: "cancelled",
    message: "Bonjour Omar, deux nuits à Casablanca pour un mariage. L'appartement est-il adapté à deux personnes ?",
    msgs: [["h", 2, "Oui, mais l'annonce est mise en pause pour travaux, je préfère te prévenir.", true], ["g", 3, "Merci, j'ai trouvé un hôtel finalement. J'annule la demande.", true]] },
];

/** The person running the demo asks for a room: an accepted request with two unread answers. */
const ME_REQ: Req = {
  key: "me-maarif", listing: "chambre-maarif", guest: "", start: 4, end: 7, guests: 1, createdH: 26, status: "accepted",
  message: "Bonjour Yasmine, je cherche une chambre calme près du lieu du service pour trois nuits, à partir de jeudi. Est-ce libre ?",
  reply: "Avec plaisir, la chambre est libre ces dates.",
  msgs: [["h", 1, "Bonjour ! Je peux te laisser la clé chez la voisine si j'arrive après toi.", false], ["h", 3, "N'oublie pas ton badge, on part ensemble au service le premier soir.", false]],
};

const STAY_REPORT = { listing: "appart-oasis", reporter: "karim", reason: "Photos qui ne correspondent pas tout à fait au logement" };

const DSL = `(SELECT id FROM st_listings WHERE member_id IN ${D})`;
const DSR = `(SELECT id FROM st_requests WHERE guest_id IN ${D} OR host_id IN ${D} OR listing_id IN ${DSL})`;
const DSM = `(SELECT id FROM st_request_messages WHERE sender_id IN ${D} OR request_id IN ${DSR})`;

export function stayCleanup(): string[] {
  return [
    `DELETE FROM st_reports WHERE member_id IN ${D} OR (target_type = 'listing' AND target_id IN ${DSL}) OR (target_type = 'message' AND target_id IN ${DSM});`,
    `DELETE FROM st_reviews WHERE request_id IN ${DSR} OR author_id IN ${D} OR listing_id IN ${DSL};`,
    `DELETE FROM st_request_messages WHERE id IN ${DSM};`,
    `DELETE FROM st_requests WHERE id IN ${DSR};`,
    `DELETE FROM st_listing_media WHERE listing_id IN ${DSL};`,
    `DELETE FROM st_listings WHERE member_id IN ${D};`,
  ];
}

const stayRef = (key: string) => {
  const s = STAYS.find(x => x.key === key)!;
  return `(SELECT id FROM st_listings WHERE member_id = ${mid(s.host)} AND title = ${q(s.title)})`;
};

function pushRequest(out: string[], r: Req, guestExpr: string, guard: string) {
  const s = STAYS.find(x => x.key === r.listing)!;
  const created = r.createdH * 60;
  const lref = stayRef(r.listing);
  const decided = r.status === "pending" ? "NULL" : ago(created - 60);
  out.push(
    `INSERT INTO st_requests (listing_id, guest_id, host_id, start_date, end_date, guests, message, status, host_reply, created_at, updated_at, decided_at) SELECT ${lref}, ${guestExpr}, ${mid(s.host)}, ${inDays(r.start)}, ${inDays(r.end)}, ${r.guests}, ${q(r.message)}, ${q(r.status)}, ${r.reply ? q(r.reply) : "NULL"}, ${ago(created)}, ${ago(created - 60)}, ${decided} WHERE ${guard};`,
  );
  const rref = `(SELECT id FROM st_requests WHERE listing_id = ${lref} AND guest_id = ${guestExpr})`;
  for (const [who, after, text, read] of r.msgs) {
    const at = created - after * 60;
    out.push(
      `INSERT INTO st_request_messages (request_id, sender_id, body, status, created_at, read_at) SELECT ${rref}, ${who === "g" ? guestExpr : mid(s.host)}, ${q(text)}, 'visible', ${ago(at)}, ${read ? ago(at - 10) : "NULL"} WHERE ${rref} IS NOT NULL;`,
    );
  }
  if (r.review) {
    const at = (-r.end - r.review.daysAfter) * 24 * 60;
    out.push(
      `INSERT INTO st_reviews (request_id, listing_id, author_id, rating, body, created_at) SELECT ${rref}, ${lref}, ${guestExpr}, ${r.review.rating}, ${q(r.review.body)}, ${ago(at)} WHERE ${rref} IS NOT NULL;`,
    );
  }
}

/** @param meId SQL expression resolving the real member who should also get a stay conversation (optional) */
export function staySeed(meId?: string): string[] {
  const out: string[] = [];
  for (const s of STAYS) {
    const created = s.ageDays * 24 * 60;
    out.push(
      `INSERT INTO st_listings (member_id, title, description, kind, city, area, capacity, rooms, price_type, price, amenities, available_from, available_to, status, contact_phone, contact_whatsapp, created_at, updated_at) VALUES (${mid(s.host)}, ${q(s.title)}, ${q(demoText(s.description))}, ${q(s.kind)}, ${q(s.city)}, ${q(s.area)}, ${s.capacity}, ${s.rooms}, ${q(s.priceType)}, ${s.price}, ${q(JSON.stringify(s.amenities))}, ${s.from === null ? "NULL" : inDays(s.from)}, ${s.to === null ? "NULL" : inDays(s.to)}, ${q(s.status ?? "active")}, ${q(phoneOf(s.host))}, ${s.whatsapp ? 1 : 0}, ${ago(created)}, ${ago(created)});`,
    );
  }
  for (const s of STAYS) s.media.forEach((f, i) => out.push(`INSERT INTO st_listing_media (listing_id, r2_key, position) VALUES (${stayRef(s.key)}, ${q(`demo/${f}`)}, ${i});`));
  for (const r of REQS) pushRequest(out, r, mid(r.guest), "1");
  if (meId) pushRequest(out, ME_REQ, meId, `${meId} IS NOT NULL`);
  out.push(`INSERT INTO st_reports (target_type, target_id, member_id, reason) VALUES ('listing', ${stayRef(STAY_REPORT.listing)}, ${mid(STAY_REPORT.reporter)}, ${q(STAY_REPORT.reason)});`);
  return out;
}
