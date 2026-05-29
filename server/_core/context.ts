import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserFromToken } from "../supabase-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Try legacy OAuth cookie auth
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // 2. If no legacy session, try Supabase Bearer token
  if (!user) {
    try {
      const authHeader = opts.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const supabaseUser = await getUserFromToken(token);
        if (supabaseUser) {
          // Cast AuthUser to the shape expected by protectedProcedure / adminProcedure.
          // Only role and email are actually accessed by middleware — numeric id is
          // never used downstream in auth checks.
          user = supabaseUser as unknown as User;
        }
      }
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
