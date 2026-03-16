/**
 * Module Feedback Bab Rayan
 * Gestion des formulaires de feedback, campagnes email et dashboard admin.
 */

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "./supabase";
import { sendEmail } from "./email";
import { randomBytes } from "crypto";

// ============================================
// CONSTANTES
// ============================================

const ADMIN_NOTIFICATION_EMAILS = [
  "contact@ftourbabrayan.ma",
  "feedback@ftourbabrayan.ma",
];
const SITE_FEEDBACK_TYPES = [
  "volunteer",
  "event",
  "restaurant",
  "product",
  "general",
] as const;
const SITE_FEEDBACK_SOURCES = [
  "home",
  "volunteer",
  "event",
  "restaurant",
  "product",
] as const;
const SITE_FEEDBACK_STATUSES = ["new", "processed"] as const;


type RateLimitBucket = { count: number; resetAt: number };
const feedbackRateLimit = new Map<string, RateLimitBucket>();
const FEEDBACK_RATE_LIMIT_MAX = 10;
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const logger = {
  error(payload: Record<string, unknown>) {
    console.error(payload);
  },
};

function getClientIp(ctx: any): string {
  const forwarded = ctx?.req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return ctx?.req?.ip || "unknown";
}

function enforceFeedbackRateLimit(ip: string) {
  const now = Date.now();
  const bucket = feedbackRateLimit.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    feedbackRateLimit.set(ip, {
      count: 1,
      resetAt: now + FEEDBACK_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (bucket.count >= FEEDBACK_RATE_LIMIT_MAX) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Trop de requêtes. Réessayez dans une heure.",
    });
  }

  bucket.count += 1;
  feedbackRateLimit.set(ip, bucket);
}


function isTokenExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function resolveBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.VITE_APP_URL ||
    "https://ftourbabrayan.ma"
  );
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "super_admin", "admin_ops"];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ============================================
// ROUTER
// ============================================

const publicFeedbackProcedure = publicProcedure.use(({ ctx, next }) => {
  const ip = getClientIp(ctx);
  enforceFeedbackRateLimit(ip);
  return next();
});

export const feedbackRouter = router({
  submitSiteFeedback: publicFeedbackProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        feedbackType: z.enum(SITE_FEEDBACK_TYPES),
        rating: z.number().min(1).max(5),
        comment: z.string().min(3),
        pageSource: z.enum(SITE_FEEDBACK_SOURCES),
        consent: z.literal(true),
        website: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.website) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Requête invalide" });
      }


      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { data, error } = await db
        .from("feedback_responses")
        .insert({
          form_id: null,
          campaign_id: null,
          recipient_id: null,
          email: input.email,
          user_email: input.email,
          user_name: input.name,
          is_anonymous: false,
          feedback_type: input.feedbackType,
          rating: input.rating,
          message: input.comment,
          source: "site",
          moderation: "pending",
        })
        .select("id")
        .single();

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });

      await sendSiteFeedbackNotification({
        name: input.name,
        email: input.email,
        feedbackType: input.feedbackType,
        rating: input.rating,
        comment: input.comment,
        pageSource: input.pageSource,
      });

      return { success: true, id: data?.id ?? null };
    }),

  listSiteFeedbacks: adminProcedure
    .input(
      z
        .object({
          feedbackType: z.enum(SITE_FEEDBACK_TYPES).optional(),
          minRating: z.number().min(1).max(5).optional(),
          status: z.enum(SITE_FEEDBACK_STATUSES).optional(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      let query = db
        .from("feedback_responses")
        .select("*", { count: "exact" })
        .in("source", ["site", "public_page", "website"]);

      if (input?.feedbackType)
        query = query.eq("feedback_type", input.feedbackType);
      if (input?.status) {
        query = query.eq("moderation", input.status === "processed" ? "processed" : "pending");
      }
      if (input?.minRating) query = query.gte("rating", input.minRating);
      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate)
        query = query.lte("created_at", `${input.toDate}T23:59:59Z`);

      const { data, error, count } = await query.order("created_at", {
        ascending: false,
      });
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });

      const items = (data ?? []).map((row: any) => ({
        ...row,
        name: row.name ?? row.user_name ?? null,
        email: row.email ?? row.user_email ?? null,
        comment: row.comment ?? row.message ?? null,
        page_source: row.page_source ?? row.source ?? null,
        status: row.moderation === "processed" ? "processed" : "new",
      }));

      return { items, total: count ?? 0 };
    }),

  updateSiteFeedbackStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(SITE_FEEDBACK_STATUSES) }))
    .mutation(async ({ input }) => {

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { error } = await db
        .from("feedback_responses")
        .update({ moderation: input.status === "processed" ? "processed" : "pending" })
        .eq("id", input.id);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { success: true };
    }),

  deleteSiteFeedback: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { error } = await db.from("feedback_responses").delete().eq("id", input.id);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { success: true };
    }),

  // ============================================
  // FORMULAIRES (Admin)
  // ============================================

  listForms: adminProcedure.query(async () => {
    const db = getSupabaseAdminClient();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "DB non configurée",
      });

    const { data, error } = await db
      .from("feedback_forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    return data ?? [];
  }),

  getForm: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { data: form, error: formError } = await db
        .from("feedback_forms")
        .select("*")
        .eq("id", input.id)
        .eq("active", true)
        .single();

      if (formError || !form)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Formulaire non trouvé",
        });

      const { data: questions } = await db
        .from("feedback_questions")
        .select("*")
        .eq("form_id", input.id)
        .order("order_index", { ascending: true });

      return { ...form, questions: questions ?? [] };
    }),

  getDefaultForm: publicProcedure.query(async () => {
    const db = getSupabaseAdminClient();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "DB non configurée",
      });

    const { data: form, error } = await db
      .from("feedback_forms")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (error || !form)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Aucun formulaire actif",
      });

    const { data: questions } = await db
      .from("feedback_questions")
      .select("*")
      .eq("form_id", form.id)
      .order("order_index", { ascending: true });

    return { ...form, questions: questions ?? [] };
  }),

  createForm: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        targetType: z.enum([
          "global",
          "volunteers",
          "restaurant_clients",
          "foodstore_clients",
        ]),
        isAnonymousAllowed: z.boolean().default(true),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { data, error } = await db
        .from("feedback_forms")
        .insert({
          name: input.title,
          title: input.title,
          description: input.description ?? null,
          target_type: input.targetType,
          is_anonymous_allowed: input.isAnonymousAllowed,
          active: input.active,
        })
        .select()
        .single();

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),

  // ============================================
  // VALIDATION TOKEN (via lien email)
  // ============================================

  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { data, error } = await db
        .from("feedback_campaign_recipients")
        .select("*, feedback_campaigns(*)")
        .eq("token", input.token)
        .single();

      if (error || !data) {
        logger.error({ module: "feedback", action: "validateToken.invalid", error: error?.message ?? "Token invalide" });
        throw new TRPCError({ code: "NOT_FOUND", message: "Token invalide" });
      }
      if (isTokenExpired(data.expires_at)) {
        logger.error({ module: "feedback", action: "validateToken.expired", error: "Token expiré" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lien expiré" });
      }
      if (data.submitted_at)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Feedback déjà soumis",
        });

      // Mark as opened
      await db
        .from("feedback_campaign_recipients")
        .update({ opened_at: new Date().toISOString() })
        .eq("token", input.token)
        .is("opened_at", null);

      return {
        email: data.email,
        campaignId: data.campaign_id,
        formId: (data.feedback_campaigns as any)?.form_id ?? null,
      };
    }),

  // ============================================
  // SOUMISSION FEEDBACK (Public)
  // ============================================

  submitFeedback: publicFeedbackProcedure
    .input(
      z.object({
        formId: z.number(),
        isAnonymous: z.boolean().default(false),
        userName: z.string().optional(),
        userEmail: z.string().email().optional(),
        source: z
          .enum(["public_page", "email_campaign"])
          .default("public_page"),
        token: z.string().optional(), // token email campaign
        website: z.string().optional(),
        answers: z.array(
          z.object({
            questionId: z.number(),
            answerText: z.string().optional(),
            answerRating: z.number().min(1).max(5).optional(),
            answerChoice: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      if (input.website) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Requête invalide" });
      }

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      // If token provided, validate it
      let recipientId: number | null = null;
      let recipientCampaignId: number | null = null;
      let resolvedEmail = input.userEmail ?? null;

      if (input.token) {
        const { data: recipient, error: tokenError } = await db
          .from("feedback_campaign_recipients")
          .select("*")
          .eq("token", input.token)
          .single();

        if (tokenError || !recipient) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token invalide",
          });
        }
        if (isTokenExpired(recipient.expires_at)) {
          logger.error({ module: "feedback", action: "submitFeedback.token_expired", error: "Token expiré" });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Lien expiré",
          });
        }
        if (recipient.submitted_at) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Feedback déjà soumis avec ce lien",
          });
        }

        recipientId = recipient.id;
        recipientCampaignId = recipient.campaign_id ?? null;
        if (!input.isAnonymous) {
          resolvedEmail = resolvedEmail ?? recipient.email;
        }
      }

      const ratingAnswer = input.answers.find(a => a.answerRating !== undefined);
      const textAnswer = input.answers.find(a => a.answerText);

      const { data: responseId, error: submitError } = await db.rpc(
        "submit_feedback_atomic",
        {
          p_form_id: input.formId,
          p_campaign_id: recipientCampaignId,
          p_recipient_id: recipientId,
          p_email: input.isAnonymous ? null : resolvedEmail,
          p_feedback_type: null,
          p_rating: ratingAnswer?.answerRating ?? null,
          p_message: textAnswer?.answerText ?? null,
          p_source: input.source,
          p_user_name: input.userName ?? null,
          p_is_anonymous: input.isAnonymous,
          p_answers: input.answers as any,
          p_token: input.token ?? null,
        }
      );

      if (submitError || !responseId) {
        logger.error({ module: "feedback", action: "submitFeedback.rpc", error: submitError?.message ?? "submit_feedback_atomic failed" });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: submitError?.message ?? "Erreur lors de la sauvegarde",
        });
      }

      await sendAdminNotification({
        source: input.source,
        isAnonymous: input.isAnonymous,
        userEmail: resolvedEmail,
        rating: ratingAnswer?.answerRating,
        comment: textAnswer?.answerText,
      });

      return { success: true, responseId };
    }),

  // ============================================
  // STATS & DASHBOARD ADMIN
  // ============================================

  getStats: adminProcedure
    .input(
      z
        .object({
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          targetType: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      // Helper to apply date filters
      const applyDateFilters = (q: any) => {
        if (input?.fromDate) q = q.gte("created_at", input.fromDate);
        if (input?.toDate) q = q.lte("created_at", input.toDate + "T23:59:59Z");
        return q;
      };

      // 1. Accurate total and anonymous counts (no JOINs — fast)
      const [totalResult, anonResult] = await Promise.all([
        applyDateFilters(
          db.from("feedback_responses").select("*", { count: "exact", head: true })
        ),
        applyDateFilters(
          db.from("feedback_responses")
            .select("*", { count: "exact", head: true })
            .eq("is_anonymous", true)
        ),
      ]);

      if (totalResult.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: totalResult.error.message,
        });

      const total = totalResult.count ?? 0;
      const anonymous = anonResult.count ?? 0;
      const identified = total - anonymous;

      // 2. Limited responses for chart data (last 500 — includes nested ratings)
      const { data, error: chartError } = await applyDateFilters(
        db.from("feedback_responses").select(`
          id, is_anonymous, source, moderation, created_at,
          rating, message,
          feedback_answers(answer_rating, answer_text, answer_choice, question_id)
        `)
      )
        .order("created_at", { ascending: false })
        .limit(500);

      if (chartError)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: chartError.message,
        });

      const responses = data ?? [];

      // 3. Compute avg rating and recommend rate from chart data
      let ratingSum = 0;
      let ratingCount = 0;
      let recommendYes = 0;
      let recommendNo = 0;

      for (const r of responses as any[]) {
        // Rating stored directly on the response (site feedback — no feedback_answers)
        if (r.rating !== null && r.rating !== undefined && (r.feedback_answers ?? []).length === 0) {
          ratingSum += r.rating;
          ratingCount++;
        }
        for (const a of r.feedback_answers ?? []) {
          if (a.answer_rating !== null && a.answer_rating !== undefined) {
            ratingSum += a.answer_rating;
            ratingCount++;
          }
          if (a.answer_choice === "Oui") recommendYes++;
          if (a.answer_choice === "Non") recommendNo++;
        }
      }

      const avgRating =
        ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
      const recommendRate =
        recommendYes + recommendNo > 0
          ? Math.round((recommendYes / (recommendYes + recommendNo)) * 100)
          : 0;

      return {
        total,
        anonymous,
        identified,
        avgRating,
        recommendRate,
        responses,
      };
    }),

  listResponses: adminProcedure
    .input(
      z
        .object({
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          source: z.enum(["public_page", "email_campaign"]).optional(),
          minRating: z.number().optional(),
          maxRating: z.number().optional(),
          moderation: z
            .enum(["pending", "processed", "to_analyze", "important"])
            .optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      let query = db.from("feedback_responses").select(
        `
        id, form_id, is_anonymous, user_email, user_name, source, moderation, created_at,
        rating, message,
        feedback_answers(id, answer_rating, answer_text, answer_choice, question_id,
          feedback_questions(question, type)),
        feedback_forms(title, target_type)
      `,
        { count: "exact" }
      );

      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate)
        query = query.lte("created_at", input.toDate + "T23:59:59Z");
      if (input?.source) query = query.eq("source", input.source);
      if (input?.moderation) query = query.eq("moderation", input.moderation);
      if (input?.minRating) query = query.gte("rating", input.minRating);
      if (input?.maxRating) query = query.lte("rating", input.maxRating);

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });

      return { responses: data ?? [], total: count ?? 0 };
    }),

  updateModeration: adminProcedure
    .input(
      z.object({
        responseId: z.number(),
        moderation: z.enum(["pending", "processed", "to_analyze", "important"]),
      })
    )
    .mutation(async ({ input }) => {

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { error } = await db
        .from("feedback_responses")
        .update({ moderation: input.moderation })
        .eq("id", input.responseId);

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { success: true };
    }),

  // ============================================
  // CAMPAGNES EMAIL (Admin)
  // ============================================

  listCampaigns: adminProcedure.query(async () => {
    const db = getSupabaseAdminClient();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "DB non configurée",
      });

    const { data, error } = await db
      .from("feedback_campaigns")
      .select("*, feedback_forms(title)")
      .order("created_at", { ascending: false });

    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    return data ?? [];
  }),

  createCampaign: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        targetGroup: z.enum([
          "volunteers",
          "restaurant_clients",
          "foodstore_clients",
          "all",
        ]),
        formId: z.number(),
        emailSubject: z.string().min(1),
        emailContent: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { data, error } = await db
        .from("feedback_campaigns")
        .insert({
          name: input.title,
          title: input.title,
          target_group: input.targetGroup,
          form_id: input.formId,
          email_subject: input.emailSubject,
          email_content: input.emailContent,
          status: "draft",
        })
        .select()
        .single();

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),

  sendCampaign: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {

      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      // Get campaign
      const { data: campaign, error: campError } = await db
        .from("feedback_campaigns")
        .select("*")
        .eq("id", input.campaignId)
        .single();

      if (campError || !campaign)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campagne non trouvée",
        });
      if (campaign.status === "sent")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Campagne déjà envoyée",
        });

      // Collect target emails
      const emails = await collectTargetEmails(db, campaign.target_group);

      if (emails.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aucun destinataire trouvé pour ce groupe",
        });
      }

      const baseUrl = resolveBaseUrl();
      let sent = 0;
      let failed = 0;

      for (const { email, userId } of emails) {
        const token = generateToken();

        // Insert recipient
        const { error: recipError } = await db
          .from("feedback_campaign_recipients")
          .insert({
            campaign_id: campaign.id,
            email,
            user_id: userId ?? null,
            token,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        if (recipError) {
          logger.error({ module: "feedback", action: "sendCampaign.insertRecipient", error: recipError.message });
          failed++;
          continue;
        }

        // Send email
        const feedbackUrl = `${baseUrl}/feedback?token=${token}`;
        const html = generateCampaignEmailHtml({
          emailContent: campaign.email_content,
          feedbackUrl,
        });

        const result = await sendEmail({
          to: email,
          subject: campaign.email_subject,
          html,
        });

        if (result.success) sent++;
        else {
          logger.error({ module: "feedback", action: "sendCampaign.sendEmail", error: result.error ?? "email failed" });
          failed++;
        }
      }

      // Update campaign status
      await db
        .from("feedback_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", campaign.id);

      return { success: true, sent, failed, total: emails.length };
    }),

  getCampaignStats: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB non configurée",
        });

      const { data, error } = await db
        .from("feedback_campaign_stats")
        .select("*")
        .eq("campaign_id", input.campaignId)
        .maybeSingle();

      if (error) {
        logger.error({ module: "feedback", action: "getCampaignStats", error: error.message });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return {
        total: Number((data as any)?.emails_sent ?? 0),
        opened: Number((data as any)?.emails_opened ?? 0),
        submitted: Number((data as any)?.feedback_received ?? 0),
        averageRating: Number((data as any)?.average_rating ?? 0),
      };
    }),
});

// ============================================
// HELPERS
// ============================================

async function collectTargetEmails(
  db: any,
  targetGroup: string
): Promise<Array<{ email: string; userId?: number | null }>> {
  const emails: Array<{ email: string; userId?: number | null }> = [];

  const includeVolunteers =
    targetGroup === "volunteers" || targetGroup === "all";
  const includeRestaurant =
    targetGroup === "restaurant_clients" || targetGroup === "all";
  const includeFoodstore =
    targetGroup === "foodstore_clients" || targetGroup === "all";

  if (includeVolunteers) {
    const { data } = await db
      .from("volunteers")
      .select("email, id")
      .not("email", "is", null)
      .in("status", ["confirmed", "present"]);

    for (const v of data ?? []) {
      if (v.email) emails.push({ email: v.email, userId: null });
    }
  }

  if (includeRestaurant) {
    const { data } = await db
      .from("restaurant_reservations")
      .select("email, id")
      .not("email", "is", null)
      .in("status", ["confirmed", "validated"]);

    for (const r of data ?? []) {
      if (r.email) emails.push({ email: r.email, userId: null });
    }
  }

  if (includeFoodstore) {
    const { data } = await db
      .from("orders")
      .select("customer_email")
      .not("customer_email", "is", null)
      .in("status", ["confirmed", "paid", "delivered"]);

    for (const order of data ?? []) {
      if (order.customer_email) {
        emails.push({ email: order.customer_email, userId: null });
      }
    }
  }

  // Deduplicate by email
  const seen = new Set<string>();
  return emails.filter(e => {
    if (seen.has(e.email)) return false;
    seen.add(e.email);
    return true;
  });
}

async function sendAdminNotification(opts: {
  source: string;
  isAnonymous: boolean;
  userEmail: string | null;
  rating?: number;
  comment?: string;
}) {
  const baseUrl = resolveBaseUrl();
  const sourceLabel =
    opts.source === "email_campaign" ? "Campagne email" : "Page publique";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #5E5B34;">🔔 Nouveau feedback reçu — Bab Rayan</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; font-weight: bold; width: 150px;">Source :</td><td style="padding: 8px;">${sourceLabel}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Anonyme :</td><td style="padding: 8px;">${opts.isAnonymous ? "Oui" : "Non"}</td></tr>
        ${opts.userEmail ? `<tr><td style="padding: 8px; font-weight: bold;">Email :</td><td style="padding: 8px;">${opts.userEmail}</td></tr>` : ""}
        ${opts.rating !== undefined ? `<tr><td style="padding: 8px; font-weight: bold;">Score :</td><td style="padding: 8px;">${opts.rating}/5 ⭐</td></tr>` : ""}
        ${opts.comment ? `<tr><td style="padding: 8px; font-weight: bold;">Commentaire :</td><td style="padding: 8px; font-style: italic;">"${opts.comment}"</td></tr>` : ""}
      </table>
      <a href="${baseUrl}/admin/feedback" style="display: inline-block; background: #5E5B34; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Voir dans l'admin</a>
    </div>
  `;

  for (const email of ADMIN_NOTIFICATION_EMAILS) {
    await sendEmail({
      to: email,
      subject: "Nouveau feedback reçu — Bab Rayan",
      html,
    }).catch(() => {});
  }
}

async function sendSiteFeedbackNotification(opts: {
  name: string;
  email: string;
  feedbackType: (typeof SITE_FEEDBACK_TYPES)[number];
  rating: number;
  comment: string;
  pageSource: (typeof SITE_FEEDBACK_SOURCES)[number];
}) {
  const baseUrl = resolveBaseUrl();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #5E5B34;">🔔 Nouveau feedback reçu</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; font-weight: bold; width: 150px;">Type :</td><td style="padding: 8px;">${opts.feedbackType}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Note :</td><td style="padding: 8px;">${opts.rating}/5</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Commentaire :</td><td style="padding: 8px;">${opts.comment}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Page :</td><td style="padding: 8px;">${opts.pageSource}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Nom :</td><td style="padding: 8px;">${opts.name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email :</td><td style="padding: 8px;">${opts.email}</td></tr>
      </table>
      <a href="${baseUrl}/admin/feedback" style="display: inline-block; background: #5E5B34; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Voir dans l'admin</a>
    </div>
  `;

  for (const email of ADMIN_NOTIFICATION_EMAILS) {
    await sendEmail({
      to: email,
      subject: "Nouveau feedback reçu",
      html,
    }).catch(() => {});
  }
}

function generateCampaignEmailHtml(opts: {
  emailContent: string;
  feedbackUrl: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f7f0; padding: 0;">
      <div style="background: #5E5B34; padding: 30px; text-align: center;">
        <h1 style="color: #F2E9D3; margin: 0; font-size: 24px;">Bab Rayan</h1>
        <p style="color: #C9B97A; margin: 8px 0 0;">Votre avis compte pour nous</p>
      </div>
      <div style="padding: 30px; background: white;">
        <div style="color: #333; line-height: 1.7; white-space: pre-line;">${opts.emailContent}</div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${opts.feedbackUrl}"
             style="display: inline-block; background: #5E5B34; color: white; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Donner mon feedback
          </a>
        </div>
        <p style="color: #777; font-size: 14px; text-align: center;">Cela prend moins de 2 minutes. Merci pour votre contribution.</p>
      </div>
      <div style="background: #5E5B34; padding: 20px; text-align: center;">
        <p style="color: #C9B97A; margin: 0; font-size: 12px;">Association Bab Rayan — contact@babrayan.org</p>
      </div>
    </div>
  `;
}


export const __feedbackTestUtils = {
  getClientIp,
  enforceFeedbackRateLimit,
  _feedbackRateLimitMap: feedbackRateLimit,
  isTokenExpired,
};
