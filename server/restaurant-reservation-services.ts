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

function computeDepositDeadline(now = new Date()): Date {
  const deadline = new Date(now);
  deadline.setHours(deadline.getHours() + 48);
  return deadline;
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
  const rawDepositDeadline = r.deposit_deadline ?? r.depositDeadline;

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
    paymentStatus: r.payment_status ?? r.paymentStatus ?? "not_requested",
    paymentAmount: r.payment_amount ?? r.paymentAmount ?? null,
    paymentProvider: r.payment_provider ?? r.paymentProvider ?? null,
    paymentReference: r.payment_reference ?? r.paymentReference ?? null,
    depositPercentage: r.deposit_percentage ?? r.depositPercentage ?? 0,
    depositDeadline: rawDepositDeadline ? new Date(rawDepositDeadline) : null,
    depositStatus: r.deposit_status ?? r.depositStatus ?? "pending",
    qrToken: r.qr_token ?? r.qrToken ?? null,
    qrStatus: r.qr_status ?? r.qrStatus ?? "inactive",
    expiresAt: rawExpiresAt ? new Date(rawExpiresAt) : null,
    processedBy: r.processed_by ?? r.processedBy ?? null,
    processedAt: rawProcessedAt ? new Date(rawProcessedAt) : null,
    notes: r.notes,
    totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
    amountReceived: Number(r.amount_received ?? r.amountReceived ?? 0),
    deposit: Number(r.deposit ?? r.depositAmount ?? 0),
    nbAdult: Number(r.nb_adult ?? r.nbAdult ?? 0),
    nbKids: Number(r.nb_kids ?? r.nbKids ?? 0),
    paymentMode: r.payment_mode ?? r.paymentMode ?? "cash",
    respResa: r.resp_resa ?? r.respResa ?? "Nayla",
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
  type: "particulier" | "entreprise" | "groupe";
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
  totalAmount?: number;
  amountReceived?: number;
  deposit?: number;
  nbAdult?: number;
  nbKids?: number;
  paymentMode?: "cash" | "virement" | "espece";
  respResa?: "Nayla" | "Hind" | "Kamal" | "Rita";
}) {
  try {
    const client = getClient();
    const depositDeadline = computeDepositDeadline();
    const { data: row, error } = await client
      .from("restaurant_reservations")
      .insert({
        reference: data.reference,
        type: data.type,
        name: data.name,
        email: data.email,
        phone: data.phone,
        date: data.date.toISOString().split("T")[0],
        seats_total: data.seatsTotal,
        qr_token: data.qrToken,
        company_name: data.companyName || null,
        group_name: data.groupName || null,
        group_type: data.groupType || null,
        notes: data.notes || null,
        total_amount: data.totalAmount ?? 0,
        amount_received: data.amountReceived ?? 0,
        deposit: data.deposit ?? 0,
        nb_adult: data.nbAdult ?? 0,
        nb_kids: data.nbKids ?? 0,
        payment_mode: data.paymentMode ?? "cash",
        resp_resa: data.respResa ?? "Nayla",
        display_choice: data.displayChoice || null,
        status: "pending_validation",
        payment_status: "not_requested",
        qr_status: "inactive",
        deposit_deadline: depositDeadline.toISOString(),
        deposit_status: "pending",
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
      .from("restaurant_reservations")
      .select("*")
      .eq("reference", reference)
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // No rows
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
      .from("restaurant_reservations")
      .select("*")
      .eq("qr_token", qrToken)
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
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
      .from("restaurant_reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
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
  type?: "particulier" | "entreprise" | "groupe";
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
      .from("restaurant_reservations")
      .select("*")
      .order("id", { ascending: false })
      .range(queryOffset, queryOffset + queryLimit - 1);

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
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
  status:
    | "pending_validation"
    | "validated_pending_payment"
    | "paid_confirmed"
    | "refused"
    | "cancelled"
    | "cancelled_auto"
    | "completed"
    | "no_show"
) {
  try {
    const client = getClient();
    const { error } = await client
      .from("restaurant_reservations")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

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
  paymentStatus:
    | "not_requested"
    | "pending_payment"
    | "paid"
    | "failed"
    | "refunded"
) {
  try {
    const client = getClient();
    const updateData: Record<string, any> = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatus === "paid") {
      updateData.deposit_status = "paid";
    }

    const { error } = await client
      .from("restaurant_reservations")
      .update(updateData)
      .eq("id", id);

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
      .from("restaurant_reservations")
      .update({
        qr_status: "active",
        status: "paid_confirmed",
        payment_status: "paid",
        deposit_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

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
      .from("restaurant_reservations")
      .update({
        qr_status: "used",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);

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
      .from("restaurant_reservations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[cancelRestaurantReservation] Error:", error);
    throw error;
  }
}

/**
 * Mettre à jour les champs d'une réservation (édition admin)
 */
export async function updateRestaurantReservation(
  id: number,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    date?: Date;
    seatsTotal?: number;
    notes?: string;
    companyName?: string;
    groupName?: string;
    displayChoice?: string;
    totalAmount?: number;
    amountReceived?: number;
    deposit?: number;
    nbAdult?: number;
    nbKids?: number;
    paymentMode?: "cash" | "virement" | "espece";
    respResa?: "Nayla" | "Hind" | "Kamal" | "Rita";
  }
) {
  try {
    const client = getClient();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.date !== undefined)
      updateData.date = data.date.toISOString().split("T")[0];
    if (data.seatsTotal !== undefined) updateData.seats_total = data.seatsTotal;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.companyName !== undefined)
      updateData.company_name = data.companyName || null;
    if (data.groupName !== undefined)
      updateData.group_name = data.groupName || null;
    if (data.displayChoice !== undefined)
      updateData.display_choice = data.displayChoice || null;
    if (data.totalAmount !== undefined) updateData.total_amount = data.totalAmount;
    if (data.amountReceived !== undefined)
      updateData.amount_received = data.amountReceived;
    if (data.deposit !== undefined) updateData.deposit = data.deposit;
    if (data.nbAdult !== undefined) updateData.nb_adult = data.nbAdult;
    if (data.nbKids !== undefined) updateData.nb_kids = data.nbKids;
    if (data.paymentMode !== undefined) updateData.payment_mode = data.paymentMode;
    if (data.respResa !== undefined) updateData.resp_resa = data.respResa;

    const { error } = await client
      .from("restaurant_reservations")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[updateRestaurantReservation] Error:", error);
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
      .from("restaurant_reservations")
      .update({
        status: "no_show",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[markRestaurantReservationAsNoShow] Error:", error);
    throw error;
  }
}

/**
 * Supprimer définitivement une réservation
 */
export async function deleteRestaurantReservation(id: number) {
  try {
    const client = getClient();
    const { error } = await client
      .from("restaurant_reservations")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("[deleteRestaurantReservation] Error:", error);
    throw error;
  }
}

/**
 * Mettre à jour le pourcentage d'acompte reçu et ajuster le statut automatiquement.
 * - 100% → paid_confirmed (QR activé)
 * - 1-99% → validated_pending_payment
 * - 0% → validated_pending_payment (aucun paiement)
 */
export async function updateDepositPercentage(id: number, percentage: number) {
  try {
    const client = getClient();

    // Determine new status based on percentage
    let newStatus: string;
    let newPaymentStatus: string;
    let newDepositStatus: string;
    let newQrStatus: string | undefined;

    if (percentage >= 100) {
      newStatus = "paid_confirmed";
      newPaymentStatus = "paid";
      newDepositStatus = "paid";
      newQrStatus = "active";
    } else if (percentage > 0) {
      newStatus = "validated_pending_payment";
      newPaymentStatus = "pending_payment";
      newDepositStatus = "paid";
      newQrStatus = undefined; // don't change
    } else {
      newStatus = "validated_pending_payment";
      newPaymentStatus = "pending_payment";
      newDepositStatus = "pending";
      newQrStatus = undefined;
    }

    const updateData: Record<string, any> = {
      deposit_percentage: percentage,
      status: newStatus,
      payment_status: newPaymentStatus,
      deposit_status: newDepositStatus,
      updated_at: new Date().toISOString(),
    };

    if (newQrStatus) {
      updateData.qr_status = newQrStatus;
    }

    const { error } = await client
      .from("restaurant_reservations")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    return await getRestaurantReservationById(id);
  } catch (error) {
    console.error("[updateDepositPercentage] Error:", error);
    throw error;
  }
}


/**
 * Annule automatiquement les réservations dont l'acompte est en attente au-delà de 48h.
 */
export async function autoCancelExpiredPendingDeposits() {
  try {
    const client = getClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await client
      .from("restaurant_reservations")
      .select("*")
      .eq("deposit_status", "pending")
      .lt("deposit_deadline", nowIso)
      .in("status", ["pending_validation", "pending_confirmation", "validated_pending_payment"]);

    if (error) throw error;

    const expiredReservations = (data || []).map(mapReservation);
    if (!expiredReservations.length) {
      return [];
    }

    for (const reservation of expiredReservations) {
      const { error: updateError } = await client
        .from("restaurant_reservations")
        .update({
          status: "cancelled_auto",
          deposit_status: "expired",
          updated_at: new Date().toISOString(),
          notes: reservation.notes
            ? `${reservation.notes}
[AutoCancel] Annulée automatiquement le ${nowIso} (acompte non reçu sous 48h).`
            : `[AutoCancel] Annulée automatiquement le ${nowIso} (acompte non reçu sous 48h).`,
        })
        .eq("id", reservation.id);

      if (updateError) throw updateError;

      console.info("[AutoCancelDeposit] Reservation auto-cancelled", {
        id: reservation.id,
        reference: reservation.reference,
        depositDeadline: reservation.depositDeadline?.toISOString?.() || null,
      });
    }

    return expiredReservations;
  } catch (error) {
    console.error("[autoCancelExpiredPendingDeposits] Error:", error);
    throw error;
  }
}
