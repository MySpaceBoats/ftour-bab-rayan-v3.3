import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sendEmail } from "./email";
import * as supabaseServices from "./supabase-services";
import { getSupabaseAdminClient } from "./supabase";

// ============================================
// ROLE-BASED PROCEDURES
// ============================================

const adminBoutiqueProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_boutique'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès boutique requis' });
  }
  return next({ ctx });
});

const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_operations', 'scanner'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès scanner requis' });
  }
  return next({ ctx });
});

// ============================================
// PASTRIES ROUTER (Pâtisserie Solidaire)
// ============================================

function isPastriesTableMissing(error: any): boolean {
  return error?.code === 'PGRST204' || error?.code === '42P01' ||
    error?.message?.includes('schema cache') || error?.message?.includes('does not exist');
}

const PASTRIES_TABLE_MISSING_MSG = 'La table "pastries" n\'existe pas encore dans la base de données. Veuillez exécuter la migration SQL : supabase/migrations/add_pastry_and_qr_tables.sql dans l\'éditeur SQL de Supabase.';

export const pastriesRouter = router({
  list: publicProcedure.query(async () => {
    try {
      return await supabaseServices.getPastriesSupabase();
    } catch (error) {
      console.error('Error fetching pastries:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la récupération des pâtisseries' });
    }
  }),

  create: adminBoutiqueProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      imageUrl: z.string().optional(),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = getSupabaseAdminClient();
        if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });

        const { data, error } = await client
          .from('pastries')
          .insert({
            name: input.name,
            description: input.description,
            price: input.price,
            image_url: input.imageUrl,
            sort_order: input.sortOrder,
            active: true,
          })
          .select()
          .single();

        if (error) {
          if (isPastriesTableMissing(error)) {
            console.error('[Pastries] Table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql');
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: PASTRIES_TABLE_MISSING_MSG });
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        return data;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error('Error creating pastry:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la création de la pâtisserie' });
      }
    }),

  update: adminBoutiqueProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      imageUrl: z.string().optional(),
      active: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = getSupabaseAdminClient();
        if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });

        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.description) updateData.description = input.description;
        if (input.price) updateData.price = input.price;
        if (input.imageUrl) updateData.image_url = input.imageUrl;
        if (input.active !== undefined) updateData.active = input.active;
        if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;

        const { data, error } = await client
          .from('pastries')
          .update(updateData)
          .eq('id', input.id)
          .select()
          .single();

        if (error) {
          if (isPastriesTableMissing(error)) {
            console.error('[Pastries] Table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql');
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: PASTRIES_TABLE_MISSING_MSG });
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        return data;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error('Error updating pastry:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la mise à jour de la pâtisserie' });
      }
    }),

  delete: adminBoutiqueProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const client = getSupabaseAdminClient();
        if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });

        const { error } = await client
          .from('pastries')
          .update({ active: false })
          .eq('id', input.id);

        if (error) {
          if (isPastriesTableMissing(error)) {
            console.error('[Pastries] Table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql');
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: PASTRIES_TABLE_MISSING_MSG });
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        return { success: true };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error('Error deleting pastry:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la suppression de la pâtisserie' });
      }
    }),
});

// ============================================
// PASTRY ORDERS ROUTER
// ============================================

export const pastryOrdersRouter = router({
  create: publicProcedure
    .input(z.object({
      customerName: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      items: z.array(z.object({
        pastryId: z.number(),
        quantity: z.number().positive(),
        price: z.number().positive(),
      })),
      totalAmount: z.number().positive(),
      paymentMethod: z.enum(['bank_transfer', 'cheque', 'cash', 'cmi']),
      channel: z.enum(['online', 'on_site_qr', 'on_site_admin']).default('online'),
    }))
    .mutation(async ({ input }) => {
      try {
        // Générer référence unique
        const reference = `PASTRY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Créer la commande
        const order = await supabaseServices.createPastryOrderSupabase({
          reference,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          items: input.items,
          totalAmount: input.totalAmount,
          paymentMethod: input.paymentMethod,
        });

        // Générer QR token si nécessaire
        if (input.channel === 'online' || input.channel === 'on_site_qr') {
          const qrData = await supabaseServices.generateQRTokenSupabase('pastry', order.id);
          if (qrData) {
            order.qr_token = qrData.token;
            // Save qr_token back to pastry_orders table
            const supabase = getSupabaseAdminClient();
            if (supabase) {
              await supabase.from('pastry_orders').update({ qr_token: qrData.token }).eq('id', order.id);
            }
          }
        }

        // Envoyer email de confirmation avec QR code
        if (input.email) {
          try {
            const baseUrl = process.env.VITE_APP_URL || 'https://ftourbabrayan.ma';
            const qrCodeUrl = order.qr_token
              ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${baseUrl}/qr/pastry/${reference}`)}`
              : '';

            const itemsHtml = input.items.map(item =>
              `<tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Pâtisserie #${item.pastryId}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price} MAD</td>
              </tr>`
            ).join('');

            const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 0;">
      <table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Ftour <span style="color:#fbbf24;">Bab Rayan</span></h1>
          <p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:14px;">Pâtisserie Solidaire</p>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <h2 style="color:#166534;margin:0 0 20px 0;font-size:24px;">Commande confirmée !</h2>
          <p style="color:#374151;font-size:16px;line-height:1.6;">Merci pour votre commande de pâtisseries solidaires !</p>
          <div style="background-color:#f0fdf4;padding:15px;border-radius:8px;text-align:center;margin:20px 0;">
            <p style="margin:0;color:#6b7280;font-size:14px;">Référence de commande</p>
            <p style="margin:5px 0 0 0;color:#166534;font-size:24px;font-weight:bold;font-family:monospace;">${reference}</p>
          </div>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead><tr style="background-color:#f3f4f6;">
              <th style="padding:10px;text-align:left;color:#374151;">Article</th>
              <th style="padding:10px;text-align:center;color:#374151;">Qté</th>
              <th style="padding:10px;text-align:right;color:#374151;">Prix</th>
            </tr></thead>
            <tbody>
              ${itemsHtml}
              <tr style="background-color:#f0fdf4;">
                <td colspan="2" style="padding:15px;font-weight:bold;color:#166534;">Total</td>
                <td style="padding:15px;text-align:right;font-weight:bold;color:#166534;font-size:18px;">${input.totalAmount} MAD</td>
              </tr>
            </tbody>
          </table>
          ${qrCodeUrl ? `
          <div style="text-align:center;margin:30px 0;padding:20px;background-color:#ffffff;border:2px dashed #166534;border-radius:8px;">
            <h3 style="color:#166534;margin:0 0 15px 0;font-size:18px;">Votre QR Code</h3>
            <img src="${qrCodeUrl}" alt="QR Code" style="width:200px;height:200px;margin:10px 0;" />
            <p style="color:#6b7280;font-size:14px;margin:10px 0 0 0;">Présentez ce QR code lors du retrait de votre commande</p>
          </div>` : ''}
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:20px 0 0 0;">Merci pour votre soutien !<br><strong>L'équipe Ftour Bab Rayan</strong></p>
        </td></tr>
        <tr><td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;">Association Bab Rayan</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">4 rue Bayt Lahm, quartier Palmier, Casablanca<br>Tél: +212 610 023 555 | contact@ftourbabrayan.ma</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

            await sendEmail({
              to: input.email,
              subject: `✅ Confirmation commande pâtisserie #${reference}`,
              html,
            });
          } catch (e) {
            console.error('Email send error:', e);
          }
        }

        return order;
      } catch (error) {
        console.error('Error creating pastry order:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la création de la commande' });
      }
    }),

  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      try {
        return await supabaseServices.getPastryOrderByReferenceSupabase(input.reference);
      } catch (error) {
        console.error('Error fetching pastry order:', error);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Commande non trouvée' });
      }
    }),

  list: adminBoutiqueProcedure
    .input(z.object({
      status: z.string().optional(),
      paymentStatus: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await supabaseServices.getPastryOrdersSupabase({
          status: input.status,
          paymentStatus: input.paymentStatus,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        });
      } catch (error) {
        console.error('Error listing pastry orders:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la récupération des commandes' });
      }
    }),

  updateStatus: scannerProcedure
    .input(z.object({
      orderId: z.number(),
      orderStatus: z.enum(['reserved', 'paid', 'handed', 'cancelled']),
      paymentStatus: z.enum(['pending', 'confirmed', 'paid', 'cancelled']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await supabaseServices.updatePastryOrderStatusSupabase(
          input.orderId,
          input.orderStatus,
          input.paymentStatus,
          ctx.user?.id
        );
      } catch (error) {
        console.error('Error updating pastry order status:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la mise à jour du statut' });
      }
    }),

  stats: adminBoutiqueProcedure.query(async () => {
    try {
      return await supabaseServices.getPastryOrderStatsSupabase();
    } catch (error) {
      console.error('Error fetching pastry stats:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la récupération des statistiques' });
    }
  }),
});

// ============================================
// QR CODES ROUTER
// ============================================

export const qrRouter = router({
  generate: adminBoutiqueProcedure
    .input(z.object({
      scope: z.string(),
      entityId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await supabaseServices.generateQRTokenSupabase(input.scope, input.entityId);
      } catch (error) {
        console.error('Error generating QR token:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de la génération du QR code' });
      }
    }),

  validate: publicProcedure
    .input(z.object({
      token: z.string(),
      scope: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        return await supabaseServices.validateQRTokenSupabase(input.token, input.scope);
      } catch (error) {
        console.error('Error validating QR token:', error);
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'QR code invalide ou expiré' });
      }
    }),

  scan: scannerProcedure
    .input(z.object({
      token: z.string(),
      scope: z.string(),
      entityId: z.number(),
      validationAction: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await supabaseServices.logQRScanSupabase(
          input.token,
          input.scope,
          input.entityId,
          input.validationAction,
          ctx.user?.id || 0,
          true
        );
        return { success: true };
      } catch (error) {
        console.error('Error logging QR scan:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors du scan QR' });
      }
    }),
});
