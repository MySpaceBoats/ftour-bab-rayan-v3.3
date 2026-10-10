/**
 * Demo data for the Pro tab (pro_* tables): complete professional profiles, a feed with link posts, comments and
 * likes, job offers (phone-only contact), application / private conversations and a couple of reports.
 * Links all point to exemple.invalid (a reserved TLD: they can never resolve to a real site).
 */
import { D, H, PEOPLE, ago, demoText, mid, phoneOf, q, type Msg } from "./common";

interface Profile { headline: string; company: string; skills: string[]; open: boolean }
/** The marker prefixes the visible headline (same approach as display_name); company names carry "(fictif)". */
const PROFILES: Record<string, Profile> = {
  yasmine: { headline: "Responsable événementiel", company: "Atelier Horizon (fictif)", skills: ["Organisation d'événements", "Décoration", "Gestion d'équipe", "Accueil du public", "Budget événementiel"], open: false },
  karim: { headline: "Chargé d'accueil et de relation client", company: "Cabinet Exemple Conseil (fictif)", skills: ["Relation client", "Arabe, français, anglais", "Gestion de conflits", "Pack Office"], open: true },
  salma: { headline: "Coordinatrice de projets associatifs", company: "Association Exemple (fictive)", skills: ["Coordination de bénévoles", "Gestion de projet", "Modération", "Communication", "Suivi de budget"], open: false },
  omar: { headline: "Technicien logistique et distribution", company: "Transports Exemple (fictif)", skills: ["Logistique", "Gestion des stocks", "Permis B", "Préparation de commandes", "Excel"], open: true },
  nadia: { headline: "Cheffe pâtissière", company: "Pâtisserie Exemple (fictive)", skills: ["Pâtisserie marocaine", "HACCP", "Cuisine de masse", "Gestion des commandes"], open: false },
  mehdi: { headline: "Étudiant ingénieur en recherche de stage", company: "École Exemple d'Ingénieurs (fictive)", skills: ["Python", "Excel", "Gestion de projet", "Logistique", "Électronique"], open: true },
  imane: { headline: "Assistante administrative", company: "Cabinet Exemple Santé (fictif)", skills: ["Secrétariat", "Word et Excel", "Accueil", "Classement et archivage"], open: true },
  reda: { headline: "Chauffeur-livreur indépendant", company: "Livraisons Exemple (fictif)", skills: ["Conduite", "Livraison", "Planification de tournées", "Relation client"], open: true },
  hajar: { headline: "Responsable RH et planification", company: "Groupe Exemple Fès (fictif)", skills: ["Planification", "Recrutement", "Droit du travail", "Formation", "Paie"], open: false },
  anas: { headline: "Lycéen, premiers jobs d'été", company: "Lycée Exemple (fictif)", skills: ["Bénévolat", "Informatique", "Travail en équipe", "Anglais"], open: true },
};

interface ProPost { k: string; a: string; h: number; body: string; link?: string }
const POSTS: ProPost[] = [
  { k: "cv", a: "hajar", h: 80, body: "Conseil du jour pour vos candidatures : un CV d'une page, un mail de trois lignes et un numéro où l'on vous joint. Pas besoin de plus pour un premier contact. 📎", link: "https://exemple.invalid/guides/cv-une-page" },
  { k: "stage", a: "mehdi", h: 74, body: "Je cherche un stage de fin d'études en logistique ou supply chain (4 à 6 mois, Casablanca ou Rabat). Mon bénévolat m'a appris à gérer des flux de repas en temps réel 😄 Si vous connaissez une équipe qui recrute, un message m'aide énormément." },
  { k: "coordination", a: "salma", h: 70, body: "Retour d'expérience : coordonner 120 bénévoles sur un mois, ça s'apprend. Trois règles qui marchent : un briefing court, un référent par poste, un remerciement le soir même.", link: "https://exemple.invalid/retours/coordonner-des-benevoles" },
  { k: "atelier-patisserie", a: "nadia", h: 64, body: "Je prépare un atelier de pâtisserie marocaine pour débutants à Marrakech en novembre. Je cherche une salle (20 m² suffisent) et quelqu'un pour les photos. Échange de services possible." },
  { k: "dernier-km", a: "omar", h: 58, body: "Logistique du dernier kilomètre : on parle beaucoup de vitesse, mais le vrai gain vient de la préparation de la veille. Ma méthode en cinq étapes :", link: "https://exemple.invalid/logistique/dernier-kilometre" },
  { k: "relation-client", a: "karim", h: 52, body: "Après quatre ans à l'accueil, je cherche à évoluer vers la relation client en entreprise (Rabat ou Casablanca). Trilingue arabe-français-anglais, ouvert aux CDD comme aux CDI." },
  { k: "recrute", a: "yasmine", h: 46, body: "Nous cherchons une personne pour renforcer l'équipe événementielle (CDD de 3 mois, Casablanca). Tous les détails sont dans l'onglet Offres ! ✨" },
  { k: "job-ete", a: "anas", h: 40, body: "Lycéen en première année du bac, je cherche un petit job d'été ou un stage d'observation de quelques jours. Je suis sérieux, ponctuel, et je sais utiliser Excel et Canva." },
  { k: "livraison", a: "reda", h: 36, body: "J'ai quelques créneaux libres en livraison la semaine prochaine (Casablanca, voiture personnelle). Idéal pour commerçants ou petits producteurs." },
  { k: "premier-poste", a: "imane", h: 30, body: "Je viens de terminer une formation en secrétariat médical. Avez-vous des conseils pour un premier poste dans un cabinet ? Merci d'avance 🙏" },
  { k: "desistements", a: "hajar", h: 26, body: "Question aux RH et coordinateurs : comment gérez-vous les désistements de dernière minute ? De mon côté : une liste d'attente et un message de relance la veille." },
  { k: "article", a: "salma", h: 22, body: "Un article intéressant sur le bénévolat de compétences, ça pourrait inspirer nos équipes 👇", link: "https://exemple.invalid/articles/benevolat-de-competences" },
  { k: "merci-stage", a: "mehdi", h: 16, body: "Merci à tous pour vos réponses ! J'ai trois pistes de stage grâce à vous. Je vous tiens au courant ✌️" },
  { k: "atelier-stock", a: "omar", h: 10, body: "Atelier gratuit samedi : initiation aux bases de la gestion de stock sur tableur. 15 places, Casablanca, 10h-12h. Inscription par message." },
  { k: "spam", a: "anas", h: 8, body: "GAGNEZ 5000 DH PAR JOUR depuis chez vous !!! Aucune expérience, écrivez-moi vite 💰💰", link: "https://exemple.invalid/gagner-vite" },
  { k: "merci-annonce", a: "yasmine", h: 3, body: "Merci à celles et ceux qui ont partagé mon annonce. Déjà trois candidatures ! 🙌" },
];
const post = (k: string) => POSTS.find(p => p.k === k)!;

/** Real, freely licensed photos (media/, see CREDITS.md) on some Pro posts, bucket-relative keys like the Fil ones. */
export const PRO_POST_MEDIA: Record<string, string[]> = {
  "atelier-patisserie": ["photo-chebakia.jpg", "photo-kaab.jpg"],
  cv: ["pro-bureau.jpg"],
  "dernier-km": ["pro-livraison.jpg"],
  recrute: ["pro-decoration.jpg"],
  coordination: ["pro-reunion.jpg"],
  "relation-client": ["photo-the-menthe.jpg"],
};
const POST_LIKES = [5, 4, 7, 3, 6, 5, 8, 4, 3, 5, 6, 4, 5, 7, 0, 3];

/** [post key, author, minutes after the post, text] */
const COMMENTS: [string, string, number, string][] = [
  ["cv", "mehdi", 40, "Merci Hajar, je refais mon CV ce soir."],
  ["cv", "imane", 90, "Très utile ! Faut-il mettre une photo ?"],
  ["cv", "hajar", 130, "@Imane c'est facultatif, privilégie un CV clair et aéré."],
  ["stage", "omar", 30, "Je connais une équipe logistique à Casablanca, je t'écris en privé."],
  ["stage", "hajar", 55, "Pense à valoriser ton expérience de coordination des flux."],
  ["stage", "mehdi", 80, "@Omar merci beaucoup, j'attends ton message !"],
  ["coordination", "yasmine", 25, "Le remerciement du soir, c'est vraiment ce qui fait tenir les équipes."],
  ["coordination", "karim", 60, "Un référent par poste : adopté."],
  ["coordination", "nadia", 100, "Très juste, merci pour le partage."],
  ["atelier-patisserie", "yasmine", 30, "Je connais une salle à Casablanca mais pas à Marrakech, désolée !"],
  ["atelier-patisserie", "imane", 70, "Super projet ! Je partage autour de moi."],
  ["dernier-km", "reda", 40, "La préparation de la veille, je confirme : ça change tout en livraison."],
  ["dernier-km", "mehdi", 65, "Merci Omar, je note les cinq étapes pour mon rapport de stage."],
  ["relation-client", "salma", 35, "Ton profil est top pour la relation client, je te mets en relation avec quelqu'un."],
  ["relation-client", "yasmine", 60, "Trilingue, c'est un vrai atout."],
  ["relation-client", "karim", 90, "@Salma merci, je suis preneur !"],
  ["recrute", "imane", 20, "Je candidate ce soir !"],
  ["recrute", "yasmine", 40, "@Imane avec plaisir, j'attends ton message."],
  ["recrute", "hajar", 70, "Belle équipe, je recommande."],
  ["job-ete", "reda", 30, "Je peux te prendre en observation une demi-journée chez moi."],
  ["job-ete", "anas", 50, "@Reda merci, c'est très gentil !"],
  ["job-ete", "salma", 90, "Pense à préparer quelques questions, ça marque toujours."],
  ["livraison", "nadia", 30, "Intéressée pour des livraisons de pâtisseries à Casablanca, je t'écris."],
  ["livraison", "reda", 50, "@Nadia avec plaisir."],
  ["premier-poste", "hajar", 25, "Mets en avant ta rigueur et ton sens de l'accueil, c'est ce qu'on cherche."],
  ["premier-poste", "karim", 45, "Un stage d'observation d'une journée peut aider à se lancer."],
  ["premier-poste", "salma", 80, "Des cabinets recrutent dans ton coin, je t'envoie un message."],
  ["desistements", "salma", 20, "La liste d'attente marche très bien chez nous aussi."],
  ["desistements", "omar", 45, "Le message de relance la veille : indispensable."],
  ["desistements", "yasmine", 70, "Nous ajoutons un contact de remplacement par créneau."],
  ["article", "hajar", 20, "Merci pour le lien, je le partage à mon équipe."],
  ["merci-stage", "omar", 15, "Content d'avoir pu aider !"],
  ["merci-stage", "hajar", 30, "Bravo, tiens-nous au courant."],
  ["atelier-stock", "mehdi", 20, "Je m'inscris !"],
  ["atelier-stock", "reda", 35, "Très bonne initiative."],
  ["atelier-stock", "imane", 50, "Il reste une place ? Je t'écris."],
  ["atelier-stock", "omar", 65, "@Imane oui, il en reste trois."],
  ["spam", "salma", 12, "C'est une arnaque classique, merci de ne pas poster ça."],
  ["merci-annonce", "karim", 10, "Bravo Yasmine !"],
];

interface Job { k: string; poster: string; h: number; title: string; company: string; city: string; type: string; status: "open" | "closed"; description: string }
const JOBS: Job[] = [
  { k: "animateur", poster: "salma", h: 72, title: "Animateur(trice) bénévole, ateliers jeunes", company: "Association Exemple (fictive)", city: "Casablanca", type: "benevolat", status: "open",
    description: "Nous cherchons des animateurs pour des ateliers de soutien scolaire et de loisirs créatifs, un à deux après-midis par semaine. Aucune expérience exigée, un entretien d'accueil de 30 minutes suffit. Idéal pour un étudiant ou un lycéen motivé." },
  { k: "stage-rh", poster: "hajar", h: 60, title: "Stage RH, 4 mois", company: "Groupe Exemple Fès (fictif)", city: "Fès", type: "stage", status: "open",
    description: "Stage en ressources humaines : planification des équipes, suivi des absences, accueil des nouveaux collaborateurs. Vous seconderez la responsable RH sur des missions concrètes. Niveau bac+3 minimum, bon relationnel et maîtrise d'Excel demandés." },
  { k: "commis", poster: "nadia", h: 54, title: "Commis de pâtisserie", company: "Pâtisserie Exemple (fictive)", city: "Marrakech", type: "cdi", status: "open",
    description: "Notre atelier de pâtisserie marocaine recrute un commis pour la préparation des gâteaux et la mise en boîte des commandes. Horaires du matin, du mardi au samedi. Formation en interne, nous cherchons surtout quelqu'un de soigneux et ponctuel." },
  { k: "preparateur", poster: "omar", h: 48, title: "Préparateur(trice) de commandes, CDD saison", company: "Transports Exemple (fictif)", city: "Casablanca", type: "cdd", status: "closed",
    description: "Préparation et expédition de commandes dans un entrepôt, pour la période de forte activité. Le poste a été pourvu : merci à toutes les personnes qui ont candidaté. Nous gardons vos coordonnées pour la prochaine saison." },
  { k: "evenementiel", poster: "yasmine", h: 44, title: "Assistant(e) événementiel, CDD de 3 mois", company: "Atelier Horizon (fictif)", city: "Casablanca", type: "cdd", status: "open",
    description: "Vous assistez l'équipe sur la préparation et le déroulé d'événements : logistique, accueil des invités, suivi des prestataires. Disponibilité possible en soirée et le week-end. Une première expérience en accueil ou en bénévolat est un vrai plus." },
  { k: "livreur", poster: "reda", h: 34, title: "Livreur partenaire, remplacement d'été", company: "Livraisons Exemple (fictif)", city: "Casablanca", type: "cdd", status: "closed",
    description: "Remplacement de deux mois pour des livraisons de colis légers à Casablanca. Véhicule personnel requis. L'offre est désormais fermée, merci de votre intérêt." },
  { k: "site-web", poster: "karim", h: 28, title: "Refonte d'un site vitrine, mission freelance de 3 semaines", company: "Cabinet Exemple Conseil (fictif)", city: "Rabat", type: "freelance", status: "open",
    description: "Refonte d'un site vitrine d'une dizaine de pages pour une petite structure, avec un hébergement existant. Vous livrez un site simple à maintenir, avec un back-office de base. Budget à discuter selon votre expérience, contact téléphonique en priorité." },
  { k: "faux-job", poster: "anas", h: 7, title: "Gagnez gros : assistant(e) à domicile", company: "Entreprise Exemple (fictive)", city: "Casablanca", type: "freelance", status: "open",
    description: "Travaillez depuis chez vous, 5000 DH par jour garantis, aucune expérience demandée. Contactez-moi vite pour plus de détails." },
];
const job = (k: string) => JOBS.find(j => j.k === k)!;

/** [creator, other, job key | null, messages (a = creator, o = other)]. Creator = the applicant for job threads. */
const THREADS: [string, string, string | null, Msg[]][] = [
  ["imane", "yasmine", "evenementiel", [
    ["a", 40 * H, "Bonjour Yasmine, votre annonce d'assistante événementielle m'intéresse. J'ai une formation de secrétariat et j'aime l'organisation.", true],
    ["o", 38 * H, "Bonjour Imane, merci ! Avez-vous déjà travaillé sur des événements ?", true],
    ["a", 36 * H, "Pas en entreprise, mais j'ai aidé à l'accueil et au service de l'Iftar cette saison.", true],
    ["o", 34 * H, "C'est exactement ce qui m'intéresse. Pouvez-vous m'envoyer votre CV et vos disponibilités ?", true],
    ["a", 30 * H, "Bien sûr, je vous l'envoie ce soir. Je suis disponible dès lundi.", true],
    ["o", 28 * H, "Parfait. Je vous propose un entretien jeudi à 11h, au bureau ou en visio ?", false],
  ]],
  ["mehdi", "omar", null, [
    ["a", 60 * H, "Bonjour Omar, merci pour ton aide ! Je cherche un stage en logistique, tu connais quelqu'un ?", true],
    ["o", 58 * H, "Oui, mon ancien responsable cherche un stagiaire pour la haute saison.", true],
    ["a", 56 * H, "Génial ! Quel profil recherche-t-il ?", true],
    ["o", 54 * H, "Un étudiant en ingénierie qui aime le terrain et sait manipuler Excel.", true],
    ["a", 50 * H, "C'est tout moi. Je t'envoie mon CV ?", true],
    ["o", 48 * H, "Envoie-le moi, je le transmets avec un petit mot.", true],
    ["a", 20 * H, "Merci Omar, je te tiens au courant dès que j'ai un retour !", false],
  ]],
  ["anas", "salma", "animateur", [
    ["a", 30 * H, "Bonjour Salma, je suis en première année du bac, l'animation d'ateliers pour jeunes m'intéresse beaucoup.", true],
    ["o", 26 * H, "Bonjour Anas ! Tu as déjà encadré des plus jeunes ?", true],
    ["a", 22 * H, "J'aide mon petit frère avec ses devoirs et j'ai animé un atelier à l'école.", true],
    ["o", 18 * H, "Super. Viens mardi à 17h rencontrer l'équipe, on regardera ensemble.", false],
  ]],
  ["karim", "hajar", null, [
    ["a", 90 * H, "Bonjour Hajar, tu as plus d'expérience en RH que moi : un conseil pour négocier un poste en relation client ?", true],
    ["o", 85 * H, "Prépare trois exemples concrets de situations difficiles que tu as résolues.", true],
    ["a", 80 * H, "Comme l'accueil des familles qui arrivent sans réservation ?", true],
    ["o", 75 * H, "Exactement ! Raconte le problème, ce que tu as fait et le résultat.", true],
    ["a", 70 * H, "Merci, ça m'aide beaucoup.", true],
  ]],
  ["reda", "omar", "preparateur", [
    ["a", 80 * H, "Bonjour Omar, votre offre de préparateur de commandes m'intéresse.", true],
    ["o", 76 * H, "Merci Reda, je viens de la fermer, le poste est pourvu. Je vous garde en tête pour la prochaine.", true],
    ["a", 74 * H, "Pas de souci, merci d'avoir répondu.", true],
  ]],
];

/** The person running the demo applies to the volunteer-animator offer: two unread answers. */
const ME_THREAD: [string, string, Msg[]] = ["salma", "animateur", [
  ["a", 5 * H, "Bonjour Salma, votre offre d'animateur bénévole m'intéresse. Est-elle toujours ouverte ?", true],
  ["o", 4 * H, "Bonjour ! Oui, il reste des places, merci pour votre candidature.", false],
  ["o", 3 * H, "Pouvez-vous me dire quels jours vous êtes disponible ?", false],
]];

const POST_REPORT: [string, string, string] = ["spam", "salma", "Promesse de gains irréalistes, probable arnaque"];
const JOB_REPORT: [string, string, string] = ["faux-job", "hajar", "Offre floue et gains irréalistes"];

const DPP = `(SELECT id FROM pro_posts WHERE member_id IN ${D})`;
const DPC = `(SELECT id FROM pro_comments WHERE member_id IN ${D} OR post_id IN ${DPP})`;
const DPJ = `(SELECT id FROM pro_jobs WHERE member_id IN ${D})`;
const DPT = `(SELECT id FROM pro_threads WHERE member_a IN ${D} OR member_b IN ${D} OR created_by IN ${D} OR job_id IN ${DPJ})`;

export function proCleanup(): string[] {
  return [
    `DELETE FROM pro_reports WHERE member_id IN ${D} OR (target_type = 'post' AND target_id IN ${DPP}) OR (target_type = 'comment' AND target_id IN ${DPC}) OR (target_type = 'job' AND target_id IN ${DPJ});`,
    `DELETE FROM pro_messages WHERE sender_id IN ${D} OR thread_id IN ${DPT};`,
    `DELETE FROM pro_threads WHERE id IN ${DPT};`,
    `DELETE FROM pro_comments WHERE id IN ${DPC};`,
    `DELETE FROM pro_likes WHERE member_id IN ${D} OR post_id IN ${DPP};`,
    `DELETE FROM pro_post_media WHERE post_id IN ${DPP};`,
    `DELETE FROM pro_posts WHERE member_id IN ${D};`,
    `DELETE FROM pro_jobs WHERE member_id IN ${D};`,
    `DELETE FROM pro_profiles WHERE member_id IN ${D};`,
  ];
}

const postRef = (p: ProPost) => `(SELECT id FROM pro_posts WHERE member_id = ${mid(p.a)} AND body = ${q(demoText(p.body))})`;
const jobRef = (j: Job) => `(SELECT id FROM pro_jobs WHERE member_id = ${mid(j.poster)} AND title = ${q(j.title)})`;

function pushThread(out: string[], creator: string, other: string, jobKey: string | null, msgs: Msg[], guard: string) {
  const job_ = jobKey ? job(jobKey) : null;
  const jid = job_ ? `COALESCE(${jobRef(job_)}, 0)` : "0";
  const lo = `min(${creator}, ${other})`, hi = `max(${creator}, ${other})`;
  out.push(
    `INSERT INTO pro_threads (member_a, member_b, job_id, created_by, created_at, last_message_at) SELECT ${lo}, ${hi}, ${jid}, ${creator}, ${ago(msgs[0][1])}, ${ago(msgs[msgs.length - 1][1])} WHERE ${guard};`,
  );
  const tref = `(SELECT id FROM pro_threads WHERE member_a = ${lo} AND member_b = ${hi} AND job_id = ${jid})`;
  for (const [who, min, text, read] of msgs) {
    out.push(
      `INSERT INTO pro_messages (thread_id, sender_id, body, created_at, read_at) SELECT ${tref}, ${who === "a" ? creator : other}, ${q(text)}, ${ago(min)}, ${read ? ago(min - 5) : "NULL"} WHERE ${tref} IS NOT NULL;`,
    );
  }
}

/** @param meId SQL expression resolving the real member who should also get a Pro application thread (optional) */
export function proSeed(meId?: string): string[] {
  const out: string[] = [];
  for (const p of PEOPLE) {
    const pr = PROFILES[p.key];
    out.push(
      `INSERT INTO pro_profiles (member_id, headline, company, city, skills, open_to_work, updated_at) VALUES (${mid(p.key)}, ${q(demoText(pr.headline))}, ${q(pr.company)}, ${q(p.city)}, ${q(JSON.stringify(pr.skills))}, ${pr.open ? 1 : 0}, ${ago(60 * H)});`,
    );
  }
  for (const p of POSTS) {
    out.push(`INSERT INTO pro_posts (member_id, body, link, status, created_at) VALUES (${mid(p.a)}, ${q(demoText(p.body))}, ${p.link ? q(p.link) : "NULL"}, 'visible', ${ago(p.h * H)});`);
  }
  for (const [key, files] of Object.entries(PRO_POST_MEDIA)) {
    files.forEach((file, i) => out.push(`INSERT INTO pro_post_media (post_id, r2_key, position) VALUES (${postRef(post(key))}, ${q(`demo/${file}`)}, ${i});`));
  }
  for (const [pk, a, delay, text] of COMMENTS) {
    const p = post(pk);
    out.push(`INSERT INTO pro_comments (post_id, member_id, body, status, created_at) VALUES (${postRef(p)}, ${mid(a)}, ${q(text)}, 'visible', ${ago(p.h * H - delay)});`);
  }
  POSTS.forEach((p, i) => {
    const likers = new Set<string>();
    for (let k = 0; likers.size < POST_LIKES[i] && k < PEOPLE.length * 2; k++) {
      const cand = PEOPLE[(i * 3 + k) % PEOPLE.length].key;
      if (cand !== p.a) likers.add(cand);
    }
    for (const l of likers) out.push(`INSERT OR IGNORE INTO pro_likes (post_id, member_id) VALUES (${postRef(p)}, ${mid(l)});`);
  });
  for (const j of JOBS) {
    out.push(
      `INSERT INTO pro_jobs (member_id, title, company, city, type, description, contact, status, created_at, updated_at) VALUES (${mid(j.poster)}, ${q(j.title)}, ${q(j.company)}, ${q(j.city)}, ${q(j.type)}, ${q(demoText(j.description))}, ${q(phoneOf(j.poster))}, ${q(j.status)}, ${ago(j.h * H)}, ${ago(j.h * H)});`,
    );
  }
  for (const [creator, other, jobKey, msgs] of THREADS) pushThread(out, mid(creator), mid(other), jobKey, msgs, "1");
  if (meId) pushThread(out, meId, mid(ME_THREAD[0]), ME_THREAD[1], ME_THREAD[2], `${meId} IS NOT NULL`);

  const [pk, rep, reason] = POST_REPORT;
  out.push(`INSERT INTO pro_reports (target_type, target_id, member_id, reason) VALUES ('post', ${postRef(post(pk))}, ${mid(rep)}, ${q(reason)});`);
  const [jk, jrep, jreason] = JOB_REPORT;
  out.push(`INSERT INTO pro_reports (target_type, target_id, member_id, reason) VALUES ('job', ${jobRef(job(jk))}, ${mid(jrep)}, ${q(jreason)});`);
  return out;
}
