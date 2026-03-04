import { getSupabaseAdminClient } from "./supabase";
import crypto from "crypto";

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
    adultAmount: Number(r.adult_amount ?? r.adultAmount ?? 0),
    kidsAmount: Number(r.kids_amount ?? r.kidsAmount ?? 0),
    paymentMode: r.payment_mode ?? r.paymentMode ?? "cash",
    respResa: r.resp_resa ?? r.respResa ?? "Nayla",
    modeDeposit: r.mode_deposit ?? r.modeDeposit ?? null,
    dateAvReg: r.date_av_reg ?? r.dateAvReg ?? null,
    createdAt: rawCreatedAt ? new Date(rawCreatedAt) : new Date(),
    updatedAt: rawUpdatedAt ? new Date(rawUpdatedAt) : new Date(),
    latestPaymentProofPath: r.latest_payment_proof_path ?? r.latestPaymentProofPath ?? null,
    latestPaymentProofUploadedAt: (r.latest_payment_proof_uploaded_at ?? r.latestPaymentProofUploadedAt)
      ? new Date(r.latest_payment_proof_uploaded_at ?? r.latestPaymentProofUploadedAt)
      : null,
    entrySource: r.entry_source ?? r.entrySource ?? "website",
    createdByName: r.created_by_name ?? r.createdByName ?? null,
    createdByEmail: r.created_by_email ?? r.createdByEmail ?? null,
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
  adultAmount?: number;
  kidsAmount?: number;
  paymentMode?: "cash" | "virement" | "espece";
  respResa?: "Nayla" | "Hind" | "Kamal" | "Rita" | "Réda" | "Souad";
  modeDeposit?: string;
  dateAvReg?: string;
  entrySource?: "website" | "admin";
  createdByName?: string;
  createdByEmail?: string;
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
        adult_amount: data.adultAmount ?? 0,
        kids_amount: data.kidsAmount ?? 0,
        payment_mode: data.paymentMode ?? "cash",
        resp_resa: data.respResa ?? "Nayla",
        mode_deposit: data.modeDeposit ?? null,
        date_av_reg: data.dateAvReg ?? null,
        entry_source: data.entrySource ?? "website",
        created_by_name: data.createdByName ?? null,
        created_by_email: data.createdByEmail ?? null,
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

    const typeVariants: Record<"particulier" | "entreprise" | "groupe", string[]> = {
      particulier: ["particulier", "particuliers", "individual"],
      entreprise: ["entreprise", "entreprises", "company"],
      groupe: ["groupe", "group", "groupes"],
    };

    const hasExplicitLimit =
      typeof filters?.limit === "number" && filters.limit > 0;
    const queryLimit = hasExplicitLimit ? filters!.limit! : 1000;
    const queryOffset = filters?.offset || 0;

    const fetchBatch = async (offset: number, limit: number) => {
      let query = client
        .from("restaurant_reservations")
        .select("*")
        .order("id", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters?.type) {
        query = query.in("type", typeVariants[filters.type]);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    };

    let rows: any[] = [];
    if (hasExplicitLimit) {
      rows = await fetchBatch(queryOffset, queryLimit);
    } else {
      let currentOffset = queryOffset;
      while (true) {
        const batch = await fetchBatch(currentOffset, queryLimit);
        rows = rows.concat(batch);

        if (batch.length < queryLimit) {
          break;
        }

        currentOffset += queryLimit;
      }
    }

    if (!rows.length) {
      return [];
    }

    const reservationIds = rows
      .map((row: any) => row.id)
      .filter((id: unknown): id is number => typeof id === "number");

    let proofMap = new Map<number, { path: string; uploadedAt: string | null }>();

    if (reservationIds.length > 0) {
      const { data: proofs, error: proofsError } = await client
        .from("reservation_payment_proofs")
        .select("reservation_id, storage_path, uploaded_at")
        .in("reservation_id", reservationIds)
        .order("uploaded_at", { ascending: false });

      if (!proofsError && proofs) {
        for (const proof of proofs) {
          const reservationId = Number((proof as any).reservation_id);
          if (!proofMap.has(reservationId)) {
            proofMap.set(reservationId, {
              path: String((proof as any).storage_path || ""),
              uploadedAt: (proof as any).uploaded_at || null,
            });
          }
        }
      }
    }

    return rows.map((row: any) => {
      const latestProof = proofMap.get(Number(row.id));
      return mapReservation({
        ...row,
        latest_payment_proof_path: latestProof?.path ?? null,
        latest_payment_proof_uploaded_at: latestProof?.uploadedAt ?? null,
      });
    });
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
    | "pending_confirmation"
    | "pending_validation"
    | "validated_pending_payment"
    | "pending_deposit"
    | "deposit_submitted"
    | "deposit_received"
    | "confirmed"
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
    adultAmount?: number;
    kidsAmount?: number;
    paymentMode?: "cash" | "virement" | "espece";
    respResa?: "Nayla" | "Hind" | "Kamal" | "Rita" | "Réda" | "Souad";
    modeDeposit?: string | null;
    dateAvReg?: string | null;
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
    if (data.adultAmount !== undefined) updateData.adult_amount = data.adultAmount;
    if (data.kidsAmount !== undefined) updateData.kids_amount = data.kidsAmount;
    if (data.paymentMode !== undefined) updateData.payment_mode = data.paymentMode;
    if (data.respResa !== undefined) updateData.resp_resa = data.respResa;
    if (data.modeDeposit !== undefined) updateData.mode_deposit = data.modeDeposit;
    if (data.dateAvReg !== undefined) updateData.date_av_reg = data.dateAvReg;

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

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createReservationPaymentToken(input: {
  reservationId: number;
  ttlDays?: number;
}) {
  const client = getClient();
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const ttlDays = Math.max(1, Math.min(input.ttlDays ?? 7, 30));
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const { error } = await client.from("reservation_payment_tokens").insert({
    reservation_id: input.reservationId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw error;
  }

  return { rawToken, expiresAt };
}


export async function createReservationPaymentProofSignedUrl(input: {
  reservationId: number;
  expiresInSeconds?: number;
  bucket?: string;
}) {
  const client = getClient();
  const { data: proof, error } = await client
    .from("reservation_payment_proofs")
    .select("storage_path")
    .eq("reservation_id", input.reservationId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!proof?.storage_path) {
    return null;
  }

  const bucket = input.bucket || process.env.RESERVATION_PAYMENT_PROOF_BUCKET || "reservation-payment-proofs";
  const expiresIn = Math.max(60, Math.min(input.expiresInSeconds ?? 3600, 86400));
  const { data: signedData, error: signedError } = await client.storage
    .from(bucket)
    .createSignedUrl(proof.storage_path, expiresIn);

  if (signedError) {
    throw signedError;
  }

  return {
    storagePath: proof.storage_path,
    signedUrl: signedData?.signedUrl || null,
  };
}
