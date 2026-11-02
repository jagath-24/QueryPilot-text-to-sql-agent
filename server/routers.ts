import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { executeSql, generateSql, getHistory, getSchemaSnapshot, toggleFavorite } from "./textToSql";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  schema: publicProcedure.query(() => getSchemaSnapshot()),
  query: router({
    generate: publicProcedure.input(z.object({ question: z.string().min(3).max(1000) })).mutation(({ input }) => generateSql(input.question)),
    execute: publicProcedure.input(z.object({ sql: z.string().min(1).max(10000) })).mutation(({ input, ctx }) => executeSql(input.sql, ctx.user?.openId ?? "demo")),
    history: publicProcedure.query(({ ctx }) => getHistory(ctx.user?.openId ?? "demo")),
    favorite: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input, ctx }) => toggleFavorite(ctx.user?.openId ?? "demo", input.id)),
  }),
  protectedPing: protectedProcedure.query(() => ({ ok: true })),
});

export type AppRouter = typeof appRouter;
