import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const get = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.query("biosketches").withIndex("by_user", (q) => q.eq("user_id", userId)).first();
  },
});

export const save = mutation({
  args: {
    token: v.optional(v.string()),
    personal_statement: v.optional(v.string()),
    positions: v.optional(v.string()),
    contributions: v.optional(v.string()),
    research_support: v.optional(v.string()),
    publications: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...data }) => {
    const userId = await requireAuth(ctx, token);
    const existing = await ctx.db.query("biosketches").withIndex("by_user", (q) => q.eq("user_id", userId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...data, updated_at: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("biosketches", { ...data, user_id: userId, updated_at: Date.now() });
  },
});
