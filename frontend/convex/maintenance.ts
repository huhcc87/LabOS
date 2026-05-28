import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── List maintenance records (paginated, filter by status) ────────────────

export const list = query({
  args: {
    token: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
    status: v.optional(v.string()),
    instrument_id: v.optional(v.id("instruments")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    let results;

    if (args.instrument_id !== undefined) {
      results = await ctx.db
        .query("maintenance")
        .withIndex("by_instrument", (q) =>
          q.eq("instrument_id", args.instrument_id!)
        )
        .order("desc")
        .collect();

      if (args.status) {
        results = results.filter((r) => r.status === args.status);
      }
    } else if (args.status) {
      results = await ctx.db.query("maintenance").order("desc").collect();
      results = results.filter((r) => r.status === args.status);
    } else {
      results = await ctx.db.query("maintenance").order("desc").collect();
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

// ── Get a single maintenance record ──────────────────────────────────────

export const get = query({
  args: { token: v.optional(v.string()), id: v.id("maintenance") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    return await ctx.db.get(id);
  },
});

// ── Create a maintenance record ───────────────────────────────────────────

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    instrument_id: v.optional(v.id("instruments")),
    maintenance_type: v.string(),
    status: v.string(),
    scheduled_date: v.optional(v.number()),
    performed_by: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    cost: v.optional(v.number()),
    next_due: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.insert("maintenance", {
      instrument_id: args.instrument_id,
      maintenance_type: args.maintenance_type,
      status: args.status,
      scheduled_date: args.scheduled_date,
      performed_by: args.performed_by,
      notes: args.notes,
      cost: args.cost,
      next_due: args.next_due,
      created_at: Date.now(),
    });
  },
});

// ── Update a maintenance record ───────────────────────────────────────────

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("maintenance"),
    instrument_id: v.optional(v.id("instruments")),
    maintenance_type: v.optional(v.string()),
    status: v.optional(v.string()),
    scheduled_date: v.optional(v.number()),
    completed_date: v.optional(v.number()),
    performed_by: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    cost: v.optional(v.number()),
    next_due: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _token, ...fields } = args;
    const record = await ctx.db.get(id);
    if (!record) throw new Error("Maintenance record not found");

    const patch: Record<string, unknown> = {};
    if (fields.instrument_id !== undefined) patch.instrument_id = fields.instrument_id;
    if (fields.maintenance_type !== undefined) patch.maintenance_type = fields.maintenance_type;
    if (fields.status !== undefined) patch.status = fields.status;
    if (fields.scheduled_date !== undefined) patch.scheduled_date = fields.scheduled_date;
    if (fields.completed_date !== undefined) patch.completed_date = fields.completed_date;
    if (fields.performed_by !== undefined) patch.performed_by = fields.performed_by;
    if (fields.notes !== undefined) patch.notes = fields.notes;
    if (fields.cost !== undefined) patch.cost = fields.cost;
    if (fields.next_due !== undefined) patch.next_due = fields.next_due;

    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Complete a maintenance record ─────────────────────────────────────────

export const complete = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("maintenance"),
    performed_by: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    cost: v.optional(v.number()),
    next_due: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Maintenance record not found");

    const patch: Record<string, unknown> = {
      status: "completed",
      completed_date: Date.now(),
    };
    if (args.performed_by !== undefined) patch.performed_by = args.performed_by;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.cost !== undefined) patch.cost = args.cost;
    if (args.next_due !== undefined) patch.next_due = args.next_due;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

// ── Remove a maintenance record ───────────────────────────────────────────

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("maintenance") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    const record = await ctx.db.get(id);
    if (!record) throw new Error("Maintenance record not found");
    await ctx.db.delete(id);
    return id;
  },
});
