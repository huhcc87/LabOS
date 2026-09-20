import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), status: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx, args) => {
    let results = args.status
      ? await ctx.db.query("training").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").collect()
      : await ctx.db.query("training").order("desc").collect();
    if (args.search) { const t = args.search.toLowerCase(); results = results.filter((r) => r.training_name.toLowerCase().includes(t)); }
    return results;
  },
});

export const get = query({ args: { id: v.id("training") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const create = mutation({
  args: { token: v.optional(v.string()), user_id: v.id("users"), training_name: v.string(), category: v.optional(v.string()), status: v.optional(v.string()), completed_at: v.optional(v.number()), expires_at: v.optional(v.number()), score: v.optional(v.number()), notes: v.optional(v.string()) },
  handler: async (ctx, { token, ...data }) => { await requireAuth(ctx, token); return ctx.db.insert("training", { ...data, status: data.status ?? "pending", created_at: Date.now() }); },
});

export const update = mutation({
  args: { token: v.optional(v.string()), id: v.id("training"), training_name: v.optional(v.string()), category: v.optional(v.string()), status: v.optional(v.string()), completed_at: v.optional(v.number()), expires_at: v.optional(v.number()), score: v.optional(v.number()), notes: v.optional(v.string()) },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAuth(ctx, token);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) { if (val !== undefined) patch[k] = val; }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("training") },
  handler: async (ctx, { token, id }) => { await requireAuth(ctx, token); await ctx.db.delete(id); },
});
