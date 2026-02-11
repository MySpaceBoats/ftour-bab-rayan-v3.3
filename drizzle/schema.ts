import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, json } from "drizzle-orm/mysql-core";

// ============================================
// USERS & AUTHENTICATION
// ============================================

export const userRoleEnum = mysqlEnum("role", [
  "user", "admin", "super_admin", "admin_ops", "admin_boutique", "admin_dons", "scanner",
  "admin_restaurant_particuliers", "admin_restaurant_entreprises", "admin_restaurant_groupes",
  "admin_patisserie", "admin_terroir"
]);

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum.default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// RAMADAN DAYS (Calendrier)
// ============================================

export const ramadanDays = mysqlTable("ramadan_days", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  dayNumber: int("dayNumber").notNull(), // Jour 1-30 du Ramadan
  maxCapacity: int("maxCapacity").notNull().default(50),
  currentCount: int("currentCount").notNull().default(0),
  isClosed: boolean("isClosed").notNull().default(false),
  location: text("location"),
  startTime: varchar("startTime", { length: 10 }), // Format HH:MM
  endTime: varchar("endTime", { length: 10 }),
  instructions: text("instructions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RamadanDay = typeof ramadanDays.$inferSelect;
export type InsertRamadanDay = typeof ramadanDays.$inferInsert;

// ============================================
// VOLUNTEER REGISTRATIONS (Inscriptions bénévoles)
// ============================================

export const volunteerStatusEnum = mysqlEnum("volunteerStatus", ["registered", "confirmed", "present", "absent", "cancelled"]);

export const volunteers = mysqlTable("volunteers", {
  id: int("id").autoincrement().primaryKey(),
  
  // Informations personnelles
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  city: varchar("city", { length: 100 }),
  
  // Lien avec le jour
  dayId: int("dayId").notNull(),
  
  // QR Code et statut - Token sécurisé 128 bits (32 caractères hex)
  qrToken: varchar("qrToken", { length: 64 }).notNull().unique(), // Token sécurisé pour URL /checkin/{token}
  qrStatus: mysqlEnum("qrStatus", ["generated", "validated", "expired", "invalid"]).default("generated").notNull(),
  status: volunteerStatusEnum.default("registered").notNull(),
  
  // Scan info
  scannedAt: timestamp("scannedAt"),
  scannedBy: int("scannedBy"), // ID de l'utilisateur qui a scanné
  
  // Métadonnées
  acceptedTerms: boolean("acceptedTerms").notNull().default(false),
  emailSent: boolean("emailSent").notNull().default(false),
  notes: text("notes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Volunteer = typeof volunteers.$inferSelect;
export type InsertVolunteer = typeof volunteers.$inferInsert;

// ============================================
// SCAN HISTORY (Historique des scans - Audit)
// ============================================

export const scanHistory = mysqlTable("scan_history", {
  id: int("id").autoincrement().primaryKey(),
  volunteerId: int("volunteerId").notNull(),
  scannedBy: int("scannedBy").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // "check_in", "duplicate_attempt", etc.
  success: boolean("success").notNull().default(true),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScanHistory = typeof scanHistory.$inferSelect;
export type InsertScanHistory = typeof scanHistory.$inferInsert;

// ============================================
// GOODIES (Produits)
// ============================================

export const goodies = mysqlTable("goodies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("imageUrl"),
  category: varchar("category", { length: 100 }),
  
  // Badges
  isBestSeller: boolean("isBestSeller").notNull().default(false),
  isNew: boolean("isNew").notNull().default(false),
  isRamadanEdition: boolean("isRamadanEdition").notNull().default(false),
  
  // Stock global (optionnel, le stock réel est par variante)
  totalStock: int("totalStock"),
  
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goodie = typeof goodies.$inferSelect;
export type InsertGoodie = typeof goodies.$inferInsert;

// ============================================
// GOODIE VARIANTS (Variantes: taille, couleur)
// ============================================

export const goodieVariants = mysqlTable("goodie_variants", {
  id: int("id").autoincrement().primaryKey(),
  goodieId: int("goodieId").notNull(),
  size: varchar("size", { length: 20 }), // XS, S, M, L, XL, XXL
  color: varchar("color", { length: 50 }),
  sku: varchar("sku", { length: 50 }),
  stock: int("stock").notNull().default(0),
  priceModifier: decimal("priceModifier", { precision: 10, scale: 2 }).default("0"), // +/- prix
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoodieVariant = typeof goodieVariants.$inferSelect;
export type InsertGoodieVariant = typeof goodieVariants.$inferInsert;

// ============================================
// ENUMS - Définir avant utilisation
// ============================================

export const orderStatusEnum = mysqlEnum("orderStatus", ["reserved", "pending", "confirmed", "delivered", "cancelled"]);
export const donationStatusEnum = mysqlEnum("donationStatus", ["promised", "pending", "received", "cancelled", "handed", "checked_in"]);
export const paymentMethodEnum = mysqlEnum("payment_method", [
  "bank_transfer",
  "cheque",
  "cash",
  "paypal",
  "cmi"
]);
export const orderChannelEnum = mysqlEnum("orderChannel", ["online", "on_site_qr", "on_site_admin"]);
export const moduleTypeEnum = mysqlEnum("moduleType", ["goodies", "pastry", "donation", "ftour"]);
export const businessStatusEnum = mysqlEnum("businessStatus", ["reserved", "confirmed", "handed", "checked_in", "cancelled"]);
export const paymentStatusEnum = mysqlEnum("paymentStatus", [
  "pending",           // En attente (virement, chèque, cash)
  "processing",        // En cours de traitement (PayPal, CIM)
  "paid",              // Payé (PayPal, CIM confirmé)
  "failed",            // Échoué (PayPal, CIM refusé)
  "cancelled",         // Annulé
  "cashed",            // Encaissé (chèque)
  "confirmed"          // Confirmé (après validation admin)
]);

// ============================================
// ORDERS (Commandes)
// ============================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderReference: varchar("orderReference", { length: 20 }).notNull().unique(), // REF-XXXXX
  
  // Client info
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  
  // Montants
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  
  // Statut et retrait
  status: orderStatusEnum.default("reserved").notNull(),
  businessStatus: businessStatusEnum.default("reserved").notNull(),
  channel: orderChannelEnum.default("online").notNull(),
  moduleType: moduleTypeEnum.default("goodies").notNull(),
  paymentStatus: paymentStatusEnum.default("pending").notNull(),
  paymentMethod: paymentMethodEnum.notNull(),
  pickupDate: timestamp("pickupDate"),
  pickupLocation: text("pickupLocation"),
  qrToken: varchar("qrToken", { length: 64 }).unique(),
  
  // Livraison
  deliveryMode: varchar("deliveryMode", { length: 20 }).default("pickup").notNull(), // pickup | home_delivery
  deliveryFee: decimal("deliveryFee", { precision: 10, scale: 2 }).default("0").notNull(),
  deliveryAddress: text("deliveryAddress"), // JSON stringified address
  deliveryPhone: varchar("deliveryPhone", { length: 20 }),
  deliveryInstructions: text("deliveryInstructions"),
  
  // Tracking
  emailSent: boolean("emailSent").notNull().default(false),
  processedBy: int("processedBy"), // Admin qui a traité
  processedAt: timestamp("processedAt"),
  deliveredAt: timestamp("deliveredAt"),
  
  notes: text("notes"),
  deliveryNotes: text("deliveryNotes"), // Notes pour le livreur
  scannedAt: timestamp("scannedAt"),
  scannedBy: int("scannedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================
// ORDER ITEMS (Lignes de commande)
// ============================================

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  goodieId: int("goodieId").notNull(),
  variantId: int("variantId"),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================
// DONATIONS (Promesses de dons)
// ============================================


// Donations table
export const donations = mysqlTable("donations", {
  id: int("id").autoincrement().primaryKey(),
  donationReference: varchar("donationReference", { length: 20 }).notNull().unique(), // DON-XXXXX
  
  // Donateur
  donorName: varchar("donorName", { length: 200 }).notNull(),
  donorEmail: varchar("donorEmail", { length: 320 }).notNull(),
  donorPhone: varchar("donorPhone", { length: 20 }),
  
  // Don
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum.notNull(),
  
  // Optionnel
  message: text("message"), // Intention, dédicace
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  acceptsUpdates: boolean("acceptsUpdates").notNull().default(false),
  
  // Statut
  status: donationStatusEnum.default("promised").notNull(),
  businessStatus: businessStatusEnum.default("reserved").notNull(),
  channel: orderChannelEnum.default("online").notNull(),
  moduleType: moduleTypeEnum.default("donation").notNull(),
  paymentStatus: paymentStatusEnum.default("pending").notNull(),
  qrToken: varchar("qrToken", { length: 64 }).unique(),
  
  // Tracking
  emailSent: boolean("emailSent").notNull().default(false),
  processedBy: int("processedBy"),
  processedAt: timestamp("processedAt"),
  receivedAt: timestamp("receivedAt"),
  scannedAt: timestamp("scannedAt"),
  scannedBy: int("scannedBy"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Donation = typeof donations.$inferSelect;
export type InsertDonation = typeof donations.$inferInsert;

// ============================================
// CONTACT MESSAGES
// ============================================

export const contactMessages = mysqlTable("contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  subject: varchar("subject", { length: 300 }),
  message: text("message").notNull(),
  isRead: boolean("isRead").notNull().default(false),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;

// ============================================
// SITE SETTINGS (Configuration du site)
// ============================================

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// ============================================
// PARTNERS (Partenaires)
// ============================================

export const partners = mysqlTable("partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  logoUrl: text("logoUrl"),
  websiteUrl: text("websiteUrl"),
  description: text("description"),
  category: varchar("category", { length: 100 }), // sponsor, partenaire, média
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// ============================================
// TESTIMONIALS (Témoignages)
// ============================================

export const testimonials = mysqlTable("testimonials", {
  id: int("id").autoincrement().primaryKey(),
  authorName: varchar("authorName", { length: 200 }).notNull(),
  authorRole: varchar("authorRole", { length: 100 }), // Bénévole, Donateur, Partenaire
  content: text("content").notNull(),
  avatarUrl: text("avatarUrl"),
  rating: int("rating"), // 1-5
  isApproved: boolean("isApproved").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

// ============================================
// MEDIA GALLERY (Galerie)
// ============================================

export const mediaGallery = mysqlTable("media_gallery", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  mediaUrl: text("mediaUrl").notNull(),
  mediaType: varchar("mediaType", { length: 20 }).notNull(), // image, video
  thumbnailUrl: text("thumbnailUrl"),
  year: int("year"),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MediaGalleryItem = typeof mediaGallery.$inferSelect;
export type InsertMediaGalleryItem = typeof mediaGallery.$inferInsert;

// ============================================
// FAQ
// ============================================

export const faqItems = mysqlTable("faq_items", {
  id: int("id").autoincrement().primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 100 }), // bénévolat, dons, goodies, général
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FaqItem = typeof faqItems.$inferSelect;
export type InsertFaqItem = typeof faqItems.$inferInsert;


// ============================================
// PAYMENTS (Paiements)
// ============================================

// paymentStatusEnum already defined above (line 242)

// Note: paymentMethodEnum already defined above

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("MAD"),
  paymentMethod: paymentMethodEnum.notNull(),
  paymentReference: varchar("payment_reference", { length: 100 }).notNull().unique(),
  externalTransactionId: varchar("external_transaction_id", { length: 255 }), // PayPal/CIM
  status: paymentStatusEnum.notNull().default("pending"),
  description: text("description"), // Description du paiement (donation, goodies, etc)
  relatedEntityType: varchar("related_entity_type", { length: 50 }), // donation, order, reservation
  relatedEntityId: varchar("related_entity_id", { length: 100 }), // ID de l'entité associée
  
  // Métadonnées supplémentaires
  metadata: json("metadata"), // Données additionnelles (JSON)
  
  // Traçabilité
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  validatedAt: timestamp("validated_at"),
  validatedBy: int("validated_by"), // ID de l'admin qui a validé
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: int("cancelled_by"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ============================================
// PAYMENT LOGS (Journalisation des paiements)
// ============================================

export const paymentLogs = mysqlTable("payment_logs", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: int("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(), // created, validated, cancelled, status_changed
  oldStatus: paymentStatusEnum,
  newStatus: paymentStatusEnum,
  performedBy: int("performed_by"), // ID de l'utilisateur qui a effectué l'action
  notes: text("notes"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentLog = typeof paymentLogs.$inferSelect;
export type InsertPaymentLog = typeof paymentLogs.$inferInsert;

// ============================================
// PAYMENT METHODS CONFIGURATION
// ============================================

export const paymentMethodsConfig = mysqlTable("payment_methods_config", {
  id: int("id").autoincrement().primaryKey(),
  method: paymentMethodEnum.notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Configuration spécifique à chaque moyen
  // Virement bancaire
  bankName: varchar("bank_name", { length: 255 }), // Nom de la banque
  beneficiaryName: varchar("beneficiary_name", { length: 255 }), // Nom du bénéficiaire
  iban: varchar("iban", { length: 34 }), // IBAN
  rib: varchar("rib", { length: 23 }), // RIB (Maroc)
  recommendedLabel: text("recommended_label"), // Libellé recommandé
  
  // Chèque
  chequeOrder: varchar("cheque_order", { length: 255 }), // À l'ordre de
  chequeDepositLocation: text("cheque_deposit_location"), // Lieu de dépôt
  
  // PayPal
  paypalClientId: varchar("paypal_client_id", { length: 255 }),
  paypalClientSecret: varchar("paypal_client_secret", { length: 255 }),
  

  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethodConfig = typeof paymentMethodsConfig.$inferSelect;
export type InsertPaymentMethodConfig = typeof paymentMethodsConfig.$inferInsert;

// ============================================
// PASTRIES (Pâtisserie Solidaire)
// ============================================

export const pastries = mysqlTable("pastries", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("imageUrl"),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Pastry = typeof pastries.$inferSelect;
export type InsertPastry = typeof pastries.$inferInsert;

// ============================================
// PASTRY ORDERS (Commandes Pâtisserie)
// ============================================

export const pastryOrderStatusEnum = mysqlEnum("pastryOrderStatus", ["reserved", "paid", "handed", "cancelled"]);
export const pastryPaymentStatusEnum = mysqlEnum("pastryPaymentStatus", ["pending", "confirmed", "paid", "cancelled"]);

export const pastryOrders = mysqlTable("pastry_orders", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  items: json("items").$type<Array<{ pastryId: number; quantity: number; price: number }>>().notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum.notNull(),
  paymentStatus: pastryPaymentStatusEnum.default("pending").notNull(),
  orderStatus: pastryOrderStatusEnum.default("reserved").notNull(),
  qrToken: varchar("qrToken", { length: 64 }).unique(),
  scannedAt: timestamp("scannedAt"),
  scannedBy: int("scannedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PastryOrder = typeof pastryOrders.$inferSelect;
export type InsertPastryOrder = typeof pastryOrders.$inferInsert;

// ============================================
// QR TOKENS (Jetons QR génériques)
// ============================================

export const qrTokenStatusEnum = mysqlEnum("qrTokenStatus", ["active", "used", "expired", "revoked"]);

export const qrTokens = mysqlTable("qr_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  scope: varchar("scope", { length: 50 }).notNull(), // "volunteer", "pastry", "pastry_quick_buy", etc.
  entityId: int("entityId"), // ID de l'entité associée (pastry_order_id, volunteer_id, etc.)
  status: qrTokenStatusEnum.default("active").notNull(),
  maxUses: int("maxUses").notNull().default(1),
  usesCount: int("usesCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QRToken = typeof qrTokens.$inferSelect;
export type InsertQRToken = typeof qrTokens.$inferInsert;

// ============================================
// QR SCANS (Historique des scans QR)
// ============================================

export const qrScans = mysqlTable("qr_scans", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull(),
  scope: varchar("scope", { length: 50 }).notNull(),
  entityId: int("entityId"),
  validationAction: varchar("validationAction", { length: 50 }).notNull(), // "check_in", "payment_confirmed", "handed", "quick_buy", etc.
  validatedBy: int("validatedBy").notNull(), // ID de l'utilisateur
  success: boolean("success").notNull().default(true),
  errorMessage: text("errorMessage"),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
});

export type QRScan = typeof qrScans.$inferSelect;
export type InsertQRScan = typeof qrScans.$inferInsert;


// ============================================
// COMPANY BOOKINGS (Réservations Entreprise)
// ============================================

export const companyBookingStatusEnum = mysqlEnum("company_booking_status", ["pending", "confirmed", "cancelled"]);
export const companyPaymentStatusEnum = mysqlEnum("company_payment_status", ["pending", "paid", "failed"]);
export const companyPaymentMethodEnum = mysqlEnum("company_payment_method", ["cash", "bank_transfer", "check", "paypal", "cmi"]);

export const companyBookings = mysqlTable("company_bookings", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(), // CBR-2026-000123
  companyName: varchar("companyName", { length: 255 }).notNull(),
  companyICE: varchar("companyICE", { length: 50 }),
  companySector: varchar("companySector", { length: 100 }),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
  participantsCount: int("participantsCount").notNull(),
  date: timestamp("date").notNull(),
  restaurantId: int("restaurantId"),
  slotId: int("slotId"),
  status: companyBookingStatusEnum.default("pending").notNull(),
  paymentMethod: companyPaymentMethodEnum.default("cash"),
  paymentStatus: companyPaymentStatusEnum.default("pending"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyBooking = typeof companyBookings.$inferSelect;
export type InsertCompanyBooking = typeof companyBookings.$inferInsert;

// ============================================
// COMPANY TICKETS (Billets Individuels)
// ============================================

export const companyTicketStatusEnum = mysqlEnum("company_ticket_status", ["issued", "checked_in", "no_show", "cancelled"]);

export const companyTickets = mysqlTable("company_tickets", {
  id: int("id").autoincrement().primaryKey(),
  companyBookingId: int("companyBookingId").notNull().references(() => companyBookings.id),
  ticketCode: varchar("ticketCode", { length: 50 }).notNull().unique(), // TCK-8H2K
  qrToken: varchar("qrToken", { length: 256 }).notNull().unique(), // Token long et non devinable
  participantName: varchar("participantName", { length: 255 }),
  participantEmail: varchar("participantEmail", { length: 320 }),
  participantDepartment: varchar("participantDepartment", { length: 100 }),
  status: companyTicketStatusEnum.default("issued").notNull(),
  checkedInAt: timestamp("checkedInAt"),
  checkedInBy: int("checkedInBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyTicket = typeof companyTickets.$inferSelect;
export type InsertCompanyTicket = typeof companyTickets.$inferInsert;

// ============================================
// COMPANY BOOKING SCANS (Audit des scans)
// ============================================

export const companyBookingScans = mysqlTable("company_booking_scans", {
  id: int("id").autoincrement().primaryKey(),
  companyTicketId: int("companyTicketId").notNull().references(() => companyTickets.id),
  qrToken: varchar("qrToken", { length: 256 }).notNull(),
  result: varchar("result", { length: 50 }).notNull(), // "success", "already_checked_in", "invalid_date", "ticket_cancelled"
  validatedBy: int("validatedBy").notNull(),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
});

export type CompanyBookingScan = typeof companyBookingScans.$inferSelect;
export type InsertCompanyBookingScan = typeof companyBookingScans.$inferInsert;

// ============================================
// RESTAURANT MODULE - SLOTS
// ============================================

export const restaurantSlots = mysqlTable("restaurant_slots", {
  id: int("id").autoincrement().primaryKey(),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  // Capacities
  capJardinGlobal: int("capJardinGlobal").notNull().default(120),
  capBrasserie: int("capBrasserie").notNull().default(50),
  capCorpo: int("capCorpo").notNull().default(50),
  capJardinLibre: int("capJardinLibre").notNull().default(20),
  // Counters (denormalized for performance)
  bookedJardinGlobal: int("bookedJardinGlobal").notNull().default(0),
  bookedBrasserie: int("bookedBrasserie").notNull().default(0),
  bookedCorpo: int("bookedCorpo").notNull().default(0),
  bookedJardinLibre: int("bookedJardinLibre").notNull().default(0),
  isClosed: boolean("isClosed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RestaurantSlot = typeof restaurantSlots.$inferSelect;
export type InsertRestaurantSlot = typeof restaurantSlots.$inferInsert;

// ============================================
// RESTAURANT MODULE - RESERVATIONS
// ============================================

export const restaurantReservationTypeEnum = mysqlEnum("restaurant_reservation_type", ["particulier", "entreprise", "groupe"]);
export const restaurantDisplayChoiceEnum = mysqlEnum("restaurant_display_choice", ["jardin", "brasserie", "corpo"]);
export const restaurantReservationStatusEnum = mysqlEnum("restaurant_reservation_status", [
  "submitted", "pending_confirmation", "confirmed", "rejected", "cancelled", "completed", "no_show"
]);
export const restaurantPaymentStatusEnum = mysqlEnum("restaurant_payment_status", [
  "not_applicable", "pending", "paid", "failed", "refunded"
]);
export const restaurantQrStatusEnum = mysqlEnum("restaurant_qr_status", ["inactive", "active", "used", "revoked"]);

export const restaurantReservations = mysqlTable("restaurant_reservations", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(), // RES-P-XXXXX / RES-E-XXXXX / RES-G-XXXXX
  type: restaurantReservationTypeEnum.notNull(),
  slotId: int("slotId").notNull(),
  displayChoice: restaurantDisplayChoiceEnum.notNull(),
  seatsTotal: int("seatsTotal").notNull(),
  // Contact info (common)
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  // Company fields (entreprise)
  companyName: varchar("companyName", { length: 255 }),
  // Group fields (groupe)
  groupName: varchar("groupName", { length: 255 }),
  groupType: varchar("groupType", { length: 50 }), // asso, famille, tourisme, autre
  // Status
  status: restaurantReservationStatusEnum.default("submitted").notNull(),
  paymentStatus: restaurantPaymentStatusEnum.default("not_applicable").notNull(),
  paymentAmount: decimal("paymentAmount", { precision: 10, scale: 2 }),
  paymentProvider: varchar("paymentProvider", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 100 }),
  // QR
  qrToken: varchar("qrToken", { length: 64 }).unique(),
  qrStatus: restaurantQrStatusEnum.default("inactive"),
  // Hold expiration (for pending_confirmation)
  expiresAt: timestamp("expiresAt"),
  // Tracking
  processedBy: int("processedBy"),
  processedAt: timestamp("processedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RestaurantReservation = typeof restaurantReservations.$inferSelect;
export type InsertRestaurantReservation = typeof restaurantReservations.$inferInsert;

// ============================================
// RESTAURANT MODULE - ALLOCATION PER SUB-SPACE
// ============================================

export const restaurantBucketEnum = mysqlEnum("restaurant_bucket", ["brasserie", "corpo", "jardin_libre"]);

export const restaurantReservationAllocations = mysqlTable("restaurant_reservation_allocations", {
  id: int("id").autoincrement().primaryKey(),
  reservationId: int("reservationId").notNull(),
  bucket: restaurantBucketEnum.notNull(),
  seats: int("seats").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RestaurantReservationAllocation = typeof restaurantReservationAllocations.$inferSelect;
export type InsertRestaurantReservationAllocation = typeof restaurantReservationAllocations.$inferInsert;

// ============================================
// TERROIR MODULE - PRODUCTS
// ============================================

export const terroirProducts = mysqlTable("terroir_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // huile, miel, epices, etc.
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TerroirProduct = typeof terroirProducts.$inferSelect;
export type InsertTerroirProduct = typeof terroirProducts.$inferInsert;

// ============================================
// TERROIR MODULE - PRODUCT VARIANTS
// ============================================

export const terroirProductVariants = mysqlTable("terroir_product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  label: varchar("label", { length: 100 }).notNull(), // "250g", "500ml", "Pack 3"
  sku: varchar("sku", { length: 50 }),
  priceUnit: decimal("priceUnit", { precision: 10, scale: 2 }).notNull(),
  stockTotal: int("stockTotal").notNull().default(0),
  stockReserved: int("stockReserved").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TerroirProductVariant = typeof terroirProductVariants.$inferSelect;
export type InsertTerroirProductVariant = typeof terroirProductVariants.$inferInsert;

// ============================================
// TERROIR MODULE - PICKUP SLOTS
// ============================================

export const terroirPickupSlots = mysqlTable("terroir_pickup_slots", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  startTime: varchar("startTime", { length: 10 }),
  endTime: varchar("endTime", { length: 10 }),
  maxOrders: int("maxOrders"),
  isClosed: boolean("isClosed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TerroirPickupSlot = typeof terroirPickupSlots.$inferSelect;
export type InsertTerroirPickupSlot = typeof terroirPickupSlots.$inferInsert;

// ============================================
// TERROIR MODULE - ORDERS
// ============================================

export const terroirOrderStatusEnum = mysqlEnum("terroirOrderStatus", ["created", "paid", "ready", "picked_up", "cancelled", "no_show"]);
export const terroirPaymentStatusEnum = mysqlEnum("terroirPaymentStatus", ["pending", "paid", "failed", "refunded"]);
export const terroirQrStatusEnum = mysqlEnum("terroirQrStatus", ["inactive", "active", "used", "revoked"]);

export const terroirOrders = mysqlTable("terroir_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderReference: varchar("orderReference", { length: 50 }).notNull().unique(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  pickupSlotId: int("pickupSlotId"),
  status: terroirOrderStatusEnum.default("created").notNull(),
  paymentStatus: terroirPaymentStatusEnum.default("pending").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paymentProvider: varchar("paymentProvider", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 100 }),
  qrToken: varchar("qrToken", { length: 64 }).unique(),
  qrStatus: terroirQrStatusEnum.default("inactive"),
  processedBy: int("processedBy"),
  processedAt: timestamp("processedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TerroirOrder = typeof terroirOrders.$inferSelect;
export type InsertTerroirOrder = typeof terroirOrders.$inferInsert;

// ============================================
// TERROIR MODULE - ORDER ITEMS
// ============================================

export const terroirOrderItems = mysqlTable("terroir_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TerroirOrderItem = typeof terroirOrderItems.$inferSelect;
export type InsertTerroirOrderItem = typeof terroirOrderItems.$inferInsert;


// ============================================
// UNIFIED BOOKING SYSTEM - SPACES
// ============================================

export const spaceKeyEnum = mysqlEnum("space_key", ["brasserie", "corpo", "jardin_libre", "jardin_global"]);

export const spaces = mysqlTable("spaces", {
  id: int("id").autoincrement().primaryKey(),
  key: spaceKeyEnum.notNull().unique(), // brasserie, corpo, jardin_libre, jardin_global
  name: varchar("name", { length: 255 }).notNull(), // "Brasserie", "Salle Corpo", etc.
  capacity: int("capacity").notNull(), // 50, 50, 20, 120
  description: text("description"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Space = typeof spaces.$inferSelect;
export type InsertSpace = typeof spaces.$inferInsert;

// ============================================
// UNIFIED BOOKING SYSTEM - HOLD TRACKING
// ============================================

export const bookingHolds = mysqlTable("booking_holds", {
  id: int("id").autoincrement().primaryKey(),
  reservationId: int("reservationId").notNull(),
  spaceId: int("spaceId").notNull(),
  seatsHeld: int("seatsHeld").notNull(),
  holdExpiresAt: timestamp("holdExpiresAt").notNull(), // 48h from creation
  isExpired: boolean("isExpired").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BookingHold = typeof bookingHolds.$inferSelect;
export type InsertBookingHold = typeof bookingHolds.$inferInsert;
