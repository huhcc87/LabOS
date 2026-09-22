import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// Per-type cap keeps any single busy table (e.g. samples) from crowding out
// every other entity in the results list; total cap keeps the popup usable.
const PER_TYPE_LIMIT = 8;
const MAX_RESULTS = 50;
// ponytail: tasks has no search index in schema.ts, so it gets a bounded
// table scan instead — fine at current table sizes; add a searchIndex on
// tasks.title (like sops/protocols) if this table grows large.
const SCAN_LIMIT = 500;

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  page: string;
  date?: number;
}

export const globalSearch = query({
  args: { token: v.optional(v.string()), q: v.string() },
  handler: async (ctx, { token, q }): Promise<SearchResult[]> => {
    await requireAuth(ctx, token);
    const term = q.trim();
    if (term.length < 2) return [];

    const results: SearchResult[] = [];

    // ── Samples (search index on `name`) ──────────────────────────────
    const samples = await ctx.db
      .query("samples")
      .withSearchIndex("search_name", (idx) => idx.search("name", term))
      .take(PER_TYPE_LIMIT);
    for (const s of samples) {
      results.push({
        id: `samples-${s._id}`,
        type: "Sample",
        title: s.name,
        subtitle: `${s.type ?? "sample"} — ${s.status}`,
        icon: "🧪",
        page: "samples",
        date: s.updated_at,
      });
    }

    // ── Protocols (search index on `title`) ───────────────────────────
    const protocols = await ctx.db
      .query("protocols")
      .withSearchIndex("search_title", (idx) => idx.search("title", term))
      .take(PER_TYPE_LIMIT);
    for (const p of protocols) {
      results.push({
        id: `protocols-${p._id}`,
        type: "Protocol",
        title: p.title,
        subtitle: `v${p.version} — ${p.status}`,
        icon: "📋",
        page: "protocols",
        date: p.updated_at,
      });
    }

    // ── Inventory (search index on `name`) ────────────────────────────
    const inventory = await ctx.db
      .query("inventory")
      .withSearchIndex("search_name", (idx) => idx.search("name", term))
      .take(PER_TYPE_LIMIT);
    for (const it of inventory) {
      results.push({
        id: `inventory-${it._id}`,
        type: "Inventory",
        title: it.name,
        subtitle: `${it.quantity} ${it.unit ?? ""} — ${it.location ?? "unassigned"}`.trim(),
        icon: "📦",
        page: "inventory",
        date: it.updated_at,
      });
    }

    // ── Instruments (search index on `name`) ──────────────────────────
    const instruments = await ctx.db
      .query("instruments")
      .withSearchIndex("search_name", (idx) => idx.search("name", term))
      .take(PER_TYPE_LIMIT);
    for (const i of instruments) {
      results.push({
        id: `instruments-${i._id}`,
        type: "Instrument",
        title: i.name,
        subtitle: `${i.model ?? ""} — ${i.location ?? "unassigned"}`.trim(),
        icon: "🔬",
        page: "equipment",
        date: i.updated_at,
      });
    }

    // ── SOPs (search index on `title`) ────────────────────────────────
    const sops = await ctx.db
      .query("sops")
      .withSearchIndex("search_title", (idx) => idx.search("title", term))
      .take(PER_TYPE_LIMIT);
    for (const sop of sops) {
      results.push({
        id: `sops-${sop._id}`,
        type: "SOP",
        title: sop.title,
        subtitle: `v${sop.version} — ${sop.status}`,
        icon: "📖",
        page: "sops",
        date: sop.updated_at,
      });
    }

    // ── Suppliers (search index on `name`) ────────────────────────────
    const suppliers = await ctx.db
      .query("suppliers")
      .withSearchIndex("search_name", (idx) => idx.search("name", term))
      .take(PER_TYPE_LIMIT);
    for (const sup of suppliers) {
      results.push({
        id: `suppliers-${sup._id}`,
        type: "Supplier",
        title: sup.name,
        subtitle: `${sup.category ?? "supplier"} — ${sup.approval_status}`,
        icon: "🏭",
        page: "suppliers",
        date: sup.updated_at,
      });
    }

    // ── Tasks (no search index — bounded scan + substring match) ──────
    const lowerTerm = term.toLowerCase();
    const tasks = await ctx.db.query("tasks").take(SCAN_LIMIT);
    let taskMatches = 0;
    for (const t of tasks) {
      if (taskMatches >= PER_TYPE_LIMIT) break;
      if (t.title.toLowerCase().includes(lowerTerm)) {
        results.push({
          id: `tasks-${t._id}`,
          type: "Task",
          title: t.title,
          subtitle: `${t.status}${t.priority ? ` — ${t.priority}` : ""}`,
          icon: "✓",
          page: "tasks",
          date: t.updated_at,
        });
        taskMatches++;
      }
    }

    return results.slice(0, MAX_RESULTS);
  },
});
