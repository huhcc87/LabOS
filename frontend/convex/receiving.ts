/**
 * Receiving: book a delivery into inventory with its lot number and expiry date.
 * Scan a catalog number or barcode, find the open order or the stock item, record the lot.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";
import type { Doc } from "./_generated/dataModel";

const { requireAuth } = hubGuard("Resources");

const DAY = 86_400_000;
const MAX_QTY = 1_000_000;

/** Compare codes ignoring case, dashes and spaces: "10128-016" matches "10128016". */
const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Open orders: ordered from the reagent cart and not fully received yet. */
export const pending = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const rows = await ctx.db.query("reagent_cart").filter((q) => q.eq(q.field("status"), "ordered")).collect();
    return rows.map((r) => ({ ...r, outstanding: Math.max(0, r.quantity - (r.received_quantity ?? 0)) }));
  },
});

/** Prefix of the code printed on a lot label. Scanning it finds that exact lot. */
export const LOT_PREFIX = "LOT:";

/** What a scanned code refers to: a lot label, open orders, then stock items. */
export const lookup = query({
  args: { token: v.optional(v.string()), code: v.string() },
  handler: async (ctx, { token, code }) => {
    await requireAuth(ctx, token);
    if (code.startsWith(LOT_PREFIX)) {
      const id = ctx.db.normalizeId("inventory_lots", code.slice(LOT_PREFIX.length).trim());
      const lot = id ? await ctx.db.get(id) : null;
      const item = lot ? await ctx.db.get(lot.inventory_id) : null;
      return { orders: [], items: item ? [item] : [], lots: lot && item ? [{ ...lot, item_name: item.name }] : [] };
    }
    const key = norm(code);
    if (!key) return { orders: [], items: [], lots: [] };
    const orders = (await ctx.db.query("reagent_cart").filter((q) => q.eq(q.field("status"), "ordered")).collect())
      .filter((r) => norm(r.catalog_number) === key)
      .map((r) => ({ ...r, outstanding: Math.max(0, r.quantity - (r.received_quantity ?? 0)) }));
    const items = (await ctx.db.query("inventory").collect())
      .filter((i) => norm(i.barcode) === key || norm(i.catalog_number) === key)
      .slice(0, 10);
    return { orders, items, lots: [] as Array<Doc<"inventory_lots"> & { item_name: string }> };
  },
});

/** Take stock out of one lot (used in an experiment, discarded). Keeps lot and item totals in step. */
export const consume = mutation({
  args: {
    token: v.optional(v.string()),
    lot_id: v.id("inventory_lots"),
    quantity: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, lot_id, quantity, reason }) => {
    const userId = await requireAuth(ctx, token);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new ConvexError("Quantity must be more than 0.");
    const lot = await ctx.db.get(lot_id);
    if (!lot) throw new ConvexError("Lot not found.");
    if (quantity > lot.quantity_remaining) throw new ConvexError(`Only ${lot.quantity_remaining} left in lot ${lot.lot_number}.`);
    const item = await ctx.db.get(lot.inventory_id);
    if (!item) throw new ConvexError("Inventory item not found.");
    const now = Date.now();

    await ctx.db.patch(lot_id, { quantity_remaining: lot.quantity_remaining - quantity });
    await ctx.db.patch(item._id, { quantity: Math.max(0, item.quantity - quantity), updated_at: now });
    await ctx.db.insert("audit_logs", {
      user_id: userId, action: "consume", entity_type: "inventory", entity_id: item._id,
      details: JSON.stringify({ lot: lot.lot_number, quantity, reason }), created_at: now,
    });
    return { lot_remaining: lot.quantity_remaining - quantity, item_quantity: Math.max(0, item.quantity - quantity) };
  },
});

/** Lots of one item (or all in-stock lots), for choosing what to print or use. */
export const stockLots = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const items = await ctx.db.query("inventory").collect();
    const lotRows = await ctx.db.query("inventory_lots").collect();
    return { items: items.slice(0, 1000), lots: lotRows.filter((l) => l.quantity_remaining > 0).slice(0, 1000) };
  },
});

export const receive = mutation({
  args: {
    token: v.optional(v.string()),
    cart_item_id: v.optional(v.id("reagent_cart")),
    inventory_id: v.optional(v.id("inventory")),
    // Only used when receiving something that is not in inventory yet:
    name: v.optional(v.string()),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    unit: v.optional(v.string()),
    lot_number: v.string(),
    expiry_date: v.optional(v.number()),
    quantity: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    const now = Date.now();

    const lotNumber = args.lot_number.trim();
    if (!lotNumber) throw new ConvexError("Enter the lot number printed on the package.");
    if (lotNumber.length > 64) throw new ConvexError("Lot number is too long.");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0 || args.quantity > MAX_QTY) {
      throw new ConvexError("Quantity must be more than 0.");
    }
    if (args.expiry_date !== undefined) {
      if (!Number.isFinite(args.expiry_date)) throw new ConvexError("Expiry date is not valid.");
      if (args.expiry_date <= now) throw new ConvexError("This lot is already expired. Do not receive it into stock.");
    }

    // The open order this delivery answers, if any.
    let cart: Doc<"reagent_cart"> | null = null;
    if (args.cart_item_id) {
      cart = await ctx.db.get(args.cart_item_id);
      if (!cart) throw new ConvexError("Order not found.");
      if (cart.status !== "ordered") throw new ConvexError("This order is not waiting to be received.");
    }

    // The stock item: given, matched by catalog number, or created.
    let itemId = args.inventory_id;
    if (itemId && !(await ctx.db.get(itemId))) throw new ConvexError("Inventory item not found.");
    if (!itemId) {
      const cat = norm(cart?.catalog_number ?? args.catalog_number);
      if (cat) {
        const match = (await ctx.db.query("inventory").collect()).find((i) => norm(i.catalog_number) === cat);
        if (match) itemId = match._id;
      }
    }
    if (!itemId) {
      const name = (cart?.name ?? args.name ?? "").trim();
      if (!name) throw new ConvexError("Say which item this is.");
      itemId = await ctx.db.insert("inventory", {
        name,
        catalog_number: cart?.catalog_number ?? args.catalog_number,
        supplier: cart?.supplier ?? args.supplier,
        unit: cart?.unit ?? args.unit,
        cost_per_unit: cart?.unit_price,
        quantity: 0,
        created_by: userId,
        created_at: now,
        updated_at: now,
      });
    }
    const item = (await ctx.db.get(itemId))!;
    const location = args.location?.trim() || item.location;

    // Same item and lot again: add to that lot instead of listing it twice.
    const lots = await ctx.db.query("inventory_lots").withIndex("by_inventory", (q) => q.eq("inventory_id", itemId!)).collect();
    const existing = lots.find((l) => l.lot_number.toLowerCase() === lotNumber.toLowerCase());
    let lotId;
    if (existing) {
      if (args.expiry_date !== undefined && existing.expiry_date !== undefined && existing.expiry_date !== args.expiry_date) {
        throw new ConvexError(`Lot ${existing.lot_number} is already recorded with a different expiry date. Check the label.`);
      }
      await ctx.db.patch(existing._id, {
        quantity_received: existing.quantity_received + args.quantity,
        quantity_remaining: existing.quantity_remaining + args.quantity,
        expiry_date: existing.expiry_date ?? args.expiry_date,
      });
      lotId = existing._id;
    } else {
      lotId = await ctx.db.insert("inventory_lots", {
        inventory_id: itemId,
        lot_number: lotNumber,
        expiry_date: args.expiry_date,
        quantity_received: args.quantity,
        quantity_remaining: args.quantity,
        unit: item.unit ?? cart?.unit,
        location,
        supplier: item.supplier ?? cart?.supplier,
        cart_item_id: cart?._id,
        notes: args.notes?.trim() || undefined,
        received_by: userId,
        received_at: now,
      });
    }

    // Stock goes up; the item's expiry is the soonest expiry among lots still in stock.
    const all = await ctx.db.query("inventory_lots").withIndex("by_inventory", (q) => q.eq("inventory_id", itemId!)).collect();
    const soonest = all.filter((l) => l.quantity_remaining > 0 && l.expiry_date !== undefined).map((l) => l.expiry_date!);
    await ctx.db.patch(itemId, {
      quantity: item.quantity + args.quantity,
      location,
      expiry_date: soonest.length ? Math.min(...soonest) : item.expiry_date,
      updated_at: now,
    });

    let orderDone = false;
    if (cart) {
      const got = (cart.received_quantity ?? 0) + args.quantity;
      orderDone = got >= cart.quantity;
      await ctx.db.patch(cart._id, { received_quantity: got, ...(orderDone ? { status: "received", received_at: now } : {}) });
    }

    await ctx.db.insert("audit_logs", {
      user_id: userId,
      action: "receive",
      entity_type: "inventory",
      entity_id: itemId,
      details: JSON.stringify({ lot: lotNumber, quantity: args.quantity, expiry_date: args.expiry_date, order: cart?._id }),
      created_at: now,
    });

    return { inventory_id: itemId, lot_id: lotId, order_done: orderDone, new_quantity: item.quantity + args.quantity };
  },
});

/** Lots still in stock, soonest expiry first; those without an expiry date go last. */
export const lots = query({
  args: { token: v.optional(v.string()), inventory_id: v.optional(v.id("inventory")), within_days: v.optional(v.number()) },
  handler: async (ctx, { token, inventory_id, within_days }) => {
    await requireAuth(ctx, token);
    const rows = inventory_id
      ? await ctx.db.query("inventory_lots").withIndex("by_inventory", (q) => q.eq("inventory_id", inventory_id)).collect()
      : await ctx.db.query("inventory_lots").collect();
    const limit = within_days === undefined ? Infinity : Date.now() + within_days * DAY;
    const keep = rows.filter((l) => l.quantity_remaining > 0 && (l.expiry_date === undefined ? within_days === undefined : l.expiry_date <= limit));
    keep.sort((a, b) => (a.expiry_date ?? Infinity) - (b.expiry_date ?? Infinity));
    const names = new Map<string, string>();
    for (const l of keep.slice(0, 200)) {
      if (!names.has(l.inventory_id)) names.set(l.inventory_id, (await ctx.db.get(l.inventory_id))?.name ?? "(deleted item)");
    }
    return keep.slice(0, 200).map((l) => ({ ...l, item_name: names.get(l.inventory_id)! }));
  },
});

/** Most recent deliveries, for the receiving log. */
export const recent = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const rows = (await ctx.db.query("inventory_lots").collect()).sort((a, b) => b.received_at - a.received_at).slice(0, 15);
    const out = [];
    for (const l of rows) out.push({ ...l, item_name: (await ctx.db.get(l.inventory_id))?.name ?? "(deleted item)" });
    return out;
  },
});
