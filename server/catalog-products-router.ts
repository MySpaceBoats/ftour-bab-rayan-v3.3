import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getSupabaseAdminClient } from "./supabase";

const productTypeEnum = z.enum(["goodies", "terroir", "patisserie"]);

const adminBoutiqueProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = [
    "admin",
    "super_admin",
    "admin_boutique",
    "admin_patisserie",
    "admin_terroir",
    "admin_ops",
    "admin_operations",
  ];

  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès boutique requis" });
  }

  return next({ ctx });
});

const productSelect =
  "id,name,description,price,stock,image,images,category,tags,status,product_type,is_best_seller,is_ramadan_edition,created_at,updated_at";

export const catalogProductsRouter = router({
  listPublic: publicProcedure
    .input(z.object({ productType: productTypeEnum }))
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase not configured" });
      }

      const { data, error } = await supabase
        .from("products")
        .select(productSelect)
        .eq("product_type", input.productType)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  adminList: adminBoutiqueProcedure
    .input(z.object({ productType: productTypeEnum }))
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase not configured" });
      }

      const { data, error } = await supabase
        .from("products")
        .select(productSelect)
        .eq("product_type", input.productType)
        .order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  adminStats: adminBoutiqueProcedure
    .input(z.object({ productType: productTypeEnum }))
    .query(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase not configured" });
      }

      const { data, error } = await supabase
        .from("products")
        .select("status,is_best_seller,is_ramadan_edition")
        .eq("product_type", input.productType);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const rows = data ?? [];
      return {
        total: rows.length,
        active: rows.filter((row: any) => row.status === "active").length,
        bestSellers: rows.filter((row: any) => row.is_best_seller === true).length,
        ramadanEdition: rows.filter((row: any) => row.is_ramadan_edition === true).length,
      };
    }),

  create: adminBoutiqueProcedure
    .input(
      z.object({
        productType: productTypeEnum,
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().nonnegative(),
        stock: z.number().int().nonnegative(),
        image: z.string().optional(),
        images: z.array(z.string()).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).default([]),
        status: z.enum(["active", "inactive"]).default("active"),
        isBestSeller: z.boolean().default(false),
        isRamadanEdition: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase not configured" });
      }

      const imagesArray = input.images ?? (input.image ? [input.image] : []);
      const primaryImage = imagesArray[0] ?? input.image ?? null;

      const { data, error } = await supabase
        .from("products")
        .insert({
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          stock: input.stock,
          image: primaryImage,
          images: imagesArray,
          category: input.category ?? null,
          tags: input.tags,
          status: input.status,
          product_type: input.productType,
          is_best_seller: input.isBestSeller,
          is_ramadan_edition: input.isRamadanEdition,
        })
        .select(productSelect)
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  update: adminBoutiqueProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().nonnegative().optional(),
        stock: z.number().int().nonnegative().optional(),
        image: z.string().optional(),
        images: z.array(z.string()).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["active", "inactive"]).optional(),
        isBestSeller: z.boolean().optional(),
        isRamadanEdition: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase not configured" });
      }

      const payload: Record<string, unknown> = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.description !== undefined) payload.description = input.description;
      if (input.price !== undefined) payload.price = input.price;
      if (input.stock !== undefined) payload.stock = input.stock;
      if (input.images !== undefined) {
        payload.images = input.images;
        payload.image = input.images[0] ?? null;
      } else if (input.image !== undefined) {
        payload.image = input.image;
      }
      if (input.category !== undefined) payload.category = input.category;
      if (input.tags !== undefined) payload.tags = input.tags;
      if (input.status !== undefined) payload.status = input.status;
      if (input.isBestSeller !== undefined) payload.is_best_seller = input.isBestSeller;
      if (input.isRamadanEdition !== undefined) payload.is_ramadan_edition = input.isRamadanEdition;

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", input.id)
        .select(productSelect)
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  remove: adminBoutiqueProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase not configured" });
      }

      const { error } = await supabase.from("products").delete().eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});
