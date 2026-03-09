/**
 * Module Ftour Bénévoles
 * Gestion des invitations, confirmations et contributions culinaires
 * pour le Ftour spécial bénévoles de l'association Bab Rayan.
 */

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "./supabase";
import { sendEmail } from "./email";
import { generateFtourInvitationEmail } from "./email";
import { randomBytes } from "crypto";

// ============================================
// CONSTANTES
// ============================================

const FOOD_TYPES = ["plats_sales", "plats_sucres", "boissons"] as const;

const FOOD_OPTIONS: Record<string, string[]> = {
  plats_sales: [
    "Briouates",
    "Harcha",
    "Mini sandwichs",
    "Salades marocaines",
    "Pizza maison",
    "Quiches",
    "Batbout farci",
  ],
  plats_sucres: [
    "Chebakia",
    "Sellou",
    "Gâteaux maison",
    "Fruits",
    "Crêpes / Baghrir",
  ],
  boissons: ["Jus d'orange", "Jus d'avocat", "Smoothies", "Eau", "Lait", "Thé"],
};

function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

function resolveBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.VITE_APP_URL ||
    "https://ftourbabrayan.ma"
  );
}

// ============================================
// PROCÉDURES ADMIN (réservées aux rôles admin)
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = [
    "admin",
    "super_admin",
    "admin_ops",
  ];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès administrateur requis",
    });
  }
  return next({ ctx });
});

// ============================================
// ROUTER FTOUR
// ============================================

export const ftourRouter = router({

  // --- Événements ---

  listEvents: adminProcedure.query(async () => {
    const client = getSupabaseAdminClient();
    if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

    const { data, error } = await client
      .from("ftour_events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  getEvent: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await client
        .from("ftour_events")
        .select("*")
        .eq("id", input.id)
        .single();

      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Événement non trouvé" });
      return data;
    }),

  // --- Invitations ---

  invite: adminProcedure
    .input(
      z.object({
        eventId: z.number(),
        volunteerId: z.number().optional(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      // Vérifier que l'événement existe
      const { data: event, error: eventError } = await client
        .from("ftour_events")
        .select("*")
        .eq("id", input.eventId)
        .single();

      if (eventError || !event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Événement non trouvé" });
      }

      // Vérifier si une invitation existe déjà pour cet email et cet événement
      const { data: existing } = await client
        .from("ftour_invitations")
        .select("id")
        .eq("event_id", input.eventId)
        .eq("email", input.email.toLowerCase().trim())
        .single();

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Une invitation a déjà été envoyée à cette adresse email pour cet événement",
        });
      }

      const token = generateInvitationToken();
      const baseUrl = resolveBaseUrl();

      // Créer l'invitation
      const { data: invitation, error: invError } = await client
        .from("ftour_invitations")
        .insert({
          event_id: input.eventId,
          volunteer_id: input.volunteerId ?? null,
          email: input.email.toLowerCase().trim(),
          first_name: input.firstName,
          last_name: input.lastName,
          invitation_token: token,
          status: "pending",
        })
        .select()
        .single();

      if (invError || !invitation) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la création de l'invitation" });
      }

      // Envoyer l'email
      const emailHtml = generateFtourInvitationEmail({
        firstName: input.firstName,
        lastName: input.lastName,
        eventTitle: event.title,
        eventDate: "Mercredi 18 mars 2026",
        eventLocation: event.location,
        confirmationUrl: `${baseUrl}/ftour/confirm/${token}`,
      });

      await sendEmail({
        to: input.email,
        subject: "Invitation spéciale – Ftour des bénévoles & remise de certificat",
        html: emailHtml,
      });

      return { success: true, invitationId: invitation.id };
    }),

  searchVolunteers: adminProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const q = input.query.trim();

      const { data, error } = await client
        .from("volunteers")
        .select("id, first_name, last_name, email, phone")
        .or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`
        )
        .limit(20);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  listInvitations: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await client
        .from("ftour_invitations")
        .select("*, ftour_food_contributions(*)")
        .eq("event_id", input.eventId)
        .order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  listFoodContributions: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await client
        .from("ftour_invitations")
        .select("first_name, last_name, ftour_food_contributions(*)")
        .eq("event_id", input.eventId)
        .eq("status", "confirmed");

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const contributions: Array<{
        volunteerName: string;
        foodType: string;
        foodName: string;
        quantity: string | null;
        notes: string | null;
      }> = [];

      for (const inv of data ?? []) {
        const contribs = (inv.ftour_food_contributions as any[]) ?? [];
        for (const c of contribs) {
          contributions.push({
            volunteerName: `${inv.first_name} ${inv.last_name}`,
            foodType: c.food_type,
            foodName: c.food_name,
            quantity: c.quantity ?? null,
            notes: c.notes ?? null,
          });
        }
      }

      return contributions;
    }),

  deleteInvitation: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { error } = await client
        .from("ftour_invitations")
        .delete()
        .eq("id", input.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // --- Confirmation publique (via token) ---

  getInvitationByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data: invitation, error } = await client
        .from("ftour_invitations")
        .select("*, ftour_events(*)")
        .eq("invitation_token", input.token)
        .single();

      if (error || !invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation non trouvée ou lien invalide" });
      }

      // Vérifier que l'événement n'est pas passé (expiration après l'événement)
      const event = (invitation as any).ftour_events;
      if (event) {
        const eventDate = new Date(event.event_date);
        const now = new Date();
        // Expiration : 24h après l'événement
        eventDate.setHours(eventDate.getHours() + 24);
        if (now > eventDate) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Ce lien d'invitation a expiré" });
        }
      }

      return {
        id: invitation.id,
        firstName: invitation.first_name,
        lastName: invitation.last_name,
        email: invitation.email,
        status: invitation.status,
        confirmedAt: invitation.confirmed_at,
        event: event
          ? {
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              eventDate: event.event_date,
            }
          : null,
      };
    }),

  confirmInvitation: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        attending: z.boolean(),
        foodContribution: z
          .object({
            foodType: z.enum(FOOD_TYPES),
            foodName: z.string().min(1),
            quantity: z.string().optional(),
            notes: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      // Récupérer l'invitation
      const { data: invitation, error: fetchError } = await client
        .from("ftour_invitations")
        .select("*, ftour_events(*)")
        .eq("invitation_token", input.token)
        .single();

      if (fetchError || !invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation non trouvée" });
      }

      // Empêcher une double confirmation
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Votre réponse a déjà été enregistrée",
        });
      }

      // Vérifier expiration
      const event = (invitation as any).ftour_events;
      if (event) {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(eventDate.getHours() + 24);
        if (new Date() > eventDate) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Ce lien d'invitation a expiré" });
        }
      }

      const newStatus = input.attending ? "confirmed" : "declined";

      // Mettre à jour le statut
      const { error: updateError } = await client
        .from("ftour_invitations")
        .update({
          status: newStatus,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (updateError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la mise à jour" });
      }

      // Enregistrer la contribution culinaire si présent et a une contribution
      if (input.attending && input.foodContribution) {
        const { error: contribError } = await client
          .from("ftour_food_contributions")
          .insert({
            invitation_id: invitation.id,
            food_type: input.foodContribution.foodType,
            food_name: input.foodContribution.foodName,
            quantity: input.foodContribution.quantity ?? null,
            notes: input.foodContribution.notes ?? null,
          });

        if (contribError) {
          console.error("[Ftour] Erreur contribution culinaire:", contribError.message);
        }
      }

      return { success: true, status: newStatus };
    }),

  // --- Données pour le formulaire ---

  getFoodOptions: publicProcedure.query(() => {
    return FOOD_OPTIONS;
  }),
});
