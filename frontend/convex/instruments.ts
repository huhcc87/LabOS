import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 20;
    const cursor = args.paginationOpts?.cursor ?? null;

    if (args.search && !args.status) {
      const results = await ctx.db
        .query("instruments")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!)
        )
        .take(numItems);
      return { page: results, isDone: true, continueCursor: null };
    }

    const result = await ctx.db
      .query("instruments")
      .paginate({ numItems, cursor });

    let filtered = result.page;

    if (args.status) {
      filtered = filtered.filter((i) => i.status === args.status);
    }

    if (args.search) {
      const term = args.search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          (i.model ?? "").toLowerCase().includes(term) ||
          (i.serial_number ?? "").toLowerCase().includes(term) ||
          (i.location ?? "").toLowerCase().includes(term)
      );
    }

    return { ...result, page: filtered };
  },
});

export const get = query({
  args: { id: v.id("instruments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    model: v.optional(v.string()),
    serial_number: v.optional(v.string()),
    location: v.optional(v.string()),
    status: v.string(),
    last_calibrated: v.optional(v.number()),
    next_calibration: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("instruments", {
      ...args,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("instruments"),
    name: v.optional(v.string()),
    model: v.optional(v.string()),
    serial_number: v.optional(v.string()),
    location: v.optional(v.string()),
    status: v.optional(v.string()),
    last_calibrated: v.optional(v.number()),
    next_calibration: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("instruments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ── Bookings ────────────────────────────────────────────────────────────────

export const listBookings = query({
  args: {
    instrumentId: v.optional(v.id("instruments")),
    userId: v.optional(v.id("users")),
    status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 50;
    const cursor = args.paginationOpts?.cursor ?? null;

    let dbQuery;
    if (args.instrumentId) {
      dbQuery = ctx.db
        .query("bookings")
        .withIndex("by_instrument", (q) =>
          q.eq("instrument_id", args.instrumentId!)
        );
    } else if (args.userId) {
      dbQuery = ctx.db
        .query("bookings")
        .withIndex("by_user", (q) => q.eq("user_id", args.userId!));
    } else {
      dbQuery = ctx.db.query("bookings").withIndex("by_start");
    }

    const result = await dbQuery.paginate({ numItems, cursor });

    if (args.status) {
      result.page = result.page.filter((b) => b.status === args.status);
    }

    return result;
  },
});

export const createBooking = mutation({
  args: {
    instrument_id: v.id("instruments"),
    user_id: v.id("users"),
    start_time: v.number(),
    end_time: v.number(),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookings", {
      instrument_id: args.instrument_id,
      user_id: args.user_id,
      start_time: args.start_time,
      end_time: args.end_time,
      purpose: args.purpose,
      notes: args.notes,
      status: args.status ?? "confirmed",
      created_at: Date.now(),
    });
  },
});

export const updateBooking = mutation({
  args: {
    id: v.id("bookings"),
    start_time: v.optional(v.number()),
    end_time: v.optional(v.number()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const cancelBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "cancelled" });
    return await ctx.db.get(args.id);
  },
});
