import { query, mutation } from "./tenant";
import { v } from "convex/values";
import { requireRole } from "./authHelper";

/**
 * An integration's settings can hold keys and passwords. The page gets them masked (only the last 4 characters),
 * and saving a masked value back keeps the stored one, so an admin can edit the other settings without
 * ever seeing or re-typing the secret.
 */
const MASK = "••••";
const SECRET_KEY = /key|secret|token|password|passwd/i;
function parse(config?: string): Record<string, unknown> | null {
  try { const v = JSON.parse(config ?? ""); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; }
}
export function maskConfig(config?: string): string | undefined {
  const o = parse(config); if (!o) return config;
  for (const [k, val] of Object.entries(o)) if (SECRET_KEY.test(k) && typeof val === "string" && val) o[k] = MASK + val.slice(-4);
  return JSON.stringify(o);
}
/** Puts the stored secret back wherever the page sent a masked one back unchanged. */
function keepSecrets(incoming: string, stored?: string): string {
  const next = parse(incoming), old = parse(stored); if (!next || !old) return incoming;
  for (const [k, val] of Object.entries(next)) if (typeof val === "string" && val.startsWith(MASK) && typeof old[k] === "string") next[k] = old[k];
  return JSON.stringify(next);
}

export const list = query({
  args: { token: v.optional(v.string()), search: v.optional(v.string()), integration_type: v.optional(v.string()), paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })) },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.token, "admin");
    let results = await ctx.db.query("integrations").order("desc").collect();
    if (args.integration_type) results = results.filter((r) => r.integration_type === args.integration_type);
    if (args.search) { const t = args.search.toLowerCase(); results = results.filter((r) => r.name.toLowerCase().includes(t)); }
    return results.map((r) => ({ ...r, config: maskConfig(r.config) }));
  },
});

export const create = mutation({
  args: { token: v.optional(v.string()), name: v.string(), integration_type: v.string(), description: v.optional(v.string()), config: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, { token, ...data }) => { await requireRole(ctx, token, "admin"); return ctx.db.insert("integrations", { ...data, status: data.status ?? "inactive", created_at: Date.now() }); },
});

export const update = mutation({
  args: { token: v.optional(v.string()), id: v.id("integrations"), name: v.optional(v.string()), integration_type: v.optional(v.string()), description: v.optional(v.string()), config: v.optional(v.string()), status: v.optional(v.string()), last_sync: v.optional(v.number()) },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireRole(ctx, token, "admin");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) { if (val !== undefined) patch[k] = val; }
    if (typeof patch.config === "string") patch.config = keepSecrets(patch.config, (await ctx.db.get(id))?.config);
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("integrations") },
  handler: async (ctx, { token, id }) => { await requireRole(ctx, token, "admin"); await ctx.db.delete(id); },
});
