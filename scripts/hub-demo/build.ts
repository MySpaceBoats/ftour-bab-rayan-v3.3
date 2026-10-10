/**
 * Demo data for the volunteer hub (Fil + Marketplace) and its Hébergement / Pro sub-spaces: 10 fictional volunteers,
 * a lively feed, listings, comments, likes, reports and private conversations. Pure SQL builder (no I/O),
 * tested in worker/hub-demo.test.ts.
 *
 * Every demo row hangs off an email @demo.ftour.invalid (an address that cannot receive mail), so cleanup is exact.
 * The seed starts with the cleanup, so it can be re-run safely.
 */
import { D, DEMO_DOMAIN, DEMO_LABEL, DOMAIN_LIKE, H, PEOPLE, ago, demoText, mail, mid, phoneOf, q, type Msg } from "./common";
import { proCleanup, proSeed } from "./pro";
import { stayCleanup, staySeed } from "./stay";

export { DEMO_DOMAIN, DEMO_LABEL };

interface Post { k: string; a: string; h: number; body: string }
/** Chronological (oldest first): the feed is ordered by id, so insertion order is display order. `h` = hours ago. */
const POSTS: Post[] = [
  { k: "premier-soir", a: "yasmine", h: 72, body: "Premier soir de bénévolat hier, quelle ambiance ! 🌙 Merci à toute l'équipe de la cuisine, on a servi plus de 300 repas. Qui était là ?" },
  { k: "samedi", a: "karim", h: 70, body: "Présent hier à l'accueil. Les familles étaient tellement reconnaissantes. On remet ça samedi ? Je prends le créneau 17h-20h." },
  { k: "planning", a: "hajar", h: 66, body: "Le planning de la semaine prochaine est publié dans votre espace. Si un créneau ne vous convient pas, échangez avec quelqu'un directement ici plutôt que de ne pas venir, merci 🙏" },
  { k: "rappel", a: "salma", h: 60, body: "Rappel amical : arrivez 30 minutes avant votre créneau pour le briefing, et pensez à votre badge. Merci à tous ! 💙" },
  { k: "astuce-chorba", a: "mehdi", h: 58, body: "Astuce de cuisine : on gagne 15 minutes sur le montage des plateaux si on prépare les bacs de chorba la veille au soir. Qui est du matin samedi ?" },
  { k: "dattes", a: "omar", h: 55, body: "Quelqu'un a des idées pour mieux organiser la distribution des dattes ? On a perdu un peu de temps hier au service." },
  { k: "lots50", a: "nadia", h: 50, body: "On pourrait préparer les barquettes de dattes en amont, par lots de 50. Je peux m'en occuper avant l'ouverture." },
  { k: "famille", a: "karim", h: 46, body: "Une famille est arrivée hier avec cinq enfants et pas de réservation. On a trouvé de la place, mais pensez à rappeler aux gens de réserver à l'avance 😅" },
  { k: "pauses", a: "imane", h: 42, body: "Petite question de débutante : on prend ses pauses où ? Et est-ce qu'on mange avec les convives ou après le service ?" },
  { k: "renfort", a: "mehdi", h: 40, body: "On a besoin de renfort en cuisine jeudi soir, 2-3 personnes en plus. Qui est partant ?" },
  { k: "premiere-fois", a: "imane", h: 36, body: "Première fois que je fais du bénévolat et j'adore. Merci pour votre accueil, vraiment 🥹" },
  { k: "parking", a: "reda", h: 33, body: "Info pour les conducteurs : le parking devant la salle est plein dès 18h. Garez-vous plutôt dans la rue d'à côté, c'est à 3 minutes à pied." },
  { k: "covoiturage", a: "reda", h: 30, body: "Idée : un covoiturage entre bénévoles pour rentrer après le service ? Je passe par Maarif et Gauthier, 2 places libres." },
  { k: "photo", a: "yasmine", h: 27, body: "Pour celles et ceux qui demandaient : oui, il y aura un petit moment pour la photo de l'équipe samedi avant le service. Venez avec le sourire !" },
  { k: "rangement", a: "hajar", h: 24, body: "Merci à celles et ceux qui ont aidé à ranger hier soir. On a fini en 20 minutes grâce à vous ! 👏" },
  { k: "vestiaire", a: "anas", h: 20, body: "Question pratique : où peut-on laisser nos affaires pendant le service ? Il y a un vestiaire ?" },
  { k: "bilan-dattes", a: "omar", h: 16, body: "Bilan dattes : avec les lots de 50 de Nadia, la distribution est passée de 25 à 12 minutes. Merci ! Prochaine étape : le lait ribot, on s'y penche 😄" },
  { k: "deco", a: "yasmine", h: 12, body: "Je cherche des bénévoles pour la décoration de la salle vendredi après-midi, rien de compliqué. Dites-moi !" },
  { k: "msemen", a: "nadia", h: 10, body: "Je fais des msemen et des baghrir pour l'équipe de la cuisine samedi matin. Dites-moi si vous avez des allergies (gluten, noix...)." },
  { k: "bilan", a: "karim", h: 8, body: "Le bilan de ce week-end : 1 240 repas servis sur 4 jours. Bravo à tous ! 🎉" },
  { k: "spam", a: "anas", h: 6, body: "Vends mon compte Netflix pas cher, écrivez-moi en privé 🔥🔥" },
  { k: "moderation", a: "salma", h: 5, body: "Merci de ne pas poster de publicités ou de ventes ici : la marketplace est faite pour ça. Les messages hors sujet seront masqués." },
  { k: "gourde", a: "mehdi", h: 4, body: "Quelqu'un a retrouvé une gourde grise avec un autocollant étoile ? Perdue hier près de la cuisine." },
  { k: "bonne-nuit", a: "nadia", h: 3, body: "Bonne nuit à tous, repos bien mérité. Demain on est de retour 💪" },
  { k: "pieds", a: "imane", h: 2, body: "Merci pour vos réponses d'hier ! J'ai fait ma première soirée complète, j'ai mal aux pieds mais le cœur léger 😊" },
  { k: "marketplace", a: "hajar", h: 1, body: "Nouveau : la marketplace est ouverte ! Si vous avez des objets à donner ou à vendre entre bénévoles, c'est par là 🛍️" },
];
const post = (k: string) => POSTS.find(p => p.k === k)!;

/** [post key, author, minutes after the post, text] — a reply names the person it answers (@Prénom). */
const POST_COMMENTS: [string, string, number, string][] = [
  ["premier-soir", "karim", 30, "J'y étais ! Super ambiance en cuisine."],
  ["premier-soir", "imane", 90, "Dommage, je serai là samedi."],
  ["premier-soir", "omar", 140, "300 repas, on a battu notre record."],
  ["premier-soir", "yasmine", 160, "@Omar record battu, et on n'a pas fini 😄"],
  ["samedi", "yasmine", 45, "Je prends 17h-20h aussi, on se voit là-bas."],
  ["samedi", "mehdi", 200, "Samedi je suis en cuisine à partir de 16h."],
  ["samedi", "karim", 230, "@Mehdi parfait, on se croise alors."],
  ["planning", "omar", 40, "Merci Hajar, j'ai pu échanger mon jeudi avec Imane."],
  ["planning", "imane", 75, "@Omar merci encore pour l'échange, ça m'arrange beaucoup !"],
  ["planning", "hajar", 110, "Super, c'est exactement l'idée 👍"],
  ["rappel", "reda", 20, "Bien reçu, merci Salma."],
  ["rappel", "anas", 75, "Pour le badge, où est-ce qu'on le récupère ?"],
  ["rappel", "salma", 100, "À l'accueil, demande-le à Karim."],
  ["rappel", "anas", 130, "Les badges c'est nul, personne ne les regarde de toute façon."],
  ["astuce-chorba", "nadia", 35, "Bonne idée, la veille au soir c'est faisable. Je suis du matin samedi."],
  ["astuce-chorba", "omar", 60, "@Nadia je prends le soir alors, je finis vers 23h."],
  ["astuce-chorba", "yasmine", 95, "Ajoutez les cuillères et les gobelets, ça sauve vraiment du temps."],
  ["dattes", "nadia", 60, "Voir mon message plus bas : des lots de 50, ça va très vite."],
  ["dattes", "hajar", 120, "Des lots de 50, c'est parfait."],
  ["dattes", "omar", 180, "Merci Nadia, excellente idée !"],
  ["lots50", "omar", 25, "@Nadia je te réserve une table pour les barquettes."],
  ["lots50", "mehdi", 70, "Je peux vous aider à les compter si besoin."],
  ["famille", "salma", 15, "On avait prévu de la marge, ne t'inquiète pas. Merci d'avoir géré ça avec le sourire."],
  ["famille", "yasmine", 40, "On mettra le rappel pour réserver dans la prochaine annonce."],
  ["famille", "imane", 90, "Les enfants étaient adorables, ils m'ont aidée à poser les verres 🥹"],
  ["pauses", "salma", 20, "Pause de 15 minutes par créneau, salle à gauche de la cuisine. Les bénévoles mangent après le service, avec l'équipe."],
  ["pauses", "reda", 45, "Et il y a du thé à volonté dans la salle des bénévoles."],
  ["pauses", "imane", 60, "@Salma parfait, merci ! Je me sens moins perdue 😊"],
  ["renfort", "anas", 40, "Je suis partant pour jeudi."],
  ["renfort", "imane", 55, "Moi aussi, à quelle heure ?"],
  ["renfort", "mehdi", 70, "Dès 18h, merci à vous deux !"],
  ["premiere-fois", "yasmine", 30, "Bienvenue Imane ! 🤗"],
  ["premiere-fois", "karim", 55, "Ravi de t'avoir à l'accueil, tu t'en sors très bien."],
  ["premiere-fois", "hajar", 100, "Bienvenue dans l'équipe !"],
  ["parking", "omar", 25, "Merci du conseil, j'allais me garer devant l'entrée."],
  ["parking", "karim", 60, "La rue derrière la pharmacie est plus tranquille."],
  ["covoiturage", "salma", 25, "Super initiative Reda, je note !"],
  ["covoiturage", "imane", 90, "Je vais vers Racine, ça pourrait m'arranger ✋"],
  ["covoiturage", "reda", 120, "@Imane Racine est sur mon chemin, on se retrouve à 22h30 devant l'entrée ?"],
  ["covoiturage", "imane", 150, "Parfait, à jeudi !"],
  ["photo", "karim", 20, "Je serai là, j'apporte mon trépied 📸"],
  ["photo", "nadia", 55, "Je viens avec un tablier propre pour la photo 😄"],
  ["rangement", "omar", 25, "Avec des équipes comme ça, on rangerait une salle de mariage en 20 minutes."],
  ["rangement", "hajar", 50, "@Omar on t'appelle pour le prochain mariage alors 😂"],
  ["vestiaire", "salma", 30, "Oui, vestiaire à droite de l'entrée, fermé à clé."],
  ["vestiaire", "anas", 50, "Parfait, merci !"],
  ["bilan-dattes", "nadia", 30, "12 minutes, quelle progression ! Merci Omar 💪"],
  ["bilan-dattes", "hajar", 70, "Pour le lait ribot, on peut prévoir des bacs avec de la glace."],
  ["bilan-dattes", "omar", 100, "@Hajar bonne idée, je regarde la logistique du froid."],
  ["deco", "hajar", 35, "Je viens avec plaisir !"],
  ["deco", "nadia", 80, "Je peux apporter des guirlandes."],
  ["deco", "yasmine", 100, "Super, rendez-vous vendredi 15h à la salle !"],
  ["msemen", "mehdi", 20, "Allergique aux noix, merci d'y penser 🙏"],
  ["msemen", "nadia", 35, "@Mehdi noté, je prépare une version sans noix."],
  ["msemen", "omar", 80, "Je viens goûter, sans honte 😋"],
  ["bilan", "yasmine", 15, "Bravo à toute l'équipe !"],
  ["bilan", "omar", 60, "Un mois de ça et on aura nourri une ville entière."],
  ["spam", "imane", 10, "Je pense que c'est de la pub, non ?"],
  ["moderation", "anas", 25, "Désolé, je n'avais pas compris les règles."],
  ["moderation", "salma", 40, "@Anas pas de souci, la marketplace est là pour ça 👍"],
  ["gourde", "omar", 15, "Gourde grise vue au vestiaire hier, je regarde."],
  ["gourde", "mehdi", 30, "@Omar merci, je passe demain !"],
  ["bonne-nuit", "reda", 20, "Bonne nuit Nadia, repose-toi bien 🌙"],
  ["pieds", "yasmine", 15, "Bravo pour ta première soirée complète !"],
  ["pieds", "omar", 40, "Les pieds s'habituent, promis 😅"],
  ["marketplace", "karim", 10, "Super idée, je vais en parler autour de moi."],
  ["marketplace", "salma", 25, "J'ai déjà mis en vente mes livres de cuisine 😄"],
  ["marketplace", "yasmine", 45, "Vélo de ma fille posté, merci Hajar !"],
];

/** Likes per post, deliberately uneven (same order as POSTS). The spam post has none. */
const LIKE_COUNTS = [7, 5, 3, 6, 2, 9, 4, 8, 1, 5, 3, 6, 7, 2, 4, 10, 3, 6, 5, 8, 0, 4, 2, 7, 3, 9].map(n => Math.min(n, PEOPLE.length - 1));

/** [post key, reporter, reason] — one harmless-looking spam post to show the moderation queue */
const POST_REPORT: [string, string, string] = ["spam", "salma", "Publicité sans rapport avec le bénévolat"];
/** [post key, comment author, comment text, reporter, reason] */
const COMMENT_REPORT: [string, string, string, string, string] = ["rappel", "anas", "Les badges c'est nul, personne ne les regarde de toute façon.", "hajar", "Ton désobligeant envers l'organisation"];

/** Pinned announcements from the moderator: they fill the "Annonces de l'équipe" column. */
const ANNOUNCEMENTS: { a: string; h: number; body: string }[] = [
  { a: "salma", h: 64, body: "Bienvenue dans l'espace bénévole 🌙 Ici vous trouverez les annonces de l'équipe, le fil des bénévoles et la marketplace. Présentez-vous en quelques mots, ça fait toujours plaisir aux nouveaux." },
  { a: "salma", h: 26, body: "Rappel : le badge est obligatoire à l'entrée et les créneaux du week-end partent vite. Inscrivez-vous à l'avance depuis votre espace, et pensez à annuler si vous ne pouvez plus venir." },
];

interface Listing {
  key: string; seller: string; min: number; title: string; description: string; price: number;
  category: string; condition: string; city: string; phone: boolean; whatsapp: boolean; status?: "sold";
}
/** Chronological like the posts: the grid is ordered by id. All seven categories are represented. */
const LISTINGS: Listing[] = [
  { key: "velo", seller: "yasmine", min: 50 * H, title: "Vélo enfant 6-8 ans", description: "Vélo bleu avec petites roues amovibles, très bon état, révisé l'été dernier. À venir chercher à Casablanca.", price: 150, category: "enfants", condition: "bon", city: "Casablanca", phone: true, whatsapp: true },
  { key: "cafe", seller: "karim", min: 46 * H, title: "Machine à café à capsules", description: "Fonctionne parfaitement, détartrée récemment. Une trentaine de capsules incluses.", price: 300, category: "maison", condition: "bon", city: "Rabat", phone: true, whatsapp: false },
  { key: "scooter", seller: "reda", min: 44 * H, title: "Scooter 50 cc, 12 000 km", description: "Entretien suivi, batterie neuve en septembre, deux casques fournis. Papiers à jour, essai possible le week-end.", price: 4500, category: "vehicules", condition: "bon", city: "Casablanca", phone: true, whatsapp: true },
  { key: "livres", seller: "salma", min: 40 * H, title: "Lot de 12 livres de cuisine marocaine", description: "Tajines, pâtisseries, plats de fête. Quelques pages cornées mais tout est lisible.", price: 80, category: "livres", condition: "bon", city: "Casablanca", phone: true, whatsapp: true },
  { key: "poussette", seller: "omar", min: 38 * H, title: "Poussette Chicco", description: "Poussette pliable, légère, avec capote pluie. Quelques traces d'usure.", price: 400, category: "enfants", condition: "correct", city: "Casablanca", phone: false, whatsapp: false, status: "sold" },
  { key: "djellaba", seller: "karim", min: 34 * H, title: "Djellaba homme taille L, brodée main", description: "Portée deux fois pour l'Aïd, coton léger beige avec broderies tonales. Très propre, pressing fait.", price: 350, category: "mode", condition: "bon", city: "Rabat", phone: true, whatsapp: false },
  { key: "robe", seller: "nadia", min: 30 * H, title: "Robe de soirée taille 38, portée une fois", description: "Robe longue d'un créateur local, couleur émeraude. Je peux envoyer des photos.", price: 250, category: "mode", condition: "bon", city: "Marrakech", phone: true, whatsapp: true },
  { key: "couture", seller: "hajar", min: 26 * H, title: "Machine à coudre de table", description: "Machine mécanique avec boîte d'accessoires et pédale, révisée cette année. Idéale pour débuter ou faire des retouches.", price: 600, category: "autre", condition: "bon", city: "Fès", phone: true, whatsapp: true },
  { key: "casque", seller: "mehdi", min: 22 * H, title: "Casque audio Bluetooth neuf", description: "Cadeau reçu en double, jamais déballé, garantie 1 an.", price: 200, category: "high-tech", condition: "neuf", city: "Casablanca", phone: false, whatsapp: false },
  { key: "table", seller: "reda", min: 18 * H, title: "Table basse en bois à donner", description: "Je la donne gratuitement : il faut juste venir la chercher (2e étage sans ascenseur).", price: 0, category: "maison", condition: "correct", city: "Casablanca", phone: true, whatsapp: false },
  { key: "manuels", seller: "imane", min: 14 * H, title: "Manuels de lycée (maths et physique)", description: "Programme de 1ère année du bac, propres, sans annotations.", price: 60, category: "livres", condition: "bon", city: "Mohammedia", phone: false, whatsapp: false, status: "sold" },
  { key: "tablette", seller: "yasmine", min: 12 * H, title: "Tablette Android 10 pouces", description: "Écran sans rayure, batterie correcte, housse incluse. Réinitialisée, prête à servir.", price: 700, category: "high-tech", condition: "correct", city: "Casablanca", phone: false, whatsapp: false },
  { key: "tapis", seller: "hajar", min: 9 * H, title: "Tapis berbère 2 x 3 m", description: "Tapis en laine tissé main, motifs géométriques. Très belle pièce.", price: 900, category: "maison", condition: "bon", city: "Fès", phone: true, whatsapp: true },
  { key: "iphone", seller: "anas", min: 5 * H, title: "iPhone 15 Pro NEUF 500 MAD !!!", description: "Urgent, contactez-moi.", price: 500, category: "high-tech", condition: "neuf", city: "Casablanca", phone: false, whatsapp: false },
];

/**
 * Photos de démonstration. La base stocke la clé logique `demo/<fichier>` ; le Worker la sert depuis
 * R2 sous `private/hub/demo/<fichier>`. Les fichiers vivent dans scripts/hub-demo/media/ et
 * worker/hub-demo.test.ts vérifie que chaque clé pointée par le seed existe sur disque.
 */
export const LISTING_MEDIA: Record<string, string[]> = {
  velo: ["velo-1.jpg", "velo-2.jpg"],
  cafe: ["cafe-1.jpg"],
  scooter: ["scooter-1.jpg"],
  livres: ["livres-1.jpg"],
  poussette: ["poussette-1.jpg"],
  djellaba: ["djellaba-1.jpg"],
  robe: ["robe-1.jpg", "robe-2.jpg"],
  couture: ["couture-1.jpg"],
  casque: ["casque-1.jpg"],
  table: ["table-1.jpg"],
  manuels: ["manuels-1.jpg"],
  tablette: ["tablette-1.jpg"],
  tapis: ["tapis-1.jpg"],
  iphone: ["iphone-1.jpg"],
};
export const MEDIA_KEY_PREFIX = "demo";

/** [listing key, author, minutes after the listing, text] */
const LISTING_COMMENTS: [string, string, number, string][] = [
  ["velo", "karim", 60, "Il convient à quel âge exactement ? Mon neveu a 7 ans."],
  ["velo", "yasmine", 120, "Idéal pour 6-8 ans, avec les petites roues amovibles."],
  ["cafe", "mehdi", 90, "Combien de capsules incluses ?"],
  ["cafe", "karim", 150, "Une trentaine."],
  ["scooter", "karim", 40, "Quelle cylindrée exactement ?"],
  ["scooter", "reda", 70, "50 cc, bridé comme il se doit."],
  ["scooter", "mehdi", 120, "Possible de l'essayer samedi après le service ?"],
  ["scooter", "reda", 150, "@Mehdi oui, avec plaisir."],
  ["poussette", "hajar", 20, "Dommage, je viens de voir l'annonce trop tard !"],
  ["djellaba", "yasmine", 50, "Très belle broderie ! Elle existe en taille M ?"],
  ["djellaba", "karim", 90, "@Yasmine non, seulement en L malheureusement."],
  ["robe", "imane", 60, "Elle est de quelle marque ?"],
  ["robe", "nadia", 110, "Une créatrice locale, je peux envoyer des photos par WhatsApp."],
  ["couture", "nadia", 30, "Elle coud aussi le tissu épais ?"],
  ["couture", "hajar", 60, "@Nadia oui, jusqu'au jean léger."],
  ["couture", "imane", 110, "Je suis intéressée, je t'écris."],
  ["casque", "salma", 35, "Tu as la facture pour la garantie ?"],
  ["casque", "mehdi", 65, "@Salma oui, et le ticket de caisse."],
  ["table", "salma", 40, "Toujours dispo ? Je passe demain."],
  ["table", "reda", 70, "Oui, venez dans l'après-midi."],
  ["tablette", "anas", 25, "Ça tourne bien pour les cours en ligne ?"],
  ["tablette", "yasmine", 60, "@Anas oui, c'est surtout ce que mon fils en faisait."],
  ["tapis", "omar", 50, "Belle pièce ! Dimensions exactes ?"],
  ["tapis", "hajar", 80, "2,10 x 3 m."],
  ["iphone", "salma", 30, "Ça sent l'arnaque, je signale."],
  ["iphone", "imane", 55, "Pour 500 MAD, c'est impossible."],
];

const LISTING_REPORT: [string, string, string] = ["iphone", "yasmine", "Prix irréaliste, probable arnaque"];

/** Conversations between demo members: [listing key, buyer, messages (b = buyer, s = seller)] */
const THREADS: [string, string, Msg[]][] = [
  ["velo", "omar", [
    ["b", 20 * H, "Bonjour, le vélo est toujours disponible ?", true],
    ["s", 19 * H, "Bonjour Omar, oui !", true],
    ["b", 18 * H, "Parfait, je peux passer samedi après le service ?", true],
    ["s", 17 * H, "Avec plaisir, je serai là à partir de 20h. Je t'envoie l'adresse exacte.", true],
    ["b", 16 * H, "Super, à samedi !", true],
    ["b", 15 * H, "Je confirme 150 MAD en espèces, c'est bon pour moi.", false],
  ]],
  ["robe", "imane", [
    ["b", 10 * H, "Salut Nadia, tu peux faire 200 MAD pour la robe ?", true],
    ["s", 9 * H, "Je peux descendre à 220, c'est vraiment un bon prix pour une robe de créatrice.", true],
    ["b", 8 * H, "OK pour 220, on se voit jeudi au service ?", true],
    ["s", 7 * H, "Jeudi parfait, je l'apporte. Paiement en espèces ?", true],
    ["b", 6 * H, "Oui, en espèces. Merci beaucoup !", true],
    ["s", 5 * H, "Je te l'apporte dans un sac à vêtements, elle sera repassée 😊", false],
  ]],
  ["tapis", "mehdi", [
    ["b", 5 * H, "Bonjour, le tapis est-il facile à transporter en voiture ?", true],
    ["s", 4 * H, "Oui, il se roule facilement, il tient dans un coffre.", true],
    ["b", 3 * H, "Je réfléchis et je reviens vers vous.", true],
    ["s", 2 * H, "Pas de souci, prenez votre temps. Je peux aussi vous envoyer une photo du motif de près.", false],
    ["b", 1 * H, "Oui, avec plaisir, merci !", false],
  ]],
  ["livres", "reda", [
    ["b", 30 * H, "Salma, tes livres de cuisine m'intéressent. Il y a le tajine de Fès dedans ?", true],
    ["s", 29 * H, "Oui, et plein d'autres recettes ! 80 MAD pour le lot.", true],
    ["b", 28 * H, "Je prends. Je peux les récupérer samedi à l'accueil ?", true],
    ["s", 27 * H, "Parfait, je les apporte.", true],
    ["b", 26 * H, "Merci Salma, le lot est parfait pour ma mère !", true],
    ["s", 25 * H, "Avec plaisir, bon appétit à tous 😄", true],
  ]],
  ["poussette", "hajar", [
    ["b", 36 * H, "Bonjour, la poussette est-elle encore à vendre ?", true],
    ["s", 35 * H, "Désolé, elle vient d'être vendue 😕", true],
    ["b", 34 * H, "Pas de souci, merci de m'avoir répondu vite !", true],
    ["s", 33 * H, "Je te préviens si j'en vois une autre passer, bon courage 🙂", true],
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
    ["s", 7 * H, "Je prépare un sac avec les capsules et un petit mot pour l'équipe.", true],
    ["b", 6 * H, "Trop gentil Karim, à jeudi !", true],
    ["s", 5 * H, "À jeudi 👍", false],
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
  ["scooter", [
    ["b", 5 * H, "Bonjour, le scooter est-il toujours disponible ? Quel est le kilométrage exact ?", true],
    ["s", 4 * H, "Bonjour ! Oui, 12 340 km au compteur. Je peux vous le montrer ce week-end.", false],
    ["s", 3 * H, "Je suis au service jeudi soir si vous préférez qu'on en parle sur place.", false],
  ]],
];

const DP = `(SELECT id FROM hub_posts WHERE member_id IN ${D})`;
const DC = `(SELECT id FROM hub_comments WHERE member_id IN ${D} OR post_id IN ${DP})`;
const DL = `(SELECT id FROM mk_listings WHERE member_id IN ${D})`;
const DMC = `(SELECT id FROM mk_comments WHERE member_id IN ${D} OR listing_id IN ${DL})`;

/** Removes every demo row, and anything real members did on demo content. Order respects the foreign keys. */
export function cleanupStatements(): string[] {
  return [
    ...stayCleanup(),
    ...proCleanup(),
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

const postRef = (p: Post) => `(SELECT id FROM hub_posts WHERE member_id = ${mid(p.a)} AND body = ${q(demoText(p.body))})`;
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

  PEOPLE.forEach(p => {
    out.push(
      `INSERT INTO t_volunteers (first_name, last_name, email, phone, city, day_id, qr_token, qr_status, status, accepted_terms, notes, confirmed_at) VALUES (${q(p.first)}, ${q(p.last)}, ${q(mail(p.key))}, ${q(phoneOf(p.key))}, ${q(p.city)}, COALESCE((SELECT MIN(id) FROM t_ramadan_days), 0), ${q(`demo-${p.key}`)}, 'validated', 'confirmed', 1, 'DEMO - profil fictif', ${ago(80 * H)});`,
    );
  });
  // the insert trigger counted these volunteers on a Ramadan day: take them back out so public capacity is unchanged
  out.push(`UPDATE t_ramadan_days SET registered_count = registered_count - (SELECT COUNT(*) FROM t_volunteers v WHERE v.day_id = t_ramadan_days.id AND v.email LIKE ${DOMAIN_LIKE});`);

  for (const p of PEOPLE) {
    // the marker goes in display_name too: a bio is only visible on one's own profile page, whereas the
    // name is shown on every post, listing and conversation, which is where confusion could happen.
    out.push(
      `INSERT INTO hub_members (email, display_name, bio, role, status, created_at) VALUES (${q(mail(p.key))}, ${q(`🧪 ${p.first} ${p.last[0]}. (profil test)`)}, ${q(`${DEMO_LABEL} — profil fictif créé pour la démonstration de l'espace bénévole. ${p.bio}`)}, ${q(p.role ?? "member")}, 'active', ${ago(80 * H)});`,
    );
  }

  for (const p of POSTS) {
    out.push(`INSERT INTO hub_posts (member_id, body, kind, pinned, status, created_at) VALUES (${mid(p.a)}, ${q(demoText(p.body))}, 'post', 0, 'visible', ${ago(p.h * H)});`);
  }
  for (const a of ANNOUNCEMENTS) {
    out.push(`INSERT INTO hub_posts (member_id, body, kind, pinned, status, created_at) VALUES (${mid(a.a)}, ${q(demoText(a.body))}, 'announcement', 1, 'visible', ${ago(a.h * H)});`);
  }
  for (const [pk, a, delay, text] of POST_COMMENTS) {
    const p = post(pk);
    out.push(`INSERT INTO hub_comments (post_id, member_id, body, status, created_at) VALUES (${postRef(p)}, ${mid(a)}, ${q(text)}, 'visible', ${ago(p.h * H - delay)});`);
  }
  // likes: uneven deterministic spread, never the author
  POSTS.forEach((p, i) => {
    const likers = new Set<string>();
    for (let k = 0; likers.size < LIKE_COUNTS[i] && k < PEOPLE.length * 2; k++) {
      const cand = PEOPLE[(i * 3 + k) % PEOPLE.length].key;
      if (cand !== p.a) likers.add(cand);
    }
    for (const l of likers) out.push(`INSERT OR IGNORE INTO hub_likes (post_id, member_id, created_at) VALUES (${postRef(p)}, ${mid(l)}, ${ago(p.h * H - 30)});`);
  });
  {
    const [pk, reporter, reason] = POST_REPORT;
    out.push(`INSERT INTO hub_reports (target_type, target_id, member_id, reason) VALUES ('post', ${postRef(post(pk))}, ${mid(reporter)}, ${q(reason)});`);
    const [ck, author, text, creporter, creason] = COMMENT_REPORT;
    const cref = `(SELECT id FROM hub_comments WHERE post_id = ${postRef(post(ck))} AND member_id = ${mid(author)} AND body = ${q(text)})`;
    out.push(`INSERT INTO hub_reports (target_type, target_id, member_id, reason) VALUES ('comment', ${cref}, ${mid(creporter)}, ${q(creason)});`);
  }

  for (const l of LISTINGS) {
    const phone = l.phone ? q(phoneOf(l.seller)) : "NULL";
    out.push(
      `INSERT INTO mk_listings (member_id, title, description, price, category, item_condition, city, status, contact_phone, contact_whatsapp, created_at, updated_at) VALUES (${mid(l.seller)}, ${q(l.title)}, ${q(demoText(l.description))}, ${l.price}, ${q(l.category)}, ${q(l.condition)}, ${q(l.city)}, ${q(l.status ?? "active")}, ${phone}, ${l.whatsapp ? 1 : 0}, ${ago(l.min)}, ${ago(l.min)});`,
    );
  }
  // covers: position 0 is what the marketplace grid shows, the rest feed the detail carousel
  for (const [key, files] of Object.entries(LISTING_MEDIA)) {
    files.forEach((file, i) => {
      out.push(`INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (${listingRef(key)}, ${q(`${MEDIA_KEY_PREFIX}/${file}`)}, ${i});`);
    });
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
  const meId = me ? `(SELECT id FROM hub_members WHERE email = ${q(me.trim().toLowerCase())})` : undefined;
  if (meId) for (const [key, msgs] of ME_THREADS) pushThread(out, key, meId, `${meId} IS NOT NULL`, msgs);

  out.push(...staySeed(meId));
  out.push(...proSeed(meId));
  return out;
}

export const seedSql = (me?: string) => seedStatements(me).join("\n") + "\n";
export const cleanupSql = () => cleanupStatements().join("\n") + "\n";
