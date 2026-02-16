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



type WorkerQrType = 'volunteer' | 'reservation_particulier' | 'reservation_entreprise' | 'reservation_groupe' | 'unknown';

function extractTokenFromUrl(rawInput: string): string {
  try {
    if (rawInput.includes('/checkin-reservation/')) {
      const parts = rawInput.split('/checkin-reservation/');
      return parts[parts.length - 1].split('?')[0];
    }
    if (rawInput.includes('/checkin/')) {
      const parts = rawInput.split('/checkin/');
      return parts[parts.length - 1].split('?')[0];
    }
    return rawInput.trim();
  } catch {
    return rawInput.trim();
  }
}

function detectWorkerQrType(token: string): WorkerQrType {
  if (token.startsWith('rp-')) return 'reservation_particulier';
  if (token.startsWith('re-')) return 'reservation_entreprise';
  if (token.startsWith('rg-')) return 'reservation_groupe';
  if (/^[a-f0-9]{32,}$/i.test(token)) return 'volunteer';
  return 'unknown';
}

const scannerRouter = router({
  identify: scannerProcedure
    .input(z.object({ rawCode: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const token = extractTokenFromUrl(input.rawCode);
      let type = detectWorkerQrType(token);

      if (type === 'volunteer' || type === 'unknown') {
        const { data: volunteer } = await supabase
          .from('volunteers')
          .select('id, first_name, last_name, email, phone, status, qr_status, scanned_at')
          .eq('qr_token', token)
          .single();

        if (volunteer) {
          return {
            type: 'volunteer' as const,
            typeLabel: 'Bénévole',
            token,
            found: true,
            entity: {
              id: volunteer.id,
              name: `${volunteer.first_name} ${volunteer.last_name}`,
              email: volunteer.email,
              phone: volunteer.phone,
              status: volunteer.status,
              qrStatus: volunteer.qr_status,
              alreadyValidated: volunteer.qr_status === 'validated',
              scannedAt: volunteer.scanned_at,
            },
          };
        }
      }

      if (type.startsWith('reservation_') || type === 'unknown') {
        const { data: reservation } = await supabase
          .from('restaurant_reservations')
          .select('id, name, email, phone, status, seats, date, reference, qr_token')
          .eq('qr_token', token)
          .single();

        if (reservation) {
          if (type === 'unknown') type = 'reservation_particulier';
          return {
            type,
            typeLabel: 'Réservation',
            token,
            found: true,
            entity: {
              id: reservation.id,
              name: reservation.name,
              email: reservation.email,
              phone: reservation.phone,
              status: reservation.status,
              guests: reservation.seats,
              date: reservation.date,
              reference: reservation.reference,
              qrStatus: reservation.status,
              alreadyValidated: reservation.status === 'checked_in',
            },
          };
        }
      }

      return { type: 'unknown' as const, typeLabel: 'Inconnu', token, found: false, error: 'QR code non reconnu dans le système' };
    }),

  validate: scannerProcedure
    .input(z.object({
      token: z.string().min(1),
      type: z.enum(['volunteer', 'reservation_particulier', 'reservation_entreprise', 'reservation_groupe', 'pastry', 'terroir', 'goodies', 'unknown']),
      entityId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      if (input.type === 'volunteer') {
        const { data: volunteer } = await supabase
          .from('volunteers')
          .select('id, first_name, last_name, qr_status')
          .eq('id', input.entityId)
          .single();

        if (!volunteer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bénévole introuvable' });
        if (volunteer.qr_status === 'validated') {
          return { success: true, message: `Déjà confirmé — ${volunteer.first_name} ${volunteer.last_name}`, state: 'already_confirmed' as const };
        }

        await supabase.from('volunteers').update({
          qr_status: 'validated',
          status: 'confirmed',
          scanned_at: new Date().toISOString(),
          scanned_by: ctx.user?.id,
        }).eq('id', input.entityId);

        return { success: true, message: `Bénévole confirmé — ${volunteer.first_name} ${volunteer.last_name}`, state: 'confirmed' as const };
      }

      if (input.type.startsWith('reservation_')) {
        const { data: reservation } = await supabase
          .from('restaurant_reservations')
          .select('id, status')
          .eq('id', input.entityId)
          .single();

        if (!reservation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation introuvable' });
        if (reservation.status === 'checked_in') {
          return { success: true, message: 'Réservation déjà validée', state: 'already_confirmed' as const };
        }

        await supabase.from('restaurant_reservations').update({ status: 'checked_in' }).eq('id', input.entityId);
        await supabase.from('reservation_checkins').insert({
          reservation_id: input.entityId,
          validation_mode: 'scan',
          validated_by: ctx.user?.email || ctx.user?.name || 'Scanner',
        });

        return { success: true, message: 'Check-in réservation validé !', state: 'confirmed' as const };
      }

      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Type de QR non supporté pour la validation' });
    }),

  sendAccessEmail: adminProcedure
    .input(z.object({
      to: z.string().email(),
      scannerEmail: z.string().email().default('scaner@ftourbabrayan.ma'),
      scannerPassword: z.string().default('WERISETOGETHER'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sendEmail } = await import('./email');
      const SCANNER_URL = 'https://ftourbabrayan.ma/scanner';
      const LOGIN_URL = 'https://ftourbabrayan.ma/fr/connexion';
      const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(SCANNER_URL)}`;

      const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#166534 0%,#15803d 50%,#166534 100%);padding:30px 20px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:28px;">Ftour <span style="color:#fbbf24;">Bab Rayan</span></h1>
      <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">Scanner Bénévoles — Accès QR Code</p>
    </div>
    <div style="padding:30px 25px;">
      <h2 style="color:#166534;margin:0 0 15px;font-size:22px;">Accès au Scanner Bénévoles</h2>
      <p style="color:#374151;line-height:1.6;margin:0 0 20px;">Bonjour,<br><br>Voici votre QR code d'accès au <strong>Scanner Unifié</strong> de Ftour Bab Rayan.</p>
      <div style="text-align:center;margin:30px 0;padding:25px;background:#f0fdf4;border-radius:12px;border:2px solid #bbf7d0;">
        <p style="color:#166534;font-weight:bold;margin:0 0 15px;font-size:16px;">Scannez ce QR code</p>
        <img src="${QR_CODE_URL}" alt="QR Code Scanner" width="250" height="250" style="border-radius:8px;border:3px solid #166534;" />
        <p style="color:#6b7280;margin:15px 0 0;font-size:13px;">Lien : <a href="${SCANNER_URL}" style="color:#166534;">${SCANNER_URL}</a></p>
      </div>
      <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:20px;margin:25px 0;">
        <h3 style="color:#92400e;margin:0 0 15px;font-size:18px;">Identifiants de connexion</h3>
        <p style="margin:8px 0;text-align:center;"><a href="${LOGIN_URL}" style="color:#166534;font-weight:bold;">${LOGIN_URL}</a></p>
        <table style="width:100%;border-collapse:collapse;margin-top:15px;">
          <tr><td style="padding:10px 15px;background:#fef3c7;font-weight:bold;color:#92400e;">Email</td><td style="padding:10px 15px;background:#fefce8;font-family:monospace;">${input.scannerEmail}</td></tr>
          <tr><td style="padding:10px 15px;background:#fef3c7;font-weight:bold;color:#92400e;">Mot de passe</td><td style="padding:10px 15px;background:#fefce8;font-family:monospace;">${input.scannerPassword}</td></tr>
        </table>
        <p style="color:#92400e;margin:12px 0 0;font-size:12px;">Role : <strong>Scanner</strong></p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Association Bab Rayan — Ftour Solidaire</p>
    </div>
  </div>
</body>
</html>`;

      const result = await sendEmail({
        to: input.to,
        subject: 'Accès Scanner Bénévoles — QR Code & Identifiants',
        html,
        apiKey: ctx.env.RESEND_API_KEY,
      });

      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Erreur envoi email' });
      }

      return { success: true, message: `Email envoyé à ${input.to}`, emailId: result.id };
    }),
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

/**
 * Normalize volunteer_slots from Supabase - handles both string and array formats
 */
function normalizeVolunteerSlots(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
    } catch {
      // not JSON, return empty
    }
  }
  return [];
}

const volunteersRouter = router({
  register: publicProcedure
    .input(z.object({
      firstName: z.string().min(2),
      lastName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(8),
      city: z.string().optional(),
      dayId: z.number(),
      volunteerSlots: z.array(z.enum(["preparation_ftour", "service_ftour"])).min(1, "Veuillez sélectionner au moins un créneau").optional(),
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
          volunteer_slots: input.volunteerSlots || [],
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

      // Send confirmation email
      try {
        const { sendEmail, generateVolunteerConfirmationEmail } = await import('./email');
        const emailData = generateVolunteerConfirmationEmail({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          dayNumber: day.day_number,
          dayDate: new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          location: day.location || 'Association Bab Rayan, Casablanca',
          startTime: day.iftar_time || '18h00',
          volunteerSlots: input.volunteerSlots,
          qrToken: qrToken,
          baseUrl: 'https://www.ftourbabrayan.ma',
        });

        const emailResult = await sendEmail({
          to: input.email,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY,
        });

        if (emailResult.success) {
          await supabase
            .from('volunteers')
            .update({ email_sent: true })
            .eq('id', volunteer.id);
        }
      } catch (emailError) {
        console.error('[Worker] Error sending email:', emailError);
        // Don't throw - registration is still successful
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
        return { volunteers: [], days: [] };
      }

      // Get all days for the dropdown
      const { data: daysData } = await supabase
        .from('ramadan_days')
        .select('*')
        .order('day_number', { ascending: true });

      const volunteers = (data || []).map(v => ({
        id: v.id,
        firstName: v.first_name,
        lastName: v.last_name,
        email: v.email,
        phone: v.phone,
        city: v.city,
        dayId: v.day_id,
        volunteerSlots: normalizeVolunteerSlots(v.volunteer_slots),
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

      const days = (daysData || []).map(d => ({
        id: d.id,
        dayNumber: d.day_number,
        date: d.date,
      }));

      return { volunteers, days };
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

  // Check-in d'un bénévole via QR code
  checkIn: scannerProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get volunteer by QR token
      const { data: volunteer, error } = await supabase
        .from('volunteers')
        .select('*, ramadan_days(*)')
        .eq('qr_token', input.qrCode)
        .single();

      if (error || !volunteer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code invalide' });
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
          day_id: volunteer.day_id,
          scanned_by: ctx.user?.id,
          scan_method: 'qr_code',
          is_valid: true,
        });

      return {
        success: true,
        volunteer: {
          id: volunteer.id,
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
          dayNumber: volunteer.ramadan_days?.day_number,
        },
      };
    }),

  // Mise à jour du statut d'un bénévole
  updateStatus: adminProcedure
    .input(z.object({
      volunteerId: z.number(),
      status: z.enum(['registered', 'confirmed', 'present', 'absent', 'cancelled']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('volunteers')
        .update({ status: input.status })
        .eq('id', input.volunteerId);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  // Suppression d'un bénévole
  delete: adminProcedure
    .input(z.object({ volunteerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Delete volunteer
      const { error } = await supabase
        .from('volunteers')
        .delete()
        .eq('id', input.volunteerId);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  // Inscription groupe bénévole avec fichier Excel
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

      const supabase = createSupabaseAdmin(ctx.env);

      // Get day info for the email
      const { data: day } = await supabase
        .from('ramadan_days')
        .select('*')
        .eq('id', input.dayId)
        .single();

      // Generate QR token for the group entry
      const qrToken = crypto.randomUUID();

      // Create a volunteer entry for the group (so it appears in the dashboard)
      const { data: volunteer, error: volError } = await supabase
        .from('volunteers')
        .insert({
          first_name: `[Groupe] ${input.groupName}`,
          last_name: input.responsibleName,
          email: input.responsibleEmail,
          phone: input.responsiblePhone,
          day_id: input.dayId,
          volunteer_slots: input.volunteerSlots,
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

      // Build and send email with attachment to admin
      const { sendEmail, generateGroupRegistrationEmail } = await import('./email');
      const emailData = generateGroupRegistrationEmail({
        groupName: input.groupName,
        responsibleName: input.responsibleName,
        responsibleEmail: input.responsibleEmail,
        responsiblePhone: input.responsiblePhone,
        estimatedSize: input.estimatedSize,
        volunteerSlots: input.volunteerSlots,
        dayNumber: day?.day_number,
        dayDate: day?.date ? new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : undefined,
        fileName: input.fileName,
      });

      try {
        await sendEmail({
          to: 'admin@ftourbabrayan.ma',
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY,
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
      price: z.number().min(0),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from('goodies')
        .insert({
          name: input.name,
          description: input.description,
          price: String(input.price),
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
      price: z.number().min(0).optional(),
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
      if (updateData.price !== undefined) dbData.price = String(updateData.price);
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

      // Get goodie names for email
      const itemsForEmail: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }> = [];
      for (const item of input.items) {
        const { data: goodie } = await supabase
          .from('goodies')
          .select('name, price')
          .eq('id', item.goodieId)
          .single();
        if (goodie) {
          const unitPrice = parseFloat(goodie.price);
          itemsForEmail.push({
            name: goodie.name,
            quantity: item.quantity,
            unitPrice,
            totalPrice: unitPrice * item.quantity,
          });
        }
      }

      // Send confirmation email
      try {
        const { sendEmail, generateOrderConfirmationEmail } = await import('./email');
        const emailData = generateOrderConfirmationEmail({
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          orderReference: orderRef,
          items: itemsForEmail,
          totalAmount,
          pickupLocation: input.pickupLocation,
          pickupDate: input.pickupDate,
        });

        await sendEmail({
          to: input.customerEmail,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY,
        });
      } catch (emailError) {
        console.error('[Worker] Error sending order email:', emailError);
        // Don't throw - order is still successful
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
      amount: z.union([z.number(), z.string()]).transform((val) => typeof val === 'number' ? String(val) : val),
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

      // Send confirmation email
      try {
        const { sendEmail, generateDonationConfirmationEmail } = await import('./email');
        const emailData = generateDonationConfirmationEmail({
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donationReference: donationRef,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          message: input.message,
        });

        await sendEmail({
          to: input.donorEmail,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY,
        });
      } catch (emailError) {
        console.error('[Worker] Error sending donation email:', emailError);
        // Don't throw - donation is still successful
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

      // Send confirmation email to user and notification to admin
      try {
        const { sendEmail, generateContactConfirmationEmail, generateContactAdminNotificationEmail } = await import('./email');
        
        // Send confirmation to user
        const userEmailData = generateContactConfirmationEmail({
          name: input.name,
          email: input.email,
          phone: input.phone,
          subject: input.subject || 'Contact',
          message: input.message,
        });

        await sendEmail({
          to: input.email,
          subject: userEmailData.subject,
          html: userEmailData.html,
          apiKey: ctx.env.RESEND_API_KEY,
        });

        // Send notification to admin
        const adminEmailData = generateContactAdminNotificationEmail({
          name: input.name,
          email: input.email,
          phone: input.phone,
          subject: input.subject || 'Contact',
          message: input.message,
        });

        await sendEmail({
          to: 'contact@ftourbabrayan.ma',
          subject: adminEmailData.subject,
          html: adminEmailData.html,
          apiKey: ctx.env.RESEND_API_KEY,
        });
      } catch (emailError) {
        console.error('[Worker] Error sending contact email:', emailError);
        // Don't throw - contact message is still saved
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
// UPLOAD ROUTER
// ============================================

const uploadRouter = router({
  // Upload image to Supabase Storage
  image: adminProcedure
    .input(z.object({
      fileName: z.string(),
      fileType: z.string(),
      fileData: z.string(), // Base64 encoded
      folder: z.string().default('goodies'),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(input.fileType)) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Type de fichier non autorisé. Utilisez PNG, JPEG ou WebP.' 
        });
      }

      // Decode base64
      const base64Data = input.fileData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Generate unique filename
      const ext = input.fileName.split('.').pop() || 'png';
      const uniqueName = `${input.folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('images')
        .upload(uniqueName, buffer, {
          contentType: input.fileType,
          upsert: false,
        });

      if (error) {
        console.error('[Worker] Upload error:', error);
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Erreur lors du téléchargement: ' + error.message 
        });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(uniqueName);

      return {
        url: urlData.publicUrl,
        path: uniqueName,
      };
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
// RESTAURANTS ROUTER
// ============================================

const restaurantsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      capacity: r.capacity,
      active: r.active,
      createdAt: r.created_at,
    }));
  }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      capacity: r.capacity,
      active: r.active,
      createdAt: r.created_at,
    }));
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      address: z.string().min(5),
      phone: z.string().optional(),
      capacity: z.number().min(1).default(50),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: input.name,
          address: input.address,
          phone: input.phone,
          capacity: input.capacity,
          active: input.active,
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
      address: z.string().min(5).optional(),
      phone: z.string().optional(),
      capacity: z.number().min(1).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, ...updateData } = input;

      const { error } = await supabase
        .from('restaurants')
        .update(updateData)
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
        .from('restaurants')
        .delete()
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  getAvailability: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get restaurant capacity
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('capacity')
        .eq('id', input.restaurantId)
        .single();

      if (!restaurant) {
        return { available: 0, total: 0 };
      }

      // Get total reserved seats for this date
      const { data: reservations } = await supabase
        .from('reservations')
        .select('seats')
        .eq('restaurant_id', input.restaurantId)
        .eq('date', input.date)
        .in('status', ['pending', 'confirmed']);

      const reserved = (reservations || []).reduce((sum, r) => sum + r.seats, 0);

      return {
        available: Math.max(0, restaurant.capacity - reserved),
        total: restaurant.capacity,
        reserved,
      };
    }),
});

// ============================================
// RESERVATIONS ROUTER
// ============================================

const reservationsRouter = router({
  create: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
      slotId: z.number().optional(),
      fullName: z.string().min(2),
      phone: z.string().min(8),
      email: z.string().email().optional(),
      seats: z.number().min(1).max(10),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Check availability
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('capacity, name, address')
        .eq('id', input.restaurantId)
        .single();

      if (!restaurant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Restaurant non trouvé' });
      }

      // Get current reservations
      const { data: existingReservations } = await supabase
        .from('reservations')
        .select('seats')
        .eq('restaurant_id', input.restaurantId)
        .eq('date', input.date)
        .in('status', ['pending', 'confirmed']);

      const totalReserved = (existingReservations || []).reduce((sum, r) => sum + r.seats, 0);
      const available = restaurant.capacity - totalReserved;

      if (input.seats > available) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Seulement ${available} places disponibles pour cette date` 
        });
      }

      // Generate reference code and QR token
      const referenceCode = `RES-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const qrToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Create reservation
      const { data, error } = await supabase
        .from('reservations')
        .insert({
          restaurant_id: input.restaurantId,
          date: input.date,
          slot_id: input.slotId,
          full_name: input.fullName,
          phone: input.phone,
          email: input.email,
          seats: input.seats,
          notes: input.notes,
          status: 'confirmed',
          reference_code: referenceCode,
          qr_token: qrToken,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      // Send confirmation emails
      if (input.email) {
        try {
          const { sendEmail, generateReservationConfirmationEmail, generateReservationAdminNotificationEmail } = await import('./email');
          
          const emailData = {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            referenceCode,
            restaurantName: restaurant.name,
            restaurantAddress: restaurant.address,
            date: input.date,
            seats: input.seats,
            qrToken,
            baseUrl: 'https://ftourbabrayan.ma',
          };

          // Send to customer
          const customerEmail = generateReservationConfirmationEmail(emailData);
          await sendEmail({
            to: input.email,
            subject: customerEmail.subject,
            html: customerEmail.html,
            apiKey: ctx.env.RESEND_API_KEY,
          });

          // Send to admin
          const adminEmail = generateReservationAdminNotificationEmail(emailData);
          await sendEmail({
            to: 'contact@ftourbabrayan.ma',
            subject: adminEmail.subject,
            html: adminEmail.html,
            apiKey: ctx.env.RESEND_API_KEY,
          });
        } catch (emailError) {
          console.error('[Worker] Error sending reservation email:', emailError);
        }
      }

      return { 
        id: data.id, 
        referenceCode,
        qrToken,
      };
    }),

  list: adminProcedure
    .input(z.object({
      date: z.string().optional(),
      restaurantId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      let query = supabase
        .from('reservations')
        .select('*, restaurants(name, address)')
        .order('created_at', { ascending: false });

      if (input?.date) {
        query = query.eq('date', input.date);
      }
      if (input?.restaurantId) {
        query = query.eq('restaurant_id', input.restaurantId);
      }
      if (input?.status) {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;

      if (error) {
        return [];
      }

      return (data || []).map(r => ({
        id: r.id,
        restaurantId: r.restaurant_id,
        restaurantName: r.restaurants?.name,
        restaurantAddress: r.restaurants?.address,
        date: r.date,
        slotId: r.slot_id,
        fullName: r.full_name,
        phone: r.phone,
        email: r.email,
        seats: r.seats,
        notes: r.notes,
        status: r.status,
        referenceCode: r.reference_code,
        qrToken: r.qr_token,
        createdAt: r.created_at,
      }));
    }),

  updateStatus: adminProcedure
    .input(z.object({
      reservationId: z.number(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'checked_in']),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from('reservations')
        .update({ status: input.status })
        .eq('id', input.reservationId);

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
      }

      return { success: true };
    }),

  checkin: scannerProcedure
    .input(z.object({
      qrToken: z.string().optional(),
      referenceCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Find reservation
      let query = supabase.from('reservations').select('*, restaurants(name)');
      
      if (input.qrToken) {
        query = query.eq('qr_token', input.qrToken);
      } else if (input.referenceCode) {
        query = query.eq('reference_code', input.referenceCode);
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'QR token ou référence requis' });
      }

      const { data: reservation, error } = await query.single();

      if (error || !reservation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      }

      if (reservation.status === 'checked_in') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Réservation déjà validée' });
      }

      if (reservation.status === 'cancelled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Réservation annulée' });
      }

      // Check date
      const today = new Date().toISOString().split('T')[0];
      if (reservation.date !== today) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cette réservation n\'est pas pour aujourd\'hui' });
      }

      // Update status
      await supabase
        .from('reservations')
        .update({ status: 'checked_in' })
        .eq('id', reservation.id);

      // Create checkin record
      await supabase
        .from('reservation_checkins')
        .insert({
          reservation_id: reservation.id,
          scanned_at: new Date().toISOString(),
          validation_mode: input.qrToken ? 'qr_scan' : 'manual',
          validated_by: ctx.user?.id,
        });

      return {
        success: true,
        reservation: {
          id: reservation.id,
          fullName: reservation.full_name,
          seats: reservation.seats,
          restaurantName: reservation.restaurants?.name,
        },
      };
    }),

  getAvailableSeats: publicProcedure
    .input(z.object({
      restaurantId: z.number(),
      date: z.string(),
      slotId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get restaurant capacity
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('capacity')
        .eq('id', input.restaurantId)
        .single();

      if (!restaurant) {
        return { available: 0, total: 0 };
      }

      // Get current reservations for this date
      const { data: existingReservations } = await supabase
        .from('reservations')
        .select('seats')
        .eq('restaurant_id', input.restaurantId)
        .eq('date', input.date)
        .in('status', ['pending', 'confirmed']);

      const totalReserved = (existingReservations || []).reduce((sum, r) => sum + r.seats, 0);
      const available = restaurant.capacity - totalReserved;

      return {
        available: Math.max(0, available),
        total: restaurant.capacity,
        reserved: totalReserved,
      };
    }),

  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*, restaurants(name, address)')
        .eq('qr_token', input.token)
        .single();

      if (error || !reservation) {
        return { valid: false, error: 'Réservation non trouvée' };
      }

      if (reservation.status === 'checked_in') {
        return { valid: false, error: 'Réservation déjà validée', reservation };
      }

      if (reservation.status === 'cancelled') {
        return { valid: false, error: 'Réservation annulée' };
      }

      return {
        valid: true,
        reservation: {
          id: reservation.id,
          fullName: reservation.full_name,
          phone: reservation.phone,
          email: reservation.email,
          seats: reservation.seats,
          date: reservation.date,
          status: reservation.status,
          referenceCode: reservation.reference_code,
          restaurantName: reservation.restaurants?.name,
          restaurantAddress: reservation.restaurants?.address,
        },
      };
    }),

  getStats: adminProcedure
    .input(z.object({
      date: z.string().optional(),
      restaurantId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      let query = supabase.from('reservations').select('seats, status');

      if (input?.date) {
        query = query.eq('date', input.date);
      }
      if (input?.restaurantId) {
        query = query.eq('restaurant_id', input.restaurantId);
      }

      const { data } = await query;

      const stats = {
        total: 0,
        confirmed: 0,
        checkedIn: 0,
        cancelled: 0,
        noShow: 0,
        totalSeats: 0,
        confirmedSeats: 0,
        checkedInSeats: 0,
      };

      for (const r of data || []) {
        stats.total++;
        stats.totalSeats += r.seats;
        
        if (r.status === 'confirmed') {
          stats.confirmed++;
          stats.confirmedSeats += r.seats;
        } else if (r.status === 'checked_in') {
          stats.checkedIn++;
          stats.checkedInSeats += r.seats;
        } else if (r.status === 'cancelled') {
          stats.cancelled++;
        } else if (r.status === 'no_show') {
          stats.noShow++;
        }
      }

      return stats;
    }),
});

// ============================================
// RESTAURANT RESERVATIONS ROUTER (unified)
// ============================================

function generateReservationReference(type: 'particulier' | 'entreprise' | 'groupe'): string {
  const typeCode = type === 'particulier' ? 'P' : type === 'entreprise' ? 'E' : 'G';
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `RES-${typeCode}-${randomPart}`;
}

function generateQrToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
}

const restaurantReservationsRouter = router({
  particulier: router({
    create: publicProcedure
      .input(z.object({
        firstName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        participantsCount: z.number().int().min(1).max(12),
      }))
      .mutation(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const reference = generateReservationReference('particulier');
        const qrToken = generateQrToken();
        const { data, error } = await supabase.from('restaurant_reservations').insert({
          reference,
          type: 'particulier',
          seats_total: input.participantsCount,
          date: input.date,
          name: input.firstName,
          phone: input.phone,
          email: input.email,
          status: 'submitted',
          payment_status: 'not_applicable',
          qr_token: qrToken,
          qr_status: 'inactive',
        }).select().single();
        if (error) {
          console.error('[RestaurantReservations] Particulier create error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        // Send confirmation email to customer + internal notification
        try {
          const { sendEmail } = await import('./email');
          await sendEmail({
            to: input.email,
            subject: `Demande de reservation recue - ${reference}`,
            html: `<h2 style="color:#5d5a3c;">Demande de réservation reçue</h2><p>Bonjour <strong>${input.firstName}</strong>,</p><p>Votre demande de réservation pour le ftour solidaire a bien été enregistrée.</p><p><strong>Date :</strong> ${input.date}</p><p><strong>Participants :</strong> ${input.participantsCount}</p><p><strong>Référence :</strong> ${reference}</p><p>Nous vous confirmerons les disponibilités sous 48 heures.</p><p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>`,
            apiKey: ctx.env.RESEND_API_KEY,
            cc: ['heartfulness@myspace.boats'],
          });
          await sendEmail({
            to: 'digital@myspace.boats',
            subject: `Nouvelle reservation Particulier - ${input.date} - ${reference}`,
            html: `<h2>Nouvelle réservation Particulier</h2><p><strong>Nom:</strong> ${input.firstName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Tél:</strong> ${input.phone}</p><p><strong>Date:</strong> ${input.date}</p><p><strong>Participants:</strong> ${input.participantsCount}</p><p><strong>Référence:</strong> ${reference}</p>`,
            apiKey: ctx.env.RESEND_API_KEY,
          });
        } catch (emailErr) {
          console.error('[RestaurantReservations] Email error (reservation created OK):', emailErr);
        }
        return { success: true, reservation: data, message: 'Demande reçue. Vérifiez votre email.' };
      }),
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const { data } = await supabase.from('restaurant_reservations').select('*').eq('reference', input.reference).single();
        return data;
      }),
  }),

  entreprise: router({
    create: publicProcedure
      .input(z.object({
        companyName: z.string().min(1),
        contactName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        companyICE: z.string().optional(),
        companyNotes: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        participantsCount: z.number().int().min(10).max(120),
      }))
      .mutation(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const reference = generateReservationReference('entreprise');
        const qrToken = generateQrToken();
        const { data, error } = await supabase.from('restaurant_reservations').insert({
          reference,
          type: 'entreprise',
          seats_total: input.participantsCount,
          date: input.date,
          name: input.contactName,
          phone: input.phone,
          email: input.email,
          company_name: input.companyName,
          notes: input.companyNotes || null,
          status: 'submitted',
          payment_status: 'not_applicable',
          qr_token: qrToken,
          qr_status: 'inactive',
        }).select().single();
        if (error) {
          console.error('[RestaurantReservations] Entreprise create error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        try {
          const { sendEmail } = await import('./email');
          await sendEmail({
            to: input.email,
            subject: `Demande de reservation entreprise recue - ${reference}`,
            html: `<h2 style="color:#5d5a3c;">Demande de réservation entreprise reçue</h2><p>Bonjour <strong>${input.contactName}</strong>,</p><p>Nous avons bien reçu la demande de réservation de <strong>${input.companyName}</strong> pour le ftour solidaire.</p><p><strong>Date souhaitée :</strong> ${input.date}</p><p><strong>Nombre de participants :</strong> ${input.participantsCount}</p><p>Notre équipe reviendra vers vous sous 48 heures.</p><p><strong>Référence :</strong> ${reference}</p><p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>`,
            apiKey: ctx.env.RESEND_API_KEY,
            cc: ['heartfulness@myspace.boats'],
          });
          await sendEmail({
            to: 'digital@myspace.boats',
            subject: `Nouvelle demande Entreprise - ${input.date} - ${reference}`,
            html: `<h2>Nouvelle demande Entreprise</h2><p><strong>Entreprise:</strong> ${input.companyName}</p><p><strong>Contact:</strong> ${input.contactName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Tél:</strong> ${input.phone}</p><p><strong>Date:</strong> ${input.date}</p><p><strong>Participants:</strong> ${input.participantsCount}</p><p><strong>Référence:</strong> ${reference}</p>`,
            apiKey: ctx.env.RESEND_API_KEY,
          });
        } catch (emailErr) {
          console.error('[RestaurantReservations] Email error (reservation created OK):', emailErr);
        }
        return { success: true, reservation: data, message: 'Demande reçue. Vérifiez votre email.' };
      }),
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const { data } = await supabase.from('restaurant_reservations').select('*').eq('reference', input.reference).single();
        return data;
      }),
  }),

  groupe: router({
    create: publicProcedure
      .input(z.object({
        groupName: z.string().min(1),
        contactName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        groupType: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        participantsCount: z.number().int().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const reference = generateReservationReference('groupe');
        const qrToken = generateQrToken();
        const { data, error } = await supabase.from('restaurant_reservations').insert({
          reference,
          type: 'groupe',
          seats_total: input.participantsCount,
          date: input.date,
          name: input.contactName,
          phone: input.phone,
          email: input.email,
          group_name: input.groupName,
          group_type: input.groupType || null,
          status: 'submitted',
          payment_status: 'not_applicable',
          qr_token: qrToken,
          qr_status: 'inactive',
        }).select().single();
        if (error) {
          console.error('[RestaurantReservations] Groupe create error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
        try {
          const { sendEmail } = await import('./email');
          await sendEmail({
            to: input.email,
            subject: `Demande de reservation groupe recue - ${reference}`,
            html: `<h2 style="color:#5d5a3c;">Demande de réservation groupe reçue</h2><p>Bonjour <strong>${input.contactName}</strong>,</p><p>Votre demande de réservation groupe pour le <strong>${input.date}</strong> a bien été enregistrée.</p><p><strong>Nombre estimé de participants :</strong> ${input.participantsCount}</p><p>Nous vous confirmerons les disponibilités sous 48 heures.</p><p><strong>Référence :</strong> ${reference}</p><p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>`,
            apiKey: ctx.env.RESEND_API_KEY,
            cc: ['heartfulness@myspace.boats'],
          });
          await sendEmail({
            to: 'digital@myspace.boats',
            subject: `Nouvelle demande Groupe - ${input.date} - ${reference}`,
            html: `<h2>Nouvelle demande Groupe</h2><p><strong>Groupe:</strong> ${input.groupName}</p><p><strong>Contact:</strong> ${input.contactName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Tél:</strong> ${input.phone}</p><p><strong>Date:</strong> ${input.date}</p><p><strong>Participants:</strong> ${input.participantsCount}</p><p><strong>Référence:</strong> ${reference}</p>`,
            apiKey: ctx.env.RESEND_API_KEY,
          });
        } catch (emailErr) {
          console.error('[RestaurantReservations] Email error (reservation created OK):', emailErr);
        }
        return { success: true, reservation: data, message: 'Demande reçue. Vérifiez votre email.' };
      }),
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const { data } = await supabase.from('restaurant_reservations').select('*').eq('reference', input.reference).single();
        return data;
      }),
  }),

  validate: protectedProcedure
    .input(z.object({ reference: z.string(), baseUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: reservation } = await supabase.from('restaurant_reservations').select('*').eq('reference', input.reference).single();
      if (!reservation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      await supabase.from('restaurant_reservations').update({
        status: 'pending_confirmation',
        payment_status: 'pending',
      }).eq('id', reservation.id);
      try {
        const { sendEmail } = await import('./email');
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(input.baseUrl + '/checkin-reservation/' + reservation.qr_token)}`;
        await sendEmail({
          to: reservation.email,
          subject: `Reservation validee - ${reservation.reference}`,
          html: `<h2 style="color:#166534;">Réservation validée !</h2><p>Bonjour <strong>${reservation.name}</strong>,</p><p>Votre réservation <strong>${reservation.reference}</strong> a été validée.</p><p>Veuillez procéder au paiement pour confirmer définitivement votre place.</p><p><img src="${qrCodeUrl}" alt="QR Code" style="width:200px;height:200px;"/></p><p>À très bientôt,<br><strong>L'équipe Ftour Bab Rayan</strong></p>`,
          apiKey: ctx.env.RESEND_API_KEY,
          cc: ['heartfulness@myspace.boats'],
        });
      } catch (emailErr) {
        console.error('[RestaurantReservations] Validate email error:', emailErr);
      }
      return { success: true, message: 'Réservation validée. Email envoyé.' };
    }),

  refuse: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ['admin', 'super_admin', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes'];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée' });
      }
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: reservation } = await supabase.from('restaurant_reservations').select('*').eq('reference', input.reference).single();
      if (!reservation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Réservation non trouvée' });
      await supabase.from('restaurant_reservations').update({
        status: 'rejected',
      }).eq('id', reservation.id);
      try {
        const { sendEmail } = await import('./email');
        await sendEmail({
          to: reservation.email,
          subject: `Reservation refusee - ${reservation.reference}`,
          html: `<h2 style="color:#dc2626;">Réservation refusée</h2><p>Bonjour <strong>${reservation.name}</strong>,</p><p>Nous sommes désolés, votre réservation <strong>${reservation.reference}</strong> n'a pas pu être acceptée.</p><p>N'hésitez pas à nous contacter pour plus d'informations.</p><p>Cordialement,<br><strong>L'équipe Ftour Bab Rayan</strong></p>`,
          apiKey: ctx.env.RESEND_API_KEY,
          cc: ['heartfulness@myspace.boats'],
        });
      } catch (emailErr) {
        console.error('[RestaurantReservations] Refuse email error:', emailErr);
      }
      return { success: true, message: 'Réservation refusée. Email envoyé.' };
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
  upload: uploadRouter,
  restaurants: restaurantsRouter,
  reservations: reservationsRouter,
  restaurantReservations: restaurantReservationsRouter,
  scanner: scannerRouter,
});

export type AppRouter = typeof appRouter;
