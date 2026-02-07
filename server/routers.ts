import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sendEmail, generateVolunteerConfirmationEmail, generateOrderConfirmationEmail, generateDonationConfirmationEmail, generateContactNotificationEmail } from "./email";
import { signInUser, signUpUser, getUserFromToken, signOutUser } from "./supabase-auth";
import * as supabaseServices from "./supabase-services";
import * as reservationServices from "./reservation-services";
import { getSupabaseAdminClient } from "./supabase";

// ============================================
// ROLE-BASED PROCEDURES
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_operations', 'admin_boutique', 'admin_dons'];
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
  const allowedRoles = ['admin', 'super_admin', 'admin_operations', 'scanner'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès scanner requis' });
  }
  return next({ ctx });
});

const adminOpsProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_operations'];
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
    return supabaseServices.getAllRamadanDaysSupabase();
  }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return supabaseServices.getRamadanDayByIdSupabase(input.id);
    }),
  
  create: superAdminProcedure
    .input(z.object({
      date: z.string(),
      dayNumber: z.number().min(1).max(30),
      capacity: z.number().min(1).default(50),
      location: z.string().optional(),
      iftarTime: z.string().optional(),
      hijriDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const day = await supabaseServices.createRamadanDaySupabase({
        dayNumber: input.dayNumber,
        date: input.date,
        capacity: input.capacity,
        location: input.location,
        iftarTime: input.iftarTime,
        hijriDate: input.hijriDate,
        notes: input.notes,
      });
      return { id: day.id };
    }),
  
  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      capacity: z.number().min(1).optional(),
      isOpen: z.boolean().optional(),
      location: z.string().optional(),
      iftarTime: z.string().optional(),
      hijriDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await supabaseServices.updateRamadanDaySupabase(id, data);
      return { success: true };
    }),
  
  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await supabaseServices.deleteRamadanDaySupabase(input.id);
      return { success: true };
    }),
  
  bulkCreate: superAdminProcedure
    .input(z.object({
      startDate: z.string(),
      daysCount: z.number().min(1).max(30).default(30),
      capacity: z.number().min(1).default(50),
      location: z.string().optional(),
      iftarTime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const createdIds: number[] = [];
      
      for (let i = 0; i < input.daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        const day = await supabaseServices.createRamadanDaySupabase({
          date: date.toISOString().split('T')[0],
          dayNumber: i + 1,
          capacity: input.capacity,
          location: input.location,
          iftarTime: input.iftarTime,
        });
        createdIds.push(day.id);
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
      const day = await supabaseServices.getRamadanDayByIdSupabase(input.dayId);
      if (!day) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Jour non trouvé' });
      }
      if (!day.isOpen || day.registeredCount >= day.capacity) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce jour est complet' });
      }
      
      // Create volunteer with QR token
      const volunteer = await supabaseServices.createVolunteerShiftSupabase({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        city: input.city,
        dayId: input.dayId,
        acceptedTerms: input.acceptedTerms,
      });
      
      // Check if day is now full and close it
      if (day.registeredCount + 1 >= day.capacity) {
        await supabaseServices.updateRamadanDaySupabase(input.dayId, { isOpen: false });
      }
      
      // Send confirmation email with QR code
      try {
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://ftourbabrayan.ma' 
          : 'http://localhost:3000';
        
        const emailData = generateVolunteerConfirmationEmail({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          dayNumber: day.dayNumber,
          dayDate: new Date(day.date).toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          location: day.location || 'Association Bab Rayan, Casablanca',
          startTime: day.iftarTime || '18h00',
          qrToken: volunteer.qrToken,
          baseUrl,
        });
        
        await sendEmail({
          to: input.email,
          subject: emailData.subject,
          html: emailData.html,
        });
      } catch (error) {
        console.error('[Volunteer Registration] Email send failed:', error);
      }
      
      return { id: volunteer.id, qrToken: volunteer.qrToken };
    }),
  
  getByQrCode: scannerProcedure
    .input(z.object({ qrCode: z.string() }))
    .query(async ({ input }) => {
      const volunteer = await supabaseServices.getVolunteerByTokenSupabase(input.qrCode);
      if (!volunteer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bénévole non trouvé' });
      }
      return { volunteer, day: volunteer.day };
    }),
  
  checkIn: scannerProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await supabaseServices.scanAndValidateTokenSupabase(
        input.qrCode,
        ctx.user?.id
      );
      
      if (!result.success) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: result.error || 'Erreur de validation' 
        });
      }
      
      return { success: true, volunteer: result.volunteer };
    }),
  
  manualValidate: scannerProcedure
    .input(z.object({ volunteerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.manualValidateSupabase(input.volunteerId, ctx.user!.id);
      return { success: true };
    }),
  
  listByDay: adminOpsProcedure
    .input(z.object({ dayId: z.number().optional() }))
    .query(async ({ input }) => {
      return supabaseServices.getVolunteersByDaySupabase(input.dayId);
    }),
  
  updateStatus: adminOpsProcedure
    .input(z.object({
      volunteerId: z.number(),
      status: z.enum(['registered', 'confirmed', 'present', 'absent', 'cancelled']),
    }))
    .mutation(async ({ input }) => {
      await supabaseServices.updateVolunteerStatusSupabase(input.volunteerId, input.status);
      return { success: true };
    }),
  
  stats: adminOpsProcedure.query(async () => {
    return supabaseServices.getVolunteerStatsSupabase();
  }),
  
  delete: adminOpsProcedure
    .input(z.object({ volunteerId: z.number() }))
    .mutation(async ({ input }) => {
      await supabaseServices.deleteVolunteerSupabase(input.volunteerId);
      return { success: true };
    }),
});

// ============================================
// CHECKIN ROUTER (PUBLIC QR VALIDATION)
// ============================================

const checkinRouter = router({
  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const volunteer = await supabaseServices.getVolunteerByTokenSupabase(input.token);
      
      if (!volunteer) {
        return { valid: false, error: 'Token invalide', code: 'INVALID_TOKEN', status: 'invalid' as const };
      }
      
      if (volunteer.qrStatus === 'validated') {
        return { 
          valid: false, 
          error: 'QR code déjà validé', 
          code: 'ALREADY_VALIDATED',
          status: 'already_validated' as const,
          volunteer: {
            firstName: volunteer.firstName,
            lastName: volunteer.lastName,
            scannedAt: volunteer.scannedAt,
          },
        };
      }
      
      const today = new Date().toISOString().split('T')[0];
      if (volunteer.day?.date !== today) {
        return { 
          valid: false, 
          error: 'Ce QR code n\'est pas valide pour aujourd\'hui', 
          code: 'WRONG_DAY',
          status: 'wrong_date' as const,
          volunteer: {
            firstName: volunteer.firstName,
            lastName: volunteer.lastName,
            expectedDate: volunteer.day?.date,
          },
          day: volunteer.day,
        };
      }
      
      return { 
        valid: true, 
        status: 'valid' as const,
        volunteer: {
          id: volunteer.id,
          firstName: volunteer.firstName,
          lastName: volunteer.lastName,
          email: volunteer.email,
          phone: volunteer.phone,
        },
        day: volunteer.day,
      };
    }),
  
  validate: scannerProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await supabaseServices.scanAndValidateTokenSupabase(
        input.token,
        ctx.user?.id,
        ctx.req.ip,
        ctx.req.headers['user-agent'] as string
      );
      
      return result;
    }),
});

// ============================================
// GOODIES ROUTER
// ============================================

const goodiesRouter = router({
  list: publicProcedure.query(async () => {
    return supabaseServices.getAllGoodiesSupabase(true); // Active only for public
  }),
  
  listAll: adminBoutiqueProcedure.query(async () => {
    return supabaseServices.getAllGoodiesSupabase(false); // All for admin
  }),
  
  create: adminBoutiqueProcedure
    .input(z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      price: z.number().min(0),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const goodie = await supabaseServices.createGoodieSupabase(input);
      return { id: goodie.id };
    }),
  
  update: adminBoutiqueProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      price: z.number().min(0).optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await supabaseServices.updateGoodieSupabase(id, data);
      return { success: true };
    }),
  
  delete: adminBoutiqueProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await supabaseServices.deleteGoodieSupabase(input.id);
      return { success: true };
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
        unitPrice: z.number().min(0),
      })),
      pickupDate: z.string().optional(),
      pickupLocation: z.string().optional(),
      notes: z.string().optional(),
      deliveryMode: z.enum(['pickup', 'home_delivery']).default('pickup'),
      deliveryAddress: z.string().optional(),
      deliveryCity: z.string().optional(),
      deliveryNeighborhood: z.string().optional(),
      deliveryPostalCode: z.string().optional(),
      deliveryPhone: z.string().optional(),
      deliveryInstructions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const order = await supabaseServices.createGoodieOrderSupabase(input);
      
      // Send confirmation email
      try {
        const nameParts = input.customerName.split(' ');
        const emailData = generateOrderConfirmationEmail({
          firstName: nameParts[0] || input.customerName,
          lastName: nameParts.slice(1).join(' ') || '',
          email: input.customerEmail,
          phone: input.customerPhone,
          orderId: order.orderReference,
          totalAmount: order.totalAmount,
          items: input.items.map(item => ({
            name: `Article #${item.goodieId}`,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
          baseUrl: process.env.NODE_ENV === 'production' ? 'https://ftourbabrayan.ma' : 'http://localhost:3000',
        });
        
        await sendEmail({
          to: input.customerEmail,
          subject: emailData.subject,
          html: emailData.html,
        });
      } catch (error) {
        console.error('[Order] Email send failed:', error);
      }
      
      return order;
    }),
  
  listAll: adminBoutiqueProcedure.query(async () => {
    return supabaseServices.getAllOrdersSupabase();
  }),
  
  updateStatus: adminBoutiqueProcedure
    .input(z.object({
      orderId: z.number(),
      status: z.enum(['reserved', 'confirmed', 'paid', 'delivered', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.updateGoodieOrderStatusSupabase(input.orderId, input.status, ctx.user?.id);
      return { success: true };
    }),
  
  stats: adminBoutiqueProcedure.query(async () => {
    return supabaseServices.getOrderStatsSupabase();
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
      amount: z.union([z.number(), z.string()]).transform((val) => typeof val === 'string' ? parseInt(val, 10) : val).pipe(z.number().min(1)),
      paymentMethod: z.enum(['transfer', 'on_site']),
      message: z.string().optional(),
      isAnonymous: z.boolean().default(false),
      acceptsUpdates: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const donation = await supabaseServices.createDonationPledgeSupabase(input);
      
      // Send confirmation email
      try {
        const nameParts = input.donorName.split(' ');
        const emailData = generateDonationConfirmationEmail({
          firstName: nameParts[0] || input.donorName,
          lastName: nameParts.slice(1).join(' ') || '',
          email: input.donorEmail,
          amount: donation.amount,
          paymentMethod: input.paymentMethod,
          donationId: donation.donationReference,
          baseUrl: process.env.NODE_ENV === 'production' ? 'https://ftourbabrayan.ma' : 'http://localhost:3000',
        });
        
        await sendEmail({
          to: input.donorEmail,
          subject: emailData.subject,
          html: emailData.html,
        });
      } catch (error) {
        console.error('[Donation] Email send failed:', error);
      }
      
      return donation;
    }),
  
  listAll: adminDonsProcedure.query(async () => {
    return supabaseServices.getAllDonationsSupabase();
  }),
  
  updateStatus: adminDonsProcedure
    .input(z.object({
      donationId: z.number(),
      status: z.enum(['promised', 'pending', 'received', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.updateDonationStatusSupabase(input.donationId, input.status, ctx.user?.id);
      return { success: true };
    }),
  
  markReceived: adminDonsProcedure
    .input(z.object({ donationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.markDonationReceivedSupabase(input.donationId, ctx.user?.id);
      return { success: true };
    }),
  
  stats: adminDonsProcedure.query(async () => {
    return supabaseServices.getDonationStatsSupabase();
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
      // Save to database
      await supabaseServices.createContactMessageSupabase(input);
      
      // Send notification email
      try {
        const emailData = generateContactNotificationEmail({
          name: input.name,
          email: input.email,
          phone: input.phone,
          subject: input.subject,
          message: input.message,
        });
        
        await sendEmail({
          to: 'contact@ftourbabrayan.ma',
          subject: emailData.subject,
          html: emailData.html,
        });
      } catch (error) {
        console.error('[Contact] Email send failed:', error);
      }
      
      return { success: true };
    }),
  
  list: adminProcedure.query(async () => {
    return supabaseServices.getAllContactMessagesSupabase();
  }),
});

// ============================================
// USERS ROUTER
// ============================================

const usersRouter = router({
  list: superAdminProcedure.query(async () => {
    return supabaseServices.getAllUsersSupabase();
  }),
  
  updateRole: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['user', 'admin', 'super_admin', 'admin_operations', 'admin_boutique', 'admin_dons', 'scanner']),
    }))
    .mutation(async ({ input }) => {
      await supabaseServices.updateUserRoleSupabase(input.userId, input.role);
      return { success: true };
    }),
});

// ============================================
// PUBLIC DATA ROUTER
// ============================================

const publicRouter = router({
  stats: publicProcedure.query(async () => {
    const stats = await supabaseServices.getPublicStatsSupabase();
    return {
      ...stats,
      totalDays: 30, // Fixed for Ramadan
    };
  }),
  
  days: publicProcedure.query(async () => {
    const days = await supabaseServices.getAllRamadanDaysSupabase();
    return days.filter(d => d.isOpen);
  }),
  
  goodies: publicProcedure.query(async () => {
    return supabaseServices.getAllGoodiesSupabase(true);
  }),
  
  testimonials: publicProcedure.query(async () => {
    return supabaseServices.getAllTestimonialsSupabase();
  }),
  
  partners: publicProcedure.query(async () => {
    return supabaseServices.getAllPartnersSupabase();
  }),
});

// ============================================
// UPLOAD ROUTER (Supabase Storage)
// ============================================

const uploadRouter = router({
  image: adminProcedure
    .input(z.object({
      fileName: z.string(),
      fileType: z.string(),
      fileData: z.string(), // Base64 encoded
      folder: z.string().default('goodies'),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      }

      // Extract base64 data
      const base64Data = input.fileData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const extension = input.fileName.split('.').pop() || 'png';
      const uniqueFileName = `${input.folder}/${timestamp}-${randomId}.${extension}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('images')
        .upload(uniqueFileName, buffer, {
          contentType: input.fileType,
          upsert: false,
        });

      if (error) {
        console.error('[Upload] Supabase Storage error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur lors de l\'upload: ' + error.message });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(uniqueFileName);

      return {
        url: urlData.publicUrl,
        path: data.path,
      };
    }),
});

// ============================================
// RESERVATIONS ROUTER
// ============================================

const restaurantsRouter = router({
  list: publicProcedure
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return reservationServices.getAllRestaurantsSupabase(input?.activeOnly);
    }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return reservationServices.getRestaurantByIdSupabase(input.id);
    }),
  
  create: superAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      address: z.string().min(1),
      phone: z.string().optional(),
      description: z.string().optional(),
      capacity: z.number().min(1).default(100),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      return reservationServices.createRestaurantSupabase(input);
    }),
  
  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      description: z.string().optional(),
      capacity: z.number().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await reservationServices.updateRestaurantSupabase(id, updates);
      return { success: true };
    }),
  
  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await reservationServices.deleteRestaurantSupabase(input.id);
      return { success: true };
    }),
  
  getSlots: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
    }))
    .query(async ({ input }) => {
      return reservationServices.getSlotsByRestaurantAndDateSupabase(input.restaurantId, input.date);
    }),
  
  createSlot: superAdminProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      capacity: z.number().min(1),
    }))
    .mutation(async ({ input }) => {
      return reservationServices.createRestaurantSlotSupabase(input);
    }),
  
  updateSlot: superAdminProcedure
    .input(z.object({
      id: z.number(),
      date: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      capacity: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await reservationServices.updateSlotSupabase(id, updates);
      return { success: true };
    }),
  
  deleteSlot: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await reservationServices.deleteSlotSupabase(input.id);
      return { success: true };
    }),
  
  getCapacityStats: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
    }))
    .query(async ({ input }) => {
      return reservationServices.getCapacityStatsSupabase(input.restaurantId, input.date);
    }),
});

const reservationsRouter = router({
  create: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
      slotId: z.number().optional(),
      fullName: z.string().min(1),
      phone: z.string().min(1),
      email: z.union([
        z.string().trim().transform(val => val === '' ? undefined : val).pipe(z.string().email()),
        z.literal('').transform(() => undefined),
      ]).optional(),
      seats: z.number().min(1).max(20),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const reservation = await reservationServices.createReservationSupabase(input);
        
        // Fetch restaurant details for the response (will be added to response)
        // Restaurant details are now included in the response via the mutation return
        
        // Send confirmation email if email provided
        if (reservation.email) {
          try {
            const { html, subject } = generateReservationConfirmationEmail(reservation);
            await sendEmail({
              to: reservation.email,
              subject,
              html,
              bcc: ['contact@ftourbabrayan.ma'],
            });
          } catch (emailError) {
            console.error('[Reservation] Email error:', emailError);
          }
        }
        
        return reservation;
      } catch (error: any) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: error.message || 'Erreur lors de la création de la réservation' 
        });
      }
    }),
  
  getByReference: publicProcedure
    .input(z.object({ referenceCode: z.string() }))
    .query(async ({ input }) => {
      return reservationServices.getReservationByReferenceSupabase(input.referenceCode);
    }),
  
  getByQrToken: publicProcedure
    .input(z.object({ qrToken: z.string() }))
    .query(async ({ input }) => {
      return reservationServices.getReservationByQrTokenSupabase(input.qrToken);
    }),
  
  getAvailableSeats: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
      slotId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return reservationServices.getAvailableSeatsSupabase(input.restaurantId, input.date, input.slotId);
    }),
  
  list: adminProcedure
    .input(z.object({
      restaurantId: z.number().optional(),
      date: z.string().optional(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'checked_in']).optional(),
      slotId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return reservationServices.getAllReservationsSupabase(input);
    }),
  
  updateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'checked_in']),
    }))
    .mutation(async ({ input, ctx }) => {
      await reservationServices.updateReservationStatusSupabase(
        input.id, 
        input.status,
        ctx.user?.name || ctx.user?.email || 'Admin'
      );
      return { success: true };
    }),
  
  cancel: publicProcedure
    .input(z.object({ referenceCode: z.string() }))
    .mutation(async ({ input }) => {
      const reservation = await reservationServices.getReservationByReferenceSupabase(input.referenceCode);
      if (!reservation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      }
      await reservationServices.cancelReservationSupabase(reservation.id);
      return { success: true };
    }),
  
  checkin: scannerProcedure
    .input(z.object({
      qrToken: z.string().optional(),
      referenceCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      let reservation;
      
      if (input.qrToken) {
        reservation = await reservationServices.getReservationByQrTokenSupabase(input.qrToken);
      } else if (input.referenceCode) {
        reservation = await reservationServices.getReservationByReferenceSupabase(input.referenceCode);
      }
      
      if (!reservation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      }
      
      try {
        const checkin = await reservationServices.createCheckinSupabase({
          reservationId: reservation.id,
          validationMode: input.qrToken ? 'scan' : 'manual',
          validatedBy: ctx.user?.name || ctx.user?.email || 'Scanner',
        });
        return checkin;
      } catch (error: any) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: error.message || 'Erreur lors du check-in' 
        });
      }
    }),
  
  exportCSV: adminProcedure
    .input(z.object({
      restaurantId: z.number().optional(),
      date: z.string().optional(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'checked_in']).optional(),
    }).optional())
    .query(async ({ input }) => {
      return reservationServices.exportReservationsCSVSupabase(input);
    }),
  
  getStats: adminProcedure
    .input(z.object({
      restaurantId: z.number().optional(),
      date: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return reservationServices.getReservationStatsSupabase(input);
    }),
});

// Helper function for reservation confirmation email
function generateReservationConfirmationEmail(reservation: any) {
  const baseUrl = process.env.VITE_APP_URL || 'https://ftourbabrayan.ma';
  const qrUrl = `${baseUrl}/checkin-reservation/${reservation.qrToken}`;
  
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background-color: #5d5a3c; padding: 30px; text-align: center;">
      <h1 style="color: #f5f5dc; margin: 0; font-size: 28px;">Ftour Bab Rayan</h1>
      <p style="color: #d4d4aa; margin: 10px 0 0 0; font-size: 14px;">Réservation confirmée</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="color: #5d5a3c; margin-top: 0;">Bonjour ${reservation.fullName},</h2>
      
      <p style="color: #333; line-height: 1.6;">
        Votre réservation pour le Ftour solidaire a été confirmée.
      </p>
      
      <!-- Reservation Details -->
      <div style="background-color: #f5f5f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #5d5a3c; margin-top: 0;">Détails de votre réservation</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Référence:</td>
            <td style="padding: 8px 0; color: #333; font-weight: bold;">${reservation.referenceCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date:</td>
            <td style="padding: 8px 0; color: #333;">${reservation.date}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Restaurant:</td>
            <td style="padding: 8px 0; color: #333;">${reservation.restaurant?.name || 'Non spécifié'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Nombre de places:</td>
            <td style="padding: 8px 0; color: #333;">${reservation.seats}</td>
          </tr>
        </table>
      </div>
      
      <!-- QR Code Section -->
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: #5d5a3c; font-weight: bold;">Présentez ce QR code à votre arrivée:</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}" 
             alt="QR Code" style="margin: 15px 0;" />
        <p style="color: #666; font-size: 12px;">Référence: ${reservation.referenceCode}</p>
      </div>
      
      <!-- Address -->
      <div style="background-color: #5d5a3c; color: #f5f5dc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0;">📍 Adresse</h3>
        <p style="margin: 0;">${reservation.restaurant?.address || '4 rue Bayt Lham, quartier Palmier, Casablanca'}</p>
      </div>
      
      <!-- Important Notes -->
      <div style="border-left: 4px solid #5d5a3c; padding-left: 15px; margin: 20px 0;">
        <h4 style="color: #5d5a3c; margin-top: 0;">Informations importantes</h4>
        <ul style="color: #666; padding-left: 20px;">
          <li>Présentez-vous 15 minutes avant l'heure du Ftour</li>
          <li>Munissez-vous de ce QR code (imprimé ou sur téléphone)</li>
          <li>En cas d'empêchement, merci d'annuler votre réservation</li>
        </ul>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #5d5a3c; padding: 20px; text-align: center;">
      <p style="color: #d4d4aa; margin: 0; font-size: 14px;">
        Association Bab Rayan<br/>
        📞 +212 664-887978 | ✉️ contact@ftourbabrayan.ma
      </p>
    </div>
  </div>
</body>
</html>
  `;
  
  return {
    html,
    subject: `✅ Réservation confirmée - ${reservation.referenceCode} - Ftour Bab Rayan`,
  };
}

// ============================================
// PAYMENTS ROUTER
// ============================================

const paymentsRouter = router({
  create: publicProcedure
    .input(z.object({
      userName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().optional().default('MAD'),
      paymentMethod: z.enum(['bank_transfer', 'cheque', 'cash', 'paypal']),
      description: z.string().optional(),
      relatedEntityType: z.string().optional(),
      relatedEntityId: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const payment = await supabaseServices.createPaymentSupabase(input);
        return {
          success: true,
          payment,
          message: 'Paiement créé avec succès',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la création du paiement',
        });
      }
    }),

  getById: publicProcedure
    .input(z.object({ paymentId: z.number() }))
    .query(async ({ input }) => {
      const payment = await supabaseServices.getPaymentByIdSupabase(input.paymentId);
      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Paiement non trouvé' });
      }
      return payment;
    }),

  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      const payment = await supabaseServices.getPaymentByReferenceSupabase(input.reference);
      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Paiement non trouvé' });
      }
      return payment;
    }),

  list: adminProcedure
    .input(z.object({
      paymentMethod: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return supabaseServices.getPaymentsSupabase(input);
    }),

  validate: adminProcedure
    .input(z.object({
      paymentId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const payment = await supabaseServices.validatePaymentSupabase(
          input.paymentId,
          ctx.user?.id || 0,
          input.notes
        );
        return {
          success: true,
          payment,
          message: 'Paiement validé avec succès',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la validation du paiement',
        });
      }
    }),

  cancel: adminProcedure
    .input(z.object({
      paymentId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const payment = await supabaseServices.cancelPaymentSupabase(
          input.paymentId,
          ctx.user?.id || 0,
          input.notes
        );
        return {
          success: true,
          payment,
          message: 'Paiement annulé avec succès',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'annulation du paiement',
        });
      }
    }),

  markChequeAsCashed: adminProcedure
    .input(z.object({
      paymentId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const payment = await supabaseServices.markChequeAsCashedSupabase(
          input.paymentId,
          ctx.user?.id || 0,
          input.notes
        );
        return {
          success: true,
          payment,
          message: 'Chèque marqué comme encaissé',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du marquage du chèque',
        });
      }
    }),

  getStats: adminProcedure.query(async () => {
    return supabaseServices.getPaymentStatsSupabase();
  }),
});

// ============================================
// MAIN APP ROUTER
// ============================================

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      // Essayer de récupérer le token depuis le header Authorization
      const authHeader = ctx.req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await getUserFromToken(token);
        if (user) {
          return user;
        }
      }
      return ctx.user;
    }),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const result = await signInUser(input);
        if (result.error) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: result.error });
        }
        return { user: result.user, session: result.session };
      }),
    
    signup: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await signUpUser(input);
        if (result.error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return { user: result.user };
      }),
    
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Nettoyer le cookie Manus OAuth si présent
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      // Déconnexion Supabase
      await signOutUser();
      return { success: true } as const;
    }),
  }),
  
  days: daysRouter,
  volunteers: volunteersRouter,
  checkin: checkinRouter,
  goodies: goodiesRouter,
  orders: ordersRouter,
  donations: donationsRouter,
  contact: contactRouter,
  users: usersRouter,
  public: publicRouter,
  upload: uploadRouter,
  restaurants: restaurantsRouter,
  reservations: reservationsRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
