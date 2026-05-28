import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    category: v.optional(v.string()),
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

    if (args.search && !args.category) {
      const results = await ctx.db
        .query("inventory")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!)
        )
        .take(numItems);
      return { page: results, isDone: true, continueCursor: null };
    }

    let dbQuery;
    if (args.category) {
      dbQuery = ctx.db
        .query("inventory")
        .withIndex("by_category", (q) => q.eq("category", args.category!));
    } else {
      dbQuery = ctx.db.query("inventory");
    }

    const result = await dbQuery.paginate({ numItems, cursor });

    if (args.search) {
      const term = args.search.toLowerCase();
      result.page = result.page.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          (item.catalog_number ?? "").toLowerCase().includes(term) ||
          (item.supplier ?? "").toLowerCase().includes(term)
      );
    }

    return result;
  },
});

export const get = query({
  args: { id: v.id("inventory") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    category: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    location: v.optional(v.string()),
    minimum_quantity: v.optional(v.number()),
    expiry_date: v.optional(v.number()),
    cost_per_unit: v.optional(v.number()),
    notes: v.optional(v.string()),
    barcode: v.optional(v.string()),
    sds_url: v.optional(v.string()),
    hazards: v.optional(v.string()),
    created_by: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("inventory", {
      ...args,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("inventory"),
    name: v.optional(v.string()),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    category: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    location: v.optional(v.string()),
    minimum_quantity: v.optional(v.number()),
    expiry_date: v.optional(v.number()),
    cost_per_unit: v.optional(v.number()),
    notes: v.optional(v.string()),
    barcode: v.optional(v.string()),
    sds_url: v.optional(v.string()),
    hazards: v.optional(v.string()),
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
  args: { id: v.id("inventory") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const lowStock = query({
  args: {},
  handler: async (ctx) => {
    const allItems = await ctx.db.query("inventory").collect();
    return allItems.filter(
      (item) =>
        item.minimum_quantity !== undefined &&
        item.quantity <= item.minimum_quantity
    );
  },
});

export const expiringSoon = query({
  args: {
    withinDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.withinDays ?? 30;
    const now = Date.now();
    const threshold = now + days * 24 * 60 * 60 * 1000;
    const allItems = await ctx.db.query("inventory").collect();
    return allItems.filter(
      (item) =>
        item.expiry_date !== undefined &&
        item.expiry_date > now &&
        item.expiry_date <= threshold
    );
  },
});
