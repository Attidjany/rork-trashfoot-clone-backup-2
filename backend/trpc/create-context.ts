import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { supabaseAdmin } from "../lib/supabase-server";

// Context creation function
export const createContext = async (opts: { req?: any; res?: any }) => {
  const authHeader = opts.req?.headers?.authorization;
  let user = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user) {
        user = data.user;
      }
    } catch (error) {
      console.error('Error getting user from token:', error);
    }
  }

  return {
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    console.error('tRPC Error:', {
      code: error.code,
      message: error.message,
      cause: error.cause,
    });
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});