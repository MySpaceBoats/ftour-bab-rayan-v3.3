/**
 * Module Trombinoscope – Équipe Ftour Bab Rayan
 * Gestion des membres de l'équipe par édition
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as supabaseServices from "./supabase-services";
import { getSupabaseAdminClient } from "./supabase";

// ============================================
// ADMIN GUARD
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "super_admin", "admin_contenu", "admin_ops"];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès administrateur requis",
    });
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
    .input(
      z.object({
        firstName: z.string().min(1, "Prénom requis"),
        lastName: z.string().min(1, "Nom requis"),
        role: z.string().optional(),
        citation: z.string().optional(),
        photoBase64: z.string().optional(), // base64 encoded image
        photoUrl: z.string().optional(), // direct URL (fallback)
        displayOrder: z.number().int().min(0).default(0),
        edition: z.number().int().min(1).default(12),
      })
    )
    .mutation(async ({ input }) => {
      let photoUrl = input.photoUrl;

      // Upload photo if base64 provided
      if (input.photoBase64) {
        const image = parseImageDataUrl(input.photoBase64);
        const path = `team/edition-${input.edition}/${Date.now()}-${input.firstName.toLowerCase()}-${input.lastName.toLowerCase()}.${image.ext}`;
        const client = getSupabaseAdminClient();
        if (!client)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase non configuré",
          });
        const { error: uploadError } = await client.storage
          .from("images")
          .upload(path, image.buffer, {
            contentType: image.contentType,
            upsert: true,
          });
        if (uploadError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: uploadError.message,
          });
        photoUrl = client.storage.from("images").getPublicUrl(path)
          .data.publicUrl;
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
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ input }) => {
      const { id, photoBase64, ...rest } = input;
      let photoUrl = rest.photoUrl;

      if (photoBase64) {
        const image = parseImageDataUrl(photoBase64);
        const edition = rest.edition ?? 12;
        const path = `team/edition-${edition}/${Date.now()}-${id}.${image.ext}`;
        const client = getSupabaseAdminClient();
        if (!client)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase non configuré",
          });
        const { error: uploadError } = await client.storage
          .from("images")
          .upload(path, image.buffer, {
            contentType: image.contentType,
            upsert: true,
          });
        if (uploadError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: uploadError.message,
          });
        photoUrl = client.storage.from("images").getPublicUrl(path)
          .data.publicUrl;
      }

      return supabaseServices.updateTeamMemberSupabase(id, {
        ...rest,
        photoUrl,
      });
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

function parseImageDataUrl(dataUrl: string): {
  buffer: Buffer;
  contentType: string;
  ext: string;
} {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Format d'image invalide (data URL attendu)",
    });
  }

  const contentType = match[1].toLowerCase();
  const base64Data = match[2];
  const extByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extByMime[contentType];

  if (!ext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Format d'image non supporté (jpeg, png, webp uniquement)",
    });
  }

  return { buffer: Buffer.from(base64Data, "base64"), contentType, ext };
}
