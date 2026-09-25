import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth } from "./authHelper";

export const status = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const methods = await ctx.db.query("payment_methods").collect();
    return { configured: methods.length > 0, mode: "live" };
  },
});

export const listMethods = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db
      .query("payment_methods")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
  },
});

export const createMethod = mutation({
  args: {
    token: v.optional(v.string()),
    method_type: v.string(),
    label: v.string(),
    last_four: v.optional(v.string()),
  },
  handler: async (ctx, { token, method_type, label, last_four }) => {
    const userId = await requireAuth(ctx, token);
    const existing = await ctx.db
      .query("payment_methods")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    return ctx.db.insert("payment_methods", {
      user_id: userId,
      method_type,
      label,
      last_four,
      is_default: existing.length === 0,
      created_at: Date.now(),
    });
  },
});

export const deleteMethod = mutation({
  args: { token: v.optional(v.string()), id: v.id("payment_methods") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const method = await ctx.db.get(id);
    if (!method || method.user_id !== userId) {
      throw new ConvexError("Forbidden: payment method not found or not yours");
    }
    await ctx.db.delete(id);
    return { success: true };
  },
});

export const setDefault = mutation({
  args: { token: v.optional(v.string()), id: v.id("payment_methods") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const all = await ctx.db
      .query("payment_methods")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    for (const m of all) {
      await ctx.db.patch(m._id, { is_default: m._id === id });
    }
    return { success: true };
  },
});

export const listOrders = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db
      .query("payment_orders")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
  },
});

