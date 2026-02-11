/**
 * Unified Booking Allocation Engine
 * 
 * Centralized allocation logic for restaurant reservations
 * Handles optimization rules and capacity management
 */

import { 
  restaurantReservations, 
  restaurantReservationAllocations,
  restaurantSlots,
  bookingHolds
} from "../drizzle/schema";
import { eq, and, sum } from "drizzle-orm";
import { ENV } from "./_core/env";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

// Initialize Drizzle ORM with MySQL connection
let db: any;

async function getDb() {
  if (!db) {
    const connection = await mysql.createConnection(ENV.databaseUrl);
    db = drizzle(connection);
  }
  return db;
}

export type ReservationType = "particulier" | "groupe" | "entreprise";
export type SpaceChoice = "jardin" | "brasserie" | "corpo";
export type SpaceKey = "brasserie" | "corpo" | "jardin_libre" | "jardin_global";

/**
 * Allocation rules based on reservation type
 * Defines which spaces are eligible and priority order
 */
const ALLOCATION_RULES: Record<ReservationType, Record<SpaceChoice, SpaceKey[]>> = {
  particulier: {
    jardin: ["jardin_libre", "brasserie"], // Prefer jardin_libre, fallback to brasserie
    brasserie: ["brasserie", "jardin_libre"], // Prefer brasserie, fallback to jardin_libre
    corpo: [], // Not eligible for corpo
  },
  groupe: {
    jardin: ["jardin_libre", "brasserie"],
    brasserie: ["brasserie", "jardin_libre"],
    corpo: [], // Not eligible for corpo
  },
  entreprise: {
    jardin: ["jardin_libre", "corpo"], // Prefer jardin_libre, fallback to corpo
    brasserie: [], // Not eligible for brasserie
    corpo: ["corpo", "jardin_libre"], // Prefer corpo, fallback to jardin_libre
  },
};

/**
 * Get available capacity for a space in a given slot
 */
export async function getAvailableCapacity(
  slotId: number,
  spaceKey: SpaceKey
): Promise<number> {
  const database = await getDb();
  const slot = await database.query.restaurantSlots.findFirst({
    where: eq(restaurantSlots.id, slotId),
  });

  if (!slot) return 0;

  // Get capacity based on space key
  const capacityMap: Record<SpaceKey, number> = {
    brasserie: slot.capBrasserie,
    corpo: slot.capCorpo,
    jardin_libre: slot.capJardinLibre,
    jardin_global: slot.capJardinGlobal,
  };

  const capacity = capacityMap[spaceKey];

  // Get booked count based on space key
  const bookedMap: Record<SpaceKey, number> = {
    brasserie: slot.bookedBrasserie,
    corpo: slot.bookedCorpo,
    jardin_libre: slot.bookedJardinLibre,
    jardin_global: slot.bookedJardinGlobal,
  };

  const booked = bookedMap[spaceKey];

  return Math.max(0, capacity - booked);
}

/**
 * Get all available capacities for a slot
 */
export async function getSlotCapacities(slotId: number) {
  const database = await getDb();
  const slot = await database.query.restaurantSlots.findFirst({
    where: eq(restaurantSlots.id, slotId),
  });

  if (!slot) {
    return {
      brasserie: 0,
      corpo: 0,
      jardin_libre: 0,
      jardin_global: 0,
    };
  }

  return {
    brasserie: Math.max(0, slot.capBrasserie - slot.bookedBrasserie),
    corpo: Math.max(0, slot.capCorpo - slot.bookedCorpo),
    jardin_libre: Math.max(0, slot.capJardinLibre - slot.bookedJardinLibre),
    jardin_global: Math.max(0, slot.capJardinGlobal - slot.bookedJardinGlobal),
  };
}

/**
 * Attempt to allocate seats using the optimization rules
 * Returns the allocated space key and seats, or null if impossible
 */
export async function attemptAllocation(
  slotId: number,
  type: ReservationType,
  choice: SpaceChoice,
  seatsRequested: number
): Promise<{ space: SpaceKey; seats: number } | null> {
  const database = await getDb();
  const rules = ALLOCATION_RULES[type][choice];

  if (rules.length === 0) {
    // Type not eligible for this choice
    return null;
  }

  // Try each eligible space in priority order
  for (const spaceKey of rules) {
    const available = await getAvailableCapacity(slotId, spaceKey);

    if (available >= seatsRequested) {
      return { space: spaceKey, seats: seatsRequested };
    }
  }

  // No space has enough capacity
  return null;
}

/**
 * Allocate seats to a reservation (confirms the allocation)
 */
export async function allocateSeats(
  reservationId: number,
  slotId: number,
  space: SpaceKey,
  seats: number
): Promise<void> {
  const database = await getDb();
  // Create allocation record
  await database.insert(restaurantReservationAllocations).values({
    reservationId,
    bucket: space,
    seats,
  });

  // Update slot booked counters
  const slot = await database.query.restaurantSlots.findFirst({
    where: eq(restaurantSlots.id, slotId),
  });

  if (!slot) throw new Error("Slot not found");

  const updateMap: Record<SpaceKey, string> = {
    brasserie: "bookedBrasserie",
    corpo: "bookedCorpo",
    jardin_libre: "bookedJardinLibre",
    jardin_global: "bookedJardinGlobal",
  };

  const field = updateMap[space];

  // Increment the booked counter
  await db.execute(
    `UPDATE restaurant_slots SET ${field} = ${field} + ${seats} WHERE id = ${slotId}`
  );
}

/**
 * Release seats from a reservation (for cancellations)
 */
export async function releaseSeats(
  reservationId: number,
  slotId: number
): Promise<void> {
  const database = await getDb();
  // Get allocation records
  const allocations = await database.query.restaurantReservationAllocations.findMany({
    where: eq(restaurantReservationAllocations.reservationId, reservationId),
  });

  // Release each allocation
  for (const allocation of allocations) {
    const updateMap: Record<string, string> = {
      brasserie: "bookedBrasserie",
      corpo: "bookedCorpo",
      jardin_libre: "bookedJardinLibre",
    };

    const field = updateMap[allocation.bucket];
    if (field) {
      await db.execute(
        `UPDATE restaurant_slots SET ${field} = ${field} - ${allocation.seats} WHERE id = ${slotId}`
      );
    }

    // Delete allocation record
    await database.delete(restaurantReservationAllocations).where(
      eq(restaurantReservationAllocations.id, allocation.id)
    );
  }
}

/**
 * Create a hold for a reservation (Mode A: temporary hold for 48h)
 */
export async function createHold(
  reservationId: number,
  spaceId: number,
  seats: number,
  holdDurationHours: number = 48
): Promise<void> {
  const database = await getDb();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + holdDurationHours);

  await database.insert(bookingHolds).values({
    reservationId,
    spaceId,
    seatsHeld: seats,
    holdExpiresAt: expiresAt,
    isExpired: false,
  });
}

/**
 * Clean up expired holds (should run as a scheduled job)
 */
export async function cleanupExpiredHolds(): Promise<number> {
  const database = await getDb();
  const now = new Date();

  const expiredHolds = await database.query.bookingHolds.findMany({
    where: and(
      eq(bookingHolds.isExpired, false),
      // holdExpiresAt < now
    ),
  });

  let count = 0;
  for (const hold of expiredHolds) {
    if (hold.holdExpiresAt < now) {
      await database
        .update(bookingHolds)
        .set({ isExpired: true })
        .where(eq(bookingHolds.id, hold.id));
      count++;
    }
  }

  return count;
}

/**
 * Get allocation summary for a slot (for admin dashboard)
 */
export async function getSlotAllocationSummary(slotId: number) {
  const database = await getDb();
  const slot = await database.query.restaurantSlots.findFirst({
    where: eq(restaurantSlots.id, slotId),
  });

  if (!slot) return null;

  return {
    slot: {
      id: slot.id,
      startAt: slot.startAt,
      endAt: slot.endAt,
      isClosed: slot.isClosed,
    },
    spaces: {
      brasserie: {
        capacity: slot.capBrasserie,
        booked: slot.bookedBrasserie,
        available: Math.max(0, slot.capBrasserie - slot.bookedBrasserie),
        percentage: Math.round((slot.bookedBrasserie / slot.capBrasserie) * 100),
      },
      corpo: {
        capacity: slot.capCorpo,
        booked: slot.bookedCorpo,
        available: Math.max(0, slot.capCorpo - slot.bookedCorpo),
        percentage: Math.round((slot.bookedCorpo / slot.capCorpo) * 100),
      },
      jardin_libre: {
        capacity: slot.capJardinLibre,
        booked: slot.bookedJardinLibre,
        available: Math.max(0, slot.capJardinLibre - slot.bookedJardinLibre),
        percentage: Math.round((slot.bookedJardinLibre / slot.capJardinLibre) * 100),
      },
    },
  };
}
