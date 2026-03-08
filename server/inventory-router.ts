import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from './_core/trpc';
import * as inv from './inventory-services';

// ============================================================
// ROLE GUARD — admin + toutes les variantes admin
// ============================================================

const inventoryAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = [
    'admin', 'super_admin', 'admin_ops', 'admin_boutique',
    'admin_patisserie', 'admin_terroir',
  ];
  if (!ctx.user || !allowed.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès réservé aux administrateurs' });
  }
  return next({ ctx });
});

// ============================================================
// INPUT SCHEMAS
// ============================================================

const locationTypeEnum = z.enum(['GLOBAL', 'EVENT_BUFFER', 'POS']);
const eventStatusEnum  = z.enum(['draft', 'open', 'closed', 'archived']);
const movementTypeEnum = z.enum([
  'INITIAL_LOAD', 'PURCHASE_IN', 'DONATION_IN', 'PRODUCTION_IN',
  'TRANSFER_OUT', 'TRANSFER_IN', 'SALE', 'RETURN_IN', 'RETURN_OUT',
  'ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS',
]);
const stockEntryTypeEnum = z.enum(['INITIAL_LOAD', 'PURCHASE_IN', 'DONATION_IN', 'PRODUCTION_IN']);

// ============================================================
// ROUTER
// ============================================================

export const inventoryRouter = router({

  // ----------------------------------------------------------
  // PRODUCTS
  // ----------------------------------------------------------

  products: router({
    list: inventoryAdminProcedure
      .input(z.object({
        isActive:    z.boolean().optional(),
        productType: z.string().optional(),
        search:      z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return inv.listInventoryProducts(input);
      }),

    get: inventoryAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getInventoryProductById(input.id);
      }),

    create: inventoryAdminProcedure
      .input(z.object({
        productType:     z.string().min(1),
        sourceProductId: z.number().int().positive().nullable().optional(),
        sourceVariantId: z.number().int().positive().nullable().optional(),
        sku:             z.string().max(50).nullable().optional(),
        barcode:         z.string().max(100).nullable().optional(),
        name:            z.string().min(1).max(255),
        category:        z.string().max(100).nullable().optional(),
        unit:            z.string().max(30).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await inv.createInventoryProduct(input);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    update: inventoryAdminProcedure
      .input(z.object({
        id:       z.number().int().positive(),
        name:     z.string().min(1).max(255).optional(),
        sku:      z.string().max(50).nullable().optional(),
        barcode:  z.string().max(100).nullable().optional(),
        category: z.string().max(100).nullable().optional(),
        unit:     z.string().max(30).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input: { id, ...rest } }) => {
        try {
          return await inv.updateInventoryProduct(id, rest);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    sync: inventoryAdminProcedure
      .input(z.object({
        productType:     z.string().min(1),
        sourceProductId: z.number().int().positive(),
        sourceVariantId: z.number().int().positive().nullable().optional(),
        name:            z.string().min(1),
        sku:             z.string().nullable().optional(),
        barcode:         z.string().nullable().optional(),
        category:        z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await inv.syncInventoryProduct(input);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    syncAllCatalogs: inventoryAdminProcedure
      .mutation(async () => {
        try {
          return await inv.syncAllCatalogProducts();
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),

    balances: inventoryAdminProcedure
      .input(z.object({ productId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getStockBalancesByProduct(input.productId);
      }),
  }),

  // ----------------------------------------------------------
  // EVENTS
  // ----------------------------------------------------------

  events: router({
    list: inventoryAdminProcedure
      .input(z.object({ status: eventStatusEnum.optional() }).optional())
      .query(async ({ input }) => {
        return inv.listInventoryEvents(input);
      }),

    get: inventoryAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getInventoryEventById(input.id);
      }),

    create: inventoryAdminProcedure
      .input(z.object({
        name:        z.string().min(1).max(255),
        description: z.string().nullable().optional(),
        startsAt:    z.string().nullable().optional(),
        endsAt:      z.string().nullable().optional(),
        status:      eventStatusEnum.optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await inv.createInventoryEvent(input);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    update: inventoryAdminProcedure
      .input(z.object({
        id:          z.number().int().positive(),
        name:        z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        startsAt:    z.string().nullable().optional(),
        endsAt:      z.string().nullable().optional(),
        status:      eventStatusEnum.optional(),
      }))
      .mutation(async ({ input: { id, ...rest } }) => {
        try {
          return await inv.updateInventoryEvent(id, rest);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    report: inventoryAdminProcedure
      .input(z.object({ eventId: z.number().int().positive() }))
      .query(async ({ input }) => {
        try {
          return await inv.getEventReport(input.eventId);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
  }),

  // ----------------------------------------------------------
  // LOCATIONS
  // ----------------------------------------------------------

  locations: router({
    list: inventoryAdminProcedure
      .input(z.object({
        type:     locationTypeEnum.optional(),
        eventId:  z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return inv.listInventoryLocations(input);
      }),

    get: inventoryAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getInventoryLocationById(input.id);
      }),

    create: inventoryAdminProcedure
      .input(z.object({
        type:             locationTypeEnum,
        code:             z.string().min(1).max(100),
        name:             z.string().min(1).max(255),
        eventId:          z.number().int().positive().nullable().optional(),
        parentLocationId: z.number().int().positive().nullable().optional(),
        metadata:         z.record(z.unknown()).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await inv.createInventoryLocation(input);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    stockByLocation: inventoryAdminProcedure
      .input(z.object({ locationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getStockBalancesByLocation(input.locationId);
      }),

    globalLocation: inventoryAdminProcedure.query(async () => {
      try {
        return await inv.getGlobalLocation();
      } catch (e: any) {
        throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
      }
    }),
  }),

  // ----------------------------------------------------------
  // STOCK OPERATIONS
  // ----------------------------------------------------------

  stock: router({
    overview: inventoryAdminProcedure.query(async () => {
      try {
        return await inv.getStockOverview();
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),

    summary: inventoryAdminProcedure.query(async () => {
      try {
        return await inv.getStockSummary();
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),

    addStock: inventoryAdminProcedure
      .input(z.object({
        productId:     z.number().int().positive(),
        locationId:    z.number().int().positive(),
        quantity:      z.number().int().positive(),
        movementType:  z.enum(['INITIAL_LOAD', 'PURCHASE_IN', 'DONATION_IN', 'PRODUCTION_IN']),
        reason:        z.string().optional(),
        note:          z.string().optional(),
        referenceType: z.string().optional(),
        referenceId:   z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.addStock({ ...input, performedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    transfer: inventoryAdminProcedure
      .input(z.object({
        productId:      z.number().int().positive(),
        quantity:       z.number().int().positive(),
        fromLocationId: z.number().int().positive(),
        toLocationId:   z.number().int().positive(),
        eventId:        z.number().int().positive().nullable().optional(),
        reason:         z.string().optional(),
        note:           z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.transferStock({ ...input, performedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    recordSale: inventoryAdminProcedure
      .input(z.object({
        productId:     z.number().int().positive(),
        quantity:      z.number().int().positive(),
        locationId:    z.number().int().positive(),
        eventId:       z.number().int().positive().nullable().optional(),
        saleOrderId:   z.string().optional(),
        saleLineId:    z.string().optional(),
        referenceType: z.string().optional(),
        referenceId:   z.string().optional(),
        note:          z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.recordSale({ ...input, performedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    recordOnlineSale: inventoryAdminProcedure
      .input(z.object({
        productId:     z.number().int().positive(),
        quantity:      z.number().int().positive(),
        saleOrderId:   z.string().optional(),
        saleLineId:    z.string().optional(),
        referenceType: z.string().optional(),
        referenceId:   z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.recordOnlineSale({ ...input, performedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    recordReturn: inventoryAdminProcedure
      .input(z.object({
        productId:          z.number().int().positive(),
        quantity:           z.number().int().positive(),
        fromPosLocationId:  z.number().int().positive(),
        toBufferLocationId: z.number().int().positive(),
        eventId:            z.number().int().positive().nullable().optional(),
        reason:             z.string().optional(),
        note:               z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.recordReturn({ ...input, performedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    adjust: inventoryAdminProcedure
      .input(z.object({
        productId:  z.number().int().positive(),
        locationId: z.number().int().positive(),
        qtyDelta:   z.number().int().refine(v => v !== 0, 'Le delta ne peut pas être zéro'),
        reason:     z.string().min(1, 'Motif obligatoire'),
        note:       z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.adjustStock({ ...input, performedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),
  }),

  // ----------------------------------------------------------
  // MOVEMENTS
  // ----------------------------------------------------------

  movements: router({
    list: inventoryAdminProcedure
      .input(z.object({
        productId:    z.number().int().positive().optional(),
        locationId:   z.number().int().positive().optional(),
        eventId:      z.number().int().positive().optional(),
        movementType: movementTypeEnum.optional(),
        dateFrom:     z.string().optional(),
        dateTo:       z.string().optional(),
        limit:        z.number().int().min(1).max(500).optional(),
        offset:       z.number().int().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        try {
          return await inv.getMovementHistory(input);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
  }),



  // ----------------------------------------------------------
  // QR STOCK ENTRY (flux logistique séparé du QR de vente)
  // ----------------------------------------------------------

  stockEntry: router({
    listProducts: inventoryAdminProcedure
      .input(z.object({
        search: z.string().optional(),
        isActive: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return inv.listStockEntryProducts(input);
      }),

    getProductDetail: inventoryAdminProcedure
      .input(z.object({ productId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getStockEntryProductDetail(input.productId);
      }),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string().min(6).max(140) }))
      .query(async ({ input }) => {
        try {
          return await inv.getStockEntryBySlug(input.slug);
        } catch (e: any) {
          throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
        }
      }),

    ensureQr: inventoryAdminProcedure
      .input(z.object({ productId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          const slug = await inv.ensureStockEntryQrSlug(input.productId);
          return { slug };
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    regenerateQr: inventoryAdminProcedure
      .input(z.object({ productId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          const slug = await inv.regenerateStockEntryQrSlug(input.productId);
          return { slug };
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    setQrEnabled: inventoryAdminProcedure
      .input(z.object({ productId: z.number().int().positive(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        try {
          return await inv.setStockEntryQrEnabled(input.productId, input.enabled);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    submit: inventoryAdminProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().positive(),
        entryType: stockEntryTypeEnum.optional(),
        note: z.string().max(500).optional(),
        reason: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.recordStockEntry({
            productId: input.productId,
            qty: input.qty,
            entryType: input.entryType,
            note: input.note,
            reason: input.reason,
            userId: ctx.user?.id,
            source: 'QR_STOCK_ENTRY',
          });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    history: inventoryAdminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(300).optional() }).optional())
      .query(async ({ input }) => {
        return inv.getQrStockEntryHistory(input?.limit ?? 100);
      }),
  }),

  // ----------------------------------------------------------
  // INVENTORY COUNTS
  // ----------------------------------------------------------

  counts: router({
    create: inventoryAdminProcedure
      .input(z.object({
        locationId: z.number().int().positive(),
        eventId:    z.number().int().positive().nullable().optional(),
        notes:      z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.createInventoryCount({ ...input, countedBy: ctx.user?.id });
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    get: inventoryAdminProcedure
      .input(z.object({ countId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return inv.getInventoryCountWithLines(input.countId);
      }),

    updateLine: inventoryAdminProcedure
      .input(z.object({
        countLineId: z.number().int().positive(),
        countedQty:  z.number().int().min(0),
        note:        z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await inv.updateCountLine(input.countLineId, input.countedQty, input.note);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),

    complete: inventoryAdminProcedure
      .input(z.object({ countId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await inv.completeInventoryCount(input.countId, ctx.user?.id);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),
  }),
});

export type InventoryRouter = typeof inventoryRouter;
