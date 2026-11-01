/**
 * Quartzy records kept as the lab exported them: inventory items and instances, orders and order requests.
 * Every row keeps its original Quartzy identifier and every original column (in `data`), plus where it came
 * from, so nothing is merged or lost. Distinct physical instances are never merged by name.
 * Re-importing the same file updates rows in place (matched by kind + external id), so it is safe to repeat.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";

const { requireAuth, requireRole } = hubGuard("Resources");

const KINDS = ["item", "instance", "order", "request"] as const;
const record = v.object({
  kind: v.union(v.literal("item"), v.literal("instance"), v.literal("order"), v.literal("request")),
  external_id: v.string(),
  category: v.optional(v.string()),
  name: v.string(),
  vendor: v.optional(v.string()),
  catalog: v.optional(v.string()),
  status: v.optional(v.string()),
  date: v.optional(v.number()),
  amount: v.optional(v.number()),
  data: v.string(),
});

/** Adds or updates a batch of rows from one source file. */
export const importBatch = mutation({
  args: { token: v.optional(v.string()), source: v.string(), records: v.array(record) },
  handler: async (ctx, { token, source, records }) => {
    await requireRole(ctx, token, "manager");
    if (records.length > 300) throw new ConvexError("Send at most 300 rows at a time.");
    let added = 0, updated = 0;
    for (const r of records) {
      const search_text = [r.name, r.vendor, r.catalog, r.category, r.external_id].filter(Boolean).join(" ");
      const existing = (await ctx.db.query("quartzy_records").withIndex("by_key", (q) => q.eq("kind", r.kind).eq("external_id", r.external_id)).first());
      const row = { ...r, source, search_text, imported_at: Date.now() };
      if (existing) { await ctx.db.patch(existing._id, row); updated++; } else { await ctx.db.insert("quartzy_records", row); added++; }
    }
    return { added, updated };
  },
});

export const search = query({
  args: { token: v.optional(v.string()), text: v.optional(v.string()), kind: v.optional(v.string()), category: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { token, text, kind, category, limit }) => {
    await requireAuth(ctx, token);
    const n = Math.min(limit ?? 100, 300);
    if (text?.trim()) {
      return await ctx.db.query("quartzy_records").withSearchIndex("by_text", (q) => {
        let s = q.search("search_text", text.trim());
        if (kind) s = s.eq("kind", kind); if (category) s = s.eq("category", category);
        return s;
      }).take(n);
    }
    const rows = await ctx.db.query("quartzy_records").order("desc").take(2000);
    return rows.filter((r) => (!kind || r.kind === kind) && (!category || r.category === category)).slice(0, n);
  },
});

/** Record counts per kind, per category and per source file: the source-level counts for the import report. */
export const summary = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const rows = await ctx.db.query("quartzy_records").collect();
    const by = (key: (r: (typeof rows)[number]) => string) => rows.reduce<Record<string, number>>((m, r) => { const k = key(r); m[k] = (m[k] ?? 0) + 1; return m; }, {});
    return { total: rows.length, byKind: by((r) => r.kind), byCategory: by((r) => `${r.kind}|${r.category ?? ""}`), bySource: by((r) => r.source), missingName: rows.filter((r) => !r.name.trim()).length, missingCatalog: rows.filter((r) => r.kind !== "order" && !r.catalog).length };
  },
});

/**
 * For each request or order line: is the product in stock? Ordered = requested/ordered, not yet in inventory;
 * Received = marked received; Stock available = an inventory item/instance with the same vendor and catalog number exists.
 */
export const reconcile = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const rows = await ctx.db.query("quartzy_records").collect();
    const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const stock = new Set(rows.filter((r) => r.kind === "item" || r.kind === "instance").map((r) => `${norm(r.vendor)}|${norm(r.catalog)}`).filter((k) => !k.endsWith("|")));
    return rows.filter((r) => r.kind === "request").map((r) => ({
      id: r._id, name: r.name, vendor: r.vendor, catalog: r.catalog, status: r.status ?? "", amount: r.amount,
      state: stock.has(`${norm(r.vendor)}|${norm(r.catalog)}`) ? "Stock available" : /received/i.test(r.status ?? "") ? "Received" : "Ordered",
    }));
  },
});

export const clearSource = mutation({
  args: { token: v.optional(v.string()), source: v.string() },
  handler: async (ctx, { token, source }) => {
    await requireRole(ctx, token, "admin");
    let n = 0;
    for (const r of await ctx.db.query("quartzy_records").collect()) if (r.source === source) { await ctx.db.delete(r._id); n++; }
    return { deleted: n };
  },
});

export { KINDS };
