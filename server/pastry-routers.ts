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

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data;
      } catch (error) {
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

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data;
      } catch (error) {
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

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return { success: true };
      } catch (error) {
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
          }
        }

        // Envoyer email de confirmation
        if (input.email) {
          try {
            const itemsList = input.items.map(item => `- Pâtisserie ${item.pastryId}: ${item.quantity}x ${item.price}€`).join('\n');
            const emailContent = `Commande Pâtisserie #${reference}\n\nMerci pour votre commande!\n\nDétails:\n${itemsList}\n\nMontant total: ${input.totalAmount}€\nMéthode de paiement: ${input.paymentMethod}`;
            
            await sendEmail({
              to: input.email,
              subject: `Confirmation de commande pâtisserie #${reference}`,
              html: `<p>${emailContent.replace(/\n/g, '<br>')}</p>`,
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
