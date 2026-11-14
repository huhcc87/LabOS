/**
 * One-time: copy the old Lab Hub protocols (`protocols` table) into the Protocol Library (`protocol_library`),
 * so there is a single protocol list. Safe to run again: rows already copied are skipped. The old rows stay.
 * npx convex run protocolMerge:copyLabHubProtocols
 */
import { internalMutation } from "./_generated/server";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
const lines = (s?: string) => (s ?? "").split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean);

/** Old steps may be JSON (strings or {title,instruction}) or plain lines. */
function toSteps(raw?: string): { stepNumber: number; title: string; instruction: string }[] {
  let items: unknown[] = [];
  try { const j = JSON.parse(raw ?? ""); if (Array.isArray(j)) items = j; } catch { items = lines(raw); }
  return items.map((it, n) => {
    const o = (typeof it === "object" && it ? it : {}) as Record<string, unknown>;
    const text = typeof it === "string" ? it : String(o.instruction ?? o.text ?? o.description ?? o.title ?? "");
    return { stepNumber: n + 1, title: String(o.title ?? `Step ${n + 1}`), instruction: text };
  }).filter((s) => s.instruction);
}

export const copyLabHubProtocols = internalMutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    let copied = 0, skipped = 0;
    for (const p of await ctx.db.query("protocols").collect()) {
      const key = `lab-${p._id}`;
      if (await ctx.db.query("protocol_library").withIndex("by_key", (q) => q.eq("key", key)).first()) { skipped++; continue; }
      const author = (await ctx.db.get(p.author_id))?.full_name ?? "Lab member";
      const summary = (p.description ?? "").split(/\n\s*\n/)[0].trim();
      const data = {
        id: key, slug: key, title: p.title, category: slug(p.category ?? "general"), subcategory: "",
        summary, abstract: p.description ?? summary,
        protocolType: "internal", approvalStatus: p.status === "active" ? "approved" : p.status === "archived" ? "archived" : "draft",
        sourceType: "manual", sourceName: "Lab Hub", sourceUrl: "", authors: [author],
        keywords: p.category ? [slug(p.category)] : [], tags: (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        field: p.category ?? "", biosafetyLevel: "BSL-1",
        reagents: lines(p.materials), equipment: [],
        estimatedTime: p.duration ?? (p.estimated_duration ? `${p.estimated_duration} min` : ""),
        sampleType: "", organism: "", difficulty: "intermediate", prerequisites: [],
        safetyNotes: lines(p.safety), qcChecklist: [], troubleshooting: [],
        steps: toSteps(p.steps), references: [], relatedArticles: [],
        version: p.version, createdBy: author, owner: author, aiGenerated: false,
        reviewNotes: "Moved from the Lab Hub protocol list.", evidenceLinks: [],
        createdAt: new Date(p.created_at).toISOString(), updatedAt: new Date(p.updated_at).toISOString(),
      };
      await ctx.db.insert("protocol_library", { lab_id: p.lab_id, key, data: JSON.stringify(data), created_by: p.author_id, updated_at: Date.now() });
      copied++;
    }
    return `Copied ${copied} protocol(s); ${skipped} already in the library.`;
  },
});
