import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── Suppliers ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    approval_status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })
    ),
  },
  handler: async (ctx, { search, approval_status, paginationOpts }) => {
    const numItems = paginationOpts?.numItems ?? 50;

    let docs;

    if (search && search.trim().length > 0) {
      docs = await ctx.db
        .query("suppliers")
        .withSearchIndex("search_name", (q) => q.search("name", search))
        .collect();
      if (approval_status) {
        docs = docs.filter((d) => d.approval_status === approval_status);
      }
    } else {
      docs = await ctx.db.query("suppliers").order("desc").collect();
      if (approval_status) {
        docs = docs.filter((d) => d.approval_status === approval_status);
      }
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

export const get = query({
  args: { id: v.id("suppliers") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    category: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    contact_phone: v.optional(v.string()),
    website: v.optional(v.string()),
    approval_status: v.optional(v.string()),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const now = Date.now();
    return await ctx.db.insert("suppliers", {
      name: args.name,
      category: args.category,
      contact_email: args.contact_email,
      contact_phone: args.contact_phone,
      website: args.website,
      approval_status: args.approval_status ?? "pending",
      rating: args.rating,
      notes: args.notes,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    contact_phone: v.optional(v.string()),
    website: v.optional(v.string()),
    approval_status: v.optional(v.string()),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    const userId = await requireAuth(ctx, token);

    const supplier = await ctx.db.get(id);
    if (!supplier) throw new Error("Supplier not found");

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("suppliers") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const supplier = await ctx.db.get(id);
    if (!supplier) throw new Error("Supplier not found");

    await ctx.db.delete(id);
  },
});

// ── Purchase Orders ───────────────────────────────────────────────────────────

export const listOrders = query({
  args: {
    status: v.optional(v.string()),
    supplier_id: v.optional(v.id("suppliers")),
    paginationOpts: v.optional(
      v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })
    ),
  },
  handler: async (ctx, { status, supplier_id, paginationOpts }) => {
    const numItems = paginationOpts?.numItems ?? 50;

    let docs;

    if (status) {
      docs = await ctx.db
        .query("purchase_orders")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .collect();
    } else {
      docs = await ctx.db.query("purchase_orders").order("desc").collect();
    }

    if (supplier_id) {
      docs = docs.filter((d) => d.supplier_id === supplier_id);
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

export const createOrder = mutation({
  args: {
    token: v.optional(v.string()),
    supplier_id: v.optional(v.id("suppliers")),
    total_amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    items: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const now = Date.now();
    return await ctx.db.insert("purchase_orders", {
      supplier_id: args.supplier_id,
      status: "draft",
      total_amount: args.total_amount,
      currency: args.currency ?? "USD",
      ordered_by: userId,
      notes: args.notes,
      items: args.items,
      created_at: now,
      updated_at: now,
    });
  },
});

export const updateOrder = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("purchase_orders"),
    supplier_id: v.optional(v.id("suppliers")),
    total_amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    items: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    const userId = await requireAuth(ctx, token);

    const order = await ctx.db.get(id);
    if (!order) throw new Error("Purchase order not found");

    // Prevent editing orders that have already been received
    if (order.status === "received") {
      throw new Error(
        "Cannot modify a received purchase order. Create a new order if changes are needed."
      );
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
  },
});

export const approveOrder = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("purchase_orders"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, notes }) => {
    const userId = await requireAuth(ctx, token);

    const order = await ctx.db.get(id);
    if (!order) throw new Error("Purchase order not found");

    if (order.status === "approved") {
      throw new Error("Order is already approved.");
    }
    if (order.status === "received") {
      throw new Error("Cannot approve an order that has already been received.");
    }
    if (order.status === "cancelled") {
      throw new Error("Cannot approve a cancelled order.");
    }

    const patch: Record<string, unknown> = {
      status: "approved",
      approved_by: userId,
      updated_at: Date.now(),
    };
    if (notes !== undefined) patch.notes = notes;

    await ctx.db.patch(id, patch);
  },
});

export const receiveOrder = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("purchase_orders"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, notes }) => {
    const userId = await requireAuth(ctx, token);

    const order = await ctx.db.get(id);
    if (!order) throw new Error("Purchase order not found");

    if (order.status === "received") {
      throw new Error("Order has already been marked as received.");
    }
    if (order.status === "cancelled") {
      throw new Error("Cannot receive a cancelled order.");
    }
    if (order.status === "draft") {
      throw new Error(
        "Cannot receive a draft order. The order must be approved before it can be received."
      );
    }

    const patch: Record<string, unknown> = {
      status: "received",
      updated_at: Date.now(),
    };
    if (notes !== undefined) patch.notes = notes;

    await ctx.db.patch(id, patch);
  },
});
