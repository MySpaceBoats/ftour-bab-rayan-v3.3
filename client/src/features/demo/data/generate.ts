// =============================================================================
// Générateur de données fictives — noms marocains réalistes, montants cohérents.
// Tout est déterminé par un seed optionnel pour permettre la reproductibilité.
// =============================================================================

import type {
  DemoActivity,
  DemoBlogPost,
  DemoDataset,
  DemoDonation,
  DemoFtourDay,
  DemoOrder,
  DemoOrderItem,
  DemoPartner,
  DemoProduct,
  DemoReservation,
  DemoTeamMember,
  DemoUser,
  ActivityType,
  DonationMethod,
  DonationStatus,
  OrderCategory,
  OrderStatus,
  PartnerTier,
  ProductUnit,
  ReservationStatus,
  ReservationType,
  UserRole,
} from "./types";

export const DEMO_DATASET_VERSION = 2;

const MALE_FIRST_NAMES = [
  "Mohamed", "Ahmed", "Youssef", "Omar", "Khalid", "Hamza", "Ayoub",
  "Mehdi", "Anas", "Yassine", "Zakaria", "Adam", "Rayan", "Bilal",
  "Ismail", "Nabil", "Hicham", "Karim", "Reda", "Amine", "Rachid",
  "Mustapha", "Abdelali", "Said",
];

const FEMALE_FIRST_NAMES = [
  "Fatima", "Aicha", "Khadija", "Salma", "Imane", "Soukaina", "Meryem",
  "Kenza", "Nour", "Hajar", "Sara", "Lina", "Yasmine", "Zineb",
  "Amina", "Ghita", "Rajae", "Siham", "Loubna", "Latifa", "Samira",
  "Oumaima", "Chaimaa", "Asmae",
];

const LAST_NAMES = [
  "El Amrani", "Benali", "Bouzidi", "Chakir", "Tazi", "El Fassi", "Alaoui",
  "Benjelloun", "Bennani", "Cherkaoui", "El Idrissi", "Berrada", "Sefrioui",
  "Kabbaj", "Lahlou", "Mansouri", "Ouazzani", "Zeroual", "El Khatib",
  "Laraki", "Benkirane", "Saidi", "El Ghazali", "Moujahid", "Naciri",
  "Touzani", "Bencheikh", "El Alami", "Sqalli", "Hakkou",
];

const CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Agadir",
  "Meknès", "Oujda", "Kénitra", "Tétouan", "Safi", "El Jadida",
  "Mohammedia", "Essaouira", "Salé",
];

const PARTNER_SECTORS = [
  "Banque", "Télécoms", "Agroalimentaire", "BTP", "Assurance",
  "Énergie", "Distribution", "Tech", "Transport", "Santé",
];

const PARTNER_PREFIXES = [
  "Atlas", "Maghreb", "Royal", "Ocean", "Medina", "Sahara", "Rif",
  "Bab", "Noor", "Baraka", "Zahra", "Jawhara",
];

const PARTNER_SUFFIXES = [
  "Group", "Solutions", "Holding", "Industries", "Logistics", "Services",
  "Capital", "Foundation", "Partners",
];

const MENUS = [
  "Harira, Chebakia, Dattes, Lait",
  "Soupe de légumes, Briouates, Dattes, Thé",
  "Harira, Msemen, Œufs durs, Jus d'orange",
  "Chorba, Makrout, Yaourt, Eau",
  "Harira, Batbout, Fromage, Dattes",
  "Soupe à la tomate, Ghriba, Thé à la menthe",
];

// =============================================================================
// RNG seedé simple (Mulberry32) — pour reproductibilité optionnelle.
// =============================================================================

function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

const int = (rng: Rng, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

const chance = (rng: Rng, p: number) => rng() < p;

const id = (prefix: string, rng: Rng) =>
  `${prefix}_${Math.floor(rng() * 1e9).toString(36)}`;

function moroccanPhone(rng: Rng): string {
  const head = chance(rng, 0.5) ? "06" : "07";
  let rest = "";
  for (let i = 0; i < 8; i++) rest += Math.floor(rng() * 10);
  return `${head}${rest.slice(0, 2)} ${rest.slice(2, 4)} ${rest.slice(4, 6)} ${rest.slice(6, 8)}`;
}

function slugEmail(first: string, last: string, rng: Rng): string {
  const domains = ["gmail.com", "hotmail.com", "outlook.fr", "yahoo.fr", "proton.me"];
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]/g, "");
  return `${normalize(first)}.${normalize(last)}${int(rng, 1, 99)}@${pick(rng, domains)}`;
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// =============================================================================
// Générateurs par module
// =============================================================================

function generateUser(rng: Rng, role: UserRole, now: Date): DemoUser {
  const isFemale = chance(rng, 0.5);
  const firstName = pick(rng, isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  const joinedDaysAgo = int(rng, 1, 720);
  const joinedAt = new Date(now.getTime() - joinedDaysAgo * 86_400_000).toISOString();

  const base: DemoUser = {
    id: id("usr", rng),
    firstName,
    lastName,
    role,
    phone: moroccanPhone(rng),
    email: slugEmail(firstName, lastName, rng),
    city: pick(rng, CITIES),
    avatar: initials(firstName, lastName),
    joinedAt,
  };

  if (role === "benevole") {
    base.hours = int(rng, 6, 180);
    base.missions = int(rng, 1, 24);
  } else if (role === "beneficiaire") {
    base.ftoursReceived = int(rng, 1, 30);
    base.familySize = int(rng, 1, 9);
  } else {
    base.donationsCount = int(rng, 1, 12);
    base.totalDonated = (base.donationsCount ?? 1) * int(rng, 100, 3000);
  }

  return base;
}

function generateDonation(
  rng: Rng,
  donors: DemoUser[],
  now: Date,
): DemoDonation {
  const useKnownDonor = donors.length > 0 && chance(rng, 0.6);
  let donorName: string;
  let donorId: string | undefined;
  if (useKnownDonor) {
    const d = pick(rng, donors);
    donorName = `${d.firstName} ${d.lastName}`;
    donorId = d.id;
  } else {
    donorName = `${pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  }

  const amounts = [50, 100, 200, 300, 500, 1000, 2000, 5000];
  const amount = pick(rng, amounts);
  const daysAgo = int(rng, 0, 90);
  const createdAt = new Date(now.getTime() - daysAgo * 86_400_000 - int(rng, 0, 86_400_000)).toISOString();

  const methods: DonationMethod[] = ["carte", "virement", "cash", "cheque"];
  const statuses: DonationStatus[] = ["valide", "valide", "valide", "en_attente", "refuse"];

  return {
    id: id("don", rng),
    donorName,
    donorId,
    amount,
    method: pick(rng, methods),
    status: pick(rng, statuses),
    createdAt,
  };
}

function generateFtourDay(rng: Rng, date: Date): DemoFtourDay {
  const planned = int(rng, 200, 600);
  const served = Math.max(50, planned - int(rng, 0, 60));
  return {
    id: id("ftr", rng),
    date: date.toISOString().slice(0, 10),
    plannedMeals: planned,
    servedMeals: served,
    volunteersCount: int(rng, 15, 45),
    beneficiariesCount: served,
    menu: pick(rng, MENUS),
  };
}

function generatePartner(rng: Rng, now: Date): DemoPartner {
  const tiers: PartnerTier[] = ["platine", "or", "argent", "bronze"];
  const tier = pick(rng, tiers);
  const contributionByTier: Record<PartnerTier, [number, number]> = {
    platine: [50_000, 200_000],
    or: [20_000, 50_000],
    argent: [8_000, 20_000],
    bronze: [2_000, 8_000],
  };
  const [min, max] = contributionByTier[tier];
  const firstContact = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
  const lastContact = pick(rng, LAST_NAMES);
  const name = `${pick(rng, PARTNER_PREFIXES)} ${pick(rng, PARTNER_SUFFIXES)}`;
  const logos = ["🏢", "🏦", "🏭", "🏪", "🏬", "🌐", "⚡", "🚚", "🩺", "🍞"];
  return {
    id: id("prt", rng),
    name,
    sector: pick(rng, PARTNER_SECTORS),
    tier,
    contribution: int(rng, min, max),
    contactName: `${firstContact} ${lastContact}`,
    contactEmail: slugEmail(firstContact, lastContact, rng),
    city: pick(rng, CITIES),
    since: new Date(now.getTime() - int(rng, 30, 1500) * 86_400_000).toISOString(),
    logo: pick(rng, logos),
  };
}

// ============================================
// Réservations restaurant
// ============================================

const RESERVATION_NOTES = [
  "Table près de la fenêtre si possible",
  "Groupe de collègues pour ftour d'équipe",
  "Allergie fruits à coque - merci",
  "Anniversaire — préparer petite attention",
  "Client VIP, accueil soigné",
];

function generateReservation(rng: Rng, now: Date): DemoReservation {
  const types: ReservationType[] = ["particulier", "groupe", "entreprise"];
  const type = pick(rng, types);
  const statuses: ReservationStatus[] = [
    "confirmee",
    "confirmee",
    "confirmee",
    "en_attente",
    "terminee",
    "annulee",
  ];
  const status = pick(rng, statuses);
  const guestsByType: Record<ReservationType, [number, number]> = {
    particulier: [2, 6],
    groupe: [8, 25],
    entreprise: [15, 80],
  };
  const [gMin, gMax] = guestsByType[type];
  const guests = int(rng, gMin, gMax);

  const daysAgo = int(rng, -7, 14); // certaines dans le futur
  const date = new Date(now.getTime() - daysAgo * 86_400_000);
  const hour = int(rng, 18, 21);
  const minute = pick(rng, ["00", "15", "30", "45"]);

  let customerName: string;
  if (type === "entreprise") {
    customerName = `${pick(rng, PARTNER_PREFIXES)} ${pick(rng, PARTNER_SUFFIXES)}`;
  } else {
    const first = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    customerName = `${first} ${last}`;
  }

  const pricePerGuest = type === "entreprise" ? 180 : type === "groupe" ? 150 : 120;
  const reference = `RES-${int(rng, 10000, 99999)}`;
  const firstContact = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
  const lastContact = pick(rng, LAST_NAMES);

  return {
    id: id("res", rng),
    reference,
    customerName,
    type,
    status,
    guests,
    date: date.toISOString().slice(0, 10),
    time: `${String(hour).padStart(2, "0")}:${minute}`,
    phone: moroccanPhone(rng),
    email: slugEmail(firstContact, lastContact, rng),
    note: chance(rng, 0.3) ? pick(rng, RESERVATION_NOTES) : undefined,
    createdAt: new Date(now.getTime() - int(rng, 1, 30) * 86_400_000).toISOString(),
    totalAmount: pricePerGuest * guests,
  };
}

// ============================================
// Boutique / Commandes
// ============================================

const PRODUCTS_BY_CATEGORY: Record<OrderCategory, { name: string; price: number }[]> = {
  goodies: [
    { name: "T-shirt Bab Rayan", price: 120 },
    { name: "Mug solidaire", price: 60 },
    { name: "Tote bag édition 12", price: 80 },
    { name: "Casquette brodée", price: 90 },
    { name: "Carnet Ramadan", price: 45 },
  ],
  terroir: [
    { name: "Huile d'olive 1L", price: 95 },
    { name: "Miel de thym 500g", price: 140 },
    { name: "Amlou artisanal", price: 75 },
    { name: "Dattes Medjool 1kg", price: 180 },
    { name: "Thé à la menthe vrac", price: 55 },
  ],
  patisserie: [
    { name: "Boîte Chebakia 500g", price: 85 },
    { name: "Assortiment Briouates", price: 110 },
    { name: "Makrout amande", price: 70 },
    { name: "Ghriba variée", price: 90 },
    { name: "Plateau Ramadan prestige", price: 260 },
  ],
};

function generateOrder(rng: Rng, now: Date): DemoOrder {
  const categories: OrderCategory[] = ["goodies", "terroir", "patisserie"];
  const category = pick(rng, categories);
  const productsCatalog = PRODUCTS_BY_CATEGORY[category];
  const itemsCount = int(rng, 1, 3);
  const items: DemoOrderItem[] = Array.from({ length: itemsCount }, () => {
    const p = pick(rng, productsCatalog);
    return {
      productName: p.name,
      quantity: int(rng, 1, 4),
      unitPrice: p.price,
    };
  });
  const total = items.reduce((a, it) => a + it.quantity * it.unitPrice, 0);

  const statuses: OrderStatus[] = [
    "livree",
    "livree",
    "prete",
    "en_preparation",
    "annulee",
  ];
  const first = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
  const last = pick(rng, LAST_NAMES);

  return {
    id: id("ord", rng),
    reference: `CMD-${int(rng, 10000, 99999)}`,
    customerName: `${first} ${last}`,
    category,
    status: pick(rng, statuses),
    items,
    total,
    createdAt: new Date(now.getTime() - int(rng, 0, 45) * 86_400_000).toISOString(),
    city: pick(rng, CITIES),
  };
}

// ============================================
// Inventaire produits
// ============================================

const INVENTORY_TEMPLATES: {
  name: string;
  category: DemoProduct["category"];
  unit: ProductUnit;
  unitCost: number;
  threshold: number;
}[] = [
  { name: "Huile d'olive 1L", category: "terroir", unit: "u", unitCost: 75, threshold: 30 },
  { name: "Miel de thym", category: "terroir", unit: "kg", unitCost: 220, threshold: 8 },
  { name: "Dattes Medjool", category: "terroir", unit: "kg", unitCost: 120, threshold: 20 },
  { name: "Farine T55", category: "ingredients", unit: "kg", unitCost: 8, threshold: 50 },
  { name: "Semoule fine", category: "ingredients", unit: "kg", unitCost: 12, threshold: 40 },
  { name: "Lait entier", category: "ingredients", unit: "l", unitCost: 8, threshold: 60 },
  { name: "Œufs (plateau 30)", category: "ingredients", unit: "pack", unitCost: 45, threshold: 15 },
  { name: "Chebakia 500g", category: "patisserie", unit: "u", unitCost: 55, threshold: 25 },
  { name: "Briouates", category: "patisserie", unit: "u", unitCost: 70, threshold: 20 },
  { name: "T-shirt Bab Rayan", category: "goodies", unit: "u", unitCost: 60, threshold: 40 },
  { name: "Mug solidaire", category: "goodies", unit: "u", unitCost: 25, threshold: 30 },
  { name: "Tote bag édition 12", category: "goodies", unit: "u", unitCost: 35, threshold: 35 },
  { name: "Sac emballage repas", category: "logistique", unit: "pack", unitCost: 90, threshold: 10 },
  { name: "Couverts compostables", category: "logistique", unit: "pack", unitCost: 75, threshold: 12 },
  { name: "Gobelets écologiques", category: "logistique", unit: "pack", unitCost: 60, threshold: 20 },
];

function generateProduct(
  rng: Rng,
  template: (typeof INVENTORY_TEMPLATES)[number],
  now: Date,
): DemoProduct {
  const stockFactor = rng();
  // 20% of products are near or below threshold (creates alerting)
  const lowStock = stockFactor < 0.2;
  const stock = lowStock
    ? int(rng, 0, template.threshold)
    : int(rng, template.threshold + 1, template.threshold * 4);
  return {
    id: id("prd", rng),
    name: template.name,
    category: template.category,
    unit: template.unit,
    stock,
    threshold: template.threshold,
    unitCost: template.unitCost,
    lastMovementAt: new Date(now.getTime() - int(rng, 0, 20) * 86_400_000).toISOString(),
  };
}

// ============================================
// Équipe / Trombinoscope
// ============================================

const TEAM_ROLES = [
  "Président",
  "Trésorier",
  "Responsable bénévoles",
  "Coordinateur cuisine",
  "Responsable partenariats",
  "Responsable logistique",
  "Responsable communication",
  "Responsable hygiène",
  "Animateur jeunesse",
  "Référent QR & scan",
  "Responsable accueil",
  "Référent sécurité",
];

const TEAM_BIOS = [
  "Bénévole depuis la 8e édition, passionné par l'engagement associatif.",
  "Coordonne les équipes sur le terrain avec rigueur et bienveillance.",
  "Formé en gestion, veille à la transparence de chaque opération.",
  "Orchestre les arrivées et départs des bénévoles chaque soir.",
  "Met son réseau au service de l'association depuis plusieurs années.",
  "Allie créativité et méthode pour chaque campagne de communication.",
];

function generateTeamMember(rng: Rng, role: string, now: Date): DemoTeamMember {
  const female = chance(rng, 0.5);
  const firstName = pick(rng, female ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  return {
    id: id("tm", rng),
    firstName,
    lastName,
    role,
    avatar: `${firstName[0]}${lastName[0]}`.toUpperCase(),
    city: pick(rng, CITIES),
    joinedAt: new Date(now.getTime() - int(rng, 90, 1800) * 86_400_000).toISOString(),
    bio: pick(rng, TEAM_BIOS),
  };
}

// ============================================
// Blog / Témoignages
// ============================================

const BLOG_TEMPLATES = [
  {
    title: "Mon premier soir comme bénévole",
    excerpt:
      "Une expérience qui m'a marquée à vie : l'effervescence de la cuisine, les sourires à la sortie…",
    tag: "Témoignage",
    cover: "🌙",
  },
  {
    title: "Comment nous avons servi 600 repas en un soir",
    excerpt:
      "Coulisses de l'organisation : logistique, équipes, horaires et petits secrets de chef.",
    tag: "Coulisses",
    cover: "🍲",
  },
  {
    title: "Le sens du partage pendant le Ramadan",
    excerpt:
      "Quand un simple plat devient un pont entre familles, bénévoles et bénéficiaires.",
    tag: "Réflexion",
    cover: "🤝",
  },
  {
    title: "Rencontre avec nos partenaires historiques",
    excerpt:
      "Portrait croisé de trois entreprises qui soutiennent l'opération depuis la 1re édition.",
    tag: "Partenariat",
    cover: "🏢",
  },
  {
    title: "Préparer 2000 chebakias : le making-of",
    excerpt:
      "Mains expertes, recettes familiales et bienveillance : plongée dans l'atelier pâtisserie.",
    tag: "Pâtisserie",
    cover: "🧁",
  },
  {
    title: "Le QR code qui change tout",
    excerpt:
      "Retour sur l'implémentation du scan bénévoles et ses bénéfices sur le terrain.",
    tag: "Tech",
    cover: "📲",
  },
];

function generateBlogPost(
  rng: Rng,
  template: (typeof BLOG_TEMPLATES)[number],
  now: Date,
): DemoBlogPost {
  const firstName = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  return {
    id: id("blg", rng),
    title: template.title,
    excerpt: template.excerpt,
    author: `${firstName} ${lastName}`,
    publishedAt: new Date(now.getTime() - int(rng, 1, 180) * 86_400_000).toISOString(),
    reactions: int(rng, 12, 480),
    comments: int(rng, 0, 45),
    tag: template.tag,
    cover: template.cover,
  };
}

function generateActivity(
  rng: Rng,
  users: DemoUser[],
  donations: DemoDonation[],
  partners: DemoPartner[],
  now: Date,
): DemoActivity[] {
  const items: DemoActivity[] = [];
  const TYPES: ActivityType[] = [
    "donation",
    "volunteer_checkin",
    "ftour_served",
    "partner_join",
    "user_signup",
    "reservation_new",
    "order_paid",
  ];

  for (let i = 0; i < 30; i++) {
    const type = pick(rng, TYPES);
    const minutesAgo = int(rng, 1, 60 * 24 * 7);
    const createdAt = new Date(now.getTime() - minutesAgo * 60_000).toISOString();
    let actor = "Anonyme";
    let label = "Activité enregistrée";
    const meta: Record<string, string | number> = {};

    if (type === "donation" && donations.length) {
      const d = pick(rng, donations);
      actor = d.donorName;
      label = `Don de ${d.amount.toLocaleString("fr-FR")} MAD reçu`;
      meta.amount = d.amount;
    } else if (type === "volunteer_checkin") {
      const benevoles = users.filter((u) => u.role === "benevole");
      if (benevoles.length) {
        const u = pick(rng, benevoles);
        actor = `${u.firstName} ${u.lastName}`;
        label = "Check-in bénévole sur site";
      }
    } else if (type === "ftour_served") {
      const count = int(rng, 10, 120);
      actor = "Équipe cuisine";
      label = `${count} repas servis ce soir`;
      meta.count = count;
    } else if (type === "partner_join" && partners.length) {
      const p = pick(rng, partners);
      actor = p.name;
      label = `Nouveau partenaire ${p.tier.toUpperCase()} rejoint`;
    } else if (type === "user_signup") {
      const firstName = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
      const lastName = pick(rng, LAST_NAMES);
      actor = `${firstName} ${lastName}`;
      label = "Inscription bénévole";
    } else if (type === "reservation_new") {
      const firstName = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
      const lastName = pick(rng, LAST_NAMES);
      actor = `${firstName} ${lastName}`;
      const guests = int(rng, 2, 40);
      label = `Nouvelle réservation · ${guests} couverts`;
      meta.guests = guests;
    } else if (type === "order_paid") {
      const firstName = pick(rng, chance(rng, 0.5) ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
      const lastName = pick(rng, LAST_NAMES);
      actor = `${firstName} ${lastName}`;
      const amount = int(rng, 80, 1200);
      label = `Commande boutique · ${amount} MAD`;
      meta.amount = amount;
    }

    items.push({
      id: id("act", rng),
      type,
      label,
      createdAt,
      actor,
      meta,
    });
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// =============================================================================
// API publique
// =============================================================================

export function generateDemoDataset(seed?: number): DemoDataset {
  const now = new Date();
  const rng = createRng(seed ?? Math.floor(Math.random() * 2 ** 31));

  const users: DemoUser[] = [
    ...Array.from({ length: 28 }, () => generateUser(rng, "benevole", now)),
    ...Array.from({ length: 42 }, () => generateUser(rng, "beneficiaire", now)),
    ...Array.from({ length: 18 }, () => generateUser(rng, "donateur", now)),
  ];

  const donors = users.filter((u) => u.role === "donateur");
  const donations: DemoDonation[] = Array.from({ length: 60 }, () =>
    generateDonation(rng, donors, now),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 21 derniers jours, du plus ancien au plus récent
  const ftourDays: DemoFtourDay[] = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (20 - i));
    return generateFtourDay(rng, d);
  });

  const partners: DemoPartner[] = Array.from({ length: 14 }, () =>
    generatePartner(rng, now),
  );

  const reservations: DemoReservation[] = Array.from({ length: 36 }, () =>
    generateReservation(rng, now),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const orders: DemoOrder[] = Array.from({ length: 48 }, () =>
    generateOrder(rng, now),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const products: DemoProduct[] = INVENTORY_TEMPLATES.map((t) =>
    generateProduct(rng, t, now),
  );

  const team: DemoTeamMember[] = TEAM_ROLES.map((role) =>
    generateTeamMember(rng, role, now),
  );

  const blogPosts: DemoBlogPost[] = BLOG_TEMPLATES.map((t) =>
    generateBlogPost(rng, t, now),
  ).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const activity = generateActivity(rng, users, donations, partners, now);

  return {
    version: DEMO_DATASET_VERSION,
    generatedAt: now.toISOString(),
    users,
    donations,
    ftourDays,
    partners,
    activity,
    reservations,
    orders,
    products,
    team,
    blogPosts,
  };
}
