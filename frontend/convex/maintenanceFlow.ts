/**
 * Instrument problems. Anyone reports one (pick the instrument, write a note); every PI and admin in the
 * lab is notified. A report that says "not working" switches the instrument to "maintenance", which the
 * whole app respects (it can't be booked) until a PI/admin marks the repair completed.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
const { requireAuth } = hubGuard("Lab Hub");

const HANDLERS = ["pi", "admin", "superadmin"];
const TYPES = ["repair", "service", "calibration"];
const OPEN = ["reported", "in_progress"];

async function notifyUsers(ctx: MutationCtx, ids: Id<"users">[], title: string, message: string, entityId: string) {
  const now = Date.now();
  for (const user_id of new Set(ids)) {
    await ctx.db.insert("notifications", { user_id, channel: "in_app", is_read: false, entity_type: "maintenance", entity_id: entityId, created_at: now, title, message });
  }
}

/** Put an instrument back to "active" unless another open report (not `exceptId`) still says it isn't working. */
async function backInService(ctx: MutationCtx, instrumentId: Id<"instruments">, exceptId: Id<"maintenance">) {
  const others = (await ctx.db.query("maintenance").withIndex("by_instrument", (q) => q.eq("instrument_id", instrumentId)).collect())
    .filter((o) => o._id !== exceptId && OPEN.includes(o.status) && o.not_working);
  const inst = await ctx.db.get(instrumentId);
  if (inst && inst.status === "maintenance" && !others.length) await ctx.db.patch(inst._id, { status: "active", updated_at: Date.now() });
}

/** Everything the screen needs: instruments for the dropdown, and all reports with who/where/when. */
export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const instruments = (await ctx.db.query("instruments").collect()).filter((i) => i.status !== "retired");
    const byId = new Map(instruments.map((i) => [i._id as string, i]));
    const names = new Map<string, string>();
    const name = async (id?: Id<"users">) => {
      if (!id) return undefined;
      if (!names.has(id)) names.set(id, (await ctx.db.get(id))?.full_name ?? "Unknown");
      return names.get(id);
    };
    const rows = (await ctx.db.query("maintenance").order("desc").collect()).filter((m) => m.reported_by);
    const issues = [];
    for (const m of rows) {
      const inst = m.instrument_id ? byId.get(m.instrument_id) ?? (await ctx.db.get(m.instrument_id)) : null;
      issues.push({
        ...m,
        instrument_name: inst?.name ?? "(removed instrument)",
        location: inst?.location,
        reporter: await name(m.reported_by),
        handler: await name(m.handled_by),
        can_delete: m.reported_by === userId || HANDLERS.includes(me.role),
      });
    }
    return {
      instruments: instruments.map((i) => ({ _id: i._id, name: i.name, location: i.location, status: i.status })),
      issues,
      can_handle: HANDLERS.includes(me.role),
      open: issues.filter((i) => OPEN.includes(i.status)).length,
    };
  },
});

/** Report a problem or ask for service. Notifies the lab's PIs and admins. */
export const report = mutation({
  args: {
    token: v.optional(v.string()),
    instrument_id: v.id("instruments"),
    maintenance_type: v.string(),
    note: v.string(),
    not_working: v.boolean(),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const inst = await ctx.db.get(a.instrument_id);
    if (!inst) throw new ConvexError("Instrument not found.");
    if (!TYPES.includes(a.maintenance_type)) throw new ConvexError("Choose repair, service or calibration.");
    const note = a.note.trim();
    if (!note) throw new ConvexError("Write a short note about the problem.");
    const me = (await ctx.db.get(userId))!;
    const now = Date.now();
    const id = await ctx.db.insert("maintenance", {
      instrument_id: a.instrument_id,
      maintenance_type: a.maintenance_type,
      status: "reported",
      notes: note.slice(0, 1000),
      reported_by: userId,
      not_working: a.not_working || undefined,
      scheduled_date: now,
      created_at: now,
    });
    if (a.not_working && inst.status !== "maintenance") await ctx.db.patch(inst._id, { status: "maintenance", updated_at: now });

    const people = await ctx.db.query("users").collect(); // the lab-scoped db only returns this lab's people
    const to = people.filter((u) => u.is_active && HANDLERS.includes(u.role) && u._id !== userId).map((u) => u._id);
    await notifyUsers(ctx, to, `${a.not_working ? "Not working" : "Needs " + a.maintenance_type}: ${inst.name}`,
      [`Instrument: ${inst.name}`, inst.location && `Where: ${inst.location}`, `Reported by: ${me.full_name}`, `Type: ${a.maintenance_type}`, `Note: ${note.slice(0, 300)}`].filter(Boolean).join(" · "), id);
    return id;
  },
});

/** PI/admin: start the repair or mark it done. Done puts the instrument back in service. */
export const setStatus = mutation({
  args: { token: v.optional(v.string()), id: v.id("maintenance"), status: v.union(v.literal("in_progress"), v.literal("completed")), note: v.optional(v.string()) },
  handler: async (ctx, { token, id, status, note }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    if (!hasRole(me.role, "pi")) throw new ConvexError("Only a PI or admin can update repairs.");
    const m = await ctx.db.get(id);
    if (!m) throw new ConvexError("Report not found.");
    const now = Date.now();
    await ctx.db.patch(id, {
      status, handled_by: userId, resolution_note: note?.trim().slice(0, 500) || m.resolution_note,
      ...(status === "completed" ? { completed_date: now } : {}),
    });
    if (status === "completed" && m.instrument_id) await backInService(ctx, m.instrument_id, id);
    if (m.reported_by && m.reported_by !== userId) {
      const inst = m.instrument_id ? await ctx.db.get(m.instrument_id) : null;
      await notifyUsers(ctx, [m.reported_by], `${inst?.name ?? "Instrument"}: ${status === "completed" ? "repair completed" : "repair started"}`,
        [`By: ${me.full_name}`, note?.trim() && `Note: ${note.trim().slice(0, 300)}`].filter(Boolean).join(" · ") || "Status updated.", id);
    }
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("maintenance") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const m = await ctx.db.get(id);
    if (!m) throw new ConvexError("Report not found.");
    if (m.reported_by !== userId && !HANDLERS.includes(me.role)) throw new ConvexError("Only the reporter or a PI/admin can delete this.");
    await ctx.db.delete(id);
    if (m.not_working && OPEN.includes(m.status) && m.instrument_id) await backInService(ctx, m.instrument_id, id);
  },
});
