import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx, args) => {
    if (args.search && args.search.trim().length > 0) {
      return ctx.db.query("templates").withSearchIndex("search_name", (q) => q.search("name", args.search!)).collect();
    }
    return ctx.db.query("templates").order("desc").collect();
  },
});

export const create = mutation({
  args: { token: v.optional(v.string()), name: v.string(), category: v.string(), content: v.string(), variables: v.optional(v.string()) },
  handler: async (ctx, { token, ...data }) => {
    const userId = await requireAuth(ctx, token);
    const now = Date.now();
    return ctx.db.insert("templates", { ...data, created_by: userId, created_at: now, updated_at: now });
  },
});

export const update = mutation({
  args: { token: v.optional(v.string()), id: v.id("templates"), name: v.optional(v.string()), category: v.optional(v.string()), content: v.optional(v.string()), variables: v.optional(v.string()) },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAuth(ctx, token);
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [k, val] of Object.entries(fields)) { if (val !== undefined) patch[k] = val; }
    await ctx.db.patch(id, patch);
  },
});

export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("templates") },
  handler: async (ctx, { token, id }) => { await requireAuth(ctx, token); await ctx.db.delete(id); },
});
