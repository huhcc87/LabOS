import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    token: v.optional(v.string()),
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
        .query("protocols")
        .withSearchIndex("search_title", (q) =>
          q.search("title", args.search!)
        )
        .take(numItems);
      return { page: results, isDone: true, continueCursor: null };
    }

    let dbQuery;
    if (args.status) {
      dbQuery = ctx.db
        .query("protocols")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      dbQuery = ctx.db.query("protocols");
    }

    const result = await dbQuery.paginate({ numItems, cursor });

    if (args.search) {
      const term = args.search.toLowerCase();
      result.page = result.page.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          (p.description ?? "").toLowerCase().includes(term) ||
          (p.category ?? "").toLowerCase().includes(term)
      );
    }

    return result;
  },
});

export const get = query({
  args: { id: v.id("protocols") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.string(),
    status: v.string(),
    content: v.optional(v.string()),
    steps: v.optional(v.string()),
    author_id: v.id("users"),
    tags: v.optional(v.string()),
    estimated_duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("protocols", {
      ...args,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("protocols"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.optional(v.string()),
    status: v.optional(v.string()),
    content: v.optional(v.string()),
    steps: v.optional(v.string()),
    tags: v.optional(v.string()),
    estimated_duration: v.optional(v.number()),
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
  args: { id: v.id("protocols") },
  handler: async (ctx, args) => {
    // Delete all versions first
    const versions = await ctx.db
      .query("protocol_versions")
      .withIndex("by_protocol", (q) => q.eq("protocol_id", args.id))
      .collect();
    await Promise.all(versions.map((v) => ctx.db.delete(v._id)));
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const listVersions = query({
  args: {
    protocolId: v.id("protocols"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("protocol_versions")
      .withIndex("by_protocol", (q) => q.eq("protocol_id", args.protocolId))
      .order("desc")
      .collect();
  },
});

export const createVersion = mutation({
  args: {
    protocol_id: v.id("protocols"),
    version: v.string(),
    content: v.optional(v.string()),
    change_summary: v.optional(v.string()),
    created_by: v.id("users"),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("protocol_versions", {
      protocol_id: args.protocol_id,
      version: args.version,
      content: args.content,
      change_summary: args.change_summary,
      created_by: args.created_by,
      created_at: Date.now(),
    });
    // Bump the protocol's version and updated_at
    await ctx.db.patch(args.protocol_id, {
      version: args.version,
      updated_at: Date.now(),
    });
    return id;
  },
});
