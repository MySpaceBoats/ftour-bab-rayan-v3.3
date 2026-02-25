import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  sendEmail,
  generateParticulierReservationRequestEmail,
  generateParticulierReservationConfirmedEmail,
  generateRestaurantReservationRejectedEmail,
  generateNewBookingNotificationEmail,
} from "./email";
import * as reservationServices from "./restaurant-reservation-services";
import crypto from "crypto";

// ============================================
// HELPERS
// ============================================

function generateReservationReference(
  type: "particulier" | "entreprise" | "groupe"
): string {
  const typeCode =
    type === "particulier" ? "P" : type === "entreprise" ? "E" : "G";
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RES-${typeCode}-${randomPart}`;
}

function generateQrToken(): string {
  return crypto.randomBytes(16).toString("hex");
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
          participantsCount: z.number().int().min(2).max(12),
          displayChoice: z.enum(["jardin", "brasserie"]),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const reference = generateReservationReference("particulier");
          const qrToken = generateQrToken();

          const reservation =
            await reservationServices.createRestaurantReservation({
              reference,
              type: "particulier",
              name: input.firstName,
              email: input.email,
              phone: input.phone,
              date: new Date(input.date),
              seatsTotal: input.participantsCount,
              qrToken,
              displayChoice: input.displayChoice,
            });

          await sendEmail({
            to: input.email,
            subject: generateParticulierReservationRequestEmail({
              firstName: input.firstName,
              email: input.email,
              date: input.date,
              participantsCount: input.participantsCount,
              reference,
              displayChoice: input.displayChoice,
            }).subject,
            html: generateParticulierReservationRequestEmail({
              firstName: input.firstName,
              email: input.email,
              date: input.date,
              participantsCount: input.participantsCount,
              reference,
              displayChoice: input.displayChoice,
            }).html,
          });

          await sendEmail({
            to: "digital@myspace.boats",
            subject: generateNewBookingNotificationEmail({
              type: "particulier",
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.firstName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              displayChoice: input.displayChoice,
            }).subject,
            html: generateNewBookingNotificationEmail({
              type: "particulier",
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.firstName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              displayChoice: input.displayChoice,
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
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? `Erreur lors de la création de la réservation: ${error.message}`
                : "Erreur lors de la création de la réservation",
          });
        }
      }),

    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        return await reservationServices.getRestaurantReservationByReference(
          input.reference
        );
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
          participantsCount: z.number().int().min(10).max(130),
          displayChoice: z.enum(["jardin", "corpo"]),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const reference = generateReservationReference("entreprise");
          const qrToken = generateQrToken();

          console.info("[Entreprise Reservation] Creating reservation", {
            reference,
            date: input.date,
            participantsCount: input.participantsCount,
            companyName: input.companyName,
            contactEmail: input.email,
          });

          const reservation =
            await reservationServices.createRestaurantReservation({
              reference,
              type: "entreprise",
              name: input.contactName,
              email: input.email,
              phone: input.phone,
              date: new Date(input.date),
              seatsTotal: input.participantsCount,
              qrToken,
              companyName: input.companyName,
              notes: input.companyNotes,
              displayChoice: input.displayChoice,
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
              <p><strong>Salle :</strong> ${input.displayChoice}</p>
              <p>Notre équipe reviendra vers vous sous 48 heures avec une proposition de confirmation et les modalités d'organisation.</p>
              <p><strong>Référence :</strong> ${reference}</p>
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">⚠️ Conditions de réservation</h3>
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  <strong>Le nombre de personnes réservées sera facturé dans sa totalité, même en cas d'absence ou de modification le jour même.</strong>
                </p>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Afin de confirmer votre réservation à Table du Jardin, nous vous remercions de bien vouloir verser <strong>50 % du montant</strong> à l'avance.
                </p>
              </div>
              <div style="text-align: center; margin: 20px 0;">
                <p style="margin: 0; color: #374151; font-size: 14px;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97<br/><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
              </div>
              <p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>
            `,
          });

          const internalEmailResult = await sendEmail({
            to: "digital@myspace.boats",
            subject: `📬 Nouvelle demande Entreprise - ${input.date}`,
            html: generateNewBookingNotificationEmail({
              type: "entreprise",
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              companyName: input.companyName,
              displayChoice: input.displayChoice,
            }).html,
          });

          if (!customerEmailResult.success || !internalEmailResult.success) {
            console.warn(
              "[Entreprise Reservation] Reservation created but one or more emails failed",
              {
                reference,
                customerEmailResult,
                internalEmailResult,
              }
            );
          }

          return {
            success: true,
            reservation,
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error(
            "[Entreprise Reservation] Error while creating reservation",
            {
              companyName: input.companyName,
              contactEmail: input.email,
              date: input.date,
              participantsCount: input.participantsCount,
              error,
            }
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? `Erreur lors de la création de la réservation: ${error.message}`
                : "Erreur lors de la création de la réservation",
          });
        }
      }),

    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        return await reservationServices.getRestaurantReservationByReference(
          input.reference
        );
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
          participantsCount: z.number().int().min(2),
          displayChoice: z.enum(["jardin", "brasserie"]),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const reference = generateReservationReference("groupe");
          const qrToken = generateQrToken();

          const reservation =
            await reservationServices.createRestaurantReservation({
              reference,
              type: "groupe",
              name: input.contactName,
              email: input.email,
              phone: input.phone,
              date: new Date(input.date),
              seatsTotal: input.participantsCount,
              qrToken,
              groupName: input.groupName,
              groupType: input.groupType,
              displayChoice: input.displayChoice,
            });

          await sendEmail({
            to: input.email,
            subject: `📬 Demande de réservation groupe reçue`,
            html: `
              <h2 style="color: #5d5a3c;">Demande de réservation groupe reçue</h2>
              <p>Bonjour <strong>${input.contactName}</strong>,</p>
              <p>Votre demande de réservation groupe pour le <strong>${input.date}</strong> a bien été enregistrée.</p>
              <p><strong>Nombre estimé de participants :</strong> ${input.participantsCount}</p>
              <p><strong>Salle :</strong> ${input.displayChoice}</p>
              <p>Nous vous confirmerons les disponibilités sous 48 heures.</p>
              <p><strong>Référence :</strong> ${reference}</p>
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">⚠️ Conditions de réservation</h3>
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  <strong>Le nombre de personnes réservées sera facturé dans sa totalité, même en cas d'absence ou de modification le jour même.</strong>
                </p>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Afin de confirmer votre réservation à Table du Jardin, nous vous remercions de bien vouloir verser <strong>50 % du montant</strong> à l'avance.
                </p>
              </div>
              <div style="text-align: center; margin: 20px 0;">
                <p style="margin: 0; color: #374151; font-size: 14px;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97<br/><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
              </div>
              <p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>
            `,
          });

          await sendEmail({
            to: "digital@myspace.boats",
            subject: `📬 Nouvelle demande Groupe - ${input.date}`,
            html: generateNewBookingNotificationEmail({
              type: "groupe",
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              displayChoice: input.displayChoice,
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
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? `Erreur lors de la création de la réservation: ${error.message}`
                : "Erreur lors de la création de la réservation",
          });
        }
      }),

    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input }) => {
        return await reservationServices.getRestaurantReservationByReference(
          input.reference
        );
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
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      try {
        const reservation =
          await reservationServices.getRestaurantReservationByReference(
            input.reference
          );
        if (!reservation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Réservation non trouvée",
          });
        }

        await reservationServices.updateRestaurantReservationStatus(
          reservation.id,
          "validated_pending_payment"
        );
        await reservationServices.updateRestaurantReservationPaymentStatus(
          reservation.id,
          "pending_payment"
        );

        const reservationDateIso = reservation.date
          ? reservation.date.toISOString().split("T")[0]
          : "";

        await sendEmail({
          to: reservation.email,
          subject: generateParticulierReservationConfirmedEmail({
            firstName: reservation.name,
            email: reservation.email,
            date: reservationDateIso,
            participantsCount: reservation.seatsTotal,
            reference: reservation.reference,
            qrToken: reservation.qrToken,
            baseUrl: input.baseUrl,
          }).subject,
          html: generateParticulierReservationConfirmedEmail({
            firstName: reservation.name,
            email: reservation.email,
            date: reservationDateIso,
            participantsCount: reservation.seatsTotal,
            reference: reservation.reference,
            qrToken: reservation.qrToken,
            baseUrl: input.baseUrl,
          }).html,
        });

        return {
          success: true,
          message:
            "Réservation validée. Email de confirmation avec QR code envoyé.",
        };
      } catch (error) {
        console.error("[Validate Reservation] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la validation",
        });
      }
    }),

  refuse: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        rejectionReason: z.string().optional(),
        rescheduleUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      try {
        const reservation =
          await reservationServices.getRestaurantReservationByReference(
            input.reference
          );
        if (!reservation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Réservation non trouvée",
          });
        }

        await reservationServices.updateRestaurantReservationStatus(
          reservation.id,
          "refused"
        );

        const rejectedEmail = generateRestaurantReservationRejectedEmail({
          firstName: reservation.name,
          brandName: "La Table du Jardin",
          reference: reservation.reference,
          reservationDateLong: (reservation.date || new Date()).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          }),
          partySize: reservation.seatsTotal,
          rejectionReason: input.rejectionReason,
          rescheduleUrl: input.rescheduleUrl,
          contactEmail: "contact@ftourbabrayan.ma",
          contactPhone: "+212 (0) 666-690534",
          footerLines: [
            "Association Bab Rayan",
            "4 rue Bayt Lahm, quartier Palmier, Casablanca",
            "Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma",
          ],
        });

        await sendEmail({
          to: reservation.email,
          subject: rejectedEmail.subject,
          html: rejectedEmail.html,
          text: rejectedEmail.text,
        });

        return {
          success: true,
          message: "Réservation refusée. Email de notification envoyé.",
        };
      } catch (error) {
        console.error("[Refuse Reservation] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du refus",
        });
      }
    }),

  // ============================================
  // PUBLIC: GET RESERVATION BY QR TOKEN (for check-in page)
  // ============================================

  getByQrToken: publicProcedure
    .input(z.object({ qrToken: z.string() }))
    .query(async ({ input }) => {
      const reservation =
        await reservationServices.getRestaurantReservationByQrToken(
          input.qrToken
        );
      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation non trouvée",
        });
      }
      return reservation;
    }),

  // ============================================
  // ADMIN: LIST & MANAGE RESERVATIONS (MySQL/Drizzle)
  // ============================================

  adminListParticuliers: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      return await reservationServices.listRestaurantReservations({
        type: "particulier",
      });
    } catch (error) {
      console.error("[adminListParticuliers] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors du chargement des réservations particuliers",
      });
    }
  }),

  adminListGroupes: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      return await reservationServices.listRestaurantReservations({
        type: "groupe",
      });
    } catch (error) {
      console.error("[adminListGroupes] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors du chargement des réservations groupes",
      });
    }
  }),

  adminListEntreprises: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      return await reservationServices.listRestaurantReservations({
        type: "entreprise",
      });
    } catch (error) {
      console.error("[adminListEntreprises] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors du chargement des réservations entreprises",
      });
    }
  }),

  adminUpdateDepositPercentage: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        percentage: z.number().int().min(0).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      try {
        const reservation = await reservationServices.updateDepositPercentage(
          input.id,
          input.percentage
        );
        return { success: true, reservation };
      } catch (error) {
        console.error("[Admin Update Deposit Percentage] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour du pourcentage d'acompte",
        });
      }
    }),

  adminEdit: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(1).optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide")
          .optional(),
        seatsTotal: z.number().int().min(1).optional(),
        notes: z.string().optional(),
        companyName: z.string().optional(),
        groupName: z.string().optional(),
        displayChoice: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      try {
        const { id, date, ...rest } = input;
        const updateData: any = { ...rest };
        if (date) {
          updateData.date = new Date(date);
        }

        const updated = await reservationServices.updateRestaurantReservation(
          id,
          updateData
        );
        return { success: true, reservation: updated };
      } catch (error) {
        console.error("[Admin Edit Reservation] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la modification de la réservation",
        });
      }
    }),

  adminDelete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      try {
        const reservation =
          await reservationServices.getRestaurantReservationById(input.id);
        if (!reservation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Réservation non trouvée",
          });
        }

        await reservationServices.deleteRestaurantReservation(input.id);
        return { success: true };
      } catch (error) {
        console.error("[Admin Delete Reservation] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression de la réservation",
        });
      }
    }),
  adminUpdateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "pending_validation",
          "validated_pending_payment",
          "paid_confirmed",
          "refused",
          "cancelled",
          "completed",
          "no_show",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      try {
        const existingReservation =
          await reservationServices.getRestaurantReservationById(input.id);
        if (!existingReservation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Réservation non trouvée",
          });
        }

        const updated =
          await reservationServices.updateRestaurantReservationStatus(
            input.id,
            input.status
          );

        // Activate QR when confirmed
        if (input.status === "paid_confirmed") {
          await reservationServices.activateQrCode(input.id);
        }

        if (input.status === "refused") {
          const rejectedEmail = generateRestaurantReservationRejectedEmail({
            firstName: existingReservation.name,
            brandName: "La Table du Jardin",
            reference: existingReservation.reference,
            reservationDateLong: (existingReservation.date || new Date()).toLocaleDateString(
              "fr-FR",
              {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              },
            ),
            partySize: existingReservation.seatsTotal,
            contactEmail: "contact@ftourbabrayan.ma",
            contactPhone: "+212 (0) 666-690534",
            footerLines: [
              "Association Bab Rayan",
              "4 rue Bayt Lahm, quartier Palmier, Casablanca",
              "Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma",
            ],
          });

          await sendEmail({
            to: existingReservation.email,
            subject: rejectedEmail.subject,
            html: rejectedEmail.html,
            text: rejectedEmail.text,
          });
        }

        return { success: true, reservation: updated };
      } catch (error) {
        console.error("[Admin Update Status] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour du statut",
        });
      }
    }),
});
