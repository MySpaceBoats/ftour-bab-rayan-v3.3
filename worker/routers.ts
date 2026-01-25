/**
 * tRPC Router for Cloudflare Workers
 * Adapted from server/routers.ts for Edge runtime
 */
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import type { WorkerContext, WorkerUser } from './context';
import { createSupabaseAdmin } from './supabase';

// Initialize tRPC
const t = initTRPC.context<WorkerContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authenticated user
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Non authentifié' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Admin procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_operations', 'admin_boutique', 'admin_dons'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès administrateur requis' });
  }
  return next({ ctx });
});

// Super admin procedure
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès super administrateur requis' });
  }
  return next({ ctx });
});

// Scanner procedure
const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_operations', 'scanner'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès scanner requis' });
  }
  return next({ ctx });
});

// ============================================
// AUTH ROUTER
// ============================================

const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    // Get user from context (already authenticated via token)
    return ctx.user;
  }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email ou mot de passe incorrect' });
        }
        throw new TRPCError({ code: 'UNAUTHORIZED', message: authError.message });
      }

      if (!authData.user || !authData.session) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Erreur de connexion' });
      }

      // Get user data from database
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('open_id', authData.user.id)
        .single();

      const user = userData ? {
        id: userData.open_id,
        email: userData.email,
        role: userData.role,
        name: userData.name,
        phone: userData.phone,
        createdAt: new Date(userData.created_at),
      } : {
        id: authData.user.id,
        email: input.email,
        role: 'user' as const,
        name: authData.user.user_metadata?.name,
        createdAt: new Date(),
      };

      return { user, session: authData.session.access_token };
    }),

  signup: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
      phone: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          phone: input.phone,
        },
      });

      if (authError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: authError.message });
      }

      if (!authData.user) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Erreur lors de la création du compte' });
      }

      // Create entry in users table
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          open_id: authData.user.id,
          email: input.email,
          name: input.name || null,
          phone: input.phone || null,
          role: 'user',
        });

      if (dbError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Erreur lors de la création du profil' });
      }

      return {
        user: {
          id: authData.user.id,
          email: input.email,
          role: 'user' as const,
          name: input.name,
          phone: input.phone,
          createdAt: new Date(),
        },
      };
    }),

  logout: publicProcedure.mutation(async () => {
    return { success: true };
  }),
});

// ============================================
// PUBLIC DATA ROUTER
// ============================================

const publicRouter = router({
  stats: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    // Get volunteer count
    const { count: volunteerCount } = await supabase
      .from('volunteers')
      .select('*', { count: 'exact', head: true });

    // Get donation total
    const { data: donations } = await supabase
      .from('donations')
      .select('amount')
      .eq('status', 'received');

    const totalDonations = donations?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;

    return {
      totalVolunteers: volunteerCount || 0,
      totalDonations,
      totalDays: 30,
    };
  }),

  days: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('ramadan_days')
      .select('*')
      .eq('is_open', true)
      .order('day_number', { ascending: true });

    if (error) {
      console.error('[Worker] Error fetching days:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      dayNumber: d.day_number,
      date: d.date,
      hijriDate: d.hijri_date,
      capacity: d.capacity,
      registeredCount: d.registered_count,
      isOpen: d.is_open,
      iftarTime: d.iftar_time,
      location: d.location,
      notes: d.notes,
    }));
  }),

  goodies: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('goodies')
      .select('*, goodie_variants(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[Worker] Error fetching goodies:', error);
      return [];
    }

    return (data || []).map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      price: g.price,
      imageUrl: g.image_url,
      category: g.category,
      isActive: g.is_active,
      sortOrder: g.sort_order,
      variants: (g.goodie_variants || []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        priceModifier: v.price_modifier,
        isAvailable: v.is_available,
      })),
    }));
  }),

  testimonials: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Worker] Error fetching testimonials:', error);
      return [];
    }

    return data || [];
  }),

  partners: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[Worker] Error fetching partners:', error);
      return [];
    }

    return data || [];
  }),
});

// ============================================
// DAYS ROUTER
// ============================================

const daysRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('ramadan_days')
      .select('*')
      .order('day_number', { ascending: true });

    if (error) {
      console.error('[Worker] Error fetching days:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      dayNumber: d.day_number,
      date: d.date,
      hijriDate: d.hijri_date,
      capacity: d.capacity,
      registeredCount: d.registered_count,
      isOpen: d.is_open,
      iftarTime: d.iftar_time,
      location: d.location,
      notes: d.notes,
    }));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      
      const { data, error } = await supabase
        .from('ramadan_days')
        .select('*')
        .eq('id', input.id)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        dayNumber: data.day_number,
        date: data.date,
        hijriDate: data.hijri_date,
        capacity: data.capacity,
        registeredCount: data.registered_count,
        isOpen: data.is_open,
        iftarTime: data.iftar_time,
        location: data.location,
        notes: data.notes,
      };
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
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      
      const { data, error } = await supabase
        .from('ramadan_days')
        .insert({
          day_number: input.dayNumber,
          date: input.date,
          capacity: input.capacity,
          location: input.location,
          iftar_time: input.iftarTime,
          hijri_date: input.hijriDate,
          notes: input.notes,
          is_open: true,
          registered_count: 0,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { id: data.id };
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
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, ...updateData } = input;
      
      const dbData: Record<string, any> = {};
      if (updateData.capacity !== undefined) dbData.capacity = updateData.capacity;
      if (updateData.isOpen !== undefined) dbData.is_open = updateData.isOpen;
      if (updateData.location !== undefined) dbData.location = updateData.location;
      if (updateData.iftarTime !== undefined) dbData.iftar_time = updateData.iftarTime;
      if (updateData.hijriDate !== undefined) dbData.hijri_date = updateData.hijriDate;
      if (updateData.notes !== undefined) dbData.notes = updateData.notes;

      const { error } = await supabase
        .from('ramadan_days')
        .update(dbData)
        .eq('id', id);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      
      const { error } = await supabase
        .from('ramadan_days')
        .delete()
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

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
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const startDate = new Date(input.startDate);
      const createdIds: number[] = [];

      for (let i = 0; i < input.daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const { data, error } = await supabase
          .from('ramadan_days')
          .insert({
            day_number: i + 1,
            date: date.toISOString().split('T')[0],
            capacity: input.capacity,
            location: input.location,
            iftar_time: input.iftarTime,
            is_open: true,
            registered_count: 0,
          })
          .select()
          .single();

        if (!error && data) {
          createdIds.push(data.id);
        }
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
    .mutation(async ({ input, ctx }) => {
      if (!input.acceptedTerms) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous devez accepter les conditions' });
      }

      const supabase = createSupabaseAdmin(ctx.env);

      // Check day availability
      const { data: day, error: dayError } = await supabase
        .from('ramadan_days')
        .select('*')
        .eq('id', input.dayId)
        .single();

      if (dayError || !day) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Jour non trouvé' });
      }

      if (!day.is_open || day.registered_count >= day.capacity) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce jour est complet' });
      }

      // Generate QR token
      const qrToken = crypto.randomUUID();

      // Create volunteer
      const { data: volunteer, error: volError } = await supabase
        .from('volunteers')
        .insert({
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone,
          city: input.city,
          day_id: input.dayId,
          qr_token: qrToken,
          qr_status: 'generated',
          status: 'registered',
          accepted_terms: input.acceptedTerms,
          email_sent: false,
        })
        .select()
        .single();

      if (volError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: volError.message });
      }

      // Update registered count
      await supabase
        .from('ramadan_days')
        .update({ registered_count: day.registered_count + 1 })
        .eq('id', input.dayId);

      // Close day if full
      if (day.registered_count + 1 >= day.capacity) {
        await supabase
          .from('ramadan_days')
          .update({ is_open: false })
          .eq('id', input.dayId);
      }

      return { id: volunteer.id, qrToken };
    }),

  listByDay: adminProcedure
    .input(z.object({ dayId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      
      let query = supabase
        .from('volunteers')
        .select('*, ramadan_days(*)');

      if (input.dayId) {
        query = query.eq('day_id', input.dayId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[Worker] Error fetching volunteers:', error);
        return [];
      }

      return (data || []).map(v => ({
        id: v.id,
        firstName: v.first_name,
        lastName: v.last_name,
        email: v.email,
        phone: v.phone,
        city: v.city,
        dayId: v.day_id,
        qrToken: v.qr_token,
        qrStatus: v.qr_status,
        status: v.status,
        scannedAt: v.scanned_at,
        acceptedTerms: v.accepted_terms,
        emailSent: v.email_sent,
        createdAt: v.created_at,
        day: v.ramadan_days ? {
          id: v.ramadan_days.id,
          dayNumber: v.ramadan_days.day_number,
          date: v.ramadan_days.date,
        } : null,
      }));
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { count: total } = await supabase
      .from('volunteers')
      .select('*', { count: 'exact', head: true });

    const { count: present } = await supabase
      .from('volunteers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'present');

    const { count: registered } = await supabase
      .from('volunteers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'registered');

    return {
      total: total || 0,
      present: present || 0,
      registered: registered || 0,
      absent: (total || 0) - (present || 0) - (registered || 0),
    };
  }),
});

// ============================================
// CHECKIN ROUTER
// ============================================

const checkinRouter = router({
  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: volunteer, error } = await supabase
        .from('volunteers')
        .select('*, ramadan_days(*)')
        .eq('qr_token', input.token)
        .single();

      if (error || !volunteer) {
        return { valid: false, error: 'QR code invalide' };
      }

      if (volunteer.qr_status === 'validated') {
        return { valid: false, error: 'QR code déjà utilisé', volunteer };
      }

      return {
        valid: true,
        volunteer: {
          id: volunteer.id,
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
          email: volunteer.email,
          dayNumber: volunteer.ramadan_days?.day_number,
          date: volunteer.ramadan_days?.date,
        },
      };
    }),

  validate: scannerProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get volunteer
      const { data: volunteer, error } = await supabase
        .from('volunteers')
        .select('*')
        .eq('qr_token', input.token)
        .single();

      if (error || !volunteer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bénévole non trouvé' });
      }

      if (volunteer.qr_status === 'validated') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'QR code déjà validé' });
      }

      // Update volunteer status
      await supabase
        .from('volunteers')
        .update({
          qr_status: 'validated',
          status: 'present',
          scanned_at: new Date().toISOString(),
          scanned_by: ctx.user?.id,
        })
        .eq('id', volunteer.id);

      // Create checkin record
      await supabase
        .from('checkins')
        .insert({
          volunteer_id: volunteer.id,
          token: input.token,
          scanned_at: new Date().toISOString(),
          validated_by: ctx.user?.id,
          validation_mode: 'scan',
        });

      return { success: true };
    }),
});

// ============================================
// GOODIES ROUTER
// ============================================

const goodiesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('goodies')
      .select('*, goodie_variants(*)')
      .order('sort_order', { ascending: true });

    if (error) {
      return [];
    }

    return (data || []).map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      price: g.price,
      imageUrl: g.image_url,
      category: g.category,
      isActive: g.is_active,
      sortOrder: g.sort_order,
      variants: (g.goodie_variants || []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        priceModifier: v.price_modifier,
        isAvailable: v.is_available,
      })),
    }));
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      price: z.string(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from('goodies')
        .insert({
          name: input.name,
          description: input.description,
          price: input.price,
          image_url: input.imageUrl,
          category: input.category,
          is_active: input.isActive,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { id: data.id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, ...updateData } = input;

      const dbData: Record<string, any> = {};
      if (updateData.name !== undefined) dbData.name = updateData.name;
      if (updateData.description !== undefined) dbData.description = updateData.description;
      if (updateData.price !== undefined) dbData.price = updateData.price;
      if (updateData.imageUrl !== undefined) dbData.image_url = updateData.imageUrl;
      if (updateData.category !== undefined) dbData.category = updateData.category;
      if (updateData.isActive !== undefined) dbData.is_active = updateData.isActive;
      if (updateData.sortOrder !== undefined) dbData.sort_order = updateData.sortOrder;

      const { error } = await supabase
        .from('goodies')
        .update(dbData)
        .eq('id', id);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('goodies')
        .delete()
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

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
      })),
      pickupDate: z.string().optional(),
      pickupLocation: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Generate order reference
      const orderRef = `FBR-${Date.now().toString(36).toUpperCase()}`;

      // Calculate total
      let totalAmount = 0;
      const orderItems: any[] = [];

      for (const item of input.items) {
        const { data: goodie } = await supabase
          .from('goodies')
          .select('*, goodie_variants(*)')
          .eq('id', item.goodieId)
          .single();

        if (!goodie) continue;

        let unitPrice = parseFloat(goodie.price);
        if (item.variantId) {
          const variant = goodie.goodie_variants?.find((v: any) => v.id === item.variantId);
          if (variant) {
            unitPrice += parseFloat(variant.price_modifier || '0');
          }
        }

        const itemTotal = unitPrice * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          goodie_id: item.goodieId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: unitPrice.toString(),
          total_price: itemTotal.toString(),
        });
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_reference: orderRef,
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
          total_amount: totalAmount.toString(),
          status: 'reserved',
          pickup_date: input.pickupDate,
          pickup_location: input.pickupLocation,
          notes: input.notes,
        })
        .select()
        .single();

      if (orderError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: orderError.message });
      }

      // Create order items
      for (const item of orderItems) {
        await supabase
          .from('order_items')
          .insert({ ...item, order_id: order.id });
      }

      return { id: order.id, orderReference: orderRef, totalAmount };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, goodies(*))')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(o => ({
      id: o.id,
      orderReference: o.order_reference,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone,
      totalAmount: o.total_amount,
      status: o.status,
      pickupDate: o.pickup_date,
      pickupLocation: o.pickup_location,
      notes: o.notes,
      createdAt: o.created_at,
      items: (o.order_items || []).map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.total_price,
        goodie: i.goodies ? {
          id: i.goodies.id,
          name: i.goodies.name,
        } : null,
      })),
    }));
  }),

  updateStatus: adminProcedure
    .input(z.object({
      orderId: z.number(),
      status: z.enum(['reserved', 'confirmed', 'paid', 'delivered', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('orders')
        .update({ status: input.status, processed_by: ctx.user?.id })
        .eq('id', input.orderId);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

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
      isAnonymous: z.boolean().default(false),
      acceptsUpdates: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Generate donation reference
      const donationRef = `DON-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase
        .from('donations')
        .insert({
          donation_reference: donationRef,
          donor_name: input.donorName,
          donor_email: input.donorEmail,
          donor_phone: input.donorPhone,
          amount: input.amount,
          payment_method: input.paymentMethod,
          status: input.paymentMethod === 'transfer' ? 'pending' : 'promised',
          message: input.message,
          is_anonymous: input.isAnonymous,
          accepts_updates: input.acceptsUpdates,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { id: data.id, donationReference: donationRef };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      donationReference: d.donation_reference,
      donorName: d.donor_name,
      donorEmail: d.donor_email,
      donorPhone: d.donor_phone,
      amount: d.amount,
      paymentMethod: d.payment_method,
      status: d.status,
      message: d.message,
      isAnonymous: d.is_anonymous,
      acceptsUpdates: d.accepts_updates,
      createdAt: d.created_at,
    }));
  }),

  updateStatus: adminProcedure
    .input(z.object({
      donationId: z.number(),
      status: z.enum(['promised', 'pending', 'received', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('donations')
        .update({ status: input.status, processed_by: ctx.user?.id })
        .eq('id', input.donationId);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data } = await supabase
      .from('donations')
      .select('amount, status');

    const stats = {
      total: 0,
      received: 0,
      pending: 0,
      count: data?.length || 0,
    };

    for (const d of data || []) {
      const amount = parseFloat(d.amount);
      stats.total += amount;
      if (d.status === 'received') stats.received += amount;
      if (d.status === 'pending' || d.status === 'promised') stats.pending += amount;
    }

    return stats;
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
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from('contact_messages')
        .insert({
          name: input.name,
          email: input.email,
          phone: input.phone,
          subject: input.subject,
          message: input.message,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { id: data.id };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      subject: m.subject,
      message: m.message,
      isRead: m.is_read,
      createdAt: m.created_at,
    }));
  }),

  markAsRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('contact_messages')
        .update({ is_read: true })
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),
});

// ============================================
// USERS ROUTER
// ============================================

const usersRouter = router({
  list: superAdminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(u => ({
      id: u.id,
      openId: u.open_id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.created_at,
      lastSignedIn: u.last_signed_in,
    }));
  }),

  updateRole: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['user', 'admin', 'super_admin', 'admin_operations', 'admin_boutique', 'admin_dons', 'scanner']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('users')
        .update({ role: input.role })
        .eq('id', input.userId);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),
});

// ============================================
// SYSTEM ROUTER
// ============================================

const systemRouter = router({
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
});

// ============================================
// MAIN APP ROUTER
// ============================================

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  days: daysRouter,
  volunteers: volunteersRouter,
  checkin: checkinRouter,
  goodies: goodiesRouter,
  orders: ordersRouter,
  donations: donationsRouter,
  contact: contactRouter,
  users: usersRouter,
  public: publicRouter,
});

export type AppRouter = typeof appRouter;
