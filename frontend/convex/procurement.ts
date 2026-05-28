import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── Pending Approvals (purchase_orders with status "pending") ────────────────

export const listPendingApprovals = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    return ctx.db
      .query("purchase_orders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const approve = mutation({
  args: {
    token: v.optional(v.string()),
    ids: v.array(v.id("purchase_orders")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, ids, reason }) => {
    const userId = await requireAuth(ctx, token);
    const now = Date.now();
    for (const id of ids) {
      await ctx.db.patch(id, {
        status: "approved",
        approved_by: userId,
        notes: reason,
        updated_at: now,
      });
    }
    return { success: true };
  },
});

export const reject = mutation({
  args: {
    token: v.optional(v.string()),
    ids: v.array(v.id("purchase_orders")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, ids, reason }) => {
    await requireAuth(ctx, token);
    const now = Date.now();
    for (const id of ids) {
      await ctx.db.patch(id, { status: "rejected", notes: reason, updated_at: now });
    }
    return { success: true };
  },
});

// ── Procurement Rules ────────────────────────────────────────────────────────

export const listRules = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    return ctx.db.query("procurement_rules").collect();
  },
});

export const createRule = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    condition_field: v.string(),
    condition_op: v.string(),
    condition_value: v.string(),
    action: v.string(),
  },
  handler: async (ctx, { token, name, condition_field, condition_op, condition_value, action }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.insert("procurement_rules", {
      name,
      condition_field,
      condition_op,
      condition_value,
      action,
      created_by: userId,
      created_at: Date.now(),
    });
  },
});

export const deleteRule = mutation({
  args: { token: v.optional(v.string()), id: v.id("procurement_rules") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.delete(id);
    return { success: true };
  },
});

// ── Budgets ──────────────────────────────────────────────────────────────────

export const listBudgets = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    return ctx.db.query("procurement_budgets").collect();
  },
});

export const createBudget = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    amount: v.number(),
    period: v.string(),
    department: v.optional(v.string()),
  },
  handler: async (ctx, { token, name, amount, period, department }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.insert("procurement_budgets", {
      name,
      amount,
      spent: 0,
      period,
      department,
      created_by: userId,
      created_at: Date.now(),
    });
  },
});

export const deleteBudget = mutation({
  args: { token: v.optional(v.string()), id: v.id("procurement_budgets") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.delete(id);
    return { success: true };
  },
});

export const checkBudget = query({
  args: {
    token: v.optional(v.string()),
    id: v.id("procurement_budgets"),
    amount: v.number(),
  },
  handler: async (ctx, { id, amount }) => {
    const budget = await ctx.db.get(id);
    if (!budget) return { within_budget: false };
    return { within_budget: budget.spent + amount <= budget.amount };
  },
});

// ── Restricted Chemicals ─────────────────────────────────────────────────────

export const listRestricted = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    return ctx.db.query("restricted_chemicals").collect();
  },
});

export const addRestricted = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    cas_number: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, name, cas_number, reason }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.insert("restricted_chemicals", {
      name,
      cas_number,
      reason,
      added_by: userId,
      created_at: Date.now(),
    });
  },
});

export const deleteRestricted = mutation({
  args: { token: v.optional(v.string()), id: v.id("restricted_chemicals") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.delete(id);
    return { success: true };
  },
});

export const scanChemical = query({
  args: { token: v.optional(v.string()), name: v.string(), cas: v.string() },
  handler: async (ctx, { name, cas }) => {
    const all = await ctx.db.query("restricted_chemicals").collect();
    const matches = all.filter(
      (r) =>
        r.name.toLowerCase() === name.toLowerCase() ||
        (cas && r.cas_number === cas)
    );
    return { matches, blocked: matches.length > 0 };
  },
});

// ── Borrow/Lend ──────────────────────────────────────────────────────────────

export const listBorrow = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    return ctx.db.query("borrow_requests").order("desc").collect();
  },
});

export const createBorrow = mutation({
  args: {
    token: v.optional(v.string()),
    item_name: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, item_name, quantity, unit, notes }) => {
    const userId = await requireAuth(ctx, token);
    const now = Date.now();
    return ctx.db.insert("borrow_requests", {
      item_name,
      quantity,
      unit,
      requester_id: userId,
      status: "pending",
      notes,
      created_at: now,
      updated_at: now,
    });
  },
});

export const respondBorrow = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("borrow_requests"),
    approve: v.boolean(),
  },
  handler: async (ctx, { token, id, approve }) => {
    const userId = await requireAuth(ctx, token);
    await ctx.db.patch(id, {
      status: approve ? "approved" : "rejected",
      lender_id: approve ? userId : undefined,
      updated_at: Date.now(),
    });
    return { success: true };
  },
});

// ── Group Buy (aggregate reagent_cart items by supplier) ─────────────────────

export const groupBuy = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    const items = await ctx.db.query("reagent_cart").collect();
    const groups: Record<string, { supplier: string; items: number; total: number }> = {};
    for (const item of items) {
      if (item.status !== "in_cart") continue;
      const key = item.supplier ?? "Unknown";
      if (!groups[key]) groups[key] = { supplier: key, items: 0, total: 0 };
      groups[key].items += item.quantity;
      groups[key].total += (item.unit_price ?? 0) * item.quantity;
    }
    return Object.values(groups);
  },
});

// ── Receiving ────────────────────────────────────────────────────────────────

export const receive = mutation({
  args: {
    token: v.optional(v.string()),
    barcode: v.string(),
    qty: v.optional(v.number()),
  },
  handler: async (ctx, { token, barcode }) => {
    await requireAuth(ctx, token);
    const po = await ctx.db
      .query("purchase_orders")
      .filter((q) => q.eq(q.field("notes"), barcode))
      .first();
    if (po) {
      await ctx.db.patch(po._id, { status: "received", updated_at: Date.now() });
      return { matched: true, order_id: po._id };
    }
    return { matched: false };
  },
});

// ── Quote ────────────────────────────────────────────────────────────────────

export const requestQuote = mutation({
  args: { token: v.optional(v.string()), id: v.id("purchase_orders"), notes: v.optional(v.string()) },
  handler: async (ctx, { token, id, notes }) => {
    await requireAuth(ctx, token);
    await ctx.db.patch(id, { status: "quote_requested", notes, updated_at: Date.now() });
    return { success: true };
  },
});

export const recordQuote = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("purchase_orders"),
    url: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, { token, id, price }) => {
    await requireAuth(ctx, token);
    const patch: Record<string, unknown> = { status: "quoted", updated_at: Date.now() };
    if (price !== undefined) patch.total_amount = price;
    await ctx.db.patch(id, patch);
    return { success: true };
  },
});

// ── Alt Prices ───────────────────────────────────────────────────────────────

export const getAltPrices = query({
  args: { token: v.optional(v.string()), id: v.id("purchase_orders") },
  handler: async (ctx, { id }) => {
    return ctx.db
      .query("alt_prices")
      .withIndex("by_order", (q) => q.eq("purchase_order_id", id))
      .collect();
  },
});

export const setAltPrices = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("purchase_orders"),
    prices: v.array(v.object({
      vendor: v.string(),
      price: v.number(),
      url: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { token, id, prices }) => {
    await requireAuth(ctx, token);
    // Clear existing
    const existing = await ctx.db
      .query("alt_prices")
      .withIndex("by_order", (q) => q.eq("purchase_order_id", id))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);
    // Insert new
    const now = Date.now();
    for (const p of prices) {
      await ctx.db.insert("alt_prices", {
        purchase_order_id: id,
        vendor: p.vendor,
        price: p.price,
        url: p.url,
        created_at: now,
      });
    }
    return { success: true };
  },
});

export const swapVendor = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("purchase_orders"),
    vendor: v.string(),
    price: v.number(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, vendor, price, url }) => {
    await requireAuth(ctx, token);
    // Find or create supplier
    let supplier = await ctx.db
      .query("suppliers")
      .filter((q) => q.eq(q.field("name"), vendor))
      .first();
    let supplierId = supplier?._id;
    if (!supplierId) {
      const now = Date.now();
      supplierId = await ctx.db.insert("suppliers", {
        name: vendor,
        approval_status: "pending",
        website: url,
        created_at: now,
        updated_at: now,
      });
    }
    await ctx.db.patch(id, {
      supplier_id: supplierId,
      total_amount: price,
      notes: url ? `Vendor URL: ${url}` : undefined,
      updated_at: Date.now(),
    });
    return { success: true };
  },
});

// ── SDS Records ──────────────────────────────────────────────────────────────

export const setSds = mutation({
  args: {
    token: v.optional(v.string()),
    entity_id: v.string(),
    url: v.string(),
    hazards: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { token, entity_id, url, hazards }) => {
    await requireAuth(ctx, token);
    // Upsert
    const existing = await ctx.db
      .query("sds_records")
      .withIndex("by_entity", (q) => q.eq("entity_id", entity_id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { url, hazards: hazards?.join(",") });
    } else {
      await ctx.db.insert("sds_records", {
        entity_id,
        url,
        hazards: hazards?.join(","),
        created_at: Date.now(),
      });
    }
    return { success: true };
  },
});

// ── Recurrence Rules ─────────────────────────────────────────────────────────

export const setRecurrence = mutation({
  args: {
    token: v.optional(v.string()),
    entity_id: v.string(),
    pattern: v.string(),
    auto_reorder: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, entity_id, pattern, auto_reorder }) => {
    await requireAuth(ctx, token);
    const existing = await ctx.db
      .query("recurrence_rules")
      .withIndex("by_entity", (q) => q.eq("entity_id", entity_id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { pattern, auto_reorder: auto_reorder ?? false });
    } else {
      await ctx.db.insert("recurrence_rules", {
        entity_id,
        pattern,
        auto_reorder: auto_reorder ?? false,
        created_at: Date.now(),
      });
    }
    return { success: true };
  },
});

// ── Find Lender ──────────────────────────────────────────────────────────────

export const findLender = query({
  args: { token: v.optional(v.string()), item_name: v.optional(v.string()) },
  handler: async (ctx, { item_name }) => {
    // Find users who have relevant inventory items
    if (!item_name) return [];
    const term = item_name.toLowerCase();
    const items = await ctx.db.query("inventory").collect();
    const matches = items.filter(
      (i) => i.name.toLowerCase().includes(term) && i.quantity > 0
    );
    // Get unique owners/departments
    const lenders = [];
    const seen = new Set<string>();
    for (const m of matches.slice(0, 10)) {
      const key = m.location ?? m.name;
      if (seen.has(key)) continue;
      seen.add(key);
      lenders.push({
        item: m.name,
        location: m.location ?? "Unknown",
        available_quantity: m.quantity,
      });
    }
    return lenders;
  },
});

// ── Enrichment Status ────────────────────────────────────────────────────────

export const enrichmentStatus = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    const sdsCount = await ctx.db.query("sds_records").collect();
    return { enabled: sdsCount.length > 0, sds_records: sdsCount.length };
  },
});
