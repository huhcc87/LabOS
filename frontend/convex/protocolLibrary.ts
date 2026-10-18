/**
 * The Protocols library: full protocol records (steps, reagents, approval…) saved for the whole lab.
 * Each record is stored as JSON text under the protocol's own id.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
const { requireAuth } = hubGuard("Lab Hub");

const MAX_JSON = 400_000;

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return (await ctx.db.query("protocol_library").order("desc").collect()).map((r) => ({ key: r.key, data: r.data, created_by: r.created_by }));
  },
});

/** Add a protocol, or replace the saved copy with the same id. */
export const save = mutation({
  args: { token: v.optional(v.string()), key: v.string(), data: v.string() },
  handler: async (ctx, { token, key, data }) => {
    const userId = await requireAuth(ctx, token);
    if (!key.trim() || key.length > 120) throw new ConvexError("Protocol id is not valid.");
    if (data.length > MAX_JSON) throw new ConvexError("This protocol is too large to save.");
    try { const p = JSON.parse(data); if (!p || typeof p !== "object" || typeof p.title !== "string") throw new Error(); } catch { throw new ConvexError("Protocol data is not valid."); }
    const existing = await ctx.db.query("protocol_library").withIndex("by_key", (q) => q.eq("key", key)).first();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { data, updated_at: now });
    else await ctx.db.insert("protocol_library", { key, data, created_by: userId, updated_at: now });
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), key: v.string() },
  handler: async (ctx, { token, key }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const row = await ctx.db.query("protocol_library").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (!row) return;
    if (row.created_by !== userId && !hasRole(me.role, "manager")) throw new ConvexError("Only the person who added it, or a manager, can delete a protocol.");
    await ctx.db.delete(row._id);
  },
});
