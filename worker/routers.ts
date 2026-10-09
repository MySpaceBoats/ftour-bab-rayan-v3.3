/**
 * tRPC Router for Cloudflare Workers
 * Adapted from server/routers.ts for Edge runtime
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import type { WorkerContext, WorkerUser } from "./context";
import { createSupabaseAdmin } from "./supabase";
import * as galleryDb from "./gallery-d1";
import * as blogDb from "./blog-d1";
import * as siteDb from "./site-d1";
import * as electionDb from "./election-d1";
import { sendEmail, generateGalleryUploadValidationEmail } from "./email";
import * as XLSX from "xlsx";
import {
  addDaysToDateString,
  DEFAULT_RAMADAN_TIMEZONE,
  getDateStringInTimeZone,
  getRamadanDay,
} from "../shared/ramadan";

// Initialize tRPC
const t = initTRPC.context<WorkerContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authenticated user
export const protectedProcedure = t.procedure.use(({ ctx, next, type }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Non authentifié" });
  }

  if (ctx.user.isDemo) {
    if (type !== "query") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Mode démonstration : écriture désactivée.",
      });
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mode démonstration : les données réelles ne sont pas accessibles.",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Admin procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = [
    "admin",
    "super_admin",
    "admin_operations",
    "admin_ops",
    "admin_boutique",
    "admin_dons",
    "admin_restaurant",
    "admin_patisserie",
    "admin_terroir",
  ];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès administrateur requis",
    });
  }
  return next({ ctx });
});

// Super admin procedure
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "super_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès super administrateur requis",
    });
  }
  return next({ ctx });
});

// Scanner procedure
const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = [
    "admin",
    "super_admin",
    "admin_operations",
    "admin_ops",
    "scanner",
  ];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès scanner requis" });
  }
  return next({ ctx });
});

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

const catalogProductTypeEnum = z.enum(["goodies", "terroir", "patisserie"]);
const catalogProductSelect =
  "id,name,description,price,stock,image,category,tags,status,product_type,is_best_seller,is_ramadan_edition,created_at,updated_at";

const catalogProductsRouter = router({
  listPublic: publicProcedure
    .input(z.object({ productType: catalogProductTypeEnum }))
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("products")
        .select(catalogProductSelect)
        .eq("product_type", input.productType)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data ?? [];
    }),

  adminList: adminProcedure
    .input(z.object({ productType: catalogProductTypeEnum }))
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("products")
        .select(catalogProductSelect)
        .eq("product_type", input.productType)
        .order("created_at", { ascending: false });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data ?? [];
    }),

  adminStats: adminProcedure
    .input(z.object({ productType: catalogProductTypeEnum }))
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("products")
        .select("status,is_best_seller,is_ramadan_edition")
        .eq("product_type", input.productType);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      const rows = data ?? [];
      return {
        total: rows.length,
        active: rows.filter((row: any) => row.status === "active").length,
        bestSellers: rows.filter((row: any) => row.is_best_seller === true)
          .length,
        ramadanEdition: rows.filter(
          (row: any) => row.is_ramadan_edition === true
        ).length,
      };
    }),

  create: adminProcedure
    .input(
      z.object({
        productType: catalogProductTypeEnum,
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().nonnegative(),
        stock: z.number().int().nonnegative(),
        image: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).default([]),
        status: z.enum(["active", "inactive"]).default("active"),
        isBestSeller: z.boolean().default(false),
        isRamadanEdition: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          stock: input.stock,
          image: input.image ?? null,
          category: input.category ?? null,
          tags: input.tags,
          status: input.status,
          product_type: input.productType,
          is_best_seller: input.isBestSeller,
          is_ramadan_edition: input.isRamadanEdition,
        })
        .select(catalogProductSelect)
        .single();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().nonnegative().optional(),
        stock: z.number().int().nonnegative().optional(),
        image: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["active", "inactive"]).optional(),
        isBestSeller: z.boolean().optional(),
        isRamadanEdition: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const payload: Record<string, unknown> = {};

      if (input.name !== undefined) payload.name = input.name;
      if (input.description !== undefined)
        payload.description = input.description;
      if (input.price !== undefined) payload.price = input.price;
      if (input.stock !== undefined) payload.stock = input.stock;
      if (input.image !== undefined) payload.image = input.image;
      if (input.category !== undefined) payload.category = input.category;
      if (input.tags !== undefined) payload.tags = input.tags;
      if (input.status !== undefined) payload.status = input.status;
      if (input.isBestSeller !== undefined)
        payload.is_best_seller = input.isBestSeller;
      if (input.isRamadanEdition !== undefined)
        payload.is_ramadan_edition = input.isRamadanEdition;

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", input.id)
        .select(catalogProductSelect)
        .single();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),

  remove: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return { success: true };
    }),
});

const feedbackRouter = router({
  submitSiteFeedback: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        feedbackType: z.enum(SITE_FEEDBACK_TYPES),
        rating: z.number().min(1).max(5),
        comment: z.string().min(3),
        pageSource: z.enum(SITE_FEEDBACK_SOURCES),
        isAnonymous: z.boolean().default(false),
        consent: z.literal(true),
        website: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.website) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Requête invalide",
        });
      }

      if (!input.isAnonymous) {
        if (!input.name?.trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nom requis" });
        }
        if (!input.email?.trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email requis" });
        }
      }

      const isPageSourceSchemaCacheError = (error: any): boolean =>
        error?.code === "PGRST204" &&
        typeof error?.message === "string" &&
        error.message.includes("page_source") &&
        error.message.includes("feedback_responses");

      const db = createSupabaseAdmin(ctx.env);
      const payload = {
        form_id: null,
        campaign_id: null,
        recipient_id: null,
        user_name: input.isAnonymous ? "Anonyme" : (input.name ?? null),
        user_email: input.isAnonymous ? null : (input.email ?? null),
        email: input.isAnonymous ? null : (input.email ?? null),
        is_anonymous: input.isAnonymous,
        feedback_type: input.feedbackType,
        rating: input.rating,
        message: input.comment,
        source: "site",
        page_source: input.pageSource,
        moderation: "pending",
      };

      let { data, error } = await db
        .from("feedback_responses")
        .insert(payload)
        .select("id")
        .single();

      if (error && isPageSourceSchemaCacheError(error)) {
        const { page_source: _ignored, ...fallbackPayload } = payload;
        const retryResult = await db
          .from("feedback_responses")
          .insert(fallbackPayload)
          .select("id")
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

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
    .query(async ({ ctx, input }) => {
      const isPageSourceSchemaCacheError = (error: any): boolean =>
        error?.code === "PGRST204" &&
        typeof error?.message === "string" &&
        error.message.includes("page_source") &&
        error.message.includes("feedback_responses");

      const db = createSupabaseAdmin(ctx.env);
      let query = db
        .from("feedback_responses")
        .select(
          "id, user_name, user_email, feedback_type, rating, message, source, page_source, moderation, created_at"
        )
        .eq("source", "site")
        .order("created_at", { ascending: false })
        .limit(200);

      if (input?.feedbackType)
        query = query.eq("feedback_type", input.feedbackType);
      if (input?.minRating) query = query.gte("rating", input.minRating);
      if (input?.status) query = query.eq("moderation", input.status);
      if (input?.fromDate) query = query.gte("created_at", input.fromDate);
      if (input?.toDate)
        query = query.lte("created_at", input.toDate + "T23:59:59Z");

      let { data, error } = await query;
      if (error && isPageSourceSchemaCacheError(error)) {
        let fallbackQuery = db
          .from("feedback_responses")
          .select(
            "id, user_name, user_email, feedback_type, rating, message, source, moderation, created_at"
          )
          .eq("source", "site")
          .order("created_at", { ascending: false })
          .limit(200);

        if (input?.feedbackType)
          fallbackQuery = fallbackQuery.eq("feedback_type", input.feedbackType);
        if (input?.minRating)
          fallbackQuery = fallbackQuery.gte("rating", input.minRating);
        if (input?.status)
          fallbackQuery = fallbackQuery.eq("moderation", input.status);
        if (input?.fromDate)
          fallbackQuery = fallbackQuery.gte("created_at", input.fromDate);
        if (input?.toDate)
          fallbackQuery = fallbackQuery.lte(
            "created_at",
            input.toDate + "T23:59:59Z"
          );

        const retryResult = await fallbackQuery;
        data =
          retryResult.data?.map(row => ({ ...row, page_source: null })) ?? null;
        error = retryResult.error;
      }

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return { feedbacks: data ?? [] };
    }),

  updateSiteFeedbackStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(SITE_FEEDBACK_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);
      const { error } = await db
        .from("feedback_responses")
        .update({ moderation: input.status })
        .eq("id", input.id);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return { success: true };
    }),

  deleteSiteFeedback: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);
      const { error } = await db
        .from("feedback_responses")
        .delete()
        .eq("id", input.id);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return { success: true };
    }),

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
    .query(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);

      const applyDateFilters = (q: any) => {
        if (input?.fromDate) q = q.gte("created_at", input.fromDate);
        if (input?.toDate) q = q.lte("created_at", input.toDate + "T23:59:59Z");
        return q;
      };

      const [totalResult, anonResult] = await Promise.all([
        applyDateFilters(
          db
            .from("feedback_responses")
            .select("*", { count: "exact", head: true })
        ),
        applyDateFilters(
          db
            .from("feedback_responses")
            .select("*", { count: "exact", head: true })
            .eq("is_anonymous", true)
        ),
      ]);

      if (totalResult.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: totalResult.error.message,
        });
      }

      const total = totalResult.count ?? 0;
      const anonymous = anonResult.count ?? 0;
      const identified = total - anonymous;

      const { data, error: chartError } = await applyDateFilters(
        db
          .from("feedback_responses")
          .select(
            "id, is_anonymous, source, moderation, created_at, rating, message"
          )
      )
        .order("created_at", { ascending: false })
        .limit(500);

      if (chartError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: chartError.message,
        });
      }

      const responses = data ?? [];
      let ratingSum = 0;
      let ratingCount = 0;
      let recommendYes = 0;

      for (const r of responses as any[]) {
        if (r.rating !== null && r.rating !== undefined) {
          ratingSum += r.rating;
          ratingCount++;
          if (r.rating >= 4) recommendYes++;
        }
      }

      const avgRating =
        ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
      const recommendRate =
        ratingCount > 0 ? Math.round((recommendYes / ratingCount) * 100) : 0;

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
    .query(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);

      let query = db
        .from("feedback_responses")
        .select(
          `id, form_id, is_anonymous, user_email, user_name, source, moderation, created_at, rating, message`,
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
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return { responses: data ?? [], total: count ?? 0 };
    }),

  updateModeration: adminProcedure
    .input(
      z.object({
        responseId: z.number(),
        moderation: z.enum(["pending", "processed", "to_analyze", "important"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);
      const { error } = await db
        .from("feedback_responses")
        .update({ moderation: input.moderation })
        .eq("id", input.responseId);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return { success: true };
    }),
});

// ============================================
// GROUP VOLUNTEER FILE PROCESSING HELPERS
// ============================================

const GROUP_MAIL_DISPATCH_CC = [
  "naylabennani@hotmail.com",
  "ratibhind3@gmail.com",
  "rsebbani@myspace.boats",
] as const;

/** Strips a potential data:...;base64, prefix from a base64 payload */
const _decodeBase64Payload = (payload: string): Uint8Array => {
  const clean = payload.includes(",")
    ? (payload.split(",").pop() ?? "")
    : payload;
  return Uint8Array.from(atob(clean), c => c.charCodeAt(0));
};

const _normalizeStr = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

type ParsedGroupRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
};

/**
 * Parse volunteer group rows from a base64-encoded spreadsheet.
 * - Handles all sheets (not just the first)
 * - Auto-detects the header row (prioritises row 6, the standard template row)
 * - Searches multiple sample rows for column detection (robust to merged cells)
 * - Deduplicates by email across all sheets
 */
const _parseGroupVolunteersFromSpreadsheet = (
  fileBase64: string
): ParsedGroupRow[] => {
  const buffer = _decodeBase64Payload(fileBase64);
  const workbook = XLSX.read(buffer, { type: "array", raw: false, FS: ";" });
  const seenEmails = new Set<string>();
  const allRows: ParsedGroupRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    const TEMPLATE_HEADER_ROW = 6;
    let headerRowIndex =
      rawRows.length > TEMPLATE_HEADER_ROW ? TEMPLATE_HEADER_ROW : 0;
    let bestScore = -1;

    for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
      const row = rawRows[i] ?? [];
      let hasEmail = false,
        hasName = false,
        score = 0;
      for (const cell of row) {
        const n = _normalizeStr(cell);
        if (!n) continue;
        if (
          n.includes("email") ||
          n.includes("mail") ||
          n.includes("courriel")
        ) {
          hasEmail = true;
          score += 3;
        }
        if (
          n.includes("nom") ||
          n.includes("name") ||
          n.includes("prenom") ||
          n.includes("first") ||
          n.includes("last")
        ) {
          hasName = true;
          score += 2;
        }
        if (
          n.includes("tel") ||
          n.includes("phone") ||
          n.includes("ville") ||
          n.includes("city")
        )
          score += 1;
      }
      if (hasEmail && hasName) {
        if (i === TEMPLATE_HEADER_ROW) {
          headerRowIndex = i;
          break;
        }
        if (score > bestScore) {
          bestScore = score;
          headerRowIndex = i;
        }
      }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: "",
      range: headerRowIndex,
      blankrows: false,
    });
    if (!rows.length) continue;

    // Search first 5 data rows for column keys (robust to merged-header cells)
    const sampleRows = rows.slice(0, 5);
    const findCol = (candidates: string[], exclude: string[] = []): string => {
      for (const r of sampleRows) {
        for (const key of Object.keys(r)) {
          if (!key || exclude.includes(key)) continue;
          const n = _normalizeStr(key);
          if (candidates.some(c => n.includes(c))) return key;
        }
      }
      return "";
    };

    const colEmail = findCol(["email", "mail", "courriel"]);
    const colFirst = findCol(["prenom", "first", "firstname"], [colEmail]);
    const colLast = findCol(
      ["nom", "last", "lastname", "family"],
      [colEmail, colFirst].filter(Boolean)
    );
    const colFull =
      !colFirst || !colLast
        ? findCol(["nom", "name", "prenom"], [colEmail].filter(Boolean))
        : "";
    const used = [colEmail, colFirst, colLast, colFull].filter(Boolean);
    const colPhone = findCol(
      ["telephone", "tel", "phone", "mobile", "gsm"],
      used
    );
    const colCity = findCol(
      ["ville", "city"],
      [...used, colPhone].filter(Boolean)
    );

    if ((!colFirst || !colLast) && !colFull) continue;
    if (!colEmail) continue;

    for (const row of rows) {
      let firstName: string, lastName: string;
      if (colFull) {
        const parts = String(row[colFull] ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length >= 2) {
          lastName = parts[0];
          firstName = parts.slice(1).join(" ");
        } else {
          firstName = parts[0] ?? "";
          lastName = parts[0] ?? "";
        }
      } else {
        firstName = String(row[colFirst] ?? "").trim();
        lastName = String(row[colLast] ?? "").trim();
      }
      const email = String(row[colEmail] ?? "")
        .toLowerCase()
        .trim();
      const phone = colPhone ? String(row[colPhone] ?? "").trim() : "";
      const city = colCity
        ? String(row[colCity] ?? "").trim() || undefined
        : undefined;

      if (
        !firstName ||
        !lastName ||
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      allRows.push({ firstName, lastName, email, phone, city });
    }
  }

  return allRows;
};

// ============================================

type WorkerQrType =
  | "volunteer"
  | "reservation_particulier"
  | "reservation_entreprise"
  | "reservation_groupe"
  | "pastry"
  | "terroir"
  | "goodies"
  | "donation"
  | "product_goodie"
  | "product_pastry"
  | "product_terroir"
  | "unknown";

const QR_TYPE_LABELS: Record<WorkerQrType, string> = {
  volunteer: "Bénévole",
  reservation_particulier: "Réservation Particulier",
  reservation_entreprise: "Réservation Entreprise",
  reservation_groupe: "Réservation Groupe",
  pastry: "Commande Pâtisserie",
  terroir: "Commande Terroir",
  goodies: "Commande Goodies",
  donation: "Don",
  product_goodie: "Produit Goodies",
  product_pastry: "Produit Pâtisserie",
  product_terroir: "Produit Terroir",
  unknown: "Inconnu",
};

function extractTokenFromUrl(rawInput: string): string {
  try {
    const decodedInput = decodeURIComponent(rawInput);

    // If the scanner receives a full URL containing a known token in query/path,
    // prefer that token over catalog route detection.
    const knownTokenMatch = decodedInput.match(
      /\b(rp-[a-z0-9-]+|re-[a-z0-9-]+|rg-[a-z0-9-]+|FBR-[A-Z0-9-]+|PASTRY-[A-Z0-9-]+|(?:ter|TER)-[A-Za-z0-9-]+|DON-[A-Za-z0-9-]+)\b/
    );
    if (knownTokenMatch) {
      return knownTokenMatch[1];
    }

    if (rawInput.includes("/checkin-reservation/")) {
      const parts = rawInput.split("/checkin-reservation/");
      return parts[parts.length - 1].split("?")[0];
    }
    if (rawInput.includes("/qr/pastry/")) {
      const parts = rawInput.split("/qr/pastry/");
      return parts[parts.length - 1].split("?")[0];
    }
    if (rawInput.includes("/qr/terroir/")) {
      const parts = rawInput.split("/qr/terroir/");
      return parts[parts.length - 1].split("?")[0];
    }
    // Product catalog QR codes: /buy/goodie/{id}, /buy/pastry/{id}, /buy/terroir/{id}
    if (rawInput.includes("/buy/goodie/")) {
      const parts = rawInput.split("/buy/goodie/");
      const productId = parts[parts.length - 1].split("?")[0];
      return `PROD-GOODIE-${productId}`;
    }
    if (rawInput.includes("/buy/pastry/")) {
      const parts = rawInput.split("/buy/pastry/");
      const productId = parts[parts.length - 1].split("?")[0];
      return `PROD-PASTRY-${productId}`;
    }
    if (rawInput.includes("/buy/terroir/")) {
      const parts = rawInput.split("/buy/terroir/");
      const productId = parts[parts.length - 1].split("?")[0];
      return `PROD-TERROIR-${productId}`;
    }
    if (rawInput.includes("/checkin/")) {
      const parts = rawInput.split("/checkin/");
      return parts[parts.length - 1].split("?")[0];
    }
    // Generic page URLs (legacy catalog QR codes without product ID)
    if (/\/terroir\/?(\?|$)/.test(rawInput)) {
      return "PAGE-TERROIR";
    }
    if (/\/dons\/?(\?|$)/.test(rawInput)) {
      return "PAGE-DONS";
    }
    return rawInput.trim();
  } catch {
    return rawInput.trim();
  }
}

function detectWorkerQrType(token: string): WorkerQrType {
  if (token.startsWith("rp-")) return "reservation_particulier";
  if (token.startsWith("re-")) return "reservation_entreprise";
  if (token.startsWith("rg-")) return "reservation_groupe";
  if (token.startsWith("ter-") || token.startsWith("TER-")) return "terroir";
  if (token.startsWith("PASTRY-")) return "pastry";
  if (token.startsWith("FBR-")) return "goodies";
  if (token.startsWith("DON-")) return "donation";
  if (token.startsWith("PROD-GOODIE-")) return "product_goodie";
  if (token.startsWith("PROD-PASTRY-")) return "product_pastry";
  if (token.startsWith("PROD-TERROIR-")) return "product_terroir";
  if (/^[a-f0-9]{32,}$/i.test(token)) return "volunteer";
  return "unknown";
}

const scannerRouter = router({
  identify: scannerProcedure
    .input(z.object({ rawCode: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const token = extractTokenFromUrl(input.rawCode);
      let qrType = detectWorkerQrType(token);

      // Handle legacy generic page QR codes
      if (token === "PAGE-TERROIR") {
        return {
          type: "unknown" as WorkerQrType,
          typeLabel: "Page Terroir",
          token,
          found: false,
          error:
            "Ce QR code renvoie vers la page terroir générale. Veuillez scanner un QR code produit spécifique.",
        };
      }
      if (token === "PAGE-DONS") {
        return {
          type: "unknown" as WorkerQrType,
          typeLabel: "Page Dons",
          token,
          found: false,
          error:
            "Ce QR code renvoie vers la page de dons. Aucun produit à identifier.",
        };
      }

      // ---- VOLUNTEER (auto-validation) ----
      if (qrType === "volunteer") {
        const { data: volunteer } = await supabase
          .from("volunteers")
          .select(
            "id, first_name, last_name, email, phone, status, qr_status, scanned_at, day_id"
          )
          .eq("qr_token", token)
          .single();

        if (volunteer) {
          // Auto-validate on scan
          const alreadyValidated = volunteer.qr_status === "validated";
          if (!alreadyValidated) {
            await supabase
              .from("volunteers")
              .update({
                qr_status: "validated",
                status: "confirmed",
                scanned_at: new Date().toISOString(),
                scanned_by: ctx.user?.id,
              })
              .eq("id", volunteer.id);
          }

          const fullName = `${volunteer.first_name} ${volunteer.last_name}`;
          return {
            type: "volunteer" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.volunteer,
            token,
            found: true,
            autoValidated: true,
            validationState: alreadyValidated
              ? "already_confirmed"
              : "confirmed",
            validationMessage: alreadyValidated
              ? `Déjà confirmé — ${fullName}`
              : `Bénévole confirmé — ${fullName}`,
            validationSuccess: true,
            entity: {
              id: volunteer.id,
              name: fullName,
              email: volunteer.email,
              phone: volunteer.phone,
              status: alreadyValidated ? volunteer.status : "confirmed",
              qrStatus: "validated",
              alreadyValidated,
              scannedAt: volunteer.scanned_at,
            },
          };
        }
        // Hex token not found as volunteer — fall through to unknown handler
        qrType = "unknown";
      }

      // ---- RESERVATION (all types) ----
      if (
        qrType === "reservation_particulier" ||
        qrType === "reservation_entreprise" ||
        qrType === "reservation_groupe"
      ) {
        const { data: reservation } = await supabase
          .from("restaurant_reservations")
          .select(
            "id, name, email, phone, status, seats, date, reference, qr_token"
          )
          .eq("qr_token", token)
          .single();

        if (!reservation) {
          return {
            type: qrType,
            typeLabel: QR_TYPE_LABELS[qrType],
            token,
            found: false,
            error: "Réservation introuvable",
          };
        }
        return {
          type: qrType,
          typeLabel: QR_TYPE_LABELS[qrType],
          token,
          found: true,
          entity: {
            id: reservation.id,
            name: reservation.name,
            email: reservation.email,
            phone: reservation.phone,
            status: reservation.status,
            guests: reservation.seats,
            date: reservation.date,
            reference: reservation.reference,
            qrStatus: reservation.status,
            alreadyValidated: reservation.status === "checked_in",
          },
        };
      }

      // ---- TERROIR ----
      if (qrType === "terroir") {
        let { data: order } = await supabase
          .from("terroir_orders")
          .select("*, terroir_order_items(*, terroir_products(name))")
          .eq("qr_token", token)
          .single();
        if (!order) {
          const { data: orderByRef } = await supabase
            .from("terroir_orders")
            .select("*, terroir_order_items(*, terroir_products(name))")
            .eq("order_reference", token)
            .single();
          order = orderByRef;
        }
        if (!order) {
          return {
            type: "terroir" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.terroir,
            token,
            found: false,
            error: "Commande terroir introuvable",
          };
        }
        return {
          type: "terroir" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.terroir,
          token,
          found: true,
          entity: {
            id: order.id,
            name: order.customer_name,
            phone: order.customer_phone,
            email: order.customer_email,
            status: order.status,
            reference: order.order_reference,
            totalAmount: order.total_amount,
            qrStatus: order.qr_status,
            alreadyValidated: order.qr_status === "validated",
            items: (order.terroir_order_items || []).map((i: any) => ({
              name: i.terroir_products?.name || `Produit #${i.product_id}`,
              quantity: i.quantity,
              price: i.unit_price,
            })),
          },
        };
      }

      // ---- PASTRY ----
      if (qrType === "pastry") {
        let { data: pastryOrder } = await supabase
          .from("pastry_orders")
          .select("*")
          .eq("qr_token", token)
          .single();
        if (!pastryOrder) {
          const { data: pastryByRef } = await supabase
            .from("pastry_orders")
            .select("*")
            .eq("reference", token)
            .single();
          pastryOrder = pastryByRef;
        }
        if (!pastryOrder) {
          return {
            type: "pastry" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.pastry,
            token,
            found: false,
            error: "Commande pâtisserie introuvable",
          };
        }
        return {
          type: "pastry" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.pastry,
          token,
          found: true,
          entity: {
            id: pastryOrder.id,
            name: pastryOrder.customer_name,
            phone: pastryOrder.phone,
            email: pastryOrder.email,
            status: pastryOrder.order_status,
            qrStatus: pastryOrder.qr_status,
            alreadyValidated: pastryOrder.order_status === "handed",
            reference: pastryOrder.reference,
          },
        };
      }

      // ---- GOODIES (orders table with FBR- prefix) ----
      if (qrType === "goodies") {
        const { data: goodieOrder } = await supabase
          .from("orders")
          .select("*, order_items(*, goodies(name))")
          .eq("order_reference", token)
          .single();
        if (!goodieOrder) {
          return {
            type: "goodies" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.goodies,
            token,
            found: false,
            error: "Commande goodies introuvable",
          };
        }
        return {
          type: "goodies" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.goodies,
          token,
          found: true,
          entity: {
            id: goodieOrder.id,
            name: goodieOrder.customer_name,
            phone: goodieOrder.customer_phone,
            email: goodieOrder.customer_email,
            status: goodieOrder.status,
            reference: goodieOrder.order_reference,
            totalAmount: parseFloat(goodieOrder.total_amount) || 0,
            alreadyValidated: goodieOrder.status === "delivered",
            items: (goodieOrder.order_items || []).map((i: any) => ({
              name: i.goodies?.name || `Goodie #${i.goodie_id}`,
              quantity: i.quantity,
              price: i.unit_price,
            })),
          },
        };
      }

      // ---- PRODUCT GOODIE (catalog QR) ----
      if (qrType === "product_goodie") {
        const productId = parseInt(token.replace("PROD-GOODIE-", ""), 10);
        if (!isNaN(productId)) {
          const { data: product } = await supabase
            .from("goodies")
            .select("*")
            .eq("id", productId)
            .single();
          if (product) {
            return {
              type: "product_goodie" as WorkerQrType,
              typeLabel: QR_TYPE_LABELS.product_goodie,
              token,
              found: true,
              entity: {
                id: product.id,
                name: product.name,
                status: product.is_active ? "active" : "inactive",
                totalAmount: parseFloat(product.price) || 0,
                alreadyValidated: false,
                isProduct: true,
              },
            };
          }
        }
        return {
          type: "product_goodie" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.product_goodie,
          token,
          found: false,
          error: "Produit goodies introuvable",
        };
      }

      // ---- PRODUCT PASTRY (catalog QR) ----
      if (qrType === "product_pastry") {
        const productId = parseInt(token.replace("PROD-PASTRY-", ""), 10);
        if (!isNaN(productId)) {
          const { data: product } = await supabase
            .from("pastries")
            .select("*")
            .eq("id", productId)
            .single();
          if (product) {
            return {
              type: "product_pastry" as WorkerQrType,
              typeLabel: QR_TYPE_LABELS.product_pastry,
              token,
              found: true,
              entity: {
                id: product.id,
                name: product.name,
                status: product.active ? "active" : "inactive",
                totalAmount: parseFloat(product.price) || 0,
                alreadyValidated: false,
                isProduct: true,
              },
            };
          }
        }
        return {
          type: "product_pastry" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.product_pastry,
          token,
          found: false,
          error: "Produit pâtisserie introuvable",
        };
      }

      // ---- PRODUCT TERROIR (catalog QR) ----
      if (qrType === "product_terroir") {
        const productId = parseInt(token.replace("PROD-TERROIR-", ""), 10);
        if (!isNaN(productId)) {
          const { data: product } = await supabase
            .from("terroir_products")
            .select("*, terroir_product_variants(price_unit)")
            .eq("id", productId)
            .single();
          if (product) {
            const firstVariant = (product as any).terroir_product_variants?.[0];
            return {
              type: "product_terroir" as WorkerQrType,
              typeLabel: QR_TYPE_LABELS.product_terroir,
              token,
              found: true,
              entity: {
                id: product.id,
                name: product.name,
                status: product.is_active ? "active" : "inactive",
                totalAmount: firstVariant?.price_unit
                  ? parseFloat(firstVariant.price_unit)
                  : 0,
                alreadyValidated: false,
                isProduct: true,
              },
            };
          }
        }
        return {
          type: "product_terroir" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.product_terroir,
          token,
          found: false,
          error: "Produit terroir introuvable",
        };
      }

      // ---- DONATION ----
      if (qrType === "donation") {
        const { data: donation } = await supabase
          .from("donations")
          .select("*")
          .eq("donation_reference", token)
          .single();
        if (!donation) {
          return {
            type: "donation" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.donation,
            token,
            found: false,
            error: "Don introuvable",
          };
        }
        return {
          type: "donation" as WorkerQrType,
          typeLabel: QR_TYPE_LABELS.donation,
          token,
          found: true,
          entity: {
            id: donation.id,
            name: donation.donor_name,
            phone: donation.donor_phone,
            email: donation.donor_email,
            status: donation.status,
            reference: donation.donation_reference,
            amount: parseFloat(donation.amount) || 0,
            paymentMethod: donation.payment_method,
            alreadyValidated: donation.status === "received",
          },
        };
      }

      // ---- UNKNOWN: try all tables ----
      if (qrType === "unknown") {
        // Try volunteer
        const { data: volunteer } = await supabase
          .from("volunteers")
          .select(
            "id, first_name, last_name, email, phone, status, qr_status, scanned_at"
          )
          .eq("qr_token", token)
          .single();
        if (volunteer) {
          return {
            type: "volunteer" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.volunteer,
            token,
            found: true,
            entity: {
              id: volunteer.id,
              name: `${volunteer.first_name} ${volunteer.last_name}`,
              email: volunteer.email,
              phone: volunteer.phone,
              status: volunteer.status,
              qrStatus: volunteer.qr_status,
              alreadyValidated: volunteer.qr_status === "validated",
              scannedAt: volunteer.scanned_at,
            },
          };
        }
        // Try reservation
        const { data: reservation } = await supabase
          .from("restaurant_reservations")
          .select(
            "id, name, email, phone, status, seats, date, reference, qr_token"
          )
          .eq("qr_token", token)
          .single();
        if (reservation) {
          return {
            type: "reservation_particulier" as WorkerQrType,
            typeLabel: "Réservation",
            token,
            found: true,
            entity: {
              id: reservation.id,
              name: reservation.name,
              email: reservation.email,
              phone: reservation.phone,
              status: reservation.status,
              guests: reservation.seats,
              date: reservation.date,
              reference: reservation.reference,
              qrStatus: reservation.status,
              alreadyValidated: reservation.status === "checked_in",
            },
          };
        }
        // Try goodies order
        const { data: goodieOrder } = await supabase
          .from("orders")
          .select("*, order_items(*, goodies(name))")
          .eq("order_reference", token)
          .single();
        if (goodieOrder) {
          return {
            type: "goodies" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.goodies,
            token,
            found: true,
            entity: {
              id: goodieOrder.id,
              name: goodieOrder.customer_name,
              phone: goodieOrder.customer_phone,
              email: goodieOrder.customer_email,
              status: goodieOrder.status,
              reference: goodieOrder.order_reference,
              totalAmount: parseFloat(goodieOrder.total_amount) || 0,
              alreadyValidated: goodieOrder.status === "delivered",
              items: (goodieOrder.order_items || []).map((i: any) => ({
                name: i.goodies?.name || `Goodie #${i.goodie_id}`,
                quantity: i.quantity,
                price: i.unit_price,
              })),
            },
          };
        }
        // Try pastry order
        let pastryOrder = null;
        const { data: pastryByToken } = await supabase
          .from("pastry_orders")
          .select("*")
          .eq("qr_token", token)
          .single();
        pastryOrder = pastryByToken;
        if (!pastryOrder) {
          const { data: pastryByRef } = await supabase
            .from("pastry_orders")
            .select("*")
            .eq("reference", token)
            .single();
          pastryOrder = pastryByRef;
        }
        if (pastryOrder) {
          return {
            type: "pastry" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.pastry,
            token,
            found: true,
            entity: {
              id: pastryOrder.id,
              name: pastryOrder.customer_name,
              phone: pastryOrder.phone,
              email: pastryOrder.email,
              status: pastryOrder.order_status,
              qrStatus: pastryOrder.qr_status,
              alreadyValidated: pastryOrder.order_status === "handed",
              reference: pastryOrder.reference,
            },
          };
        }
        // Try terroir order
        let terroirOrder = null;
        const { data: terroirByToken } = await supabase
          .from("terroir_orders")
          .select("*")
          .eq("qr_token", token)
          .single();
        terroirOrder = terroirByToken;
        if (!terroirOrder) {
          const { data: terroirByRef } = await supabase
            .from("terroir_orders")
            .select("*")
            .eq("order_reference", token)
            .single();
          terroirOrder = terroirByRef;
        }
        if (terroirOrder) {
          return {
            type: "terroir" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.terroir,
            token,
            found: true,
            entity: {
              id: terroirOrder.id,
              name: terroirOrder.customer_name,
              phone: terroirOrder.customer_phone,
              email: terroirOrder.customer_email,
              status: terroirOrder.status,
              qrStatus: terroirOrder.qr_status,
              alreadyValidated: terroirOrder.qr_status === "validated",
              reference: terroirOrder.order_reference,
            },
          };
        }
        // Try donation
        const { data: donationRow } = await supabase
          .from("donations")
          .select("*")
          .eq("donation_reference", token)
          .single();
        if (donationRow) {
          return {
            type: "donation" as WorkerQrType,
            typeLabel: QR_TYPE_LABELS.donation,
            token,
            found: true,
            entity: {
              id: donationRow.id,
              name: donationRow.donor_name,
              phone: donationRow.donor_phone,
              email: donationRow.donor_email,
              status: donationRow.status,
              reference: donationRow.donation_reference,
              amount: parseFloat(donationRow.amount) || 0,
              paymentMethod: donationRow.payment_method,
              alreadyValidated: donationRow.status === "received",
            },
          };
        }
      }

      return {
        type: "unknown" as WorkerQrType,
        typeLabel: "Inconnu",
        token,
        found: false,
        error: "QR code non reconnu dans le système",
      };
    }),

  validate: scannerProcedure
    .input(
      z.object({
        token: z.string().min(1),
        type: z.enum([
          "volunteer",
          "reservation_particulier",
          "reservation_entreprise",
          "reservation_groupe",
          "pastry",
          "terroir",
          "goodies",
          "donation",
          "product_goodie",
          "product_pastry",
          "product_terroir",
          "unknown",
        ]),
        entityId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // ---- VOLUNTEER ----
      if (input.type === "volunteer") {
        const { data: volunteer } = await supabase
          .from("volunteers")
          .select("id, first_name, last_name, qr_status")
          .eq("id", input.entityId)
          .single();

        if (!volunteer)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bénévole introuvable",
          });
        if (volunteer.qr_status === "validated") {
          return {
            success: true,
            message: `Déjà confirmé — ${volunteer.first_name} ${volunteer.last_name}`,
            state: "already_confirmed" as const,
          };
        }

        await supabase
          .from("volunteers")
          .update({
            qr_status: "validated",
            status: "confirmed",
            scanned_at: new Date().toISOString(),
            scanned_by: ctx.user?.id,
          })
          .eq("id", input.entityId);

        return {
          success: true,
          message: `Bénévole confirmé — ${volunteer.first_name} ${volunteer.last_name}`,
          state: "confirmed" as const,
        };
      }

      // ---- RESERVATION ----
      if (input.type.startsWith("reservation_")) {
        const { data: reservation } = await supabase
          .from("restaurant_reservations")
          .select("id, status")
          .eq("id", input.entityId)
          .single();

        if (!reservation)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Réservation introuvable",
          });
        if (reservation.status === "checked_in") {
          return {
            success: true,
            message: "Réservation déjà validée",
            state: "already_confirmed" as const,
          };
        }

        await supabase
          .from("restaurant_reservations")
          .update({ status: "checked_in" })
          .eq("id", input.entityId);
        await supabase.from("reservation_checkins").insert({
          reservation_id: input.entityId,
          validation_mode: "scan",
          validated_by: ctx.user?.email || ctx.user?.name || "Scanner",
        });

        return {
          success: true,
          message: "Check-in réservation validé !",
          state: "confirmed" as const,
        };
      }

      // ---- TERROIR ----
      if (input.type === "terroir") {
        const { data: order } = await supabase
          .from("terroir_orders")
          .select("qr_status, status")
          .eq("id", input.entityId)
          .single();
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande terroir introuvable",
          });
        if (order.qr_status === "validated")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commande déjà validée",
          });
        await supabase
          .from("terroir_orders")
          .update({ qr_status: "validated", status: "handed" })
          .eq("id", input.entityId);
        return { success: true, message: "Commande terroir remise !" };
      }

      // ---- PASTRY ----
      if (input.type === "pastry") {
        const { data: order } = await supabase
          .from("pastry_orders")
          .select("qr_status, order_status")
          .eq("id", input.entityId)
          .single();
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande pâtisserie introuvable",
          });
        if (order.order_status === "handed")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commande déjà remise",
          });
        await supabase
          .from("pastry_orders")
          .update({ qr_status: "validated", order_status: "handed" })
          .eq("id", input.entityId);
        return { success: true, message: "Commande pâtisserie remise !" };
      }

      // ---- GOODIES ----
      if (input.type === "goodies") {
        const { data: order } = await supabase
          .from("orders")
          .select("status")
          .eq("id", input.entityId)
          .single();
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande goodies introuvable",
          });
        if (order.status === "delivered")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commande déjà remise",
          });
        await supabase
          .from("orders")
          .update({ status: "delivered" })
          .eq("id", input.entityId);
        return { success: true, message: "Commande goodies remise !" };
      }

      // ---- PRODUCT (catalog QR - no validation needed) ----
      if (
        input.type === "product_goodie" ||
        input.type === "product_pastry" ||
        input.type === "product_terroir"
      ) {
        const tokenParts = input.token.split("-");
        const productId = Number(tokenParts[tokenParts.length - 1]);
        if (!Number.isFinite(productId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "QR code produit invalide",
          });
        }

        // Product QR code scans represent on-site purchases and should create real orders.
        if (input.type === "product_goodie") {
          const { data: goodie } = await supabase
            .from("goodies")
            .select("id, name, price, is_active")
            .eq("id", productId)
            .single();

          if (!goodie || !goodie.is_active) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Produit goodies introuvable ou inactif",
            });
          }

          const orderReference = `FBR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          const unitPrice = parseFloat(goodie.price) || 0;

          const { data: createdOrder, error: orderError } = await supabase
            .from("orders")
            .insert({
              order_reference: orderReference,
              customer_name: "Achat Scanner",
              customer_email: "scanner@ftourbabrayan.ma",
              customer_phone: "N/A",
              total_amount: unitPrice,
              status: "delivered",
              payment_method: "cash",
              notes: `Achat sur place via scanner universel (${input.token})`,
              processed_by: ctx.user?.id,
              delivered_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (orderError || !createdOrder) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                orderError?.message ||
                "Impossible de créer la commande goodies",
            });
          }

          const { error: orderItemError } = await supabase
            .from("order_items")
            .insert({
              order_id: createdOrder.id,
              goodie_id: goodie.id,
              quantity: 1,
              unit_price: unitPrice,
              total_price: unitPrice,
            });

          if (orderItemError) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: orderItemError.message,
            });
          }

          return {
            success: true,
            message: `Achat goodies enregistré : ${goodie.name} (commande ${orderReference})`,
            state: "confirmed" as const,
          };
        }

        if (input.type === "product_pastry") {
          const { data: pastry } = await supabase
            .from("pastries")
            .select("id, name, price, active")
            .eq("id", productId)
            .single();

          if (!pastry || !pastry.active) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Produit pâtisserie introuvable ou inactif",
            });
          }

          const reference = `PASTRY-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          const unitPrice = parseFloat(pastry.price) || 0;

          const { error: pastryOrderError } = await supabase
            .from("pastry_orders")
            .insert({
              reference,
              customer_name: "Achat Scanner",
              phone: "N/A",
              email: "scanner@ftourbabrayan.ma",
              items: [
                {
                  pastryId: pastry.id,
                  quantity: 1,
                  price: unitPrice,
                  name: pastry.name,
                },
              ],
              total_amount: unitPrice,
              payment_method: "cash",
              payment_status: "paid",
              order_status: "handed",
              notes: `Achat sur place via scanner universel (${input.token})`,
            });

          if (pastryOrderError) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: pastryOrderError.message,
            });
          }

          return {
            success: true,
            message: `Achat pâtisserie enregistré : ${pastry.name} (commande ${reference})`,
            state: "confirmed" as const,
          };
        }

        const { data: variant } = await supabase
          .from("terroir_product_variants")
          .select("id, price_unit")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        const { data: terroirProduct } = await supabase
          .from("terroir_products")
          .select("id, name, is_active")
          .eq("id", productId)
          .single();

        if (!terroirProduct || !terroirProduct.is_active || !variant) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Produit terroir introuvable ou sans variante active",
          });
        }

        const reference = `TER-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const unitPrice = parseFloat(variant.price_unit) || 0;

        const { data: terroirOrder, error: terroirOrderError } = await supabase
          .from("terroir_orders")
          .insert({
            order_reference: reference,
            customer_name: "Achat Scanner",
            customer_phone: "N/A",
            customer_email: "scanner@ftourbabrayan.ma",
            status: "picked_up",
            payment_status: "paid",
            total_amount: unitPrice,
            payment_provider: "cash",
            qr_status: "used",
            processed_by: ctx.user?.id,
            processed_at: new Date().toISOString(),
            notes: `Achat sur place via scanner universel (${input.token})`,
          })
          .select("id")
          .single();

        if (terroirOrderError || !terroirOrder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              terroirOrderError?.message ||
              "Impossible de créer la commande terroir",
          });
        }

        const { error: terroirItemError } = await supabase
          .from("terroir_order_items")
          .insert({
            order_id: terroirOrder.id,
            product_id: terroirProduct.id,
            variant_id: variant.id,
            quantity: 1,
            unit_price: unitPrice,
            total_price: unitPrice,
          });

        if (terroirItemError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: terroirItemError.message,
          });
        }

        return {
          success: true,
          message: `Achat terroir enregistré : ${terroirProduct.name} (commande ${reference})`,
          state: "confirmed" as const,
        };
      }

      // ---- DONATION ----
      if (input.type === "donation") {
        const { data: donation } = await supabase
          .from("donations")
          .select(
            "status, donor_name, donor_email, donation_reference, amount, payment_method"
          )
          .eq("id", input.entityId)
          .single();
        if (!donation)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Don introuvable",
          });
        if (donation.status === "received")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Don déjà marqué comme reçu",
          });
        await supabase
          .from("donations")
          .update({ status: "received" })
          .eq("id", input.entityId);

        // Envoyer un email de confirmation de réception
        try {
          const { sendEmail, generateDonationReceivedEmail } = await import(
            "./email"
          );
          const emailData = generateDonationReceivedEmail({
            donorName: donation.donor_name,
            donorEmail: donation.donor_email,
            donationReference: donation.donation_reference,
            amount:
              typeof donation.amount === "string"
                ? parseFloat(donation.amount) || 0
                : (donation.amount ?? 0),
            paymentMethod: donation.payment_method,
          });
          await sendEmail({
            to: donation.donor_email,
            subject: emailData.subject,
            html: emailData.html,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
        } catch (emailError) {
          console.error(
            "[Worker] Error sending donation received email (scanner):",
            emailError
          );
        }

        return { success: true, message: "Don marqué comme reçu !" };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Type de QR non supporté pour la validation",
      });
    }),

  sendAccessEmail: adminProcedure
    .input(
      z.object({
        to: z.string().email(),
        scannerEmail: z.string().email().default("scaner@ftourbabrayan.ma"),
        scannerPassword: z.string().default("WERISETOGETHER"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { sendEmail } = await import("./email");
      const SCANNER_URL = "https://ftourbabrayan.ma/scanner";
      const LOGIN_URL = "https://ftourbabrayan.ma/fr/connexion";
      const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(SCANNER_URL)}`;

      const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#166534 0%,#15803d 50%,#166534 100%);padding:30px 20px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:28px;">Ftour <span style="color:#fbbf24;">Bab Rayan</span></h1>
      <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">Scanner Bénévoles — Accès QR Code</p>
    </div>
    <div style="padding:30px 25px;">
      <h2 style="color:#166534;margin:0 0 15px;font-size:22px;">Accès au Scanner Bénévoles</h2>
      <p style="color:#374151;line-height:1.6;margin:0 0 20px;">Bonjour,<br><br>Voici votre QR code d'accès au <strong>Scanner Unifié</strong> de Ftour Bab Rayan.</p>
      <div style="text-align:center;margin:30px 0;padding:25px;background:#f0fdf4;border-radius:12px;border:2px solid #bbf7d0;">
        <p style="color:#166534;font-weight:bold;margin:0 0 15px;font-size:16px;">Scannez ce QR code</p>
        <img src="${QR_CODE_URL}" alt="QR Code Scanner" width="250" height="250" style="border-radius:8px;border:3px solid #166534;" />
        <p style="color:#6b7280;margin:15px 0 0;font-size:13px;">Lien : <a href="${SCANNER_URL}" style="color:#166534;">${SCANNER_URL}</a></p>
      </div>
      <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:20px;margin:25px 0;">
        <h3 style="color:#92400e;margin:0 0 15px;font-size:18px;">Identifiants de connexion</h3>
        <p style="margin:8px 0;text-align:center;"><a href="${LOGIN_URL}" style="color:#166534;font-weight:bold;">${LOGIN_URL}</a></p>
        <table style="width:100%;border-collapse:collapse;margin-top:15px;">
          <tr><td style="padding:10px 15px;background:#fef3c7;font-weight:bold;color:#92400e;">Email</td><td style="padding:10px 15px;background:#fefce8;font-family:monospace;">${input.scannerEmail}</td></tr>
          <tr><td style="padding:10px 15px;background:#fef3c7;font-weight:bold;color:#92400e;">Mot de passe</td><td style="padding:10px 15px;background:#fefce8;font-family:monospace;">${input.scannerPassword}</td></tr>
        </table>
        <p style="color:#92400e;margin:12px 0 0;font-size:12px;">Role : <strong>Scanner</strong></p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Association Bab Rayan — Ftour Solidaire</p>
    </div>
  </div>
</body>
</html>`;

      const result = await sendEmail({
        to: input.to,
        subject: "Accès Scanner Bénévoles — QR Code & Identifiants",
        html,
        apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Erreur envoi email",
        });
      }

      return {
        success: true,
        message: `Email envoyé à ${input.to}`,
        emailId: result.id,
      };
    }),
});

// ============================================
// GALLERY ROUTER (Cloudflare D1 + R2)
// ============================================

function normalizeGalleryEventDate(eventDate?: string): string | null {
  if (!eventDate) return null;
  const value = eventDate.trim();
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

const gallerySchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  eventDate: z.string().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  albumId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
  status: z.enum(["draft", "published", "rejected"]).default("draft"),
});

const GALLERY_ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const GALLERY_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const GALLERY_MAX_BATCH = 10;

const galleryOrigin = (ctx: WorkerContext) => new URL(ctx.req.url).origin;

function galleryMedia(ctx: WorkerContext) {
  if (!ctx.env.GALLERY_MEDIA)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "R2 binding GALLERY_MEDIA is not configured",
    });
  return ctx.env.GALLERY_MEDIA;
}

const galleryRouter = router({
  listAlbums: adminProcedure.query(async ({ ctx }) => {
    const albums = await galleryDb.listAlbums(galleryDb.db(ctx.env));
    return albums.map((a: any) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      coverPhotoId: a.cover_photo_id,
      status: a.status,
      isActive: a.status === "published",
      sortOrder: a.sort_order,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));
  }),

  listPhotos: adminProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(50).default(12),
          search: z.string().optional(),
          albumId: z.string().uuid().optional(),
          tag: z.string().optional(),
          featured: z.boolean().optional(),
          status: z.enum(["draft", "published", "rejected"]).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 12;
      const { items, total } = await galleryDb.listPhotos(
        galleryDb.db(ctx.env),
        {
          page,
          pageSize,
          search: input?.search,
          album: input?.albumId,
          tag: input?.tag,
          featured: input?.featured,
          status: input?.status,
          sort: "admin",
        },
        galleryOrigin(ctx)
      );
      return { items, total, page, pageSize };
    }),

  getPhoto: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const photo = await galleryDb.getPhoto(
        galleryDb.db(ctx.env),
        input.id,
        galleryOrigin(ctx)
      );
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Photo introuvable" });
      return photo;
    }),

  uploadPhotos: protectedProcedure
    .input(
      z.object({
        photos: z
          .array(
            z.object({
              fileName: z.string().min(1),
              fileType: z.string(),
              fileData: z.string(),
              width: z.number().optional(),
              height: z.number().optional(),
              ...gallerySchema.shape,
            })
          )
          .min(1)
          .max(GALLERY_MAX_BATCH),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const d1 = galleryDb.db(ctx.env);
      const bucket = galleryMedia(ctx);
      const origin = galleryOrigin(ctx);

      const canManageGallery = Boolean(
        ctx.user &&
          [
            "admin",
            "super_admin",
            "admin_ops",
            "admin_boutique",
            "admin_dons",
            "admin_restaurant",
            "vue_restaurant",
            "admin_patisserie",
            "admin_terroir",
          ].includes(ctx.user.role)
      );

      // Validate everything before writing anything.
      const decoded = input.photos.map(photo => {
        const ext = GALLERY_ALLOWED_MIME_TYPES[photo.fileType];
        if (!ext) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Format non supporté. PNG, JPEG, WebP uniquement.",
          });
        }
        const base64Data = photo.fileData.replace(
          /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
          ""
        );
        const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        if (buffer.length > GALLERY_MAX_FILE_SIZE_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Fichier trop volumineux (max 8MB).",
          });
        }
        return { photo, ext, buffer };
      });

      const albumIds = Array.from(
        new Set(input.photos.map(p => p.albumId).filter(Boolean))
      ) as string[];
      const albumNameById = await galleryDb.albumNames(d1, albumIds);

      // Non-admin volunteers must validate uploads via email
      const batchValidationToken = canManageGallery
        ? null
        : crypto.randomUUID();

      let count = 0;
      for (const { photo, ext, buffer } of decoded) {
        const key = `gallery/original/${crypto.randomUUID()}.${ext}`;
        await bucket.put(key, buffer, {
          httpMetadata: { contentType: photo.fileType },
        });

        const defaultAlbumTag = photo.albumId
          ? albumNameById.get(photo.albumId)
          : undefined;
        try {
          await galleryDb.insertPhoto(
            d1,
            {
              title: photo.title,
              description: photo.description,
              eventDate: normalizeGalleryEventDate(photo.eventDate),
              tags: Array.from(
                new Set([
                  ...(photo.tags ?? []),
                  ...(defaultAlbumTag ? [defaultAlbumTag] : []),
                ])
              ),
              albumId: photo.albumId,
              sortOrder: photo.sortOrder,
              isFeatured: canManageGallery ? photo.isFeatured : false,
              status: canManageGallery ? "published" : "draft",
              storagePath: key,
              width: photo.width,
              height: photo.height,
              sizeBytes: buffer.length,
              mimeType: photo.fileType,
              uploadedBy: ctx.user?.email,
              validationEmail: canManageGallery
                ? null
                : (ctx.user?.email ?? null),
              validationToken: batchValidationToken,
              validated: canManageGallery,
            },
            origin
          );
        } catch (e) {
          await bucket.delete(key); // no orphan object if the row failed
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Insertion impossible",
          });
        }
        count++;
      }

      // Send validation email for non-admin volunteers
      if (!canManageGallery && batchValidationToken && ctx.user?.email) {
        const baseUrl = (
          ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma"
        ).replace(/\/$/, "");
        const validationUrl = `${baseUrl}/galerie/validation/${batchValidationToken}`;
        const emailPayload = generateGalleryUploadValidationEmail({
          email: ctx.user.email,
          validationUrl,
        });
        await sendEmail({
          to: ctx.user.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
        });
        return { needsValidation: true, count };
      }

      return { needsValidation: false, count };
    }),

  validateUploadByEmail: publicProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ input, ctx }) => {
      const d1 = galleryDb.db(ctx.env);
      const rows = await galleryDb.photosByToken(d1, input.token);

      if (rows.length === 0)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lien de validation invalide ou expiré",
        });

      const idsToPublish = rows
        .filter(r => r.status !== "published")
        .map(r => r.id);
      if (idsToPublish.length === 0)
        return { success: true, alreadyValidated: true, updatedCount: 0 };

      await galleryDb.publishValidated(d1, idsToPublish);
      return {
        success: true,
        alreadyValidated: false,
        updatedCount: idsToPublish.length,
      };
    }),

  resendValidationEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const token = await galleryDb.pendingTokenForEmail(
        galleryDb.db(ctx.env),
        email
      );
      if (!token)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucune photo en attente de validation pour cet email.",
        });

      const baseUrl = (
        ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma"
      ).replace(/\/$/, "");
      const emailPayload = generateGalleryUploadValidationEmail({
        email,
        validationUrl: `${baseUrl}/galerie/validation/${token}`,
      });
      const emailResult = await sendEmail({
        to: email,
        subject: emailPayload.subject,
        html: emailPayload.html,
        apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
      });

      if (!emailResult.success)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible d'envoyer l'email. Réessayez.",
        });

      return { success: true };
    }),

  createAlbum: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        slug: z.string().min(1).max(120),
        sortOrder: z.number().int().default(0),
        status: z.enum(["draft", "published"]).default("published"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await galleryDb.createAlbum(galleryDb.db(ctx.env), input);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Création impossible",
        });
      }
    }),

  publish: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await galleryDb.setStatus(galleryDb.db(ctx.env), input.id, "published");
      return { success: true };
    }),

  unpublish: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await galleryDb.setStatus(galleryDb.db(ctx.env), input.id, "draft");
      return { success: true };
    }),

  reject: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await galleryDb.setStatus(galleryDb.db(ctx.env), input.id, "rejected");
      return { success: true };
    }),

  updatePhoto: adminProcedure
    .input(
      z.object({ id: z.string().uuid(), ...gallerySchema.partial().shape })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, eventDate, ...rest } = input;
      const photo = await galleryDb.updatePhoto(
        galleryDb.db(ctx.env),
        id,
        {
          ...rest,
          eventDate:
            eventDate !== undefined
              ? normalizeGalleryEventDate(eventDate)
              : undefined,
        },
        galleryOrigin(ctx)
      );
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Photo introuvable" });
      return photo;
    }),

  reorderPhotos: adminProcedure
    .input(
      z.object({
        items: z.array(
          z.object({ id: z.string().uuid(), sortOrder: z.number().int() })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await galleryDb.reorderPhotos(galleryDb.db(ctx.env), input.items);
      return { success: true };
    }),

  deletePhoto: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const keys = await galleryDb.deletePhoto(galleryDb.db(ctx.env), input.id);
      if (!keys) throw new TRPCError({ code: "NOT_FOUND", message: "Photo introuvable" });
      if (keys.length > 0) await galleryMedia(ctx).delete(keys);
      return { success: true };
    }),
});

// ============================================
// AUTH ROUTER
// ============================================

const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    // Get user from context (already authenticated via token)
    return ctx.user;
  }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Email ou mot de passe incorrect",
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: authError.message,
        });
      }

      if (!authData.user || !authData.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Erreur de connexion",
        });
      }

      // Get user data from database
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("open_id", authData.user.id)
        .single();

      const user = userData
        ? {
            id: userData.open_id,
            email: userData.email,
            role: userData.role,
            name: userData.name,
            phone: userData.phone,
            createdAt: new Date(userData.created_at),
          }
        : {
            id: authData.user.id,
            email: input.email,
            role: "user" as const,
            name: authData.user.user_metadata?.name,
            createdAt: new Date(),
          };

      return {
        user,
        session: {
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
          expiresAt: authData.session.expires_at ?? null,
        },
      };
    }),

  refreshSession: publicProcedure
    .input(
      z.object({
        refreshToken: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: input.refreshToken,
      });

      if (error || !data.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: error?.message || "Session expirée",
        });
      }

      return {
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at ?? null,
        },
      };
    }),

  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Create user in Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            name: input.name,
            phone: input.phone,
          },
        });

      if (authError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: authError.message,
        });
      }

      if (!authData.user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Erreur lors de la création du compte",
        });
      }

      // Create entry in users table
      const { error: dbError } = await supabase.from("users").insert({
        open_id: authData.user.id,
        email: input.email,
        name: input.name || null,
        phone: input.phone || null,
        role: "user",
      });

      if (dbError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Erreur lors de la création du profil",
        });
      }

      return {
        user: {
          id: authData.user.id,
          email: input.email,
          role: "user" as const,
          name: input.name,
          phone: input.phone,
          createdAt: new Date(),
        },
      };
    }),

  logout: publicProcedure.mutation(async () => {
    return { success: true };
  }),
});

// ============================================
// PUBLIC DATA ROUTER
// ============================================

const publicRouter = router({
  stats: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    // Get volunteer count
    const { count: volunteerCount } = await supabase
      .from("volunteers")
      .select("*", { count: "exact", head: true });

    // Get donation total
    const { data: donations } = await supabase
      .from("donations")
      .select("amount")
      .eq("status", "received");

    const totalDonations =
      donations?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;

    return {
      totalVolunteers: volunteerCount || 0,
      totalDonations,
      totalDays: 30,
    };
  }),

  days: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("ramadan_days")
      .select("*")
      .eq("is_open", true)
      .order("day_number", { ascending: true });

    if (error) {
      console.error("[Worker] Error fetching days:", error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      dayNumber: d.day_number,
      date: d.date,
      hijriDate: d.hijri_date,
      capacity: d.capacity,
      registeredCount: d.registered_count,
      isOpen: d.is_open,
      iftarTime: d.iftar_time,
      location: d.location,
      notes: d.notes,
    }));
  }),

  goodies: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    // Try fetching active goodies with variants join first
    let { data, error } = await supabase
      .from("goodies")
      .select("*, goodie_variants(*)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    // If the variants join fails (FK not set up), fall back to goodies only
    if (error) {
      console.warn(
        "[Worker][Public] Variants join failed, fetching without variants:",
        error.message
      );
      const fallback = await supabase
        .from("goodies")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (fallback.error) {
        console.error(
          "[Worker][Public] Failed to fetch goodies:",
          fallback.error.message
        );
        return [];
      }
      data =
        fallback.data?.map((g: any) => ({ ...g, goodie_variants: [] })) ?? null;
    }

    return (data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      price: parseFloat(g.price),
      imageUrl: g.image_url,
      category: g.category,
      isActive: g.is_active,
      sortOrder: g.sort_order,
      stock: g.stock ?? 0,
      variants: (g.goodie_variants || []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        priceModifier: parseFloat(v.price_modifier),
        isAvailable: v.is_available,
      })),
    }));
  }),

  testimonials: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Worker] Error fetching testimonials:", error);
      return [];
    }

    return data || [];
  }),

  partners: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[Worker] Error fetching partners:", error);
      return [];
    }

    return data || [];
  }),

  galleryAlbums: publicProcedure.query(async ({ ctx }) =>
    galleryDb.listAlbums(galleryDb.db(ctx.env), { onlyPublished: true })
  ),

  galleryPhotos: publicProcedure
    .input(
      z
        .object({
          album: z.string().optional(),
          tag: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(50).default(18),
          sort: z.enum(["recent", "oldest", "featured"]).default("recent"),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 18;
      const { items, total } = await galleryDb.listPhotos(
        galleryDb.db(ctx.env),
        {
          page,
          pageSize,
          album: input?.album,
          tag: input?.tag,
          status: "published",
          sort: input?.sort ?? "recent",
        },
        galleryOrigin(ctx)
      );
      return { items, total, page, pageSize };
    }),
});

// ============================================
// DAYS ROUTER
// ============================================

const daysRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("ramadan_days")
      .select("*")
      .order("day_number", { ascending: true });

    if (error) {
      console.error("[Worker] Error fetching days:", error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      dayNumber: d.day_number,
      date: d.date,
      hijriDate: d.hijri_date,
      capacity: d.capacity,
      registeredCount: d.registered_count,
      isOpen: d.is_open,
      iftarTime: d.iftar_time,
      location: d.location,
      notes: d.notes,
    }));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from("ramadan_days")
        .select("*")
        .eq("id", input.id)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        dayNumber: data.day_number,
        date: data.date,
        hijriDate: data.hijri_date,
        capacity: data.capacity,
        registeredCount: data.registered_count,
        isOpen: data.is_open,
        iftarTime: data.iftar_time,
        location: data.location,
        notes: data.notes,
      };
    }),

  create: superAdminProcedure
    .input(
      z.object({
        date: z.string(),
        dayNumber: z.number().min(1).max(30),
        capacity: z.number().min(1).default(50),
        location: z.string().optional(),
        iftarTime: z.string().optional(),
        hijriDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from("ramadan_days")
        .insert({
          day_number: input.dayNumber,
          date: input.date,
          capacity: input.capacity,
          location: input.location,
          iftar_time: input.iftarTime,
          hijri_date: input.hijriDate,
          notes: input.notes,
          is_open: true,
          registered_count: 0,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { id: data.id };
    }),

  update: superAdminProcedure
    .input(
      z.object({
        id: z.number(),
        capacity: z.number().min(1).optional(),
        isOpen: z.boolean().optional(),
        location: z.string().optional(),
        iftarTime: z.string().optional(),
        hijriDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, ...updateData } = input;

      const dbData: Record<string, any> = {};
      if (updateData.capacity !== undefined)
        dbData.capacity = updateData.capacity;
      if (updateData.isOpen !== undefined) dbData.is_open = updateData.isOpen;
      if (updateData.location !== undefined)
        dbData.location = updateData.location;
      if (updateData.iftarTime !== undefined)
        dbData.iftar_time = updateData.iftarTime;
      if (updateData.hijriDate !== undefined)
        dbData.hijri_date = updateData.hijriDate;
      if (updateData.notes !== undefined) dbData.notes = updateData.notes;

      const { error } = await supabase
        .from("ramadan_days")
        .update(dbData)
        .eq("id", id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  setOpenStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        isOpen: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("ramadan_days")
        .update({ is_open: input.isOpen })
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("ramadan_days")
        .delete()
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  bulkCreate: superAdminProcedure
    .input(
      z.object({
        startDate: z.string(),
        daysCount: z.number().min(1).max(30).default(30),
        capacity: z.number().min(1).default(50),
        location: z.string().optional(),
        iftarTime: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const startDate = new Date(input.startDate);
      const createdIds: number[] = [];

      for (let i = 0; i < input.daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const { data, error } = await supabase
          .from("ramadan_days")
          .insert({
            day_number: i + 1,
            date: date.toISOString().split("T")[0],
            capacity: input.capacity,
            location: input.location,
            iftar_time: input.iftarTime,
            is_open: true,
            registered_count: 0,
          })
          .select()
          .single();

        if (!error && data) {
          createdIds.push(data.id);
        }
      }

      return { createdIds, count: createdIds.length };
    }),
});

// ============================================
// VOLUNTEERS ROUTER
// ============================================

/**
 * Normalize volunteer_slots from Supabase - handles both string and array formats
 */
function normalizeVolunteerSlots(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw))
    return raw.filter((s): s is string => typeof s === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        return parsed.filter((s): s is string => typeof s === "string");
    } catch {
      // not JSON, return empty
    }
  }
  return [];
}

const volunteersRouter = router({
  register: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().min(8),
        city: z.string().optional(),
        dayId: z.number(),
        volunteerSlots: z
          .array(z.enum(["preparation_ftour", "service_ftour"]))
          .min(1, "Veuillez sélectionner au moins un créneau")
          .optional(),
        acceptedTerms: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.acceptedTerms) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous devez accepter les conditions",
        });
      }

      const supabase = createSupabaseAdmin(ctx.env);

      // Check day availability
      const { data: day, error: dayError } = await supabase
        .from("ramadan_days")
        .select("*")
        .eq("id", input.dayId)
        .single();

      if (dayError || !day) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jour non trouvé" });
      }

      if (!day.is_open || day.registered_count >= day.capacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce jour est complet",
        });
      }

      // Generate QR token
      const qrToken = crypto.randomUUID();

      // Create volunteer
      const { data: volunteer, error: volError } = await supabase
        .from("volunteers")
        .insert({
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone,
          city: input.city,
          day_id: input.dayId,
          volunteer_slots: input.volunteerSlots || [],
          qr_token: qrToken,
          qr_status: "generated",
          status: "registered",
          accepted_terms: input.acceptedTerms,
          email_sent: false,
        })
        .select()
        .single();

      if (volError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: volError.message });
      }

      // Update registered count
      await supabase
        .from("ramadan_days")
        .update({ registered_count: day.registered_count + 1 })
        .eq("id", input.dayId);

      // Close day if full
      if (day.registered_count + 1 >= day.capacity) {
        await supabase
          .from("ramadan_days")
          .update({ is_open: false })
          .eq("id", input.dayId);
      }

      // Send confirmation email
      try {
        const { sendEmail, generateVolunteerConfirmationEmail } = await import(
          "./email"
        );
        const emailData = generateVolunteerConfirmationEmail({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          dayNumber: day.day_number,
          dayDate: new Date(day.date).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          location: day.location || "Association Bab Rayan, Casablanca",
          startTime: day.iftar_time || "18h00",
          volunteerSlots: input.volunteerSlots,
          qrToken: qrToken,
          baseUrl: "https://www.ftourbabrayan.ma",
        });

        const emailResult = await sendEmail({
          to: input.email,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });

        if (emailResult.success) {
          await supabase
            .from("volunteers")
            .update({ email_sent: true })
            .eq("id", volunteer.id);
        }
      } catch (emailError) {
        console.error("[Worker] Error sending email:", emailError);
        // Don't throw - registration is still successful
      }

      return { id: volunteer.id, qrToken };
    }),

  adminCreateManual: adminProcedure
    .input(
      z.object({
        firstName: z.string().min(2, "Prénom requis"),
        lastName: z.string().min(2, "Nom requis"),
        email: z.string().email("Email invalide"),
        phone: z.string().min(8, "Téléphone invalide"),
        city: z.string().optional().default(""),
        dayId: z.number(),
        volunteerSlots: z
          .array(z.enum(["preparation_ftour", "service_ftour"]))
          .min(1, "Veuillez sélectionner au moins un créneau"),
        status: z
          .enum(["registered", "confirmed", "present", "absent", "cancelled"])
          .default("registered"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const normalizedEmail = input.email.toLowerCase().trim();

      const { data: existingVolunteer, error: existingVolunteerError } =
        await supabase
          .from("volunteers")
          .select("id")
          .eq("day_id", input.dayId)
          .eq("email", normalizedEmail)
          .limit(1)
          .maybeSingle();

      if (existingVolunteerError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: existingVolunteerError.message,
        });
      }

      if (existingVolunteer) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cette adresse email est déjà inscrite pour ce jour.",
        });
      }

      const { data: day, error: dayError } = await supabase
        .from("ramadan_days")
        .select("*")
        .eq("id", input.dayId)
        .single();

      if (dayError || !day) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jour non trouvé" });
      }

      const qrToken = crypto.randomUUID();

      const { data: volunteer, error: createError } = await supabase
        .from("volunteers")
        .insert({
          first_name: input.firstName,
          last_name: input.lastName,
          email: normalizedEmail,
          phone: input.phone,
          city: input.city,
          day_id: input.dayId,
          volunteer_slots: input.volunteerSlots,
          qr_token: qrToken,
          qr_status: "generated",
          status: input.status,
          accepted_terms: true,
          email_sent: false,
        })
        .select("id, qr_token")
        .single();

      if (createError || !volunteer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: createError?.message || "Erreur lors de la création",
        });
      }

      try {
        const { sendEmail, generateVolunteerConfirmationEmail } = await import(
          "./email"
        );
        const emailData = generateVolunteerConfirmationEmail({
          firstName: input.firstName,
          lastName: input.lastName,
          email: normalizedEmail,
          dayNumber: day.day_number,
          dayDate: new Date(day.date).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          location: day.location || "Association Bab Rayan, Casablanca",
          startTime: day.iftar_time || "18h00",
          volunteerSlots: input.volunteerSlots,
          qrToken,
          baseUrl: "https://www.ftourbabrayan.ma",
        });

        const emailResult = await sendEmail({
          to: normalizedEmail,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });

        if (emailResult.success) {
          await supabase
            .from("volunteers")
            .update({ email_sent: true })
            .eq("id", volunteer.id);
        }
      } catch (error) {
        console.error(
          "[Worker][volunteers.adminCreateManual] Error sending email:",
          error
        );
      }

      return { success: true, id: volunteer.id, qrToken };
    }),

  listByDay: adminProcedure
    .input(z.object({ dayId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Paginate through all volunteers to bypass the 1000-row default limit
      const fetchAllVolunteers = async () => {
        const pageSize = 1000;
        let from = 0;
        const allRows: any[] = [];

        while (true) {
          const to = from + pageSize - 1;
          let query = supabase
            .from("volunteers")
            .select("*, ramadan_days(*)")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to);

          if (input.dayId) {
            query = query.eq("day_id", input.dayId);
          }

          const { data, error } = await query;
          if (error) {
            console.error("[Worker] Error fetching volunteers:", error);
            return allRows;
          }

          const rows = data ?? [];
          allRows.push(...rows);

          if (rows.length < pageSize) break;
          from += pageSize;
        }

        return allRows;
      };

      // Fetch all attendance rows (all days) to compute per-volunteer presence frequency
      const fetchAllAttendances = async () => {
        const pageSize = 1000;
        let from = 0;
        const allRows: Array<{
          email: string | null;
          day_id: number | null;
          status: string | null;
          qr_status: string | null;
          scanned_at: string | null;
        }> = [];

        while (true) {
          const to = from + pageSize - 1;
          const { data, error } = await supabase
            .from("volunteers")
            .select("email, day_id, status, qr_status, scanned_at")
            .order("id", { ascending: true })
            .range(from, to);

          if (error) break;

          const rows = data ?? [];
          allRows.push(...rows);

          if (rows.length < pageSize) break;
          from += pageSize;
        }

        return allRows;
      };

      const [data, allAttendances] = await Promise.all([
        fetchAllVolunteers(),
        fetchAllAttendances(),
      ]);

      // Build attendance frequency map (count distinct days where volunteer was present)
      const attendanceFrequencyByEmail = new Map<string, number>();
      const seenPairs = new Set<string>();
      for (const row of allAttendances) {
        const email = String(row.email ?? "")
          .toLowerCase()
          .trim();
        if (!email) continue;

        const isPresent =
          row.status !== "cancelled" &&
          (row.status === "present" ||
            row.qr_status === "validated" ||
            !!row.scanned_at);

        if (!isPresent) continue;

        const pairKey = `${email}:${row.day_id}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        attendanceFrequencyByEmail.set(
          email,
          (attendanceFrequencyByEmail.get(email) ?? 0) + 1
        );
      }

      // Get all days for the dropdown
      const { data: daysData } = await supabase
        .from("ramadan_days")
        .select("*")
        .order("day_number", { ascending: true });

      const volunteers = (data || []).map((v: any) => ({
        id: v.id,
        firstName: v.first_name,
        lastName: v.last_name,
        email: v.email,
        attendanceFrequency:
          attendanceFrequencyByEmail.get(
            String(v.email ?? "")
              .toLowerCase()
              .trim()
          ) ?? 0,
        phone: v.phone,
        city: v.city,
        dayId: v.day_id,
        volunteerSlots: normalizeVolunteerSlots(v.volunteer_slots),
        qrToken: v.qr_token,
        qrStatus: v.qr_status,
        status: v.status,
        scannedAt: v.scanned_at,
        acceptedTerms: v.accepted_terms,
        emailSent: v.email_sent,
        createdAt: v.created_at,
        day: v.ramadan_days
          ? {
              id: v.ramadan_days.id,
              dayNumber: v.ramadan_days.day_number,
              date: v.ramadan_days.date,
            }
          : null,
      }));

      const days = (daysData || []).map((d: any) => ({
        id: d.id,
        dayNumber: d.day_number,
        date: d.date,
      }));

      return { volunteers, days };
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { count: total } = await supabase
      .from("volunteers")
      .select("*", { count: "exact", head: true });

    const { count: present } = await supabase
      .from("volunteers")
      .select("*", { count: "exact", head: true })
      .eq("status", "present");

    const { count: registered } = await supabase
      .from("volunteers")
      .select("*", { count: "exact", head: true })
      .eq("status", "registered");

    return {
      total: total || 0,
      present: present || 0,
      registered: registered || 0,
      absent: (total || 0) - (present || 0) - (registered || 0),
    };
  }),

  // Check-in d'un bénévole via QR code
  checkIn: scannerProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get volunteer by QR token
      const { data: volunteer, error } = await supabase
        .from("volunteers")
        .select("*, ramadan_days(*)")
        .eq("qr_token", input.qrCode)
        .single();

      if (error || !volunteer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "QR code invalide" });
      }

      if (volunteer.qr_status === "validated") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR code déjà validé",
        });
      }

      // Update volunteer status
      await supabase
        .from("volunteers")
        .update({
          qr_status: "validated",
          status: "present",
          scanned_at: new Date().toISOString(),
          scanned_by: ctx.user?.id,
        })
        .eq("id", volunteer.id);

      // Create checkin record
      await supabase.from("checkins").insert({
        volunteer_id: volunteer.id,
        day_id: volunteer.day_id,
        scanned_by: ctx.user?.id,
        scan_method: "qr_code",
        is_valid: true,
      });

      return {
        success: true,
        volunteer: {
          id: volunteer.id,
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
          dayNumber: volunteer.ramadan_days?.day_number,
        },
      };
    }),

  // Mise à jour du statut d'un bénévole
  updateStatus: adminProcedure
    .input(
      z.object({
        volunteerId: z.number(),
        status: z.enum([
          "registered",
          "confirmed",
          "present",
          "absent",
          "cancelled",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("volunteers")
        .update({ status: input.status })
        .eq("id", input.volunteerId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  // Suppression d'un bénévole
  delete: adminProcedure
    .input(z.object({ volunteerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Delete volunteer
      const { error } = await supabase
        .from("volunteers")
        .delete()
        .eq("id", input.volunteerId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  // Inscription groupe bénévole avec fichier Excel
  registerGroup: publicProcedure
    .input(
      z.object({
        groupName: z.string().min(2, "Nom du groupe requis"),
        responsibleName: z.string().min(2, "Nom du responsable requis"),
        responsibleEmail: z.string().email("Email invalide"),
        responsiblePhone: z.string().min(8, "Téléphone invalide"),
        estimatedSize: z.number().optional(),
        dayId: z.number(),
        volunteerSlots: z
          .array(z.enum(["preparation_ftour", "service_ftour"]))
          .min(1, "Veuillez sélectionner au moins un créneau"),
        fileName: z.string(),
        fileBase64: z
          .string()
          .max(7_000_000, "Fichier trop volumineux (max 5 Mo)"),
        acceptedTerms: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.acceptedTerms) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous devez accepter les conditions",
        });
      }

      // Validate file extension
      const ext = input.fileName.toLowerCase().split(".").pop();
      if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv",
        });
      }

      const supabase = createSupabaseAdmin(ctx.env);

      // Get day info for availability and email
      const { data: day, error: dayError } = await supabase
        .from("ramadan_days")
        .select("*")
        .eq("id", input.dayId)
        .single();

      if (dayError || !day) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jour non trouvé" });
      }

      if (!day.is_open) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce jour est fermé aux inscriptions",
        });
      }

      const estimatedGroupSize = Math.max(1, input.estimatedSize ?? 1);
      const availableSeats = Math.max(
        0,
        day.capacity - (day.registered_count ?? 0)
      );
      if (estimatedGroupSize > availableSeats) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le jour choisi est complet pour ce volume de groupe. Merci de choisir un autre jour ou de réduire l'effectif.",
        });
      }

      const normalizedGroupEmail = input.responsibleEmail.toLowerCase().trim();

      const { data: createdRequest, error: requestError } = await supabase
        .from("volunteer_group_requests")
        .insert({
          group_name: input.groupName,
          responsible_name: input.responsibleName,
          responsible_email: normalizedGroupEmail,
          responsible_phone: input.responsiblePhone,
          estimated_size: input.estimatedSize,
          day_id: input.dayId,
          volunteer_slots: input.volunteerSlots,
          file_name: input.fileName,
          file_base64: input.fileBase64,
        })
        .select("id")
        .single();

      if (requestError || !createdRequest) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            requestError?.message || "Erreur lors de la création de la demande",
        });
      }

      // Build and send email with attachment to admin
      const {
        sendEmail,
        generateGroupRegistrationEmail,
        generateGroupRegistrationAcknowledgementEmail,
      } = await import("./email");
      const emailData = generateGroupRegistrationEmail({
        groupName: input.groupName,
        responsibleName: input.responsibleName,
        responsibleEmail: input.responsibleEmail,
        responsiblePhone: input.responsiblePhone,
        estimatedSize: input.estimatedSize,
        volunteerSlots: input.volunteerSlots,
        dayNumber: day?.day_number,
        dayDate: day?.date
          ? new Date(day.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : undefined,
        startTime: day?.iftar_time || "18h00",
        fileName: input.fileName,
      });

      try {
        const adminEmailResult = await sendEmail({
          to: "naylabennani@hotmail.com",
          cc: ["reda.sebbani@gmail.com"],
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          attachments: [
            {
              filename: input.fileName,
              content: input.fileBase64,
            },
          ],
        });
        if (adminEmailResult.success) {
          console.log("[Group Registration] Admin email sent successfully");
        } else {
          console.error(
            "[Group Registration] Admin email failed:",
            adminEmailResult.error || "Unknown error"
          );
        }
      } catch (error) {
        console.error("[Group Registration] Admin email failed:", error);
      }

      try {
        const acknowledgementEmail =
          generateGroupRegistrationAcknowledgementEmail({
            responsibleName: input.responsibleName,
            groupName: input.groupName,
            dayNumber: day?.day_number,
            dayDate: day?.date
              ? new Date(day.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : undefined,
            estimatedSize: input.estimatedSize,
            volunteerSlots: input.volunteerSlots,
            startTime: day?.iftar_time || "18h00",
          });

        const acknowledgementResult = await sendEmail({
          to: normalizedGroupEmail,
          subject: acknowledgementEmail.subject,
          html: acknowledgementEmail.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });

        if (acknowledgementResult.success) {
          console.log(
            "[Group Registration] Responsible acknowledgement email sent successfully"
          );
        } else {
          console.error(
            "[Group Registration] Responsible acknowledgement email failed:",
            acknowledgementResult.error || "Unknown error"
          );
        }
      } catch (error) {
        console.error(
          "[Group Registration] Responsible acknowledgement email failed:",
          error
        );
      }

      return {
        success: true,
        requestId: createdRequest.id,
        message:
          "Votre demande groupe a bien été envoyée. Elle sera traitée par l'administration.",
      };
    }),

  listGroupRequests: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("volunteer_group_requests")
      .select("*, ramadan_days(id, day_number, date)")
      .order("created_at", { ascending: false });

    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }

    return (data || []).map(row => ({
      id: row.id,
      groupName: row.group_name,
      responsibleName: row.responsible_name,
      responsibleEmail: row.responsible_email,
      responsiblePhone: row.responsible_phone,
      estimatedSize: row.estimated_size,
      dayId: row.day_id,
      volunteerSlots: normalizeVolunteerSlots(row.volunteer_slots),
      fileName: row.file_name,
      status: row.status,
      rejectionReason: row.rejection_reason,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      day: row.ramadan_days
        ? {
            id: row.ramadan_days.id,
            dayNumber: row.ramadan_days.day_number,
            date: row.ramadan_days.date,
          }
        : null,
    }));
  }),

  getGroupRequestAttachment: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from("volunteer_group_requests")
        .select("file_name, file_base64")
        .eq("id", input.requestId)
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Demande introuvable",
        });
      }

      return {
        fileName: data.file_name,
        fileBase64: data.file_base64,
      };
    }),

  updateGroupRequest: adminProcedure
    .input(
      z.object({
        requestId: z.number(),
        groupName: z.string().min(2).optional(),
        responsibleName: z.string().min(2).optional(),
        responsibleEmail: z.string().email().optional(),
        responsiblePhone: z.string().min(8).optional(),
        estimatedSize: z.number().int().positive().nullable().optional(),
        dayId: z.number().optional(),
        volunteerSlots: z
          .array(z.enum(["preparation_ftour", "service_ftour"]))
          .min(1)
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.groupName !== undefined)
        updatePayload.group_name = input.groupName;
      if (input.responsibleName !== undefined)
        updatePayload.responsible_name = input.responsibleName;
      if (input.responsibleEmail !== undefined)
        updatePayload.responsible_email = input.responsibleEmail
          .toLowerCase()
          .trim();
      if (input.responsiblePhone !== undefined)
        updatePayload.responsible_phone = input.responsiblePhone;
      if (input.estimatedSize !== undefined)
        updatePayload.estimated_size = input.estimatedSize;
      if (input.dayId !== undefined) updatePayload.day_id = input.dayId;
      if (input.volunteerSlots !== undefined)
        updatePayload.volunteer_slots = input.volunteerSlots;

      const { data, error } = await supabase
        .from("volunteer_group_requests")
        .update(updatePayload)
        .eq("id", input.requestId)
        .select("*")
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error?.message || "Impossible de modifier la demande",
        });
      }

      return { success: true, request: data };
    }),

  reviewGroupRequest: adminProcedure
    .input(
      z.object({
        requestId: z.number(),
        action: z.enum(["validate", "refuse"]),
        rejectionReason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: request, error: requestError } = await supabase
        .from("volunteer_group_requests")
        .select("*")
        .eq("id", input.requestId)
        .maybeSingle();

      if (requestError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: requestError.message,
        });
      }

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Demande introuvable",
        });
      }

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette demande a déjà été traitée.",
        });
      }

      const dayId = request.day_id;
      let validationQrToken: string | null = null;
      let validationDay: any = null;

      if (input.action === "validate") {
        const { data: day, error: dayError } = await supabase
          .from("ramadan_days")
          .select("*")
          .eq("id", dayId)
          .single();

        if (dayError || !day) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Jour non trouvé",
          });
        }

        validationDay = day;

        const estimatedSize = Number(request.estimated_size ?? 1);
        const normalizedEstimatedSize =
          Number.isFinite(estimatedSize) && estimatedSize > 0
            ? estimatedSize
            : 1;
        const availableSeats = Math.max(
          0,
          day.capacity - (day.registered_count ?? 0)
        );

        if (normalizedEstimatedSize > availableSeats) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Le jour choisi est complet pour cet effectif de groupe.",
          });
        }

        const normalizedResponsibleEmail = String(request.responsible_email)
          .toLowerCase()
          .trim();

        const { data: duplicateVolunteer, error: duplicateError } =
          await supabase
            .from("volunteers")
            .select("id")
            .eq("day_id", dayId)
            .eq("email", normalizedResponsibleEmail)
            .limit(1)
            .maybeSingle();

        if (duplicateError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: duplicateError.message,
          });
        }

        if (duplicateVolunteer) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Le responsable est déjà inscrit sur ce jour.",
          });
        }

        const qrToken = crypto.randomUUID();
        validationQrToken = qrToken;
        const responsibleName = String(request.responsible_name || "").trim();
        const nameParts = responsibleName.split(/\s+/).filter(Boolean);

        const { error: createVolunteerError } = await supabase
          .from("volunteers")
          .insert({
            first_name: nameParts[0] || request.group_name,
            last_name: nameParts.slice(1).join(" ") || request.group_name,
            email: normalizedResponsibleEmail,
            phone: request.responsible_phone,
            day_id: dayId,
            volunteer_slots: request.volunteer_slots || [],
            qr_token: qrToken,
            qr_status: "generated",
            status: "registered",
            accepted_terms: true,
            email_sent: false,
          });

        if (createVolunteerError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: createVolunteerError.message,
          });
        }

        await supabase
          .from("ramadan_days")
          .update({
            registered_count: (day.registered_count ?? 0) + 1,
            is_open: (day.registered_count ?? 0) + 1 < day.capacity,
          })
          .eq("id", dayId);
      }

      const { data: updated, error: updateError } = await supabase
        .from("volunteer_group_requests")
        .update({
          status: input.action === "validate" ? "validated" : "refused",
          rejection_reason:
            input.action === "refuse" ? (input.rejectionReason ?? null) : null,
          reviewed_by: ctx.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.requestId)
        .select("*")
        .single();

      if (updateError || !updated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            updateError?.message || "Impossible de mettre à jour la demande",
        });
      }

      try {
        const normalizedResponsibleEmail = String(
          request.responsible_email || ""
        )
          .toLowerCase()
          .trim();

        if (normalizedResponsibleEmail) {
          const {
            sendEmail,
            generateVolunteerConfirmationEmail,
            generateGroupRefusalEmail,
          } = await import("./email");
          const responsibleName = String(request.responsible_name || "").trim();
          const groupName = String(request.group_name || "").trim();

          if (input.action === "validate") {
            let subject = "Votre demande groupe bénévole est validée";
            let html = `<p>Bonjour ${responsibleName},</p><p>Votre demande d'inscription groupe <strong>${groupName}</strong>${validationDay ? ` pour le jour ${validationDay.day_number} du Ramadan` : ""} a été validée.</p>`;

            if (validationQrToken && validationDay) {
              const nameParts = responsibleName.split(/\s+/).filter(Boolean);
              const emailData = generateVolunteerConfirmationEmail({
                firstName: nameParts[0] || groupName,
                lastName: nameParts.slice(1).join(" ") || groupName,
                email: normalizedResponsibleEmail,
                dayNumber: validationDay.day_number,
                dayDate: new Date(validationDay.date).toLocaleDateString(
                  "fr-FR",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }
                ),
                location:
                  validationDay.location || "Association Bab Rayan, Casablanca",
                startTime: validationDay.iftar_time || "18h00",
                volunteerSlots: (request.volunteer_slots || []) as string[],
                qrToken: validationQrToken,
                baseUrl: "https://www.ftourbabrayan.ma",
              });
              subject = emailData.subject;
              html = emailData.html;
            }

            await sendEmail({
              to: normalizedResponsibleEmail,
              subject,
              html,
              apiKey:
                ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
            });

            // Process Excel file with participant list
            const requestFileBase64 = String(request.file_base64 ?? "").trim();
            if (requestFileBase64 && validationDay) {
              try {
                const parsedRows =
                  _parseGroupVolunteersFromSpreadsheet(requestFileBase64);
                if (parsedRows.length > 0) {
                  let emailsSent = 0,
                    emailsFailed = 0,
                    qrCreated = 0;
                  const CHUNK_SIZE = 50;

                  for (
                    let chunkStart = 0;
                    chunkStart < parsedRows.length;
                    chunkStart += CHUNK_SIZE
                  ) {
                    const chunk = parsedRows.slice(
                      chunkStart,
                      chunkStart + CHUNK_SIZE
                    );
                    for (const row of chunk) {
                      try {
                        // Skip if already registered for this day
                        const { data: existing } = await supabase
                          .from("volunteers")
                          .select("id")
                          .eq("email", row.email)
                          .eq("day_id", dayId)
                          .limit(1)
                          .maybeSingle();
                        if (existing) continue;

                        const qrToken = crypto.randomUUID();
                        const { error: insertErr } = await supabase
                          .from("volunteers")
                          .insert({
                            first_name: row.firstName,
                            last_name: row.lastName,
                            email: row.email,
                            phone: row.phone,
                            city: row.city ?? null,
                            day_id: dayId,
                            volunteer_slots: request.volunteer_slots || [],
                            qr_token: qrToken,
                            qr_status: "generated",
                            status: "registered",
                            accepted_terms: true,
                            email_sent: false,
                          });
                        if (insertErr) {
                          console.error(
                            "[ReviewGroupRequest] Insert error:",
                            insertErr.message
                          );
                          continue;
                        }
                        qrCreated++;

                        // Send confirmation email with QR code
                        const participantEmailData =
                          generateVolunteerConfirmationEmail({
                            firstName: row.firstName,
                            lastName: row.lastName,
                            email: row.email,
                            dayNumber: validationDay.day_number,
                            dayDate: new Date(
                              validationDay.date
                            ).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            }),
                            location:
                              validationDay.location ||
                              "Association Bab Rayan, Casablanca",
                            startTime: validationDay.iftar_time || "18h00",
                            volunteerSlots: (request.volunteer_slots ||
                              []) as string[],
                            qrToken,
                            baseUrl: "https://www.ftourbabrayan.ma",
                          });
                        const emailResult = await sendEmail({
                          to: row.email,
                          subject: participantEmailData.subject,
                          html: participantEmailData.html,
                          apiKey:
                            ctx.env.RESEND_API_KEY ||
                            ctx.env.EMAIL_PROVIDER_KEY ||
                            "",
                        });
                        if (emailResult.success) {
                          emailsSent++;
                          await supabase
                            .from("volunteers")
                            .update({ email_sent: true })
                            .eq("qr_token", qrToken);
                        } else {
                          emailsFailed++;
                        }
                      } catch (rowErr) {
                        console.error(
                          "[ReviewGroupRequest] Row processing error:",
                          rowErr
                        );
                      }
                    }
                    // Delay between chunks to respect Resend rate limits
                    if (chunkStart + CHUNK_SIZE < parsedRows.length) {
                      await new Promise(resolve => setTimeout(resolve, 800));
                    }
                  }

                  // Send dispatch summary to admins
                  try {
                    const summaryDayDate = new Date(
                      validationDay.date
                    ).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    });
                    await sendEmail({
                      to: "contact@ftourbabrayan.ma",
                      cc: [...GROUP_MAIL_DISPATCH_CC],
                      subject: `QR groupe envoyés - ${groupName} (${emailsSent} emails envoyés)`,
                      html: `<p>Bonjour,</p><p>Les emails d'inscription du groupe ont été traités.</p><ul><li><strong>Groupe :</strong> ${groupName}</li><li><strong>Responsable :</strong> ${responsibleName}</li><li><strong>Email responsable :</strong> ${normalizedResponsibleEmail}</li><li><strong>Jour Ramadan :</strong> ${validationDay.day_number} (${summaryDayDate})</li><li><strong>QR codes produits :</strong> ${qrCreated}</li><li><strong>Emails envoyés :</strong> ${emailsSent}</li><li><strong>Emails en échec :</strong> ${emailsFailed}</li></ul><p>Ceci est un message d'information automatique.</p>`,
                      apiKey:
                        ctx.env.RESEND_API_KEY ||
                        ctx.env.EMAIL_PROVIDER_KEY ||
                        "",
                    });
                  } catch (summaryErr) {
                    console.error(
                      "[ReviewGroupRequest] Failed to send dispatch summary:",
                      summaryErr
                    );
                  }

                  console.log(
                    `[ReviewGroupRequest] File processed for request ${input.requestId}: ${qrCreated} QR created, ${emailsSent} sent, ${emailsFailed} failed`
                  );
                }
              } catch (fileErr) {
                console.error(
                  `[ReviewGroupRequest] Failed to process attachment for request ${input.requestId}:`,
                  fileErr
                );
              }
            }
          } else {
            const refusalEmailData = generateGroupRefusalEmail({
              responsibleName,
              groupName,
              rejectionReason: input.rejectionReason,
            });
            await sendEmail({
              to: normalizedResponsibleEmail,
              subject: refusalEmailData.subject,
              html: refusalEmailData.html,
              apiKey:
                ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
            });
          }
        }
      } catch (error) {
        console.error(
          "[Group Request] Failed to send review notification email",
          error
        );
      }

      return { success: true, request: updated };
    }),

  deleteGroupRequest: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("volunteer_group_requests")
        .delete()
        .eq("id", input.requestId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  // Import groupe Excel - traitement admin d'un fichier Excel pour inscrire plusieurs bénévoles
  processGroupExcel: adminProcedure
    .input(
      z.object({
        dayId: z.number(),
        volunteerSlots: z
          .array(z.enum(["preparation_ftour", "service_ftour"]))
          .min(1),
        fileBase64: z
          .string()
          .max(7_000_000, "Fichier trop volumineux (max 5 Mo)"),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get day info
      const { data: day, error: dayError } = await supabase
        .from("ramadan_days")
        .select("*")
        .eq("id", input.dayId)
        .single();

      if (dayError || !day) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jour non trouvé" });
      }

      // Parse the Excel file using the shared robust parser
      let parsedRows: ParsedGroupRow[];
      try {
        parsedRows = _parseGroupVolunteersFromSpreadsheet(input.fileBase64);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Impossible de lire le fichier Excel. Vérifiez le format.",
        });
      }

      if (parsedRows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Colonnes requises introuvables (Nom/Prénom, Email) ou aucune ligne valide dans le fichier.",
        });
      }

      const { generateVolunteerConfirmationEmail } = await import("./email");
      const results: { email: string; success: boolean; error?: string }[] = [];
      const CHUNK_SIZE = 50;

      for (
        let chunkStart = 0;
        chunkStart < parsedRows.length;
        chunkStart += CHUNK_SIZE
      ) {
        const chunk = parsedRows.slice(chunkStart, chunkStart + CHUNK_SIZE);

        for (const row of chunk) {
          try {
            // Check if already registered for this day
            const { data: existing } = await supabase
              .from("volunteers")
              .select("id")
              .eq("email", row.email)
              .eq("day_id", input.dayId)
              .maybeSingle();

            if (existing) {
              results.push({
                email: row.email,
                success: false,
                error: "Déjà inscrit pour ce jour",
              });
              continue;
            }

            // Generate QR token and create volunteer entry
            const qrToken = crypto.randomUUID();
            const { data: volunteer, error: volError } = await supabase
              .from("volunteers")
              .insert({
                first_name: row.firstName,
                last_name: row.lastName,
                email: row.email,
                phone: row.phone,
                city: row.city ?? null,
                day_id: input.dayId,
                volunteer_slots: input.volunteerSlots,
                qr_token: qrToken,
                qr_status: "generated",
                status: "registered",
                accepted_terms: true,
                email_sent: false,
              })
              .select()
              .single();

            if (volError) {
              results.push({
                email: row.email,
                success: false,
                error: volError.message,
              });
              continue;
            }

            // Send confirmation email with QR code
            try {
              const emailData = generateVolunteerConfirmationEmail({
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                dayNumber: day.day_number,
                dayDate: new Date(day.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }),
                location: day.location || "Association Bab Rayan, Casablanca",
                startTime: day.iftar_time || "18h00",
                volunteerSlots: input.volunteerSlots,
                qrToken,
                baseUrl: "https://www.ftourbabrayan.ma",
              });

              const emailResult = await sendEmail({
                to: row.email,
                subject: emailData.subject,
                html: emailData.html,
                apiKey:
                  ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
              });

              if (emailResult.success) {
                await supabase
                  .from("volunteers")
                  .update({ email_sent: true })
                  .eq("id", volunteer!.id);
                results.push({ email: row.email, success: true });
              } else {
                results.push({
                  email: row.email,
                  success: true,
                  error: `Inscrit mais email non envoyé: ${emailResult.error}`,
                });
              }
            } catch (emailError) {
              results.push({
                email: row.email,
                success: true,
                error: "Inscrit mais email non envoyé",
              });
              console.error(
                `[ProcessGroupExcel] Email error for ${row.email}:`,
                emailError
              );
            }
          } catch (error) {
            const errMsg =
              error instanceof Error ? error.message : "Erreur inconnue";
            results.push({ email: row.email, success: false, error: errMsg });
            console.error(`[ProcessGroupExcel] Error for ${row.email}:`, error);
          }
        }

        // Delay between chunks to respect Resend rate limits
        if (chunkStart + CHUNK_SIZE < parsedRows.length) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log(
        `[ProcessGroupExcel] Completed: ${successCount} success, ${failCount} failures out of ${parsedRows.length} rows`
      );

      return { results, successCount, failCount, totalRows: parsedRows.length };
    }),
});

// ============================================
// CHECKIN ROUTER
// ============================================

const checkinRouter = router({
  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: volunteer, error } = await supabase
        .from("volunteers")
        .select("*, ramadan_days(*)")
        .eq("qr_token", input.token)
        .single();

      if (error || !volunteer) {
        return { valid: false, error: "QR code invalide" };
      }

      if (volunteer.qr_status === "validated") {
        return { valid: false, error: "QR code déjà utilisé", volunteer };
      }

      return {
        valid: true,
        volunteer: {
          id: volunteer.id,
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
          email: volunteer.email,
          dayNumber: volunteer.ramadan_days?.day_number,
          date: volunteer.ramadan_days?.date,
        },
      };
    }),

  validate: scannerProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get volunteer
      const { data: volunteer, error } = await supabase
        .from("volunteers")
        .select("*")
        .eq("qr_token", input.token)
        .single();

      if (error || !volunteer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bénévole non trouvé",
        });
      }

      if (volunteer.qr_status === "validated") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR code déjà validé",
        });
      }

      // Update volunteer status
      await supabase
        .from("volunteers")
        .update({
          qr_status: "validated",
          status: "present",
          scanned_at: new Date().toISOString(),
          scanned_by: ctx.user?.id,
        })
        .eq("id", volunteer.id);

      // Create checkin record
      await supabase.from("checkins").insert({
        volunteer_id: volunteer.id,
        token: input.token,
        scanned_at: new Date().toISOString(),
        validated_by: ctx.user?.id,
        validation_mode: "scan",
      });

      return { success: true };
    }),

  cancelVolunteer: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Récupérer le bénévole par son token
      const { data: volunteer, error } = await supabase
        .from("volunteers")
        .select("*")
        .eq("qr_token", input.token)
        .single();

      if (error || !volunteer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscription introuvable. Le lien est peut-être invalide.",
        });
      }

      // Déjà annulé
      if (volunteer.status === "cancelled") {
        return {
          success: true,
          alreadyCancelled: true,
          message: "Cette inscription a déjà été annulée.",
          volunteer: {
            firstName: volunteer.first_name,
            lastName: volunteer.last_name,
          },
        };
      }

      // Déjà validé sur site
      if (
        volunteer.status === "present" ||
        volunteer.qr_status === "validated"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Impossible d'annuler : votre présence a déjà été validée sur site.",
        });
      }

      // Annuler l'inscription
      await supabase
        .from("volunteers")
        .update({ status: "cancelled", qr_status: "expired" })
        .eq("id", volunteer.id);

      return {
        success: true,
        alreadyCancelled: false,
        message: "Votre inscription a bien été annulée.",
        volunteer: {
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
        },
      };
    }),
});

// ============================================
// GOODIES ROUTER
// ============================================

const goodiesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    // Try fetching active goodies with variants join first
    let { data, error } = await supabase
      .from("goodies")
      .select("*, goodie_variants(*)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    // If the variants join fails (FK not set up), fall back to goodies only
    if (error) {
      console.warn(
        "[Worker][Goodies] Variants join failed, fetching without variants:",
        error.message
      );
      const fallback = await supabase
        .from("goodies")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (fallback.error) {
        console.error(
          "[Worker][Goodies] Failed to fetch goodies:",
          fallback.error.message
        );
        return [];
      }
      data =
        fallback.data?.map((g: any) => ({ ...g, goodie_variants: [] })) ?? null;
    }

    return (data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      price: parseFloat(g.price),
      imageUrl: g.image_url,
      category: g.category,
      isActive: g.is_active,
      sortOrder: g.sort_order,
      stock: g.stock ?? 0,
      variants: (g.goodie_variants || []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        priceModifier: parseFloat(v.price_modifier),
        isAvailable: v.is_available,
      })),
      createdAt: new Date(g.created_at),
    }));
  }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    // Fetch all goodies (active + inactive) for admin
    let { data, error } = await supabase
      .from("goodies")
      .select("*, goodie_variants(*)")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn(
        "[Worker][Goodies] Variants join failed, fetching without variants:",
        error.message
      );
      const fallback = await supabase
        .from("goodies")
        .select("*")
        .order("sort_order", { ascending: true });
      if (fallback.error) {
        console.error(
          "[Worker][Goodies] Failed to fetch goodies:",
          fallback.error.message
        );
        return [];
      }
      data =
        fallback.data?.map((g: any) => ({ ...g, goodie_variants: [] })) ?? null;
    }

    return (data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      price: parseFloat(g.price),
      imageUrl: g.image_url,
      category: g.category,
      isActive: g.is_active,
      sortOrder: g.sort_order,
      stock: g.stock ?? 0,
      variants: (g.goodie_variants || []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        priceModifier: parseFloat(v.price_modifier),
        isAvailable: v.is_available,
      })),
      createdAt: new Date(g.created_at),
    }));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        price: z.number().min(0),
        stock: z.number().min(0).default(0),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from("goodies")
        .insert({
          name: input.name,
          description: input.description,
          price: String(input.price),
          stock: input.stock,
          image_url: input.imageUrl,
          category: input.category,
          is_active: input.isActive,
          sort_order: input.sortOrder,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { id: data.id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        stock: z.number().min(0).optional(),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, ...updateData } = input;

      const dbData: Record<string, any> = {};
      if (updateData.name !== undefined) dbData.name = updateData.name;
      if (updateData.description !== undefined)
        dbData.description = updateData.description;
      if (updateData.price !== undefined)
        dbData.price = String(updateData.price);
      if (updateData.stock !== undefined) dbData.stock = updateData.stock;
      if (updateData.imageUrl !== undefined)
        dbData.image_url = updateData.imageUrl;
      if (updateData.category !== undefined)
        dbData.category = updateData.category;
      if (updateData.isActive !== undefined)
        dbData.is_active = updateData.isActive;
      if (updateData.sortOrder !== undefined)
        dbData.sort_order = updateData.sortOrder;

      const { error } = await supabase
        .from("goodies")
        .update(dbData)
        .eq("id", id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Delete related order_items first (FK constraint: order_items_goodie_id_fkey)
      await supabase.from("order_items").delete().eq("goodie_id", input.id);

      // Delete related variants (FK constraint: goodie_variants_goodie_id_fkey)
      await supabase.from("goodie_variants").delete().eq("goodie_id", input.id);

      // Delete the goodie itself
      const { error } = await supabase
        .from("goodies")
        .delete()
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),
});

// ============================================
// ORDERS ROUTER
// ============================================

const ordersRouter = router({
  create: publicProcedure
    .input(
      z.object({
        customerName: z.string().min(2),
        customerEmail: z.string().email(),
        customerPhone: z.string().min(8),
        items: z.array(
          z.object({
            goodieId: z.number(),
            variantId: z.number().optional(),
            quantity: z.number().min(1),
            unitPrice: z.number().min(0),
          })
        ),
        pickupDate: z.string().optional(),
        pickupLocation: z.string().optional(),
        notes: z.string().optional(),
        deliveryMode: z.enum(["pickup", "home_delivery"]).default("pickup"),
        deliveryAddress: z.string().optional(),
        deliveryCity: z.string().optional(),
        deliveryNeighborhood: z.string().optional(),
        deliveryPostalCode: z.string().optional(),
        deliveryPhone: z.string().optional(),
        deliveryInstructions: z.string().optional(),
        paymentMethod: z
          .enum(["bank_transfer", "cheque", "cash"])
          .default("cash"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Generate order reference
      const orderRef = `FBR-${Date.now().toString(36).toUpperCase()}`;

      // Validate stock for items with variants
      for (const item of input.items) {
        if (item.variantId) {
          const { data: variant } = await supabase
            .from("goodie_variants")
            .select("stock, is_available")
            .eq("id", item.variantId)
            .single();
          if (!variant)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Variante #${item.variantId} introuvable`,
            });
          if (!variant.is_available)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Variante #${item.variantId} indisponible`,
            });
          if (variant.stock < item.quantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Stock insuffisant pour la variante #${item.variantId}`,
            });
          }
        }
      }

      // Calculate total and delivery fee
      const deliveryFee = input.deliveryMode === "home_delivery" ? 30 : 0;
      let totalAmount = deliveryFee;
      const orderItems: any[] = [];

      for (const item of input.items) {
        const itemTotal = item.unitPrice * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          goodie_id: item.goodieId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.unitPrice.toString(),
          total_price: itemTotal.toString(),
        });
      }

      // Build delivery address JSON if home delivery
      const deliveryAddressJson =
        input.deliveryMode === "home_delivery"
          ? JSON.stringify({
              address: input.deliveryAddress,
              city: input.deliveryCity,
              neighborhood: input.deliveryNeighborhood,
              postalCode: input.deliveryPostalCode,
            })
          : null;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_reference: orderRef,
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
          total_amount: totalAmount.toString(),
          status: "reserved",
          pickup_date: input.pickupDate,
          pickup_location: input.pickupLocation,
          notes: input.notes,
          delivery_mode: input.deliveryMode,
          delivery_fee: deliveryFee.toString(),
          delivery_address: deliveryAddressJson,
          delivery_phone:
            input.deliveryMode === "home_delivery" ? input.deliveryPhone : null,
          delivery_instructions:
            input.deliveryMode === "home_delivery"
              ? input.deliveryInstructions
              : null,
          payment_method: input.paymentMethod,
        })
        .select()
        .single();

      if (orderError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: orderError.message,
        });
      }

      // Create order items
      for (const item of orderItems) {
        await supabase
          .from("order_items")
          .insert({ ...item, order_id: order.id });
      }

      // Decrement stock for items with variants
      for (const item of input.items) {
        if (item.variantId) {
          const { data: variant } = await supabase
            .from("goodie_variants")
            .select("stock")
            .eq("id", item.variantId)
            .single();
          if (variant) {
            await supabase
              .from("goodie_variants")
              .update({ stock: Math.max(0, variant.stock - item.quantity) })
              .eq("id", item.variantId);
          }
        }
      }

      // Get goodie names for email
      const itemsForEmail: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }> = [];
      for (const item of input.items) {
        const { data: goodie } = await supabase
          .from("goodies")
          .select("name, price")
          .eq("id", item.goodieId)
          .single();
        if (goodie) {
          itemsForEmail.push({
            name: goodie.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
          });
        }
      }

      // Send confirmation email
      try {
        const { sendEmail, generateOrderConfirmationEmail } = await import(
          "./email"
        );
        const emailData = generateOrderConfirmationEmail({
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          orderReference: orderRef,
          items: itemsForEmail,
          totalAmount,
          pickupLocation: input.pickupLocation,
          pickupDate: input.pickupDate,
        });

        await sendEmail({
          to: input.customerEmail,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailError) {
        console.error("[Worker] Error sending order email:", emailError);
        // Don't throw - order is still successful
      }

      return { id: order.id, orderReference: orderRef, totalAmount };
    }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, goodies(*))")
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(o => ({
      id: o.id,
      orderReference: o.order_reference,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone,
      totalAmount: o.total_amount,
      status: o.status,
      pickupDate: o.pickup_date,
      pickupLocation: o.pickup_location,
      notes: o.notes,
      createdAt: o.created_at,
      items: (o.order_items || []).map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.total_price,
        goodie: i.goodies
          ? {
              id: i.goodies.id,
              name: i.goodies.name,
            }
          : null,
      })),
    }));
  }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data: orders, error } = await supabase
      .from("orders")
      .select("status, total_amount");

    if (error || !orders) {
      return {
        total: 0,
        reserved: 0,
        paid: 0,
        delivered: 0,
        cancelled: 0,
        revenue: 0,
      };
    }

    const stats = {
      total: orders.length,
      reserved: orders.filter(o => o.status === "reserved").length,
      paid: orders.filter(o => o.status === "paid").length,
      delivered: orders.filter(o => o.status === "delivered").length,
      cancelled: orders.filter(o => o.status === "cancelled").length,
      revenue: orders
        .filter(o => o.status !== "cancelled")
        .reduce((sum, o) => sum + parseFloat(o.total_amount || "0"), 0),
    };

    return stats;
  }),

  updateStatus: adminProcedure
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum([
          "reserved",
          "confirmed",
          "paid",
          "delivered",
          "cancelled",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("orders")
        .update({ status: input.status, processed_by: ctx.user?.id })
        .eq("id", input.orderId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  getByReference: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: order, error } = await supabase
        .from("orders")
        .select("*, order_items(*, goodies(name))")
        .eq("order_reference", input.reference)
        .single();

      if (error || !order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      // Parse delivery address if it's a JSON string
      let deliveryAddress = null;
      let deliveryCity = null;
      let deliveryNeighborhood = null;
      let deliveryPostalCode = null;

      if (
        order.delivery_address &&
        typeof order.delivery_address === "string"
      ) {
        try {
          const parsed = JSON.parse(order.delivery_address);
          deliveryAddress = parsed.address;
          deliveryCity = parsed.city;
          deliveryNeighborhood = parsed.neighborhood;
          deliveryPostalCode = parsed.postalCode;
        } catch {
          deliveryAddress = order.delivery_address;
        }
      }

      return {
        id: order.id,
        orderReference: order.order_reference,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        pickupDate: order.pickup_date,
        pickupLocation: order.pickup_location,
        notes: order.notes,
        deliveryMode: order.delivery_mode,
        deliveryFee: order.delivery_fee ? parseFloat(order.delivery_fee) : 0,
        deliveryAddress,
        deliveryCity,
        deliveryNeighborhood,
        deliveryPostalCode,
        deliveryPhone: order.delivery_phone,
        deliveryInstructions: order.delivery_instructions,
        createdAt: new Date(order.created_at),
        items: (order.order_items || []).map((i: any) => ({
          id: i.id,
          goodieId: i.goodie_id,
          goodieName: i.goodies?.name,
          quantity: i.quantity,
          unitPrice: parseFloat(i.unit_price),
          totalPrice: parseFloat(i.total_price),
        })),
      };
    }),

  delete: adminProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", input.orderId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),
});

// ============================================
// DONATIONS ROUTER
// ============================================

const donationsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        donorName: z.string().min(2),
        donorEmail: z.string().email(),
        donorPhone: z.string().optional(),
        amount: z
          .union([z.number(), z.string()])
          .transform(val => (typeof val === "number" ? String(val) : val)),
        paymentMethod: z.enum(["transfer", "on_site", "cheque"]),
        message: z.string().optional(),
        isAnonymous: z.boolean().default(false),
        acceptsUpdates: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Generate donation reference
      const donationRef = `DON-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase
        .from("donations")
        .insert({
          donation_reference: donationRef,
          donor_name: input.donorName,
          donor_email: input.donorEmail,
          donor_phone: input.donorPhone,
          amount: input.amount,
          payment_method: input.paymentMethod,
          status: input.paymentMethod === "transfer" ? "pending" : "promised",
          message: input.message,
          is_anonymous: input.isAnonymous,
          accepts_updates: input.acceptsUpdates,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      // Send confirmation email
      try {
        const { sendEmail, generateDonationConfirmationEmail } = await import(
          "./email"
        );
        const emailData = generateDonationConfirmationEmail({
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donationReference: donationRef,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          message: input.message,
        });

        await sendEmail({
          to: input.donorEmail,
          subject: emailData.subject,
          html: emailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailError) {
        console.error("[Worker] Error sending donation email:", emailError);
        // Don't throw - donation is still successful
      }

      return { id: data.id, donationReference: donationRef };
    }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Worker] Donations listAll error:", error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      donationReference: d.donation_reference,
      donorName: d.donor_name,
      donorEmail: d.donor_email,
      donorPhone: d.donor_phone,
      amount:
        typeof d.amount === "string"
          ? parseFloat(d.amount) || 0
          : (d.amount ?? 0),
      paymentMethod: d.payment_method,
      status: d.status,
      message: d.message,
      isAnonymous: d.is_anonymous,
      acceptsUpdates: d.accepts_updates,
      createdAt: d.created_at,
    }));
  }),

  updateStatus: adminProcedure
    .input(
      z.object({
        donationId: z.number(),
        status: z.enum(["promised", "pending", "received", "cancelled"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("donations")
        .update({ status: input.status, processed_by: ctx.user?.id })
        .eq("id", input.donationId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      // Envoyer un email de confirmation quand le don passe au statut "reçu"
      if (input.status === "received") {
        try {
          const { data: donation } = await supabase
            .from("donations")
            .select(
              "donor_name, donor_email, donation_reference, amount, payment_method"
            )
            .eq("id", input.donationId)
            .single();

          if (donation) {
            const { sendEmail, generateDonationReceivedEmail } = await import(
              "./email"
            );
            const emailData = generateDonationReceivedEmail({
              donorName: donation.donor_name,
              donorEmail: donation.donor_email,
              donationReference: donation.donation_reference,
              amount:
                typeof donation.amount === "string"
                  ? parseFloat(donation.amount) || 0
                  : (donation.amount ?? 0),
              paymentMethod: donation.payment_method,
            });
            await sendEmail({
              to: donation.donor_email,
              subject: emailData.subject,
              html: emailData.html,
              apiKey:
                ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
            });
          }
        } catch (emailError) {
          console.error(
            "[Worker] Error sending donation received email:",
            emailError
          );
          // Don't throw - status update was successful
        }
      }

      return { success: true };
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data } = await supabase.from("donations").select("amount, status");

    const stats = {
      total: 0,
      received: 0,
      pending: 0,
      count: data?.length || 0,
    };

    for (const d of data || []) {
      const amount = parseFloat(d.amount) || 0;
      stats.total += amount;
      if (d.status === "received") stats.received += amount;
      if (d.status === "pending" || d.status === "promised")
        stats.pending += amount;
    }

    return stats;
  }),
});

// ============================================
// PASTRIES ROUTER (Catalogue Pâtisserie)
// ============================================

function isWorkerPastriesTableMissing(error: any): boolean {
  return (
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    error?.message?.includes("schema cache") ||
    error?.message?.includes("does not exist")
  );
}

const WORKER_PASTRIES_TABLE_MISSING_MSG =
  "La table \"pastries\" n'existe pas encore dans la base de données. Veuillez exécuter la migration SQL : supabase/migrations/add_pastry_and_qr_tables.sql dans l'éditeur SQL de Supabase.";

const pastriesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("pastries")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      if (isWorkerPastriesTableMissing(error)) {
        console.error(
          "[Worker] Pastries table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql"
        );
        return [];
      }
      console.error("[Worker] Pastries list error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erreur lors du chargement des pâtisseries",
      });
    }

    return (data || []).map(p => ({
      ...p,
      price:
        typeof p.price === "string" ? parseFloat(p.price) || 0 : (p.price ?? 0),
    }));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        price: z.number().positive(),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from("pastries")
        .insert({
          name: input.name,
          description: input.description,
          price: input.price,
          image_url: input.imageUrl,
          category: input.category,
          sort_order: input.sortOrder,
          active: true,
        })
        .select()
        .single();

      if (error) {
        if (isWorkerPastriesTableMissing(error)) {
          console.error(
            "[Worker][Pastries] Table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql"
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: WORKER_PASTRIES_TABLE_MISSING_MSG,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return data;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().positive().optional(),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.description) updateData.description = input.description;
      if (input.price) updateData.price = input.price;
      if (input.imageUrl) updateData.image_url = input.imageUrl;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.active !== undefined) updateData.active = input.active;
      if (input.sortOrder !== undefined)
        updateData.sort_order = input.sortOrder;

      const { data, error } = await supabase
        .from("pastries")
        .update(updateData)
        .eq("id", input.id)
        .select()
        .single();

      if (error) {
        if (isWorkerPastriesTableMissing(error)) {
          console.error(
            "[Worker][Pastries] Table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql"
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: WORKER_PASTRIES_TABLE_MISSING_MSG,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return data;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("pastries")
        .update({ active: false })
        .eq("id", input.id);

      if (error) {
        if (isWorkerPastriesTableMissing(error)) {
          console.error(
            "[Worker][Pastries] Table missing - run migration: supabase/migrations/add_pastry_and_qr_tables.sql"
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: WORKER_PASTRIES_TABLE_MISSING_MSG,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return { success: true };
    }),
});

// ============================================
// PASTRY ORDERS ROUTER (Commandes Pâtisserie)
// ============================================

const pastryOrdersRouter = router({
  create: publicProcedure
    .input(
      z.object({
        customerName: z.string(),
        phone: z.string(),
        email: z.string().email().optional(),
        items: z.array(
          z.object({
            pastryId: z.number(),
            quantity: z.number().positive(),
            price: z.number().positive(),
          })
        ),
        totalAmount: z.number().positive(),
        paymentMethod: z.enum([
          "bank_transfer",
          "cheque",
          "cash",
          "paypal",
          "cmi",
        ]),
        channel: z
          .enum(["online", "on_site_qr", "on_site_admin"])
          .default("online"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const reference = `PASTRY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const { data, error } = await supabase
        .from("pastry_orders")
        .insert({
          reference,
          customer_name: input.customerName,
          phone: input.phone,
          email: input.email,
          items: input.items,
          total_amount: input.totalAmount,
          payment_method: input.paymentMethod,
          payment_status: "pending",
          order_status: "reserved",
        })
        .select()
        .single();

      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });

      // Send confirmation email
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: input.email || input.phone,
          subject: `Confirmation de commande pâtisserie #${reference}`,
          html: `<h2>Commande Pâtisserie #${reference}</h2><p>Merci pour votre commande!</p><p>Montant total: ${input.totalAmount} DH</p><p>Méthode de paiement: ${input.paymentMethod}</p>`,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailError) {
        console.error("[Worker] Pastry order email error:", emailError);
      }

      return data;
    }),

  list: adminProcedure
    .input(
      z.object({
        status: z.string().optional(),
        paymentStatus: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      let query = supabase.from("pastry_orders").select("*");

      if (input.status) {
        query = query.eq("order_status", input.status);
      }
      if (input.paymentStatus) {
        query = query.eq("payment_status", input.paymentStatus);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("[Worker] Pastry orders list error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du chargement des commandes pâtisserie",
        });
      }

      return (data || []).map(o => ({
        ...o,
        total_amount:
          typeof o.total_amount === "string"
            ? parseFloat(o.total_amount) || 0
            : (o.total_amount ?? 0),
      }));
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        orderId: z.number(),
        orderStatus: z.enum(["reserved", "paid", "handed", "cancelled"]),
        paymentStatus: z
          .enum(["pending", "confirmed", "paid", "cancelled"])
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const updateData: Record<string, unknown> = {
        order_status: input.orderStatus,
      };
      if (input.paymentStatus) {
        updateData.payment_status = input.paymentStatus;
      }

      const { error } = await supabase
        .from("pastry_orders")
        .update(updateData)
        .eq("id", input.orderId);

      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return { success: true };
    }),
});

// ============================================
// CONTACT ROUTER
// ============================================

const contactRouter = router({
  send: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        subject: z.string().optional(),
        message: z.string().min(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const data = await siteDb.insertContact(galleryDb.db(ctx.env), input);

      // Send confirmation email to user and notification to admin
      try {
        const {
          sendEmail,
          generateContactConfirmationEmail,
          generateContactAdminNotificationEmail,
        } = await import("./email");

        // Send confirmation to user
        const userEmailData = generateContactConfirmationEmail({
          name: input.name,
          email: input.email,
          phone: input.phone,
          subject: input.subject || "Contact",
          message: input.message,
        });

        await sendEmail({
          to: input.email,
          subject: userEmailData.subject,
          html: userEmailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });

        // Send notification to admin
        const adminEmailData = generateContactAdminNotificationEmail({
          name: input.name,
          email: input.email,
          phone: input.phone,
          subject: input.subject || "Contact",
          message: input.message,
        });

        await sendEmail({
          to: "contact@ftourbabrayan.ma",
          subject: adminEmailData.subject,
          html: adminEmailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailError) {
        console.error("[Worker] Error sending contact email:", emailError);
        // Don't throw - contact message is still saved
      }

      return { id: data.id };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await siteDb.listContacts(galleryDb.db(ctx.env));
    return rows.map((m: any) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      subject: m.subject,
      message: m.message,
      isRead: m.is_read,
      createdAt: m.created_at,
    }));
  }),

  markAsRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await siteDb.markContactRead(galleryDb.db(ctx.env), input.id);
      return { success: true };
    }),
});

// ============================================
// USERS ROUTER
// ============================================

const usersRouter = router({
  list: superAdminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(u => ({
      id: u.id,
      openId: u.open_id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.created_at,
      lastSignedIn: u.last_signed_in,
    }));
  }),

  create: superAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
        phone: z.string().optional(),
        role: z
          .enum([
            "user",
            "admin",
            "super_admin",
            "admin_ops",
            "admin_boutique",
            "admin_dons",
            "scanner",
            "admin_restaurant",
            "vue_restaurant",
            "manager_restaurant",
            "admin_patisserie",
            "admin_terroir",
            "admin_contenu",
            "admin_messages",
          ])
          .default("user"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Create user in Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            name: input.name,
            phone: input.phone,
          },
        });

      if (authError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: authError.message,
        });
      }

      if (!authData.user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Erreur lors de la création du compte",
        });
      }

      // Create entry in users table
      const { error: dbError } = await supabase.from("users").insert({
        open_id: authData.user.id,
        email: input.email,
        name: input.name || null,
        phone: input.phone || null,
        role: input.role,
      });

      if (dbError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Erreur lors de la création du profil",
        });
      }

      return {
        success: true,
        user: {
          id: authData.user.id,
          email: input.email,
          role: input.role,
          name: input.name,
          phone: input.phone,
          createdAt: new Date(),
        },
      };
    }),

  updateRole: superAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum([
          "user",
          "admin",
          "super_admin",
          "admin_ops",
          "admin_boutique",
          "admin_dons",
          "scanner",
          "admin_restaurant",
          "vue_restaurant",
          "manager_restaurant",
          "admin_patisserie",
          "admin_terroir",
          "admin_contenu",
          "admin_messages",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("users")
        .update({ role: input.role })
        .eq("id", input.userId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),
});

// ============================================
// UPLOAD ROUTER
// ============================================

const uploadRouter = router({
  // Upload image to Supabase Storage
  image: adminProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileData: z.string(), // Base64 encoded
        folder: z.string().default("goodies"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Validate file type
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(input.fileType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Type de fichier non autorisé. Utilisez PNG, JPEG ou WebP.",
        });
      }

      // Decode base64
      const base64Data = input.fileData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Generate unique filename
      const ext = input.fileName.split(".").pop() || "png";
      const uniqueName = `${input.folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("images")
        .upload(uniqueName, buffer, {
          contentType: input.fileType,
          upsert: false,
        });

      if (error) {
        console.error("[Worker] Upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du téléchargement: " + error.message,
        });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(uniqueName);

      return {
        url: urlData.publicUrl,
        path: uniqueName,
      };
    }),
});

// ============================================
// SYSTEM ROUTER
// ============================================

const systemRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),
});

// ============================================
// RESTAURANTS ROUTER
// ============================================

const restaurantsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      capacity: r.capacity,
      active: r.active,
      createdAt: r.created_at,
    }));
  }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      capacity: r.capacity,
      active: r.active,
      createdAt: r.created_at,
    }));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        address: z.string().min(5),
        phone: z.string().optional(),
        capacity: z.number().min(1).default(50),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data, error } = await supabase
        .from("restaurants")
        .insert({
          name: input.name,
          address: input.address,
          phone: input.phone,
          capacity: input.capacity,
          active: input.active,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { id: data.id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        address: z.string().min(5).optional(),
        phone: z.string().optional(),
        capacity: z.number().min(1).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, ...updateData } = input;

      const { error } = await supabase
        .from("restaurants")
        .update(updateData)
        .eq("id", id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", input.id);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  getAvailability: publicProcedure
    .input(
      z.object({
        restaurantId: z.number(),
        date: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get restaurant capacity
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("capacity")
        .eq("id", input.restaurantId)
        .single();

      if (!restaurant) {
        return { available: 0, total: 0 };
      }

      // Get total reserved seats for this date
      const { data: reservations } = await supabase
        .from("reservations")
        .select("seats")
        .eq("restaurant_id", input.restaurantId)
        .eq("date", input.date)
        .in("status", ["pending", "confirmed"]);

      const reserved = (reservations || []).reduce(
        (sum, r) => sum + r.seats,
        0
      );

      return {
        available: Math.max(0, restaurant.capacity - reserved),
        total: restaurant.capacity,
        reserved,
      };
    }),
});

// ============================================
// RESERVATIONS ROUTER
// ============================================

const reservationsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        restaurantId: z.number(),
        date: z.string(),
        slotId: z.number().optional(),
        fullName: z.string().min(2),
        phone: z.string().min(8),
        email: z.string().email().optional(),
        seats: z.number().min(1).max(10),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Check availability
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("capacity, name, address")
        .eq("id", input.restaurantId)
        .single();

      if (!restaurant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Restaurant non trouvé",
        });
      }

      // Get current reservations
      const { data: existingReservations } = await supabase
        .from("reservations")
        .select("seats")
        .eq("restaurant_id", input.restaurantId)
        .eq("date", input.date)
        .in("status", ["pending", "confirmed"]);

      const totalReserved = (existingReservations || []).reduce(
        (sum, r) => sum + r.seats,
        0
      );
      const available = restaurant.capacity - totalReserved;

      if (input.seats > available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Seulement ${available} places disponibles pour cette date`,
        });
      }

      // Generate reference code and QR token
      const referenceCode = `RES-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const qrToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Create reservation
      const { data, error } = await supabase
        .from("reservations")
        .insert({
          restaurant_id: input.restaurantId,
          date: input.date,
          slot_id: input.slotId,
          full_name: input.fullName,
          phone: input.phone,
          email: input.email,
          seats: input.seats,
          notes: input.notes,
          status: "confirmed",
          reference_code: referenceCode,
          qr_token: qrToken,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      // Send confirmation emails
      if (input.email) {
        try {
          const {
            sendEmail,
            generateReservationConfirmationEmail,
            generateReservationAdminNotificationEmail,
          } = await import("./email");

          const emailData = {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            referenceCode,
            restaurantName: restaurant.name,
            restaurantAddress: restaurant.address,
            date: input.date,
            seats: input.seats,
            qrToken,
            baseUrl: "https://ftourbabrayan.ma",
          };

          // Send to customer
          const customerEmail = generateReservationConfirmationEmail(emailData);
          await sendEmail({
            to: input.email,
            subject: customerEmail.subject,
            html: customerEmail.html,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });

          // Send to admin
          const adminEmail =
            generateReservationAdminNotificationEmail(emailData);
          await sendEmail({
            to: "contact@ftourbabrayan.ma",
            subject: adminEmail.subject,
            html: adminEmail.html,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
        } catch (emailError) {
          console.error(
            "[Worker] Error sending reservation email:",
            emailError
          );
        }
      }

      return {
        id: data.id,
        referenceCode,
        qrToken,
      };
    }),

  list: adminProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
          restaurantId: z.number().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      let query = supabase
        .from("reservations")
        .select("*, restaurants(name, address)")
        .order("created_at", { ascending: false });

      if (input?.date) {
        query = query.eq("date", input.date);
      }
      if (input?.restaurantId) {
        query = query.eq("restaurant_id", input.restaurantId);
      }
      if (input?.status) {
        query = query.eq("status", input.status);
      }

      const { data, error } = await query;

      if (error) {
        return [];
      }

      return (data || []).map(r => ({
        id: r.id,
        restaurantId: r.restaurant_id,
        restaurantName: r.restaurants?.name,
        restaurantAddress: r.restaurants?.address,
        date: r.date,
        slotId: r.slot_id,
        fullName: r.full_name,
        phone: r.phone,
        email: r.email,
        seats: r.seats,
        notes: r.notes,
        status: r.status,
        referenceCode: r.reference_code,
        qrToken: r.qr_token,
        createdAt: r.created_at,
      }));
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        reservationId: z.number(),
        status: z.enum([
          "pending",
          "confirmed",
          "cancelled",
          "no_show",
          "checked_in",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { error } = await supabase
        .from("reservations")
        .update({ status: input.status })
        .eq("id", input.reservationId);

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }

      return { success: true };
    }),

  checkin: scannerProcedure
    .input(
      z.object({
        qrToken: z.string().optional(),
        referenceCode: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Find reservation
      let query = supabase.from("reservations").select("*, restaurants(name)");

      if (input.qrToken) {
        query = query.eq("qr_token", input.qrToken);
      } else if (input.referenceCode) {
        query = query.eq("reference_code", input.referenceCode);
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR token ou référence requis",
        });
      }

      const { data: reservation, error } = await query.single();

      if (error || !reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation non trouvée",
        });
      }

      if (reservation.status === "checked_in") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Réservation déjà validée",
        });
      }

      if (reservation.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Réservation annulée",
        });
      }

      // Check date
      const today = new Date().toISOString().split("T")[0];
      if (reservation.date !== today) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette réservation n'est pas pour aujourd'hui",
        });
      }

      // Update status
      await supabase
        .from("reservations")
        .update({ status: "checked_in" })
        .eq("id", reservation.id);

      // Create checkin record
      await supabase.from("reservation_checkins").insert({
        reservation_id: reservation.id,
        scanned_at: new Date().toISOString(),
        validation_mode: input.qrToken ? "qr_scan" : "manual",
        validated_by: ctx.user?.id,
      });

      return {
        success: true,
        reservation: {
          id: reservation.id,
          fullName: reservation.full_name,
          seats: reservation.seats,
          restaurantName: reservation.restaurants?.name,
        },
      };
    }),

  getAvailableSeats: publicProcedure
    .input(
      z.object({
        restaurantId: z.number(),
        date: z.string(),
        slotId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Get restaurant capacity
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("capacity")
        .eq("id", input.restaurantId)
        .single();

      if (!restaurant) {
        return { available: 0, total: 0 };
      }

      // Get current reservations for this date
      const { data: existingReservations } = await supabase
        .from("reservations")
        .select("seats")
        .eq("restaurant_id", input.restaurantId)
        .eq("date", input.date)
        .in("status", ["pending", "confirmed"]);

      const totalReserved = (existingReservations || []).reduce(
        (sum, r) => sum + r.seats,
        0
      );
      const available = restaurant.capacity - totalReserved;

      return {
        available: Math.max(0, available),
        total: restaurant.capacity,
        reserved: totalReserved,
      };
    }),

  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: reservation, error } = await supabase
        .from("reservations")
        .select("*, restaurants(name, address)")
        .eq("qr_token", input.token)
        .single();

      if (error || !reservation) {
        return { valid: false, error: "Réservation non trouvée" };
      }

      if (reservation.status === "checked_in") {
        return { valid: false, error: "Réservation déjà validée", reservation };
      }

      if (reservation.status === "cancelled") {
        return { valid: false, error: "Réservation annulée" };
      }

      return {
        valid: true,
        reservation: {
          id: reservation.id,
          fullName: reservation.full_name,
          phone: reservation.phone,
          email: reservation.email,
          seats: reservation.seats,
          date: reservation.date,
          status: reservation.status,
          referenceCode: reservation.reference_code,
          restaurantName: reservation.restaurants?.name,
          restaurantAddress: reservation.restaurants?.address,
        },
      };
    }),

  getStats: adminProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
          restaurantId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      let query = supabase.from("reservations").select("seats, status");

      if (input?.date) {
        query = query.eq("date", input.date);
      }
      if (input?.restaurantId) {
        query = query.eq("restaurant_id", input.restaurantId);
      }

      const { data } = await query;

      const stats = {
        total: 0,
        confirmed: 0,
        checkedIn: 0,
        cancelled: 0,
        noShow: 0,
        totalSeats: 0,
        confirmedSeats: 0,
        checkedInSeats: 0,
      };

      for (const r of data || []) {
        stats.total++;
        stats.totalSeats += r.seats;

        if (r.status === "confirmed") {
          stats.confirmed++;
          stats.confirmedSeats += r.seats;
        } else if (r.status === "checked_in") {
          stats.checkedIn++;
          stats.checkedInSeats += r.seats;
        } else if (r.status === "cancelled") {
          stats.cancelled++;
        } else if (r.status === "no_show") {
          stats.noShow++;
        }
      }

      return stats;
    }),
});

// ============================================
// RESTAURANT RESERVATIONS ROUTER (unified)
// ============================================

async function sha256HexRouter(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createProofUploadToken(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  reservationId: number,
  baseUrl: string,
  ttlDays = 7
): Promise<string | null> {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const rawToken = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tokenHash = await sha256HexRouter(rawToken);
    const expiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const { error } = await supabase.from("reservation_payment_tokens").insert({
      reservation_id: reservationId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (error) {
      console.error("[ProofToken] Insert error:", error.message);
      return null;
    }
    return `${baseUrl.replace(/\/$/, "")}/reservations/preuve?token=${encodeURIComponent(rawToken)}`;
  } catch (err) {
    console.error("[ProofToken] Unexpected error:", err);
    return null;
  }
}

function generateReservationReference(
  type: "particulier" | "entreprise" | "groupe"
): string {
  const typeCode =
    type === "particulier" ? "P" : type === "entreprise" ? "E" : "G";
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `RES-${typeCode}-${randomPart}`;
}

function generateQrToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildRestaurantReservationRequestEmailHtml(params: {
  customerName: string;
  reservationType: "particulier" | "entreprise" | "groupe";
  reservationDate: string;
  participantsCount: number;
  reference: string;
  proofUploadUrl?: string;
}): string {
  const restaurantRibDownloadUrl = "https://www.ftourbabrayan.ma/fr/RIB";
  const reservationTypeLabel =
    params.reservationType === "groupe"
      ? "groupe"
      : params.reservationType === "entreprise"
        ? "entreprise"
        : "particulier";

  const proofCtaBlock = params.proofUploadUrl
    ? `<p style="margin:20px 0 8px 0;">Une fois votre virement effectué, déposez votre preuve de virement en cliquant sur le bouton ci-dessous :</p>
<p style="margin:8px 0;"><a href="${params.proofUploadUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#166534;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">Déposer ma preuve de virement</a></p>
<p style="font-size:12px;color:#6b7280;margin:4px 0 0 0;">Ce lien est personnel, à usage unique et valide 7 jours.</p>`
    : "";

  return `<p>Bonjour ${params.customerName},</p>
<p>Votre demande de réservation ${reservationTypeLabel} pour le ${params.reservationDate} a bien été enregistrée.<br/>
Nombre estimé de participants : ${params.participantsCount}</p>
<p>Référence : ${params.reference}</p>
<p>Afin de confirmer votre réservation à La Table du Jardin, nous vous remercions de bien vouloir verser 50 % du montant à l’avance.</p>
<p>Vous trouverez nos coordonnées bancaires en téléchargeant notre RIB : <a href="${restaurantRibDownloadUrl}" target="_blank" rel="noopener noreferrer">Télécharger le RIB</a></p>
${proofCtaBlock}
<p>Merci pour votre soutien à notre restaurant solidaire ! 💚<br/>À très bientôt.<br/>L’équipe de La Table du Jardin</p>`;
}

function buildRestaurantReservationValidatedEmailHtml(
  customerName: string
): string {
  return `<p>Bonjour ${customerName},</p>
<p>Votre réservation à La Table du Jardin est confirmée.</p>
<p>Nous sommes heureux de vous accueillir prochainement.</p>
<p>Nous vous remercions d'avance pour votre confiance.</p>
<p><strong>Politique d’annulation :</strong><br/>
Annulation à moins de 72h : acompte de 50% conservé.<br/>
Le nombre de personnes confirmé sera facturé en totalité, même en cas d’absence ou de modification le jour même.</p>
<p>Merci pour votre comprehension.</p>
<p>Cordialement,<br/>L’équipe de La Table du Jardin</p>`;
}

/**
 * Map DB row (snake_case) to camelCase object expected by frontend.
 */
function mapReservation(r: any) {
  const rawDateAvReg = r.date_av_reg ?? r.dateAvReg;

  return {
    id: r.id,
    reference: r.reference,
    type: r.type,
    seatsTotal: r.seats_total ?? r.seatsTotal ?? 0,
    date: r.date ? new Date(r.date) : null,
    name: r.name,
    phone: r.phone,
    email: r.email,
    companyName: r.company_name ?? r.companyName ?? null,
    groupName: r.group_name ?? r.groupName ?? null,
    groupType: r.group_type ?? r.groupType ?? null,
    displayChoice: r.display_choice ?? r.displayChoice ?? null,
    status: r.status,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? "not_requested",
    paymentAmount: r.payment_amount ?? r.paymentAmount ?? null,
    paymentProvider: r.payment_provider ?? r.paymentProvider ?? null,
    paymentReference: r.payment_reference ?? r.paymentReference ?? null,
    qrToken: r.qr_token ?? r.qrToken ?? null,
    qrStatus: r.qr_status ?? r.qrStatus ?? "inactive",
    expiresAt: r.expires_at
      ? new Date(r.expires_at)
      : r.expiresAt
        ? new Date(r.expiresAt)
        : null,
    processedBy: r.processed_by ?? r.processedBy ?? null,
    processedAt: r.processed_at
      ? new Date(r.processed_at)
      : r.processedAt
        ? new Date(r.processedAt)
        : null,
    notes: r.notes,
    totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
    amountReceived: Number(r.amount_received ?? r.amountReceived ?? 0),
    deposit: Number(r.deposit ?? r.depositAmount ?? 0),
    nbAdult: Number(r.nb_adult ?? r.nbAdult ?? 0),
    nbKids: Number(r.nb_kids ?? r.nbKids ?? 0),
    adultAmount: Number(r.adult_amount ?? r.adultAmount ?? 0),
    kidsAmount: Number(r.kids_amount ?? r.kidsAmount ?? 0),
    paymentMode: r.payment_mode ?? r.paymentMode ?? "cash",
    respResa: r.resp_resa ?? r.respResa ?? "Nayla",
    modeDeposit: r.mode_deposit ?? r.modeDeposit ?? null,
    dateAvReg: rawDateAvReg ? new Date(rawDateAvReg) : null,
    createdAt: r.created_at
      ? new Date(r.created_at)
      : r.createdAt
        ? new Date(r.createdAt)
        : new Date(),
    updatedAt: r.updated_at
      ? new Date(r.updated_at)
      : r.updatedAt
        ? new Date(r.updatedAt)
        : new Date(),
  };
}

function normalizeReservationType(
  value: unknown
): "particulier" | "groupe" | "entreprise" | "unknown" {
  if (typeof value !== "string") return "unknown";

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    ["particulier", "particuliers", "individual", "individuel"].includes(
      normalized
    )
  ) {
    return "particulier";
  }

  if (
    [
      "groupe",
      "groupes",
      "group",
      "groups",
      "association",
      "associations",
    ].includes(normalized)
  ) {
    return "groupe";
  }

  if (
    ["entreprise", "entreprises", "company", "companies", "corporate"].includes(
      normalized
    )
  ) {
    return "entreprise";
  }

  return "unknown";
}

const restaurantReservationsRouter = router({
  particulier: router({
    create: publicProcedure
      .input(
        z.object({
          firstName: z.string().min(1),
          email: z.string().email(),
          phone: z.string().min(1),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          participantsCount: z.number().int().min(1).max(120),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const reference = generateReservationReference("particulier");
        const qrToken = generateQrToken();
        const { data, error } = await supabase
          .from("restaurant_reservations")
          .insert({
            reference,
            type: "particulier",
            seats_total: input.participantsCount,
            date: input.date,
            name: input.firstName,
            phone: input.phone,
            email: input.email,
            status: "submitted",
            payment_status: "not_applicable",
            qr_token: qrToken,
            qr_status: "inactive",
          })
          .select()
          .single();
        if (error) {
          console.error(
            "[RestaurantReservations] Particulier create error:",
            error
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        // Generate proof upload token
        const baseUrl =
          ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma";
        const ttlDays = Math.max(
          1,
          Number(ctx.env.RESERVATION_PROOF_TOKEN_TTL_DAYS || "7")
        );
        const proofUploadUrl = await createProofUploadToken(
          supabase,
          data.id,
          baseUrl,
          ttlDays
        );

        // Send confirmation email to customer + internal notification
        try {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: input.email,
            subject: `Demande de réservation reçue - ${reference}`,
            html: buildRestaurantReservationRequestEmailHtml({
              customerName: input.firstName,
              reservationType: "particulier",
              reservationDate: input.date,
              participantsCount: input.participantsCount,
              reference,
              proofUploadUrl: proofUploadUrl ?? undefined,
            }),
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
          await sendEmail({
            to: "digital@myspace.boats",
            subject: `Nouvelle reservation Particulier - ${input.date} - ${reference}`,
            html: `<h2>Nouvelle réservation Particulier</h2><p><strong>Nom:</strong> ${input.firstName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Tél:</strong> ${input.phone}</p><p><strong>Date:</strong> ${input.date}</p><p><strong>Participants:</strong> ${input.participantsCount}</p><p><strong>Référence:</strong> ${reference}</p>`,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
        } catch (emailErr) {
          console.error(
            "[RestaurantReservations] Email error (reservation created OK):",
            emailErr
          );
        }
        return {
          success: true,
          reservation: data,
          message: "Demande reçue. Vérifiez votre email.",
        };
      }),
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const { data } = await supabase
          .from("restaurant_reservations")
          .select("*")
          .eq("reference", input.reference)
          .single();
        return data;
      }),
  }),

  entreprise: router({
    create: publicProcedure
      .input(
        z.object({
          companyName: z.string().min(1),
          contactName: z.string().min(1),
          email: z.string().email(),
          phone: z.string().min(1),
          companyICE: z.string().optional(),
          companyNotes: z.string().optional(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          participantsCount: z.number().int().min(10).max(120),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const reference = generateReservationReference("entreprise");
        const qrToken = generateQrToken();
        const { data, error } = await supabase
          .from("restaurant_reservations")
          .insert({
            reference,
            type: "entreprise",
            seats_total: input.participantsCount,
            date: input.date,
            name: input.contactName,
            phone: input.phone,
            email: input.email,
            company_name: input.companyName,
            notes: input.companyNotes || null,
            status: "submitted",
            payment_status: "not_applicable",
            qr_token: qrToken,
            qr_status: "inactive",
          })
          .select()
          .single();
        if (error) {
          console.error(
            "[RestaurantReservations] Entreprise create error:",
            error
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        // Generate proof upload token
        const baseUrlE =
          ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma";
        const ttlDaysE = Math.max(
          1,
          Number(ctx.env.RESERVATION_PROOF_TOKEN_TTL_DAYS || "7")
        );
        const proofUploadUrlE = await createProofUploadToken(
          supabase,
          data.id,
          baseUrlE,
          ttlDaysE
        );

        try {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: input.email,
            subject: `Demande de réservation reçue - ${reference}`,
            html: buildRestaurantReservationRequestEmailHtml({
              customerName: input.contactName,
              reservationType: "entreprise",
              reservationDate: input.date,
              participantsCount: input.participantsCount,
              reference,
              proofUploadUrl: proofUploadUrlE ?? undefined,
            }),
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
          await sendEmail({
            to: "digital@myspace.boats",
            subject: `Nouvelle demande Entreprise - ${input.date} - ${reference}`,
            html: `<h2>Nouvelle demande Entreprise</h2><p><strong>Entreprise:</strong> ${input.companyName}</p><p><strong>Contact:</strong> ${input.contactName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Tél:</strong> ${input.phone}</p><p><strong>Date:</strong> ${input.date}</p><p><strong>Participants:</strong> ${input.participantsCount}</p><p><strong>Référence:</strong> ${reference}</p>`,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
        } catch (emailErr) {
          console.error(
            "[RestaurantReservations] Email error (reservation created OK):",
            emailErr
          );
        }
        return {
          success: true,
          reservation: data,
          message: "Demande reçue. Vérifiez votre email.",
        };
      }),
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const { data } = await supabase
          .from("restaurant_reservations")
          .select("*")
          .eq("reference", input.reference)
          .single();
        return data;
      }),
  }),

  groupe: router({
    create: publicProcedure
      .input(
        z.object({
          groupName: z.string().min(1),
          contactName: z.string().min(1),
          email: z.string().email(),
          phone: z.string().min(1),
          groupType: z.string().optional(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          participantsCount: z.number().int().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const reference = generateReservationReference("groupe");
        const qrToken = generateQrToken();
        const { data, error } = await supabase
          .from("restaurant_reservations")
          .insert({
            reference,
            type: "groupe",
            seats_total: input.participantsCount,
            date: input.date,
            name: input.contactName,
            phone: input.phone,
            email: input.email,
            group_name: input.groupName,
            group_type: input.groupType || null,
            status: "submitted",
            payment_status: "not_applicable",
            qr_token: qrToken,
            qr_status: "inactive",
          })
          .select()
          .single();
        if (error) {
          console.error("[RestaurantReservations] Groupe create error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        // Generate proof upload token
        const baseUrlG =
          ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma";
        const ttlDaysG = Math.max(
          1,
          Number(ctx.env.RESERVATION_PROOF_TOKEN_TTL_DAYS || "7")
        );
        const proofUploadUrlG = await createProofUploadToken(
          supabase,
          data.id,
          baseUrlG,
          ttlDaysG
        );

        try {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: input.email,
            subject: `Demande de réservation reçue - ${reference}`,
            html: buildRestaurantReservationRequestEmailHtml({
              customerName: input.contactName,
              reservationType: "groupe",
              reservationDate: input.date,
              participantsCount: input.participantsCount,
              reference,
              proofUploadUrl: proofUploadUrlG ?? undefined,
            }),
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
          await sendEmail({
            to: "digital@myspace.boats",
            subject: `Nouvelle demande Groupe - ${input.date} - ${reference}`,
            html: `<h2>Nouvelle demande Groupe</h2><p><strong>Groupe:</strong> ${input.groupName}</p><p><strong>Contact:</strong> ${input.contactName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Tél:</strong> ${input.phone}</p><p><strong>Date:</strong> ${input.date}</p><p><strong>Participants:</strong> ${input.participantsCount}</p><p><strong>Référence:</strong> ${reference}</p>`,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
        } catch (emailErr) {
          console.error(
            "[RestaurantReservations] Email error (reservation created OK):",
            emailErr
          );
        }
        return {
          success: true,
          reservation: data,
          message: "Demande reçue. Vérifiez votre email.",
        };
      }),
    getByReference: publicProcedure
      .input(z.object({ reference: z.string() }))
      .query(async ({ input, ctx }) => {
        const supabase = createSupabaseAdmin(ctx.env);
        const { data } = await supabase
          .from("restaurant_reservations")
          .select("*")
          .eq("reference", input.reference)
          .single();
        return data;
      }),
  }),

  validate: protectedProcedure
    .input(z.object({ reference: z.string(), baseUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: reservation } = await supabase
        .from("restaurant_reservations")
        .select("*")
        .eq("reference", input.reference)
        .single();
      if (!reservation)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation non trouvée",
        });
      await supabase
        .from("restaurant_reservations")
        .update({
          status: "pending_confirmation",
          payment_status: "pending",
        })
        .eq("id", reservation.id);
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: reservation.email,
          subject: `Réservation confirmée - ${reservation.reference}`,
          html: buildRestaurantReservationValidatedEmailHtml(reservation.name),
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailErr) {
        console.error(
          "[RestaurantReservations] Validate email error:",
          emailErr
        );
      }
      return { success: true, message: "Réservation validée. Email envoyé." };
    }),

  refuse: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: reservation } = await supabase
        .from("restaurant_reservations")
        .select("*")
        .eq("reference", input.reference)
        .single();
      if (!reservation)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation non trouvée",
        });
      await supabase
        .from("restaurant_reservations")
        .update({
          status: "rejected",
        })
        .eq("id", reservation.id);
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: reservation.email,
          subject: `Reservation refusee - ${reservation.reference}`,
          html: `<h2 style="color:#dc2626;">Réservation refusée</h2><p>Bonjour <strong>${reservation.name}</strong>,</p><p>Nous sommes désolés, votre réservation <strong>${reservation.reference}</strong> n'a pas pu être acceptée.</p><p>N'hésitez pas à nous contacter pour plus d'informations.</p><p>Cordialement,<br><strong>L'équipe Ftour Bab Rayan</strong></p>`,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailErr) {
        console.error("[RestaurantReservations] Refuse email error:", emailErr);
      }
      return { success: true, message: "Réservation refusée. Email envoyé." };
    }),

  getByQrToken: publicProcedure
    .input(z.object({ qrToken: z.string() }))
    .query(async ({ input, ctx }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("restaurant_reservations")
        .select("*")
        .eq("qr_token", input.qrToken)
        .single();
      if (error || !data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation non trouvée",
        });
      }
      return data;
    }),

  adminListParticuliers: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
    ];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("restaurant_reservations")
      .select("*")
      .eq("type", "particulier")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[adminListParticuliers] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }
    return (data || []).map(mapReservation);
  }),

  adminListGroupes: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
    ];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("restaurant_reservations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[adminListGroupes] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }
    return (data || [])
      .filter(
        reservation => normalizeReservationType(reservation.type) === "groupe"
      )
      .map(mapReservation);
  }),

  adminListEntreprises: protectedProcedure.query(async ({ ctx }) => {
    const allowedRoles = [
      "admin",
      "super_admin",
      "admin_restaurant",
      "vue_restaurant",
      "manager_restaurant",
    ];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Permission refusée" });
    }
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("restaurant_reservations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[adminListEntreprises] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }
    return (data || [])
      .filter(
        reservation =>
          normalizeReservationType(reservation.type) === "entreprise"
      )
      .map(mapReservation);
  }),

  adminCreateManual: protectedProcedure
    .input(
      z.object({
        type: z.enum(["groupe", "entreprise"]),
        groupOrCompanyName: z
          .string()
          .min(1, "Nom du groupe ou de l'entreprise requis"),
        contactName: z.string().min(1, "Nom du contact requis"),
        email: z.string().email("Email invalide"),
        phone: z.string().min(1, "Téléphone requis"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide"),
        seatsTotal: z.number().int().min(2),
        nbAdult: z.number().int().min(0).optional(),
        nbKids: z.number().int().min(0).optional(),
        totalAmount: z.number().min(0).optional(),
        amountReceived: z.number().min(0).optional(),
        deposit: z.number().min(0).optional(),
        paymentMode: z.enum(["cash", "virement", "espece"]).optional(),
        respResa: z
          .enum(["Nayla", "Hind", "Kamal", "Rita", "Réda", "Souad"])
          .optional(),
        modeDeposit: z.string().optional(),
        dateAvReg: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide")
          .optional(),
        notes: z.string().optional(),
        displayChoice: z.enum(["jardin", "brasserie"]).optional(),
        status: z
          .enum([
            "pending_validation",
            "validated_pending_payment",
            "paid_confirmed",
          ])
          .default("pending_validation"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      const reference = generateReservationReference(input.type);
      const qrToken = generateQrToken();
      const now = new Date().toISOString();

      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("restaurant_reservations")
        .insert({
          reference,
          type: input.type,
          name: input.contactName,
          email: input.email,
          phone: input.phone,
          date: input.date,
          seats_total: input.seatsTotal,
          nb_adult: input.nbAdult ?? null,
          nb_kids: input.nbKids ?? null,
          total_amount: input.totalAmount ?? null,
          amount_received: input.amountReceived ?? null,
          deposit: input.deposit ?? null,
          payment_mode: input.paymentMode ?? null,
          resp_resa: input.respResa ?? null,
          mode_deposit: input.modeDeposit ?? null,
          date_av_reg: input.dateAvReg ?? null,
          notes: input.notes || null,
          display_choice: input.displayChoice || null,
          company_name:
            input.type === "entreprise" ? input.groupOrCompanyName : null,
          group_name: input.type === "groupe" ? input.groupOrCompanyName : null,
          status: input.status,
          payment_status: "not_applicable",
          qr_token: qrToken,
          qr_status: input.status === "paid_confirmed" ? "active" : "inactive",
          entry_source: "admin",
          created_by_name: ctx.user.name ?? null,
          created_by_email: ctx.user.email ?? null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (error || !data) {
        console.error("[adminCreateManual] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création de la réservation manuelle",
        });
      }

      return {
        success: true,
        reservation: mapReservation(data),
        message: "Réservation créée manuellement",
      };
    }),

  adminUpdateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "pending_validation",
          "validated_pending_payment",
          "paid_confirmed",
          "refused",
          "cancelled",
          "completed",
          "no_show",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("restaurant_reservations")
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select()
        .single();
      if (error) {
        console.error("[adminUpdateStatus] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour du statut",
        });
      }
      // Activate QR when confirmed
      if (input.status === "paid_confirmed") {
        await supabase
          .from("restaurant_reservations")
          .update({ qr_status: "active" })
          .eq("id", input.id);
      }
      return { success: true, reservation: data };
    }),

  adminSendDepositLink: protectedProcedure
    .input(
      z.object({
        reservationId: z.number(),
        sendEmail: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: reservation, error: resErr } = await supabase
        .from("restaurant_reservations")
        .select("id, reference, name, email, deposit, deposit_deadline")
        .eq("id", input.reservationId)
        .single();
      if (resErr || !reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation introuvable",
        });
      }

      // Invalidate any existing unused tokens for this reservation
      await supabase
        .from("reservation_payment_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("reservation_id", input.reservationId)
        .is("used_at", null);

      // Create a new token
      const baseUrl = (
        ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma"
      ).replace(/\/$/, "");
      const proofUploadUrl = await createProofUploadToken(
        supabase,
        reservation.id,
        baseUrl
      );
      if (!proofUploadUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de générer le lien de dépôt",
        });
      }

      // Send email to customer if requested
      if (input.sendEmail && reservation.email) {
        try {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: reservation.email,
            subject: `Déposer votre preuve de virement – ${reservation.reference}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
<p>Bonjour ${reservation.name},</p>
<p>Afin de confirmer votre réservation <strong>${reservation.reference}</strong>, nous vous remercions de bien vouloir déposer votre preuve de virement en cliquant sur le bouton ci-dessous :</p>
<p style="margin:20px 0"><a href="${proofUploadUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#166534;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">Déposer ma preuve de virement</a></p>
<p style="font-size:12px;color:#6b7280;">Ce lien est personnel, à usage unique et valide 7 jours.</p>
<p>Cordialement,<br>L'équipe de La Table du Jardin</p>
</div>`,
            apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
          });
        } catch (emailErr) {
          console.error("[adminSendDepositLink] Email error:", emailErr);
          // Return the link even if email fails
          return { success: true, link: proofUploadUrl, emailSent: false };
        }
      }

      return {
        success: true,
        link: proofUploadUrl,
        emailSent: input.sendEmail && !!reservation.email,
      };
    }),

  adminGetLatestProofUrl: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .query(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: proof } = await supabase
        .from("reservation_payment_proofs")
        .select("storage_path, uploaded_at")
        .eq("reservation_id", input.reservationId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!proof?.storage_path) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucune preuve de virement trouvée",
        });
      }

      const bucket = "reservation-payment-proofs";
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(proof.storage_path, 3600);

      if (signedError || !signedData?.signedUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de générer le lien de téléchargement",
        });
      }

      return {
        storagePath: proof.storage_path,
        signedUrl: signedData.signedUrl,
      };
    }),

  adminEdit: protectedProcedure
    .input(
      z
        .object({
          id: z.number(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().min(1).optional(),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide")
            .optional(),
          seatsTotal: z.number().int().min(1).optional(),
          notes: z.string().optional(),
          totalAmount: z.number().min(0).optional(),
          adultAmount: z.number().min(0).optional(),
          kidsAmount: z.number().min(0).optional(),
          amountReceived: z.number().min(0).optional(),
          deposit: z.number().min(0).optional(),
          nbAdult: z.number().int().min(0).optional(),
          nbKids: z.number().int().min(0).optional(),
          paymentMode: z.enum(["cash", "virement", "espece"]).optional(),
          respResa: z
            .enum(["Nayla", "Hind", "Kamal", "Rita", "Réda", "Souad"])
            .optional(),
          companyName: z.string().optional(),
          groupName: z.string().optional(),
          displayChoice: z.string().optional(),
          modeDeposit: z.string().nullable().optional(),
          dateAvReg: z.string().nullable().optional(),
        })
        .refine(
          payload =>
            Object.keys(payload).some(
              key =>
                key !== "id" &&
                payload[key as keyof typeof payload] !== undefined
            ),
          {
            message: "Aucun champ valide à mettre à jour",
          }
        )
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
        "admin_ops",
        "admin_operations",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      const { id, ...rest } = input;
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (rest.name !== undefined) updatePayload.name = rest.name;
      if (rest.email !== undefined) updatePayload.email = rest.email;
      if (rest.phone !== undefined) updatePayload.phone = rest.phone;
      if (rest.date !== undefined) updatePayload.date = rest.date;
      if (rest.seatsTotal !== undefined)
        updatePayload.seats_total = rest.seatsTotal;
      if (rest.notes !== undefined) updatePayload.notes = rest.notes;
      if (rest.companyName !== undefined)
        updatePayload.company_name = rest.companyName;
      if (rest.groupName !== undefined)
        updatePayload.group_name = rest.groupName;
      if (rest.displayChoice !== undefined)
        updatePayload.display_choice = rest.displayChoice;
      if (rest.totalAmount !== undefined)
        updatePayload.total_amount = rest.totalAmount;
      if (rest.amountReceived !== undefined)
        updatePayload.amount_received = rest.amountReceived;
      if (rest.deposit !== undefined) updatePayload.deposit = rest.deposit;
      if (rest.nbAdult !== undefined) updatePayload.nb_adult = rest.nbAdult;
      if (rest.nbKids !== undefined) updatePayload.nb_kids = rest.nbKids;
      if (rest.adultAmount !== undefined)
        updatePayload.adult_amount = rest.adultAmount;
      if (rest.kidsAmount !== undefined)
        updatePayload.kids_amount = rest.kidsAmount;
      if (rest.paymentMode !== undefined)
        updatePayload.payment_mode = rest.paymentMode;
      if (rest.respResa !== undefined) updatePayload.resp_resa = rest.respResa;
      if (rest.modeDeposit !== undefined)
        updatePayload.mode_deposit = rest.modeDeposit;
      if (rest.dateAvReg !== undefined)
        updatePayload.date_av_reg = rest.dateAvReg;

      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("restaurant_reservations")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.error("[adminEdit] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la modification de la réservation",
        });
      }

      return { success: true, reservation: mapReservation(data) };
    }),

  adminDelete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = [
        "admin",
        "super_admin",
        "admin_restaurant",
        "vue_restaurant",
        "manager_restaurant",
      ];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }

      const supabase = createSupabaseAdmin(ctx.env);

      const { data: existing, error: findError } = await supabase
        .from("restaurant_reservations")
        .select("id")
        .eq("id", input.id)
        .single();

      if (findError || !existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation non trouvée",
        });
      }

      const { error: deleteError } = await supabase
        .from("restaurant_reservations")
        .delete()
        .eq("id", input.id);

      if (deleteError) {
        console.error("[adminDelete] Error:", deleteError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression de la réservation",
        });
      }

      return { success: true };
    }),

  adminGenerateProofLink: protectedProcedure
    .input(z.object({ reservationId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission refusée",
        });
      }
      const supabase = createSupabaseAdmin(ctx.env);

      const { data: reservation, error: resError } = await supabase
        .from("restaurant_reservations")
        .select("id, reference, email, name")
        .eq("id", input.reservationId)
        .single();

      if (resError || !reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Réservation introuvable",
        });
      }

      const baseUrl = ctx.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma";
      const ttlDays = Math.max(
        1,
        Number(ctx.env.RESERVATION_PROOF_TOKEN_TTL_DAYS || "7")
      );
      const proofUploadUrl = await createProofUploadToken(
        supabase,
        input.reservationId,
        baseUrl,
        ttlDays
      );

      if (!proofUploadUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de générer le lien de dépôt",
        });
      }

      return { proofUploadUrl, reservationRef: reservation.reference };
    }),
});

// ============================================
// QR CODES ROUTER
// ============================================

const qrRouter = router({
  catalogQRCodes: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const baseUrl = "https://ftourbabrayan.ma";

    const [goodiesRes, pastriesRes, terroirRes] = await Promise.all([
      supabase
        .from("goodies")
        .select("id, name, image_url, price, category, is_active")
        .order("sort_order", { ascending: true }),
      supabase
        .from("pastries")
        .select("id, name, image_url, price, active")
        .order("sort_order", { ascending: true }),
      supabase
        .from("terroir_products")
        .select(
          "id, name, image_url, category, is_active, terroir_product_variants(price_unit)"
        )
        .order("sort_order", { ascending: true }),
    ]);

    const items: Array<{
      id: number;
      name: string;
      imageUrl: string | null;
      price: number | null;
      category: string;
      qrUrl: string;
      qrDataUrl: string;
    }> = [];

    for (const g of goodiesRes.data || []) {
      const url = `${baseUrl}/fr/buy/goodie/${g.id}`;
      items.push({
        id: g.id,
        name: g.name,
        imageUrl: g.image_url,
        price: g.price,
        category: "goodies",
        qrUrl: url,
        qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(url)}`,
      });
    }

    for (const p of pastriesRes.data || []) {
      const url = `${baseUrl}/fr/buy/pastry/${p.id}`;
      items.push({
        id: p.id,
        name: p.name,
        imageUrl: p.image_url,
        price: p.price,
        category: "patisserie",
        qrUrl: url,
        qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(url)}`,
      });
    }

    for (const t of terroirRes.data || []) {
      const url = `${baseUrl}/fr/buy/terroir/${t.id}`;
      const firstVariant = (t as any).terroir_product_variants?.[0];
      items.push({
        id: t.id,
        name: t.name,
        imageUrl: t.image_url,
        price: firstVariant?.price_unit ?? null,
        category: "terroir",
        qrUrl: url,
        qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(url)}`,
      });
    }

    const donsUrl = `${baseUrl}/fr/dons`;
    items.push({
      id: 0,
      name: "Page de dons",
      imageUrl: null,
      price: null,
      category: "dons",
      qrUrl: donsUrl,
      qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(donsUrl)}`,
    });

    return items;
  }),
});

// ============================================
// TERROIR MODULE ROUTER
// ============================================

const terroirModuleRouter = router({
  listProducts: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);

    const joinQuery = await supabase
      .from("terroir_products")
      .select("*, terroir_product_variants(*)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!joinQuery.error) {
      return (joinQuery.data || []).map((product: any) => ({
        ...product,
        terroir_product_variants: (
          product.terroir_product_variants || []
        ).filter((v: any) => v.is_active !== false),
      }));
    }

    const { data: products, error: productsError } = await supabase
      .from("terroir_products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (productsError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: productsError.message,
      });
    }

    const productIds = (products || []).map((p: any) => p.id);
    if (productIds.length === 0) return [];

    const { data: variants, error: variantsError } = await supabase
      .from("terroir_product_variants")
      .select("*")
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (variantsError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: variantsError.message,
      });
    }

    const variantsByProduct = (variants || []).reduce(
      (acc: Record<number, any[]>, variant: any) => {
        if (!acc[variant.product_id]) acc[variant.product_id] = [];
        acc[variant.product_id].push(variant);
        return acc;
      },
      {}
    );

    return (products || []).map((p: any) => ({
      ...p,
      terroir_product_variants: variantsByProduct[p.id] || [],
    }));
  }),

  createOrder: publicProcedure
    .input(
      z.object({
        customerName: z.string().min(2),
        customerPhone: z.string().min(8),
        customerEmail: z.string().email().optional(),
        pickupSlotId: z.number().optional(),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              productId: z.number(),
              variantId: z.number().optional(),
              quantity: z.number().min(1),
              unitPrice: z.number().min(0),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      for (const item of input.items) {
        if (!item.variantId) continue;
        const { data: variant } = await supabase
          .from("terroir_product_variants")
          .select("stock_total, stock_reserved")
          .eq("id", item.variantId)
          .single();

        if (!variant)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Variante ${item.variantId} introuvable`,
          });
        const available =
          (variant.stock_total || 0) - (variant.stock_reserved || 0);
        if (available < item.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Stock insuffisant pour la variante ${item.variantId}`,
          });
        }
      }

      const totalAmount = input.items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0
      );
      const reference = `TER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const qrToken = `ter-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

      const { data: order, error } = await supabase
        .from("terroir_orders")
        .insert({
          order_reference: reference,
          customer_name: input.customerName,
          customer_phone: input.customerPhone,
          customer_email: input.customerEmail,
          pickup_slot_id: input.pickupSlotId,
          total_amount: totalAmount,
          status: "created",
          payment_status: "pending",
          qr_token: qrToken,
          qr_status: "inactive",
          notes: input.notes,
        })
        .select("*")
        .single();

      if (error || !order) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Impossible de créer la commande terroir",
        });
      }

      for (const item of input.items) {
        const { error: itemError } = await supabase
          .from("terroir_order_items")
          .insert({
            order_id: order.id,
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice,
          });
        if (itemError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: itemError.message,
          });

        if (item.variantId) {
          const { data: variant } = await supabase
            .from("terroir_product_variants")
            .select("stock_reserved")
            .eq("id", item.variantId)
            .single();
          const reserved = (variant?.stock_reserved || 0) + item.quantity;
          await supabase
            .from("terroir_product_variants")
            .update({ stock_reserved: reserved })
            .eq("id", item.variantId);
        }
      }

      return order;
    }),

  adminListProducts: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("terroir_products")
      .select("*, terroir_product_variants(*)")
      .order("sort_order", { ascending: true });
    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    return data || [];
  }),

  adminCreateProduct: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("terroir_products")
        .insert({
          name: input.name,
          description: input.description,
          category: input.category,
          image_url: input.imageUrl,
          is_active: input.isActive,
          sort_order: input.sortOrder,
        })
        .select("*")
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),

  adminUpdateProduct: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const payload: Record<string, unknown> = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.description !== undefined)
        payload.description = input.description;
      if (input.category !== undefined) payload.category = input.category;
      if (input.imageUrl !== undefined) payload.image_url = input.imageUrl;
      if (input.isActive !== undefined) payload.is_active = input.isActive;
      if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

      const { data, error } = await supabase
        .from("terroir_products")
        .update(payload)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),

  adminCreateVariant: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        label: z.string().min(1),
        sku: z.string().optional(),
        priceUnit: z.number().min(0),
        stockTotal: z.number().int().min(0),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("terroir_product_variants")
        .insert({
          product_id: input.productId,
          label: input.label,
          sku: input.sku,
          price_unit: input.priceUnit,
          stock_total: input.stockTotal,
          stock_reserved: 0,
          is_active: input.isActive,
          sort_order: input.sortOrder,
        })
        .select("*")
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),
  adminUpdateVariant: adminProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().min(1).optional(),
        sku: z.string().optional(),
        priceUnit: z.number().min(0).optional(),
        stockTotal: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const payload: Record<string, unknown> = {};
      if (input.label !== undefined) payload.label = input.label;
      if (input.sku !== undefined) payload.sku = input.sku;
      if (input.priceUnit !== undefined) payload.price_unit = input.priceUnit;
      if (input.stockTotal !== undefined)
        payload.stock_total = input.stockTotal;
      if (input.isActive !== undefined) payload.is_active = input.isActive;
      if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

      const { data, error } = await supabase
        .from("terroir_product_variants")
        .update(payload)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),

  // --- Public: create order from unified catalog (products table) ---
  createCatalogOrder: publicProcedure
    .input(
      z.object({
        customerName: z.string().min(2),
        customerPhone: z.string().min(8),
        customerEmail: z.string().email().optional(),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              catalogProductId: z.number(),
              name: z.string(),
              quantity: z.number().min(1),
              unitPrice: z.number().min(0),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);

      // Validate stock for each item
      for (const item of input.items) {
        const { data: product } = await supabase
          .from("products")
          .select("stock, name")
          .eq("id", item.catalogProductId)
          .eq("product_type", "terroir")
          .single();
        if (!product)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Produit ${item.catalogProductId} introuvable`,
          });
        if (product.stock < item.quantity)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Stock insuffisant pour "${product.name}"`,
          });
      }

      const totalAmount = input.items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0
      );
      const reference = `TER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrToken = `ter-${Date.now()}-${Math.random().toString(36).substring(2, 14)}`;

      const catalogItems = input.items.map(it => ({
        catalogProductId: it.catalogProductId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.quantity * it.unitPrice,
      }));

      // Try inserting with catalog_items; fall back without it if the column is missing
      let order: any = null;
      const payloadWithItems = {
        order_reference: reference,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
        total_amount: totalAmount,
        status: "created",
        payment_status: "pending",
        qr_token: qrToken,
        qr_status: "inactive",
        notes: input.notes,
        catalog_items: catalogItems,
      };

      const { data: orderWithItems, error: errWithItems } = await supabase
        .from("terroir_orders")
        .insert(payloadWithItems)
        .select()
        .single();

      if (!errWithItems) {
        order = orderWithItems;
      } else {
        // Column may not exist yet — retry without catalog_items
        const { catalog_items: _ci, ...payloadWithoutItems } = payloadWithItems;
        const { data: orderWithout, error: errWithout } = await supabase
          .from("terroir_orders")
          .insert(payloadWithoutItems)
          .select()
          .single();
        if (errWithout)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errWithout.message,
          });
        order = orderWithout;
      }

      // Decrement stock for each product
      for (const item of input.items) {
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.catalogProductId)
          .single();
        if (product) {
          await supabase
            .from("products")
            .update({ stock: Math.max(0, product.stock - item.quantity) })
            .eq("id", item.catalogProductId);
        }
      }

      return order;
    }),

  adminDeleteProduct: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { error } = await supabase
        .from("terroir_products")
        .delete()
        .eq("id", input.id);

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });

      return { success: true };
    }),

  adminListOrders: adminProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let query = supabase
        .from("terroir_orders")
        .select(
          "*, terroir_order_items(*, terroir_products(*), terroir_product_variants(*))"
        )
        .order("created_at", { ascending: false });

      if (input?.status) query = query.eq("status", input.status);
      if (input?.search) {
        const s = input.search.replace(/,/g, " ");
        query = query.or(
          `order_reference.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`
        );
      }
      const { data, error } = await query;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data || [];
    }),

  adminStats: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("terroir_orders")
      .select("status,total_amount");
    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });

    const byStatus: Record<string, number> = {};
    let revenue = 0;
    for (const row of data || []) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      if (row.status !== "cancelled" && row.total_amount)
        revenue += Number(row.total_amount);
    }
    return {
      total: (data || []).length,
      byStatus,
      revenue,
    };
  }),

  adminUpdateOrderStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "created",
          "paid",
          "ready",
          "picked_up",
          "cancelled",
          "no_show",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("terroir_orders")
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data;
    }),

  adminDeleteOrder: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { error } = await supabase
        .from("terroir_orders")
        .delete()
        .eq("id", input.id);

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });

      return { success: true };
    }),
});

const ramadanRouter = router({
  publicSummary: publicProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const { data: config } = await supabase
      .from("ramadan_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    const fallbackDate = getDateStringInTimeZone(
      new Date(),
      DEFAULT_RAMADAN_TIMEZONE
    );
    if (!config) {
      return {
        hijriYear: null,
        todayRamadanDay: null,
        totalsToDate: { meals: 0, beneficiaries: 0, volunteersPresence: 0 },
        asOfGregorianDate: fallbackDate,
        timezone: DEFAULT_RAMADAN_TIMEZONE,
        isInRamadan: false,
      };
    }

    const timezone = config.timezone || DEFAULT_RAMADAN_TIMEZONE;
    const todayDate = getDateStringInTimeZone(new Date(), timezone);
    const dayRaw = getRamadanDay(todayDate, config.gregorian_start_date);
    const todayRamadanDay = dayRaw === null ? null : Math.min(dayRaw, 30);

    let q = supabase
      .from("ramadan_daily_stats")
      .select("beneficiaries_served, meals_distributed, volunteers_present")
      .eq("config_id", config.id);

    if (todayRamadanDay !== null) q = q.lte("ramadan_day", todayRamadanDay);

    const { data: rows } = await q;
    const totals = (rows || []).reduce(
      (acc, row: any) => {
        acc.meals += row.meals_distributed || 0;
        acc.beneficiaries += row.beneficiaries_served || 0;
        acc.volunteersPresence += row.volunteers_present || 0;
        return acc;
      },
      { meals: 0, beneficiaries: 0, volunteersPresence: 0 }
    );

    return {
      hijriYear: config.hijri_year,
      todayRamadanDay,
      totalsToDate: totals,
      asOfGregorianDate: todayDate,
      timezone,
      isInRamadan: todayRamadanDay !== null,
      configId: config.id,
    };
  }),

  publicDaily: publicProcedure
    .input(
      z
        .object({ from: z.string().optional(), to: z.string().optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: config } = await supabase
        .from("ramadan_config")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();
      if (!config) return [];
      let q = supabase
        .from("ramadan_daily_stats")
        .select("*")
        .eq("config_id", config.id)
        .order("ramadan_day", { ascending: true });
      if (input?.from) q = q.gte("gregorian_date", input.from);
      if (input?.to) q = q.lte("gregorian_date", input.to);
      const { data, error } = await q;
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return data || [];
    }),

  getConfig: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("ramadan_config")
      .select("*")
      .order("created_at", { ascending: false });
    if (error)
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    const active = (data || []).find((c: any) => c.is_active) || null;
    return { active, configs: data || [] };
  }),

  createConfig: adminProcedure
    .input(
      z.object({
        hijriYear: z.string().min(1),
        gregorianStartDate: z.string(),
        timezone: z.string().default("Africa/Casablanca"),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      if (input.isActive)
        await supabase
          .from("ramadan_config")
          .update({ is_active: false })
          .eq("is_active", true);
      const { data, error } = await supabase
        .from("ramadan_config")
        .insert({
          hijri_year: input.hijriYear,
          gregorian_start_date: input.gregorianStartDate,
          timezone: input.timezone,
          is_active: input.isActive,
        })
        .select("*")
        .single();
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return data;
    }),

  updateConfig: adminProcedure
    .input(
      z.object({
        id: z.number(),
        hijriYear: z.string().optional(),
        gregorianStartDate: z.string().optional(),
        timezone: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      if (input.isActive)
        await supabase
          .from("ramadan_config")
          .update({ is_active: false })
          .eq("is_active", true)
          .neq("id", input.id);
      const updates: any = {};
      if (input.hijriYear !== undefined) updates.hijri_year = input.hijriYear;
      if (input.gregorianStartDate !== undefined)
        updates.gregorian_start_date = input.gregorianStartDate;
      if (input.timezone !== undefined) updates.timezone = input.timezone;
      if (input.isActive !== undefined) updates.is_active = input.isActive;
      const { data, error } = await supabase
        .from("ramadan_config")
        .update(updates)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return data;
    }),

  listStats: adminProcedure
    .input(
      z.object({
        configId: z.number(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let q = supabase
        .from("ramadan_daily_stats")
        .select("*")
        .eq("config_id", input.configId)
        .order("ramadan_day", { ascending: true });
      if (input.from) q = q.gte("gregorian_date", input.from);
      if (input.to) q = q.lte("gregorian_date", input.to);
      const { data, error } = await q;
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      const rows = data || [];
      const totals = rows.reduce(
        (acc, row: any) => {
          acc.meals += row.meals_distributed || 0;
          acc.beneficiaries += row.beneficiaries_served || 0;
          acc.volunteersPresence += row.volunteers_present || 0;
          return acc;
        },
        { meals: 0, beneficiaries: 0, volunteersPresence: 0 }
      );
      return { rows, totals };
    }),

  upsertStat: adminProcedure
    .input(
      z.object({
        configId: z.number(),
        ramadanDay: z.number().min(1).max(30),
        beneficiariesServed: z.number().int().min(0),
        mealsDistributed: z.number().int().min(0),
        volunteersPresent: z.number().int().min(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: config } = await supabase
        .from("ramadan_config")
        .select("gregorian_start_date")
        .eq("id", input.configId)
        .single();
      if (!config)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Configuration introuvable",
        });
      const gregorianDate = addDaysToDateString(
        config.gregorian_start_date,
        input.ramadanDay - 1
      );
      const { data, error } = await supabase
        .from("ramadan_daily_stats")
        .upsert(
          {
            config_id: input.configId,
            ramadan_day: input.ramadanDay,
            gregorian_date: gregorianDate,
            beneficiaries_served: input.beneficiariesServed,
            meals_distributed: input.mealsDistributed,
            volunteers_present: input.volunteersPresent,
            notes: input.notes ?? null,
          },
          { onConflict: "config_id,ramadan_day" }
        )
        .select("*")
        .single();
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return data;
    }),

  updateStat: adminProcedure
    .input(
      z.object({
        id: z.number(),
        beneficiariesServed: z.number().int().min(0),
        mealsDistributed: z.number().int().min(0),
        volunteersPresent: z.number().int().min(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("ramadan_daily_stats")
        .update({
          beneficiaries_served: input.beneficiariesServed,
          meals_distributed: input.mealsDistributed,
          volunteers_present: input.volunteersPresent,
          notes: input.notes ?? null,
        })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return data;
    }),

  deleteStat: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { error } = await supabase
        .from("ramadan_daily_stats")
        .delete()
        .eq("id", input.id);
      if (error)
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return { success: true };
    }),
});

const partnerLeadsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        companyName: z.string().min(2),
        contactName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        city: z.string().optional(),
        partnershipType: z.string().optional(),
        budgetRange: z.string().optional(),
        message: z.string().optional(),
        source: z.string().optional(),
        locale: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await siteDb.insertPartnerLead(galleryDb.db(ctx.env), input);

      try {
        const { sendEmail, generatePartnerLeadAdminNotificationEmail } =
          await import("./email");

        const adminEmailData = generatePartnerLeadAdminNotificationEmail(input);
        await sendEmail({
          to: "admin@ftourbabrayan.ma",
          subject: adminEmailData.subject,
          html: adminEmailData.html,
          apiKey: ctx.env.RESEND_API_KEY || ctx.env.EMAIL_PROVIDER_KEY || "",
        });
      } catch (emailError) {
        console.error("[Worker] Error sending partner lead email:", emailError);
      }

      return { success: true, id };
    }),
});

// ============================================
// INVENTORY ROUTER
// ============================================

function parseInvError(error: any): string {
  return error?.message || error?.details || "Erreur interne";
}

const inventoryEventsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["draft", "open", "closed", "archived"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let q = supabase
        .from("inventory_events")
        .select("*")
        .order("created_at", { ascending: false });
      if (input.status) q = q.eq("status", input.status);
      const { data, error } = await q;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data ?? [];
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        startsAt: z.string().optional(),
        endsAt: z.string().optional(),
        status: z.enum(["draft", "open", "closed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("inventory_events")
        .insert({
          name: input.name,
          description: input.description ?? null,
          starts_at: input.startsAt ?? null,
          ends_at: input.endsAt ?? null,
          status: input.status ?? "draft",
        })
        .select()
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        startsAt: z.string().nullable().optional(),
        endsAt: z.string().nullable().optional(),
        status: z.enum(["draft", "open", "closed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined)
        patch.description = input.description;
      if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
      if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
      if (input.status !== undefined) patch.status = input.status;
      const { data, error } = await supabase
        .from("inventory_events")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data;
    }),

  report: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: locations, error: locErr } = await supabase
        .from("inventory_locations")
        .select("*")
        .eq("event_id", input.eventId);
      if (locErr)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(locErr),
        });

      const posLocations = (locations ?? []).filter(
        (l: any) => l.type === "POS"
      );
      const bufferLocation =
        (locations ?? []).find((l: any) => l.type === "EVENT_BUFFER") ?? null;

      const locationIds = (locations ?? []).map((l: any) => l.id);
      const { data: balances } = locationIds.length
        ? await supabase
            .from("inventory_stock_balances")
            .select("*, inventory_products(*), inventory_locations(*)")
            .in("location_id", locationIds)
        : { data: [] };

      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("*")
        .eq("event_id", input.eventId);

      const posReports = posLocations.map((pos: any) => {
        const dispatched = (movements ?? [])
          .filter(
            (m: any) =>
              m.movement_type === "TRANSFER_IN" && m.to_location_id === pos.id
          )
          .reduce((s: number, m: any) => s + m.quantity, 0);
        const sold = (movements ?? [])
          .filter(
            (m: any) =>
              m.movement_type === "SALE" && m.pos_location_id === pos.id
          )
          .reduce((s: number, m: any) => s + m.quantity, 0);
        const returned = (movements ?? [])
          .filter(
            (m: any) =>
              m.movement_type === "RETURN_OUT" && m.from_location_id === pos.id
          )
          .reduce((s: number, m: any) => s + m.quantity, 0);
        const currentStock = (balances ?? [])
          .filter((b: any) => b.location_id === pos.id)
          .reduce((s: number, b: any) => s + b.quantity_on_hand, 0);
        return {
          location: pos,
          dispatched,
          sold,
          returned,
          theoreticalRemaining: dispatched - sold - returned,
          currentStock,
          variance: currentStock - (dispatched - sold - returned),
        };
      });

      return {
        eventId: input.eventId,
        bufferLocation,
        posReports,
        balances: balances ?? [],
      };
    }),
});

const inventoryProductsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        productType: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let q = supabase.from("inventory_products").select("*").order("name");
      if (input.isActive !== undefined) q = q.eq("is_active", input.isActive);
      if (input.productType) q = q.eq("product_type", input.productType);
      if (input.search) q = q.ilike("name", `%${input.search}%`);
      const { data, error } = await q;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data ?? [];
    }),

  create: adminProcedure
    .input(
      z.object({
        productType: z.string(),
        name: z.string().min(1),
        sku: z.string().nullable().optional(),
        barcode: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        unit: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("inventory_products")
        .insert({
          product_type: input.productType,
          name: input.name,
          sku: input.sku ?? null,
          barcode: input.barcode ?? null,
          category: input.category ?? null,
          unit: input.unit ?? "piece",
          is_active: true,
        })
        .select()
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        sku: z.string().nullable().optional(),
        barcode: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        unit: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.sku !== undefined) patch.sku = input.sku;
      if (input.barcode !== undefined) patch.barcode = input.barcode;
      if (input.category !== undefined) patch.category = input.category;
      if (input.unit !== undefined) patch.unit = input.unit;
      if (input.isActive !== undefined) patch.is_active = input.isActive;
      const { data, error } = await supabase
        .from("inventory_products")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data;
    }),
});

const inventoryLocationsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        type: z.string().optional(),
        eventId: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let q = supabase.from("inventory_locations").select("*").order("name");
      if (input.type) q = q.eq("type", input.type);
      if (input.eventId !== undefined) q = q.eq("event_id", input.eventId);
      if (input.isActive !== undefined) q = q.eq("is_active", input.isActive);
      const { data, error } = await q;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data ?? [];
    }),

  create: adminProcedure
    .input(
      z.object({
        type: z.enum(["GLOBAL", "EVENT_BUFFER", "POS"]),
        code: z.string(),
        name: z.string().min(1),
        eventId: z.number().nullable().optional(),
        parentLocationId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("inventory_locations")
        .insert({
          type: input.type,
          code: input.code,
          name: input.name,
          event_id: input.eventId ?? null,
          parent_location_id: input.parentLocationId ?? null,
          is_active: true,
        })
        .select()
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data;
    }),

  globalLocation: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("inventory_locations")
      .select("*")
      .eq("type", "GLOBAL")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (error)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Emplacement global non trouvé.",
      });
    return data;
  }),
});

const inventoryStockRouter = router({
  transfer: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        fromLocationId: z.number(),
        toLocationId: z.number(),
        eventId: z.number().nullable().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase.rpc("inventory_transfer_stock", {
        p_product_id: input.productId,
        p_quantity: input.quantity,
        p_from_location: input.fromLocationId,
        p_to_location: input.toLocationId,
        p_event_id: input.eventId ?? null,
        p_reason: input.reason ?? null,
        p_note: null,
        p_performed_by: null,
      });
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return { movementIds: data as number[] };
    }),

  addStock: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        locationId: z.number(),
        quantity: z.number().positive(),
        movementType: z.enum([
          "INITIAL_LOAD",
          "PURCHASE_IN",
          "DONATION_IN",
          "PRODUCTION_IN",
        ]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase.rpc("inventory_add_stock", {
        p_product_id: input.productId,
        p_location_id: input.locationId,
        p_quantity: input.quantity,
        p_movement_type: input.movementType,
        p_reason: input.reason ?? null,
        p_note: null,
        p_performed_by: null,
        p_reference_type: null,
        p_reference_id: null,
      });
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return { movementId: data as number };
    }),

  recordReturn: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        fromPosLocationId: z.number(),
        toBufferLocationId: z.number(),
        eventId: z.number().nullable().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase.rpc("inventory_record_return", {
        p_product_id: input.productId,
        p_quantity: input.quantity,
        p_from_pos_location: input.fromPosLocationId,
        p_to_buffer_location: input.toBufferLocationId,
        p_event_id: input.eventId ?? null,
        p_reason: input.reason ?? null,
        p_note: null,
        p_performed_by: null,
      });
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return { movementIds: data as number[] };
    }),

  adjust: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        locationId: z.number(),
        qtyDelta: z.number(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase.rpc("inventory_adjust_stock", {
        p_product_id: input.productId,
        p_location_id: input.locationId,
        p_qty_delta: input.qtyDelta,
        p_reason: input.reason,
        p_note: null,
        p_performed_by: null,
      });
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return { movementId: data as number };
    }),

  overview: adminProcedure.query(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    const { data, error } = await supabase
      .from("inventory_stock_balances")
      .select(
        "quantity_on_hand, inventory_products(id, name, category, product_type), inventory_locations(id, type, name, event_id)"
      );
    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: parseInvError(error),
      });
    return data ?? [];
  }),

  movements: adminProcedure
    .input(
      z.object({
        productId: z.number().optional(),
        locationId: z.number().optional(),
        eventId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const limit = Math.min(input.limit ?? 50, 500);
      const offset = input.offset ?? 0;
      let q = supabase
        .from("inventory_movements")
        .select(
          `*, inventory_products(id, name, category, product_type, sku), from_location:inventory_locations!inventory_movements_from_location_id_fkey(id, name, type, code), to_location:inventory_locations!inventory_movements_to_location_id_fkey(id, name, type, code), inventory_events(id, name)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (input.productId) q = q.eq("product_id", input.productId);
      if (input.eventId) q = q.eq("event_id", input.eventId);
      if (input.locationId)
        q = q.or(
          `from_location_id.eq.${input.locationId},to_location_id.eq.${input.locationId}`
        );
      const { data, error, count } = await q;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return { movements: data ?? [], total: count ?? 0 };
    }),
});

const inventoryMovementsRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          productId: z.number().optional(),
          locationId: z.number().optional(),
          eventId: z.number().optional(),
          movementType: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const limit = Math.min(input?.limit ?? 50, 500);
      const offset = input?.offset ?? 0;
      let q = supabase
        .from("inventory_movements")
        .select(
          `*, inventory_products(id, name, category, product_type, sku), from_location:inventory_locations!inventory_movements_from_location_id_fkey(id, name, type, code), to_location:inventory_locations!inventory_movements_to_location_id_fkey(id, name, type, code), inventory_events(id, name)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (input?.productId) q = q.eq("product_id", input.productId);
      if (input?.eventId) q = q.eq("event_id", input.eventId);
      if (input?.movementType) q = q.eq("movement_type", input.movementType);
      if (input?.dateFrom) q = q.gte("created_at", input.dateFrom);
      if (input?.dateTo) q = q.lte("created_at", input.dateTo);
      if (input?.locationId)
        q = q.or(
          `from_location_id.eq.${input.locationId},to_location_id.eq.${input.locationId},pos_location_id.eq.${input.locationId}`
        );
      const { data, error, count } = await q;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return { movements: data ?? [], total: count ?? 0 };
    }),
});

// ---- Stock Entry QR helpers ----
function makeWorkerStockEntrySlug(productId: number): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return `stk_${productId}_${rand}`;
}
async function workerEnsureStockEntryQrSlug(
  supabase: any,
  productId: number
): Promise<string> {
  const { data: existing } = await supabase
    .from("inventory_products")
    .select("id, stock_entry_qr_slug")
    .eq("id", productId)
    .single();
  if (existing?.stock_entry_qr_slug) return existing.stock_entry_qr_slug;
  for (let i = 0; i < 5; i++) {
    const slug = makeWorkerStockEntrySlug(productId);
    const { data, error } = await supabase
      .from("inventory_products")
      .update({ stock_entry_qr_slug: slug })
      .eq("id", productId)
      .is("stock_entry_qr_slug", null)
      .select("stock_entry_qr_slug")
      .single();
    if (!error && data?.stock_entry_qr_slug) return data.stock_entry_qr_slug;
    const { data: refreshed } = await supabase
      .from("inventory_products")
      .select("stock_entry_qr_slug")
      .eq("id", productId)
      .single();
    if (refreshed?.stock_entry_qr_slug) return refreshed.stock_entry_qr_slug;
  }
  throw new Error("Impossible de générer un QR d'entrée de stock");
}

const inventoryStockEntryRouter = router({
  listProducts: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let q = supabase.from("inventory_products").select("*").order("name");
      if (input?.isActive !== undefined) q = q.eq("is_active", input.isActive);
      if (input?.search) {
        const p = `%${input.search}%`;
        q = q.or(
          `name.ilike.${p},sku.ilike.${p},category.ilike.${p},barcode.ilike.${p}`
        );
      }
      const { data: products, error } = await q;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      const rows = products ?? [];
      await Promise.all(
        rows
          .filter((p: any) => !p.stock_entry_qr_slug)
          .map((p: any) => workerEnsureStockEntryQrSlug(supabase, p.id))
      );
      const productIds = rows.map((p: any) => p.id);
      let globalLocId: number | null = null;
      try {
        const { data: loc } = await supabase
          .from("inventory_locations")
          .select("id")
          .eq("type", "GLOBAL")
          .eq("is_active", true)
          .limit(1)
          .single();
        globalLocId = loc?.id ?? null;
      } catch {
        /* no global location yet */
      }
      let balances: Array<{ product_id: number; quantity_on_hand: number }> =
        [];
      if (globalLocId && productIds.length) {
        const { data } = await supabase
          .from("inventory_stock_balances")
          .select("product_id, quantity_on_hand")
          .eq("location_id", globalLocId)
          .in("product_id", productIds);
        balances = data ?? [];
      }
      const byBalance = new Map<number, number>(
        balances.map((b: any) => [b.product_id, b.quantity_on_hand])
      );
      const normalized = await Promise.all(
        rows.map(async (p: any) => {
          const slug =
            p.stock_entry_qr_slug ??
            (await workerEnsureStockEntryQrSlug(supabase, p.id));
          return {
            ...p,
            stock_entry_qr_slug: slug,
            global_stock: byBalance.get(p.id) ?? 0,
          };
        })
      );
      return { globalLocationId: globalLocId, products: normalized };
    }),

  getProductDetail: adminProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: product, error } = await supabase
        .from("inventory_products")
        .select("*")
        .eq("id", input.productId)
        .single();
      if (error)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: parseInvError(error),
        });
      const slug =
        product.stock_entry_qr_slug ??
        (await workerEnsureStockEntryQrSlug(supabase, input.productId));
      const { data: globalLoc } = await supabase
        .from("inventory_locations")
        .select("*")
        .eq("type", "GLOBAL")
        .eq("is_active", true)
        .limit(1)
        .single();
      let globalStock = 0;
      if (globalLoc) {
        const { data: bal } = await supabase
          .from("inventory_stock_balances")
          .select("quantity_on_hand")
          .eq("product_id", input.productId)
          .eq("location_id", globalLoc.id)
          .maybeSingle();
        globalStock = bal?.quantity_on_hand ?? 0;
      }
      const { data: history } = await supabase
        .from("inventory_movements")
        .select("*, users(id, username, email)")
        .eq("product_id", input.productId)
        .eq("reference_type", "QR_STOCK_ENTRY")
        .order("created_at", { ascending: false })
        .limit(20);
      return {
        product: { ...product, stock_entry_qr_slug: slug },
        globalLocation: globalLoc ?? null,
        globalStock,
        history: history ?? [],
        lastEntry: (history ?? [])[0] ?? null,
      };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(6).max(140) }))
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("inventory_products")
        .select("*")
        .eq("stock_entry_qr_slug", input.slug)
        .maybeSingle();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      if (!data)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit introuvable",
        });
      if (!data.stock_entry_qr_enabled)
        throw new TRPCError({ code: "FORBIDDEN", message: "QR inactif" });
      return data;
    }),

  ensureQr: adminProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const slug = await workerEnsureStockEntryQrSlug(
        supabase,
        input.productId
      );
      return { slug };
    }),

  regenerateQr: adminProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      for (let i = 0; i < 5; i++) {
        const slug = makeWorkerStockEntrySlug(input.productId);
        const { data, error } = await supabase
          .from("inventory_products")
          .update({ stock_entry_qr_slug: slug, stock_entry_qr_enabled: true })
          .eq("id", input.productId)
          .select("stock_entry_qr_slug")
          .single();
        if (!error && data?.stock_entry_qr_slug)
          return { slug: data.stock_entry_qr_slug };
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de régénérer le QR",
      });
    }),

  setQrEnabled: adminProcedure
    .input(
      z.object({ productId: z.number().int().positive(), enabled: z.boolean() })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data, error } = await supabase
        .from("inventory_products")
        .update({ stock_entry_qr_enabled: input.enabled })
        .eq("id", input.productId)
        .select("id, stock_entry_qr_enabled")
        .single();
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data;
    }),

  submit: adminProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().positive(),
        entryType: z
          .enum(["INITIAL_LOAD", "PURCHASE_IN", "DONATION_IN", "PRODUCTION_IN"])
          .optional(),
        note: z.string().max(500).optional(),
        reason: z.string().max(500).optional(),
        eventId: z.number().int().positive().optional(),
        posLocationId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { data: product, error: pErr } = await supabase
        .from("inventory_products")
        .select("*")
        .eq("id", input.productId)
        .single();
      if (pErr || !product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit introuvable",
        });
      if (!product.stock_entry_qr_enabled)
        throw new TRPCError({ code: "FORBIDDEN", message: "QR inactif" });
      const { data: globalLoc, error: locErr } = await supabase
        .from("inventory_locations")
        .select("*")
        .eq("type", "GLOBAL")
        .eq("is_active", true)
        .limit(1)
        .single();
      if (locErr || !globalLoc)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Emplacement global non trouvé",
        });
      const slug =
        product.stock_entry_qr_slug ??
        (await workerEnsureStockEntryQrSlug(supabase, input.productId));
      const { data: mvt, error: mvtErr } = await supabase.rpc(
        "inventory_add_stock",
        {
          p_product_id: input.productId,
          p_location_id: globalLoc.id,
          p_quantity: input.qty,
          p_movement_type: input.entryType ?? "PURCHASE_IN",
          p_reason: input.reason ?? "Entrée stock via QR",
          p_note: input.note ?? null,
          p_performed_by: ctx.user?.id ?? null,
          p_reference_type: "QR_STOCK_ENTRY",
          p_reference_id: slug,
        }
      );
      if (mvtErr)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(mvtErr),
        });

      let resolvedEventId = input.eventId ?? null;
      let resolvedPosLocationId = input.posLocationId ?? null;

      if (resolvedPosLocationId) {
        const { data: posLocation, error: posErr } = await supabase
          .from("inventory_locations")
          .select("id, type, event_id")
          .eq("id", resolvedPosLocationId)
          .maybeSingle();
        if (posErr || !posLocation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Point de vente introuvable pour ce scanner.",
          });
        }
        if (posLocation.type !== "POS") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "L’emplacement sélectionné n’est pas un point de vente.",
          });
        }
        if (!posLocation.event_id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Le point de vente sélectionné n’est lié à aucun événement.",
          });
        }
        if (resolvedEventId && resolvedEventId !== posLocation.event_id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Le point de vente ne correspond pas à l’événement configuré.",
          });
        }
        resolvedEventId = posLocation.event_id;
      }

      if (resolvedEventId || resolvedPosLocationId) {
        const { error: updateMovementErr } = await supabase
          .from("inventory_movements")
          .update({
            event_id: resolvedEventId,
            pos_location_id: resolvedPosLocationId,
          })
          .eq("id", mvt as number);
        if (updateMovementErr) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: parseInvError(updateMovementErr),
          });
        }
      }

      const { data: bal } = await supabase
        .from("inventory_stock_balances")
        .select("quantity_on_hand")
        .eq("product_id", input.productId)
        .eq("location_id", globalLoc.id)
        .maybeSingle();
      return {
        movementId: mvt as number,
        globalLocationId: globalLoc.id,
        newGlobalBalance: bal?.quantity_on_hand ?? 0,
        eventId: resolvedEventId,
        posLocationId: resolvedPosLocationId,
      };
    }),

  history: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(300).optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const limit = Math.min(input?.limit ?? 100, 300);
      const { data, error } = await supabase
        .from("inventory_movements")
        .select(
          "*, inventory_products(id, name, category, sku), users(id, username, email)"
        )
        .eq("reference_type", "QR_STOCK_ENTRY")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: parseInvError(error),
        });
      return data ?? [];
    }),
});

const inventoryRouter = router({
  events: inventoryEventsRouter,
  products: inventoryProductsRouter,
  locations: inventoryLocationsRouter,
  stock: inventoryStockRouter,
  movements: inventoryMovementsRouter,
  stockEntry: inventoryStockEntryRouter,

  syncAllCatalogs: adminProcedure.mutation(async ({ ctx }) => {
    const supabase = createSupabaseAdmin(ctx.env);
    let synced = 0;
    let errors = 0;
    const details: string[] = [];

    // Helper: upsert one catalog item into inventory_products
    async function syncOne(args: {
      productType: string;
      sourceProductId: number;
      sourceVariantId?: number | null;
      name: string;
      sku?: string | null;
      category?: string | null;
    }) {
      let q = supabase
        .from("inventory_products")
        .select("id")
        .eq("product_type", args.productType)
        .eq("source_product_id", args.sourceProductId);
      q = args.sourceVariantId
        ? q.eq("source_variant_id", args.sourceVariantId)
        : q.is("source_variant_id", null);
      const { data: existing } = await q.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("inventory_products")
          .update({
            name: args.name,
            sku: args.sku ?? null,
            category: args.category ?? null,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("inventory_products").insert({
          product_type: args.productType,
          source_product_id: args.sourceProductId,
          source_variant_id: args.sourceVariantId ?? null,
          name: args.name,
          sku: args.sku ?? null,
          category: args.category ?? null,
          unit: "piece",
          is_active: true,
        });
        if (error) throw new Error(error.message);
      }
    }

    // Goodies
    const { data: goodies } = await supabase
      .from("goodies")
      .select("id, name, category");
    for (const g of goodies ?? []) {
      try {
        await syncOne({
          productType: "goodie",
          sourceProductId: g.id,
          name: g.name,
          category: g.category ?? null,
        });
        synced++;
      } catch (e: any) {
        errors++;
        details.push(`goodie#${g.id}: ${e.message}`);
      }
    }

    // Goodie variants
    const { data: goodieVariants } = await supabase
      .from("goodie_variants")
      .select("id, goodie_id, name, sku, goodies(name, category)");
    for (const v of goodieVariants ?? []) {
      try {
        const parent = (v as any).goodies;
        await syncOne({
          productType: "goodie_variant",
          sourceProductId: (v as any).goodie_id,
          sourceVariantId: v.id,
          name: parent ? `${parent.name} – ${v.name}` : v.name,
          sku: v.sku ?? null,
          category: parent?.category ?? null,
        });
        synced++;
      } catch (e: any) {
        errors++;
        details.push(`goodie_variant#${v.id}: ${e.message}`);
      }
    }

    // Terroir products
    const { data: terroirProducts } = await supabase
      .from("terroir_products")
      .select("id, name, category");
    for (const t of terroirProducts ?? []) {
      try {
        await syncOne({
          productType: "terroir_product",
          sourceProductId: t.id,
          name: t.name,
          category: t.category ?? null,
        });
        synced++;
      } catch (e: any) {
        errors++;
        details.push(`terroir_product#${t.id}: ${e.message}`);
      }
    }

    // Terroir variants
    const { data: terroirVariants } = await supabase
      .from("terroir_product_variants")
      .select("id, product_id, label, sku, terroir_products(name, category)");
    for (const v of terroirVariants ?? []) {
      try {
        const parent = (v as any).terroir_products;
        await syncOne({
          productType: "terroir_variant",
          sourceProductId: (v as any).product_id,
          sourceVariantId: v.id,
          name: parent ? `${parent.name} – ${v.label}` : v.label,
          sku: v.sku ?? null,
          category: parent?.category ?? null,
        });
        synced++;
      } catch (e: any) {
        errors++;
        details.push(`terroir_variant#${v.id}: ${e.message}`);
      }
    }

    // Pastries
    const { data: pastries } = await supabase
      .from("pastries")
      .select("id, name, category");
    for (const p of pastries ?? []) {
      try {
        await syncOne({
          productType: "pastry",
          sourceProductId: p.id,
          name: p.name,
          category: p.category ?? null,
        });
        synced++;
      } catch (e: any) {
        errors++;
        details.push(`pastry#${p.id}: ${e.message}`);
      }
    }

    return { synced, errors, details };
  }),
});

// ============================================
// ELECTION MANAGERS ROUTER
// Système d'élection annuelle des managers du Ramadan
// ============================================

const ELECTION_MIN_PARTICIPATIONS = 3;
// per request: Workers freeze Date at module load (getFullYear() would be 1970)
const electionYear = () => new Date().getFullYear();

const electionAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ["admin", "super_admin", "admin_ops", "admin_operations"];
  if (!ctx.user || !allowed.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès administrateur requis",
    });
  }
  return next({ ctx });
});

async function getElectionParticipationCount(
  email: string,
  env: any
): Promise<number> {
  const admin = createSupabaseAdmin(env);
  const { count, error } = await admin
    .from("volunteers")
    .select("*", { count: "exact", head: true })
    .ilike("email", email.trim())
    .in("status", ["present", "confirmed", "registered"]);
  if (error) return 0;
  return count ?? 0;
}

const electionRouter = router({
  getSettings: publicProcedure.query(({ ctx }) =>
    electionDb.getSettings(galleryDb.db(ctx.env), electionYear())
  ),

  listCandidates: publicProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(({ ctx, input }) =>
      electionDb.listCandidates(
        galleryDb.db(ctx.env),
        input?.year ?? electionYear(),
        { status: "approved" }
      )
    ),

  getResults: publicProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(({ ctx, input }) =>
      electionDb.results(galleryDb.db(ctx.env), input?.year ?? electionYear())
    ),

  getManagersHistory: publicProcedure.query(({ ctx }) =>
    electionDb.history(galleryDb.db(ctx.env))
  ),

  checkMyEligibility: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.user.email;
    if (!email)
      return {
        eligible: false,
        participationCount: 0,
        minRequired: ELECTION_MIN_PARTICIPATIONS,
      };
    const count = await getElectionParticipationCount(email, ctx.env);
    return {
      eligible: count >= ELECTION_MIN_PARTICIPATIONS,
      participationCount: count,
      minRequired: ELECTION_MIN_PARTICIPATIONS,
    };
  }),

  checkMyVote: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.user.email;
    if (!email) return { hasVoted: false, candidateId: null };
    const candidateId = await electionDb.getVote(
      galleryDb.db(ctx.env),
      email.toLowerCase().trim(),
      electionYear()
    );
    return { hasVoted: !!candidateId, candidateId };
  }),

  vote: protectedProcedure
    .input(z.object({ candidateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const d = galleryDb.db(ctx.env);
      const email = ctx.user.email;
      if (!email)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email introuvable",
        });
      const year = electionYear();
      if (!(await electionDb.isOpen(d, year))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "L'élection n'est pas ouverte.",
        });
      }
      const count = await getElectionParticipationCount(email, ctx.env);
      if (count < ELECTION_MIN_PARTICIPATIONS) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Seuls les bénévoles ayant participé à au moins ${ELECTION_MIN_PARTICIPATIONS} actions Bab Rayan peuvent voter.`,
        });
      }
      const outcome = await electionDb.castVote(
        d,
        email.toLowerCase().trim(),
        input.candidateId,
        year
      );
      if (outcome === "already_voted")
        throw new TRPCError({
          code: "CONFLICT",
          message: "Vous avez déjà voté.",
        });
      if (outcome === "no_candidate")
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Candidat introuvable.",
        });
      return { success: true };
    }),

  submitCandidacy: protectedProcedure
    .input(
      z.object({
        first_name: z.string().min(2).max(100),
        last_name: z.string().min(2).max(100),
        email: z.string().email(),
        phone: z.string().optional(),
        photo_url: z.string().url().optional(),
        motivation_text: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const d = galleryDb.db(ctx.env);
      const userEmail = ctx.user.email ?? input.email;
      const year = electionYear();
      const count = await getElectionParticipationCount(userEmail, ctx.env);
      if (count < ELECTION_MIN_PARTICIPATIONS) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Vous devez avoir participé à au moins ${ELECTION_MIN_PARTICIPATIONS} événements Bab Rayan pour vous présenter.`,
        });
      }
      if (await electionDb.hasCandidacy(d, userEmail, year))
        throw new TRPCError({
          code: "CONFLICT",
          message: "Vous avez déjà soumis une candidature pour cette année.",
        });
      try {
        return await electionDb.createCandidate(d, {
          first_name: input.first_name,
          last_name: input.last_name,
          email: userEmail.toLowerCase().trim(),
          phone: input.phone ?? null,
          photo_url: input.photo_url ?? null,
          motivation_text: input.motivation_text ?? null,
          participation_count: count,
          election_year: year,
        });
      } catch (e) {
        if (/UNIQUE/i.test(String((e as Error).message)))
          throw new TRPCError({
            code: "CONFLICT",
            message: "Candidature déjà soumise.",
          });
        throw e;
      }
    }),

  getPhotoUploadUrl: protectedProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const admin = createSupabaseAdmin(ctx.env);
      const userId = ctx.user.openId ?? ctx.user.id.toString();
      const ext = input.fileName.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { data, error } = await admin.storage
        .from("manager-candidates")
        .createSignedUploadUrl(path);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      const publicUrl = admin.storage
        .from("manager-candidates")
        .getPublicUrl(path).data.publicUrl;
      return { signedUrl: data.signedUrl, token: data.token, path, publicUrl };
    }),

  admin_listCandidates: electionAdminProcedure
    .input(
      z
        .object({ year: z.number().optional(), status: z.string().optional() })
        .optional()
    )
    .query(({ ctx, input }) =>
      electionDb.listCandidates(
        galleryDb.db(ctx.env),
        input?.year ?? electionYear(),
        { status: input?.status, newestFirst: true }
      )
    ),

  admin_updateCandidateStatus: electionAdminProcedure
    .input(
      z.object({
        candidateId: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = await electionDb.setCandidateStatus(
        galleryDb.db(ctx.env),
        input.candidateId,
        input.status
      );
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidat introuvable." });
      return data;
    }),

  admin_getStats: electionAdminProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(({ ctx, input }) =>
      electionDb.stats(galleryDb.db(ctx.env), input?.year ?? electionYear())
    ),

  admin_getLiveRanking: electionAdminProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(({ ctx, input }) =>
      electionDb.results(galleryDb.db(ctx.env), input?.year ?? electionYear())
    ),

  admin_updateSettings: electionAdminProcedure
    .input(
      z.object({
        year: z.number().optional(),
        is_open: z.boolean().optional(),
        max_managers: z.number().int().min(1).max(50).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      electionDb.upsertSettings(
        galleryDb.db(ctx.env),
        input.year ?? electionYear(),
        { is_open: input.is_open, max_managers: input.max_managers }
      )
    ),

  admin_listVotes: electionAdminProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(({ ctx, input }) =>
      electionDb.listVotes(galleryDb.db(ctx.env), input?.year ?? electionYear())
    ),

  admin_deleteCandidate: electionAdminProcedure
    .input(z.object({ candidateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await electionDb.deleteCandidate(galleryDb.db(ctx.env), input.candidateId);
      return { success: true };
    }),
});

// ============================================
// TEAM ROUTER
// ============================================

const teamAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = [
    "admin",
    "super_admin",
    "admin_contenu",
    "admin_ops",
    "admin_operations",
  ];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès administrateur requis",
    });
  }
  return next({ ctx });
});

function parseBase64ImageData(photoBase64: string) {
  const match = photoBase64.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Format image invalide",
    });
  }

  const mimeType = match[1].toLowerCase();
  const base64Data = match[2];
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const ext = extensionByMime[mimeType];
  if (!ext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Format image non supporté (jpeg, png, webp)",
    });
  }

  const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  return { mimeType, ext, buffer };
}

function mapTeamMember(row: any) {
  return {
    id: row.id,
    firstName: row.first_name ?? row.firstName ?? "",
    lastName: row.last_name ?? row.lastName ?? "",
    role: row.role ?? null,
    citation: row.citation ?? null,
    photoUrl: row.photo_url ?? row.photoUrl ?? null,
    displayOrder: row.display_order ?? row.displayOrder ?? 0,
    edition: row.edition ?? 12,
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

const teamRouter = router({
  listPublic: publicProcedure
    .input(z.object({ edition: z.number().int().min(1).default(12) }))
    .query(async ({ ctx, input }) => {
      const data = await siteDb.listTeam(galleryDb.db(ctx.env), {
        edition: input.edition,
        onlyActive: true,
      });
      return data.map(mapTeamMember);
    }),

  list: teamAdminProcedure
    .input(z.object({ edition: z.number().int().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const data = await siteDb.listTeam(galleryDb.db(ctx.env), {
        edition: input.edition,
      });
      return data.map(mapTeamMember);
    }),

  create: teamAdminProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.string().optional(),
        citation: z.string().optional(),
        photoBase64: z.string().optional(),
        photoUrl: z.string().optional(),
        displayOrder: z.number().int().min(0).default(0),
        edition: z.number().int().min(1).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      let photoUrl = input.photoUrl ?? null;

      if (input.photoBase64) {
        const { mimeType, ext, buffer } = parseBase64ImageData(
          input.photoBase64
        );
        const key = `team/edition-${input.edition}/${Date.now()}-${input.firstName.toLowerCase()}-${input.lastName.toLowerCase()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("images")
          .upload(key, buffer, { contentType: mimeType, upsert: false });
        if (uploadError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: uploadError.message,
          });
        const { data: urlData } = supabase.storage
          .from("images")
          .getPublicUrl(uploadData.path);
        photoUrl = urlData.publicUrl;
      }

      return siteDb.createTeam(galleryDb.db(ctx.env), {
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role ?? null,
        citation: input.citation ?? null,
        photoUrl,
        displayOrder: input.displayOrder,
        edition: input.edition,
      });
    }),

  update: teamAdminProcedure
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
    .mutation(async ({ ctx, input }) => {
      const supabase = createSupabaseAdmin(ctx.env);
      const { id, photoBase64, ...rest } = input;
      let photoUrl = rest.photoUrl ?? undefined;

      if (photoBase64) {
        const { mimeType, ext, buffer } = parseBase64ImageData(photoBase64);
        const edition = rest.edition ?? 12;
        const key = `team/edition-${edition}/${Date.now()}-${id}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("images")
          .upload(key, buffer, { contentType: mimeType, upsert: false });
        if (uploadError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: uploadError.message,
          });
        const { data: urlData } = supabase.storage
          .from("images")
          .getPublicUrl(uploadData.path);
        photoUrl = urlData.publicUrl;
      }

      const updates: Record<string, unknown> = {};
      if (rest.firstName !== undefined) updates.first_name = rest.firstName;
      if (rest.lastName !== undefined) updates.last_name = rest.lastName;
      if (rest.role !== undefined) updates.role = rest.role;
      if (rest.citation !== undefined) updates.citation = rest.citation;
      if (photoUrl !== undefined) updates.photo_url = photoUrl;
      if (rest.displayOrder !== undefined)
        updates.display_order = rest.displayOrder;
      if (rest.edition !== undefined) updates.edition = rest.edition;
      if (rest.isActive !== undefined) updates.is_active = rest.isActive;

      const data = await siteDb.updateTeam(galleryDb.db(ctx.env), id, updates);
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: "Membre introuvable." });
      return data;
    }),

  delete: teamAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await siteDb.deleteTeam(galleryDb.db(ctx.env), input.id);
      return { success: true };
    }),

  reorder: teamAdminProcedure
    .input(z.object({ orderedIds: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      await siteDb.reorderTeam(galleryDb.db(ctx.env), input.orderedIds);
      return { success: true };
    }),
});

// ============================================
// BLOG ROUTER
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

const BLOG_ADMIN_ROLES = [
  "admin",
  "super_admin",
  "admin_ops",
  "admin_contenu",
] as const;

const blogAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (
    !ctx.user ||
    !(BLOG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role)
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

function blogSlugify(text: string): string {
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

const createBlogPostSchema = z.object({
  title: z.string().min(5).max(255),
  content: z.string().min(50),
  type: z.enum(BLOG_POST_TYPES),
  categories: z.array(z.enum(BLOG_CATEGORIES)).min(1).max(4),
  hook: z.string().max(255).optional(),
  coverImage: z.string().url().optional().or(z.literal("")),
  consented: z.literal(true, {
    errorMap: () => ({
      message: "Vous devez accepter les conditions de publication.",
    }),
  }),
});

const listBlogPostsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(9),
  type: z.enum(BLOG_POST_TYPES).optional(),
  category: z.enum(BLOG_CATEGORIES).optional(),
  sort: z.enum(["recent", "popular", "views"]).default("recent"),
  search: z.string().max(100).optional(),
  status: z.enum(BLOG_STATUSES).optional(),
  authorId: z.number().int().optional(),
});

const updateBlogPostSchema = z.object({
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

const blogRouter = router({
  list: publicProcedure.input(listBlogPostsSchema).query(async ({ ctx, input }) => {
    const { posts, total } = await blogDb.listPosts(
      galleryDb.db(ctx.env),
      { ...input, status: "approved" },
      false
    );
    return { posts, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const data = await blogDb.bySlug(galleryDb.db(ctx.env), input.slug);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable." });
      return data;
    }),

  related: publicProcedure
    .input(z.object({ postId: z.number().int(), type: z.enum(BLOG_POST_TYPES) }))
    .query(({ ctx, input }) => blogDb.related(galleryDb.db(ctx.env), input.postId, input.type)),

  incrementViews: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await blogDb.incrementViews(galleryDb.db(ctx.env), input.slug);
      return { success: true };
    }),

  latestForHome: publicProcedure.query(({ ctx }) => blogDb.latest(galleryDb.db(ctx.env))),

  create: protectedProcedure.input(createBlogPostSchema).mutation(async ({ ctx, input }) => {
    const d = galleryDb.db(ctx.env);
    const created = await blogDb.createPost(d, {
      title: input.title,
      slug: await blogDb.uniqueSlug(d, blogSlugify(input.title)),
      content: input.content,
      excerpt: input.content.replace(/<[^>]*>/g, "").slice(0, 200).trim(),
      hook: input.hook || null,
      authorId: ctx.user.id,
      authorName: ctx.user.name || "Anonyme",
      type: input.type,
      categories: input.categories,
      coverImage: input.coverImage || null,
    });
    return { id: created.id, slug: created.slug };
  }),

  toggleLike: protectedProcedure
    .input(z.object({ postId: z.number().int() }))
    .mutation(async ({ ctx, input }) => ({
      liked: await blogDb.toggleLike(galleryDb.db(ctx.env), input.postId, ctx.user.id),
    })),

  hasLiked: protectedProcedure
    .input(z.object({ postId: z.number().int() }))
    .query(async ({ ctx, input }) => ({
      liked: await blogDb.hasLiked(galleryDb.db(ctx.env), input.postId, ctx.user.id),
    })),

  adminList: blogAdminProcedure.input(listBlogPostsSchema).query(async ({ ctx, input }) => {
    const { posts, total } = await blogDb.listPosts(galleryDb.db(ctx.env), input, true);
    return { posts, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
  }),

  adminGetById: blogAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const data = await blogDb.getById(galleryDb.db(ctx.env), input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable." });
      return data;
    }),

  approve: blogAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await blogDb.updatePost(galleryDb.db(ctx.env), input.id, { status: "approved", rejection_note: null });
      return { success: true };
    }),

  reject: blogAdminProcedure
    .input(z.object({ id: z.number().int(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await blogDb.updatePost(galleryDb.db(ctx.env), input.id, {
        status: "rejected",
        rejection_note: input.note || null,
      });
      return { success: true };
    }),

  update: blogAdminProcedure.input(updateBlogPostSchema).mutation(async ({ ctx, input }) => {
    const d = galleryDb.db(ctx.env);
    const { id, coverImage, rejectionNote, ...rest } = input;
    const patch: blogDb.PostPatch = { ...rest };
    if (coverImage !== undefined) patch.cover_image = coverImage || null;
    if (rejectionNote !== undefined) patch.rejection_note = rejectionNote || null;
    if (rest.title) patch.slug = await blogDb.uniqueSlug(d, blogSlugify(rest.title), id);
    if (rest.content) patch.excerpt = rest.content.replace(/<[^>]*>/g, "").slice(0, 200).trim();
    await blogDb.updatePost(d, id, patch);
    return { success: true };
  }),

  delete: blogAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await blogDb.deletePost(galleryDb.db(ctx.env), input.id);
      return { success: true };
    }),

  stats: blogAdminProcedure.query(({ ctx }) => blogDb.stats(galleryDb.db(ctx.env))),
});

// ============================================
// EVENT FEEDBACK ROUTER
// ============================================

const FEEDBACK_ROLES = [
  "VOLUNTEER",
  "MANAGER",
  "GROUP",
  "BENEFICIARY",
  "VISITOR",
  "PARTNER",
] as const;
const PARTICIPATION_TYPES = [
  "FTOR",
  "NIGHT_26",
  "VOLUNTEER_EVENT",
  "THANK_YOU_EVENT",
] as const;

const LOW_SCORE_THRESHOLD = 3;

function generateEventFeedbackAutoTags(
  sections: Array<{ sectionKey: string; rating?: number | null }>,
  globalScore?: number | null,
  npsScore?: number | null
): Array<{ tag: string; sectionKey?: string; severity: string }> {
  const tags: Array<{ tag: string; sectionKey?: string; severity: string }> =
    [];
  for (const section of sections) {
    if (section.rating === null || section.rating === undefined) continue;
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
  if (npsScore !== null && npsScore !== undefined && npsScore <= 6) {
    tags.push({
      tag: "nps_detractor",
      severity: npsScore <= 3 ? "critical" : "warning",
    });
  }
  if (globalScore !== null && globalScore !== undefined && globalScore <= 4) {
    tags.push({
      tag: "low_global_score",
      severity: globalScore <= 2 ? "critical" : "warning",
    });
  }
  return tags;
}

type EventFeedbackRateLimitBucket = { count: number; resetAt: number };
const eventFeedbackRateLimit = new Map<string, EventFeedbackRateLimitBucket>();

function enforceEventFeedbackRateLimit(ip: string) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = 5;
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

function getWorkerClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

const eventFeedbackAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "super_admin", "admin_ops"];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs",
    });
  }
  return next({ ctx });
});

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
  role: z.enum(FEEDBACK_ROLES),
  participationType: z.enum(PARTICIPATION_TYPES),
  eventDay: z.number().min(1).max(30).optional(),
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  isAnonymous: z.boolean().default(false),
  sections: z.array(sectionResponseSchema),
  textResponses: z.array(textResponseSchema),
  website: z.string().optional(),
});

const eventFeedbackRouter = router({
  submitEventFeedback: publicProcedure
    .input(submitEventFeedbackInput)
    .mutation(async ({ input, ctx }) => {
      if (input.website) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Requête invalide",
        });
      }
      enforceEventFeedbackRateLimit(getWorkerClientIp(ctx.req));

      const db = createSupabaseAdmin(ctx.env);

      const globalSection = input.sections.find(
        s => s.sectionKey === "global_experience"
      );
      const globalScore =
        (globalSection?.metadata?.["global_score"] as number | undefined) ??
        globalSection?.rating ??
        null;
      const npsScore =
        (globalSection?.metadata?.["nps"] as number | undefined) ?? null;

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
        if (sectionsError)
          console.error("[EventFeedback] Insert sections:", sectionsError);
      }

      const validTextResponses = input.textResponses.filter(
        t => t.value.trim().length > 0
      );
      if (validTextResponses.length > 0) {
        const textRows = validTextResponses.map(t => ({
          feedback_id: feedbackId,
          field_key: t.fieldKey,
          value: t.value.trim(),
        }));
        const { error: textError } = await db
          .from("event_feedback_text_responses")
          .insert(textRows);
        if (textError)
          console.error("[EventFeedback] Insert text responses:", textError);
      }

      const autoTags = generateEventFeedbackAutoTags(
        input.sections,
        globalScore,
        npsScore
      );
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
        if (tagsError) console.error("[EventFeedback] Insert tags:", tagsError);
      }

      return { success: true, feedbackId };
    }),

  getEventFeedbackAnalytics: eventFeedbackAdminProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        role: z.enum(FEEDBACK_ROLES).optional(),
        participationType: z.enum(PARTICIPATION_TYPES).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);
      let query = db.from("event_feedback").select("*");
      if (input.fromDate) query = query.gte("created_at", input.fromDate);
      if (input.toDate) query = query.lte("created_at", input.toDate);
      if (input.role) query = query.eq("role", input.role);
      if (input.participationType)
        query = query.eq("participation_type", input.participationType);
      const { data, error } = await query;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return data ?? [];
    }),

  getEventFeedbackList: eventFeedbackAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        role: z.enum(FEEDBACK_ROLES).optional(),
        participationType: z.enum(PARTICIPATION_TYPES).optional(),
        moderation: z.enum(["pending", "approved", "rejected"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);
      const from = (input.page - 1) * input.pageSize;
      const to = from + input.pageSize - 1;
      let query = db
        .from("event_feedback")
        .select("*", { count: "exact" })
        .range(from, to)
        .order("created_at", { ascending: false });
      if (input.role) query = query.eq("role", input.role);
      if (input.participationType)
        query = query.eq("participation_type", input.participationType);
      if (input.moderation) query = query.eq("moderation", input.moderation);
      const { data, error, count } = await query;
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { items: data ?? [], total: count ?? 0 };
    }),

  updateEventFeedbackModeration: eventFeedbackAdminProcedure
    .input(
      z.object({
        id: z.number(),
        moderation: z.enum(["pending", "approved", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = createSupabaseAdmin(ctx.env);
      const { error } = await db
        .from("event_feedback")
        .update({ moderation: input.moderation })
        .eq("id", input.id);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { success: true };
    }),
});

// ============================================
// MAIN APP ROUTER
// ============================================

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  days: daysRouter,
  volunteers: volunteersRouter,
  checkin: checkinRouter,
  goodies: goodiesRouter,
  orders: ordersRouter,
  donations: donationsRouter,
  pastries: pastriesRouter,
  pastryOrders: pastryOrdersRouter,
  contact: contactRouter,
  partnerLeads: partnerLeadsRouter,
  users: usersRouter,
  public: publicRouter,
  gallery: galleryRouter,
  upload: uploadRouter,
  restaurants: restaurantsRouter,
  reservations: reservationsRouter,
  restaurantReservations: restaurantReservationsRouter,
  scanner: scannerRouter,
  qr: qrRouter,
  ramadan: ramadanRouter,
  terroirModule: terroirModuleRouter,
  inventory: inventoryRouter,
  catalogProducts: catalogProductsRouter,
  feedback: feedbackRouter,
  eventFeedback: eventFeedbackRouter,
  election: electionRouter,
  team: teamRouter,
  blog: blogRouter,
});

export type AppRouter = typeof appRouter;
