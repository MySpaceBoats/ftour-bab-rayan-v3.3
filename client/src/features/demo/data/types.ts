// =============================================================================
// Types — Demo Ftour Bab Rayan
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
  avatar: string;
  joinedAt: string;
  hours?: number;
  missions?: number;
  ftoursReceived?: number;
  familySize?: number;
  totalDonated?: number;
  donationsCount?: number;
}

export type DonationMethod = "carte" | "virement" | "cash" | "cheque";
export type DonationStatus = "valide" | "en_attente" | "refuse";

export interface DemoDonation {
  id: string;
  donorName: string;
  donorId?: string;
  amount: number;
  method: DonationMethod;
  status: DonationStatus;
  createdAt: string;
  note?: string;
}

export interface DemoFtourDay {
  id: string;
  date: string;
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
  contribution: number;
  contactName: string;
  contactEmail: string;
  city: string;
  since: string;
  logo: string;
}

export type ActivityType =
  | "donation"
  | "volunteer_checkin"
  | "ftour_served"
  | "partner_join"
  | "user_signup"
  | "reservation_new"
  | "order_paid";

export interface DemoActivity {
  id: string;
  type: ActivityType;
  label: string;
  createdAt: string;
  actor: string;
  meta?: Record<string, string | number>;
}

// ============================================
// Réservations restaurant
// ============================================

export type ReservationType = "particulier" | "groupe" | "entreprise";
export type ReservationStatus =
  | "confirmee"
  | "en_attente"
  | "annulee"
  | "terminee";

export interface DemoReservation {
  id: string;
  reference: string;
  customerName: string;
  type: ReservationType;
  status: ReservationStatus;
  guests: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  phone: string;
  email: string;
  note?: string;
  createdAt: string;
  totalAmount: number; // MAD
}

// ============================================
// Boutique / Commandes
// ============================================

export type OrderCategory = "goodies" | "terroir" | "patisserie";
export type OrderStatus = "en_preparation" | "prete" | "livree" | "annulee";

export interface DemoOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface DemoOrder {
  id: string;
  reference: string;
  customerName: string;
  category: OrderCategory;
  status: OrderStatus;
  items: DemoOrderItem[];
  total: number;
  createdAt: string;
  city: string;
}

// ============================================
// Inventaire produits
// ============================================

export type ProductUnit = "u" | "kg" | "l" | "pack";

export interface DemoProduct {
  id: string;
  name: string;
  category: OrderCategory | "ingredients" | "logistique";
  unit: ProductUnit;
  stock: number;
  threshold: number;
  unitCost: number; // MAD
  lastMovementAt: string;
}

// ============================================
// Équipe / Trombinoscope
// ============================================

export interface DemoTeamMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar: string; // initials
  city: string;
  joinedAt: string;
  bio: string;
}

// ============================================
// Blog / Témoignages
// ============================================

export interface DemoBlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  reactions: number;
  comments: number;
  tag: string;
  cover: string; // emoji
}

// ============================================
// Dataset complet
// ============================================

export interface DemoDataset {
  version: number;
  generatedAt: string;
  users: DemoUser[];
  donations: DemoDonation[];
  ftourDays: DemoFtourDay[];
  partners: DemoPartner[];
  activity: DemoActivity[];
  reservations: DemoReservation[];
  orders: DemoOrder[];
  products: DemoProduct[];
  team: DemoTeamMember[];
  blogPosts: DemoBlogPost[];
}
