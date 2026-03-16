/**
 * Module Trombinoscope – Équipe Ftour Bab Rayan
 * Gestion des membres de l'équipe par édition
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import * as supabaseServices from './supabase-services';
import { storagePut } from './storage';

// ============================================
// ADMIN GUARD
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_contenu', 'admin_ops'];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès administrateur requis' });
  }
  return next({ ctx });
});

// ============================================
// TEAM ROUTER
// ============================================

export const teamRouter = router({
  // ---- PUBLIC ----
  listPublic: publicProcedure
    .input(z.object({ edition: z.number().int().min(1).default(12) }))
    .query(async ({ input }) => {
      return supabaseServices.getTeamMembersPublicSupabase(input.edition);
    }),

  // ---- ADMIN ----
  list: adminProcedure
    .input(z.object({ edition: z.number().int().min(1).optional() }))
    .query(async ({ input }) => {
      return supabaseServices.getAllTeamMembersAdminSupabase(input.edition);
    }),

  create: adminProcedure
    .input(z.object({
      firstName: z.string().min(1, 'Prénom requis'),
      lastName: z.string().min(1, 'Nom requis'),
      role: z.string().optional(),
      citation: z.string().optional(),
      photoBase64: z.string().optional(), // base64 encoded image
      photoUrl: z.string().optional(),    // direct URL (fallback)
      displayOrder: z.number().int().min(0).default(0),
      edition: z.number().int().min(1).default(12),
    }))
    .mutation(async ({ input }) => {
      let photoUrl = input.photoUrl;

      // Upload photo if base64 provided
      if (input.photoBase64) {
        const base64Data = input.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const contentType = input.photoBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const ext = contentType === 'image/png' ? 'png' : 'jpg';
        const key = `team/edition-${input.edition}/${Date.now()}-${input.firstName.toLowerCase()}-${input.lastName.toLowerCase()}.${ext}`;
        const buffer = Buffer.from(base64Data, 'base64');
        const { url } = await storagePut(key, buffer, contentType);
        photoUrl = url;
      }

      return supabaseServices.createTeamMemberSupabase({
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        citation: input.citation,
        photoUrl,
        displayOrder: input.displayOrder,
        edition: input.edition,
      });
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      role: z.string().optional(),
      citation: z.string().optional(),
      photoBase64: z.string().optional(),
      photoUrl: z.string().optional(),
      displayOrder: z.number().int().min(0).optional(),
      edition: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, photoBase64, ...rest } = input;
      let photoUrl = rest.photoUrl;

      if (photoBase64) {
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const contentType = photoBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const ext = contentType === 'image/png' ? 'png' : 'jpg';
        const edition = rest.edition ?? 12;
        const key = `team/edition-${edition}/${Date.now()}-${id}.${ext}`;
        const buffer = Buffer.from(base64Data, 'base64');
        const { url } = await storagePut(key, buffer, contentType);
        photoUrl = url;
      }

      return supabaseServices.updateTeamMemberSupabase(id, { ...rest, photoUrl });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return supabaseServices.deleteTeamMemberSupabase(input.id);
    }),

  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number().int()) }))
    .mutation(async ({ input }) => {
      return supabaseServices.reorderTeamMembersSupabase(input.orderedIds);
    }),
});
