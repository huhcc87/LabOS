import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── List Settings ─────────────────────────────────────────────────────────────

export const list = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, { category }) => {
    await getAuthUserId(ctx);

    if (category) {
      return await ctx.db
        .query("settings")
        .filter((q) => q.eq(q.field("category"), category))
        .collect();
    }

    return await ctx.db.query("settings").collect();
  },
});

// ── Get by Key ────────────────────────────────────────────────────────────────

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await getAuthUserId(ctx);

    return await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
  },
});

// ── Create ────────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    key: v.string(),
    value: v.optional(v.string()),
    category: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check for duplicate key
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) throw new Error(`Setting with key "${args.key}" already exists`);

    const now = Date.now();
    return await ctx.db.insert("settings", {
      key: args.key,
      value: args.value,
      category: args.category,
      label: args.label,
      description: args.description,
      created_at: now,
      updated_at: now,
    });
  },
});

// ── Update by Key ─────────────────────────────────────────────────────────────

export const updateByKey = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, { key, value }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (!setting) throw new Error(`Setting with key "${key}" not found`);

    await ctx.db.patch(setting._id, {
      value,
      updated_at: Date.now(),
    });

    return setting._id;
  },
});

// ── Update by ID ──────────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    id: v.id("settings"),
    key: v.optional(v.string()),
    value: v.optional(v.string()),
    category: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const setting = await ctx.db.get(id);
    if (!setting) throw new Error("Setting not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (fields.key !== undefined) patch.key = fields.key;
    if (fields.value !== undefined) patch.value = fields.value;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.label !== undefined) patch.label = fields.label;
    if (fields.description !== undefined) patch.description = fields.description;

    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Remove ────────────────────────────────────────────────────────────────────

export const remove = mutation({
  args: { id: v.id("settings") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const setting = await ctx.db.get(id);
    if (!setting) throw new Error("Setting not found");

    await ctx.db.delete(id);
    return id;
  },
});

// ── Bulk Update (upsert) ──────────────────────────────────────────────────────

export const bulkUpdate = mutation({
  args: {
    settings: v.array(v.object({ key: v.string(), value: v.string() })),
  },
  handler: async (ctx, { settings }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const results: string[] = [];

    for (const { key, value } of settings) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { value, updated_at: now });
        results.push(existing._id);
      } else {
        const id = await ctx.db.insert("settings", {
          key,
          value,
          created_at: now,
          updated_at: now,
        });
        results.push(id);
      }
    }

    return results;
  },
});
