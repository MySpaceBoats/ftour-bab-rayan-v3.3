import { eq, and, desc } from "drizzle-orm";
import { ENV } from "./_core/env";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { restaurantReservations } from "../drizzle/schema";

// Initialize Drizzle ORM with MySQL connection
let db: any;

async function getDb() {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!db) {
    const connection = await mysql.createConnection(ENV.databaseUrl);
    db = drizzle(connection);
  }
  return db;
}

// ============================================
// RESTAURANT RESERVATIONS SERVICES
// ============================================

/**
 * Créer une nouvelle réservation
 */
export async function createRestaurantReservation(data: {
  reference: string;
  type: 'particulier' | 'entreprise' | 'groupe';
  name: string;
  email: string;
  phone: string;
  date: Date;
  seatsTotal: number;
  qrToken: string;
  companyName?: string;
  groupName?: string;
  groupType?: string;
  notes?: string;
}) {
  try {
    const database = await getDb();
    const result = await database.insert(restaurantReservations).values({
      reference: data.reference,
      type: data.type,
      name: data.name,
      email: data.email,
      phone: data.phone,
      date: data.date,
      seatsTotal: data.seatsTotal,
      qrToken: data.qrToken,
      companyName: data.companyName,
      groupName: data.groupName,
      groupType: data.groupType,
      notes: data.notes,
      status: 'pending_validation',
      paymentStatus: 'not_requested',
      qrStatus: 'inactive',
      createdAt: new Date(),
    });

    // Récupérer la réservation créée
    const reservation = await getRestaurantReservationByReference(data.reference);

    if (!reservation) {
      throw new Error('Impossible de récupérer la réservation créée');
    }

    return reservation;
  } catch (error) {
    console.error("[createRestaurantReservation] Error:", error);
    throw error;
  }
}

/**
 * Récupérer une réservation par référence
 */
export async function getRestaurantReservationByReference(reference: string) {
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(restaurantReservations)
      .where(eq(restaurantReservations.reference, reference))
      .limit(1);

    // Return single object instead of array
    return result[0] || null;
  } catch (error) {
    console.error("[getRestaurantReservationByReference] Error:", error);
    throw error;
  }
}

/**
 * Récupérer une réservation par QR token
 */
export async function getRestaurantReservationByQrToken(qrToken: string) {
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(restaurantReservations)
      .where(eq(restaurantReservations.qrToken, qrToken))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[getRestaurantReservationByQrToken] Error:", error);
    throw error;
  }
}

/**
 * Récupérer une réservation par ID
 */
export async function getRestaurantReservationById(id: number) {
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(restaurantReservations)
      .where(eq(restaurantReservations.id, id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[getRestaurantReservationById] Error:", error);
    throw error;
  }
}

/**
 * Lister les réservations avec filtres
 */
export async function listRestaurantReservations(filters?: {
  type?: 'particulier' | 'entreprise' | 'groupe';
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  try {
    const database = await getDb();
    const queryLimit = filters?.limit || 200;
    const queryOffset = filters?.offset || 0;

    const conditions = [];
    if (filters?.type) {
      conditions.push(eq(restaurantReservations.type, filters.type));
    }

    const result = await database
      .select()
      .from(restaurantReservations)
      .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
      .orderBy(desc(restaurantReservations.createdAt))
      .limit(queryLimit)
      .offset(queryOffset);

    return result;
  } catch (error) {
    console.error("[listRestaurantReservations] Error:", error);
    throw error;
  }
}

/**
 * Mettre à jour le statut d'une réservation
 */
export async function updateRestaurantReservationStatus(
  id: number,
  status: 'pending_validation' | 'validated_pending_payment' | 'paid_confirmed' | 'refused' | 'cancelled' | 'completed' | 'no_show'
) {
  try {
    const database = await getDb();
    await database.update(restaurantReservations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(restaurantReservations.id, id));

    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[updateRestaurantReservationStatus] Error:", error);
    throw error;
  }
}

/**
 * Mettre à jour le statut de paiement
 */
export async function updateRestaurantReservationPaymentStatus(
  id: number,
  paymentStatus: 'not_requested' | 'pending_payment' | 'paid' | 'failed' | 'refunded'
) {
  try {
    const database = await getDb();
    await database.update(restaurantReservations)
      .set({
        paymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(restaurantReservations.id, id));

    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[updateRestaurantReservationPaymentStatus] Error:", error);
    throw error;
  }
}

/**
 * Activer le QR code
 */
export async function activateQrCode(id: number) {
  try {
    const database = await getDb();
    await database.update(restaurantReservations)
      .set({
        qrStatus: 'active',
        status: 'paid_confirmed',
        paymentStatus: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(restaurantReservations.id, id));

    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[activateQrCode] Error:", error);
    throw error;
  }
}

/**
 * Marquer un QR code comme utilisé
 */
export async function markQrCodeAsUsed(qrToken: string) {
  try {
    const database = await getDb();
    const result = await database
      .select()
      .from(restaurantReservations)
      .where(eq(restaurantReservations.qrToken, qrToken))
      .limit(1);

    const reservation = result[0];
    if (!reservation) {
      throw new Error("QR code not found");
    }

    await database.update(restaurantReservations)
      .set({
        qrStatus: 'used',
        updatedAt: new Date(),
      })
      .where(eq(restaurantReservations.id, reservation.id));

    return await getRestaurantReservationById(reservation.id);
  } catch (error) {
    console.error("[markQrCodeAsUsed] Error:", error);
    throw error;
  }
}

/**
 * Annuler une réservation
 */
export async function cancelRestaurantReservation(id: number) {
  try {
    const database = await getDb();
    await database.update(restaurantReservations)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(restaurantReservations.id, id));

    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[cancelRestaurantReservation] Error:", error);
    throw error;
  }
}

/**
 * Marquer une réservation comme no-show
 */
export async function markRestaurantReservationAsNoShow(id: number) {
  try {
    const database = await getDb();
    await database.update(restaurantReservations)
      .set({
        status: 'no_show',
        updatedAt: new Date(),
      })
      .where(eq(restaurantReservations.id, id));

    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[markRestaurantReservationAsNoShow] Error:", error);
    throw error;
  }
}
