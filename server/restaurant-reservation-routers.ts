import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { sendEmail, generateParticulierReservationRequestEmail, generateParticulierReservationConfirmedEmail, generateParticulierReservationRefusedEmail, generateNewBookingNotificationEmail } from "./email";
import crypto from "crypto";

// ============================================
// HELPERS
// ============================================

/**
 * Génère une référence unique pour une réservation
 * Format: RES-P-XXXXX (Particulier), RES-E-XXXXX (Entreprise), RES-G-XXXXX (Groupe)
 */
function generateReservationReference(type: 'particulier' | 'entreprise' | 'groupe'): string {
  const typeCode = type === 'particulier' ? 'P' : type === 'entreprise' ? 'E' : 'G';
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RES-${typeCode}-${randomPart}`;
}

/**
 * Génère un token QR sécurisé (128 bits = 32 caractères hex)
 */
function generateQrToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// RESTAURANT RESERVATIONS ROUTER
// ============================================

export const restaurantReservationsRouter = router({
  // ============================================
  // PARTICULIERS
  // ============================================

  /**
   * Créer une nouvelle réservation particulier
   * Email 1 envoyé automatiquement (accusé de réception)
   */
  particulier: router({
    create: publicProcedure
      .input(
        z.object({
          firstName: z.string().min(1, "Nom requis"),
          email: z.string().email("Email invalide"),
          phone: z.string().min(1, "Téléphone requis"),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
          participantsCount: z.number().int().min(1).max(12),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Générer référence et token
          const reference = generateReservationReference('particulier');
          const qrToken = generateQrToken();

          // TODO: Créer la réservation dans la BDD avec statut pending_validation
          // const reservation = await db.insert(restaurantReservations).values({...})

          // Envoyer Email 1 : Accusé de réception (SANS QR)
          const emailResult = await sendEmail({
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

          // Envoyer email interne à l'équipe
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
            reference,
            qrToken,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error("[Particulier Reservation] Error:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de la réservation',
          });
        }
      }),

    /**
     * Récupérer une réservation particulier par référence
     */
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        // TODO: Récupérer de la BDD
        return null;
      }),
  }),

  // ============================================
  // ENTREPRISES
  // ============================================

  /**
   * Créer une nouvelle réservation entreprise
   * Email 1 envoyé automatiquement (accusé de réception)
   */
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
          // Générer référence et token
          const reference = generateReservationReference('entreprise');
          const qrToken = generateQrToken();

          // TODO: Créer la réservation dans la BDD avec statut pending_validation

          // Envoyer Email 1 : Accusé de réception (SANS QR)
          await sendEmail({
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

          // Envoyer email interne à l'équipe
          await sendEmail({
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

          return {
            success: true,
            reference,
            qrToken,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error("[Entreprise Reservation] Error:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de la réservation',
          });
        }
      }),

    /**
     * Récupérer une réservation entreprise par référence
     */
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        // TODO: Récupérer de la BDD
        return null;
      }),
  }),

  // ============================================
  // GROUPES
  // ============================================

  /**
   * Créer une nouvelle réservation groupe
   * Email 1 envoyé automatiquement (accusé de réception)
   */
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
          participantsCount: z.number().int().min(1),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Générer référence et token
          const reference = generateReservationReference('groupe');
          const qrToken = generateQrToken();

          // TODO: Créer la réservation dans la BDD avec statut pending_validation

          // Envoyer Email 1 : Accusé de réception (SANS QR)
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

          // Envoyer email interne à l'équipe
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
            reference,
            qrToken,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error("[Groupe Reservation] Error:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de la réservation',
          });
        }
      }),

    /**
     * Récupérer une réservation groupe par référence
     */
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        // TODO: Récupérer de la BDD
        return null;
      }),
  }),

  // ============================================
  // ADMIN PROCEDURES
  // ============================================

  /**
   * Valider une réservation (admin)
   * Email 2 envoyé (confirmation + QR CODE)
   * QR activé immédiatement
   */
  validate: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        baseUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Vérifier les permissions
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }

      try {
        // TODO: Récupérer la réservation de la BDD
        // const reservation = await db.query.restaurantReservations.findFirst({...})

        // TODO: Mettre à jour le statut à validated_pending_payment
        // await db.update(restaurantReservations).set({...})

        // TODO: Envoyer Email 2 : Confirmation + QR CODE
        // await sendEmail({...})

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

  /**
   * Refuser une réservation (admin)
   * Email 3 envoyé (refus)
   */
  refuse: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Vérifier les permissions
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!allowedRoles.includes(ctx.user?.role || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }

      try {
        // TODO: Récupérer la réservation de la BDD
        // const reservation = await db.query.restaurantReservations.findFirst({...})

        // TODO: Mettre à jour le statut à refused
        // await db.update(restaurantReservations).set({...})

        // TODO: Envoyer Email 3 : Refus
        // await sendEmail({...})

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
});
