import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { auditMutation } from "../middleware/auditMiddleware";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    try {
      const result = await opts.next();

      void auditMutation({
        path: opts.path,
        type: opts.type,
        input: opts.input,
        ctx: opts.ctx,
        resultOk: result.ok,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      void auditMutation({
        path: opts.path,
        type: opts.type,
        input: opts.input,
        ctx: opts.ctx,
        resultOk: false,
        errorMessage: message,
      });

      throw error;
    }
  }),
);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
