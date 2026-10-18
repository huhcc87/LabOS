import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import type { Doc, Id } from "./_generated/dataModel";
import { lineTotal, overBudget, committedFor } from "./cartBudgets";
import { matchPo } from "./invoiceMatch";
// Students only reach this module if their PI allowed this hub.
const { requireAuth, requireRole } = hubGuard("Resources");

/**
 * Reagent requests. A request moves: pending -> approved -> ordered -> received
 * (or rejected / cancelled). Managers approve and order; anyone can request.
 * Requests at or under the lab's auto-approve limit skip the approval queue.
 */

const URGENCY = ["normal", "urgent"];
const AUTO_APPROVE_KEY = "cart_auto_approve_limit";
const DAY = 86_400_000;

async function autoApproveLimit(ctx: { db: any }): Promise<number> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", AUTO_APPROVE_KEY)).first();
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── List ──────────────────────────────────────────────────────────────────────

/** Your own requests. */
export const list = query({
  args: { token: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    const userId = await requireAuth(ctx, token);
    const items = await ctx.db.query("reagent_cart").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    return status ? items.filter((i) => i.status === status) : items;
  },
});

/** Everyone's requests in the lab for managers; your own for everyone else. Includes who asked. */
export const listAll = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const rows = hasRole(me.role, "manager")
      ? await ctx.db.query("reagent_cart").collect()
      : await ctx.db.query("reagent_cart").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    const names = new Map<string, string>();
    const budgets = await ctx.db.query("procurement_budgets").collect();
    const everyone = await ctx.db.query("reagent_cart").collect(); // budgets count the whole lab's requests
    const out = [];
    for (const r of rows) {
      if (!names.has(r.user_id)) names.set(r.user_id, (await ctx.db.get(r.user_id))?.full_name ?? "Unknown");
      // Budgets this request would push over their limit if approved.
      const over = r.status === "pending" ? overBudget(budgets, everyone, r, r._id).map((o) => o.name) : [];
      out.push({ ...r, requested_by: names.get(r.user_id)!, over_budget: over });
    }
    return out.sort((a, b) => b.created_at - a.created_at);
  },
});

/** Lab settings the cart screen needs. */
export const config = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    return { auto_approve_limit: await autoApproveLimit(ctx), can_manage: hasRole(me.role, "manager") };
  },
});

export const setAutoApproveLimit = mutation({
  args: { token: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { token, limit }) => {
    await requireRole(ctx, token, "manager");
    if (!Number.isFinite(limit) || limit < 0) throw new ConvexError("Enter an amount of 0 or more.");
    const now = Date.now();
    const row = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", AUTO_APPROVE_KEY)).first();
    if (row) await ctx.db.patch(row._id, { value: String(limit), updated_at: now });
    else await ctx.db.insert("settings", { key: AUTO_APPROVE_KEY, value: String(limit), category: "procurement", label: "Auto-approve requests up to", created_at: now, updated_at: now });
  },
});

// ── Create ────────────────────────────────────────────────────────────────────

const detailArgs = {
  catalog_number: v.optional(v.string()),
  supplier: v.optional(v.string()),
  unit: v.optional(v.string()),
  unit_price: v.optional(v.number()),
  url: v.optional(v.string()),
  notes: v.optional(v.string()),
  size: v.optional(v.string()),
  cas: v.optional(v.string()),
  project: v.optional(v.string()),
  grant: v.optional(v.string()),
  budget_code: v.optional(v.string()),
  urgency: v.optional(v.string()),
  needed_by: v.optional(v.number()),
};

function checkDetails(a: { quantity?: number; unit_price?: number; urgency?: string; name?: string }) {
  if (a.name !== undefined && !a.name.trim()) throw new ConvexError("Item name is required.");
  if (a.quantity !== undefined && (!Number.isFinite(a.quantity) || a.quantity <= 0 || a.quantity > 100000)) throw new ConvexError("Quantity must be more than 0.");
  if (a.unit_price !== undefined && (!Number.isFinite(a.unit_price) || a.unit_price < 0)) throw new ConvexError("Price cannot be negative.");
  if (a.urgency !== undefined && !URGENCY.includes(a.urgency)) throw new ConvexError("Urgency must be normal or urgent.");
}

export const create = mutation({
  args: { token: v.optional(v.string()), name: v.string(), quantity: v.number(), ...detailArgs },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    checkDetails(args);
    const { token: _t, ...fields } = args;
    const limit = await autoApproveLimit(ctx);
    // A request that would exceed a grant/project/budget limit always waits for a manager.
    const over = overBudget(await ctx.db.query("procurement_budgets").collect(), await ctx.db.query("reagent_cart").collect(), fields);
    const auto = !over.length && limit > 0 && fields.unit_price !== undefined && lineTotal({ unit_price: fields.unit_price, quantity: fields.quantity }) <= limit;
    return await ctx.db.insert("reagent_cart", {
      ...fields,
      name: fields.name.trim(),
      user_id: userId,
      status: auto ? "approved" : "pending",
      ...(auto ? { approved_at: Date.now(), decision_note: `Auto-approved (under ${limit})` } : {}),
      ...(over.length ? { decision_note: `Needs a manager: over budget (${over.map((o) => o.name).join(", ")})` } : {}),
      created_at: Date.now(),
    });
  },
});

// ── Update / remove ───────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("reagent_cart"),
    name: v.optional(v.string()),
    quantity: v.optional(v.number()),
    status: v.optional(v.string()),
    ...detailArgs,
  },
  handler: async (ctx, { token, id, ...fields }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const isManager = hasRole(me.role, "manager");
    const item = await ctx.db.get(id);
    if (!item) throw new ConvexError("Request not found.");
    if (item.user_id !== userId && !isManager) throw new ConvexError("You can only change your own requests.");
    checkDetails(fields);

    // Approving, rejecting and ordering are decisions: use decide / placeOrder, which check the role.
    if (fields.status !== undefined && !(fields.status === "cancelled" && ["pending", "approved"].includes(item.status))) {
      throw new ConvexError("Use Approve, Reject or Place order to change a request's status.");
    }
    // Once ordered, what was ordered is fixed.
    if (["ordered", "received"].includes(item.status) && Object.keys(fields).some((k) => k !== "status" && k !== "notes")) {
      throw new ConvexError("This request is already ordered and can't be edited.");
    }

    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) if (val !== undefined) patch[k] = k === "name" ? (val as string).trim() : val;
    // Changing a request someone already approved sends it back for approval.
    const changesMoney = ["quantity", "unit_price"].some((k) => k in patch && patch[k] !== (item as any)[k]);
    if (item.status === "approved" && changesMoney && !isManager) {
      patch.status = "pending";
      patch.approved_by = undefined;
      patch.approved_at = undefined;
    }
    await ctx.db.patch(id, patch);
    return id;
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("reagent_cart") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const item = await ctx.db.get(id);
    if (!item) throw new ConvexError("Request not found.");
    if (item.user_id !== userId && !hasRole(me.role, "manager")) throw new ConvexError("You can only remove your own requests.");
    if (["ordered", "received"].includes(item.status)) throw new ConvexError("Ordered requests are kept as a record. Cancel it instead.");
    await ctx.db.delete(id);
    return id;
  },
});

// ── Approval ──────────────────────────────────────────────────────────────────

export const decide = mutation({
  args: {
    token: v.optional(v.string()),
    ids: v.array(v.id("reagent_cart")),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
    /** Approve even when it goes over a budget limit. */
    override: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, ids, decision, note, override }) => {
    const manager = await requireRole(ctx, token, "manager");
    const now = Date.now();
    let changed = 0;
    const blocked: { id: Id<"reagent_cart">; name: string; budgets: string[] }[] = [];
    const budgets = decision === "approve" ? await ctx.db.query("procurement_budgets").collect() : [];
    let rows = decision === "approve" ? await ctx.db.query("reagent_cart").collect() : [];
    for (const id of ids) {
      const item = await ctx.db.get(id);
      if (!item || item.status !== "pending") continue;
      if (decision === "approve" && !override) {
        const over = overBudget(budgets, rows, item, id);
        if (over.length) { blocked.push({ id, name: item.name, budgets: over.map((o) => o.name) }); continue; }
      }
      await ctx.db.patch(id, {
        status: decision === "approve" ? "approved" : "rejected",
        approved_by: manager._id,
        approved_at: now,
        decision_note: note?.trim() || undefined,
      });
      if (decision === "approve") rows = rows.map((r) => (r._id === id ? { ...r, status: "approved" } : r)); // counts for the next one
      changed++;
    }
    return { changed, blocked };
  },
});

// ── Ordering ──────────────────────────────────────────────────────────────────

/** Orders approved requests. One PO number per supplier, so a PO covers everything bought from them. */
export const placeOrder = mutation({
  args: { token: v.optional(v.string()), ids: v.array(v.id("reagent_cart")) },
  handler: async (ctx, { token, ids }) => {
    await requireRole(ctx, token, "manager");
    const now = Date.now();
    const stamp = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const rows: Doc<"reagent_cart">[] = [];
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (r && r.status === "approved") rows.push(r);
    }
    const bySupplier = new Map<string, Doc<"reagent_cart">[]>();
    for (const r of rows) {
      const key = (r.supplier ?? "").trim() || "Unassigned";
      bySupplier.set(key, [...(bySupplier.get(key) ?? []), r]);
    }
    let n = 0;
    const orders = [];
    for (const [supplier, group] of bySupplier) {
      const po = `PO-${stamp}-${String(++n).padStart(2, "0")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      for (const r of group) await ctx.db.patch(r._id, { status: "ordered", po_number: po, ordered_at: now });
      orders.push({ po_number: po, supplier, total: group.reduce((s, r) => s + lineTotal(r), 0), ids: group.map((r) => r._id as Id<"reagent_cart">) });
    }
    return { ordered: rows.length, skipped: ids.length - rows.length, orders };
  },
});

/** Older name kept for the existing cart screen: orders the approved requests among `item_ids`. */
export const checkout = mutation({
  args: { token: v.optional(v.string()), item_ids: v.array(v.id("reagent_cart")) },
  handler: async (ctx, { token, item_ids }): Promise<Id<"reagent_cart">[]> => {
    await requireRole(ctx, token, "manager");
    const now = Date.now();
    const done: Id<"reagent_cart">[] = [];
    for (const id of item_ids) {
      const r = await ctx.db.get(id);
      if (!r || r.status !== "approved") continue;
      await ctx.db.patch(id, { status: "ordered", ordered_at: now });
      done.push(id);
    }
    return done;
  },
});

// ── Reorder low stock ─────────────────────────────────────────────────────────

/** Requests every inventory item at or under its minimum, unless a request for it is already open. */
export const reorderLowStock = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const low = (await ctx.db.query("inventory").collect()).filter((i) => i.minimum_quantity !== undefined && i.quantity <= i.minimum_quantity);
    const open = (await ctx.db.query("reagent_cart").collect()).filter((r) => ["pending", "approved", "ordered"].includes(r.status));
    const openCat = new Set(open.map((r) => (r.catalog_number ?? "").toLowerCase()).filter(Boolean));
    const openName = new Set(open.map((r) => r.name.toLowerCase()));
    let created = 0;
    for (const i of low) {
      if ((i.catalog_number && openCat.has(i.catalog_number.toLowerCase())) || openName.has(i.name.toLowerCase())) continue;
      await ctx.db.insert("reagent_cart", {
        user_id: userId, name: i.name, catalog_number: i.catalog_number, supplier: i.supplier, unit: i.unit,
        unit_price: i.cost_per_unit, quantity: Math.max(1, (i.minimum_quantity ?? 0) * 2 - i.quantity),
        notes: "Low stock: auto-requested", status: "pending", created_at: Date.now(),
      });
      created++;
    }
    return { created, low: low.length };
  },
});

// ── Spend ─────────────────────────────────────────────────────────────────────

/** Money by project, grant and person: committed (approved or ordered) and received. Managers only. */
export const spend = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireRole(ctx, token, "manager");
    const rows = (await ctx.db.query("reagent_cart").collect()).filter((r) => ["approved", "ordered", "received"].includes(r.status));
    const by = (key: (r: Doc<"reagent_cart">) => string) => {
      const m = new Map<string, { name: string; committed: number; received: number; count: number }>();
      for (const r of rows) {
        const k = key(r) || "(none)";
        const e = m.get(k) ?? { name: k, committed: 0, received: 0, count: 0 };
        e.count++;
        if (r.status === "received") e.received += lineTotal(r); else e.committed += lineTotal(r);
        m.set(k, e);
      }
      return [...m.values()].sort((a, b) => b.committed + b.received - (a.committed + a.received));
    };
    const people = new Map<string, string>();
    for (const r of rows) if (!people.has(r.user_id)) people.set(r.user_id, (await ctx.db.get(r.user_id))?.full_name ?? "Unknown");
    const everyone = await ctx.db.query("reagent_cart").collect();
    const budgets = (await ctx.db.query("procurement_budgets").collect()).map((b) => {
      const committed = committedFor(b, everyone);
      return { name: b.name, limit: b.amount, committed, remaining: b.amount - committed };
    });
    return {
      budgets,
      by_project: by((r) => r.project ?? ""),
      by_grant: by((r) => r.grant ?? ""),
      by_person: by((r) => people.get(r.user_id) ?? ""),
      last_30_days: rows.filter((r) => (r.ordered_at ?? r.created_at) > Date.now() - 30 * DAY).reduce((s, r) => s + lineTotal(r), 0),
    };
  },
});

// ── Invoices and three-way match ──────────────────────────────────────────────

const poRows = async (ctx: { db: any }, po: string): Promise<Doc<"reagent_cart">[]> =>
  (await ctx.db.query("reagent_cart").collect()).filter((r: Doc<"reagent_cart">) => r.po_number === po);

/** Enter a supplier invoice against a PO. */
export const addInvoice = mutation({
  args: {
    token: v.optional(v.string()),
    po_number: v.string(),
    invoice_number: v.string(),
    invoice_date: v.optional(v.number()),
    amount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, po_number, invoice_number, invoice_date, amount, notes }) => {
    const manager = await requireRole(ctx, token, "manager");
    const number = invoice_number.trim();
    if (!number || number.length > 64) throw new ConvexError("Enter the invoice number.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) throw new ConvexError("Invoice amount must be more than 0.");
    if (invoice_date !== undefined && !Number.isFinite(invoice_date)) throw new ConvexError("Invoice date is not valid.");
    if (!(await poRows(ctx, po_number)).length) throw new ConvexError("No order has that PO number.");
    const same = await ctx.db.query("cart_invoices").withIndex("by_po", (q) => q.eq("po_number", po_number)).collect();
    if (same.some((i) => i.invoice_number.toLowerCase() === number.toLowerCase())) throw new ConvexError("That invoice number is already entered for this PO.");
    return await ctx.db.insert("cart_invoices", {
      po_number, invoice_number: number, invoice_date, amount, notes: notes?.trim() || undefined,
      entered_by: manager._id, created_at: Date.now(),
    });
  },
});

export const removeInvoice = mutation({
  args: { token: v.optional(v.string()), id: v.id("cart_invoices") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "manager");
    await ctx.db.delete(id);
  },
});

/** Every PO with what was ordered, received and invoiced, and whether they agree. Managers only. */
export const invoiceMatch = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireRole(ctx, token, "manager");
    const rows = (await ctx.db.query("reagent_cart").collect()).filter((r) => r.po_number && ["ordered", "received"].includes(r.status));
    const invoices = await ctx.db.query("cart_invoices").collect();
    const byPo = new Map<string, Doc<"reagent_cart">[]>();
    for (const r of rows) byPo.set(r.po_number!, [...(byPo.get(r.po_number!) ?? []), r]);
    return [...byPo.entries()]
      .map(([po_number, lines]) => {
        const mine = invoices.filter((i) => i.po_number === po_number).sort((a, b) => a.created_at - b.created_at);
        return {
          po_number,
          supplier: (lines[0].supplier ?? "").trim() || "Unassigned",
          ordered_at: lines[0].ordered_at ?? 0,
          lines: lines.map((l) => ({ id: l._id as Id<"reagent_cart">, name: l.name, quantity: l.quantity, received: l.received_quantity ?? 0, price: l.unit_price })),
          invoices: mine.map((i) => ({ id: i._id as Id<"cart_invoices">, number: i.invoice_number, date: i.invoice_date, amount: i.amount, notes: i.notes })),
          ...matchPo(lines, mine.map((i) => i.amount)),
        };
      })
      .sort((a, b) => b.ordered_at - a.ordered_at);
  },
});
