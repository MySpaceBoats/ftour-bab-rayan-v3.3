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
  formatCasablancaDateTimeLong,
  generateRestaurantGroupVerificationEmail,
  generateAdminReservationValidationEmail,
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


const GROUP_RESERVATION_CONFIRMATION_TTL_MS = 1000 * 60 * 60 * 24 * 2; // 48h
const GROUP_NOTIFICATION_TO = "contact@ftourbabrayan.ma";
const GROUP_NOTIFICATION_BCC_RECIPIENTS = [
  "digital@myspace.boats",
  "nailabennani@hotmail.com",
  "reda.sebbani@gmail.com",
] as const;

const ADMIN_VALIDATION_NOTIFICATION_RECIPIENTS = [
  "ratibhind3@gmail.com",
  "reda.sebbani@gmail.com",
] as const;

const ADMIN_VALIDATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days


function getPublicAppBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    "https://www.ftourbabrayan.ma"
  ).replace(/\/$/, "");
}

async function createProofUploadUrl(reservationId: number): Promise<string | undefined> {
  try {
    const { rawToken } = await reservationServices.createReservationPaymentToken({
      reservationId,
      ttlDays: Number(process.env.RESERVATION_PROOF_TOKEN_TTL_DAYS || 7),
    });
    return `${getPublicAppBaseUrl()}/reservations/preuve?token=${encodeURIComponent(rawToken)}`;
  } catch (error) {
    console.error("[createProofUploadUrl] Failed to create token", {
      reservationId,
      error,
    });
    return undefined;
  }
}

function getReservationConfirmationSecret() {
  return process.env.RESERVATION_CONFIRMATION_SECRET || process.env.SESSION_SECRET || "restaurant-confirmation-secret";
}

function createGroupReservationConfirmationToken(reference: string, email: string): string {
  const issuedAt = Date.now();
  const payload = `${reference}|${email}|${issuedAt}`;
  const signature = crypto
    .createHmac("sha256", getReservationConfirmationSecret())
    .update(payload)
    .digest("hex");

  return Buffer.from(`${payload}|${signature}`, "utf-8").toString("base64url");
}

function verifyGroupReservationConfirmationToken(token: string): {
  reference: string;
  email: string;
  issuedAt: number;
} | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [reference, email, issuedAtRaw, signature] = decoded.split("|");

    if (!reference || !email || !issuedAtRaw || !signature) {
      return null;
    }

    const payload = `${reference}|${email}|${issuedAtRaw}`;
    const expected = crypto
      .createHmac("sha256", getReservationConfirmationSecret())
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) {
      return null;
    }

    if (Date.now() - issuedAt > GROUP_RESERVATION_CONFIRMATION_TTL_MS) {
      return null;
    }

    return { reference, email, issuedAt };
  } catch {
    return null;
  }
}

function createAdminValidationToken(reference: string): string {
  const issuedAt = Date.now();
  const payload = `${reference}|${issuedAt}`;
  const signature = crypto
    .createHmac("sha256", getReservationConfirmationSecret())
    .update(payload)
    .digest("hex");

  return Buffer.from(`${payload}|${signature}`, "utf-8").toString("base64url");
}

function verifyAdminValidationToken(token: string): { reference: string; issuedAt: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [reference, issuedAtRaw, signature] = decoded.split("|");

    if (!reference || !issuedAtRaw || !signature) {
      return null;
    }

    const payload = `${reference}|${issuedAtRaw}`;
    const expected = crypto
      .createHmac("sha256", getReservationConfirmationSecret())
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) {
      return null;
    }

    if (Date.now() - issuedAt > ADMIN_VALIDATION_TOKEN_TTL_MS) {
      return null;
    }

    return { reference, issuedAt };
  } catch {
    return null;
  }
}

async function sendAdminValidationNotifications(params: {
  type: "particulier" | "entreprise" | "groupe";
  date: string;
  participantsCount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  reference: string;
  companyName?: string;
  groupName?: string;
  displayChoice?: string;
}) {
  const token = createAdminValidationToken(params.reference);
  const validationUrl = `${getPublicAppBaseUrl()}/reservation/valider/${token}`;

  for (const recipient of ADMIN_VALIDATION_NOTIFICATION_RECIPIENTS) {
    try {
      const notifEmail = generateAdminReservationValidationEmail({
        ...params,
        validationUrl,
      });
      await sendEmail({
        to: recipient,
        subject: notifEmail.subject,
        html: notifEmail.html,
      });
    } catch (err) {
      console.error("[sendAdminValidationNotifications] Failed to send to", recipient, err);
    }
  }
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
async function runAutoCancellationAndNotifySafely() {
  try {
    await runAutoCancellationAndNotify();
  } catch (error) {
    console.error("[runAutoCancellationAndNotifySafely] Failed", error);
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
          participantsCount: z.number().int().min(1).max(12),
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

          const proofUploadUrl = await createProofUploadUrl(reservation.id);
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
              proofUploadUrl,
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

          await sendAdminValidationNotifications({
            type: "particulier",
            date: input.date,
            participantsCount: input.participantsCount,
            contactName: input.firstName,
            contactEmail: input.email,
            contactPhone: input.phone,
            reference,
            displayChoice: input.displayChoice,
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

          const proofUploadUrl = await createProofUploadUrl(reservation.id);
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
              proofUploadUrl,
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

          await sendAdminValidationNotifications({
            type: "entreprise",
            date: input.date,
            participantsCount: input.participantsCount,
            contactName: input.contactName,
            contactEmail: input.email,
            contactPhone: input.phone,
            reference,
            companyName: input.companyName,
            displayChoice: input.displayChoice,
          });

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
              nbAdult: input.participantsCount,
              qrToken,
              groupName: input.groupName,
              groupType: input.groupType,
              displayChoice: input.displayChoice,
            });

          await reservationServices.updateRestaurantReservationStatus(
            reservation.id,
            "pending_confirmation"
          );

          const appBaseUrl =
            process.env.APP_BASE_URL ||
            process.env.PUBLIC_APP_URL ||
            process.env.FRONTEND_URL ||
            "https://ftourbabrayan.org";
          const confirmationToken = createGroupReservationConfirmationToken(
            reference,
            input.email
          );
          const confirmationUrl = `${appBaseUrl}/reservation-groupe/confirmation-email/${confirmationToken}`;

          const verificationEmail = generateRestaurantGroupVerificationEmail({
            firstName: input.contactName,
            reference,
            reservationDateLong: formatReservationDateLong(input.date),
            partySize: input.participantsCount,
            verificationUrl: confirmationUrl,
          });

          await sendEmail({
            to: input.email,
            subject: verificationEmail.subject,
            html: verificationEmail.html,
            text: verificationEmail.text,
          });

          return {
            success: true,
            reservation,
            message: "Demande reçue. Confirmez votre email pour finaliser la réservation.",
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


  confirmGroupEmail: publicProcedure
    .input(
      z.object({
        token: z.string().min(10, "Token invalide"),
      })
    )
    .mutation(async ({ input }) => {
      const parsed = verifyGroupReservationConfirmationToken(input.token);
      if (!parsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lien de confirmation invalide ou expiré",
        });
      }

      const reservation =
        await reservationServices.getRestaurantReservationByReference(
          parsed.reference
        );

      if (!reservation || reservation.type !== "groupe") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation introuvable",
        });
      }

      if (reservation.email.toLowerCase() !== parsed.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce lien ne correspond pas à cette réservation",
        });
      }

      if (reservation.status === "pending_confirmation") {
        await reservationServices.updateRestaurantReservationStatus(
          reservation.id,
          "pending_validation"
        );

        const proofUploadUrl = await createProofUploadUrl(reservation.id);
        const customerRequestEmail =
          generateRestaurantReservationDepositRequiredEmail({
            firstName: reservation.name,
            reference: reservation.reference,
            reservationDateLong: formatReservationDateLong(
              reservation.date ? reservation.date.toISOString().split("T")[0] : ""
            ),
            partySize: reservation.seatsTotal,
            depositDeadlineFormatted: reservation.depositDeadline
              ? formatCasablancaDateTimeLong(
                  reservation.depositDeadline.toISOString()
                )
              : undefined,
            proofUploadUrl,
          });

        await sendEmail({
          to: reservation.email,
          subject: customerRequestEmail.subject,
          html: customerRequestEmail.html,
          text: customerRequestEmail.text,
        });

        const groupNotificationDate = reservation.date
          ? reservation.date.toISOString().split("T")[0]
          : "date inconnue";
        const groupNotificationHtml = generateNewBookingNotificationEmail({
          type: "groupe",
          date: reservation.date
            ? reservation.date.toISOString().split("T")[0]
            : "",
          participantsCount: reservation.seatsTotal,
          contactName: reservation.name,
          contactEmail: reservation.email,
          contactPhone: reservation.phone,
          reference: reservation.reference,
          displayChoice:
            reservation.displayChoice === "jardin" ? "jardin" : "brasserie",
        }).html;

        await sendEmail({
          to: GROUP_NOTIFICATION_TO,
          bcc: [...GROUP_NOTIFICATION_BCC_RECIPIENTS],
          subject: `Nouvelle demande Groupe - ${groupNotificationDate}`,
          html: groupNotificationHtml,
        });

        await sendAdminValidationNotifications({
          type: "groupe",
          date: reservation.date ? reservation.date.toISOString().split("T")[0] : "",
          participantsCount: reservation.seatsTotal,
          contactName: reservation.name,
          contactEmail: reservation.email,
          contactPhone: reservation.phone,
          reference: reservation.reference,
          groupName: reservation.groupName ?? undefined,
          displayChoice: reservation.displayChoice === "jardin" ? "jardin" : "brasserie",
        });
      }

      const refreshed = await reservationServices.getRestaurantReservationById(
        reservation.id
      );

      return {
        success: true,
        status: refreshed?.status ?? reservation.status,
      };
    }),

  validate: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        baseUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
      "admin_ops",
      "admin_operations",
    ];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      await runAutoCancellationAndNotifySafely();
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
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
      "admin_ops",
      "admin_operations",
    ];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      await runAutoCancellationAndNotifySafely();
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
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
      "admin_ops",
      "admin_operations",
    ];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      await runAutoCancellationAndNotifySafely();
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

  adminListAll: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
      "admin_ops",
      "admin_operations",
    ];
    if (!allowedRoles.includes(ctx.user?.role || "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    try {
      await runAutoCancellationAndNotifySafely();
      return await reservationServices.listRestaurantReservations();
    } catch (error) {
      console.error("[adminListAll] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors du chargement des réservations",
      });
    }
  }),

  adminCreateManual: protectedProcedure
    .input(
      z.object({
        type: z.literal("groupe"),
        groupOrCompanyName: z
          .string()
          .min(1, "Nom du groupe requis"),
        contactName: z.string().min(1, "Nom du contact requis"),
        email: z.string().email("Email invalide"),
        phone: z.string().min(1, "Téléphone requis"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
        seatsTotal: z.number().int().min(2),
        totalAmount: z.number().min(0).optional(),
        adultAmount: z.number().min(0).optional(),
        kidsAmount: z.number().min(0).optional(),
        amountReceived: z.number().min(0).optional(),
        deposit: z.number().min(0).optional(),
        nbAdult: z.number().int().min(0).optional(),
        nbKids: z.number().int().min(0).optional(),
        paymentMode: z.enum(["cash", "virement", "espece"]).optional(),
        respResa: z.enum(["Nayla", "Hind", "Kamal", "Rita", "Réda", "Souad"]).optional(),
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
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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
            groupName: input.groupOrCompanyName,
            totalAmount: input.totalAmount,
            amountReceived: input.amountReceived,
            deposit: input.deposit,
            nbAdult: input.nbAdult,
            nbKids: input.nbKids,
            adultAmount: input.adultAmount,
            kidsAmount: input.kidsAmount,
            paymentMode: input.paymentMode,
            respResa: input.respResa,
            modeDeposit: input.modeDeposit,
            dateAvReg: input.dateAvReg,
            entrySource: "admin",
            createdByName: ctx.user?.name ?? undefined,
            createdByEmail: ctx.user?.email ?? undefined,
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
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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
      z
        .object({
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
          adultAmount: z.number().min(0).optional(),
          kidsAmount: z.number().min(0).optional(),
          amountReceived: z.number().min(0).optional(),
          deposit: z.number().min(0).optional(),
          nbAdult: z.number().int().min(0).optional(),
          nbKids: z.number().int().min(0).optional(),
          paymentMode: z.enum(["cash", "virement", "espece"]).optional(),
          respResa: z.enum(["Nayla", "Hind", "Kamal", "Rita", "Réda", "Souad"]).optional(),
          companyName: z.string().optional(),
          groupName: z.string().optional(),
          displayChoice: z.string().optional(),
          modeDeposit: z.string().nullable().optional(),
          dateAvReg: z.string().nullable().optional(),
        })
        .refine(
          payload =>
            Object.keys(payload).some(key => key !== "id" && payload[key as keyof typeof payload] !== undefined),
          {
            message: "Aucun champ valide à mettre à jour",
          }
        )
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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
  adminGetLatestProofUrl: protectedProcedure
    .input(
      z.object({
        reservationId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
      if (!allowedRoles.includes(ctx.user?.role || "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
      }

      const proof = await reservationServices.createReservationPaymentProofSignedUrl({
        reservationId: input.reservationId,
        expiresInSeconds: 60 * 60,
      });

      if (!proof?.signedUrl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucune preuve de virement trouvée",
        });
      }

      return proof;
    }),

  adminUpdateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "pending_validation",
          "validated_pending_payment",
          "pending_deposit",
          "deposit_submitted",
          "deposit_received",
          "paid_confirmed",
          "confirmed",
          "refused",
          "cancelled",
          "cancelled_auto",
          "completed",
          "no_show",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
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

  // ============================================
  // PUBLIC: VALIDATE RESERVATION VIA ADMIN TOKEN
  // (triggered when admin clicks validation link in notification email)
  // ============================================

  validateByAdminToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(10, "Token invalide"),
      })
    )
    .mutation(async ({ input }) => {
      const parsed = verifyAdminValidationToken(input.token);
      if (!parsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lien de validation invalide ou expiré",
        });
      }

      const reservation =
        await reservationServices.getRestaurantReservationByReference(
          parsed.reference
        );

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation introuvable",
        });
      }

      const alreadyValidated = [
        "validated_pending_payment",
        "paid_confirmed",
        "confirmed",
        "completed",
      ].includes(reservation.status);

      if (!alreadyValidated) {
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
      }

      return {
        success: true,
        alreadyValidated,
        reference: reservation.reference,
        clientEmail: reservation.email,
      };
    }),
});
