import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  sendEmail,
  generateParticulierReservationRefusedEmail,
  generateNewBookingNotificationEmail,
  generateRestaurantReservationDepositRequiredEmail,
  generateRestaurantReservationConfirmedEmail,
  generateRestaurantReservationAutoCancelledEmail,
  formatReservationDateLong,
  formatCasablancaDateTimeLong,
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


async function runAutoCancellationAndNotify() {
  const cancelledReservations = await reservationServices.autoCancelExpiredPendingDeposits();

  for (const reservation of cancelledReservations) {
    try {
      const reservationDateIso = reservation.date
        ? reservation.date.toISOString().split("T")[0]
        : "";
      const cancellationEmail = generateRestaurantReservationAutoCancelledEmail({
        firstName: reservation.name,
        reference: reservation.reference,
        reservationDateLong: formatReservationDateLong(reservationDateIso),
        partySize: reservation.seatsTotal,
        depositDeadlineFormatted: reservation.depositDeadline
          ? formatCasablancaDateTimeLong(reservation.depositDeadline.toISOString())
          : undefined,
      });

      await sendEmail({
        to: reservation.email,
        subject: cancellationEmail.subject,
        html: cancellationEmail.html,
        text: cancellationEmail.text,
      });
    } catch (error) {
      console.error("[runAutoCancellationAndNotify] Unable to send cancellation email", {
        reservationId: reservation.id,
        reference: reservation.reference,
        error,
      });
    }
  }
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

          const requestEmail = generateRestaurantReservationDepositRequiredEmail({
            firstName: input.firstName,
            reference,
            reservationDateLong: formatReservationDateLong(input.date),
            partySize: input.participantsCount,
            depositDeadlineFormatted: reservation.depositDeadline
              ? formatCasablancaDateTimeLong(reservation.depositDeadline.toISOString())
              : undefined,
          });

          await sendEmail({
            to: input.email,
            subject: requestEmail.subject,
            html: requestEmail.html,
            text: requestEmail.text,
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

          const customerRequestEmail = generateRestaurantReservationDepositRequiredEmail({
            firstName: input.contactName,
            reference,
            reservationDateLong: formatReservationDateLong(input.date),
            partySize: input.participantsCount,
            depositDeadlineFormatted: reservation.depositDeadline
              ? formatCasablancaDateTimeLong(reservation.depositDeadline.toISOString())
              : undefined,
          });

          const customerEmailResult = await sendEmail({
            to: input.email,
            subject: customerRequestEmail.subject,
            html: customerRequestEmail.html,
            text: customerRequestEmail.text,
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

          const customerRequestEmail = generateRestaurantReservationDepositRequiredEmail({
            firstName: input.contactName,
            reference,
            reservationDateLong: formatReservationDateLong(input.date),
            partySize: input.participantsCount,
            depositDeadlineFormatted: reservation.depositDeadline
              ? formatCasablancaDateTimeLong(reservation.depositDeadline.toISOString())
              : undefined,
          });

          await sendEmail({
            to: input.email,
            subject: customerRequestEmail.subject,
            html: customerRequestEmail.html,
            text: customerRequestEmail.text,
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
        const confirmedEmail = generateRestaurantReservationConfirmedEmail({
          firstName: reservation.name,
          reference: reservation.reference,
          reservationDateLong: formatReservationDateLong(reservationDateIso),
          partySize: reservation.seatsTotal,
          partySizeConfirmed: reservation.seatsTotal,
        });

        await sendEmail({
          to: reservation.email,
          subject: confirmedEmail.subject,
          html: confirmedEmail.html,
          text: confirmedEmail.text,
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
    .input(z.object({ reference: z.string() }))
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

        const reservationDateIso = reservation.date
          ? reservation.date.toISOString().split("T")[0]
          : "";
        const refusedEmail = generateParticulierReservationRefusedEmail({
          firstName: reservation.name,
          email: reservation.email,
          date: reservationDateIso,
        });

        await sendEmail({
          to: reservation.email,
          subject: refusedEmail.subject,
          html: refusedEmail.html,
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
      await runAutoCancellationAndNotify();
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
      await runAutoCancellationAndNotify();
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
      await runAutoCancellationAndNotify();
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
          "cancelled_auto",
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
        const updated =
          await reservationServices.updateRestaurantReservationStatus(
            input.id,
            input.status
          );

        // Activate QR when confirmed
        if (input.status === "paid_confirmed") {
          await reservationServices.activateQrCode(input.id);
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
