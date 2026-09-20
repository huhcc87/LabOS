import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx, { token }) => {
    if (!token) return [];
    const session = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (!session) return [];
    return ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("user_id", session.user_id)).order("desc").collect();
  },
});

export const markRead = mutation({
  args: { token: v.optional(v.string()), id: v.id("notifications") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.patch(id, { is_read: true });
  },
});
