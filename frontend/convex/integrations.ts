import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx, args) => {
    let results = await ctx.db.query("integrations").order("desc").collect();
    if (args.search) { const t = args.search.toLowerCase(); results = results.filter((r) => r.name.toLowerCase().includes(t)); }
    return results;
  },
});

export const create = mutation({
  args: { token: v.optional(v.string()), name: v.string(), integration_type: v.string(), config: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, { token, ...data }) => { await requireAuth(ctx, token); return ctx.db.insert("integrations", { ...data, status: data.status ?? "inactive", created_at: Date.now() }); },
});

export const update = mutation({
  args: { token: v.optional(v.string()), id: v.id("integrations"), name: v.optional(v.string()), integration_type: v.optional(v.string()), config: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAuth(ctx, token);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) { if (val !== undefined) patch[k] = val; }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("integrations") },
  handler: async (ctx, { token, id }) => { await requireAuth(ctx, token); await ctx.db.delete(id); },
});
