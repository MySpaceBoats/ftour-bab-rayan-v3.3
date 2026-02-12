import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as supabaseServices from "./supabase-services";
import * as reservationServices from "./reservation-services";

// ============================================
// ROLE-BASED PROCEDURES FOR BACK OFFICE
// ============================================

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

// ============================================
// BACKOFFICE RESERVATIONS ROUTER
// ============================================

export const backofficeReservationsRouter = router({
  list: adminReservationsProcedure
    .input(z.object({
      type: z.enum(['particulier', 'entreprise', 'groupe']).optional(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show']).optional(),
      payment_status: z.enum(['unpaid', 'paid', 'refunded']).optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      // Fetch reservations with filters
      const allReservations = await reservationServices.getAllReservationsSupabase() || [];
      
      let filtered = allReservations;
      
      // Apply filters
      if (input.type) {
        filtered = filtered.filter((r: any) => r.type === input.type);
      }
      if (input.status) {
        filtered = filtered.filter((r: any) => r.status === input.status);
      }
      if (input.payment_status) {
        filtered = filtered.filter((r: any) => r.payment_status === input.payment_status);
      }
      if (input.date_from) {
        filtered = filtered.filter((r: any) => new Date(r.date) >= new Date(input.date_from!));
      }
      if (input.date_to) {
        filtered = filtered.filter((r: any) => new Date(r.date) <= new Date(input.date_to!));
      }
      
      // Pagination
      const start = (input.page - 1) * input.limit;
      const paginated = filtered.slice(start, start + input.limit);
      
      return {
        data: paginated,
        total: filtered.length,
        page: input.page,
        limit: input.limit,
      };
    }),

  getById: adminReservationsProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const reservation = await reservationServices.getReservationByReferenceSupabase('');
      if (!reservation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      }
      return reservation;
    }),

  updateStatus: adminReservationsProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['confirmed', 'cancelled', 'no_show']),
    }))
    .mutation(async ({ input, ctx }) => {
      await reservationServices.updateReservationStatusSupabase(
        input.id,
        input.status as any,
        ctx.user?.name || ctx.user?.email || 'Admin'
      );
      return { success: true };
    }),

  markAsPaid: adminReservationsProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement mark reservation as paid
      return { success: true };
    }),

  delete: adminReservationsProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement delete reservation
      return { success: true };
    }),

  getStats: adminReservationsProcedure
    .input(z.object({
      type: z.enum(['particulier', 'entreprise', 'groupe']).optional(),
    }))
    .query(async ({ input }) => {
      const stats = await reservationServices.getReservationStatsSupabase();
      
      return {
        total: stats.total || 0,
        pending: stats.pending || 0,
        confirmed: stats.confirmed || 0,
        paid: stats.checkedIn || 0,
      };
    }),
});

// ============================================
// BACKOFFICE COMMERCE ROUTER
// ============================================

export const backofficeCommerceRouter = router({
  products: router({
    list: adminCommerceProcedure
      .input(z.object({
        type: z.string().optional(),
        status: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      }))
      .query(async ({ input }) => {
        const allProducts = await supabaseServices.getAllGoodiesSupabase();
        
        let filtered = allProducts;
        if (input.type) {
          filtered = filtered.filter((p: any) => p.type === input.type);
        }
        if (input.status) {
          filtered = filtered.filter((p: any) => p.status === input.status);
        }
        
        const start = (input.page - 1) * input.limit;
        const paginated = filtered.slice(start, start + input.limit);
        
        return {
          data: paginated,
          total: filtered.length,
          page: input.page,
          limit: input.limit,
        };
      }),

    getById: adminCommerceProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const products = await supabaseServices.getAllGoodiesSupabase();
        const product = products.find((p: any) => p.id === input.id);
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Produit non trouvé' });
        }
        return product;
      }),

    update: adminCommerceProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        price: z.number().optional(),
        stock: z.number().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        // TODO: Implement update goodie
        return { success: true };
      }),

    delete: adminCommerceProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // TODO: Implement delete goodie
        return { success: true };
      }),

    getStats: adminCommerceProcedure.query(async () => {
      const allProducts = await supabaseServices.getAllGoodiesSupabase() || [];
      return {
        total: allProducts.length,
        active: allProducts.filter((p: any) => p.active === true).length,
        outOfStock: allProducts.filter((p: any) => p.stock === 0).length,
        totalStock: allProducts.reduce((sum: number, p: any) => sum + (p.stock || 0), 0),
      };
    }),
  }),

  orders: router({
    list: adminCommerceProcedure
      .input(z.object({
        status: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      }))
      .query(async ({ input }) => {
        // TODO: Implement getAllOrdersSupabase
        const allOrders: any[] = [];
        
        let filtered = allOrders;
        if (input.status) {
          filtered = filtered.filter((o: any) => o.status === input.status);
        }
        
        const start = (input.page - 1) * input.limit;
        const paginated = filtered.slice(start, start + input.limit);
        
        return {
          data: paginated,
          total: filtered.length,
          page: input.page,
          limit: input.limit,
        };
      }),

    updateStatus: adminCommerceProcedure
      .input(z.object({
        id: z.number(),
        status: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await supabaseServices.updateGoodieOrderStatusSupabase(input.id, input.status, ctx.user?.id);
        return { success: true };
      }),

    getStats: adminCommerceProcedure.query(async () => {
      const stats = await supabaseServices.getOrderStatsSupabase();
      return {
        total: stats.total || 0,
        pending: stats.reserved || 0,
        totalAmount: stats.totalAmount || 0,
        delivered: stats.delivered || 0,
      };
    }),
  }),
});

// ============================================
// BACKOFFICE DONS ROUTER
// ============================================

export const backofficeDonsRouter = router({
  list: adminDonsProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const allDonations = await supabaseServices.getAllDonationsSupabase();
      
      let filtered = allDonations || [];
      if (input.status) {
        filtered = filtered.filter((d: any) => d.payment_status === input.status);
      }
      
      const start = (input.page - 1) * input.limit;
      const paginated = filtered.slice(start, start + input.limit);
      
      return {
        data: paginated,
        total: filtered.length,
        page: input.page,
        limit: input.limit,
      };
    }),

  updateStatus: adminDonsProcedure
    .input(z.object({
      id: z.number(),
      status: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement update donation status
      return { success: true };
    }),

  generateReceipt: adminDonsProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement generate donation receipt
      return { success: true };
    }),

  delete: adminDonsProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement delete donation
      return { success: true };
    }),

  getStats: adminDonsProcedure.query(async () => {
    const stats = await supabaseServices.getDonationStatsSupabase();
    return {
      total: stats.total || 0,
      totalAmount: stats.totalAmount || 0,
      paidAmount: stats.receivedAmount || 0,
      receiptsGenerated: 0,
    };
  }),
});

// ============================================
// BACKOFFICE BENEVOLES ROUTER
// ============================================

export const backofficeBenevolesRouter = router({
  list: adminOpsProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const result = await supabaseServices.getVolunteersByDaySupabase();
      const allVolunteers = result.volunteers || [];
      
      let filtered = allVolunteers;
      if (input.status) {
        filtered = filtered.filter((v: any) => v.status === input.status);
      }
      
      const start = (input.page - 1) * input.limit;
      const paginated = filtered.slice(start, start + input.limit);
      
      return {
        data: paginated,
        total: filtered.length,
        page: input.page,
        limit: input.limit,
      };
    }),

  shifts: router({
    list: adminOpsProcedure
      .input(z.object({
        confirmed: z.boolean().optional(),
        present: z.boolean().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      }))
      .query(async ({ input }) => {
        const result = await supabaseServices.getVolunteersByDaySupabase();
        const allShifts = result.volunteers || [];
        
        let filtered = allShifts;
        if (input.confirmed !== undefined) {
          filtered = filtered.filter((s: any) => s.status === (input.confirmed ? 'confirmed' : 'pending'));
        }
        if (input.present !== undefined) {
          filtered = filtered.filter((s: any) => s.scannedAt !== null === input.present);
        }
        
        const start = (input.page - 1) * input.limit;
        const paginated = filtered.slice(start, start + input.limit);
        
        return {
          data: paginated,
          total: filtered.length,
          page: input.page,
          limit: input.limit,
        };
      }),

    confirmShift: adminOpsProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // TODO: Implement confirm volunteer shift
        return { success: true };
      }),

    generateQR: adminOpsProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // TODO: Implement generate volunteer QR
        return { success: true };
      }),

    markPresent: adminOpsProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // TODO: Implement mark volunteer present
        return { success: true };
      }),

    getStats: adminOpsProcedure.query(async () => {
      const stats = await supabaseServices.getVolunteerStatsSupabase();
      return {
        total: stats.total || 0,
        confirmed: stats.total || 0,
        qrGenerated: 0,
        present: stats.present || 0,
      };
    }),
  }),
});
