import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── List ──────────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    author_id: v.optional(v.id("users")),
    paginationOpts: v.optional(
      v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })
    ),
  },
  handler: async (ctx, { search, author_id, paginationOpts }) => {
    const numItems = paginationOpts?.numItems ?? 50;

    let docs;

    if (search && search.trim().length > 0) {
      docs = await ctx.db
        .query("lab_notebook")
        .withSearchIndex("search_title", (q) =>
          author_id
            ? q.search("title", search).eq("author_id", author_id)
            : q.search("title", search)
        )
        .collect();
    } else if (author_id) {
      docs = await ctx.db
        .query("lab_notebook")
        .withIndex("by_author", (q) => q.eq("author_id", author_id))
        .order("desc")
        .collect();
    } else {
      docs = await ctx.db.query("lab_notebook").order("desc").collect();
    }

    // Manual cursor pagination
    const cursor = paginationOpts?.cursor ?? null;
    let startIndex = 0;
    if (cursor) {
      const idx = docs.findIndex((d) => d._id === cursor);
      if (idx !== -1) startIndex = idx + 1;
    }

    const page = docs.slice(startIndex, startIndex + numItems);
    const nextCursor =
      startIndex + numItems < docs.length
        ? page[page.length - 1]?._id ?? null
        : null;

    return { page, nextCursor, isDone: nextCursor === null };
  },
});

// ── Get ───────────────────────────────────────────────────────────────────────

export const get = query({
  args: { id: v.id("lab_notebook") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ── Create ────────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    content: v.optional(v.string()),
    tags: v.optional(v.string()),
  },
  handler: async (ctx, { token, title, content, tags }) => {
    const userId = await requireAuth(ctx, token);

    const now = Date.now();
    return await ctx.db.insert("lab_notebook", {
      title: title,
      content: content,
      tags: tags,
      author_id: userId,
      is_locked: false,
      created_at: now,
      updated_at: now,
    });
  },
});

// ── Update ────────────────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("lab_notebook"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    const userId = await requireAuth(ctx, token);

    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Notebook entry not found");
    if (entry.is_locked) {
      throw new Error(
        "This notebook entry is locked and cannot be modified. " +
          "Locked entries are read-only to preserve scientific integrity."
      );
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
  },
});

// ── Remove ────────────────────────────────────────────────────────────────────

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("lab_notebook") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Notebook entry not found");
    if (entry.is_locked) {
      throw new Error(
        "Cannot delete a locked notebook entry. " +
          "Locked entries are archived for scientific record-keeping."
      );
    }

    await ctx.db.delete(id);
  },
});

// ── Sign ──────────────────────────────────────────────────────────────────────

/**
 * Sign a notebook entry. Sets signed_at = now and locks the entry so it
 * cannot be subsequently modified. Only the author (or an admin) should call this.
 */
export const sign = mutation({
  args: { token: v.optional(v.string()), id: v.id("lab_notebook") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Notebook entry not found");

    if (entry.signed_at) {
      throw new Error("This entry has already been signed.");
    }

    await ctx.db.patch(id, {
      signed_at: Date.now(),
      is_locked: true,
      updated_at: Date.now(),
    });
  },
});

// ── Witness ───────────────────────────────────────────────────────────────────

/**
 * Witness a signed notebook entry. The witness must be a different user from
 * the author. Sets witnessed_by and witnessed_at.
 */
export const witness = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("lab_notebook"),
    witnessed_by: v.id("users"),
  },
  handler: async (ctx, { token, id, witnessed_by }) => {
    const userId = await requireAuth(ctx, token);

    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Notebook entry not found");

    if (!entry.signed_at) {
      throw new Error(
        "Cannot witness an unsigned entry. The entry must be signed before witnessing."
      );
    }

    if (witnessed_by === entry.author_id) {
      throw new Error(
        "The witness must be a different person from the author of the notebook entry."
      );
    }

    await ctx.db.patch(id, {
      witnessed_by,
      witnessed_at: Date.now(),
      updated_at: Date.now(),
    });
  },
});
