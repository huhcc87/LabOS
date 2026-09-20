import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── List SOPs (paginated, with search and status filter) ──────────────────

export const list = query({
  args: {
    token: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    // Full-text search path
    if (args.search && args.search.trim().length > 0) {
      const results = await ctx.db
        .query("sops")
        .withSearchIndex("search_title", (q) => {
          let sq = q.search("title", args.search!.trim());
          if (args.status) sq = sq.eq("status", args.status);
          return sq;
        })
        .collect();

      const numItems = args.paginationOpts?.numItems ?? 50;
      const cursor = args.paginationOpts?.cursor;
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      const page = results.slice(startIdx, startIdx + numItems);
      const nextCursor =
        startIdx + numItems < results.length
          ? String(startIdx + numItems)
          : null;

      return { page, isDone: nextCursor === null, continueCursor: nextCursor };
    }

    // Filter by status path
    if (args.status) {
      const results = await ctx.db
        .query("sops")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();

      const numItems = args.paginationOpts?.numItems ?? 50;
      const cursor = args.paginationOpts?.cursor;
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      const page = results.slice(startIdx, startIdx + numItems);
      const nextCursor =
        startIdx + numItems < results.length
          ? String(startIdx + numItems)
          : null;

      return { page, isDone: nextCursor === null, continueCursor: nextCursor };
    }

    // Default: all SOPs ordered by creation time desc
    const results = await ctx.db.query("sops").order("desc").collect();
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

// ── Get a single SOP ──────────────────────────────────────────────────────

export const get = query({
  args: { token: v.optional(v.string()), id: v.id("sops") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    return await ctx.db.get(id);
  },
});

// ── Create a SOP ──────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.string(),
    status: v.string(),
    author_id: v.id("users"),
    review_date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const now = Date.now();
    return await ctx.db.insert("sops", {
      title: args.title,
      content: args.content,
      category: args.category,
      version: args.version,
      status: args.status,
      author_id: args.author_id,
      review_date: args.review_date,
      created_at: now,
      updated_at: now,
    });
  },
});

// ── Update a SOP ──────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("sops"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.optional(v.string()),
    status: v.optional(v.string()),
    review_date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _token, ...fields } = args;
    const sop = await ctx.db.get(id);
    if (!sop) throw new Error("SOP not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.content !== undefined) patch.content = fields.content;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.version !== undefined) patch.version = fields.version;
    if (fields.status !== undefined) patch.status = fields.status;
    if (fields.review_date !== undefined) patch.review_date = fields.review_date;

    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Remove a SOP ──────────────────────────────────────────────────────────

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("sops") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    const sop = await ctx.db.get(id);
    if (!sop) throw new Error("SOP not found");
    await ctx.db.delete(id);
    return id;
  },
});

// ── Approve a SOP ─────────────────────────────────────────────────────────

export const approve = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("sops"),
    approved_by: v.id("users"),
  },
  handler: async (ctx, { token, id, approved_by }) => {
    await requireAuth(ctx, token);
    const sop = await ctx.db.get(id);
    if (!sop) throw new Error("SOP not found");

    await ctx.db.patch(id, {
      status: "approved",
      approved_by: approved_by,
      approved_at: Date.now(),
      updated_at: Date.now(),
    });
    return id;
  },
});
