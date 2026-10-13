/**
 * ONE-TIME move to lab separation: put the existing people and data into a first lab.
 *   npx convex run --prod migrate:startFirstLab '{"ownerEmail":"…","name":"…"}'
 *   npx convex run --prod migrate:backfill '{"table":"samples"}'   (once per table; repeat while "left" > 0)
 *   npx convex run --prod migrate:audit                            (everything should say 0)
 * Internal only: it can't be called from the app.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { LAB_TABLES } from "./tenantTables";

export const startFirstLab = internalMutation({
  args: { ownerEmail: v.string(), name: v.string() },
  handler: async (ctx, { ownerEmail, name }) => {
    const owner = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", ownerEmail)).first();
    if (!owner) throw new ConvexError("Owner not found");
    let lab = (await ctx.db.query("labs").collect()).find((l) => l.name === name);
    const labId = lab?._id ?? (await ctx.db.insert("labs", { name, pi_user_id: owner._id, created_at: Date.now() }));
    let moved = 0;
    for (const u of await ctx.db.query("users").collect()) {
      if (!u.home_lab_id) { await ctx.db.patch(u._id, { home_lab_id: labId }); moved++; }
    }
    return { labId, peopleMoved: moved };
  },
});

export const backfill = internalMutation({
  args: { table: v.string(), labId: v.id("labs") },
  handler: async (ctx, { table, labId }) => {
    if (!(LAB_TABLES as readonly string[]).includes(table)) throw new ConvexError("Not a lab table");
    const rows = await (ctx.db as any).query(table).filter((q: any) => q.eq(q.field("lab_id"), undefined)).take(500);
    for (const r of rows) await ctx.db.patch(r._id, { lab_id: labId } as any);
    return { table, updated: rows.length, left: rows.length === 500 ? "maybe more" : 0 };
  },
});

/** How many rows in each lab table still have no lab. */
export const audit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: Record<string, number> = {};
    for (const t of LAB_TABLES) {
      const n = (await (ctx.db as any).query(t).filter((q: any) => q.eq(q.field("lab_id"), undefined)).take(1000)).length;
      if (n) out[t] = n;
    }
    const users = (await ctx.db.query("users").collect()).filter((u) => !u.home_lab_id).length;
    if (users) out.users = users;
    return Object.keys(out).length ? out : "all rows belong to a lab";
  },
});
