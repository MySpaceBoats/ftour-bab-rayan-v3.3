// =============================================================================
// Types — Demo Ftour Bab Rayan
// Tous les types décrivent des données 100% fictives, simulées côté client.
// =============================================================================

export type UserRole = "benevole" | "beneficiaire" | "donateur";

export interface DemoUser {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  email: string;
  city: string;
  avatar: string; // initiales ou emoji
  joinedAt: string; // ISO date
  // Spécifique bénévoles
  hours?: number;
  missions?: number;
  // Spécifique bénéficiaires
  ftoursReceived?: number;
  familySize?: number;
  // Spécifique donateurs
  totalDonated?: number;
  donationsCount?: number;
}

export type DonationMethod = "carte" | "virement" | "cash" | "cheque";
export type DonationStatus = "valide" | "en_attente" | "refuse";

export interface DemoDonation {
  id: string;
  donorName: string;
  donorId?: string;
  amount: number; // en MAD
  method: DonationMethod;
  status: DonationStatus;
  createdAt: string; // ISO
  note?: string;
}

export interface DemoFtourDay {
  id: string;
  date: string; // YYYY-MM-DD
  plannedMeals: number;
  servedMeals: number;
  volunteersCount: number;
  beneficiariesCount: number;
  menu: string;
  note?: string;
}

export type PartnerTier = "platine" | "or" | "argent" | "bronze";

export interface DemoPartner {
  id: string;
  name: string;
  sector: string;
  tier: PartnerTier;
  contribution: number; // MAD
  contactName: string;
  contactEmail: string;
  city: string;
  since: string; // ISO
  logo: string; // emoji
}

export type ActivityType =
  | "donation"
  | "volunteer_checkin"
  | "ftour_served"
  | "partner_join"
  | "user_signup";

export interface DemoActivity {
  id: string;
  type: ActivityType;
  label: string;
  createdAt: string; // ISO
  actor: string;
  meta?: Record<string, string | number>;
}

export interface DemoDataset {
  version: number;
  generatedAt: string;
  users: DemoUser[];
  donations: DemoDonation[];
  ftourDays: DemoFtourDay[];
  partners: DemoPartner[];
  activity: DemoActivity[];
}
