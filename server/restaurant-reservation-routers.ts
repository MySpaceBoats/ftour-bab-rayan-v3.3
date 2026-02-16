import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { sendEmail, generateParticulierReservationRequestEmail, generateParticulierReservationConfirmedEmail, generateParticulierReservationRefusedEmail, generateNewBookingNotificationEmail } from "./email";
import * as reservationServices from "./restaurant-reservation-services";
import crypto from "crypto";

// ============================================
// HELPERS
// ============================================

function generateReservationReference(type: 'particulier' | 'entreprise' | 'groupe'): string {
  const typeCode = type === 'particulier' ? 'P' : type === 'entreprise' ? 'E' : 'G';
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RES-${typeCode}-${randomPart}`;
}

function generateQrToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// RESTAURANT RESERVATIONS ROUTER
// ============================================

export const restaurantReservationsRouter = router({
  particulier: router({
    create: publicProcedure
      .input(
        z.object({
          firstName: z.string().min(1, "Nom requis"),
          email: z.string().email("Email invalide"),
          phone: z.string().min(1, "Téléphone requis"),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
          participantsCount: z.number().int().min(5).max(12),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const reference = generateReservationReference('particulier');
          const qrToken = generateQrToken();

          const reservation = await reservationServices.createRestaurantReservation({
            reference,
            type: 'particulier',
            name: input.firstName,
            email: input.email,
            phone: input.phone,
            date: new Date(input.date),
            seatsTotal: input.participantsCount,
            qrToken,
          });

          await sendEmail({
            to: input.email,
            subject: generateParticulierReservationRequestEmail({
              firstName: input.firstName,
              email: input.email,
              date: input.date,
              participantsCount: input.participantsCount,
              reference,
            }).subject,
            html: generateParticulierReservationRequestEmail({
              firstName: input.firstName,
              email: input.email,
              date: input.date,
              participantsCount: input.participantsCount,
              reference,
            }).html,
            cc: ['heartfulness@myspace.boats'],
          });

          await sendEmail({
            to: 'digital@myspace.boats',
            subject: generateNewBookingNotificationEmail({
              type: 'particulier',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.firstName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
            }).subject,
            html: generateNewBookingNotificationEmail({
              type: 'particulier',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.firstName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
            }).html,
          });

          return {
            success: true,
            reservation,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error("[Particulier Reservation] Error:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? `Erreur lors de la création de la réservation: ${error.message}` : 'Erreur lors de la création de la réservation',
          });
        }
      }),

    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        return await reservationServices.getRestaurantReservationByReference(input.reference);
      }),
  }),

  entreprise: router({
    create: publicProcedure
      .input(
        z.object({
          companyName: z.string().min(1, "Nom entreprise requis"),
          contactName: z.string().min(1, "Nom contact requis"),
          email: z.string().email("Email invalide"),
          phone: z.string().min(1, "Téléphone requis"),
          companyICE: z.string().optional(),
          companyNotes: z.string().optional(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
          participantsCount: z.number().int().min(10).max(120),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const reference = generateReservationReference('entreprise');
          const qrToken = generateQrToken();

          console.info("[Entreprise Reservation] Creating reservation", {
            reference,
            date: input.date,
            participantsCount: input.participantsCount,
            companyName: input.companyName,
            contactEmail: input.email,
          });

          const reservation = await reservationServices.createRestaurantReservation({
            reference,
            type: 'entreprise',
            name: input.contactName,
            email: input.email,
            phone: input.phone,
            date: new Date(input.date),
            seatsTotal: input.participantsCount,
            qrToken,
            companyName: input.companyName,
            notes: input.companyNotes,
          });

          const customerEmailResult = await sendEmail({
            to: input.email,
            subject: `📬 Demande de réservation entreprise reçue`,
            html: `
              <h2 style="color: #5d5a3c;">Demande de réservation entreprise reçue</h2>
              <p>Bonjour <strong>${input.contactName}</strong>,</p>
              <p>Nous avons bien reçu la demande de réservation de <strong>${input.companyName}</strong> pour le ftour solidaire.</p>
              <p><strong>Date souhaitée :</strong> ${input.date}</p>
              <p><strong>Nombre de participants :</strong> ${input.participantsCount}</p>
              <p>Notre équipe reviendra vers vous sous 48 heures avec une proposition de confirmation et les modalités d'organisation.</p>
              <p><strong>Référence :</strong> ${reference}</p>
              <p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>
            `,
            cc: ['heartfulness@myspace.boats'],
          });

          const internalEmailResult = await sendEmail({
            to: 'digital@myspace.boats',
            subject: `📬 Nouvelle demande Entreprise - ${input.date}`,
            html: generateNewBookingNotificationEmail({
              type: 'entreprise',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              companyName: input.companyName,
            }).html,
          });

          if (!customerEmailResult.success || !internalEmailResult.success) {
            console.warn("[Entreprise Reservation] Reservation created but one or more emails failed", {
              reference,
              customerEmailResult,
              internalEmailResult,
            });
          }

          return {
            success: true,
            reservation,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error("[Entreprise Reservation] Error while creating reservation", {
            companyName: input.companyName,
            contactEmail: input.email,
            date: input.date,
            participantsCount: input.participantsCount,
            error,
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? `Erreur lors de la création de la réservation: ${error.message}` : 'Erreur lors de la création de la réservation',
          });
        }
      }),

    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        return await reservationServices.getRestaurantReservationByReference(input.reference);
      }),
  }),

  groupe: router({
    create: publicProcedure
      .input(
        z.object({
          groupName: z.string().min(1, "Nom groupe requis"),
          contactName: z.string().min(1, "Nom contact requis"),
          email: z.string().email("Email invalide"),
          phone: z.string().min(1, "Téléphone requis"),
          groupType: z.string().optional(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
          participantsCount: z.number().int().min(5),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const reference = generateReservationReference('groupe');
          const qrToken = generateQrToken();

          const reservation = await reservationServices.createRestaurantReservation({
            reference,
            type: 'groupe',
            name: input.contactName,
            email: input.email,
            phone: input.phone,
            date: new Date(input.date),
            seatsTotal: input.participantsCount,
            qrToken,
            groupName: input.groupName,
            groupType: input.groupType,
          });

          await sendEmail({
            to: input.email,
            subject: `📬 Demande de réservation groupe reçue`,
            html: `
              <h2 style="color: #5d5a3c;">Demande de réservation groupe reçue</h2>
              <p>Bonjour <strong>${input.contactName}</strong>,</p>
              <p>Votre demande de réservation groupe pour le <strong>${input.date}</strong> a bien été enregistrée.</p>
              <p><strong>Nombre estimé de participants :</strong> ${input.participantsCount}</p>
              <p>Nous vous confirmerons les disponibilités sous 48 heures.</p>
              <p><strong>Référence :</strong> ${reference}</p>
              <p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>
            `,
            cc: ['heartfulness@myspace.boats'],
          });

          await sendEmail({
            to: 'digital@myspace.boats',
            subject: `📬 Nouvelle demande Groupe - ${input.date}`,
            html: generateNewBookingNotificationEmail({
              type: 'groupe',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
            }).html,
          });

          return {
            success: true,
            reservation,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error("[Groupe Reservation] Error:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? `Erreur lors de la création de la réservation: ${error.message}` : 'Erreur lors de la création de la réservation',
          });
        }
      }),

    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        return await reservationServices.getRestaurantReservationByReference(input.reference);
      }),
  }),

  validate: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        baseUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }

      try {
        const reservation = await reservationServices.getRestaurantReservationByReference(input.reference);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
        }

        await reservationServices.updateRestaurantReservationStatus(reservation.id, 'validated_pending_payment');
        await reservationServices.updateRestaurantReservationPaymentStatus(reservation.id, 'pending_payment');

        await sendEmail({
          to: reservation.email,
          subject: generateParticulierReservationConfirmedEmail({
            firstName: reservation.name,
            email: reservation.email,
            date: reservation.date.toISOString().split('T')[0],
            participantsCount: reservation.seatsTotal,
            reference: reservation.reference,
            qrToken: reservation.qrToken,
            baseUrl: input.baseUrl,
          }).subject,
          html: generateParticulierReservationConfirmedEmail({
            firstName: reservation.name,
            email: reservation.email,
            date: reservation.date.toISOString().split('T')[0],
            participantsCount: reservation.seatsTotal,
            reference: reservation.reference,
            qrToken: reservation.qrToken,
            baseUrl: input.baseUrl,
          }).html,
          cc: ['heartfulness@myspace.boats'],
        });

        return {
          success: true,
          message: "Réservation validée. Email de confirmation avec QR code envoyé.",
        };
      } catch (error) {
        console.error("[Validate Reservation] Error:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la validation',
        });
      }
    }),

  refuse: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }

      try {
        const reservation = await reservationServices.getRestaurantReservationByReference(input.reference);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
        }

        await reservationServices.updateRestaurantReservationStatus(reservation.id, 'refused');

        await sendEmail({
          to: reservation.email,
          subject: generateParticulierReservationRefusedEmail({
            firstName: reservation.name,
            email: reservation.email,
            date: reservation.date.toISOString().split('T')[0],
          }).subject,
          html: generateParticulierReservationRefusedEmail({
            firstName: reservation.name,
            email: reservation.email,
            date: reservation.date.toISOString().split('T')[0],
          }).html,
          cc: ['heartfulness@myspace.boats'],
        });

        return {
          success: true,
          message: "Réservation refusée. Email de notification envoyé.",
        };
      } catch (error) {
        console.error("[Refuse Reservation] Error:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du refus',
        });
      }
    }),

  // ============================================
  // PUBLIC: GET RESERVATION BY QR TOKEN (for check-in page)
  // ============================================

  getByQrToken: publicProcedure
    .input(z.object({ qrToken: z.string() }))
    .query(async ({ input }) => {
      const reservation = await reservationServices.getRestaurantReservationByQrToken(input.qrToken);
      if (!reservation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      }
      return reservation;
    }),

  // ============================================
  // ADMIN: LIST & MANAGE RESERVATIONS (MySQL/Drizzle)
  // ============================================

  adminListParticuliers: protectedProcedure
    .query(async ({ ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }
      return await reservationServices.listRestaurantReservations({ type: 'particulier' });
    }),

  adminListGroupes: protectedProcedure
    .query(async ({ ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_groupes'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }
      return await reservationServices.listRestaurantReservations({ type: 'groupe' });
    }),

  adminListEntreprises: protectedProcedure
    .query(async ({ ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_entreprises'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }
      return await reservationServices.listRestaurantReservations({ type: 'entreprise' });
    }),

  adminUpdateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['pending_validation', 'validated_pending_payment', 'paid_confirmed', 'refused', 'cancelled', 'completed', 'no_show']),
    }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }

      try {
        const updated = await reservationServices.updateRestaurantReservationStatus(input.id, input.status);

        // Activate QR when confirmed
        if (input.status === 'paid_confirmed') {
          await reservationServices.activateQrCode(input.id);
        }

        return { success: true, reservation: updated };
      } catch (error) {
        console.error("[Admin Update Status] Error:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la mise à jour du statut',
        });
      }
    }),
});
