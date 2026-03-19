/**
 * Module Blog Communautaire — Ftour Bab Rayan
 * Gestion des articles, modération admin, likes et vues.
 */

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "./supabase";

// ============================================
// CONSTANTES
// ============================================

const BLOG_POST_TYPES = ["benevole", "participant", "equipe", "autre"] as const;
const BLOG_CATEGORIES = [
  "ressenti",
  "analyse",
  "feedback",
  "histoire",
  "spirituel",
  "organisation",
] as const;
const BLOG_STATUSES = ["pending", "approved", "rejected"] as const;

const ADMIN_ROLES = ["admin", "super_admin", "admin_ops", "admin_contenu"] as const;

// ============================================
// MIDDLEWARE ADMIN
// ============================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !(ADMIN_ROLES as readonly string[]).includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ============================================
// UTILITAIRES
// ============================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

async function ensureUniqueSlug(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  base: string,
  excludeId?: number
): Promise<string> {
  let slug = base;
  let attempt = 0;

  while (true) {
    let query = db
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data } = await query;

    if (!data || data.length === 0) return slug;

    attempt++;
    slug = `${base}-${attempt}`;
  }
}

function requireDb(
  db: ReturnType<typeof getSupabaseAdminClient>
): NonNullable<ReturnType<typeof getSupabaseAdminClient>> {
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Base de données non configurée.",
    });
  }
  return db;
}

// ============================================
// SCHÉMAS ZOD
// ============================================

const createPostSchema = z.object({
  title: z.string().min(5).max(255),
  content: z.string().min(50),
  type: z.enum(BLOG_POST_TYPES),
  categories: z.array(z.enum(BLOG_CATEGORIES)).min(1).max(4),
  hook: z.string().max(255).optional(),
  coverImage: z.string().url().optional().or(z.literal("")),
  consented: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions de publication." }),
  }),
});

const listPostsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(9),
  type: z.enum(BLOG_POST_TYPES).optional(),
  category: z.enum(BLOG_CATEGORIES).optional(),
  sort: z.enum(["recent", "popular", "views"]).default("recent"),
  search: z.string().max(100).optional(),
  status: z.enum(BLOG_STATUSES).optional(), // admin only
  authorId: z.number().int().optional(),
});

const updatePostSchema = z.object({
  id: z.number().int(),
  title: z.string().min(5).max(255).optional(),
  content: z.string().min(50).optional(),
  excerpt: z.string().max(300).optional(),
  type: z.enum(BLOG_POST_TYPES).optional(),
  categories: z.array(z.enum(BLOG_CATEGORIES)).min(1).max(4).optional(),
  hook: z.string().max(255).optional(),
  coverImage: z.string().url().optional().or(z.literal("")),
  status: z.enum(BLOG_STATUSES).optional(),
  rejectionNote: z.string().max(500).optional(),
});

// ============================================
// ROUTER
// ============================================

export const blogRouter = router({
  // ──────────────────────────────────────
  // PUBLIC — Liste des articles approuvés
  // ──────────────────────────────────────
  list: publicProcedure.input(listPostsSchema).query(async ({ input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { page, pageSize, type, category, sort, search } = input;
    const offset = (page - 1) * pageSize;

    let query = db
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, hook, author_name, type, categories, cover_image, likes, views, created_at",
        { count: "exact" }
      )
      .eq("status", "approved");

    if (type) query = query.eq("type", type);
    if (category) query = query.contains("categories", [category]);
    if (search) query = query.ilike("title", `%${search}%`);

    if (sort === "popular") {
      query = query.order("likes", { ascending: false });
    } else if (sort === "views") {
      query = query.order("views", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return {
      posts: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  }),

  // ──────────────────────────────────────
  // PUBLIC — Article par slug
  // ──────────────────────────────────────
  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data, error } = await db
        .from("blog_posts")
        .select(
          "id, title, slug, content, excerpt, hook, author_name, type, categories, cover_image, likes, views, status, created_at"
        )
        .eq("slug", input.slug)
        .eq("status", "approved")
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article introuvable.",
        });
      }

      return data;
    }),

  // ──────────────────────────────────────
  // PUBLIC — Articles similaires
  // ──────────────────────────────────────
  related: publicProcedure
    .input(z.object({ postId: z.number().int(), type: z.enum(BLOG_POST_TYPES) }))
    .query(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data } = await db
        .from("blog_posts")
        .select("id, title, slug, excerpt, author_name, type, cover_image, likes, created_at")
        .eq("status", "approved")
        .eq("type", input.type)
        .neq("id", input.postId)
        .order("created_at", { ascending: false })
        .limit(3);

      return data ?? [];
    }),

  // ──────────────────────────────────────
  // PUBLIC — Incrément vues (fire & forget)
  // ──────────────────────────────────────
  incrementViews: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = getSupabaseAdminClient();
      if (!db) return { success: false };

      await db.rpc("increment_blog_views", { p_slug: input.slug }).catch(() => {
        // Fallback: manual update
        db.from("blog_posts")
          .select("id, views")
          .eq("slug", input.slug)
          .single()
          .then(({ data }) => {
            if (data) {
              db.from("blog_posts")
                .update({ views: (data.views ?? 0) + 1 })
                .eq("id", data.id);
            }
          });
      });

      return { success: true };
    }),

  // ──────────────────────────────────────
  // PUBLIC — 3 derniers articles (homepage)
  // ──────────────────────────────────────
  latestForHome: publicProcedure.query(async () => {
    const db = requireDb(getSupabaseAdminClient());

    const { data } = await db
      .from("blog_posts")
      .select("id, title, slug, excerpt, hook, author_name, type, cover_image, likes, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(3);

    return data ?? [];
  }),

  // ──────────────────────────────────────
  // PROTÉGÉ — Créer un article
  // ──────────────────────────────────────
  create: protectedProcedure.input(createPostSchema).mutation(async ({ ctx, input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const user = ctx.user;

    const baseSlug = slugify(input.title);
    const slug = await ensureUniqueSlug(db, baseSlug);

    const excerpt = input.content
      .replace(/<[^>]*>/g, "")
      .slice(0, 200)
      .trim();

    const { data, error } = await db
      .from("blog_posts")
      .insert({
        title: input.title,
        slug,
        content: input.content,
        excerpt,
        hook: input.hook || null,
        author_id: user.id,
        author_name: user.name || "Anonyme",
        type: input.type,
        categories: input.categories,
        cover_image: input.coverImage || null,
        consented: true,
        status: "pending",
      })
      .select("id, slug")
      .single();

    if (error || !data) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Erreur création." });
    }

    return { id: data.id, slug: data.slug };
  }),

  // ──────────────────────────────────────
  // PROTÉGÉ — Like / Unlike
  // ──────────────────────────────────────
  toggleLike: protectedProcedure
    .input(z.object({ postId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = requireDb(getSupabaseAdminClient());
      const userId = ctx.user.id;

      // Vérifier si déjà liké
      const { data: existing } = await db
        .from("blog_post_likes")
        .select("id")
        .eq("post_id", input.postId)
        .eq("user_id", userId)
        .single();

      if (existing) {
        // Unlike
        await db.from("blog_post_likes").delete().eq("id", existing.id);
        await db
          .from("blog_posts")
          .update({ likes: db.from("blog_posts") as any }) // handled below
          .eq("id", input.postId);

        // Décrémenter via RPC ou update manuel
        const { data: post } = await db
          .from("blog_posts")
          .select("likes")
          .eq("id", input.postId)
          .single();
        if (post) {
          await db
            .from("blog_posts")
            .update({ likes: Math.max(0, (post.likes ?? 1) - 1) })
            .eq("id", input.postId);
        }
        return { liked: false };
      } else {
        // Like
        await db.from("blog_post_likes").insert({ post_id: input.postId, user_id: userId });

        const { data: post } = await db
          .from("blog_posts")
          .select("likes")
          .eq("id", input.postId)
          .single();
        if (post) {
          await db
            .from("blog_posts")
            .update({ likes: (post.likes ?? 0) + 1 })
            .eq("id", input.postId);
        }
        return { liked: true };
      }
    }),

  // ──────────────────────────────────────
  // PROTÉGÉ — Vérifier si l'user a liké
  // ──────────────────────────────────────
  hasLiked: protectedProcedure
    .input(z.object({ postId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data } = await db
        .from("blog_post_likes")
        .select("id")
        .eq("post_id", input.postId)
        .eq("user_id", ctx.user.id)
        .single();

      return { liked: !!data };
    }),

  // ──────────────────────────────────────
  // ADMIN — Liste tous les articles (avec filtres statut)
  // ──────────────────────────────────────
  adminList: adminProcedure.input(listPostsSchema).query(async ({ input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { page, pageSize, type, category, sort, search, status } = input;
    const offset = (page - 1) * pageSize;

    let query = db
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, author_name, author_id, type, categories, status, likes, views, created_at, rejection_note",
        { count: "exact" }
      );

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    if (category) query = query.contains("categories", [category]);
    if (search) query = query.ilike("title", `%${search}%`);

    if (sort === "popular") {
      query = query.order("likes", { ascending: false });
    } else if (sort === "views") {
      query = query.order("views", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return {
      posts: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  }),

  // ──────────────────────────────────────
  // ADMIN — Obtenir un article complet
  // ──────────────────────────────────────
  adminGetById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { data, error } = await db
        .from("blog_posts")
        .select("*")
        .eq("id", input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable." });
      }

      return data;
    }),

  // ──────────────────────────────────────
  // ADMIN — Approuver un article
  // ──────────────────────────────────────
  approve: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { error } = await db
        .from("blog_posts")
        .update({ status: "approved", rejection_note: null })
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  // ──────────────────────────────────────
  // ADMIN — Refuser un article
  // ──────────────────────────────────────
  reject: adminProcedure
    .input(z.object({ id: z.number().int(), note: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { error } = await db
        .from("blog_posts")
        .update({ status: "rejected", rejection_note: input.note || null })
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  // ──────────────────────────────────────
  // ADMIN — Modifier un article
  // ──────────────────────────────────────
  update: adminProcedure.input(updatePostSchema).mutation(async ({ input }) => {
    const db = requireDb(getSupabaseAdminClient());
    const { id, coverImage, rejectionNote, ...rest } = input;

    const payload: Record<string, unknown> = { ...rest };

    if (coverImage !== undefined) payload.cover_image = coverImage || null;
    if (rejectionNote !== undefined) payload.rejection_note = rejectionNote || null;

    if (rest.title) {
      const baseSlug = slugify(rest.title);
      payload.slug = await ensureUniqueSlug(db, baseSlug, id);
    }

    if (rest.content) {
      payload.excerpt = rest.content
        .replace(/<[^>]*>/g, "")
        .slice(0, 200)
        .trim();
    }

    const { error } = await db.from("blog_posts").update(payload).eq("id", id);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return { success: true };
  }),

  // ──────────────────────────────────────
  // ADMIN — Supprimer un article
  // ──────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = requireDb(getSupabaseAdminClient());

      const { error } = await db.from("blog_posts").delete().eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  // ──────────────────────────────────────
  // ADMIN — Statistiques rapides
  // ──────────────────────────────────────
  stats: adminProcedure.query(async () => {
    const db = requireDb(getSupabaseAdminClient());

    const [pending, approved, rejected] = await Promise.all([
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "approved"),
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    ]);

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      total: (pending.count ?? 0) + (approved.count ?? 0) + (rejected.count ?? 0),
    };
  }),
});
