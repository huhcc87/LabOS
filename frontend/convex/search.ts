import { query } from "./_generated/server";
import { v } from "convex/values";

export const globalSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    if (!q || q.length < 2) return [];
    const term = q.toLowerCase();
    const results: { id: string; type: string; title: string; subtitle: string; icon: string; page: string }[] = [];

    // Samples
    const samples = await ctx.db.query("samples").collect();
    for (const s of samples) {
      if (
        s.name.toLowerCase().includes(term) ||
        (s.sample_id ?? "").toLowerCase().includes(term) ||
        (s.barcode ?? "").toLowerCase().includes(term)
      ) {
        results.push({
          id: `smp-${s._id}`,
          type: "Sample",
          title: s.name,
          subtitle: `${s.type ?? ""} — ${s.status}`.trim(),
          icon: "🧪",
          page: "samples",
        });
      }
    }

    // Protocols
    const protocols = await ctx.db.query("protocols").collect();
    for (const p of protocols) {
      if (p.title.toLowerCase().includes(term)) {
        results.push({
          id: `proto-${p._id}`,
          type: "Protocol",
          title: p.title,
          subtitle: `v${p.version} — ${p.status}`.trim(),
          icon: "📋",
          page: "protocols",
        });
      }
    }

    // Instruments
    const instruments = await ctx.db.query("instruments").collect();
    for (const i of instruments) {
      if (
        i.name.toLowerCase().includes(term) ||
        (i.model ?? "").toLowerCase().includes(term)
      ) {
        results.push({
          id: `instr-${i._id}`,
          type: "Instrument",
          title: i.name,
          subtitle: `${i.model ?? ""} — ${i.location ?? ""}`.trim(),
          icon: "🔬",
          page: "equipment",
        });
      }
    }

    // Inventory
    const inventory = await ctx.db.query("inventory").collect();
    for (const it of inventory) {
      if (
        it.name.toLowerCase().includes(term) ||
        (it.catalog_number ?? "").toLowerCase().includes(term)
      ) {
        results.push({
          id: `inv-${it._id}`,
          type: "Inventory",
          title: it.name,
          subtitle: `${it.quantity} ${it.unit ?? ""} — ${it.location ?? ""}`.trim(),
          icon: "📦",
          page: "inventory",
        });
      }
    }

    // Tasks
    const tasks = await ctx.db.query("tasks").collect();
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(term)) {
        results.push({
          id: `task-${t._id}`,
          type: "Task",
          title: t.title,
          subtitle: t.status,
          icon: "✓",
          page: "tasks",
        });
      }
    }

    return results.slice(0, 12);
  },
});
