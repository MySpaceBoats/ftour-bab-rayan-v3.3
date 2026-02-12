/**
 * Restaurant Reservations Router for Cloudflare Workers
 * Handles particulier, entreprise, and groupe reservation requests
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from './routers';
import { createSupabaseAdmin } from './supabase';
import { sendEmail, generateParticulierReservationRequestEmail, generateNewBookingNotificationEmail } from './email';

// Helper to generate reference using Web Crypto API
function generateReservationReference(type: 'particulier' | 'entreprise' | 'groupe'): string {
  const typeCode = type === 'particulier' ? 'P' : type === 'entreprise' ? 'E' : 'G';
  const randomBytes = crypto.getRandomValues(new Uint8Array(3));
  const randomPart = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `RES-${typeCode}-${randomPart}`;
}

// Helper to generate QR token using Web Crypto API
function generateQrToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Date validation helper
function isDateInRange(dateStr: string): boolean {
  const date = new Date(dateStr);
  const startDate = new Date('2026-02-20');
  const endDate = new Date('2026-03-13');
  return date >= startDate && date <= endDate;
}

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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const requestId = generateQrToken().substring(0, 8);

        console.log(`[RestaurantReservations] [${requestId}] Particulier request received`, {
          email: input.email,
          date: input.date,
          participants: input.participantsCount,
        });

        try {
          // Validate date range
          if (!isDateInRange(input.date)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'La date doit être entre le 20 février et le 13 mars 2026',
            });
          }

          const reference = generateReservationReference('particulier');
          const qrToken = generateQrToken();
          const supabase = createSupabaseAdmin(ctx.env);

          console.log(`[RestaurantReservations] [${requestId}] Creating reservation`, { reference });

          // Insert into database
          const { data: reservation, error: dbError } = await supabase
            .from('restaurant_reservations')
            .insert({
              reference,
              type: 'particulier',
              name: input.firstName,
              email: input.email,
              phone: input.phone,
              date: input.date,
              seatsTotal: input.participantsCount,
              qrToken,
              displayChoice: 'jardin',
              status: 'pending_validation',
              paymentStatus: 'not_requested',
              qrStatus: 'inactive',
              slotId: 1, // Default slot (18h45)
            })
            .select()
            .single();

          if (dbError) {
            console.error(`[RestaurantReservations] [${requestId}] Database error`, dbError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Erreur base de données: ${dbError.message}`,
            });
          }

          console.log(`[RestaurantReservations] [${requestId}] Reservation created`, { id: reservation?.id });

          // Send customer email
          const customerEmailResult = await sendEmail({
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
            apiKey: ctx.env.RESEND_API_KEY,
          });

          // Send internal notification email
          const internalEmailResult = await sendEmail({
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
            apiKey: ctx.env.RESEND_API_KEY,
          });

          console.log(`[RestaurantReservations] [${requestId}] Emails sent`, {
            customer: customerEmailResult.success ? customerEmailResult.id : customerEmailResult.error,
            internal: internalEmailResult.success ? internalEmailResult.id : internalEmailResult.error,
          });

          return {
            success: true,
            reservation: { reference, ...reservation },
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error(`[RestaurantReservations] [${requestId}] Error`, error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Erreur lors de la création de la réservation',
          });
        }
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
      .mutation(async ({ input, ctx }) => {
        const requestId = generateQrToken().substring(0, 8);

        console.log(`[RestaurantReservations] [${requestId}] Entreprise request received`, {
          companyName: input.companyName,
          email: input.email,
          date: input.date,
          participants: input.participantsCount,
        });

        try {
          // Validate date range
          if (!isDateInRange(input.date)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'La date doit être entre le 20 février et le 13 mars 2026',
            });
          }

          const reference = generateReservationReference('entreprise');
          const qrToken = generateQrToken();
          const supabase = createSupabaseAdmin(ctx.env);

          console.log(`[RestaurantReservations] [${requestId}] Creating reservation`, { reference });

          // Insert into database
          const { data: reservation, error: dbError } = await supabase
            .from('restaurant_reservations')
            .insert({
              reference,
              type: 'entreprise',
              name: input.contactName,
              email: input.email,
              phone: input.phone,
              date: input.date,
              seatsTotal: input.participantsCount,
              qrToken,
              displayChoice: 'jardin',
              companyName: input.companyName,
              notes: input.companyNotes || null,
              status: 'pending_validation',
              paymentStatus: 'not_requested',
              qrStatus: 'inactive',
              slotId: 1,
            })
            .select()
            .single();

          if (dbError) {
            console.error(`[RestaurantReservations] [${requestId}] Database error`, dbError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Erreur base de données: ${dbError.message}`,
            });
          }

          console.log(`[RestaurantReservations] [${requestId}] Reservation created`, { id: reservation?.id });

          // Send customer email
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
            apiKey: ctx.env.RESEND_API_KEY,
          });

          // Send internal notification
          const internalEmailResult = await sendEmail({
            to: 'digital@myspace.boats',
            subject: generateNewBookingNotificationEmail({
              type: 'entreprise',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              companyName: input.companyName,
            }).subject,
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
            apiKey: ctx.env.RESEND_API_KEY,
          });

          console.log(`[RestaurantReservations] [${requestId}] Emails sent`, {
            customer: customerEmailResult.success ? customerEmailResult.id : customerEmailResult.error,
            internal: internalEmailResult.success ? internalEmailResult.id : internalEmailResult.error,
          });

          return {
            success: true,
            reservation: { reference, ...reservation },
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error(`[RestaurantReservations] [${requestId}] Error`, error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Erreur lors de la création de la réservation',
          });
        }
      }),
  }),

  groupe: router({
    create: publicProcedure
      .input(
        z.object({
          contactName: z.string().min(1, "Nom contact requis"),
          email: z.string().email("Email invalide"),
          phone: z.string().min(1, "Téléphone requis"),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
          participantsCount: z.number().int().min(1).max(120),
          groupName: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const requestId = generateQrToken().substring(0, 8);

        console.log(`[RestaurantReservations] [${requestId}] Groupe request received`, {
          groupName: input.groupName,
          email: input.email,
          date: input.date,
          participants: input.participantsCount,
        });

        try {
          // Validate date range
          if (!isDateInRange(input.date)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'La date doit être entre le 20 février et le 13 mars 2026',
            });
          }

          const reference = generateReservationReference('groupe');
          const qrToken = generateQrToken();
          const supabase = createSupabaseAdmin(ctx.env);

          console.log(`[RestaurantReservations] [${requestId}] Creating reservation`, { reference });

          // Insert into database
          const { data: reservation, error: dbError } = await supabase
            .from('restaurant_reservations')
            .insert({
              reference,
              type: 'groupe',
              name: input.contactName,
              email: input.email,
              phone: input.phone,
              date: input.date,
              seatsTotal: input.participantsCount,
              qrToken,
              displayChoice: 'jardin',
              groupName: input.groupName || null,
              status: 'pending_validation',
              paymentStatus: 'not_requested',
              qrStatus: 'inactive',
              slotId: 1,
            })
            .select()
            .single();

          if (dbError) {
            console.error(`[RestaurantReservations] [${requestId}] Database error`, dbError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Erreur base de données: ${dbError.message}`,
            });
          }

          console.log(`[RestaurantReservations] [${requestId}] Reservation created`, { id: reservation?.id });

          // Send customer email
          const customerEmailResult = await sendEmail({
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
            apiKey: ctx.env.RESEND_API_KEY,
          });

          // Send internal notification
          const internalEmailResult = await sendEmail({
            to: 'digital@myspace.boats',
            subject: generateNewBookingNotificationEmail({
              type: 'groupe',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              groupName: input.groupName,
            }).subject,
            html: generateNewBookingNotificationEmail({
              type: 'groupe',
              date: input.date,
              participantsCount: input.participantsCount,
              contactName: input.contactName,
              contactEmail: input.email,
              contactPhone: input.phone,
              reference,
              groupName: input.groupName,
            }).html,
            apiKey: ctx.env.RESEND_API_KEY,
          });

          console.log(`[RestaurantReservations] [${requestId}] Emails sent`, {
            customer: customerEmailResult.success ? customerEmailResult.id : customerEmailResult.error,
            internal: internalEmailResult.success ? internalEmailResult.id : internalEmailResult.error,
          });

          return {
            success: true,
            reservation: { reference, ...reservation },
            message: "Demande reçue. Vérifiez votre email.",
          };
        } catch (error) {
          console.error(`[RestaurantReservations] [${requestId}] Error`, error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Erreur lors de la création de la réservation',
          });
        }
      }),
  }),
});
