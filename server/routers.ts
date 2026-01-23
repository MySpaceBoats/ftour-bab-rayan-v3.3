import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

// ============================================
// ROLE-BASED PROCEDURES
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès administrateur requis' });
  }
  return next({ ctx });
});

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès super administrateur requis' });
  }
  return next({ ctx });
});

const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'scanner'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès scanner requis' });
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

const adminBoutiqueProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_boutique'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès boutique requis' });
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

// ============================================
// RAMADAN DAYS ROUTER
// ============================================

const daysRouter = router({
  list: publicProcedure.query(async () => {
    return db.getRamadanDays();
  }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getRamadanDayById(input.id);
    }),
  
  create: superAdminProcedure
    .input(z.object({
      date: z.string(),
      dayNumber: z.number().min(1).max(30),
      maxCapacity: z.number().min(1).default(50),
      location: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createRamadanDay({
        ...input,
        date: new Date(input.date),
      });
      return { id };
    }),
  
  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      maxCapacity: z.number().min(1).optional(),
      isClosed: z.boolean().optional(),
      location: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateRamadanDay(id, data);
      return { success: true };
    }),
  
  bulkCreate: superAdminProcedure
    .input(z.object({
      startDate: z.string(),
      daysCount: z.number().min(1).max(30).default(30),
      maxCapacity: z.number().min(1).default(50),
      location: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const createdIds: number[] = [];
      
      for (let i = 0; i < input.daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        const id = await db.createRamadanDay({
          date,
          dayNumber: i + 1,
          maxCapacity: input.maxCapacity,
          location: input.location,
          startTime: input.startTime,
          endTime: input.endTime,
          instructions: input.instructions,
        });
        createdIds.push(id);
      }
      
      return { createdIds, count: createdIds.length };
    }),
});

// ============================================
// VOLUNTEERS ROUTER
// ============================================

const volunteersRouter = router({
  register: publicProcedure
    .input(z.object({
      firstName: z.string().min(2),
      lastName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(8),
      city: z.string().optional(),
      dayId: z.number(),
      acceptedTerms: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      if (!input.acceptedTerms) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous devez accepter les conditions' });
      }
      
      // Check day availability
      const day = await db.getRamadanDayById(input.dayId);
      if (!day) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Jour non trouvé' });
      }
      if (day.isClosed || day.currentCount >= day.maxCapacity) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce jour est complet' });
      }
      
      // Generate unique QR code
      const qrCode = db.generateQrCode();
      
      // Create volunteer
      const id = await db.createVolunteer({
        ...input,
        qrCode,
        status: 'registered',
      });
      
      // Increment day count
      await db.incrementDayCount(input.dayId);
      
      // Check if day is now full
      if (day.currentCount + 1 >= day.maxCapacity) {
        await db.updateRamadanDay(input.dayId, { isClosed: true });
      }
      
      return { id, qrCode };
    }),
  
  getByQrCode: scannerProcedure
    .input(z.object({ qrCode: z.string() }))
    .query(async ({ input }) => {
      const volunteer = await db.getVolunteerByQrCode(input.qrCode);
      if (!volunteer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bénévole non trouvé' });
      }
      
      const day = await db.getRamadanDayById(volunteer.dayId);
      
      return { volunteer, day };
    }),
  
  checkIn: scannerProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const volunteer = await db.getVolunteerByQrCode(input.qrCode);
      if (!volunteer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bénévole non trouvé' });
      }
      
      // Check if already scanned
      if (volunteer.status === 'present') {
        await db.createScanHistory({
          volunteerId: volunteer.id,
          scannedBy: ctx.user!.id,
          action: 'duplicate_attempt',
          success: false,
          errorMessage: 'Déjà enregistré',
        });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce bénévole est déjà enregistré comme présent' });
      }
      
      // Check if correct day
      const day = await db.getRamadanDayById(volunteer.dayId);
      if (!day) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Jour non trouvé' });
      }
      
      const today = new Date();
      const dayDate = new Date(day.date);
      if (today.toDateString() !== dayDate.toDateString()) {
        await db.createScanHistory({
          volunteerId: volunteer.id,
          scannedBy: ctx.user!.id,
          action: 'wrong_day',
          success: false,
          errorMessage: `QR code valide pour le ${dayDate.toLocaleDateString('fr-FR')}`,
        });
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Ce QR code est valide pour le ${dayDate.toLocaleDateString('fr-FR')}, pas aujourd'hui` 
        });
      }
      
      // Mark as present
      await db.markVolunteerPresent(volunteer.id, ctx.user!.id);
      
      // Log scan
      await db.createScanHistory({
        volunteerId: volunteer.id,
        scannedBy: ctx.user!.id,
        action: 'check_in',
        success: true,
      });
      
      return { success: true, volunteer: { ...volunteer, status: 'present' } };
    }),
  
  listByDay: adminOpsProcedure
    .input(z.object({ dayId: z.number().optional() }))
    .query(async ({ input }) => {
      if (input.dayId) {
        const volunteers = await db.getVolunteersByDay(input.dayId);
        const day = await db.getRamadanDayById(input.dayId);
        return volunteers.map(v => ({ ...v, day }));
      }
      const volunteers = await db.getAllVolunteers();
      const days = await db.getRamadanDays();
      return volunteers.map(v => ({
        ...v,
        day: days.find(d => d.id === v.dayId),
      }));
    }),
  
  listAll: adminOpsProcedure.query(async () => {
    return db.getAllVolunteers();
  }),
  
  getStats: adminOpsProcedure.query(async () => {
    return db.getVolunteerStats();
  }),
  
  updateStatus: adminOpsProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['registered', 'confirmed', 'present', 'absent', 'cancelled']),
    }))
    .mutation(async ({ input }) => {
      await db.updateVolunteer(input.id, { status: input.status });
      return { success: true };
    }),
  
  cancel: publicProcedure
    .input(z.object({ qrCode: z.string(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      const volunteer = await db.getVolunteerByQrCode(input.qrCode);
      if (!volunteer || volunteer.email !== input.email) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inscription non trouvée' });
      }
      
      if (volunteer.status === 'cancelled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Inscription déjà annulée' });
      }
      
      await db.updateVolunteer(volunteer.id, { status: 'cancelled' });
      await db.decrementDayCount(volunteer.dayId);
      
      return { success: true };
    }),
});

// ============================================
// GOODIES ROUTER
// ============================================

const goodiesRouter = router({
  list: publicProcedure.query(async () => {
    const items = await db.getActiveGoodies();
    const result = await Promise.all(items.map(async (item) => {
      const variants = await db.getVariantsByGoodie(item.id);
      return { ...item, variants };
    }));
    return result;
  }),
  
  listAll: adminBoutiqueProcedure.query(async () => {
    const items = await db.getAllGoodies();
    const result = await Promise.all(items.map(async (item) => {
      const variants = await db.getVariantsByGoodie(item.id);
      return { ...item, variants };
    }));
    return result;
  }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const goodie = await db.getGoodieById(input.id);
      if (!goodie) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Produit non trouvé' });
      }
      const variants = await db.getVariantsByGoodie(input.id);
      return { ...goodie, variants };
    }),
  
  create: adminBoutiqueProcedure
    .input(z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      price: z.string(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isBestSeller: z.boolean().optional(),
      isNew: z.boolean().optional(),
      isRamadanEdition: z.boolean().optional(),
      totalStock: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createGoodie(input);
      return { id };
    }),
  
  update: adminBoutiqueProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isBestSeller: z.boolean().optional(),
      isNew: z.boolean().optional(),
      isRamadanEdition: z.boolean().optional(),
      totalStock: z.number().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateGoodie(id, data);
      return { success: true };
    }),
  
  createVariant: adminBoutiqueProcedure
    .input(z.object({
      goodieId: z.number(),
      size: z.string().optional(),
      color: z.string().optional(),
      sku: z.string().optional(),
      stock: z.number().min(0).default(0),
      priceModifier: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createGoodieVariant(input);
      return { id };
    }),
});

// ============================================
// ORDERS ROUTER
// ============================================

const ordersRouter = router({
  create: publicProcedure
    .input(z.object({
      customerName: z.string().min(2),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(8),
      items: z.array(z.object({
        goodieId: z.number(),
        variantId: z.number().optional(),
        quantity: z.number().min(1),
      })),
      pickupDate: z.string().optional(),
      pickupLocation: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Calculate total
      let totalAmount = 0;
      const itemsWithPrices = await Promise.all(input.items.map(async (item) => {
        const goodie = await db.getGoodieById(item.goodieId);
        if (!goodie) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Produit ${item.goodieId} non trouvé` });
        }
        
        let unitPrice = parseFloat(goodie.price);
        
        if (item.variantId) {
          const variant = await db.getVariantById(item.variantId);
          if (variant && variant.priceModifier) {
            unitPrice += parseFloat(variant.priceModifier);
          }
        }
        
        const totalPrice = unitPrice * item.quantity;
        totalAmount += totalPrice;
        
        return { ...item, unitPrice: unitPrice.toFixed(2), totalPrice: totalPrice.toFixed(2) };
      }));
      
      // Generate reference
      const orderReference = db.generateOrderReference();
      
      // Create order
      const orderId = await db.createOrder({
        orderReference,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        totalAmount: totalAmount.toFixed(2),
        pickupDate: input.pickupDate ? new Date(input.pickupDate) : undefined,
        pickupLocation: input.pickupLocation,
      });
      
      // Create order items
      for (const item of itemsWithPrices) {
        await db.createOrderItem({
          orderId,
          goodieId: item.goodieId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        });
        
        // Update stock if variant
        if (item.variantId) {
          await db.updateVariantStock(item.variantId, item.quantity);
        }
      }
      
      return { orderId, orderReference, totalAmount: totalAmount.toFixed(2) };
    }),
  
  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      const order = await db.getOrderByReference(input.reference);
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Commande non trouvée' });
      }
      const items = await db.getOrderItems(order.id);
      return { ...order, items };
    }),
  
  listAll: adminBoutiqueProcedure.query(async () => {
    const orders = await db.getAllOrders();
    const result = await Promise.all(orders.map(async (order) => {
      const items = await db.getOrderItems(order.id);
      return { ...order, items };
    }));
    return result;
  }),
  
  getStats: adminBoutiqueProcedure.query(async () => {
    return db.getOrderStats();
  }),
  
  updateStatus: adminBoutiqueProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['reserved', 'confirmed', 'paid', 'delivered', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.updateOrderStatus(input.id, input.status, ctx.user!.id);
      return { success: true };
    }),
});

// ============================================
// DONATIONS ROUTER
// ============================================

const donationsRouter = router({
  create: publicProcedure
    .input(z.object({
      donorName: z.string().min(2),
      donorEmail: z.string().email(),
      donorPhone: z.string().optional(),
      amount: z.string(),
      paymentMethod: z.enum(['transfer', 'on_site']),
      message: z.string().optional(),
      isAnonymous: z.boolean().optional(),
      acceptsUpdates: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const donationReference = db.generateDonationReference();
      
      const id = await db.createDonation({
        ...input,
        donationReference,
      });
      
      return { id, donationReference };
    }),
  
  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      const donation = await db.getDonationByReference(input.reference);
      if (!donation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Promesse de don non trouvée' });
      }
      return donation;
    }),
  
  listAll: adminDonsProcedure.query(async () => {
    return db.getAllDonations();
  }),
  
  getStats: adminDonsProcedure.query(async () => {
    return db.getDonationStats();
  }),
  
  updateStatus: adminDonsProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['promised', 'pending', 'received', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.updateDonationStatus(input.id, input.status, ctx.user!.id);
      return { success: true };
    }),
});

// ============================================
// CONTACT ROUTER
// ============================================

const contactRouter = router({
  send: publicProcedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().min(10),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createContactMessage(input);
      return { id, success: true };
    }),
  
  listAll: adminProcedure.query(async () => {
    return db.getAllContactMessages();
  }),
  
  markAsRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.markMessageAsRead(input.id);
      return { success: true };
    }),
});

// ============================================
// PUBLIC DATA ROUTER (for vitrine)
// ============================================

const publicDataRouter = router({
  partners: publicProcedure.query(async () => {
    return db.getActivePartners();
  }),
  
  testimonials: publicProcedure.query(async () => {
    return db.getApprovedTestimonials();
  }),
  
  gallery: publicProcedure.query(async () => {
    return db.getActiveMediaItems();
  }),
  
  faq: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.category) {
        return db.getFaqItemsByCategory(input.category);
      }
      return db.getActiveFaqItems();
    }),
  
  stats: publicProcedure.query(async () => {
    const volunteerStats = await db.getVolunteerStats();
    const donationStats = await db.getDonationStats();
    const days = await db.getRamadanDays();
    
    return {
      totalVolunteers: volunteerStats.total,
      presentVolunteers: volunteerStats.present,
      totalDonations: donationStats.total,
      receivedDonations: donationStats.received,
      totalDonationAmount: donationStats.totalAmount,
      receivedDonationAmount: donationStats.receivedAmount,
      totalDays: days.length,
      activeDays: days.filter(d => !d.isClosed).length,
    };
  }),
});

// ============================================
// ADMIN CONTENT ROUTER
// ============================================

const adminContentRouter = router({
  // Partners
  createPartner: superAdminProcedure
    .input(z.object({
      name: z.string().min(2),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createPartner(input);
      return { id };
    }),
  
  listPartners: adminProcedure.query(async () => {
    return db.getAllPartners();
  }),
  
  // Testimonials
  createTestimonial: superAdminProcedure
    .input(z.object({
      authorName: z.string().min(2),
      authorRole: z.string().optional(),
      content: z.string().min(10),
      avatarUrl: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      isApproved: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createTestimonial(input);
      return { id };
    }),
  
  listTestimonials: adminProcedure.query(async () => {
    return db.getAllTestimonials();
  }),
  
  // Media
  createMediaItem: superAdminProcedure
    .input(z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      mediaUrl: z.string(),
      mediaType: z.string(),
      thumbnailUrl: z.string().optional(),
      year: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createMediaItem(input);
      return { id };
    }),
  
  listMediaItems: adminProcedure.query(async () => {
    return db.getAllMediaItems();
  }),
  
  // FAQ
  createFaqItem: superAdminProcedure
    .input(z.object({
      question: z.string().min(5),
      answer: z.string().min(10),
      category: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createFaqItem(input);
      return { id };
    }),
  
  listFaqItems: adminProcedure.query(async () => {
    return db.getAllFaqItems();
  }),
  
  // Settings
  getSetting: adminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      return db.getSetting(input.key);
    }),
  
  setSetting: superAdminProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.setSetting(input.key, input.value, input.description);
      return { success: true };
    }),
  
  listSettings: adminProcedure.query(async () => {
    return db.getAllSettings();
  }),
});

// ============================================
// USERS ADMIN ROUTER
// ============================================

const usersAdminRouter = router({
  list: superAdminProcedure.query(async () => {
    return db.getAllUsers();
  }),
  
  updateRole: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['user', 'admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner']),
    }))
    .mutation(async ({ input }) => {
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),
});

// ============================================
// MAIN ROUTER
// ============================================

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  
  // Feature routers
  days: daysRouter,
  volunteers: volunteersRouter,
  goodies: goodiesRouter,
  orders: ordersRouter,
  donations: donationsRouter,
  contact: contactRouter,
  public: publicDataRouter,
  adminContent: adminContentRouter,
  usersAdmin: usersAdminRouter,
});

export type AppRouter = typeof appRouter;
