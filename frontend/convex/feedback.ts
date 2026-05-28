import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx) => {
    return await ctx.db.query("feedback").order("desc").collect();
  },
});

export const create = mutation({
  args: { token: v.optional(v.string()), category: v.optional(v.string()), message: v.string(), rating: v.optional(v.number()) },
  handler: async (ctx, { token, ...data }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.insert("feedback", { ...data, user_id: userId, created_at: Date.now() });
  },
});
