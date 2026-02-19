import { getSupabaseAdminClient } from "./supabase";

// ============================================
// HELPERS
// ============================================

function getClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase is not configured");
  }
  return client;
}

/**
 * Explicit column list for restaurant_reservations SELECT queries.
 * Using explicit columns instead of '*' to ensure all fields are returned
 * regardless of PostgREST schema cache state.
 */
const RESERVATION_COLUMNS = [
  'id', 'reference', 'type', 'seats_total', 'date',
  'name', 'phone', 'email',
  'company_name', 'group_name', 'group_type',
  'status', 'payment_status', 'payment_amount', 'payment_provider', 'payment_reference',
  'qr_token', 'qr_status',
  'expires_at', 'processed_by', 'processed_at',
  'notes', 'created_at', 'updated_at',
].join(', ');

/**
 * Case-insensitive field lookup.
 * Searches the row object for a matching key using multiple naming conventions.
 * Returns the value if found, or undefined if no match.
 */
function getField(r: any, ...names: string[]): any {
  // First try direct property access (fast path)
  for (const name of names) {
    if (r[name] !== undefined && r[name] !== null) return r[name];
  }
  // If all direct lookups returned null/undefined, try case-insensitive match on all keys
  const keys = Object.keys(r);
  for (const name of names) {
    const lower = name.toLowerCase();
    const found = keys.find(k => k.toLowerCase() === lower);
    if (found && r[found] !== undefined && r[found] !== null) return r[found];
  }
  return undefined;
}

/**
 * Map DB row to camelCase object expected by frontend.
 * Uses case-insensitive field lookup to handle ANY column naming convention:
 *   - snake_case: seats_total, group_name (Supabase DDL)
 *   - camelCase: seatsTotal, groupName (Drizzle MySQL)
 *   - lowercase: seatstotal, groupname (PostgreSQL lowercases unquoted identifiers)
 *   - Any other casing variation
 *
 * Also includes _debug field with raw column info for troubleshooting.
 */
function mapReservation(r: any) {
  const rawDate = getField(r, 'date');
  const rawCreatedAt = getField(r, 'created_at', 'createdAt', 'createdat');
  const rawUpdatedAt = getField(r, 'updated_at', 'updatedAt', 'updatedat');
  const rawExpiresAt = getField(r, 'expires_at', 'expiresAt', 'expiresat');
  const rawProcessedAt = getField(r, 'processed_at', 'processedAt', 'processedat');

  return {
    id: r.id,
    reference: r.reference,
    type: r.type,
    seatsTotal: getField(r, 'seats_total', 'seatsTotal', 'seatstotal', 'seats') ?? 0,
    date: rawDate ? new Date(rawDate) : null,
    name: r.name,
    phone: r.phone,
    email: r.email,
    companyName: getField(r, 'company_name', 'companyName', 'companyname') ?? null,
    groupName: getField(r, 'group_name', 'groupName', 'groupname') ?? null,
    groupType: getField(r, 'group_type', 'groupType', 'grouptype') ?? null,
    status: r.status,
    paymentStatus: getField(r, 'payment_status', 'paymentStatus', 'paymentstatus') ?? 'not_requested',
    paymentAmount: getField(r, 'payment_amount', 'paymentAmount', 'paymentamount') ?? null,
    paymentProvider: getField(r, 'payment_provider', 'paymentProvider', 'paymentprovider') ?? null,
    paymentReference: getField(r, 'payment_reference', 'paymentReference', 'paymentreference') ?? null,
    qrToken: getField(r, 'qr_token', 'qrToken', 'qrtoken') ?? null,
    qrStatus: getField(r, 'qr_status', 'qrStatus', 'qrstatus') ?? 'inactive',
    expiresAt: rawExpiresAt ? new Date(rawExpiresAt) : null,
    processedBy: getField(r, 'processed_by', 'processedBy', 'processedby') ?? null,
    processedAt: rawProcessedAt ? new Date(rawProcessedAt) : null,
    notes: r.notes,
    createdAt: rawCreatedAt ? new Date(rawCreatedAt) : new Date(),
    updatedAt: rawUpdatedAt ? new Date(rawUpdatedAt) : new Date(),
    // Debug info: raw column names and key values for troubleshooting
    _debug: {
      rawKeys: Object.keys(r),
      rawSeatsTotal: { seats_total: r.seats_total, seatsTotal: r.seatsTotal, seatstotal: r.seatstotal },
      rawGroupName: { group_name: r.group_name, groupName: r.groupName, groupname: r.groupname },
      rawCompanyName: { company_name: r.company_name, companyName: r.companyName, companyname: r.companyname },
      rawRow: JSON.stringify(r).substring(0, 500),
    },
  };
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
    const client = getClient();
    const { data: row, error } = await client
      .from('restaurant_reservations')
      .insert({
        reference: data.reference,
        type: data.type,
        name: data.name,
        email: data.email,
        phone: data.phone,
        date: data.date.toISOString().split('T')[0],
        seats_total: data.seatsTotal,
        qr_token: data.qrToken,
        company_name: data.companyName || null,
        group_name: data.groupName || null,
        group_type: data.groupType || null,
        notes: data.notes || null,
        status: 'pending_validation',
        payment_status: 'not_requested',
        qr_status: 'inactive',
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapReservation(row);
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
    const client = getClient();
    const { data, error } = await client
      .from('restaurant_reservations')
      .select('*')
      .eq('reference', reference)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows
      throw error;
    }
    return data ? mapReservation(data) : null;
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
    const client = getClient();
    const { data, error } = await client
      .from('restaurant_reservations')
      .select('*')
      .eq('qr_token', qrToken)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? mapReservation(data) : null;
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
    const client = getClient();
    const { data, error } = await client
      .from('restaurant_reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? mapReservation(data) : null;
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
    const client = getClient();
    const queryLimit = filters?.limit || 200;
    const queryOffset = filters?.offset || 0;

    let query = client
      .from('restaurant_reservations')
      .select('*')
      .order('id', { ascending: false })
      .range(queryOffset, queryOffset + queryLimit - 1);

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Diagnostic: log actual column names and sample values from Supabase
    if (data && data.length > 0) {
      const firstRow = data[0];
      console.log("[DEBUG restaurant_reservations] columns:", Object.keys(firstRow));
      console.log("[DEBUG restaurant_reservations] seats_total:", firstRow.seats_total, "| seatsTotal:", firstRow.seatsTotal, "| seatstotal:", firstRow.seatstotal);
      console.log("[DEBUG restaurant_reservations] group_name:", firstRow.group_name, "| groupName:", firstRow.groupName, "| groupname:", firstRow.groupname);
      console.log("[DEBUG restaurant_reservations] company_name:", firstRow.company_name, "| companyName:", firstRow.companyName, "| companyname:", firstRow.companyname);
    }

    return (data || []).map(mapReservation);
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
    const client = getClient();
    const { error } = await client
      .from('restaurant_reservations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
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
    const client = getClient();
    const { error } = await client
      .from('restaurant_reservations')
      .update({
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
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
    const client = getClient();
    const { error } = await client
      .from('restaurant_reservations')
      .update({
        qr_status: 'active',
        status: 'paid_confirmed',
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
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
    const reservation = await getRestaurantReservationByQrToken(qrToken);
    if (!reservation) {
      throw new Error("QR code not found");
    }

    const client = getClient();
    const { error } = await client
      .from('restaurant_reservations')
      .update({
        qr_status: 'used',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.id);

    if (error) throw error;
    return await getRestaurantReservationById(reservation.id);
  } catch (error) {
    console.error("[markQrCodeAsUsed] Error:", error);
    throw error;
  }
}

/**
 * Debug: return raw Supabase data without any mapping.
 * Used to diagnose column naming issues.
 */
export async function debugRawReservationData() {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('restaurant_reservations')
      .select('*')
      .order('id', { ascending: false })
      .limit(3);

    if (error) {
      return {
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      };
    }

    if (!data || data.length === 0) {
      return {
        error: null,
        rowCount: 0,
        columns: [],
        rows: [],
        message: 'No rows found in restaurant_reservations table',
      };
    }

    return {
      error: null,
      rowCount: data.length,
      columns: Object.keys(data[0]),
      rows: data.map(row => {
        // Return stringified row to preserve exact values
        const processed: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          processed[key] = JSON.stringify(value);
        }
        return processed;
      }),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      rowCount: 0,
      columns: [],
      rows: [],
    };
  }
}

/**
 * Annuler une réservation
 */
export async function cancelRestaurantReservation(id: number) {
  try {
    const client = getClient();
    const { error } = await client
      .from('restaurant_reservations')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
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
    const client = getClient();
    const { error } = await client
      .from('restaurant_reservations')
      .update({
        status: 'no_show',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[markRestaurantReservationAsNoShow] Error:", error);
    throw error;
  }
}
