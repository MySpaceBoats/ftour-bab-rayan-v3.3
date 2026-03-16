/**
 * Module Event Photos – Ramadan Closing Page Slider
 * Gestion des photos de l'événement pour le slider de la page de clôture
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
// EVENT PHOTOS ROUTER
// ============================================

export const eventPhotosRouter = router({
  // ---- PUBLIC: fetch active photos ordered by display_order ----
  listPublic: publicProcedure.query(async () => {
    return supabaseServices.listEventPhotosPublicSupabase();
  }),

  // ---- ADMIN: fetch all photos ----
  list: adminProcedure.query(async () => {
    return supabaseServices.listEventPhotosAdminSupabase();
  }),

  // ---- ADMIN: upload and create photo ----
  create: adminProcedure
    .input(
      z.object({
        imageBase64: z.string().optional(),
        imageUrl: z.string().url().optional(),
        title: z.string().max(255).optional(),
        displayOrder: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ input }) => {
      let imageUrl = input.imageUrl;

      if (input.imageBase64) {
        const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const contentType = input.imageBase64.startsWith('data:image/png')
          ? 'image/png'
          : input.imageBase64.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg';
        const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
        const key = `event-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const buffer = Buffer.from(base64Data, 'base64');
        const { url } = await storagePut(key, buffer, contentType);
        imageUrl = url;
      }

      if (!imageUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "URL ou image base64 requise" });
      }

      return supabaseServices.createEventPhotoSupabase({
        imageUrl,
        title: input.title,
        displayOrder: input.displayOrder,
      });
    }),

  // ---- ADMIN: update title, active status, or order ----
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        title: z.string().max(255).optional(),
        isActive: z.boolean().optional(),
        displayOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      return supabaseServices.updateEventPhotoSupabase(id, rest);
    }),

  // ---- ADMIN: toggle active/inactive ----
  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      return supabaseServices.updateEventPhotoSupabase(input.id, { isActive: input.isActive });
    }),

  // ---- ADMIN: delete photo ----
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return supabaseServices.deleteEventPhotoSupabase(input.id);
    }),

  // ---- ADMIN: reorder photos ----
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number().int()) }))
    .mutation(async ({ input }) => {
      return supabaseServices.reorderEventPhotosSupabase(input.orderedIds);
    }),
});
