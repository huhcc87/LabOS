import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx) => {
    const results = await ctx.db.query("activity").withIndex("by_created").order("desc").take(200);
    return { page: results };
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return ctx.db.query("activity").withIndex("by_created").order("desc").take(limit ?? 20);
  },
});

export const myActivity = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.query("activity").withIndex("by_user", (q) => q.eq("user_id", userId)).order("desc").take(100);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("activity").collect();
    const byAction: Record<string, number> = {};
    for (const a of all) { byAction[a.action] = (byAction[a.action] ?? 0) + 1; }
    return { total: all.length, by_action: byAction };
  },
});
