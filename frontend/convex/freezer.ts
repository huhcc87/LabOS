import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── List all freezers ─────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    return await ctx.db.query("freezers").collect();
  },
});

// ── Create a freezer ──────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    location: v.optional(v.string()),
    temperature: v.optional(v.number()),
    capacity_racks: v.optional(v.number()),
    capacity_boxes: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
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
    id: v.id("freezers"),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const freezer = await ctx.db.get(args.id);
    if (!freezer) throw new Error("Freezer not found");

    // Remove all associated slots first
    const slots = await ctx.db
      .query("freezer_slots")
      .withIndex("by_freezer", (q) => q.eq("freezer_id", args.id))
      .collect();

    await Promise.all(slots.map((s) => ctx.db.delete(s._id)));
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ── Get slots for a freezer at a rack/box position ───────────────────────

export const getSlots = query({
  args: {
    freezer_id: v.id("freezers"),
    rack: v.optional(v.number()),
    box: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    if (args.rack !== undefined && args.box !== undefined) {
      return await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer_pos", (q) =>
          q
            .eq("freezer_id", args.freezer_id)
            .eq("rack", args.rack!)
            .eq("box", args.box!)
        )
        .collect();
    }

    if (args.rack !== undefined) {
      return await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer_pos", (q) =>
          q.eq("freezer_id", args.freezer_id).eq("rack", args.rack!)
        )
        .collect();
    }

    return await ctx.db
      .query("freezer_slots")
      .withIndex("by_freezer", (q) => q.eq("freezer_id", args.freezer_id))
      .collect();
  },
});

// ── Insert or update a freezer slot ──────────────────────────────────────

export const upsertSlot = mutation({
  args: {
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
    await getAuthUserId(ctx);

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
    days: v.number(),
    freezer_id: v.optional(v.id("freezers")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    const now = Date.now();
    const cutoff = now + args.days * 24 * 60 * 60 * 1000;

    let slots;
    if (args.freezer_id !== undefined) {
      slots = await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer", (q) => q.eq("freezer_id", args.freezer_id!))
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
    query: v.string(),
    freezer_id: v.optional(v.id("freezers")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    const term = args.query.toLowerCase().trim();
    if (!term) return [];

    let slots;
    if (args.freezer_id !== undefined) {
      slots = await ctx.db
        .query("freezer_slots")
        .withIndex("by_freezer", (q) => q.eq("freezer_id", args.freezer_id!))
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
