import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { getSupabaseAdminClient } from './supabase';
import * as supabaseServices from './supabase-services';
import * as reservationServices from './reservation-services';

// Scanner access guard
const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'scanner'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès scanner requis' });
  }
  return next({ ctx });
});

// ============================================
// QR TYPE DETECTION
// ============================================
type QrType = 'volunteer' | 'reservation_particulier' | 'reservation_entreprise' | 'reservation_groupe' | 'pastry' | 'terroir' | 'goodies' | 'unknown';

function detectQrType(token: string): QrType {
  if (token.startsWith('rp-')) return 'reservation_particulier';
  if (token.startsWith('re-')) return 'reservation_entreprise';
  if (token.startsWith('rg-')) return 'reservation_groupe';
  if (token.startsWith('ter-')) return 'terroir';
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
    .mutation(async ({ input }) => {
      const token = extractTokenFromUrl(input.rawCode);
      let qrType = detectQrType(token);
      const supabase = getSupabaseAdminClient();

      // ---- VOLUNTEER ----
      if (qrType === 'volunteer') {
        const volunteer = await supabaseServices.getVolunteerByTokenSupabase(token);
        if (!volunteer) {
          return { type: 'unknown' as QrType, typeLabel: 'Inconnu', token, found: false, error: 'Token bénévole introuvable' };
        }
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
            location: volunteer.day?.location,
            iftarTime: volunteer.day?.iftarTime,
            alreadyValidated: volunteer.qrStatus === 'validated',
            scannedAt: volunteer.scannedAt,
          },
        };
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
        const { data: order } = await supabase
          .from('terroir_orders')
          .select('*, terroir_order_items(*, terroir_products(name))')
          .eq('qr_token', token)
          .single();
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
        // Try pastry order
        const { data: pastryOrder } = await supabase
          .from('pastry_orders')
          .select('*')
          .eq('qr_token', token)
          .single();
        if (pastryOrder) {
          return {
            type: 'pastry' as QrType,
            typeLabel: QR_TYPE_LABELS.pastry,
            token,
            found: true,
            entity: {
              id: pastryOrder.id,
              name: pastryOrder.customer_name,
              phone: pastryOrder.phone,
              email: pastryOrder.email,
              status: pastryOrder.order_status,
              reference: pastryOrder.reference,
              totalAmount: pastryOrder.total_amount,
              qrStatus: pastryOrder.qr_status || 'active',
              alreadyValidated: pastryOrder.qr_status === 'validated',
            },
          };
        }
        // Try terroir order
        const { data: terroirOrder } = await supabase
          .from('terroir_orders')
          .select('*')
          .eq('qr_token', token)
          .single();
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
              status: terroirOrder.status,
              reference: terroirOrder.order_reference,
              totalAmount: terroirOrder.total_amount,
              qrStatus: terroirOrder.qr_status,
              alreadyValidated: terroirOrder.qr_status === 'validated',
            },
          };
        }
        // Try qr_tokens table (goodies, etc.)
        const { data: qrTokenRow } = await supabase
          .from('qr_tokens')
          .select('*')
          .eq('token', token)
          .single();
        if (qrTokenRow) {
          return {
            type: (qrTokenRow.scope === 'pastry' ? 'pastry' : 'goodies') as QrType,
            typeLabel: qrTokenRow.scope === 'pastry' ? QR_TYPE_LABELS.pastry : QR_TYPE_LABELS.goodies,
            token,
            found: true,
            entity: {
              id: qrTokenRow.entity_id,
              name: `Commande #${qrTokenRow.entity_id}`,
              status: qrTokenRow.status,
              qrStatus: qrTokenRow.status,
              alreadyValidated: qrTokenRow.status === 'used',
              usesCount: qrTokenRow.uses_count,
              maxUses: qrTokenRow.max_uses,
            },
          };
        }
      }

      return { type: 'unknown' as QrType, typeLabel: 'Inconnu', token, found: false, error: 'QR code non reconnu dans le système' };
    }),

  /**
   * Validate/check-in a QR code based on its type
   */
  validate: scannerProcedure
    .input(z.object({
      token: z.string().min(1),
      type: z.enum(['volunteer', 'reservation_particulier', 'reservation_entreprise', 'reservation_groupe', 'pastry', 'terroir', 'goodies', 'unknown']),
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

      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Type de QR non supporté pour la validation' });
    }),
});
