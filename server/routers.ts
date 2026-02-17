import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sendEmail, generateVolunteerConfirmationEmail, generateOrderConfirmationEmail, generateDonationConfirmationEmail, generateContactNotificationEmail, generateGroupRegistrationEmail } from "./email";
import { signInUser, signUpUser, getUserFromToken, signOutUser } from "./supabase-auth";
import * as supabaseServices from "./supabase-services";
import * as reservationServices from "./reservation-services";
import { getSupabaseAdminClient } from "./supabase";
import { companyBookingsRouter } from "./company-booking-routers";
import { restaurantReservationsRouter } from "./restaurant-reservation-routers";
import { contentRouter } from "./content-router";
import { scannerRouter } from "./scanner-router";

// ============================================
// ROLE-BASED PROCEDURES
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'admin_restaurant', 'admin_patisserie', 'admin_terroir'];
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

const adminRestaurantProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_restaurant'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès restaurant requis' });
  }
  return next({ ctx });
});

const adminPatisserieProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_patisserie', 'admin_boutique'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès pâtisserie requis' });
  }
  return next({ ctx });
});

const adminTerroirProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_terroir'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès produits du terroir requis' });
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
      capacity: z.number().min(1).default(120),
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
      capacity: z.number().min(1).default(120),
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
      volunteerSlots: z.array(z.enum(["preparation_ftour", "service_ftour"])).min(1, "Veuillez sélectionner au moins un créneau"),
      acceptedTerms: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      if (!input.acceptedTerms) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous devez accepter les conditions' });
      }

      if (!input.volunteerSlots || input.volunteerSlots.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Veuillez sélectionner au moins un créneau de participation' });
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
        volunteerSlots: input.volunteerSlots,
        acceptedTerms: input.acceptedTerms,
      });

      // Check if day is now full and close it
      if (day.registeredCount + 1 >= day.capacity) {
        await supabaseServices.updateRamadanDaySupabase(input.dayId, { isOpen: false });
      }

      // Send confirmation email with QR code
      // Always use input.volunteerSlots (from form) to ensure slots appear
      // in the email even if the DB column doesn't exist yet
      try {
        const baseUrl = process.env.NODE_ENV === 'production'
          ? 'https://ftourbabrayan.ma'
          : 'http://localhost:3000';

        console.log('[Volunteer Registration] Sending email with slots:', input.volunteerSlots);

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
          volunteerSlots: input.volunteerSlots,
          qrToken: volunteer.qrToken,
          baseUrl,
        });

        await sendEmail({
          to: input.email,
          subject: emailData.subject,
          html: emailData.html,
        });
        console.log('[Volunteer Registration] Email sent successfully to:', input.email);
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

  registerGroup: publicProcedure
    .input(z.object({
      groupName: z.string().min(2, "Nom du groupe requis"),
      responsibleName: z.string().min(2, "Nom du responsable requis"),
      responsibleEmail: z.string().email("Email invalide"),
      responsiblePhone: z.string().min(8, "Téléphone invalide"),
      estimatedSize: z.number().optional(),
      dayId: z.number(),
      volunteerSlots: z.array(z.enum(["preparation_ftour", "service_ftour"])).min(1, "Veuillez sélectionner au moins un créneau"),
      fileName: z.string(),
      fileBase64: z.string().max(7_000_000, "Fichier trop volumineux (max 5 Mo)"),
      acceptedTerms: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!input.acceptedTerms) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous devez accepter les conditions' });
      }

      // Validate file extension
      const ext = input.fileName.toLowerCase().split('.').pop();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv' });
      }

      // Get day info for the email
      const day = await supabaseServices.getRamadanDayByIdSupabase(input.dayId);

      // Also create a volunteer entry for the group (so it appears in the dashboard)
      const volunteer = await supabaseServices.createVolunteerShiftSupabase({
        firstName: `[Groupe] ${input.groupName}`,
        lastName: input.responsibleName,
        email: input.responsibleEmail,
        phone: input.responsiblePhone,
        dayId: input.dayId,
        volunteerSlots: input.volunteerSlots,
        acceptedTerms: input.acceptedTerms,
      });

      // Build and send email with attachment to admin
      const emailData = generateGroupRegistrationEmail({
        groupName: input.groupName,
        responsibleName: input.responsibleName,
        responsibleEmail: input.responsibleEmail,
        responsiblePhone: input.responsiblePhone,
        estimatedSize: input.estimatedSize,
        volunteerSlots: input.volunteerSlots,
        dayNumber: day?.dayNumber,
        dayDate: day?.date ? new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : undefined,
        startTime: day?.iftarTime || '18h00',
        fileName: input.fileName,
      });

      try {
        await sendEmail({
          to: 'admin@ftourbabrayan.ma',
          subject: emailData.subject,
          html: emailData.html,
          attachments: [{
            filename: input.fileName,
            content: input.fileBase64,
          }],
        });
        console.log('[Group Registration] Admin email sent successfully');
      } catch (error) {
        console.error('[Group Registration] Admin email failed:', error);
      }

      return { success: true, volunteerId: volunteer.id };
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
  
  validate: publicProcedure
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
      paymentMethod: z.enum(['bank_transfer', 'cheque', 'cash']).default('cash'),
    }))
    .mutation(async ({ input }) => {
      // Validate stock for items with variants before creating order
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        for (const item of input.items) {
          if (item.variantId) {
            const { data: variant } = await supabase
              .from('goodie_variants')
              .select('stock, is_available')
              .eq('id', item.variantId)
              .single();
            if (!variant) throw new TRPCError({ code: 'NOT_FOUND', message: `Variante #${item.variantId} introuvable` });
            if (!variant.is_available) throw new TRPCError({ code: 'BAD_REQUEST', message: `Variante #${item.variantId} indisponible` });
            if (variant.stock < item.quantity) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `Stock insuffisant pour la variante #${item.variantId} (dispo: ${variant.stock}, demandé: ${item.quantity})` });
            }
          }
        }
      }

      const order = await supabaseServices.createGoodieOrderSupabase(input);

      // Decrement stock for items with variants
      if (supabase) {
        for (const item of input.items) {
          if (item.variantId) {
            const { data: variant } = await supabase
              .from('goodie_variants')
              .select('stock')
              .eq('id', item.variantId)
              .single();
            if (variant) {
              await supabase.from('goodie_variants')
                .update({ stock: Math.max(0, variant.stock - item.quantity) })
                .eq('id', item.variantId);
            }
          }
        }
      }

      // Send confirmation email with dynamic content
      try {
        const nameParts = input.customerName.split(' ');
        const { generateGoodiesOrderEmail } = await import('./email-templates');
        
        const emailData = generateGoodiesOrderEmail({
          firstName: nameParts[0] || input.customerName,
          lastName: nameParts.slice(1).join(' ') || '',
          email: input.customerEmail,
          phone: input.customerPhone,
          orderId: order.orderReference,
          totalAmount: order.totalAmount,
          deliveryFee: input.deliveryMode === 'home_delivery' ? 30 : 0,
          deliveryMode: input.deliveryMode,
          paymentMethod: input.paymentMethod || 'cash',
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          deliveryNeighborhood: input.deliveryNeighborhood,
          deliveryPhone: input.deliveryPhone,
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
      // Release stock when cancelling an order
      if (input.status === 'cancelled') {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('variant_id, quantity')
            .eq('order_id', input.orderId);
          if (orderItems) {
            for (const item of orderItems) {
              if (item.variant_id) {
                const { data: variant } = await supabase
                  .from('goodie_variants')
                  .select('stock')
                  .eq('id', item.variant_id)
                  .single();
                if (variant) {
                  await supabase.from('goodie_variants')
                    .update({ stock: variant.stock + item.quantity })
                    .eq('id', item.variant_id);
                }
              }
            }
          }
        }
      }
      await supabaseServices.updateGoodieOrderStatusSupabase(input.orderId, input.status, ctx.user?.id);
      return { success: true };
    }),
  
  stats: adminBoutiqueProcedure.query(async () => {
    return supabaseServices.getOrderStatsSupabase();
  }),
  
  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      const order = await supabaseServices.getGoodieOrderByReferenceSupabase(input.reference);
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }
      return order;
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

  markRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return supabaseServices.markContactMessageReadSupabase(input.id);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return supabaseServices.deleteContactMessageSupabase(input.id);
    }),
});

// ============================================
// USERS ROUTER
// ============================================

const usersRouter = router({
  list: superAdminProcedure.query(async () => {
    return supabaseServices.getAllUsersSupabase();
  }),

  create: superAdminProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
      phone: z.string().optional(),
      role: z.enum(['user', 'admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner', 'admin_restaurant', 'admin_patisserie', 'admin_terroir']).default('user'),
    }))
    .mutation(async ({ input }) => {
      const result = await signUpUser({ email: input.email, password: input.password, name: input.name, phone: input.phone });
      if (result.error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
      }
      // If a non-default role was specified, update it after creation
      if (input.role !== 'user' && result.user) {
        await supabaseServices.updateUserRoleByOpenIdSupabase(result.user.id, input.role);
      }
      return { success: true, user: result.user };
    }),

  updateRole: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['user', 'admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner', 'admin_restaurant', 'admin_patisserie', 'admin_terroir']),
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
      capacity: z.number().min(1).max(50).default(50),
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
      capacity: z.number().max(50).optional(),
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
// RESTAURANT MODULE ROUTER (Particuliers / Entreprises / Groupes)
// ============================================

const restaurantModuleRouter = router({
  // --- Public: list available slots ---
  listSlots: publicProcedure
    .input(z.object({
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }).optional())
    .query(async () => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { data, error } = await supabase
        .from('restaurant_slots')
        .select('*')
        .eq('is_closed', false)
        .order('start_at', { ascending: true });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  // --- Public: create reservation (particulier) ---
  createParticulier: publicProcedure
    .input(z.object({
      slotId: z.number(),
      displayChoice: z.enum(['jardin', 'brasserie']),
      seats: z.number().min(1).max(10),
      name: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.seats > 10) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 10 places par réservation particulier' });
      }
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      // Fetch slot and validate capacity
      const { data: slot } = await supabase.from('restaurant_slots').select('*').eq('id', input.slotId).single();
      if (!slot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Créneau introuvable' });
      if (slot.is_closed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Créneau fermé' });

      // Allocation: Particulier -> brasserie or jardin(jardin_libre->brasserie)
      const allocations: { bucket: string; seats: number }[] = [];
      if (input.displayChoice === 'brasserie') {
        const remaining = slot.cap_brasserie - slot.booked_brasserie;
        if (remaining < input.seats) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité insuffisante en Brasserie' });
        allocations.push({ bucket: 'brasserie', seats: input.seats });
      } else {
        // Jardin: jardin_libre first, then brasserie
        const remJardin = slot.cap_jardin_libre - slot.booked_jardin_libre;
        const remBrasserie = slot.cap_brasserie - slot.booked_brasserie;
        const inJardin = Math.min(input.seats, remJardin);
        const inBrasserie = input.seats - inJardin;
        if (inBrasserie > remBrasserie) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité insuffisante' });
        if (inJardin > 0) allocations.push({ bucket: 'jardin_libre', seats: inJardin });
        if (inBrasserie > 0) allocations.push({ bucket: 'brasserie', seats: inBrasserie });
      }
      // Check global
      const remGlobal = slot.cap_jardin_global - slot.booked_jardin_global;
      if (remGlobal < input.seats) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité globale insuffisante' });

      const reference = `RES-P-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrToken = `rp-${Date.now()}-${Math.random().toString(36).substring(2, 14)}`;

      const { data, error } = await supabase.from('restaurant_reservations').insert({
        reference, type: 'particulier',
        seats_total: input.seats, name: input.name, phone: input.phone, email: input.email,
        notes: input.notes, status: 'submitted', payment_status: 'pending', qr_token: qrToken, qr_status: 'inactive',
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Create allocations
      for (const alloc of allocations) {
        await supabase.from('restaurant_reservation_allocations').insert({ reservation_id: data.id, bucket: alloc.bucket, seats: alloc.seats });
      }
      // Update slot counters
      const updates: any = { booked_jardin_global: slot.booked_jardin_global + input.seats };
      for (const alloc of allocations) {
        if (alloc.bucket === 'brasserie') updates.booked_brasserie = slot.booked_brasserie + alloc.seats;
        if (alloc.bucket === 'jardin_libre') updates.booked_jardin_libre = slot.booked_jardin_libre + alloc.seats;
      }
      await supabase.from('restaurant_slots').update(updates).eq('id', input.slotId);

      return data;
    }),

  // --- Public: create reservation (entreprise) ---
  createEntreprise: publicProcedure
    .input(z.object({
      slotId: z.number(),
      displayChoice: z.enum(['jardin', 'corpo']),
      seats: z.number().min(1).max(120),
      companyName: z.string().min(1),
      name: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      const { data: slot } = await supabase.from('restaurant_slots').select('*').eq('id', input.slotId).single();
      if (!slot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Créneau introuvable' });
      if (slot.is_closed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Créneau fermé' });

      // Allocation: Entreprise -> corpo or jardin(jardin_libre->corpo)
      const allocations: { bucket: string; seats: number }[] = [];
      if (input.displayChoice === 'corpo') {
        const remaining = slot.cap_corpo - slot.booked_corpo;
        if (remaining < input.seats) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité insuffisante en Corpo' });
        allocations.push({ bucket: 'corpo', seats: input.seats });
      } else {
        const remJardin = slot.cap_jardin_libre - slot.booked_jardin_libre;
        const remCorpo = slot.cap_corpo - slot.booked_corpo;
        const inJardin = Math.min(input.seats, remJardin);
        const inCorpo = input.seats - inJardin;
        if (inCorpo > remCorpo) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité insuffisante' });
        if (inJardin > 0) allocations.push({ bucket: 'jardin_libre', seats: inJardin });
        if (inCorpo > 0) allocations.push({ bucket: 'corpo', seats: inCorpo });
      }
      const remGlobal = slot.cap_jardin_global - slot.booked_jardin_global;
      if (remGlobal < input.seats) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité globale insuffisante' });

      const reference = `RES-E-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrToken = `re-${Date.now()}-${Math.random().toString(36).substring(2, 14)}`;

      const { data, error } = await supabase.from('restaurant_reservations').insert({
        reference, type: 'entreprise',
        seats_total: input.seats, name: input.name, phone: input.phone, email: input.email,
        company_name: input.companyName, notes: input.notes,
        status: 'pending_confirmation', payment_status: 'not_applicable', qr_token: qrToken, qr_status: 'inactive',
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      for (const alloc of allocations) {
        await supabase.from('restaurant_reservation_allocations').insert({ reservation_id: data.id, bucket: alloc.bucket, seats: alloc.seats });
      }
      const updates: any = { booked_jardin_global: slot.booked_jardin_global + input.seats };
      for (const alloc of allocations) {
        if (alloc.bucket === 'corpo') updates.booked_corpo = slot.booked_corpo + alloc.seats;
        if (alloc.bucket === 'jardin_libre') updates.booked_jardin_libre = slot.booked_jardin_libre + alloc.seats;
      }
      await supabase.from('restaurant_slots').update(updates).eq('id', input.slotId);

      return data;
    }),

  // --- Public: create reservation (groupe) ---
  createGroupe: publicProcedure
    .input(z.object({
      slotId: z.number(),
      displayChoice: z.enum(['jardin', 'brasserie']),
      seats: z.number().min(1).max(120),
      groupName: z.string().min(1),
      groupType: z.string().optional(),
      name: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      const { data: slot } = await supabase.from('restaurant_slots').select('*').eq('id', input.slotId).single();
      if (!slot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Créneau introuvable' });
      if (slot.is_closed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Créneau fermé' });

      // Allocation: Groupe -> brasserie or jardin(jardin_libre->brasserie)
      const allocations: { bucket: string; seats: number }[] = [];
      if (input.displayChoice === 'brasserie') {
        const remaining = slot.cap_brasserie - slot.booked_brasserie;
        if (remaining < input.seats) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité insuffisante en Brasserie' });
        allocations.push({ bucket: 'brasserie', seats: input.seats });
      } else {
        const remJardin = slot.cap_jardin_libre - slot.booked_jardin_libre;
        const remBrasserie = slot.cap_brasserie - slot.booked_brasserie;
        const inJardin = Math.min(input.seats, remJardin);
        const inBrasserie = input.seats - inJardin;
        if (inBrasserie > remBrasserie) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité insuffisante' });
        if (inJardin > 0) allocations.push({ bucket: 'jardin_libre', seats: inJardin });
        if (inBrasserie > 0) allocations.push({ bucket: 'brasserie', seats: inBrasserie });
      }
      const remGlobal = slot.cap_jardin_global - slot.booked_jardin_global;
      if (remGlobal < input.seats) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité globale insuffisante' });

      const reference = `RES-G-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrToken = `rg-${Date.now()}-${Math.random().toString(36).substring(2, 14)}`;

      const { data, error } = await supabase.from('restaurant_reservations').insert({
        reference, type: 'groupe',
        seats_total: input.seats, name: input.name, phone: input.phone, email: input.email,
        group_name: input.groupName, group_type: input.groupType, notes: input.notes,
        status: 'pending_confirmation', payment_status: 'not_applicable', qr_token: qrToken, qr_status: 'inactive',
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      for (const alloc of allocations) {
        await supabase.from('restaurant_reservation_allocations').insert({ reservation_id: data.id, bucket: alloc.bucket, seats: alloc.seats });
      }
      const updates: any = { booked_jardin_global: slot.booked_jardin_global + input.seats };
      for (const alloc of allocations) {
        if (alloc.bucket === 'brasserie') updates.booked_brasserie = slot.booked_brasserie + alloc.seats;
        if (alloc.bucket === 'jardin_libre') updates.booked_jardin_libre = slot.booked_jardin_libre + alloc.seats;
      }
      await supabase.from('restaurant_slots').update(updates).eq('id', input.slotId);

      return data;
    }),

  // --- Admin: list reservations by type ---
  adminListParticuliers: adminRestaurantProcedure
    .input(z.object({
      status: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      let query = supabase.from('restaurant_reservations').select('*').eq('type', 'particulier').order('created_at', { ascending: false });
      if (input?.status) query = query.eq('status', input.status);
      if (input?.search) query = query.or(`name.ilike.%${input.search}%,phone.ilike.%${input.search}%,reference.ilike.%${input.search}%`);
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  adminListEntreprises: adminRestaurantProcedure
    .input(z.object({
      status: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      let query = supabase.from('restaurant_reservations').select('*').eq('type', 'entreprise').order('created_at', { ascending: false });
      if (input?.status) query = query.eq('status', input.status);
      if (input?.search) query = query.or(`name.ilike.%${input.search}%,company_name.ilike.%${input.search}%,reference.ilike.%${input.search}%`);
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  adminListGroupes: adminRestaurantProcedure
    .input(z.object({
      status: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      let query = supabase.from('restaurant_reservations').select('*').eq('type', 'groupe').order('created_at', { ascending: false });
      if (input?.status) query = query.eq('status', input.status);
      if (input?.search) query = query.or(`name.ilike.%${input.search}%,group_name.ilike.%${input.search}%,reference.ilike.%${input.search}%`);
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  // --- Admin: update reservation status ---
  adminUpdateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['submitted', 'pending_confirmation', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      const updateData: any = {
        status: input.status,
        processed_by: ctx.user?.id,
        processed_at: new Date().toISOString(),
      };

      // Activate QR when confirmed
      if (input.status === 'confirmed') {
        updateData.qr_status = 'active';
      }
      // Revoke QR when cancelled/rejected
      if (input.status === 'cancelled' || input.status === 'rejected') {
        updateData.qr_status = 'revoked';
      }

      const { error } = await supabase
        .from('restaurant_reservations')
        .update(updateData)
        .eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Send confirmation email with QR code when reservation is confirmed
      if (input.status === 'confirmed') {
        try {
          const { data: reservation } = await supabase
            .from('restaurant_reservations')
            .select('*')
            .eq('id', input.id)
            .single();

          if (reservation?.email && reservation?.qr_token) {
            const baseUrl = process.env.VITE_APP_URL || 'https://ftourbabrayan.ma';
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${baseUrl}/checkin-reservation/${reservation.qr_token}`)}`;

            const typeLabel: Record<string, string> = {
              particulier: 'Particulier',
              entreprise: 'Entreprise',
              groupe: 'Groupe',
            };

            const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f0;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 0;">
      <table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Ftour <span style="color:#fbbf24;">Bab Rayan</span></h1>
          <p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:14px;">Réservation confirmée</p>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <h2 style="color:#5d5a3c;margin:0 0 20px 0;font-size:24px;">Votre réservation est confirmée</h2>
          <p style="color:#374151;font-size:16px;line-height:1.6;">Bonjour <strong>${reservation.name}</strong>,</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;">Excellente nouvelle ! Votre réservation au Restaurant Solidaire a été confirmée.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f5f0;border-radius:8px;margin:20px 0;">
            <tr><td style="padding:20px;">
              <h3 style="color:#5d5a3c;margin:0 0 15px 0;font-size:18px;">Détails de votre réservation</h3>
              <p style="margin:5px 0;color:#374151;"><strong>Type :</strong> ${typeLabel[reservation.type] || reservation.type}</p>
              <p style="margin:5px 0;color:#374151;"><strong>Nombre de places :</strong> ${reservation.seats_total}</p>
              ${reservation.company_name ? `<p style="margin:5px 0;color:#374151;"><strong>Entreprise :</strong> ${reservation.company_name}</p>` : ''}
              ${reservation.group_name ? `<p style="margin:5px 0;color:#374151;"><strong>Groupe :</strong> ${reservation.group_name}</p>` : ''}
              <p style="margin:10px 0 0 0;color:#6b7280;font-size:14px;"><strong>Référence :</strong> ${reservation.reference}</p>
            </td></tr>
          </table>
          <div style="text-align:center;margin:30px 0;padding:20px;background-color:#ffffff;border:2px dashed #d4a574;border-radius:8px;">
            <h3 style="color:#5d5a3c;margin:0 0 15px 0;font-size:18px;">Votre QR Code d'accès</h3>
            <img src="${qrCodeUrl}" alt="QR Code" style="width:200px;height:200px;margin:10px 0;" />
            <p style="color:#6b7280;font-size:14px;margin:10px 0 0 0;">Présentez ce QR code à l'entrée le jour de votre visite</p>
          </div>
          <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#fef3c7;border-radius:8px;margin:20px 0;">
            <tr><td style="padding:20px;">
              <h3 style="color:#92400e;margin:0 0 15px 0;font-size:18px;">Consignes importantes</h3>
              <ul style="margin:0;padding-left:20px;color:#374151;">
                <li style="margin-bottom:8px;">Arrivez 15 minutes avant l'heure de votre réservation</li>
                <li style="margin-bottom:8px;">Présentez votre QR code à l'entrée</li>
                <li style="margin-bottom:8px;">En cas d'annulation, prévenez-nous au moins 24h à l'avance</li>
              </ul>
            </td></tr>
          </table>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:20px 0 0 0;">À très bientôt !<br><strong>L'équipe Ftour Bab Rayan</strong></p>
        </td></tr>
        <tr><td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;">Association Bab Rayan</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">4 rue Bayt Lham, quartier Palmier, Casablanca<br>Tél: +212 610 023 555 | contact@ftourbabrayan.ma</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

            await sendEmail({
              to: reservation.email,
              subject: `✅ Réservation confirmée - Référence ${reservation.reference}`,
              html: emailHtml,
            });
          }
        } catch (emailError) {
          console.error('[Restaurant Reservation] Confirmation email failed:', emailError);
        }
      }

      return { success: true };
    }),

  // --- Admin: stats ---
  adminStats: adminProcedure
    .input(z.object({
      type: z.enum(['particulier', 'entreprise', 'groupe']).optional(),
    }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      let query = supabase.from('restaurant_reservations').select('type, status, seats_total');
      if (input?.type) query = query.eq('type', input.type);
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      const reservations = data || [];
      return {
        total: reservations.length,
        totalSeats: reservations.reduce((sum: number, r: any) => sum + (r.seats_total || 0), 0),
        byStatus: {
          submitted: reservations.filter((r: any) => r.status === 'submitted').length,
          pending_confirmation: reservations.filter((r: any) => r.status === 'pending_confirmation').length,
          confirmed: reservations.filter((r: any) => r.status === 'confirmed').length,
          rejected: reservations.filter((r: any) => r.status === 'rejected').length,
          cancelled: reservations.filter((r: any) => r.status === 'cancelled').length,
          completed: reservations.filter((r: any) => r.status === 'completed').length,
        },
        byType: {
          particulier: reservations.filter((r: any) => r.type === 'particulier').length,
          entreprise: reservations.filter((r: any) => r.type === 'entreprise').length,
          groupe: reservations.filter((r: any) => r.type === 'groupe').length,
        },
      };
    }),

  // --- Admin: manage slots ---
  adminCreateSlot: superAdminProcedure
    .input(z.object({
      startAt: z.string(),
      endAt: z.string(),
      capJardinGlobal: z.number().default(120),
      capBrasserie: z.number().default(50),
      capCorpo: z.number().default(50),
      capJardinLibre: z.number().default(20),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { data, error } = await supabase
        .from('restaurant_slots')
        .insert({
          start_at: input.startAt,
          end_at: input.endAt,
          cap_jardin_global: input.capJardinGlobal,
          cap_brasserie: input.capBrasserie,
          cap_corpo: input.capCorpo,
          cap_jardin_libre: input.capJardinLibre,
          notes: input.notes,
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  adminListSlots: adminProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
    const { data, error } = await supabase
      .from('restaurant_slots')
      .select('*')
      .order('start_at', { ascending: true });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),
});

// ============================================
// TERROIR MODULE ROUTER
// ============================================

const terroirModuleRouter = router({
  // --- Public: list active products ---
  listProducts: publicProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
    const { data, error } = await supabase
      .from('terroir_products')
      .select('*, terroir_product_variants(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),

  // --- Public: list pickup slots ---
  listPickupSlots: publicProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
    const { data, error } = await supabase
      .from('terroir_pickup_slots')
      .select('*')
      .eq('is_closed', false)
      .order('date', { ascending: true });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),

  // --- Public: create order ---
  createOrder: publicProcedure
    .input(z.object({
      customerName: z.string().min(2),
      customerPhone: z.string().min(8),
      customerEmail: z.string().email().optional(),
      pickupSlotId: z.number().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.number(),
        variantId: z.number().optional(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
      })).min(1),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      // Validate stock for each item with a variant
      for (const item of input.items) {
        if (item.variantId) {
          const { data: variant } = await supabase
            .from('terroir_product_variants')
            .select('stock_total, stock_reserved')
            .eq('id', item.variantId)
            .single();
          if (!variant) throw new TRPCError({ code: 'NOT_FOUND', message: `Variante ${item.variantId} introuvable` });
          const available = variant.stock_total - variant.stock_reserved;
          if (available < item.quantity) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Stock insuffisant pour la variante ${item.variantId}` });
          }
        }
      }

      const totalAmount = input.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      const reference = `TER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrToken = `ter-${Date.now()}-${Math.random().toString(36).substring(2, 14)}`;

      const { data: order, error } = await supabase.from('terroir_orders').insert({
        order_reference: reference,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
        pickup_slot_id: input.pickupSlotId,
        total_amount: totalAmount,
        status: 'created',
        payment_status: 'pending',
        qr_token: qrToken,
        qr_status: 'inactive',
        notes: input.notes,
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Create order items and update stock
      for (const item of input.items) {
        await supabase.from('terroir_order_items').insert({
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
        });

        // Increment stock_reserved on variant
        if (item.variantId) {
          const { data: variant } = await supabase
            .from('terroir_product_variants')
            .select('stock_reserved')
            .eq('id', item.variantId)
            .single();
          if (variant) {
            await supabase.from('terroir_product_variants')
              .update({ stock_reserved: variant.stock_reserved + item.quantity })
              .eq('id', item.variantId);
          }
        }
      }

      // Send confirmation email with QR code
      if (input.customerEmail) {
        try {
          const baseUrl = process.env.VITE_APP_URL || 'https://ftourbabrayan.ma';
          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${baseUrl}/qr/terroir/${reference}`)}`;

          // Fetch product names for the email
          const productNames: Record<number, string> = {};
          for (const item of input.items) {
            const { data: product } = await supabase.from('terroir_products').select('name').eq('id', item.productId).single();
            if (product) productNames[item.productId] = product.name;
          }

          const itemsHtml = input.items.map(item =>
            `<tr>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${productNames[item.productId] || `Produit #${item.productId}`}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.unitPrice * item.quantity} MAD</td>
            </tr>`
          ).join('');

          const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 0;">
      <table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Ftour <span style="color:#fbbf24;">Bab Rayan</span></h1>
          <p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:14px;">Terroir Solidaire</p>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <h2 style="color:#166534;margin:0 0 20px 0;font-size:24px;">Commande confirmée !</h2>
          <p style="color:#374151;font-size:16px;line-height:1.6;">Bonjour <strong>${input.customerName}</strong>,</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;">Votre commande de produits terroir a bien été enregistrée.</p>
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
                <td style="padding:15px;text-align:right;font-weight:bold;color:#166534;font-size:18px;">${totalAmount} MAD</td>
              </tr>
            </tbody>
          </table>
          <div style="text-align:center;margin:30px 0;padding:20px;background-color:#ffffff;border:2px dashed #166534;border-radius:8px;">
            <h3 style="color:#166534;margin:0 0 15px 0;font-size:18px;">Votre QR Code</h3>
            <img src="${qrCodeUrl}" alt="QR Code" style="width:200px;height:200px;margin:10px 0;" />
            <p style="color:#6b7280;font-size:14px;margin:10px 0 0 0;">Présentez ce QR code lors du retrait de votre commande</p>
          </div>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:20px 0 0 0;">Merci pour votre soutien !<br><strong>L'équipe Ftour Bab Rayan</strong></p>
        </td></tr>
        <tr><td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;">Association Bab Rayan</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">4 rue Bayt Lham, quartier Palmier, Casablanca<br>Tél: +212 610 023 555 | contact@ftourbabrayan.ma</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

          await sendEmail({
            to: input.customerEmail,
            subject: `✅ Confirmation commande terroir #${reference}`,
            html: emailHtml,
          });
        } catch (emailError) {
          console.error('[Terroir Order] Email send failed:', emailError);
        }
      }

      return order;
    }),

  // --- Admin: list all orders ---
  adminListOrders: adminTerroirProcedure
    .input(z.object({
      status: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      let query = supabase.from('terroir_orders').select('*, terroir_order_items(*, terroir_products(*), terroir_product_variants(*))').order('created_at', { ascending: false });
      if (input?.status) query = query.eq('status', input.status);
      if (input?.search) query = query.or(`customer_name.ilike.%${input.search}%,customer_phone.ilike.%${input.search}%,order_reference.ilike.%${input.search}%`);
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  // --- Admin: update order status ---
  adminUpdateOrderStatus: adminTerroirProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['created', 'paid', 'ready', 'picked_up', 'cancelled', 'no_show']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

      const updateData: any = {
        status: input.status,
        processed_by: ctx.user?.id,
        processed_at: new Date().toISOString(),
      };

      // Activate QR when paid
      if (input.status === 'paid') {
        updateData.qr_status = 'active';
        updateData.payment_status = 'paid';
      }
      // Mark QR used when picked_up
      if (input.status === 'picked_up') {
        updateData.qr_status = 'used';
      }
      // Revoke QR and release stock when cancelled
      if (input.status === 'cancelled') {
        updateData.qr_status = 'revoked';
        // Release reserved stock
        const { data: orderItems } = await supabase
          .from('terroir_order_items')
          .select('variant_id, quantity')
          .eq('order_id', input.id);
        if (orderItems) {
          for (const item of orderItems) {
            if (item.variant_id) {
              const { data: variant } = await supabase
                .from('terroir_product_variants')
                .select('stock_reserved')
                .eq('id', item.variant_id)
                .single();
              if (variant) {
                await supabase.from('terroir_product_variants')
                  .update({ stock_reserved: Math.max(0, variant.stock_reserved - item.quantity) })
                  .eq('id', item.variant_id);
              }
            }
          }
        }
      }

      const { error } = await supabase.from('terroir_orders').update(updateData).eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  // --- Admin: stats ---
  adminStats: adminTerroirProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
    const { data, error } = await supabase.from('terroir_orders').select('status, total_amount');
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    const orders = data || [];
    return {
      total: orders.length,
      totalRevenue: orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || 0), 0),
      byStatus: {
        created: orders.filter((o: any) => o.status === 'created').length,
        paid: orders.filter((o: any) => o.status === 'paid').length,
        ready: orders.filter((o: any) => o.status === 'ready').length,
        picked_up: orders.filter((o: any) => o.status === 'picked_up').length,
        cancelled: orders.filter((o: any) => o.status === 'cancelled').length,
        no_show: orders.filter((o: any) => o.status === 'no_show').length,
      },
    };
  }),

  // --- Admin: CRUD products ---
  adminListProducts: adminTerroirProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
    const { data, error } = await supabase
      .from('terroir_products')
      .select('*, terroir_product_variants(*)')
      .order('sort_order', { ascending: true });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),

  adminCreateProduct: adminTerroirProcedure
    .input(z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      category: z.string().optional(),
      imageUrl: z.string().optional(),
      isActive: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { data, error } = await supabase.from('terroir_products').insert({
        name: input.name,
        description: input.description,
        category: input.category,
        image_url: input.imageUrl,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  adminUpdateProduct: adminTerroirProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      imageUrl: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { id, ...fields } = input;
      const updateData: any = {};
      if (fields.name !== undefined) updateData.name = fields.name;
      if (fields.description !== undefined) updateData.description = fields.description;
      if (fields.category !== undefined) updateData.category = fields.category;
      if (fields.imageUrl !== undefined) updateData.image_url = fields.imageUrl;
      if (fields.isActive !== undefined) updateData.is_active = fields.isActive;
      if (fields.sortOrder !== undefined) updateData.sort_order = fields.sortOrder;
      const { error } = await supabase.from('terroir_products').update(updateData).eq('id', id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  // --- Admin: CRUD variants ---
  adminCreateVariant: adminTerroirProcedure
    .input(z.object({
      productId: z.number(),
      label: z.string().min(1),
      sku: z.string().optional(),
      priceUnit: z.number().min(0),
      stockTotal: z.number().min(0).default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { data, error } = await supabase.from('terroir_product_variants').insert({
        product_id: input.productId,
        label: input.label,
        sku: input.sku,
        price_unit: input.priceUnit,
        stock_total: input.stockTotal,
        stock_reserved: 0,
        is_active: input.isActive,
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  adminUpdateVariant: adminTerroirProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      sku: z.string().optional(),
      priceUnit: z.number().min(0).optional(),
      stockTotal: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { id, ...fields } = input;
      const updateData: any = {};
      if (fields.label !== undefined) updateData.label = fields.label;
      if (fields.sku !== undefined) updateData.sku = fields.sku;
      if (fields.priceUnit !== undefined) updateData.price_unit = fields.priceUnit;
      if (fields.stockTotal !== undefined) updateData.stock_total = fields.stockTotal;
      if (fields.isActive !== undefined) updateData.is_active = fields.isActive;
      const { error } = await supabase.from('terroir_product_variants').update(updateData).eq('id', id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  // --- Admin: manage pickup slots ---
  adminListPickupSlots: adminTerroirProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
    const { data, error } = await supabase.from('terroir_pickup_slots').select('*').order('date', { ascending: true });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),

  adminCreatePickupSlot: adminTerroirProcedure
    .input(z.object({
      date: z.string(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      maxOrders: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });
      const { data, error } = await supabase.from('terroir_pickup_slots').insert({
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        max_orders: input.maxOrders,
        notes: input.notes,
      }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),
});

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

// ============================================
// PASTRIES ROUTER (Pâtisserie Solidaire)
// ============================================

function isPastriesTableMissing(error: any): boolean {
  return error?.code === 'PGRST204' || error?.code === '42P01' ||
    error?.message?.includes('schema cache') || error?.message?.includes('does not exist');
}

const PASTRIES_TABLE_MISSING_MSG = 'La table "pastries" n\'existe pas encore dans la base de données. Veuillez exécuter la migration SQL : supabase/migrations/add_pastry_and_qr_tables.sql dans l\'éditeur SQL de Supabase.';

const pastriesRouter = router({
  list: publicProcedure.query(async () => {
    try {
      return await supabaseServices.getPastriesSupabase();
    } catch (error) {
      console.error('Error fetching pastries:', error);
      return [];
    }
  }),

  create: adminBoutiqueProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      price: z.number().positive(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });

      const { data, error } = await client
        .from('pastries')
        .insert({
          name: input.name,
          description: input.description,
          price: input.price,
          image_url: input.imageUrl,
          category: input.category,
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
    }),

  update: adminBoutiqueProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      active: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.description) updateData.description = input.description;
      if (input.price) updateData.price = input.price;
      if (input.imageUrl) updateData.image_url = input.imageUrl;
      if (input.category !== undefined) updateData.category = input.category;
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
    }),

  delete: adminBoutiqueProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
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
    }),
});

// ============================================
// PASTRY ORDERS ROUTER
// ============================================

const pastryOrdersRouter = router({
  create: publicProcedure
    .input(z.object({
      customerName: z.string(),
      phone: z.string(),
      email: z.string().email().optional(),
      items: z.array(z.object({
        pastryId: z.number(),
        quantity: z.number().positive(),
        price: z.number().positive(),
      })),
      totalAmount: z.number().positive(),
      paymentMethod: z.enum(['bank_transfer', 'cheque', 'cash', 'paypal', 'cmi']),
      channel: z.enum(['online', 'on_site_qr', 'on_site_admin']).default('online'),
    }))
    .mutation(async ({ input, ctx }) => {
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
        order.qr_token = qrData.token;
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
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">Pâtisserie #${item.pastryId}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.price} MAD</td>
            </tr>`
          ).join('');

          const emailHtml = `
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
          <p style="margin:0;font-size:12px;color:#9ca3af;">4 rue Bayt Lham, quartier Palmier, Casablanca<br>Tél: +212 610 023 555 | contact@ftourbabrayan.ma</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

          await sendEmail({
            to: input.email,
            subject: `✅ Confirmation commande pâtisserie #${reference}`,
            html: emailHtml,
          });
        } catch (e) {
          console.error('Email send error:', e);
        }
      }

      return order;
    }),

  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      return supabaseServices.getPastryOrderByReferenceSupabase(input.reference);
    }),

  list: adminBoutiqueProcedure
    .input(z.object({
      status: z.string().optional(),
      paymentStatus: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return supabaseServices.getPastryOrdersSupabase({
        status: input.status,
        paymentStatus: input.paymentStatus,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      });
    }),

  updateStatus: scannerProcedure
    .input(z.object({
      orderId: z.number(),
      orderStatus: z.enum(['reserved', 'paid', 'handed', 'cancelled']),
      paymentStatus: z.enum(['pending', 'confirmed', 'paid', 'cancelled']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return supabaseServices.updatePastryOrderStatusSupabase(
        input.orderId,
        input.orderStatus,
        input.paymentStatus,
        ctx.user?.id
      );
    }),

  stats: adminBoutiqueProcedure.query(async () => {
    return supabaseServices.getPastryOrderStatsSupabase();
  }),
});

// ============================================
// QR CODES ROUTER
// ============================================

const qrRouter = router({
  generate: adminBoutiqueProcedure
    .input(z.object({
      scope: z.string(),
      entityId: z.number(),
    }))
    .mutation(async ({ input }) => {
      return supabaseServices.generateQRTokenSupabase(input.scope, input.entityId);
    }),

  validate: publicProcedure
    .input(z.object({
      token: z.string(),
      scope: z.string(),
    }))
    .query(async ({ input }) => {
      return supabaseServices.validateQRTokenSupabase(input.token, input.scope);
    }),

  scan: scannerProcedure
    .input(z.object({
      token: z.string(),
      scope: z.string(),
      entityId: z.number(),
      validationAction: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await supabaseServices.logQRScanSupabase(
        input.token,
        input.scope,
        input.entityId,
        input.validationAction,
        ctx.user?.id || 0,
        true
      );
      return { success: true };
    }),

  // --- Admin: Get QR codes for all catalog products ---
  catalogQRCodes: adminProcedure.query(async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase non configuré' });

    const baseUrl = process.env.VITE_APP_URL || 'https://ftourbabrayan.ma';

    const [goodiesRes, pastriesRes, terroirRes] = await Promise.all([
      supabase.from('goodies').select('id, name, image_url, price, category, is_active').order('sort_order', { ascending: true }),
      supabase.from('pastries').select('id, name, image_url, price, active').order('sort_order', { ascending: true }),
      supabase.from('terroir_products').select('id, name, image_url, category, is_active, terroir_product_variants(price_unit)').order('sort_order', { ascending: true }),
    ]);

    const makeQrImageUrl = (url: string) =>
      `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(url)}`;

    const items: Array<{
      id: number;
      name: string;
      imageUrl: string | null;
      price: number | null;
      category: string;
      qrUrl: string;
      qrDataUrl: string;
    }> = [];

    for (const g of goodiesRes.data || []) {
      const url = `${baseUrl}/fr/buy/goodie/${g.id}`;
      items.push({
        id: g.id,
        name: g.name,
        imageUrl: g.image_url,
        price: g.price,
        category: 'goodies',
        qrUrl: url,
        qrDataUrl: makeQrImageUrl(url),
      });
    }

    for (const p of pastriesRes.data || []) {
      const url = `${baseUrl}/fr/buy/pastry/${p.id}`;
      items.push({
        id: p.id,
        name: p.name,
        imageUrl: p.image_url,
        price: p.price,
        category: 'patisserie',
        qrUrl: url,
        qrDataUrl: makeQrImageUrl(url),
      });
    }

    for (const t of terroirRes.data || []) {
      const url = `${baseUrl}/fr/terroir`;
      const firstVariant = (t as any).terroir_product_variants?.[0];
      items.push({
        id: t.id,
        name: t.name,
        imageUrl: t.image_url,
        price: firstVariant?.price_unit ?? null,
        category: 'terroir',
        qrUrl: url,
        qrDataUrl: makeQrImageUrl(url),
      });
    }

    const donsUrl = `${baseUrl}/fr/dons`;
    items.push({
      id: 0,
      name: 'Page de dons',
      imageUrl: null,
      price: null,
      category: 'dons',
      qrUrl: donsUrl,
      qrDataUrl: makeQrImageUrl(donsUrl),
    });

    return items;
  }),
});

// Ajouter les nouveaux routers à l'appRouter existant
export const appRouterUpdated = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
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
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
  pastries: pastriesRouter,
  pastryOrders: pastryOrdersRouter,
  qr: qrRouter,
  companyBookings: companyBookingsRouter,
  restaurantReservations: restaurantReservationsRouter,
  restaurantModule: restaurantModuleRouter,
  terroirModule: terroirModuleRouter,
  content: contentRouter,
  scanner: scannerRouter,
});

export type AppRouter = typeof appRouterUpdated;
