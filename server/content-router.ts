import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import * as supabaseServices from './supabase-services';

// Re-use admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès administrateur requis' });
  }
  return next({ ctx });
});

export const contentRouter = router({
  // ============ PARTNERS ============
  partners: router({
    list: adminProcedure.query(async () => {
      return supabaseServices.getAllPartnersAdminSupabase();
    }),
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        logoUrl: z.string().optional(),
        websiteUrl: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return supabaseServices.createPartnerSupabase(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        logoUrl: z.string().optional(),
        websiteUrl: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseServices.updatePartnerSupabase(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return supabaseServices.deletePartnerSupabase(input.id);
      }),
  }),

  // ============ TESTIMONIALS ============
  testimonials: router({
    list: adminProcedure.query(async () => {
      return supabaseServices.getAllTestimonialsAdminSupabase();
    }),
    create: adminProcedure
      .input(z.object({
        content: z.string().min(1),
        authorName: z.string().min(1),
        authorRole: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
      }))
      .mutation(async ({ input }) => {
        return supabaseServices.createTestimonialSupabase(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().optional(),
        authorName: z.string().optional(),
        authorRole: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseServices.updateTestimonialSupabase(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return supabaseServices.deleteTestimonialSupabase(input.id);
      }),
  }),

  // ============ FAQ ============
  faq: router({
    list: adminProcedure.query(async () => {
      return supabaseServices.getAllFaqsAdminSupabase();
    }),
    listPublic: publicProcedure.query(async () => {
      return supabaseServices.getAllFaqsPublicSupabase();
    }),
    create: adminProcedure
      .input(z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        category: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        return supabaseServices.createFaqSupabase(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        question: z.string().optional(),
        answer: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseServices.updateFaqSupabase(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return supabaseServices.deleteFaqSupabase(input.id);
      }),
  }),
});
