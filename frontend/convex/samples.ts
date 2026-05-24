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

    // Use search index when a search term is provided and no status filter
    if (args.search && !args.status) {
      const results = await ctx.db
        .query("samples")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!)
        )
        .take(numItems);
      return { page: results, isDone: true, continueCursor: null };
    }

    let dbQuery;
    if (args.status) {
      dbQuery = ctx.db
        .query("samples")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      dbQuery = ctx.db.query("samples");
    }

    const result = await dbQuery.paginate({ numItems, cursor });

    if (args.search) {
      const term = args.search.toLowerCase();
      result.page = result.page.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.sample_id.toLowerCase().includes(term) ||
          (s.barcode ?? "").toLowerCase().includes(term)
      );
    }

    return result;
  },
});

export const get = query({
  args: { id: v.id("samples") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    sample_id: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
    status: v.string(),
    location: v.optional(v.string()),
    collected_at: v.optional(v.number()),
    collected_by: v.optional(v.id("users")),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("samples", {
      ...args,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("samples"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    location: v.optional(v.string()),
    collected_at: v.optional(v.number()),
    collected_by: v.optional(v.id("users")),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    metadata: v.optional(v.string()),
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
  args: { id: v.id("samples") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const listEvents = query({
  args: {
    sampleId: v.id("samples"),
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

    return await ctx.db
      .query("sample_events")
      .withIndex("by_sample", (q) => q.eq("sample_id", args.sampleId))
      .order("desc")
      .paginate({ numItems, cursor });
  },
});

export const createEvent = mutation({
  args: {
    sample_id: v.id("samples"),
    event_type: v.string(),
    description: v.optional(v.string()),
    performed_by: v.optional(v.id("users")),
    performed_at: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sample_events", {
      sample_id: args.sample_id,
      event_type: args.event_type,
      description: args.description,
      performed_by: args.performed_by,
      performed_at: args.performed_at ?? Date.now(),
      notes: args.notes,
    });
  },
});
