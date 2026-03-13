import type { Request } from "express";
import { getSupabaseAdminClient } from "../supabase";

type AuditUser = {
  id?: string | number | null;
  email?: string | null;
  role?: string | null;
};

export type AuditLogInput = {
  user?: AuditUser | null;
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  request?: Request;
  route?: string;
  httpMethod?: string;
  responseStatus?: number;
};

function extractIp(request?: Request): string | null {
  if (!request) return null;
  const xForwardedFor = request.headers["x-forwarded-for"];
  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0]?.split(",")[0]?.trim() ?? null;
  }
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip || request.socket?.remoteAddress || null;
}

export function sanitizeAuditPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map(sanitizeAuditPayload);
  }

  const masked = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret")
    ) {
      masked[key] = "***";
      continue;
    }
    masked[key] = sanitizeAuditPayload(masked[key]);
  }

  return masked;
}

export async function logAction(input: AuditLogInput): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client) return;

  const payload = {
    user_id: input.user?.id != null ? String(input.user.id) : null,
    user_email: input.user?.email ?? null,
    user_role: input.user?.role ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    description: input.description ?? null,
    metadata: input.metadata ?? null,
    ip_address: extractIp(input.request),
    user_agent: input.request?.headers["user-agent"] ?? null,
    route: input.route ?? null,
    http_method: input.httpMethod ?? null,
    response_status: input.responseStatus ?? null,
  };

  const { error } = await client.from("audit_logs").insert(payload);
  if (error) {
    console.error("[Audit] Failed to insert audit log", error.message, {
      action: input.action,
      route: input.route,
    });
  }
}
