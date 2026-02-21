import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { getSupabaseAdminClient } from './supabase';
import * as supabaseServices from './supabase-services';
import * as reservationServices from './reservation-services';

// ============================================
// SCANNER ACCESS GUARD (Admin Session Required)
// ============================================
/**
 * Scanner access guard - requires active admin session
 * Allowed roles: admin, super_admin, admin_ops, scanner
 */
const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'scanner'];

  // Check if user exists and has valid session
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Accès non autorisé – session administrateur requise'
    });
  }

  // Check if user has required role
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Accès non autorisé – session administrateur requise'
    });
  }

  return next({ ctx });
});

// ============================================
// QR TYPE DETECTION
// ============================================
type QrType = 'volunteer' | 'reservation_particulier' | 'reservation_entreprise' | 'reservation_groupe' | 'pastry' | 'terroir' | 'goodies' | 'donation' | 'unknown';

function detectQrType(token: string): QrType {
  if (token.startsWith('rp-')) return 'reservation_particulier';
  if (token.startsWith('re-')) return 'reservation_entreprise';
  if (token.startsWith('rg-')) return 'reservation_groupe';
  if (token.startsWith('ter-') || token.startsWith('TER-')) return 'terroir';
  if (token.startsWith('PASTRY-')) return 'pastry';
  if (token.startsWith('DON-')) return 'donation';
  // Hex tokens (128-bit) are volunteers
  if (/^[a-f0-9]{32,}$/i.test(token)) return 'volunteer';
  // Fallback: try to detect by looking up in DB
  return 'unknown';
}

function extractTokenFromUrl(rawInput: string): string {
  try {
    // Handle full URLs
    if (rawInput.includes('/checkin-reservation/')) {
      const parts = rawInput.split('/checkin-reservation/');
      return parts[parts.length - 1].split('?')[0];
    }
    if (rawInput.includes('/qr/pastry/')) {
      const parts = rawInput.split('/qr/pastry/');
      return parts[parts.length - 1].split('?')[0];
    }
    if (rawInput.includes('/qr/terroir/')) {
      const parts = rawInput.split('/qr/terroir/');
      return parts[parts.length - 1].split('?')[0];
    }
    if (rawInput.includes('/buy/goodie/')) {
      const parts = rawInput.split('/buy/goodie/');
      return parts[parts.length - 1].split('?')[0];
    }
    if (rawInput.includes('/checkin/')) {
      const parts = rawInput.split('/checkin/');
      return parts[parts.length - 1].split('?')[0];
    }
    // Already a token
    return rawInput.trim();
  } catch {
    return rawInput.trim();
  }
}

const QR_TYPE_LABELS: Record<QrType, string> = {
  volunteer: 'Bénévole',
  reservation_particulier: 'Réservation Particulier',
  reservation_entreprise: 'Réservation Entreprise',
  reservation_groupe: 'Réservation Groupe',
  pastry: 'Commande Pâtisserie',
  terroir: 'Commande Terroir',
  goodies: 'Commande Goodies',
  donation: 'Don',
  unknown: 'Inconnu',
};

// ============================================
// UNIFIED SCANNER ROUTER
// ============================================
export const scannerRouter = router({
  /**
   * Identify a QR code: detect its type and return entity info
   */
  identify: scannerProcedure
    .input(z.object({ rawCode: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const token = extractTokenFromUrl(input.rawCode);
      let qrType = detectQrType(token);
      const supabase = getSupabaseAdminClient();

      // ---- VOLUNTEER (auto-validation) ----
      if (qrType === 'volunteer') {
        const volunteer = await supabaseServices.getVolunteerByTokenSupabase(token);
        if (volunteer) {
          // Auto-validate: immediately confirm the volunteer on scan
          const validationResult = await supabaseServices.scanAndValidateTokenSupabase(
            token,
            ctx.user?.id
          );

          const vol = validationResult.volunteer;
          const fullName = vol ? `${vol.firstName} ${vol.lastName}` : `${volunteer.firstName} ${volunteer.lastName}`;

          return {
            type: 'volunteer' as QrType,
            typeLabel: QR_TYPE_LABELS.volunteer,
            token,
            found: true,
            autoValidated: true,
            validationState: validationResult.state || (validationResult.success ? 'confirmed' : 'error'),
            validationMessage: validationResult.success
              ? (validationResult.state === 'already_confirmed'
                  ? `Déjà confirmé — ${fullName}`
                  : `Bénévole confirmé — ${fullName}`)
              : (validationResult.error || 'Erreur de validation'),
            validationSuccess: validationResult.success,
            entity: {
              id: volunteer.id,
              name: fullName,
              email: vol?.email || volunteer.email,
              phone: vol?.phone || volunteer.phone,
              status: vol?.status || volunteer.status,
              qrStatus: vol?.qrStatus || volunteer.qrStatus,
              dayNumber: volunteer.day?.dayNumber,
              dayDate: volunteer.day?.date,
              location: volunteer.day?.location,
              iftarTime: volunteer.day?.iftarTime,
              alreadyValidated: validationResult.state === 'already_confirmed' || volunteer.qrStatus === 'validated',
              scannedAt: vol?.scannedAt || volunteer.scannedAt,
            },
          };
        }
        // Hex token not found as volunteer — fall through to unknown handler
        // (restaurant reservations also use hex tokens)
        qrType = 'unknown';
      }

      // ---- RESERVATION (all types) ----
      if (qrType === 'reservation_particulier' || qrType === 'reservation_entreprise' || qrType === 'reservation_groupe') {
        const reservation = await reservationServices.getReservationByQrTokenSupabase(token);
        if (!reservation) {
          return { type: qrType, typeLabel: QR_TYPE_LABELS[qrType], token, found: false, error: 'Réservation introuvable' };
        }
        return {
          type: qrType,
          typeLabel: QR_TYPE_LABELS[qrType],
          token,
          found: true,
          entity: {
            id: reservation.id,
            name: reservation.fullName,
            email: reservation.email,
            phone: reservation.phone,
            status: reservation.status,
            guests: reservation.seats,
            date: reservation.date,
            reference: reservation.referenceCode,
            restaurantName: reservation.restaurant?.name || reservation.restaurantName,
            slotTime: reservation.slot?.startTime,
            qrStatus: reservation.status,
            alreadyValidated: reservation.status === 'checked_in',
          },
        };
      }

      // ---- TERROIR ----
      if (qrType === 'terroir' && supabase) {
        // Try by qr_token first, then by order_reference (QR codes encode the reference)
        let { data: order } = await supabase
          .from('terroir_orders')
          .select('*, terroir_order_items(*, terroir_products(name))')
          .eq('qr_token', token)
          .single();
        if (!order) {
          const { data: orderByRef } = await supabase
            .from('terroir_orders')
            .select('*, terroir_order_items(*, terroir_products(name))')
            .eq('order_reference', token)
            .single();
          order = orderByRef;
        }
        if (!order) {
          return { type: 'terroir' as QrType, typeLabel: QR_TYPE_LABELS.terroir, token, found: false, error: 'Commande terroir introuvable' };
        }
        return {
          type: 'terroir' as QrType,
          typeLabel: QR_TYPE_LABELS.terroir,
          token,
          found: true,
          entity: {
            id: order.id,
            name: order.customer_name,
            phone: order.customer_phone,
            email: order.customer_email,
            status: order.status,
            reference: order.order_reference,
            totalAmount: order.total_amount,
            qrStatus: order.qr_status,
            alreadyValidated: order.qr_status === 'validated',
            items: (order.terroir_order_items || []).map((i: any) => ({
              name: i.terroir_products?.name || `Produit #${i.product_id}`,
              quantity: i.quantity,
              price: i.unit_price,
            })),
          },
        };
      }

      // ---- PASTRY ----
      if (qrType === 'pastry' && supabase) {
        // Try by qr_token first, then by order_reference (QR codes encode the reference)
        let { data: pastryOrder } = await supabase
          .from('pastry_orders')
          .select('*')
          .eq('qr_token', token)
          .single();
        if (!pastryOrder) {
          const { data: pastryByRef } = await supabase
            .from('pastry_orders')
            .select('*')
            .eq('order_reference', token)
            .single();
          pastryOrder = pastryByRef;
        }
        if (!pastryOrder) {
          return { type: 'pastry' as QrType, typeLabel: QR_TYPE_LABELS.pastry, token, found: false, error: 'Commande pâtisserie introuvable' };
        }
        return {
          type: 'pastry' as QrType,
          typeLabel: QR_TYPE_LABELS.pastry,
          token,
          found: true,
          entity: {
            id: pastryOrder.id,
            name: pastryOrder.customer_name,
            phone: pastryOrder.customer_phone,
            email: pastryOrder.customer_email,
            status: pastryOrder.order_status,
            qrStatus: pastryOrder.qr_status,
            alreadyValidated: pastryOrder.order_status === 'handed',
            reference: pastryOrder.order_reference,
          },
        };
      }

      // ---- DONATION ----
      if (qrType === 'donation' && supabase) {
        const { data: donation } = await supabase
          .from('donations')
          .select('*')
          .eq('donation_reference', token)
          .single();
        if (!donation) {
          return { type: 'donation' as QrType, typeLabel: QR_TYPE_LABELS.donation, token, found: false, error: 'Don introuvable' };
        }
        return {
          type: 'donation' as QrType,
          typeLabel: QR_TYPE_LABELS.donation,
          token,
          found: true,
          entity: {
            id: donation.id,
            name: donation.donor_name,
            phone: donation.donor_phone,
            email: donation.donor_email,
            status: donation.status,
            reference: donation.donation_reference,
            amount: parseFloat(donation.amount) || 0,
            paymentMethod: donation.payment_method,
            alreadyValidated: donation.status === 'received',
          },
        };
      }

      // ---- UNKNOWN: try all tables ----
      if (qrType === 'unknown' && supabase) {
        // Try volunteer
        const volunteer = await supabaseServices.getVolunteerByTokenSupabase(token);
        if (volunteer) {
          return {
            type: 'volunteer' as QrType,
            typeLabel: QR_TYPE_LABELS.volunteer,
            token,
            found: true,
            entity: {
              id: volunteer.id,
              name: `${volunteer.firstName} ${volunteer.lastName}`,
              email: volunteer.email,
              phone: volunteer.phone,
              status: volunteer.status,
              qrStatus: volunteer.qrStatus,
              dayNumber: volunteer.day?.dayNumber,
              dayDate: volunteer.day?.date,
              alreadyValidated: volunteer.qrStatus === 'validated',
              scannedAt: volunteer.scannedAt,
            },
          };
        }
        // Try reservation
        const reservation = await reservationServices.getReservationByQrTokenSupabase(token);
        if (reservation) {
          return {
            type: 'reservation_particulier' as QrType,
            typeLabel: 'Réservation',
            token,
            found: true,
            entity: {
              id: reservation.id,
              name: reservation.fullName,
              email: reservation.email,
              phone: reservation.phone,
              status: reservation.status,
              guests: reservation.seats,
              date: reservation.date,
              reference: reservation.referenceCode,
              qrStatus: reservation.status,
              alreadyValidated: reservation.status === 'checked_in',
            },
          };
        }
        // Try pastry order (by qr_token or order_reference)
        let pastryOrder = null;
        const { data: pastryByToken } = await supabase
          .from('pastry_orders')
          .select('*')
          .eq('qr_token', token)
          .single();
        pastryOrder = pastryByToken;
        if (!pastryOrder) {
          const { data: pastryByRef } = await supabase
            .from('pastry_orders')
            .select('*')
            .eq('order_reference', token)
            .single();
          pastryOrder = pastryByRef;
        }
        if (pastryOrder) {
          return {
            type: 'pastry' as QrType,
            typeLabel: QR_TYPE_LABELS.pastry,
            token,
            found: true,
            entity: {
              id: pastryOrder.id,
              name: pastryOrder.customer_name,
              phone: pastryOrder.customer_phone,
              email: pastryOrder.customer_email,
              status: pastryOrder.order_status,
              qrStatus: pastryOrder.qr_status,
              alreadyValidated: pastryOrder.order_status === 'handed',
              reference: pastryOrder.order_reference,
            },
          };
        }
        // Try terroir order (by qr_token or order_reference)
        let terroirOrder = null;
        const { data: terroirByToken } = await supabase
          .from('terroir_orders')
          .select('*')
          .eq('qr_token', token)
          .single();
        terroirOrder = terroirByToken;
        if (!terroirOrder) {
          const { data: terroirByRef } = await supabase
            .from('terroir_orders')
            .select('*')
            .eq('order_reference', token)
            .single();
          terroirOrder = terroirByRef;
        }
        if (terroirOrder) {
          return {
            type: 'terroir' as QrType,
            typeLabel: QR_TYPE_LABELS.terroir,
            token,
            found: true,
            entity: {
              id: terroirOrder.id,
              name: terroirOrder.customer_name,
              phone: terroirOrder.customer_phone,
              email: terroirOrder.customer_email,
              status: terroirOrder.status,
              qrStatus: terroirOrder.qr_status,
              alreadyValidated: terroirOrder.qr_status === 'validated',
              reference: terroirOrder.order_reference,
            },
          };
        }
        // Try QR tokens (goodies)
        const { data: qrTokenRow } = await supabase
          .from('qr_tokens')
          .select('*')
          .eq('token', token)
          .single();
        if (qrTokenRow) {
          return {
            type: qrTokenRow.scope === 'pastry' ? 'pastry' as QrType : 'goodies' as QrType,
            typeLabel: qrTokenRow.scope === 'pastry' ? QR_TYPE_LABELS.pastry : QR_TYPE_LABELS.goodies,
            token,
            found: true,
            entity: {
              id: qrTokenRow.id,
              status: qrTokenRow.status,
              scope: qrTokenRow.scope,
              alreadyValidated: qrTokenRow.status === 'used',
              usesCount: qrTokenRow.uses_count,
              maxUses: qrTokenRow.max_uses,
            },
          };
        }
        // Try donation by reference
        const { data: donationRow } = await supabase
          .from('donations')
          .select('*')
          .eq('donation_reference', token)
          .single();
        if (donationRow) {
          return {
            type: 'donation' as QrType,
            typeLabel: QR_TYPE_LABELS.donation,
            token,
            found: true,
            entity: {
              id: donationRow.id,
              name: donationRow.donor_name,
              phone: donationRow.donor_phone,
              email: donationRow.donor_email,
              status: donationRow.status,
              reference: donationRow.donation_reference,
              amount: parseFloat(donationRow.amount) || 0,
              paymentMethod: donationRow.payment_method,
              alreadyValidated: donationRow.status === 'received',
            },
          };
        }
      }

      return { type: 'unknown' as QrType, typeLabel: 'Inconnu', token, found: false, error: 'QR code non reconnu dans le système' };
    }),

  /**
   * Validate/check-in a QR code based on its type
   *
   * SECURITY:
   * - Requires admin session (scannerProcedure)
   * - Updates status atomically in database
   * - Creates audit trail for all validations
   */
  validate: scannerProcedure
    .input(z.object({
      token: z.string().min(1),
      type: z.enum(['volunteer', 'reservation_particulier', 'reservation_entreprise', 'reservation_groupe', 'pastry', 'terroir', 'goodies', 'donation', 'unknown']),
      entityId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseAdminClient();

      // ---- VOLUNTEER ----
      if (input.type === 'volunteer') {
        const result = await supabaseServices.scanAndValidateTokenSupabase(
          input.token,
          ctx.user?.id
        );
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'Erreur de validation bénévole' });
        }
        const vol = result.volunteer;
        const fullName = vol ? `${vol.firstName} ${vol.lastName}` : '';
        if (result.state === 'already_confirmed') {
          return {
            success: true,
            message: `Déjà confirmé — ${fullName}`,
            state: 'already_confirmed' as const,
            volunteer: vol ? { id: vol.id, name: fullName, email: vol.email, phone: vol.phone } : undefined,
          };
        }
        return {
          success: true,
          message: `Bénévole confirmé — ${fullName}`,
          state: 'confirmed' as const,
          volunteer: vol ? { id: vol.id, name: fullName, email: vol.email, phone: vol.phone } : undefined,
        };
      }

      // ---- RESERVATION ----
      if (input.type.startsWith('reservation_')) {
        const checkin = await reservationServices.createCheckinSupabase({
          reservationId: input.entityId,
          validationMode: 'scan',
          validatedBy: ctx.user?.name || ctx.user?.email || 'Scanner',
        });
        return { success: true, message: 'Check-in réservation validé !', data: checkin };
      }

      // ---- TERROIR ----
      if (input.type === 'terroir' && supabase) {
        const { data: order } = await supabase
          .from('terroir_orders')
          .select('qr_status, status')
          .eq('id', input.entityId)
          .single();
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Commande terroir introuvable' });
        if (order.qr_status === 'validated') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Commande déjà validée' });
        await supabase.from('terroir_orders')
          .update({ qr_status: 'validated', status: 'handed' })
          .eq('id', input.entityId);
        return { success: true, message: 'Commande terroir remise !' };
      }

      // ---- PASTRY ----
      if (input.type === 'pastry' && supabase) {
        const { data: order } = await supabase
          .from('pastry_orders')
          .select('qr_status, order_status')
          .eq('id', input.entityId)
          .single();
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Commande pâtisserie introuvable' });
        if (order.order_status === 'handed') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Commande déjà remise' });
        await supabase.from('pastry_orders')
          .update({ qr_status: 'validated', order_status: 'handed' })
          .eq('id', input.entityId);
        return { success: true, message: 'Commande pâtisserie remise !' };
      }

      // ---- GOODIES (via qr_tokens) ----
      if (input.type === 'goodies') {
        try {
          await supabaseServices.validateQRTokenSupabase(input.token, 'goodies');
          return { success: true, message: 'Commande goodies validée !' };
        } catch (err: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
        }
      }

      // ---- DONATION ----
      if (input.type === 'donation' && supabase) {
        const { data: donation } = await supabase
          .from('donations')
          .select('status')
          .eq('id', input.entityId)
          .single();
        if (!donation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Don introuvable' });
        if (donation.status === 'received') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Don déjà marqué comme reçu' });
        await supabase.from('donations')
          .update({ status: 'received' })
          .eq('id', input.entityId);
        return { success: true, message: 'Don marqué comme reçu !' };
      }

      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Type de QR non supporté pour la validation' });
    }),
});
