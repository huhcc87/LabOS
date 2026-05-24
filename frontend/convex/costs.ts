import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── List cost records (paginated, filter by status) ───────────────────────

export const list = query({
  args: {
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
    status: v.optional(v.string()),
    submitted_by: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    let results;

    if (args.submitted_by !== undefined) {
      results = await ctx.db
        .query("costs")
        .withIndex("by_submitter", (q) =>
          q.eq("submitted_by", args.submitted_by!)
        )
        .order("desc")
        .collect();

      if (args.status) {
        results = results.filter((r) => r.status === args.status);
      }
    } else if (args.status) {
      results = await ctx.db
        .query("costs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      results = await ctx.db.query("costs").order("desc").collect();
    }

    const numItems = args.paginationOpts?.numItems ?? 50;
    const cursor = args.paginationOpts?.cursor;
    const startIdx = cursor ? parseInt(cursor, 10) : 0;
    const page = results.slice(startIdx, startIdx + numItems);
    const nextCursor =
      startIdx + numItems < results.length
        ? String(startIdx + numItems)
        : null;

    return { page, isDone: nextCursor === null, continueCursor: nextCursor };
  },
});

// ── Get a single cost record ──────────────────────────────────────────────

export const get = query({
  args: { id: v.id("costs") },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await ctx.db.get(args.id);
  },
});

// ── Create a cost record ──────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    category: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    submitted_by: v.id("users"),
    description: v.optional(v.string()),
    receipt_url: v.optional(v.string()),
    grant_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await ctx.db.insert("costs", {
      title: args.title,
      category: args.category,
      amount: args.amount,
      currency: args.currency,
      status: args.status,
      submitted_by: args.submitted_by,
      description: args.description,
      receipt_url: args.receipt_url,
      grant_id: args.grant_id,
      created_at: Date.now(),
    });
  },
});

// ── Update a cost record ──────────────────────────────────────────────────

export const update = mutation({
  args: {
    id: v.id("costs"),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    status: v.optional(v.string()),
    description: v.optional(v.string()),
    receipt_url: v.optional(v.string()),
    grant_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const { id, ...fields } = args;
    const record = await ctx.db.get(id);
    if (!record) throw new Error("Cost record not found");

    const patch: Record<string, unknown> = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.amount !== undefined) patch.amount = fields.amount;
    if (fields.currency !== undefined) patch.currency = fields.currency;
    if (fields.status !== undefined) patch.status = fields.status;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.receipt_url !== undefined) patch.receipt_url = fields.receipt_url;
    if (fields.grant_id !== undefined) patch.grant_id = fields.grant_id;

    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Remove a cost record ──────────────────────────────────────────────────

export const remove = mutation({
  args: { id: v.id("costs") },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Cost record not found");
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ── Approve a cost record ─────────────────────────────────────────────────

export const approve = mutation({
  args: {
    id: v.id("costs"),
    approved_by: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Cost record not found");

    await ctx.db.patch(args.id, {
      status: "approved",
      approved_by: args.approved_by,
      approved_at: Date.now(),
    });
    return args.id;
  },
});

// ── Reject a cost record ──────────────────────────────────────────────────

export const reject = mutation({
  args: {
    id: v.id("costs"),
    approved_by: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Cost record not found");

    const patch: Record<string, unknown> = { status: "rejected" };
    if (args.approved_by !== undefined) patch.approved_by = args.approved_by;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

// ── Summary: totals by category ───────────────────────────────────────────

export const summary = query({
  args: {
    status: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    let all;
    if (args.status) {
      all = await ctx.db
        .query("costs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      all = await ctx.db.query("costs").collect();
    }

    if (args.currency) {
      all = all.filter((r) => r.currency === args.currency);
    }

    // Aggregate totals by category
    const byCategory: Record<string, number> = {};
    let grandTotal = 0;

    for (const record of all) {
      byCategory[record.category] =
        (byCategory[record.category] ?? 0) + record.amount;
      grandTotal += record.amount;
    }

    const categories = Object.entries(byCategory).map(([category, total]) => ({
      category,
      total,
      count: all.filter((r) => r.category === category).length,
    }));

    return {
      grand_total: grandTotal,
      record_count: all.length,
      categories,
    };
  },
});
