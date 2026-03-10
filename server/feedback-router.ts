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

const ADMIN_NOTIFICATION_EMAILS = ["contact@ftourbabrayan.ma", "feedback@ftourbabrayan.ma"];

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
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux administrateurs" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ============================================
// ROUTER
// ============================================

export const feedbackRouter = router({

  // ============================================
  // FORMULAIRES (Admin)
  // ============================================

  listForms: adminProcedure.query(async () => {
    const db = getSupabaseAdminClient();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

    const { data, error } = await db
      .from("feedback_forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  getForm: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data: form, error: formError } = await db
        .from("feedback_forms")
        .select("*")
        .eq("id", input.id)
        .eq("active", true)
        .single();

      if (formError || !form) throw new TRPCError({ code: "NOT_FOUND", message: "Formulaire non trouvé" });

      const { data: questions } = await db
        .from("feedback_questions")
        .select("*")
        .eq("form_id", input.id)
        .order("order_index", { ascending: true });

      return { ...form, questions: questions ?? [] };
    }),

  getDefaultForm: publicProcedure.query(async () => {
    const db = getSupabaseAdminClient();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

    const { data: form, error } = await db
      .from("feedback_forms")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (error || !form) throw new TRPCError({ code: "NOT_FOUND", message: "Aucun formulaire actif" });

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
        targetType: z.enum(["global", "volunteers", "restaurant_clients", "foodstore_clients"]),
        isAnonymousAllowed: z.boolean().default(true),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await db
        .from("feedback_forms")
        .insert({
          title: input.title,
          description: input.description ?? null,
          target_type: input.targetType,
          is_anonymous_allowed: input.isAnonymousAllowed,
          active: input.active,
        })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  // ============================================
  // VALIDATION TOKEN (via lien email)
  // ============================================

  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await db
        .from("feedback_campaign_recipients")
        .select("*, feedback_campaigns(*)")
        .eq("token", input.token)
        .single();

      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Token invalide" });
      if (data.submitted_at) throw new TRPCError({ code: "BAD_REQUEST", message: "Feedback déjà soumis" });

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

  submitFeedback: publicProcedure
    .input(
      z.object({
        formId: z.number(),
        isAnonymous: z.boolean().default(false),
        userName: z.string().optional(),
        userEmail: z.string().email().optional(),
        source: z.enum(["public_page", "email_campaign"]).default("public_page"),
        token: z.string().optional(), // token email campaign
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
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      // If token provided, validate it
      let recipientId: number | null = null;
      let resolvedEmail = input.userEmail ?? null;

      if (input.token) {
        const { data: recipient, error: tokenError } = await db
          .from("feedback_campaign_recipients")
          .select("*")
          .eq("token", input.token)
          .single();

        if (tokenError || !recipient) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Token invalide" });
        }
        if (recipient.submitted_at) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Feedback déjà soumis avec ce lien" });
        }

        recipientId = recipient.id;
        if (!input.isAnonymous) {
          resolvedEmail = resolvedEmail ?? recipient.email;
        }
      }

      // Insert response
      const { data: response, error: responseError } = await db
        .from("feedback_responses")
        .insert({
          form_id: input.formId,
          user_id: null,
          user_email: input.isAnonymous ? null : resolvedEmail,
          user_name: input.isAnonymous ? null : (input.userName ?? null),
          is_anonymous: input.isAnonymous,
          source: input.source,
          moderation: "pending",
        })
        .select()
        .single();

      if (responseError || !response) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: responseError?.message ?? "Erreur lors de la sauvegarde" });
      }

      // Insert answers
      if (input.answers.length > 0) {
        const answersToInsert = input.answers.map((a) => ({
          response_id: response.id,
          question_id: a.questionId,
          answer_text: a.answerText ?? null,
          answer_rating: a.answerRating ?? null,
          answer_choice: a.answerChoice ?? null,
        }));

        const { error: answersError } = await db.from("feedback_answers").insert(answersToInsert);
        if (answersError) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: answersError.message });
        }
      }

      // Mark recipient as submitted
      if (recipientId) {
        await db
          .from("feedback_campaign_recipients")
          .update({ submitted_at: new Date().toISOString() })
          .eq("id", recipientId);
      }

      // Send admin notification
      const ratingAnswer = input.answers.find((a) => a.answerRating !== undefined);
      const textAnswer = input.answers.find((a) => a.answerText);
      await sendAdminNotification({
        source: input.source,
        isAnonymous: input.isAnonymous,
        userEmail: resolvedEmail,
        rating: ratingAnswer?.answerRating,
        comment: textAnswer?.answerText,
      });

      return { success: true, responseId: response.id };
    }),

  // ============================================
  // STATS & DASHBOARD ADMIN
  // ============================================

  getStats: adminProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        targetType: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      let query = db.from("feedback_responses").select(`
        id, form_id, is_anonymous, source, moderation, created_at,
        feedback_answers(answer_rating, answer_text, answer_choice, question_id),
        feedback_forms(title, target_type)
      `);

      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate) query = query.lte("created_at", input.toDate + "T23:59:59Z");

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const responses = data ?? [];
      const total = responses.length;
      const anonymous = responses.filter((r: any) => r.is_anonymous).length;
      const identified = total - anonymous;

      // Compute average rating
      let ratingSum = 0;
      let ratingCount = 0;
      let recommendYes = 0;
      let recommendNo = 0;

      for (const r of responses as any[]) {
        for (const a of r.feedback_answers ?? []) {
          if (a.answer_rating !== null && a.answer_rating !== undefined) {
            ratingSum += a.answer_rating;
            ratingCount++;
          }
          if (a.answer_choice === "Oui") recommendYes++;
          if (a.answer_choice === "Non") recommendNo++;
        }
      }

      const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
      const recommendRate = recommendYes + recommendNo > 0
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
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        source: z.enum(["public_page", "email_campaign"]).optional(),
        minRating: z.number().optional(),
        maxRating: z.number().optional(),
        moderation: z.enum(["pending", "processed", "to_analyze", "important"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      let query = db.from("feedback_responses").select(`
        id, form_id, is_anonymous, user_email, user_name, source, moderation, created_at,
        feedback_answers(id, answer_rating, answer_text, answer_choice, question_id,
          feedback_questions(question, type)),
        feedback_forms(title, target_type)
      `, { count: "exact" });

      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate) query = query.lte("created_at", input.toDate + "T23:59:59Z");
      if (input?.source) query = query.eq("source", input.source);
      if (input?.moderation) query = query.eq("moderation", input.moderation);

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { error } = await db
        .from("feedback_responses")
        .update({ moderation: input.moderation })
        .eq("id", input.responseId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // ============================================
  // CAMPAGNES EMAIL (Admin)
  // ============================================

  listCampaigns: adminProcedure.query(async () => {
    const db = getSupabaseAdminClient();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

    const { data, error } = await db
      .from("feedback_campaigns")
      .select("*, feedback_forms(title)")
      .order("created_at", { ascending: false });

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  createCampaign: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        targetGroup: z.enum(["volunteers", "restaurant_clients", "foodstore_clients", "all"]),
        formId: z.number(),
        emailSubject: z.string().min(1),
        emailContent: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await db
        .from("feedback_campaigns")
        .insert({
          title: input.title,
          target_group: input.targetGroup,
          form_id: input.formId,
          email_subject: input.emailSubject,
          email_content: input.emailContent,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  sendCampaign: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      // Get campaign
      const { data: campaign, error: campError } = await db
        .from("feedback_campaigns")
        .select("*")
        .eq("id", input.campaignId)
        .single();

      if (campError || !campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campagne non trouvée" });
      if (campaign.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Campagne déjà envoyée" });

      // Collect target emails
      const emails = await collectTargetEmails(db, campaign.target_group);

      if (emails.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Aucun destinataire trouvé pour ce groupe" });
      }

      const baseUrl = resolveBaseUrl();
      let sent = 0;
      let failed = 0;

      for (const { email, userId } of emails) {
        const token = generateToken();

        // Insert recipient
        const { error: recipError } = await db.from("feedback_campaign_recipients").insert({
          campaign_id: campaign.id,
          email,
          user_id: userId ?? null,
          token,
        });
        if (recipError) { failed++; continue; }

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

        if (result.success) sent++; else failed++;
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { data, error } = await db
        .from("feedback_campaign_recipients")
        .select("*")
        .eq("campaign_id", input.campaignId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const recipients = data ?? [];
      return {
        total: recipients.length,
        opened: recipients.filter((r: any) => r.opened_at).length,
        submitted: recipients.filter((r: any) => r.submitted_at).length,
        recipients,
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

  const includeVolunteers = targetGroup === "volunteers" || targetGroup === "all";
  const includeRestaurant = targetGroup === "restaurant_clients" || targetGroup === "all";

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

  // Deduplicate by email
  const seen = new Set<string>();
  return emails.filter((e) => {
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
  const sourceLabel = opts.source === "email_campaign" ? "Campagne email" : "Page publique";
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

function generateCampaignEmailHtml(opts: { emailContent: string; feedbackUrl: string }): string {
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
