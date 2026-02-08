import { getSupabaseAdminClient } from "./supabase";
import crypto from "crypto";

// ============================================
// COMPANY BOOKINGS SERVICES
// ============================================

/**
 * Créer une réservation entreprise
 */
export async function createCompanyBookingSupabase({
  companyName,
  companyICE,
  companySector,
  contactName,
  contactEmail,
  contactPhone,
  participantsCount,
  date,
  restaurantId,
  slotId,
  paymentMethod,
  notes,
}: {
  companyName: string;
  companyICE?: string;
  companySector?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  participantsCount: number;
  date: Date;
  restaurantId?: number;
  slotId?: number;
  paymentMethod: string;
  notes?: string;
}) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const reference = `CBR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;

  const { data, error } = await client
    .from("company_bookings")
    .insert({
      reference,
      companyName,
      companyICE,
      companySector,
      contactName,
      contactEmail,
      contactPhone,
      participantsCount,
      date: date.toISOString(),
      restaurantId,
      slotId,
      status: "pending",
      paymentMethod,
      paymentStatus: "pending",
      notes,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create company booking: ${error.message}`);
  return data;
}

/**
 * Récupérer une réservation entreprise par ID
 */
export async function getCompanyBookingSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Failed to fetch company booking: ${error.message}`);
  return data;
}

/**
 * Récupérer une réservation entreprise par référence
 */
export async function getCompanyBookingByReferenceSupabase(reference: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_bookings")
    .select("*")
    .eq("reference", reference)
    .single();

  if (error) throw new Error(`Failed to fetch company booking: ${error.message}`);
  return data;
}

/**
 * Lister toutes les réservations entreprise avec filtres
 */
export async function listCompanyBookingsSupabase({
  status,
  startDate,
  endDate,
  restaurantId,
  limit = 50,
  offset = 0,
}: {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  restaurantId?: number;
  limit?: number;
  offset?: number;
} = {}) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  let query = client.from("company_bookings").select("*");

  if (status) query = query.eq("status", status);
  if (startDate) query = query.gte("date", startDate.toISOString());
  if (endDate) query = query.lte("date", endDate.toISOString());
  if (restaurantId) query = query.eq("restaurantId", restaurantId);

  const { data, error } = await query
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list company bookings: ${error.message}`);
  return data;
}

/**
 * Mettre à jour le statut d'une réservation entreprise
 */
export async function updateCompanyBookingStatusSupabase(
  id: number,
  status: string,
  paymentStatus?: string
) {
  const update: any = { status };
  if (paymentStatus) update.paymentStatus = paymentStatus;

  const { data, error } = await client
    .from("company_bookings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update company booking: ${error.message}`);
  return data;
}

// ============================================
// COMPANY TICKETS SERVICES
// ============================================

/**
 * Générer un token QR unique et non devinable
 */
function generateQRToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Générer un code ticket lisible
 */
function generateTicketCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "TCK-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Créer des billets individuels pour une réservation entreprise
 */
export async function createCompanyTicketsSupabase({
  companyBookingId,
  count,
  participants,
}: {
  companyBookingId: number;
  count: number;
  participants?: Array<{
    name?: string;
    email?: string;
    department?: string;
  }>;
}) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const tickets = [];

  for (let i = 0; i < count; i++) {
    const participant = participants?.[i];
    const ticketCode = generateTicketCode();
    const qrToken = generateQRToken();

    tickets.push({
      companyBookingId,
      ticketCode,
      qrToken,
      participantName: participant?.name,
      participantEmail: participant?.email,
      participantDepartment: participant?.department,
      status: "issued",
    });
  }

  const { data, error } = await client
    .from("company_tickets")
    .insert(tickets)
    .select();

  if (error) throw new Error(`Failed to create company tickets: ${error.message}`);
  return data;
}

/**
 * Récupérer un billet par QR token
 */
export async function getCompanyTicketByTokenSupabase(qrToken: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_tickets")
    .select("*, company_bookings(*)")
    .eq("qrToken", qrToken)
    .single();

  if (error) throw new Error(`Failed to fetch company ticket: ${error.message}`);
  return data;
}

/**
 * Lister les billets d'une réservation entreprise
 */
export async function listCompanyTicketsSupabase(companyBookingId: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_tickets")
    .select("*")
    .eq("companyBookingId", companyBookingId)
    .order("createdAt", { ascending: true });

  if (error) throw new Error(`Failed to list company tickets: ${error.message}`);
  return data;
}

/**
 * Valider un billet (check-in)
 */
export async function validateCompanyTicketSupabase(
  qrToken: string,
  validatedBy: number
) {
  // Récupérer le billet
  const ticket = await getCompanyTicketByTokenSupabase(qrToken);

  if (!ticket) {
    return { success: false, error: "Ticket not found" };
  }

  if (ticket.status === "checked_in") {
    return { success: false, error: "Ticket already checked in" };
  }

  if (ticket.status === "cancelled") {
    return { success: false, error: "Ticket is cancelled" };
  }

  // Vérifier la date
  const bookingDate = new Date(ticket.company_bookings.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  bookingDate.setHours(0, 0, 0, 0);

  if (bookingDate.getTime() !== today.getTime()) {
    return { success: false, error: "Ticket is not valid for today" };
  }

  // Mettre à jour le statut du billet
  const { data, error } = await client
    .from("company_tickets")
    .update({
      status: "checked_in",
      checkedInAt: new Date().toISOString(),
      checkedInBy: validatedBy,
    })
    .eq("id", ticket.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Enregistrer le scan
  await client.from("company_booking_scans").insert({
    companyTicketId: ticket.id,
    qrToken,
    result: "success",
    validatedBy,
  });

  return { success: true, data };
}

/**
 * Obtenir les statistiques d'une réservation entreprise
 */
export async function getCompanyBookingStatsSupabase(companyBookingId: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_tickets")
    .select("status")
    .eq("companyBookingId", companyBookingId);

  if (error) throw new Error(`Failed to fetch company booking stats: ${error.message}`);

  const stats = {
    total: data.length,
    checkedIn: data.filter((t: any) => t.status === "checked_in").length,
    noShow: data.filter((t: any) => t.status === "no_show").length,
    cancelled: data.filter((t: any) => t.status === "cancelled").length,
    pending: data.filter((t: any) => t.status === "issued").length,
  };

  return stats;
}

/**
 * Annuler un billet
 */
export async function cancelCompanyTicketSupabase(ticketId: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_tickets")
    .update({ status: "cancelled" })
    .eq("id", ticketId)
    .select()
    .single();

  if (error) throw new Error(`Failed to cancel ticket: ${error.message}`);
  return data;
}

/**
 * Marquer un billet comme absent
 */
export async function markCompanyTicketNoShowSupabase(ticketId: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client
    .from("company_tickets")
    .update({ status: "no_show" })
    .eq("id", ticketId)
    .select()
    .single();

  if (error) throw new Error(`Failed to mark ticket as no-show: ${error.message}`);
  return data;
}
