// =============================================================================
// Générateur de données fictives — noms marocains réalistes, montants cohérents.
// Tout est déterminé par un seed optionnel pour permettre la reproductibilité.
// =============================================================================

import type {
  DemoActivity,
  DemoDataset,
  DemoDonation,
  DemoFtourDay,
  DemoPartner,
  DemoUser,
  ActivityType,
  DonationMethod,
  DonationStatus,
  PartnerTier,
  UserRole,
} from "./types";

export const DEMO_DATASET_VERSION = 1;

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

  const activity = generateActivity(rng, users, donations, partners, now);

  return {
    version: DEMO_DATASET_VERSION,
    generatedAt: now.toISOString(),
    users,
    donations,
    ftourDays,
    partners,
    activity,
  };
}
