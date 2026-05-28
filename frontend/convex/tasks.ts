import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: {
    token: v.optional(v.string()),
    status: v.optional(v.string()),
    assigned_to: v.optional(v.id("users")),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 25;

    let results;
    if (args.assigned_to) {
      results = await ctx.db
        .query("tasks")
        .withIndex("by_assigned", (q) => q.eq("assigned_to", args.assigned_to!))
        .order("desc")
        .take(numItems + 1);
    } else if (args.status) {
      results = await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(numItems + 1);
    } else {
      results = await ctx.db
        .query("tasks")
        .order("desc")
        .take(numItems + 1);
    }

    // Apply secondary filter when both are provided
    if (args.assigned_to && args.status) {
      results = results.filter((t) => t.status === args.status);
    }

    const hasMore = results.length > numItems;
    const page = hasMore ? results.slice(0, numItems) : results;

    return { page, hasMore };
  },
});

export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assigned_to: v.optional(v.id("users")),
    due_date: v.optional(v.number()),
    tags: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const now = Date.now();
    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status ?? "pending",
      priority: args.priority,
      assigned_to: args.assigned_to,
      created_by: userId,
      due_date: args.due_date,
      tags: args.tags,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assigned_to: v.optional(v.id("users")),
    due_date: v.optional(v.number()),
    tags: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const { id, token: _token, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Task not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const complete = mutation({
  args: { token: v.optional(v.string()), id: v.id("tasks") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Task not found");

    const now = Date.now();
    await ctx.db.patch(id, {
      status: "completed",
      completed_at: now,
      updated_at: now,
    });
    return id;
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("tasks") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Task not found");

    await ctx.db.delete(id);
    return id;
  },
});

export const myTasks = query({
  args: {
    token: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, status }) => {
    const userId = await requireAuth(ctx, token);

    let results = await ctx.db
      .query("tasks")
      .withIndex("by_assigned", (q) => q.eq("assigned_to", userId))
      .order("desc")
      .collect();

    if (status) {
      results = results.filter((t) => t.status === status);
    }

    return results;
  },
});
