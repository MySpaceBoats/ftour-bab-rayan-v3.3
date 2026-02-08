import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  createCompanyBookingSupabase,
  getCompanyBookingSupabase,
  getCompanyBookingByReferenceSupabase,
  listCompanyBookingsSupabase,
  updateCompanyBookingStatusSupabase,
  createCompanyTicketsSupabase,
  listCompanyTicketsSupabase,
  getCompanyTicketByTokenSupabase,
  validateCompanyTicketSupabase,
  getCompanyBookingStatsSupabase,
  cancelCompanyTicketSupabase,
  markCompanyTicketNoShowSupabase,
} from "./company-booking-services";

// ============================================
// COMPANY BOOKINGS ROUTER
// ============================================

export const companyBookingsRouter = router({
  /**
   * Créer une nouvelle réservation entreprise
   */
  create: publicProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        companyICE: z.string().optional(),
        companySector: z.string().optional(),
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        contactPhone: z.string().min(1),
        participantsCount: z.number().int().min(1),
        date: z.date(),
        restaurantId: z.number().optional(),
        slotId: z.number().optional(),
        paymentMethod: z.enum(["cash", "bank_transfer", "check", "paypal", "cmi"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }: any) => {
      const booking = await createCompanyBookingSupabase({
        companyName: input.companyName,
        companyICE: input.companyICE,
        companySector: input.companySector,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        participantsCount: input.participantsCount,
        date: input.date,
        restaurantId: input.restaurantId,
        slotId: input.slotId,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      });

      // Créer les billets individuels
      const tickets = await createCompanyTicketsSupabase({
        companyBookingId: booking.id,
        count: input.participantsCount,
      });

      // Email de confirmation sera envoyé via webhook
      // TODO: Implémenter les templates d'email transactionnels

      return {
        booking,
        tickets,
        message: "Réservation créée avec succès",
      };
    }),

  /**
   * Récupérer une réservation par référence
   */
  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }: any) => {
      return getCompanyBookingByReferenceSupabase(input.reference);
    }),

  /**
   * Lister les réservations (admin)
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        restaurantId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }: any) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
        throw new Error("Unauthorized");
      }

      return listCompanyBookingsSupabase({
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate,
        restaurantId: input.restaurantId,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Mettre à jour le statut d'une réservation
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "cancelled"]),
        paymentStatus: z.enum(["pending", "paid", "failed"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
        throw new Error("Unauthorized");
      }

      return updateCompanyBookingStatusSupabase(
        input.id,
        input.status,
        input.paymentStatus
      );
    }),

  /**
   * Obtenir les statistiques d'une réservation
   */
  getStats: publicProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ input }: any) => {
      return getCompanyBookingStatsSupabase(input.bookingId);
    }),
});

// ============================================
// COMPANY TICKETS ROUTER
// ============================================

export const companyTicketsRouter = router({
  /**
   * Lister les billets d'une réservation
   */
  list: publicProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ input }: any) => {
      return listCompanyTicketsSupabase(input.bookingId);
    }),

  /**
   * Valider un billet (check-in)
   */
  validate: publicProcedure
    .input(z.object({ qrToken: z.string() }))
    .mutation(async ({ input, ctx }: any) => {
      const validatedBy = ctx.user?.id || 0;
      return validateCompanyTicketSupabase(input.qrToken, validatedBy);
    }),

  /**
   * Annuler un billet
   */
  cancel: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ input, ctx }: any) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
        throw new Error("Unauthorized");
      }

      return cancelCompanyTicketSupabase(input.ticketId);
    }),

  /**
   * Marquer un billet comme absent
   */
  markNoShow: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ input, ctx }: any) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
        throw new Error("Unauthorized");
      }

      return markCompanyTicketNoShowSupabase(input.ticketId);
    }),
});
