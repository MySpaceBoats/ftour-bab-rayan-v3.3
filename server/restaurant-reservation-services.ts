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
 * Map DB row to camelCase object expected by frontend.
 * Handles both snake_case (Supabase/PostgreSQL) and camelCase (Drizzle/MySQL) column names.
 */
function mapReservation(r: any) {
  const rawDate = r.date;
  const rawCreatedAt = r.created_at ?? r.createdAt;
  const rawUpdatedAt = r.updated_at ?? r.updatedAt;
  const rawExpiresAt = r.expires_at ?? r.expiresAt;
  const rawProcessedAt = r.processed_at ?? r.processedAt;

  return {
    id: r.id,
    reference: r.reference,
    type: r.type,
    seatsTotal: r.seats_total ?? r.seatsTotal ?? 0,
    date: rawDate ? new Date(rawDate) : null,
    name: r.name,
    phone: r.phone,
    email: r.email,
    companyName: r.company_name ?? r.companyName ?? null,
    groupName: r.group_name ?? r.groupName ?? null,
    groupType: r.group_type ?? r.groupType ?? null,
    displayChoice: r.display_choice ?? r.displayChoice ?? null,
    status: r.status,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? 'not_requested',
    paymentAmount: r.payment_amount ?? r.paymentAmount ?? null,
    paymentProvider: r.payment_provider ?? r.paymentProvider ?? null,
    paymentReference: r.payment_reference ?? r.paymentReference ?? null,
    qrToken: r.qr_token ?? r.qrToken ?? null,
    qrStatus: r.qr_status ?? r.qrStatus ?? 'inactive',
    expiresAt: rawExpiresAt ? new Date(rawExpiresAt) : null,
    processedBy: r.processed_by ?? r.processedBy ?? null,
    processedAt: rawProcessedAt ? new Date(rawProcessedAt) : null,
    notes: r.notes,
    createdAt: rawCreatedAt ? new Date(rawCreatedAt) : new Date(),
    updatedAt: rawUpdatedAt ? new Date(rawUpdatedAt) : new Date(),
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
  displayChoice?: string;
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
        display_choice: data.displayChoice || null,
        status: 'pending_validation',
        payment_status: 'not_requested',
        qr_status: 'inactive',
      })
      .select()
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
