import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, json } from "drizzle-orm/mysql-core";

// ============================================
// USERS & AUTHENTICATION
// ============================================

export const userRoleEnum = mysqlEnum("role", ["user", "admin", "super_admin", "admin_ops", "admin_boutique", "admin_dons", "scanner"]);

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
// ORDERS (Commandes goodies)
// ============================================

export const orderStatusEnum = mysqlEnum("orderStatus", ["reserved", "confirmed", "paid", "delivered", "cancelled"]);

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
  pickupDate: timestamp("pickupDate"),
  pickupLocation: text("pickupLocation"),
  
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

export const donationStatusEnum = mysqlEnum("donationStatus", ["promised", "pending", "received", "cancelled"]);

export const paymentMethodEnum = mysqlEnum("payment_method", [
  "bank_transfer",
  "cheque",
  "cash",
  "paypal"
]);

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
  
  // Tracking
  emailSent: boolean("emailSent").notNull().default(false),
  processedBy: int("processedBy"),
  processedAt: timestamp("processedAt"),
  receivedAt: timestamp("receivedAt"),
  
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

export const paymentStatusEnum = mysqlEnum("payment_status", [
  "pending",           // En attente (virement, chèque, cash)
  "processing",        // En cours de traitement (PayPal, CIM)
  "paid",              // Payé (PayPal, CIM confirmé)
  "failed",            // Échoué (PayPal, CIM refusé)
  "cancelled",         // Annulé
  "cashed",            // Encaissé (chèque)
  "confirmed"          // Confirmé (après validation admin)
]);

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
