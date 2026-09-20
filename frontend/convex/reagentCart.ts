import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── List current user's cart items ────────────────────────────────────────────

export const list = query({
  args: {
    token: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, status }) => {
    const userId = await requireAuth(ctx, token);

    let items = await ctx.db
      .query("reagent_cart")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    if (status) {
      items = items.filter((i) => i.status === status);
    }

    return items;
  },
});

// ── Create a cart item ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    unit_price: v.optional(v.number()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    return await ctx.db.insert("reagent_cart", {
      user_id: userId,
      name: args.name,
      catalog_number: args.catalog_number,
      supplier: args.supplier,
      quantity: args.quantity,
      unit: args.unit,
      unit_price: args.unit_price,
      url: args.url,
      notes: args.notes,
      status: "pending",
      created_at: Date.now(),
    });
  },
});

// ── Update a cart item ────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("reagent_cart"),
    name: v.optional(v.string()),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    unit_price: v.optional(v.number()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    const userId = await requireAuth(ctx, token);

    const item = await ctx.db.get(id);
    if (!item) throw new Error("Cart item not found");
    if (item.user_id !== userId) throw new Error("Not authorized to update this item");

    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.catalog_number !== undefined) patch.catalog_number = fields.catalog_number;
    if (fields.supplier !== undefined) patch.supplier = fields.supplier;
    if (fields.quantity !== undefined) patch.quantity = fields.quantity;
    if (fields.unit !== undefined) patch.unit = fields.unit;
    if (fields.unit_price !== undefined) patch.unit_price = fields.unit_price;
    if (fields.url !== undefined) patch.url = fields.url;
    if (fields.notes !== undefined) patch.notes = fields.notes;
    if (fields.status !== undefined) patch.status = fields.status;

    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Remove a cart item ────────────────────────────────────────────────────────

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("reagent_cart") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const item = await ctx.db.get(id);
    if (!item) throw new Error("Cart item not found");
    if (item.user_id !== userId) throw new Error("Not authorized to remove this item");

    await ctx.db.delete(id);
    return id;
  },
});

// ── Checkout: mark selected items as ordered ──────────────────────────────────

export const checkout = mutation({
  args: {
    token: v.optional(v.string()),
    item_ids: v.array(v.id("reagent_cart")),
  },
  handler: async (ctx, { token, item_ids }) => {
    const userId = await requireAuth(ctx, token);

    const results: string[] = [];

    for (const id of item_ids) {
      const item = await ctx.db.get(id);
      if (!item) continue;
      if (item.user_id !== userId) continue; // Skip items not owned by the user

      await ctx.db.patch(id, { status: "ordered" });
      results.push(id);
    }

    return results;
  },
});
