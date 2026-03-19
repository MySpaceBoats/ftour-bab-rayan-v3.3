/**
 * Event Feedback Router — Feedback multi-dimensionnel Ramadan
 *
 * Gère le système de feedback structuré pour les grands événements :
 *   • submitEventFeedback   — soumission publique (bénévoles, managers, visiteurs…)
 *   • getEventFeedbackAnalytics — analytics admin (moyennes, NPS, heatmap)
 *   • getEventFeedbackList  — liste filtrée admin
 *   • updateEventFeedbackModeration — modération admin
 *   • exportEventFeedbackCsv — export CSV admin
 */

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "./supabase";

// ============================================================
// CONSTANTES & TYPES
// ============================================================

const FEEDBACK_ROLES = ["VOLUNTEER", "MANAGER", "GROUP", "BENEFICIARY", "VISITOR", "PARTNER"] as const;
const PARTICIPATION_TYPES = ["FTOR", "NIGHT_26", "VOLUNTEER_EVENT", "THANK_YOU_EVENT"] as const;

/** Clés de section reconnues — toute clé inconnue est stockée telle quelle (JSON flexible) */
const SECTION_KEYS = [
  "global_experience",
  "organisation",
  "accueil_entree",
  "systeme_digital",
  "service_tables",
  "cuisine_logistique",
  "nettoyage",
  "experience_beneficiaires",
  "tables_enfants",
  "distribution_externe",
  "nuit_26",
  "gestion_benevoles",
  "gestion_groupes",
  "feedback_manager",
  "communication_interne",
  "securite",
  "sanitaires",
  "stand_vente",
  "ambiance_musique",
  "respect_regles",
  "communication_externe",
  "evenements_speciaux",
] as const;

/**
 * Seuils pour la génération automatique de tags
 * Si une note est inférieure au seuil → tag "low_<sectionKey>"
 */
const LOW_SCORE_THRESHOLD = 3; // sur 5 (ou équivalent ramené à 5)

/** Génère les tags automatiques à partir des sections et notes */
function generateAutoTags(
  sections: Array<{ sectionKey: string; rating?: number | null }>,
  globalScore?: number | null,
  npsScore?: number | null
): Array<{ tag: string; sectionKey?: string; severity: string }> {
  const tags: Array<{ tag: string; sectionKey?: string; severity: string }> = [];

  for (const section of sections) {
    if (section.rating === null || section.rating === undefined) continue;

    // Normaliser sur 5 si c'est noté sur 10
    const normalizedRating =
      section.rating > 5 ? Math.round(section.rating / 2) : section.rating;

    if (normalizedRating < LOW_SCORE_THRESHOLD) {
      const severity = normalizedRating <= 1 ? "critical" : "warning";
      tags.push({
        tag: `low_${section.sectionKey.replace(/[^a-z0-9_]/gi, "_")}`,
        sectionKey: section.sectionKey,
        severity,
      });
    }
  }

  // NPS détracteur (0-6)
  if (npsScore !== null && npsScore !== undefined && npsScore <= 6) {
    tags.push({ tag: "nps_detractor", severity: npsScore <= 3 ? "critical" : "warning" });
  }

  // Score global faible
  if (globalScore !== null && globalScore !== undefined && globalScore <= 4) {
    tags.push({
      tag: "low_global_score",
      severity: globalScore <= 2 ? "critical" : "warning",
    });
  }

  return tags;
}

// ============================================================
// MIDDLEWARE ADMIN
// ============================================================

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

// Rate limiting simple (partagé avec feedback existant)
type RateLimitBucket = { count: number; resetAt: number };
const eventFeedbackRateLimit = new Map<string, RateLimitBucket>();

function enforceRateLimit(ip: string) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 heure
  const max = 5; // max 5 soumissions par heure par IP
  const bucket = eventFeedbackRateLimit.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    eventFeedbackRateLimit.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Trop de soumissions. Réessayez dans une heure.",
    });
  }
  bucket.count++;
  eventFeedbackRateLimit.set(ip, bucket);
}

function getClientIp(ctx: any): string {
  const fwd = ctx?.req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return ctx?.req?.ip || "unknown";
}

// ============================================================
// SCHÉMAS ZOD
// ============================================================

const sectionResponseSchema = z.object({
  sectionKey: z.string().min(1).max(100),
  rating: z.number().min(1).max(10).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const textResponseSchema = z.object({
  fieldKey: z.string().min(1).max(100),
  value: z.string().min(1),
});

const submitEventFeedbackInput = z.object({
  // Identification
  role: z.enum(FEEDBACK_ROLES),
  participationType: z.enum(PARTICIPATION_TYPES),
  eventDay: z.number().min(1).max(30).optional(),
  // Identité (optionnel)
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  isAnonymous: z.boolean().default(false),
  // Sections notées
  sections: z.array(sectionResponseSchema),
  // Réponses textuelles
  textResponses: z.array(textResponseSchema),
  // Honeypot anti-spam
  website: z.string().optional(),
});

// ============================================================
// ROUTER
// ============================================================

export const eventFeedbackRouter = router({

  // ----------------------------------------------------------
  // SOUMISSION PUBLIQUE
  // ----------------------------------------------------------

  submitEventFeedback: publicProcedure
    .input(submitEventFeedbackInput)
    .mutation(async ({ input, ctx }) => {
      // Anti-spam honeypot
      if (input.website) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Requête invalide" });
      }

      // Rate limiting par IP
      enforceRateLimit(getClientIp(ctx));

      const db = getSupabaseAdminClient();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });
      }

      // Extraire score global et NPS depuis les sections
      const globalSection = input.sections.find(s => s.sectionKey === "global_experience");
      const globalScore = globalSection?.metadata?.["global_score"] as number | undefined
        ?? globalSection?.rating ?? null;
      const npsScore = globalSection?.metadata?.["nps"] as number | undefined ?? null;

      // 1. Insérer le feedback principal
      const { data: feedbackRow, error: feedbackError } = await db
        .from("event_feedback")
        .insert({
          user_id: null,
          email: input.isAnonymous ? null : (input.email ?? null),
          name: input.isAnonymous ? null : (input.name ?? null),
          role: input.role,
          participation_type: input.participationType,
          event_day: input.eventDay ?? null,
          is_anonymous: input.isAnonymous,
          nps_score: npsScore,
          global_score: globalScore,
          moderation: "pending",
        })
        .select("id")
        .single();

      if (feedbackError || !feedbackRow) {
        console.error("[EventFeedback] Insert main:", feedbackError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: feedbackError?.message ?? "Erreur lors de la sauvegarde",
        });
      }

      const feedbackId = feedbackRow.id;

      // 2. Insérer les réponses par section (batch)
      if (input.sections.length > 0) {
        const sectionRows = input.sections.map(s => ({
          feedback_id: feedbackId,
          section_key: s.sectionKey,
          rating: s.rating ?? null,
          metadata: s.metadata ?? null,
        }));

        const { error: sectionsError } = await db
          .from("event_feedback_section_responses")
          .insert(sectionRows);

        if (sectionsError) {
          console.error("[EventFeedback] Insert sections:", sectionsError);
          // Non-fatal : on continue mais on log l'erreur
        }
      }

      // 3. Insérer les réponses textuelles (batch)
      const validTextResponses = input.textResponses.filter(t => t.value.trim().length > 0);
      if (validTextResponses.length > 0) {
        const textRows = validTextResponses.map(t => ({
          feedback_id: feedbackId,
          field_key: t.fieldKey,
          value: t.value.trim(),
        }));

        const { error: textError } = await db
          .from("event_feedback_text_responses")
          .insert(textRows);

        if (textError) {
          console.error("[EventFeedback] Insert text responses:", textError);
        }
      }

      // 4. Générer et insérer les tags automatiques
      const autoTags = generateAutoTags(input.sections, globalScore, npsScore);
      if (autoTags.length > 0) {
        const tagRows = autoTags.map(t => ({
          feedback_id: feedbackId,
          tag: t.tag,
          section_key: t.sectionKey ?? null,
          severity: t.severity,
        }));

        const { error: tagsError } = await db
          .from("event_feedback_tags")
          .insert(tagRows);

        if (tagsError) {
          console.error("[EventFeedback] Insert tags:", tagsError);
        }
      }

      return { success: true, feedbackId };
    }),

  // ----------------------------------------------------------
  // ANALYTICS ADMIN — moyennes, NPS, heatmap, scores par rôle/jour
  // ----------------------------------------------------------

  getEventFeedbackAnalytics: adminProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        role: z.enum(FEEDBACK_ROLES).optional(),
        participationType: z.enum(PARTICIPATION_TYPES).optional(),
        eventDay: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      // --- Récupérer les feedbacks principaux ---
      let feedbackQuery = db
        .from("event_feedback")
        .select("id, role, participation_type, event_day, nps_score, global_score, created_at", {
          count: "exact",
        });

      if (input?.fromDate) feedbackQuery = feedbackQuery.gte("created_at", input.fromDate);
      if (input?.toDate) feedbackQuery = feedbackQuery.lte("created_at", input.toDate + "T23:59:59Z");
      if (input?.role) feedbackQuery = feedbackQuery.eq("role", input.role);
      if (input?.participationType) feedbackQuery = feedbackQuery.eq("participation_type", input.participationType);
      if (input?.eventDay !== undefined) feedbackQuery = feedbackQuery.eq("event_day", input.eventDay);

      const { data: feedbacks, count: totalCount, error: fbError } = await feedbackQuery;
      if (fbError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fbError.message });

      const fbList = (feedbacks ?? []) as Array<{
        id: number;
        role: string;
        participation_type: string;
        event_day: number | null;
        nps_score: number | null;
        global_score: number | null;
        created_at: string;
      }>;

      // --- Récupérer les sections pour les IDs obtenus ---
      const ids = fbList.map(f => f.id);
      let sectionData: Array<{ feedback_id: number; section_key: string; rating: number | null }> = [];

      if (ids.length > 0) {
        const { data: sections } = await db
          .from("event_feedback_section_responses")
          .select("feedback_id, section_key, rating")
          .in("feedback_id", ids);
        sectionData = (sections ?? []) as typeof sectionData;
      }

      // --- Calculer les moyennes par section ---
      const sectionAggregates: Record<string, { sum: number; count: number }> = {};
      for (const s of sectionData) {
        if (s.rating === null) continue;
        if (!sectionAggregates[s.section_key]) {
          sectionAggregates[s.section_key] = { sum: 0, count: 0 };
        }
        sectionAggregates[s.section_key]!.sum += s.rating;
        sectionAggregates[s.section_key]!.count++;
      }

      const avgBySection = Object.entries(sectionAggregates).map(([key, { sum, count }]) => ({
        sectionKey: key,
        avgRating: Math.round((sum / count) * 10) / 10,
        responseCount: count,
      })).sort((a, b) => a.avgRating - b.avgRating); // Pire score en premier (heatmap)

      // --- Scores par rôle ---
      const roleAggregates: Record<string, { sum: number; count: number }> = {};
      for (const f of fbList) {
        if (f.global_score === null) continue;
        if (!roleAggregates[f.role]) roleAggregates[f.role] = { sum: 0, count: 0 };
        roleAggregates[f.role]!.sum += f.global_score;
        roleAggregates[f.role]!.count++;
      }

      const scoresByRole = Object.entries(roleAggregates).map(([role, { sum, count }]) => ({
        role,
        avgScore: Math.round((sum / count) * 10) / 10,
        count,
      }));

      // --- Scores par jour ---
      const dayAggregates: Record<number, { sum: number; count: number }> = {};
      for (const f of fbList) {
        if (f.event_day === null || f.global_score === null) continue;
        if (!dayAggregates[f.event_day]) dayAggregates[f.event_day] = { sum: 0, count: 0 };
        dayAggregates[f.event_day]!.sum += f.global_score;
        dayAggregates[f.event_day]!.count++;
      }

      const scoresByDay = Object.entries(dayAggregates)
        .map(([day, { sum, count }]) => ({
          day: Number(day),
          avgScore: Math.round((sum / count) * 10) / 10,
          count,
        }))
        .sort((a, b) => a.day - b.day);

      // --- NPS ---
      const npsScores = fbList.filter(f => f.nps_score !== null).map(f => f.nps_score as number);
      let nps = 0;
      if (npsScores.length > 0) {
        const promoters = npsScores.filter(s => s >= 9).length;
        const detractors = npsScores.filter(s => s <= 6).length;
        nps = Math.round(((promoters - detractors) / npsScores.length) * 100);
      }

      // --- Score global moyen ---
      const globalScores = fbList.filter(f => f.global_score !== null).map(f => f.global_score as number);
      const avgGlobalScore =
        globalScores.length > 0
          ? Math.round(globalScores.reduce((a, b) => a + b, 0) / globalScores.length * 10) / 10
          : 0;

      // --- Tags les plus fréquents ---
      let topTags: Array<{ tag: string; count: number; severity: string }> = [];
      if (ids.length > 0) {
        const { data: tagData } = await db
          .from("event_feedback_tags")
          .select("tag, severity")
          .in("feedback_id", ids);

        const tagCounts: Record<string, { count: number; severity: string }> = {};
        for (const t of tagData ?? []) {
          if (!tagCounts[t.tag]) tagCounts[t.tag] = { count: 0, severity: t.severity };
          tagCounts[t.tag]!.count++;
        }
        topTags = Object.entries(tagCounts)
          .map(([tag, { count, severity }]) => ({ tag, count, severity }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);
      }

      return {
        total: totalCount ?? 0,
        avgGlobalScore,
        nps,
        avgBySection,
        scoresByRole,
        scoresByDay,
        topTags,
      };
    }),

  // ----------------------------------------------------------
  // LISTE FILTRÉE ADMIN
  // ----------------------------------------------------------

  getEventFeedbackList: adminProcedure
    .input(
      z.object({
        role: z.enum(FEEDBACK_ROLES).optional(),
        participationType: z.enum(PARTICIPATION_TYPES).optional(),
        eventDay: z.number().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        minGlobalScore: z.number().optional(),
        maxGlobalScore: z.number().optional(),
        moderation: z.enum(["pending", "processed", "to_analyze", "important"]).optional(),
        hasLowScores: z.boolean().optional(), // filtre via tags
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      let query = db
        .from("event_feedback")
        .select(
          `id, role, participation_type, event_day, event_date, email, name, is_anonymous,
           nps_score, global_score, moderation, created_at`,
          { count: "exact" }
        );

      if (input?.role) query = query.eq("role", input.role);
      if (input?.participationType) query = query.eq("participation_type", input.participationType);
      if (input?.eventDay !== undefined) query = query.eq("event_day", input.eventDay);
      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate) query = query.lte("created_at", input.toDate + "T23:59:59Z");
      if (input?.minGlobalScore !== undefined) query = query.gte("global_score", input.minGlobalScore);
      if (input?.maxGlobalScore !== undefined) query = query.lte("global_score", input.maxGlobalScore);
      if (input?.moderation) query = query.eq("moderation", input.moderation);

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const items = data ?? [];

      // Enrichir avec les sections si la liste est courte (≤ 50)
      let sectionsMap: Record<number, Array<{ section_key: string; rating: number | null }>> = {};
      let textMap: Record<number, Array<{ field_key: string; value: string }>> = {};
      let tagsMap: Record<number, Array<{ tag: string; severity: string }>> = {};

      if (items.length > 0 && items.length <= 50) {
        const ids = items.map((f: any) => f.id);

        const [sectionsRes, textRes, tagsRes] = await Promise.all([
          db.from("event_feedback_section_responses")
            .select("feedback_id, section_key, rating")
            .in("feedback_id", ids),
          db.from("event_feedback_text_responses")
            .select("feedback_id, field_key, value")
            .in("feedback_id", ids),
          db.from("event_feedback_tags")
            .select("feedback_id, tag, severity")
            .in("feedback_id", ids),
        ]);

        for (const s of sectionsRes.data ?? []) {
          const id = (s as any).feedback_id;
          if (!sectionsMap[id]) sectionsMap[id] = [];
          sectionsMap[id]!.push({ section_key: (s as any).section_key, rating: (s as any).rating });
        }
        for (const t of textRes.data ?? []) {
          const id = (t as any).feedback_id;
          if (!textMap[id]) textMap[id] = [];
          textMap[id]!.push({ field_key: (t as any).field_key, value: (t as any).value });
        }
        for (const t of tagsRes.data ?? []) {
          const id = (t as any).feedback_id;
          if (!tagsMap[id]) tagsMap[id] = [];
          tagsMap[id]!.push({ tag: (t as any).tag, severity: (t as any).severity });
        }
      }

      const enrichedItems = items.map((f: any) => ({
        ...f,
        sections: sectionsMap[f.id] ?? [],
        textResponses: textMap[f.id] ?? [],
        tags: tagsMap[f.id] ?? [],
      }));

      return { items: enrichedItems, total: count ?? 0 };
    }),

  // ----------------------------------------------------------
  // MODÉRATION ADMIN
  // ----------------------------------------------------------

  updateEventFeedbackModeration: adminProcedure
    .input(
      z.object({
        feedbackId: z.number(),
        moderation: z.enum(["pending", "processed", "to_analyze", "important"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      const { error } = await db
        .from("event_feedback")
        .update({ moderation: input.moderation })
        .eq("id", input.feedbackId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // ----------------------------------------------------------
  // EXPORT CSV (liste brute pour download)
  // ----------------------------------------------------------

  exportEventFeedbackCsv: adminProcedure
    .input(
      z.object({
        role: z.enum(FEEDBACK_ROLES).optional(),
        participationType: z.enum(PARTICIPATION_TYPES).optional(),
        eventDay: z.number().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB non configurée" });

      let query = db
        .from("event_feedback")
        .select("id, role, participation_type, event_day, email, name, is_anonymous, nps_score, global_score, moderation, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (input?.role) query = query.eq("role", input.role);
      if (input?.participationType) query = query.eq("participation_type", input.participationType);
      if (input?.eventDay !== undefined) query = query.eq("event_day", input.eventDay);
      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate) query = query.lte("created_at", input.toDate + "T23:59:59Z");

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return { rows: data ?? [] };
    }),
});
