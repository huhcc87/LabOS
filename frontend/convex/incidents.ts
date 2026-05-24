import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    severity: v.optional(v.string()),
    status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("incidents").order("desc");

    if (args.severity) {
      q = ctx.db
        .query("incidents")
        .withIndex("by_severity", (q) => q.eq("severity", args.severity!))
        .order("desc");
    }

    if (args.status) {
      q = ctx.db
        .query("incidents")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc");
    }

    const numItems = args.paginationOpts?.numItems ?? 20;
    const results = await q.take(numItems + 1);
    const hasMore = results.length > numItems;
    const page = hasMore ? results.slice(0, numItems) : results;

    return { page, hasMore };
  },
});

export const get = query({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    severity: v.string(),
    assigned_to: v.optional(v.id("users")),
    occurred_at: v.optional(v.number()),
    root_cause: v.optional(v.string()),
    corrective_action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("incidents", {
      title: args.title,
      description: args.description,
      severity: args.severity,
      status: "open",
      reported_by: userId,
      assigned_to: args.assigned_to,
      occurred_at: args.occurred_at,
      root_cause: args.root_cause,
      corrective_action: args.corrective_action,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("incidents"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    severity: v.optional(v.string()),
    status: v.optional(v.string()),
    assigned_to: v.optional(v.id("users")),
    occurred_at: v.optional(v.number()),
    root_cause: v.optional(v.string()),
    corrective_action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Incident not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const resolve = mutation({
  args: {
    id: v.id("incidents"),
    root_cause: v.optional(v.string()),
    corrective_action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Incident not found");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "resolved",
      resolved_at: now,
      updated_at: now,
      ...(args.root_cause !== undefined && { root_cause: args.root_cause }),
      ...(args.corrective_action !== undefined && {
        corrective_action: args.corrective_action,
      }),
    });
    return args.id;
  },
});
