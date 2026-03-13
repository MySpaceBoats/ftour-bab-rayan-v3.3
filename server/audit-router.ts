import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getSupabaseAdminClient } from "./supabase";

const adminRoles = new Set(["admin", "super_admin"]);

function ensureAuditAccess(user: { role?: string | null } | null) {
  if (!user || !adminRoles.has(user.role ?? "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès admin uniquement" });
  }
}

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  userId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  module: z.string().trim().optional(),
  text: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

function applyFilters(query: any, input: z.infer<typeof listInput>) {
  let q = query;

  if (input.userId) q = q.eq("user_id", input.userId);
  if (input.action) q = q.eq("action", input.action);
  if (input.module) q = q.eq("entity_type", input.module);
  if (input.dateFrom) q = q.gte("created_at", input.dateFrom);
  if (input.dateTo) q = q.lte("created_at", input.dateTo);
  if (input.text) {
    q = q.or(
      `description.ilike.%${input.text}%,user_email.ilike.%${input.text}%,action.ilike.%${input.text}%,entity_id.ilike.%${input.text}%`,
    );
  }

  return q;
}

function toCsvValue(value: unknown): string {
  const raw = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

export const auditRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ input, ctx }) => {
    ensureAuditAccess(ctx.user);

    const client = getSupabaseAdminClient();
    if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase non configuré" });

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    const base = client
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    const { data, error, count } = await applyFilters(base, input).range(from, to);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return {
      items: data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / input.pageSize)),
    };
  }),

  detail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      ensureAuditAccess(ctx.user);
      const client = getSupabaseAdminClient();
      if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase non configuré" });

      const { data, error } = await client.from("audit_logs").select("*").eq("id", input.id).single();
      if (error) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Log introuvable" });
      }

      return data;
    }),

  exportCsv: protectedProcedure.input(listInput).query(async ({ input, ctx }) => {
    ensureAuditAccess(ctx.user);

    const client = getSupabaseAdminClient();
    if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase non configuré" });

    const { data, error } = await applyFilters(
      client
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000),
      input,
    );

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    const header = [
      "created_at",
      "user_id",
      "user_email",
      "user_role",
      "action",
      "entity_type",
      "entity_id",
      "description",
      "ip_address",
      "user_agent",
      "route",
      "http_method",
      "response_status",
      "metadata",
    ];

    const lines = [header.join(",")];

    for (const row of data ?? []) {
      lines.push(
        [
          row.created_at,
          row.user_id,
          row.user_email,
          row.user_role,
          row.action,
          row.entity_type,
          row.entity_id,
          row.description,
          row.ip_address,
          row.user_agent,
          row.route,
          row.http_method,
          row.response_status,
          row.metadata,
        ]
          .map(toCsvValue)
          .join(","),
      );
    }

    return lines.join("\n");
  }),

  cleanupOld: protectedProcedure.mutation(async ({ ctx }) => {
    ensureAuditAccess(ctx.user);

    const client = getSupabaseAdminClient();
    if (!client) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase non configuré" });

    const { data, error } = await client.rpc("cleanup_old_audit_logs");
    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return { deleted: Number(data ?? 0) };
  }),
});
