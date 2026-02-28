import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  sendEmail,
  generateParticulierReservationRefusedEmail,
  generateNewBookingNotificationEmail,
  generateRestaurantReservationDepositRequiredEmail,
  generateRestaurantReservationConfirmedEmail,
  formatReservationDateLong,
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
  const cancelledReservations =
    await reservationServices.autoCancelExpiredPendingDeposits();

  for (const reservation of cancelledReservations) {
    try {
      const reservationDateIso = reservation.date
        ? reservation.date.toISOString().split("T")[0]
        : "";
      const cancellationEmail = generateRestaurantReservationAutoCancelledEmail(
        {
          firstName: reservation.name,
          reference: reservation.reference,
          reservationDateLong: formatReservationDateLong(reservationDateIso),
          partySize: reservation.seatsTotal,
          depositDeadlineFormatted: reservation.depositDeadline
            ? formatCasablancaDateTimeLong(
                reservation.depositDeadline.toISOString()
              )
            : undefined,
        }
      );

      await sendEmail({
        to: reservation.email,
        subject: cancellationEmail.subject,
        html: cancellationEmail.html,
        text: cancellationEmail.text,
      });
    } catch (error) {
      console.error(
        "[runAutoCancellationAndNotify] Unable to send cancellation email",
        {
          reservationId: reservation.id,
          reference: reservation.reference,
          error,
        }
      );
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

          const requestEmail =
            generateRestaurantReservationDepositRequiredEmail({
              firstName: input.firstName,
              reference,
              reservationDateLong: formatReservationDateLong(input.date),
              partySize: input.participantsCount,
              depositDeadlineFormatted: reservation.depositDeadline
                ? formatCasablancaDateTimeLong(
                    reservation.depositDeadline.toISOString()
                  )
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

          const customerRequestEmail =
            generateRestaurantReservationDepositRequiredEmail({
              firstName: input.contactName,
              reference,
              reservationDateLong: formatReservationDateLong(input.date),
              partySize: input.participantsCount,
              depositDeadlineFormatted: reservation.depositDeadline
                ? formatCasablancaDateTimeLong(
                    reservation.depositDeadline.toISOString()
                  )
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

          const customerRequestEmail =
            generateRestaurantReservationDepositRequiredEmail({
              firstName: input.contactName,
              reference,
              reservationDateLong: formatReservationDateLong(input.date),
              partySize: input.participantsCount,
              depositDeadlineFormatted: reservation.depositDeadline
                ? formatCasablancaDateTimeLong(
                    reservation.depositDeadline.toISOString()
                  )
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
          message: "Réservation validée et marquée en attente de paiement.",
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

  adminCreateManual: protectedProcedure
    .input(
      z.object({
        type: z.enum(["groupe", "entreprise"]),
        groupOrCompanyName: z
          .string()
          .min(1, "Nom du groupe ou de l'entreprise requis"),
        contactName: z.string().min(1, "Nom du contact requis"),
        email: z.string().email("Email invalide"),
        phone: z.string().min(1, "Téléphone requis"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
        seatsTotal: z.number().int().min(2),
        totalAmount: z.number().min(0).optional(),
        amountReceived: z.number().min(0).optional(),
        deposit: z.number().min(0).optional(),
        nbAdult: z.number().int().min(0).optional(),
        nbKids: z.number().int().min(0).optional(),
        paymentMode: z.enum(["cash", "virement", "espece"]).optional(),
        respResa: z.enum(["Nayla", "Hind", "Kamal", "Rita"]).optional(),
        modeDeposit: z.string().optional(),
        dateAvReg: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide")
          .optional(),
        notes: z.string().optional(),
        displayChoice: z.enum(["jardin", "brasserie"]).optional(),
        status: z
          .enum([
            "pending_validation",
            "validated_pending_payment",
            "paid_confirmed",
          ])
          .default("pending_validation"),
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
        const reference = generateReservationReference(input.type);
        const qrToken = generateQrToken();

        const reservation =
          await reservationServices.createRestaurantReservation({
            reference,
            type: input.type,
            name: input.contactName,
            email: input.email,
            phone: input.phone,
            date: new Date(input.date),
            seatsTotal: input.seatsTotal,
            qrToken,
            notes: input.notes,
            displayChoice: input.displayChoice,
            companyName:
              input.type === "entreprise"
                ? input.groupOrCompanyName
                : undefined,
            groupName:
              input.type === "groupe" ? input.groupOrCompanyName : undefined,
            totalAmount: input.totalAmount,
            amountReceived: input.amountReceived,
            deposit: input.deposit,
            nbAdult: input.nbAdult,
            nbKids: input.nbKids,
            paymentMode: input.paymentMode,
            respResa: input.respResa,
            modeDeposit: input.modeDeposit,
            dateAvReg: input.dateAvReg,
          });

        if (input.status !== "pending_validation") {
          await reservationServices.updateRestaurantReservationStatus(
            reservation.id,
            input.status
          );

          if (input.status === "paid_confirmed") {
            await reservationServices.activateQrCode(reservation.id);
          }
        }

        const updated = await reservationServices.getRestaurantReservationById(
          reservation.id
        );

        return {
          success: true,
          reservation: updated || reservation,
          message: "Réservation créée manuellement",
        };
      } catch (error) {
        console.error("[Admin Create Manual Reservation] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Erreur lors de la création de la réservation manuelle",
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
        totalAmount: z.number().min(0).optional(),
        amountReceived: z.number().min(0).optional(),
        deposit: z.number().min(0).optional(),
        nbAdult: z.number().int().min(0).optional(),
        nbKids: z.number().int().min(0).optional(),
        paymentMode: z.enum(["cash", "virement", "espece"]).optional(),
        respResa: z.enum(["Nayla", "Hind", "Kamal", "Rita"]).optional(),
        companyName: z.string().optional(),
        groupName: z.string().optional(),
        displayChoice: z.string().optional(),
        modeDeposit: z.string().nullable().optional(),
        dateAvReg: z.string().nullable().optional(),
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
        const beforeUpdate =
          await reservationServices.getRestaurantReservationById(input.id);
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

          if (
            updated &&
            updated.email &&
            beforeUpdate?.status !== "paid_confirmed"
          ) {
            const reservationDateIso = updated.date
              ? updated.date.toISOString().split("T")[0]
              : "";
            const confirmedEmail = generateRestaurantReservationConfirmedEmail({
              firstName: updated.name,
              reference: updated.reference,
              reservationDateLong:
                formatReservationDateLong(reservationDateIso),
              partySize: updated.seatsTotal,
              partySizeConfirmed: updated.seatsTotal,
              depositPercent: updated.depositPercentage || 50,
            });

            await sendEmail({
              to: updated.email,
              subject: confirmedEmail.subject,
              html: confirmedEmail.html,
              text: confirmedEmail.text,
            });
          }
        }

        if (input.status === "refused") {
          const rejectedEmail = generateRestaurantReservationRejectedEmail({
            firstName: existingReservation.name,
            brandName: "La Table du Jardin",
            reference: existingReservation.reference,
            reservationDateLong: (
              existingReservation.date || new Date()
            ).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            }),
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
