import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx, args) => {
    let results = await ctx.db.query("workspaces").order("desc").collect();
    if (args.search) { const t = args.search.toLowerCase(); results = results.filter((r) => r.name.toLowerCase().includes(t)); }
    return results;
  },
});

export const create = mutation({
  args: { token: v.optional(v.string()), name: v.string(), description: v.optional(v.string()), capacity: v.optional(v.number()), location: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, { token, ...data }) => { await requireAuth(ctx, token); return ctx.db.insert("workspaces", { ...data, status: data.status ?? "active", created_at: Date.now() }); },
});

export const update = mutation({
  args: { token: v.optional(v.string()), id: v.id("workspaces"), name: v.optional(v.string()), description: v.optional(v.string()), capacity: v.optional(v.number()), location: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAuth(ctx, token);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) { if (val !== undefined) patch[k] = val; }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("workspaces") },
  handler: async (ctx, { token, id }) => { await requireAuth(ctx, token); await ctx.db.delete(id); },
});
