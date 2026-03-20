/**
 * Module Journal d'Événement — Ftour Bab Rayan
 * Journal opérationnel interne : observations, problèmes, solutions, idées, décisions.
 */

import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "./supabase";

// ============================================
// CONSTANTES
// ============================================

const JOURNAL_TYPES = ["observation", "problem", "solution", "idea", "decision"] as const;
const JOURNAL_CATEGORIES = [
  "logistics",
  "volunteers",
  "communication",
  "food",
  "participant_experience",
  "technical",
] as const;
const JOURNAL_IMPORTANCE = ["low", "medium", "high", "critical"] as const;

const JOURNAL_ADMIN_ROLES = ["admin", "super_admin", "admin_ops"] as const;
const JOURNAL_MANAGER_ROLES = [...JOURNAL_ADMIN_ROLES, "manager_restaurant"] as const;

// ============================================
// MIDDLEWARE
// ============================================

/** Admin: full access */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !(JOURNAL_ADMIN_ROLES as readonly string[]).includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux administrateurs." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Manager: can create + edit entries */
const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !(JOURNAL_MANAGER_ROLES as readonly string[]).includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux managers." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ============================================
// HELPERS
// ============================================

function requireDb(db: ReturnType<typeof getSupabaseAdminClient>) {
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données non configurée." });
  }
  return db;
}

// ============================================
// ZOD SCHEMAS
// ============================================

const createEntrySchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(1),
  type: z.enum(JOURNAL_TYPES),
  category: z.enum(JOURNAL_CATEGORIES),
  importance: z.enum(JOURNAL_IMPORTANCE).default("medium"),
  tags: z.array(z.string().max(50)).max(10).default([]),
  eventEdition: z.string().max(100).default(""),
});

const updateEntrySchema = createEntrySchema.partial().extend({
  id: z.string().uuid(),
});

const listEntriesSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  type: z.enum(JOURNAL_TYPES).optional(),
  category: z.enum(JOURNAL_CATEGORIES).optional(),
  importance: z.enum(JOURNAL_IMPORTANCE).optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(["latest", "importance", "oldest"]).default("latest"),
  eventEdition: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const createCommentSchema = z.object({
  entryId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

const updateCommentSchema = z.object({
  id: z.number().int(),
  content: z.string().min(1).max(2000),
});

const createLessonSchema = z.object({
  entryId: z.string().uuid().optional(),
  problem: z.string().min(3).max(1000),
  context: z.string().max(2000).optional(),
  solution: z.string().min(3).max(2000),
  outcome: z.string().max(2000).optional(),
  recommendation: z.string().max(2000).optional(),
  category: z.enum(JOURNAL_CATEGORIES).optional(),
  importance: z.enum(JOURNAL_IMPORTANCE).default("medium"),
  eventEdition: z.string().max(100).default(""),
});

const updateLessonSchema = createLessonSchema.partial().extend({
  id: z.number().int(),
});

const listLessonsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  category: z.enum(JOURNAL_CATEGORIES).optional(),
  importance: z.enum(JOURNAL_IMPORTANCE).optional(),
  eventEdition: z.string().optional(),
  search: z.string().max(200).optional(),
});

// ============================================
// ROUTER
// ============================================

export const journalRouter = router({

  // ──────────────────────────────────────────
  // ENTRIES — List (admin + manager + volunteer can read)
  // ──────────────────────────────────────────
  listEntries: protectedProcedure.input(listEntriesSchema).query(async ({ input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { page, pageSize, type, category, importance, search, sort, eventEdition, dateFrom, dateTo } = input;
    const offset = (page - 1) * pageSize;

    let query = db
      .from("journal_entries")
      .select(
        `id, title, description, type, category, importance, tags, event_edition,
         is_useful, useful_count, created_at, updated_at,
         author:users!journal_entries_author_id_fkey(id, name, role)`,
        { count: "exact" }
      );

    if (type) query = query.eq("type", type);
    if (category) query = query.eq("category", category);
    if (importance) query = query.eq("importance", importance);
    if (eventEdition) query = query.eq("event_edition", eventEdition);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    if (sort === "importance") {
      // Manual importance ordering: critical > high > medium > low
      query = query.order("importance", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

    return {
      entries: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  }),

  // ──────────────────────────────────────────
  // ENTRIES — Get by ID
  // ──────────────────────────────────────────
  getEntry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data, error } = await db
        .from("journal_entries")
        .select(
          `*, author:users!journal_entries_author_id_fkey(id, name, role)`
        )
        .eq("id", input.id)
        .single();

      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Entrée introuvable." });
      return data;
    }),

  // ──────────────────────────────────────────
  // ENTRIES — Create (all authenticated users)
  // ──────────────────────────────────────────
  createEntry: protectedProcedure.input(createEntrySchema).mutation(async ({ ctx, input }) => {
    const db = requireDb(getSupabaseAdminClient());

    const { data, error } = await db
      .from("journal_entries")
      .insert({
        title: input.title,
        description: input.description,
        type: input.type,
        category: input.category,
        importance: input.importance,
        tags: input.tags,
        author_id: ctx.user.id,
        event_edition: input.eventEdition,
      })
      .select("id")
      .single();

    if (error || !data) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Erreur création." });
    return { id: data.id };
  }),

  // ──────────────────────────────────────────
  // ENTRIES — Update (author or admin/manager)
  // ──────────────────────────────────────────
  updateEntry: protectedProcedure.input(updateEntrySchema).mutation(async ({ ctx, input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { id, ...rest } = input;

    // Check ownership unless admin/manager
    const isPrivileged = (JOURNAL_MANAGER_ROLES as readonly string[]).includes(ctx.user.role);
    if (!isPrivileged) {
      const { data: entry } = await db.from("journal_entries").select("author_id").eq("id", id).single();
      if (!entry || entry.author_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez modifier que vos propres entrées." });
      }
    }

    const payload: Record<string, unknown> = {};
    if (rest.title !== undefined) payload.title = rest.title;
    if (rest.description !== undefined) payload.description = rest.description;
    if (rest.type !== undefined) payload.type = rest.type;
    if (rest.category !== undefined) payload.category = rest.category;
    if (rest.importance !== undefined) payload.importance = rest.importance;
    if (rest.tags !== undefined) payload.tags = rest.tags;
    if (rest.eventEdition !== undefined) payload.event_edition = rest.eventEdition;
    payload.updated_at = new Date().toISOString();

    const { error } = await db.from("journal_entries").update(payload).eq("id", id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  // ──────────────────────────────────────────
  // ENTRIES — Delete (admin only)
  // ──────────────────────────────────────────
  deleteEntry: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());
      const { error } = await db.from("journal_entries").delete().eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // ──────────────────────────────────────────
  // ENTRIES — Toggle "useful" vote
  // ──────────────────────────────────────────
  toggleUseful: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data: existing } = await db
        .from("journal_useful_votes")
        .select("id")
        .eq("entry_id", input.entryId)
        .eq("user_id", ctx.user.id)
        .single();

      if (existing) {
        await db.from("journal_useful_votes").delete().eq("id", existing.id);
        const { data: entry } = await db.from("journal_entries").select("useful_count").eq("id", input.entryId).single();
        if (entry) {
          await db.from("journal_entries").update({ useful_count: Math.max(0, (entry.useful_count ?? 1) - 1) }).eq("id", input.entryId);
        }
        return { isUseful: false };
      } else {
        await db.from("journal_useful_votes").insert({ entry_id: input.entryId, user_id: ctx.user.id });
        const { data: entry } = await db.from("journal_entries").select("useful_count").eq("id", input.entryId).single();
        if (entry) {
          await db.from("journal_entries").update({ useful_count: (entry.useful_count ?? 0) + 1 }).eq("id", input.entryId);
        }
        return { isUseful: true };
      }
    }),

  // ──────────────────────────────────────────
  // ENTRIES — Check if user voted useful
  // ──────────────────────────────────────────
  hasVotedUseful: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = requireDb(getSupabaseAdminClient());
      const { data } = await db
        .from("journal_useful_votes")
        .select("id")
        .eq("entry_id", input.entryId)
        .eq("user_id", ctx.user.id)
        .single();
      return { isUseful: !!data };
    }),

  // ──────────────────────────────────────────
  // COMMENTS — List for an entry
  // ──────────────────────────────────────────
  listComments: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data, error } = await db
        .from("journal_comments")
        .select(`*, author:users!journal_comments_author_id_fkey(id, name, role)`)
        .eq("entry_id", input.entryId)
        .order("created_at", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  // ──────────────────────────────────────────
  // COMMENTS — Add
  // ──────────────────────────────────────────
  addComment: protectedProcedure.input(createCommentSchema).mutation(async ({ ctx, input }) => {
    const db = requireDb(getSupabaseAdminClient());

    const { data, error } = await db
      .from("journal_comments")
      .insert({ entry_id: input.entryId, author_id: ctx.user.id, content: input.content })
      .select("*, author:users!journal_comments_author_id_fkey(id, name, role)")
      .single();

    if (error || !data) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Erreur." });
    return data;
  }),

  // ──────────────────────────────────────────
  // COMMENTS — Edit (author or admin)
  // ──────────────────────────────────────────
  updateComment: protectedProcedure.input(updateCommentSchema).mutation(async ({ ctx, input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const isAdmin = (JOURNAL_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

    if (!isAdmin) {
      const { data: comment } = await db.from("journal_comments").select("author_id").eq("id", input.id).single();
      if (!comment || comment.author_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez modifier que vos commentaires." });
      }
    }

    const { error } = await db
      .from("journal_comments")
      .update({ content: input.content, updated_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  // ──────────────────────────────────────────
  // COMMENTS — Delete (author or admin)
  // ──────────────────────────────────────────
  deleteComment: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = requireDb(getSupabaseAdminClient());
      const isAdmin = (JOURNAL_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      if (!isAdmin) {
        const { data: comment } = await db.from("journal_comments").select("author_id").eq("id", input.id).single();
        if (!comment || comment.author_id !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez supprimer que vos commentaires." });
        }
      }

      const { error } = await db.from("journal_comments").delete().eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // ──────────────────────────────────────────
  // LESSONS LEARNED — List
  // ──────────────────────────────────────────
  listLessons: protectedProcedure.input(listLessonsSchema).query(async ({ input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { page, pageSize, category, importance, eventEdition, search } = input;
    const offset = (page - 1) * pageSize;

    let query = db
      .from("lessons_learned")
      .select(
        `*, author:users!lessons_learned_author_id_fkey(id, name)`,
        { count: "exact" }
      );

    if (category) query = query.eq("category", category);
    if (importance) query = query.eq("importance", importance);
    if (eventEdition) query = query.eq("event_edition", eventEdition);
    if (search) query = query.or(`problem.ilike.%${search}%,solution.ilike.%${search}%,recommendation.ilike.%${search}%`);

    query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

    return {
      lessons: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  }),

  // ──────────────────────────────────────────
  // LESSONS LEARNED — Get by ID
  // ──────────────────────────────────────────
  getLesson: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());
      const { data, error } = await db
        .from("lessons_learned")
        .select(`*, author:users!lessons_learned_author_id_fkey(id, name)`)
        .eq("id", input.id)
        .single();
      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Leçon introuvable." });
      return data;
    }),

  // ──────────────────────────────────────────
  // LESSONS LEARNED — Create (manager+)
  // ──────────────────────────────────────────
  createLesson: managerProcedure.input(createLessonSchema).mutation(async ({ ctx, input }) => {
    const db = requireDb(getSupabaseAdminClient());

    const { data, error } = await db
      .from("lessons_learned")
      .insert({
        entry_id: input.entryId ?? null,
        problem: input.problem,
        context: input.context ?? null,
        solution: input.solution,
        outcome: input.outcome ?? null,
        recommendation: input.recommendation ?? null,
        category: input.category ?? null,
        importance: input.importance,
        event_edition: input.eventEdition,
        author_id: ctx.user.id,
      })
      .select("id")
      .single();

    if (error || !data) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Erreur." });
    return { id: data.id };
  }),

  // ──────────────────────────────────────────
  // LESSONS LEARNED — Update (manager+)
  // ──────────────────────────────────────────
  updateLesson: managerProcedure.input(updateLessonSchema).mutation(async ({ input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { id, eventEdition, entryId, ...rest } = input;

    const payload: Record<string, unknown> = { ...rest };
    if (eventEdition !== undefined) payload.event_edition = eventEdition;
    if (entryId !== undefined) payload.entry_id = entryId ?? null;
    payload.updated_at = new Date().toISOString();

    const { error } = await db.from("lessons_learned").update(payload).eq("id", id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  // ──────────────────────────────────────────
  // LESSONS LEARNED — Delete (admin only)
  // ──────────────────────────────────────────
  deleteLesson: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());
      const { error } = await db.from("lessons_learned").delete().eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // ──────────────────────────────────────────
  // CONVERT ENTRY → LESSON LEARNED
  // ──────────────────────────────────────────
  convertToLesson: managerProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      solution: z.string().min(3),
      outcome: z.string().optional(),
      recommendation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data: entry } = await db
        .from("journal_entries")
        .select("title, description, category, importance, event_edition")
        .eq("id", input.entryId)
        .single();

      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Entrée introuvable." });

      const { data, error } = await db
        .from("lessons_learned")
        .insert({
          entry_id: input.entryId,
          problem: entry.title,
          context: entry.description,
          solution: input.solution,
          outcome: input.outcome ?? null,
          recommendation: input.recommendation ?? null,
          category: entry.category,
          importance: entry.importance,
          event_edition: entry.event_edition,
          author_id: ctx.user.id,
        })
        .select("id")
        .single();

      if (error || !data) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Erreur." });
      return { id: data.id };
    }),

  // ──────────────────────────────────────────
  // ANALYTICS — Dashboard stats (admin+)
  // ──────────────────────────────────────────
  analytics: adminProcedure.query(async () => {
    const db = requireDb(getSupabaseAdminClient());

    const [entriesData, lessonsData, commentsData] = await Promise.all([
      db.from("journal_entries").select("type, category, importance, tags, created_at"),
      db.from("lessons_learned").select("category, importance"),
      db.from("journal_comments").select("id", { count: "exact", head: true }),
    ]);

    const entries = entriesData.data ?? [];

    // Count by type
    const byType: Record<string, number> = {};
    for (const e of entries) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    }

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const e of entries) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    }

    // Count by importance
    const byImportance: Record<string, number> = {};
    for (const e of entries) {
      byImportance[e.importance] = (byImportance[e.importance] ?? 0) + 1;
    }

    // Top tags (flatten and count)
    const tagCount: Record<string, number> = {};
    for (const e of entries) {
      for (const tag of (e.tags ?? [])) {
        tagCount[tag] = (tagCount[tag] ?? 0) + 1;
      }
    }
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }));

    // Timeline: entries per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentEntries = entries.filter(e => new Date(e.created_at) >= thirtyDaysAgo);
    const timeline: Record<string, number> = {};
    for (const e of recentEntries) {
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      timeline[day] = (timeline[day] ?? 0) + 1;
    }
    const timelineData = Object.entries(timeline)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // Critical entries (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCritical = entries.filter(
      e => e.importance === "critical" && new Date(e.created_at) >= sevenDaysAgo
    ).length;

    return {
      totalEntries: entries.length,
      totalLessons: lessonsData.data?.length ?? 0,
      totalComments: commentsData.count ?? 0,
      recentCritical,
      byType,
      byCategory,
      byImportance,
      topTags,
      timeline: timelineData,
    };
  }),

  // ──────────────────────────────────────────
  // DISTINCT EVENT EDITIONS
  // ──────────────────────────────────────────
  listEditions: protectedProcedure.query(async () => {
    const db = requireDb(getSupabaseAdminClient());
    const { data } = await db
      .from("journal_entries")
      .select("event_edition")
      .neq("event_edition", "");
    const editions = [...new Set((data ?? []).map(r => r.event_edition).filter(Boolean))];
    return editions.sort();
  }),
});
