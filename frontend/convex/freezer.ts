import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── List all freezers ─────────────────────────────────────────────────────

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.db.query("freezers").collect();
  },
});

// ── Create a freezer ──────────────────────────────────────────────────────

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    location: v.optional(v.string()),
    temperature: v.optional(v.number()),
    capacity_racks: v.optional(v.number()),
    capacity_boxes: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.insert("freezers", {
      name: args.name,
      location: args.location,
      temperature: args.temperature,
      capacity_racks: args.capacity_racks,
      capacity_boxes: args.capacity_boxes,
      notes: args.notes,
      created_at: Date.now(),
    });
  },
});

// ── Remove a freezer ──────────────────────────────────────────────────────

export const remove = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("freezers"),
  },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    const freezer = await ctx.db.get(id);
    if (!freezer) throw new Error("Freezer not found");

    // Remove all associated slots first
    const slots = await ctx.db
      .query("freezer_slots")
      .withIndex("by_freezer", (q) => q.eq("freezer_id", id))
      .collect();

    await Promise.all(slots.map((s) => ctx.db.delete(s._id)));
    await ctx.db.delete(id);
    return id;
  },
});

// ── Get slots for a freezer at a rack/box position ───────────────────────

export const getSlots = query({
  args: {
    token: v.optional(v.string()),
    freezer_id: v.id("freezers"),
    rack: v.optional(v.number()),
    box: v.optional(v.number()),
  },
  handler: async (ctx, { token, freezer_id, rack, box }) => {
    await requireAuth(ctx, token);

    if (rack !== undefined && box !== undefined) {
      return await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer_pos", (q) =>
          q
            .eq("freezer_id", freezer_id)
            .eq("rack", rack!)
            .eq("box", box!)
        )
        .collect();
    }

    if (rack !== undefined) {
      return await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer_pos", (q) =>
          q.eq("freezer_id", freezer_id).eq("rack", rack!)
        )
        .collect();
    }

    return await ctx.db
      .query("freezer_slots")
      .withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id))
      .collect();
  },
});

// ── Insert or update a freezer slot ──────────────────────────────────────

export const upsertSlot = mutation({
  args: {
    token: v.optional(v.string()),
    freezer_id: v.id("freezers"),
    rack: v.number(),
    box: v.number(),
    row: v.number(),
    col: v.number(),
    sample_id: v.optional(v.string()),
    label: v.optional(v.string()),
    barcode: v.optional(v.string()),
    expiry_date: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db
      .query("freezer_slots")
      .withIndex("by_freezer_pos", (q) =>
        q
          .eq("freezer_id", args.freezer_id)
          .eq("rack", args.rack)
          .eq("box", args.box)
          .eq("row", args.row)
          .eq("col", args.col)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sample_id: args.sample_id,
        label: args.label,
        barcode: args.barcode,
        expiry_date: args.expiry_date,
        notes: args.notes,
        updated_at: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("freezer_slots", {
      freezer_id: args.freezer_id,
      rack: args.rack,
      box: args.box,
      row: args.row,
      col: args.col,
      sample_id: args.sample_id,
      label: args.label,
      barcode: args.barcode,
      expiry_date: args.expiry_date,
      notes: args.notes,
      updated_at: now,
    });
  },
});

// ── Get slots expiring within N days ─────────────────────────────────────

export const getExpiring = query({
  args: {
    token: v.optional(v.string()),
    days: v.number(),
    freezer_id: v.optional(v.id("freezers")),
  },
  handler: async (ctx, { token, days, freezer_id }) => {
    await requireAuth(ctx, token);

    const now = Date.now();
    const cutoff = now + days * 24 * 60 * 60 * 1000;

    let slots;
    if (freezer_id !== undefined) {
      slots = await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id!))
        .collect();
    } else {
      slots = await ctx.db.query("freezer_slots").collect();
    }

    return slots.filter(
      (s) =>
        s.expiry_date !== undefined &&
        s.expiry_date >= now &&
        s.expiry_date <= cutoff
    );
  },
});

// ── Search slots by label or barcode ─────────────────────────────────────

export const search = query({
  args: {
    token: v.optional(v.string()),
    query: v.string(),
    freezer_id: v.optional(v.id("freezers")),
  },
  handler: async (ctx, { token, query: queryStr, freezer_id }) => {
    await requireAuth(ctx, token);

    const term = queryStr.toLowerCase().trim();
    if (!term) return [];

    let slots;
    if (freezer_id !== undefined) {
      slots = await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id!))
        .collect();
    } else {
      slots = await ctx.db.query("freezer_slots").collect();
    }

    return slots.filter(
      (s) =>
        (s.label !== undefined && s.label.toLowerCase().includes(term)) ||
        (s.barcode !== undefined && s.barcode.toLowerCase().includes(term)) ||
        (s.sample_id !== undefined && s.sample_id.toLowerCase().includes(term))
    );
  },
});
