/**
 * AI tRPC Router – Ftour Bab Rayan
 *
 * Procedures:
 *  ai.chat                – send a message (non-streaming)
 *  ai.listConversations   – paginated conversation list
 *  ai.deleteConversation  – delete a conversation
 *  ai.adminAnalysis       – run a named admin analysis (admin only)
 *  ai.generateContent     – content generation (admin only)
 *  ai.logAction           – log a user action
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import {
  chat,
  listConversations,
  deleteConversation,
  runAdminAnalysis,
  generateContent,
  logAction,
} from "./ai-services";

const ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "admin_ops",
  "admin_contenu",
  "admin_messages",
]);

function requireAdmin(role: string) {
  if (!ADMIN_ROLES.has(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs.",
    });
  }
}

export const aiRouter = router({
  // ─── CHAT ────────────────────────────────────────────────────
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(4000),
        conversationId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await chat({
        userOpenId: user.openId,
        userRole: user.role,
        message: input.message,
        conversationId: input.conversationId,
      });

      return result;
    }),

  // ─── LIST CONVERSATIONS ───────────────────────────────────────
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return listConversations(ctx.user.openId);
  }),

  // ─── DELETE CONVERSATION ─────────────────────────────────────
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteConversation(input.conversationId, ctx.user.openId);
      return { success: true };
    }),

  // ─── ADMIN ANALYSIS ──────────────────────────────────────────
  adminAnalysis: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          "event_performance",
          "feedback_sentiment",
          "volunteer_activity",
          "anomaly_detection",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const result = await runAdminAnalysis(input.type);
      return { result };
    }),

  // ─── CONTENT GENERATION ──────────────────────────────────────
  generateContent: protectedProcedure
    .input(
      z.object({
        type: z.enum(["blog_summary", "social_post", "event_report", "email_template"]),
        context: z.string().min(1).max(5000),
        language: z.enum(["fr", "ar", "en"]).default("fr"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const content = await generateContent({
        type: input.type,
        context: input.context,
        language: input.language,
      });
      return { content };
    }),

  // ─── LOG ACTION (fire-and-forget, public) ────────────────────
  logAction: publicProcedure
    .input(
      z.object({
        action: z.string().max(100),
        entityType: z.string().max(50).optional(),
        entityId: z.string().max(100).optional(),
        metadata: z.record(z.unknown()).optional(),
        sessionId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      void logAction({
        userOpenId: ctx.user?.openId,
        sessionId: input.sessionId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as Record<string, unknown> | undefined,
      });
      return { logged: true };
    }),
});
