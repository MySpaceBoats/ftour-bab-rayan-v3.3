import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as supabaseServices from "./supabase-services";
import * as reservationServices from "./reservation-services";
import { getSupabaseAdminClient } from "./supabase";

const adminReservationsProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès réservations requis' });
  }
  return next({ ctx });
});

const adminCommerceProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_boutique', 'admin_patisserie', 'admin_terroir'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès commerce requis' });
  }
  return next({ ctx });
});

const adminDonsProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_dons'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès dons requis' });
  }
  return next({ ctx });
});

const adminOpsProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès opérations requis' });
  }
  return next({ ctx });
});

export const backofficeReservationsRouter = router({
  list: adminReservationsProcedure
    .input(z.object({ type: z.enum(['particulier', 'entreprise', 'groupe']).optional() }).optional())
    .query(async ({ input }) => {
      const allReservations = await reservationServices.getAllReservationsSupabase();
      return (allReservations || [])
        .filter((r: any) => !input?.type || r.type === input.type)
        .map((r: any) => ({
          id: String(r.id),
          type: r.type,
          date: r.date,
          places: r.seats,
          contact_name: r.userName,
          contact_email: r.userEmail,
          contact_phone: r.userPhone,
          status: r.status === 'pending' ? 'pending_validation' : r.status,
          payment_status: r.paymentStatus,
          note: r.notes || '',
          created_at: r.createdAt,
        }));
    }),

  confirm: adminReservationsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await reservationServices.updateReservationStatusSupabase(Number(input.id), 'confirmed', ctx.user?.name || ctx.user?.email);
      return { success: true };
    }),

  reject: adminReservationsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await reservationServices.updateReservationStatusSupabase(Number(input.id), 'cancelled', ctx.user?.name || ctx.user?.email);
      return { success: true };
    }),

  markPaid: adminReservationsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { error } = await client.from('reservations').update({ payment_status: 'paid' }).eq('id', Number(input.id));
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  delete: adminReservationsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { error } = await client.from('reservations').delete().eq('id', Number(input.id));
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});

export const backofficeCommerceRouter = router({
  listProducts: adminCommerceProcedure
    .input(z.object({ type: z.enum(['goodies', 'terroir', 'patisserie']).optional() }).optional())
    .query(async ({ input }) => {
      const goodies = await supabaseServices.getAllGoodiesSupabase();

      const products = [
        ...goodies.map((p: any) => ({
          id: `goodies-${p.id}`,
          sourceId: p.id,
          type: p.category || 'goodies',
          name: p.name,
          price: p.price,
          stock: (p.variants || []).reduce((acc: number, v: any) => acc + (v.stock || 0), 0),
          status: p.isActive ? 'active' : 'inactive',
          created_at: p.createdAt,
        })),
      ].filter((p) => !input?.type || p.type === input.type);

      return products;
    }),

  listOrders: adminCommerceProcedure
    .input(z.object({ type: z.enum(['goodies', 'terroir', 'patisserie']).optional() }).optional())
    .query(async ({ input }) => {
      const goodieOrders = await supabaseServices.getAllOrdersSupabase();
      const pastryOrders = await supabaseServices.getPastryOrdersSupabase();

      const orders = [
        ...goodieOrders.map((o: any) => ({
          id: `goodies-${o.id}`,
          sourceId: o.id,
          type: 'goodies',
          product_name: o.items?.map((i: any) => i.goodieName).filter(Boolean).join(', ') || 'Commande goodies',
          quantity: o.items?.reduce((acc: number, i: any) => acc + i.quantity, 0) || 0,
          total: o.totalAmount,
          status: o.status,
          customer_email: o.customerEmail,
          created_at: o.createdAt,
        })),
        ...pastryOrders.map((o: any) => ({
          id: `patisserie-${o.id}`,
          sourceId: o.id,
          type: 'patisserie',
          product_name: 'Commande pâtisserie',
          quantity: o.items?.reduce((acc: number, i: any) => acc + i.quantity, 0) || 0,
          total: Number(o.totalAmount || 0),
          status: o.status,
          customer_email: o.email || '',
          created_at: o.createdAt,
        })),
      ].filter((o) => !input?.type || o.type === input.type);

      return orders;
    }),

  updateStock: adminCommerceProcedure
    .input(z.object({ id: z.string(), stock: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const [type, id] = input.id.split('-');
      if (type !== 'goodies' && type !== 'terroir') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Type de produit non supporté' });

      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { error } = await client.from('goodie_variants').update({ stock: input.stock }).eq('goodie_id', Number(id));
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  toggleProduct: adminCommerceProcedure
    .input(z.object({ id: z.string(), status: z.enum(['active', 'inactive']) }))
    .mutation(async ({ input }) => {
      const [type, id] = input.id.split('-');
      if (type !== 'goodies' && type !== 'terroir') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Type de produit non supporté' });
      await supabaseServices.updateGoodieSupabase(Number(id), { isActive: input.status === 'active' });
      return { success: true };
    }),

  deleteProduct: adminCommerceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [type, id] = input.id.split('-');
      if (type !== 'goodies' && type !== 'terroir') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Type de produit non supporté' });
      await supabaseServices.deleteGoodieSupabase(Number(id));
      return { success: true };
    }),

  updateOrderStatus: adminCommerceProcedure
    .input(z.object({ id: z.string(), status: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [type, id] = input.id.split('-');
      if (type === 'patisserie') {
        await supabaseServices.updatePastryOrderStatusSupabase(Number(id), input.status as any, undefined, ctx.user?.id);
      } else {
        await supabaseServices.updateGoodieOrderStatusSupabase(Number(id), input.status, ctx.user?.id);
      }
      return { success: true };
    }),
});

export const backofficeDonsRouter = router({
  list: adminDonsProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const allDonations = await supabaseServices.getAllDonationsSupabase();
      return (allDonations || [])
        .filter((d: any) => !input?.status || d.status === input.status)
        .map((d: any) => ({
          id: String(d.id),
          amount: d.amount,
          donor_name: d.donorName,
          donor_email: d.donorEmail,
          donor_phone: d.donorPhone,
          status: d.status,
          source: d.paymentMethod,
          note: d.message,
          receipt_generated: d.status === 'received',
          created_at: d.createdAt,
        }));
    }),

  confirm: adminDonsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.markDonationReceivedSupabase(Number(input.id), ctx.user?.id);
      return { success: true };
    }),

  generateReceipt: adminDonsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { error } = await client.from('donations').update({ receipt_generated_at: new Date().toISOString() }).eq('id', Number(input.id));
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  delete: adminDonsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Suppression réservée au super admin' });
      }
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { error } = await client.from('donations').delete().eq('id', Number(input.id));
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  export: adminDonsProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      const allDonations = await supabaseServices.getAllDonationsSupabase();
      const header = 'id,reference,donor_name,donor_email,amount,status,created_at';
      const rows = (allDonations || []).map((d: any) => [d.id, d.donationReference, d.donorName, d.donorEmail, d.amount, d.status, d.createdAt].join(','));
      return { csv: [header, ...rows].join('\n') };
    }),
});

export const backofficeBenevolesRouter = router({
  list: adminOpsProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const result = await supabaseServices.getVolunteersByDaySupabase();
      return (result.volunteers || [])
        .filter((v: any) => !input?.status || v.status === input.status)
        .map((v: any) => ({
          id: String(v.id),
          name: `${v.firstName} ${v.lastName}`,
          email: v.email,
          phone: v.phone,
          shift_date: v.day?.date,
          shift_time: '15:00-22:00',
          status: v.status,
          qr_generated: !!v.qrToken,
          present: v.status === 'present' || v.qrStatus === 'validated',
          created_at: v.createdAt,
        }));
    }),

  confirm: adminOpsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await supabaseServices.updateVolunteerStatusSupabase(Number(input.id), 'confirmed');
      return { success: true };
    }),

  generateQR: adminOpsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const token = `vol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await client.from('volunteers').update({ qr_token: token, qr_status: 'pending' }).eq('id', Number(input.id));
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, token };
    }),

  markPresent: adminOpsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.manualValidateSupabase(Number(input.id), ctx.user?.id || 0);
      return { success: true };
    }),

  cancel: adminOpsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await supabaseServices.updateVolunteerStatusSupabase(Number(input.id), 'cancelled');
      return { success: true };
    }),
});
