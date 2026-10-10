/**
 * Demo data for the volunteer hub + marketplace: 10 fictional volunteers, a lively feed, listings,
 * comments, likes, reports and private conversations. Pure SQL builder (no I/O), tested in worker/hub-demo.test.ts.
 *
 * Every demo row hangs off an email @demo.ftour.invalid (an address that cannot receive mail), so cleanup is exact.
 * The seed starts with the cleanup, so it can be re-run safely.
 */
export const DEMO_DOMAIN = "demo.ftour.invalid";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const ago = (minutes: number) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${Math.max(0, Math.round(minutes))} minutes')`;
const mail = (key: string) => `${key}@${DEMO_DOMAIN}`;
const mid = (key: string) => `(SELECT id FROM hub_members WHERE email = ${q(mail(key))})`;
const H = 60;

interface Person { key: string; first: string; last: string; city: string; bio: string; role?: "moderator" }
const PEOPLE: Person[] = [
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

interface Post { a: string; min: number; body: string }
const POSTS: Post[] = [
  { a: "yasmine", min: 72 * H, body: "Premier soir de bénévolat hier, quelle ambiance ! 🌙 Merci à toute l'équipe de la cuisine, on a servi plus de 300 repas. Qui était là ?" },
  { a: "karim", min: 70 * H, body: "Présent hier à l'accueil. Les familles étaient tellement reconnaissantes. On remet ça samedi ? Je prends le créneau 17h-20h." },
  { a: "salma", min: 60 * H, body: "Rappel amical : arrivez 30 minutes avant votre créneau pour le briefing, et pensez à votre badge. Merci à tous ! 💙" },
  { a: "omar", min: 55 * H, body: "Quelqu'un a des idées pour mieux organiser la distribution des dattes ? On a perdu un peu de temps hier au service." },
  { a: "nadia", min: 50 * H, body: "On pourrait préparer les barquettes de dattes en amont, par lots de 50. Je peux m'en occuper avant l'ouverture." },
  { a: "mehdi", min: 40 * H, body: "On a besoin de renfort en cuisine jeudi soir, 2-3 personnes en plus. Qui est partant ?" },
  { a: "imane", min: 36 * H, body: "Première fois que je fais du bénévolat et j'adore. Merci pour votre accueil, vraiment 🥹" },
  { a: "reda", min: 30 * H, body: "Idée : un covoiturage entre bénévoles pour rentrer après le service ? Je passe par Maarif et Gauthier, 2 places libres." },
  { a: "hajar", min: 24 * H, body: "Merci à celles et ceux qui ont aidé à ranger hier soir. On a fini en 20 minutes grâce à vous ! 👏" },
  { a: "anas", min: 20 * H, body: "Question pratique : où peut-on laisser nos affaires pendant le service ? Il y a un vestiaire ?" },
  { a: "yasmine", min: 12 * H, body: "Je cherche des bénévoles pour la décoration de la salle vendredi après-midi, rien de compliqué. Dites-moi !" },
  { a: "karim", min: 8 * H, body: "Le bilan de ce week-end : 1 240 repas servis sur 4 jours. Bravo à tous ! 🎉" },
  { a: "anas", min: 6 * H, body: "Vends mon compte Netflix pas cher, écrivez-moi en privé 🔥🔥" },
  { a: "nadia", min: 3 * H, body: "Bonne nuit à tous, repos bien mérité. Demain on est de retour 💪" },
  { a: "hajar", min: 1 * H, body: "Nouveau : la marketplace est ouverte ! Si vous avez des objets à donner ou à vendre entre bénévoles, c'est par là 🛍️" },
];

/** [post index, author, minutes after the post, text] */
const POST_COMMENTS: [number, string, number, string][] = [
  [0, "karim", 30, "J'y étais ! Super ambiance en cuisine."],
  [0, "imane", 90, "Dommage, je serai là samedi."],
  [0, "omar", 140, "300 repas, on a battu notre record."],
  [1, "yasmine", 45, "Je prends 17h-20h aussi, on se voit là-bas."],
  [1, "mehdi", 200, "Samedi je suis en cuisine à partir de 16h."],
  [2, "reda", 20, "Bien reçu, merci Salma."],
  [2, "anas", 75, "Pour le badge, où est-ce qu'on le récupère ?"],
  [2, "salma", 100, "À l'accueil, demande-le à Karim."],
  [3, "nadia", 60, "Voir mon message plus bas : des lots de 50, ça va très vite."],
  [3, "hajar", 120, "Des lots de 50, c'est parfait."],
  [3, "omar", 180, "Merci Nadia, excellente idée !"],
  [5, "anas", 40, "Je suis partant pour jeudi."],
  [5, "imane", 55, "Moi aussi, à quelle heure ?"],
  [5, "mehdi", 70, "Dès 18h, merci à vous deux !"],
  [7, "salma", 25, "Super initiative Reda, je note !"],
  [7, "imane", 90, "Je vais vers Racine, ça pourrait m'arranger ✋"],
  [9, "salma", 30, "Oui, vestiaire à droite de l'entrée, fermé à clé."],
  [9, "anas", 50, "Parfait, merci !"],
  [10, "hajar", 35, "Je viens avec plaisir !"],
  [10, "nadia", 80, "Je peux apporter des guirlandes."],
  [11, "yasmine", 15, "Bravo à toute l'équipe !"],
  [11, "omar", 60, "Un mois de ça et on aura nourri une ville entière."],
  [14, "karim", 10, "Super idée, je vais en parler autour de moi."],
];

/** [post index, reporter, reason] — one harmless-looking spam post to show the moderation queue */
const POST_REPORT: [number, string, string] = [12, "salma", "Publicité sans rapport avec le bénévolat"];

/** Pinned announcements from the moderator: they fill the "Annonces de l'équipe" column. */
const ANNOUNCEMENTS: { a: string; min: number; body: string }[] = [
  { a: "salma", min: 64 * H, body: "Bienvenue dans l'espace bénévole 🌙 Ici vous trouverez les annonces de l'équipe, le fil des bénévoles et la marketplace. Présentez-vous en quelques mots, ça fait toujours plaisir aux nouveaux." },
  { a: "salma", min: 26 * H, body: "Rappel : le badge est obligatoire à l'entrée et les créneaux du week-end partent vite. Inscrivez-vous à l'avance depuis votre espace, et pensez à annuler si vous ne pouvez plus venir." },
];

interface Listing {
  key: string; seller: string; min: number; title: string; description: string; price: number;
  category: string; condition: string; city: string; phone: boolean; whatsapp: boolean; status?: "sold";
}
const LISTINGS: Listing[] = [
  { key: "velo", seller: "yasmine", min: 50 * H, title: "Vélo enfant 6-8 ans", description: "Vélo bleu avec petites roues amovibles, très bon état, révisé l'été dernier. À venir chercher à Casablanca.", price: 150, category: "enfants", condition: "bon", city: "Casablanca", phone: true, whatsapp: true },
  { key: "cafe", seller: "karim", min: 46 * H, title: "Machine à café à capsules", description: "Fonctionne parfaitement, détartrée récemment. Une trentaine de capsules incluses.", price: 300, category: "maison", condition: "bon", city: "Rabat", phone: true, whatsapp: false },
  { key: "livres", seller: "salma", min: 40 * H, title: "Lot de 12 livres de cuisine marocaine", description: "Tajines, pâtisseries, plats de fête. Quelques pages cornées mais tout est lisible.", price: 80, category: "livres", condition: "bon", city: "Casablanca", phone: true, whatsapp: true },
  { key: "poussette", seller: "omar", min: 38 * H, title: "Poussette Chicco", description: "Poussette pliable, légère, avec capote pluie. Quelques traces d'usure.", price: 400, category: "enfants", condition: "correct", city: "Casablanca", phone: false, whatsapp: false, status: "sold" },
  { key: "robe", seller: "nadia", min: 30 * H, title: "Robe de soirée taille 38, portée une fois", description: "Robe longue d'un créateur local, couleur émeraude. Je peux envoyer des photos.", price: 250, category: "mode", condition: "bon", city: "Marrakech", phone: true, whatsapp: true },
  { key: "casque", seller: "mehdi", min: 22 * H, title: "Casque audio Bluetooth neuf", description: "Cadeau reçu en double, jamais déballé, garantie 1 an.", price: 200, category: "high-tech", condition: "neuf", city: "Casablanca", phone: false, whatsapp: false },
  { key: "table", seller: "reda", min: 18 * H, title: "Table basse en bois à donner", description: "Je la donne gratuitement : il faut juste venir la chercher (2e étage sans ascenseur).", price: 0, category: "maison", condition: "correct", city: "Casablanca", phone: true, whatsapp: false },
  { key: "manuels", seller: "imane", min: 14 * H, title: "Manuels de lycée (maths et physique)", description: "Programme de 1ère année du bac, propres, sans annotations.", price: 60, category: "livres", condition: "bon", city: "Mohammedia", phone: false, whatsapp: false, status: "sold" },
  { key: "tapis", seller: "hajar", min: 9 * H, title: "Tapis berbère 2 x 3 m", description: "Tapis en laine tissé main, motifs géométriques. Très belle pièce.", price: 900, category: "maison", condition: "bon", city: "Fès", phone: true, whatsapp: true },
  { key: "iphone", seller: "anas", min: 5 * H, title: "iPhone 15 Pro NEUF 500 MAD !!!", description: "Urgent, contactez-moi.", price: 500, category: "high-tech", condition: "neuf", city: "Casablanca", phone: false, whatsapp: false },
];

/** [listing key, author, minutes after the listing, text] */
const LISTING_COMMENTS: [string, string, number, string][] = [
  ["velo", "karim", 60, "Il convient à quel âge exactement ? Mon neveu a 7 ans."],
  ["velo", "yasmine", 120, "Idéal pour 6-8 ans, avec les petites roues amovibles."],
  ["cafe", "mehdi", 90, "Combien de capsules incluses ?"],
  ["cafe", "karim", 150, "Une trentaine."],
  ["robe", "imane", 60, "Elle est de quelle marque ?"],
  ["robe", "nadia", 110, "Une créatrice locale, je peux envoyer des photos par WhatsApp."],
  ["table", "salma", 40, "Toujours dispo ? Je passe demain."],
  ["table", "reda", 70, "Oui, venez dans l'après-midi."],
  ["tapis", "omar", 50, "Belle pièce ! Dimensions exactes ?"],
  ["tapis", "hajar", 80, "2,10 x 3 m."],
  ["iphone", "salma", 30, "Ça sent l'arnaque, je signale."],
];

const LISTING_REPORT: [string, string, string] = ["iphone", "yasmine", "Prix irréaliste, probable arnaque"];

/** Conversations between demo members: [listing key, buyer, [sender role b|s, minutes ago, text, read]] */
type Msg = ["b" | "s", number, string, boolean];
const THREADS: [string, string, Msg[]][] = [
  ["velo", "omar", [
    ["b", 20 * H, "Bonjour, le vélo est toujours disponible ?", true],
    ["s", 19 * H, "Bonjour Omar, oui !", true],
    ["b", 18 * H, "Parfait, je peux passer samedi après le service ?", true],
    ["s", 17 * H, "Avec plaisir, je serai là à partir de 20h. Je t'envoie l'adresse exacte.", true],
    ["b", 16 * H, "Super, à samedi !", true],
  ]],
  ["robe", "imane", [
    ["b", 10 * H, "Salut Nadia, tu peux faire 200 MAD pour la robe ?", true],
    ["s", 9 * H, "Je peux descendre à 220, c'est vraiment un bon prix pour une robe de créatrice.", true],
    ["b", 8 * H, "OK pour 220, on se voit jeudi au service ?", true],
    ["s", 7 * H, "Jeudi parfait, je l'apporte. Paiement en espèces ?", true],
    ["b", 6 * H, "Oui, en espèces. Merci beaucoup !", false],
  ]],
  ["tapis", "mehdi", [
    ["b", 5 * H, "Bonjour, le tapis est-il facile à transporter en voiture ?", true],
    ["s", 4 * H, "Oui, il se roule facilement, il tient dans un coffre.", true],
    ["b", 3 * H, "Je réfléchis et je reviens vers vous.", false],
  ]],
  ["livres", "reda", [
    ["b", 30 * H, "Salma, tes livres de cuisine m'intéressent. Il y a le tajine de Fès dedans ?", true],
    ["s", 29 * H, "Oui, et plein d'autres recettes ! 80 MAD pour le lot.", true],
    ["b", 28 * H, "Je prends. Je peux les récupérer samedi à l'accueil ?", true],
    ["s", 27 * H, "Parfait, je les apporte.", true],
  ]],
  ["poussette", "hajar", [
    ["b", 36 * H, "Bonjour, la poussette est-elle encore à vendre ?", true],
    ["s", 35 * H, "Désolé, elle vient d'être vendue 😕", true],
  ]],
  ["casque", "anas", [
    ["b", 9 * H, "Salut Mehdi, le casque est toujours dispo ?", true],
    ["s", 8 * H, "Salut Anas ! Oui, toujours dans sa boîte, jamais ouvert.", true],
    ["b", 7 * H, "C'est ton dernier prix à 200 MAD ?", true],
    ["s", 6 * H, "C'est déjà le prix du neuf en promo, je ne peux pas descendre plus bas.", true],
    ["b", 5 * H, "D'accord, je le prends. Tu es là samedi au service ?", false],
    ["s", 4 * H, "Oui, je serai en cuisine. Je l'apporte et on se retrouve à l'accueil.", false],
  ]],
  ["cafe", "salma", [
    ["b", 12 * H, "Bonjour Karim, ta machine à café m'intéresse pour la salle des bénévoles.", true],
    ["s", 11 * H, "Excellente idée Salma, ça ferait du bien le matin 😄", true],
    ["b", 10 * H, "Je propose 250 MAD, et je reverse la différence dans la cagnotte des goodies.", true],
    ["s", 9 * H, "Va pour 250, c'est pour la bonne cause.", true],
    ["b", 8 * H, "Merci beaucoup ! Je passe la récupérer jeudi avant le briefing.", true],
  ]],
];

/** Conversations with the person running the demo (the real hub member whose email is passed as `me`). */
const ME_THREADS: [string, Msg[]][] = [
  ["cafe", [
    ["b", 6 * H, "Bonjour, la machine à café est-elle encore disponible ?", true],
    ["s", 5 * H, "Oui, toujours ! Elle marche parfaitement, 30 capsules incluses.", false],
    ["s", 4 * H, "Je suis au service jeudi et samedi si vous voulez la voir avant.", false],
  ]],
  ["table", [
    ["b", 3 * H, "Bonjour, la table basse est toujours à donner ?", true],
    ["s", 2 * H, "Oui ! Vous pouvez passer quand vous voulez, je suis disponible demain après 18h.", false],
  ]],
];

const D = `(SELECT id FROM hub_members WHERE email LIKE '%@${DEMO_DOMAIN}')`;
const DP = `(SELECT id FROM hub_posts WHERE member_id IN ${D})`;
const DC = `(SELECT id FROM hub_comments WHERE member_id IN ${D} OR post_id IN ${DP})`;
const DL = `(SELECT id FROM mk_listings WHERE member_id IN ${D})`;
const DMC = `(SELECT id FROM mk_comments WHERE member_id IN ${D} OR listing_id IN ${DL})`;
const DOMAIN_LIKE = `'%@${DEMO_DOMAIN}'`;

/** Removes every demo row, and anything real members did on demo content. Order respects the foreign keys. */
export function cleanupStatements(): string[] {
  return [
    `DELETE FROM hub_reports WHERE member_id IN ${D} OR (target_type = 'post' AND target_id IN ${DP}) OR (target_type = 'comment' AND target_id IN ${DC});`,
    `DELETE FROM mk_reports WHERE member_id IN ${D} OR (target_type = 'listing' AND target_id IN ${DL}) OR (target_type = 'comment' AND target_id IN ${DMC});`,
    `DELETE FROM mk_messages WHERE sender_id IN ${D} OR thread_id IN (SELECT id FROM mk_threads WHERE buyer_id IN ${D} OR seller_id IN ${D} OR listing_id IN ${DL});`,
    `DELETE FROM mk_threads WHERE buyer_id IN ${D} OR seller_id IN ${D} OR listing_id IN ${DL};`,
    `DELETE FROM mk_comments WHERE id IN ${DMC};`,
    `DELETE FROM mk_listing_media WHERE listing_id IN ${DL};`,
    `DELETE FROM mk_listings WHERE member_id IN ${D};`,
    `DELETE FROM hub_likes WHERE member_id IN ${D} OR post_id IN ${DP};`,
    `DELETE FROM hub_comments WHERE id IN ${DC};`,
    `DELETE FROM hub_post_media WHERE post_id IN ${DP};`,
    `DELETE FROM hub_posts WHERE member_id IN ${D};`,
    `DELETE FROM hub_uploads WHERE member_id IN ${D};`,
    `DELETE FROM hub_sessions WHERE member_id IN ${D};`,
    `DELETE FROM hub_login_tokens WHERE email LIKE ${DOMAIN_LIKE};`,
    `DELETE FROM hub_members WHERE email LIKE ${DOMAIN_LIKE};`,
    // the volunteers trigger decrements registered_count on delete: give back what the seed took away so the net effect is zero
    `UPDATE t_ramadan_days SET registered_count = registered_count + (SELECT COUNT(*) FROM t_volunteers v WHERE v.day_id = t_ramadan_days.id AND v.email LIKE ${DOMAIN_LIKE});`,
    `DELETE FROM t_volunteers WHERE email LIKE ${DOMAIN_LIKE};`,
  ];
}

const postRef = (p: Post) => `(SELECT id FROM hub_posts WHERE member_id = ${mid(p.a)} AND body = ${q(p.body)})`;
const listingRef = (key: string) => {
  const l = LISTINGS.find(x => x.key === key)!;
  return `(SELECT id FROM mk_listings WHERE member_id = ${mid(l.seller)} AND title = ${q(l.title)})`;
};

function pushThread(out: string[], listingKey: string, buyerExpr: string, buyerGuard: string, msgs: Msg[]) {
  const l = LISTINGS.find(x => x.key === listingKey)!;
  const first = msgs[0][1];
  const last = msgs[msgs.length - 1][1];
  const lref = listingRef(listingKey);
  out.push(
    `INSERT INTO mk_threads (listing_id, buyer_id, seller_id, created_at, last_message_at) SELECT ${lref}, ${buyerExpr}, ${mid(l.seller)}, ${ago(first)}, ${ago(last)} WHERE ${buyerGuard};`,
  );
  const tref = `(SELECT id FROM mk_threads WHERE listing_id = ${lref} AND buyer_id = ${buyerExpr})`;
  for (const [who, min, text, read] of msgs) {
    const sender = who === "b" ? buyerExpr : mid(l.seller);
    out.push(
      `INSERT INTO mk_messages (thread_id, sender_id, body, created_at, read_at) SELECT ${tref}, ${sender}, ${q(text)}, ${ago(min)}, ${read ? ago(min - 5) : "NULL"} WHERE ${tref} IS NOT NULL;`,
    );
  }
}

/** @param me email of a real hub member who should also receive a few unread conversations (optional) */
export function seedStatements(me?: string): string[] {
  const out: string[] = [...cleanupStatements()];

  PEOPLE.forEach((p, i) => {
    const phone = `+2120000000${String(i + 1).padStart(2, "0")}`; // starts with 0 after +212: can never be a real number
    out.push(
      `INSERT INTO t_volunteers (first_name, last_name, email, phone, city, day_id, qr_token, qr_status, status, accepted_terms, notes, confirmed_at) VALUES (${q(p.first)}, ${q(p.last)}, ${q(mail(p.key))}, ${q(phone)}, ${q(p.city)}, COALESCE((SELECT MIN(id) FROM t_ramadan_days), 0), ${q(`demo-${p.key}`)}, 'validated', 'confirmed', 1, 'DEMO - profil fictif', ${ago(80 * H)});`,
    );
  });
  // the insert trigger counted these volunteers on a Ramadan day: take them back out so public capacity is unchanged
  out.push(`UPDATE t_ramadan_days SET registered_count = registered_count - (SELECT COUNT(*) FROM t_volunteers v WHERE v.day_id = t_ramadan_days.id AND v.email LIKE ${DOMAIN_LIKE});`);

  for (const p of PEOPLE) {
    out.push(
      `INSERT INTO hub_members (email, display_name, bio, role, status, created_at) VALUES (${q(mail(p.key))}, ${q(`${p.first} ${p.last[0]}.`)}, ${q(p.bio)}, ${q(p.role ?? "member")}, 'active', ${ago(80 * H)});`,
    );
  }

  for (const p of POSTS) {
    out.push(`INSERT INTO hub_posts (member_id, body, kind, pinned, status, created_at) VALUES (${mid(p.a)}, ${q(p.body)}, 'post', 0, 'visible', ${ago(p.min)});`);
  }
  for (const a of ANNOUNCEMENTS) {
    out.push(`INSERT INTO hub_posts (member_id, body, kind, pinned, status, created_at) VALUES (${mid(a.a)}, ${q(a.body)}, 'announcement', 1, 'visible', ${ago(a.min)});`);
  }
  for (const [pi, a, delay, text] of POST_COMMENTS) {
    const post = POSTS[pi];
    out.push(`INSERT INTO hub_comments (post_id, member_id, body, status, created_at) VALUES (${postRef(post)}, ${mid(a)}, ${q(text)}, 'visible', ${ago(post.min - delay)});`);
  }
  // likes: deterministic spread, 2 to 6 per post, never the author
  POSTS.forEach((post, i) => {
    const n = 2 + (i % 5);
    const likers = new Set<string>();
    for (let k = 0; likers.size < n && k < PEOPLE.length * 2; k++) {
      const cand = PEOPLE[(i * 3 + k) % PEOPLE.length].key;
      if (cand !== post.a) likers.add(cand);
    }
    for (const l of likers) out.push(`INSERT OR IGNORE INTO hub_likes (post_id, member_id, created_at) VALUES (${postRef(post)}, ${mid(l)}, ${ago(post.min - 30)});`);
  });
  {
    const [pi, reporter, reason] = POST_REPORT;
    out.push(`INSERT INTO hub_reports (target_type, target_id, member_id, reason) VALUES ('post', ${postRef(POSTS[pi])}, ${mid(reporter)}, ${q(reason)});`);
  }

  for (const l of LISTINGS) {
    const phone = l.phone ? q(`+2120000000${String(PEOPLE.findIndex(p => p.key === l.seller) + 1).padStart(2, "0")}`) : "NULL";
    out.push(
      `INSERT INTO mk_listings (member_id, title, description, price, category, item_condition, city, status, contact_phone, contact_whatsapp, created_at, updated_at) VALUES (${mid(l.seller)}, ${q(l.title)}, ${q(l.description)}, ${l.price}, ${q(l.category)}, ${q(l.condition)}, ${q(l.city)}, ${q(l.status ?? "active")}, ${phone}, ${l.whatsapp ? 1 : 0}, ${ago(l.min)}, ${ago(l.min)});`,
    );
  }
  for (const [key, a, delay, text] of LISTING_COMMENTS) {
    const l = LISTINGS.find(x => x.key === key)!;
    out.push(`INSERT INTO mk_comments (listing_id, member_id, body, status, created_at) VALUES (${listingRef(key)}, ${mid(a)}, ${q(text)}, 'visible', ${ago(l.min - delay)});`);
  }
  {
    const [key, reporter, reason] = LISTING_REPORT;
    out.push(`INSERT INTO mk_reports (target_type, target_id, member_id, reason) VALUES ('listing', ${listingRef(key)}, ${mid(reporter)}, ${q(reason)});`);
  }

  for (const [key, buyer, msgs] of THREADS) pushThread(out, key, mid(buyer), "1", msgs);
  if (me) {
    const meId = `(SELECT id FROM hub_members WHERE email = ${q(me.trim().toLowerCase())})`;
    for (const [key, msgs] of ME_THREADS) pushThread(out, key, meId, `${meId} IS NOT NULL`, msgs);
  }
  return out;
}

export const seedSql = (me?: string) => seedStatements(me).join("\n") + "\n";
export const cleanupSql = () => cleanupStatements().join("\n") + "\n";
