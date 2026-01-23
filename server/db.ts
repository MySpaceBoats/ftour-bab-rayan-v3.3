import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  ramadanDays, InsertRamadanDay, RamadanDay,
  volunteers, InsertVolunteer, Volunteer,
  scanHistory, InsertScanHistory,
  goodies, InsertGoodie, Goodie,
  goodieVariants, InsertGoodieVariant, GoodieVariant,
  orders, InsertOrder, Order,
  orderItems, InsertOrderItem,
  donations, InsertDonation, Donation,
  contactMessages, InsertContactMessage,
  siteSettings, InsertSiteSetting,
  partners, InsertPartner,
  testimonials, InsertTestimonial,
  mediaGallery, InsertMediaGalleryItem,
  faqItems, InsertFaqItem
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// USER HELPERS
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'super_admin';
      updateSet.role = 'super_admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: InsertUser['role']) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ============================================
// RAMADAN DAYS HELPERS
// ============================================

export async function createRamadanDay(day: InsertRamadanDay) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ramadanDays).values(day);
  return result[0].insertId;
}

export async function getRamadanDays() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ramadanDays).orderBy(asc(ramadanDays.date));
}

export async function getRamadanDayById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ramadanDays).where(eq(ramadanDays.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateRamadanDay(id: number, data: Partial<InsertRamadanDay>) {
  const db = await getDb();
  if (!db) return;
  await db.update(ramadanDays).set(data).where(eq(ramadanDays.id, id));
}

export async function incrementDayCount(dayId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(ramadanDays)
    .set({ currentCount: sql`${ramadanDays.currentCount} + 1` })
    .where(eq(ramadanDays.id, dayId));
}

export async function decrementDayCount(dayId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(ramadanDays)
    .set({ currentCount: sql`GREATEST(${ramadanDays.currentCount} - 1, 0)` })
    .where(eq(ramadanDays.id, dayId));
}

// ============================================
// VOLUNTEER HELPERS
// ============================================

export async function createVolunteer(volunteer: InsertVolunteer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(volunteers).values(volunteer);
  return result[0].insertId;
}

export async function getVolunteerByQrCode(qrCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(volunteers).where(eq(volunteers.qrCode, qrCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getVolunteerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(volunteers).where(eq(volunteers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getVolunteersByDay(dayId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(volunteers).where(eq(volunteers.dayId, dayId)).orderBy(desc(volunteers.createdAt));
}

export async function getAllVolunteers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(volunteers).orderBy(desc(volunteers.createdAt));
}

export async function updateVolunteer(id: number, data: Partial<InsertVolunteer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(volunteers).set(data).where(eq(volunteers.id, id));
}

export async function markVolunteerPresent(id: number, scannedBy: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(volunteers).set({
    status: 'present',
    scannedAt: new Date(),
    scannedBy
  }).where(eq(volunteers.id, id));
}

export async function getVolunteerStats() {
  const db = await getDb();
  if (!db) return { total: 0, present: 0, absent: 0 };
  
  const result = await db.select({
    total: sql<number>`COUNT(*)`.as('total'),
    present: sql<number>`SUM(CASE WHEN ${volunteers.status} = 'present' THEN 1 ELSE 0 END)`.as('present'),
    absent: sql<number>`SUM(CASE WHEN ${volunteers.status} = 'absent' THEN 1 ELSE 0 END)`.as('absent'),
  }).from(volunteers);
  
  const stats = result[0];
  return {
    total: Number(stats?.total) || 0,
    present: Number(stats?.present) || 0,
    absent: Number(stats?.absent) || 0,
  };
}

// ============================================
// SCAN HISTORY HELPERS
// ============================================

export async function createScanHistory(scan: InsertScanHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(scanHistory).values(scan);
}

export async function getScanHistoryByVolunteer(volunteerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanHistory).where(eq(scanHistory.volunteerId, volunteerId)).orderBy(desc(scanHistory.createdAt));
}

// ============================================
// GOODIES HELPERS
// ============================================

export async function createGoodie(goodie: InsertGoodie) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(goodies).values(goodie);
  return result[0].insertId;
}

export async function getActiveGoodies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goodies).where(eq(goodies.isActive, true)).orderBy(asc(goodies.sortOrder));
}

export async function getAllGoodies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goodies).orderBy(asc(goodies.sortOrder));
}

export async function getGoodieById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(goodies).where(eq(goodies.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateGoodie(id: number, data: Partial<InsertGoodie>) {
  const db = await getDb();
  if (!db) return;
  await db.update(goodies).set(data).where(eq(goodies.id, id));
}

// ============================================
// GOODIE VARIANTS HELPERS
// ============================================

export async function createGoodieVariant(variant: InsertGoodieVariant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(goodieVariants).values(variant);
  return result[0].insertId;
}

export async function getVariantsByGoodie(goodieId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goodieVariants).where(eq(goodieVariants.goodieId, goodieId));
}

export async function getVariantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(goodieVariants).where(eq(goodieVariants.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateVariantStock(id: number, quantity: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(goodieVariants)
    .set({ stock: sql`GREATEST(${goodieVariants.stock} - ${quantity}, 0)` })
    .where(eq(goodieVariants.id, id));
}

// ============================================
// ORDERS HELPERS
// ============================================

export async function createOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(order);
  return result[0].insertId;
}

export async function createOrderItem(item: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orderItems).values(item);
}

export async function getOrderByReference(reference: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.orderReference, reference)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function updateOrderStatus(id: number, status: Order['status'], processedBy?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({
    status,
    processedBy,
    processedAt: new Date()
  }).where(eq(orders.id, id));
}

export async function getOrderStats() {
  const db = await getDb();
  if (!db) return { total: 0, reserved: 0, paid: 0, delivered: 0 };
  
  const result = await db.select({
    total: sql<number>`COUNT(*)`,
    reserved: sql<number>`SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END)`,
    paid: sql<number>`SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)`,
    delivered: sql<number>`SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)`,
    totalAmount: sql<number>`SUM(CAST(totalAmount AS DECIMAL(10,2)))`,
  }).from(orders);
  
  return result[0] || { total: 0, reserved: 0, paid: 0, delivered: 0, totalAmount: 0 };
}

// ============================================
// DONATIONS HELPERS
// ============================================

export async function createDonation(donation: InsertDonation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(donations).values(donation);
  return result[0].insertId;
}

export async function getDonationByReference(reference: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(donations).where(eq(donations.donationReference, reference)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDonationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(donations).where(eq(donations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllDonations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(donations).orderBy(desc(donations.createdAt));
}

export async function updateDonationStatus(id: number, status: Donation['status'], processedBy?: number) {
  const db = await getDb();
  if (!db) return;
  const updateData: Partial<InsertDonation & { processedBy: number; processedAt: Date; receivedAt: Date }> = {
    status,
    processedBy,
    processedAt: new Date()
  };
  if (status === 'received') {
    updateData.receivedAt = new Date();
  }
  await db.update(donations).set(updateData).where(eq(donations.id, id));
}

export async function getDonationStats() {
  const db = await getDb();
  if (!db) return { total: 0, promised: 0, received: 0, totalAmount: 0, receivedAmount: 0 };
  
  const result = await db.select({
    total: sql<number>`COUNT(*)`,
    promised: sql<number>`SUM(CASE WHEN status = 'promised' THEN 1 ELSE 0 END)`,
    received: sql<number>`SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END)`,
    totalAmount: sql<number>`SUM(CAST(amount AS DECIMAL(10,2)))`,
    receivedAmount: sql<number>`SUM(CASE WHEN status = 'received' THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END)`,
  }).from(donations);
  
  return result[0] || { total: 0, promised: 0, received: 0, totalAmount: 0, receivedAmount: 0 };
}

// ============================================
// CONTACT MESSAGES HELPERS
// ============================================

export async function createContactMessage(message: InsertContactMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactMessages).values(message);
  return result[0].insertId;
}

export async function getAllContactMessages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
}

export async function markMessageAsRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, id));
}

// ============================================
// SITE SETTINGS HELPERS
// ============================================

export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return result.length > 0 ? result[0].value : undefined;
}

export async function setSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(siteSettings).values({ key, value, description })
    .onDuplicateKeyUpdate({ set: { value, description } });
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteSettings);
}

// ============================================
// PARTNERS HELPERS
// ============================================

export async function createPartner(partner: InsertPartner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(partners).values(partner);
  return result[0].insertId;
}

export async function getActivePartners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(partners).where(eq(partners.isActive, true)).orderBy(asc(partners.sortOrder));
}

export async function getAllPartners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(partners).orderBy(asc(partners.sortOrder));
}

// ============================================
// TESTIMONIALS HELPERS
// ============================================

export async function createTestimonial(testimonial: InsertTestimonial) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(testimonials).values(testimonial);
  return result[0].insertId;
}

export async function getApprovedTestimonials() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testimonials)
    .where(and(eq(testimonials.isApproved, true), eq(testimonials.isActive, true)))
    .orderBy(asc(testimonials.sortOrder));
}

export async function getAllTestimonials() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testimonials).orderBy(asc(testimonials.sortOrder));
}

// ============================================
// MEDIA GALLERY HELPERS
// ============================================

export async function createMediaItem(item: InsertMediaGalleryItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mediaGallery).values(item);
  return result[0].insertId;
}

export async function getActiveMediaItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaGallery).where(eq(mediaGallery.isActive, true)).orderBy(asc(mediaGallery.sortOrder));
}

export async function getAllMediaItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaGallery).orderBy(asc(mediaGallery.sortOrder));
}

// ============================================
// FAQ HELPERS
// ============================================

export async function createFaqItem(item: InsertFaqItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(faqItems).values(item);
  return result[0].insertId;
}

export async function getActiveFaqItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqItems).where(eq(faqItems.isActive, true)).orderBy(asc(faqItems.sortOrder));
}

export async function getFaqItemsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqItems)
    .where(and(eq(faqItems.category, category), eq(faqItems.isActive, true)))
    .orderBy(asc(faqItems.sortOrder));
}

export async function getAllFaqItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqItems).orderBy(asc(faqItems.sortOrder));
}

// ============================================
// UTILITY: Generate unique references
// ============================================

export function generateOrderReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CMD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateDonationReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'DON-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateQrCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
