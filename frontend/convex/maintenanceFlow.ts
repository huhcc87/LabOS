/**
 * Instrument problems. Anyone reports one (instrument, category, priority, impact, note); every PI and admin
 * in the lab is notified. A PI/admin then moves it along: planned -> sent out for repair / being repaired /
 * waiting for parts -> fixed (or retired). "Not working" reports switch the instrument to "maintenance",
 * which the whole app respects (it can't be booked) until the repair is fixed.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
const { requireAuth } = hubGuard("Lab Hub");

const HANDLERS = ["pi", "admin", "superadmin"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const IMPACTS = ["not_working", "partly_working", "still_usable"];
/** Statuses a PI/admin can set. */
const STATUSES = ["planned", "sent_out", "in_progress", "waiting_parts", "completed", "retired"] as const;
const OPEN = ["reported", "planned", "sent_out", "in_progress", "waiting_parts"];

const LABEL: Record<string, string> = {
  planned: "Repair planned", sent_out: "Sent out for repair / service", in_progress: "Being repaired in the lab",
  waiting_parts: "Waiting for parts", completed: "Fixed", retired: "Cannot be repaired: retired",
};

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
    category: v.string(),
    priority: v.string(),
    impact: v.string(),
    error_code: v.optional(v.string()),
    note: v.string(),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const inst = await ctx.db.get(a.instrument_id);
    if (!inst) throw new ConvexError("Instrument not found.");
    // Type and kind of problem may be typed in by the reporter ("Other"); priority and state are fixed choices.
    const custom = (s: string) => s.trim().length > 0 && s.trim().length <= 60;
    if (!custom(a.maintenance_type) || !custom(a.category) || !PRIORITIES.includes(a.priority) || !IMPACTS.includes(a.impact)) {
      throw new ConvexError("Check the choices in the form.");
    }
    const note = a.note.trim();
    if (!note) throw new ConvexError("Write a short note about the problem.");
    const me = (await ctx.db.get(userId))!;
    const now = Date.now();
    const notWorking = a.impact === "not_working";
    const id = await ctx.db.insert("maintenance", {
      instrument_id: a.instrument_id,
      maintenance_type: a.maintenance_type,
      status: "reported",
      notes: note.slice(0, 1000),
      category: a.category, priority: a.priority, impact: a.impact,
      error_code: a.error_code?.trim().slice(0, 60) || undefined,
      reported_by: userId,
      not_working: notWorking || undefined,
      scheduled_date: now,
      updates: [{ at: now, by: me.full_name, status: "reported", note: note.slice(0, 300) }],
      created_at: now,
    });
    if (notWorking && inst.status !== "maintenance") await ctx.db.patch(inst._id, { status: "maintenance", updated_at: now });

    const people = await ctx.db.query("users").collect(); // the lab-scoped db only returns this lab's people
    const to = people.filter((u) => u.is_active && HANDLERS.includes(u.role) && u._id !== userId).map((u) => u._id);
    const tag = a.priority === "urgent" ? "URGENT: " : a.priority === "high" ? "High priority: " : "";
    await notifyUsers(ctx, to, `${tag}${notWorking ? "Not working" : "Needs " + a.maintenance_type.replace(/_/g, " ")}: ${inst.name}`,
      [`Instrument: ${inst.name}`, inst.location && `Where: ${inst.location}`, `Reported by: ${me.full_name}`, `Type: ${a.maintenance_type}`, `Problem: ${a.category.replace(/_/g, " ")}`,
        `Priority: ${a.priority}`, `Impact: ${a.impact.replace(/_/g, " ")}`, a.error_code?.trim() && `Error: ${a.error_code.trim()}`, `Note: ${note.slice(0, 300)}`].filter(Boolean).join(" · "), id);
    return id;
  },
});

/** PI/admin: plan the repair, send it out, mark waiting for parts, fixed, or retired. Every change is logged and the reporter notified. */
export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("maintenance"),
    status: v.string(),
    note: v.optional(v.string()),
    vendor: v.optional(v.string()),
    expected_date: v.optional(v.number()),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const me = (await ctx.db.get(userId))!;
    if (!hasRole(me.role, "pi")) throw new ConvexError("Only a PI or admin can update repairs.");
    if (!(STATUSES as readonly string[]).includes(a.status)) throw new ConvexError("Unknown status.");
    if (a.cost !== undefined && (!Number.isFinite(a.cost) || a.cost < 0)) throw new ConvexError("Cost can't be negative.");
    const m = await ctx.db.get(a.id);
    if (!m) throw new ConvexError("Report not found.");
    if (m.status === "completed" || m.status === "retired") throw new ConvexError("This report is already closed.");
    const now = Date.now();
    const note = a.note?.trim().slice(0, 500) || undefined;
    const closing = a.status === "completed" || a.status === "retired";
    await ctx.db.patch(a.id, {
      status: a.status,
      handled_by: userId,
      vendor: a.vendor?.trim().slice(0, 100) || m.vendor,
      expected_date: a.expected_date ?? m.expected_date,
      cost: a.cost ?? m.cost,
      resolution_note: closing ? note ?? m.resolution_note : m.resolution_note,
      ...(closing ? { completed_date: now } : {}),
      updates: [...(m.updates ?? []), { at: now, by: me.full_name, status: a.status, note }],
    });
    if (m.instrument_id) {
      if (a.status === "completed") await backInService(ctx, m.instrument_id, a.id);
      if (a.status === "retired") await ctx.db.patch(m.instrument_id, { status: "retired", updated_at: now });
      // Planned / sent out / waiting parts on a "not working" report keeps it out of service.
      if (!closing && m.not_working) {
        const inst = await ctx.db.get(m.instrument_id);
        if (inst && inst.status !== "maintenance") await ctx.db.patch(inst._id, { status: "maintenance", updated_at: now });
      }
    }
    if (m.reported_by && m.reported_by !== userId) {
      const inst = m.instrument_id ? await ctx.db.get(m.instrument_id) : null;
      await notifyUsers(ctx, [m.reported_by], `${inst?.name ?? "Instrument"}: ${LABEL[a.status]}`,
        [`By: ${me.full_name}`, a.vendor?.trim() && `Vendor: ${a.vendor.trim()}`, a.expected_date && "Expected back: see Maintenance", note && `Note: ${note.slice(0, 300)}`].filter(Boolean).join(" · ") || "Status updated.", a.id);
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
