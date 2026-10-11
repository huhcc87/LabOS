/**
 * Reports & Analytics: one read for every chart, plus saved report setups
 * ("Generate" downloads an Excel file with the chosen data).
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { requireAuth, requireRole } from "./authHelper";

const MAX_ROWS = 5000;
const day = (ms?: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

/** Everything the charts need, in one call. Users are names only (no emails). */
export const data = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const [tasks, users, instruments, bookings, incidents, compliance, training] = await Promise.all([
      ctx.db.query("tasks").order("desc").take(MAX_ROWS),
      ctx.db.query("users").take(500),
      ctx.db.query("instruments").take(MAX_ROWS),
      ctx.db.query("bookings").order("desc").take(MAX_ROWS),
      ctx.db.query("incidents").order("desc").take(MAX_ROWS),
      ctx.db.query("compliance").take(MAX_ROWS),
      ctx.db.query("training").take(MAX_ROWS),
    ]);
    const names = new Map(users.map((u) => [u._id as string, u.full_name]));
    return {
      tasks: tasks.map((t) => ({
        id: t._id as string, title: t.title, status: t.status, priority: t.priority ?? "medium",
        assigned_to: (t.assigned_to as string | undefined) ?? null,
        assignee_name: t.assigned_to ? names.get(t.assigned_to) ?? null : null,
        due_date: day(t.due_date), completed_at: day(t.completed_at), created_at: t.created_at,
      })),
      users: users.filter((u) => u.is_active).map((u) => ({ id: u._id as string, full_name: u.full_name, role: u.role })),
      instruments: instruments.map((i) => ({
        id: i._id as string, name: i.name, model: i.model ?? "", location: i.location ?? "", status: i.status,
        last_calibrated: day(i.last_calibrated), next_calibration: i.next_calibration ?? null,
      })),
      bookings: bookings.map((b) => ({ instrument_id: b.instrument_id as string, start: b.start_time, end: b.end_time, status: b.status })),
      incidents: incidents.map((i) => ({
        title: i.title, severity: i.severity, status: i.status, occurred_at: i.occurred_at ?? i.created_at,
        resolved: day(i.resolved_at),
      })),
      compliance: compliance.map((c) => ({
        title: c.title, regulation: c.regulation ?? "Other", status: c.status, due_date: c.due_date ?? null, completed: !!c.completed_at || c.status === "completed",
      })),
      training: training.map((t) => ({ status: t.status, expires_at: t.expires_at ?? null })),
    };
  },
});

// ── Saved report setups ───────────────────────────────────────────────────

const fields = {
  name: v.string(),
  description: v.optional(v.string()),
  type: v.string(),
  schedule: v.string(),
  sources: v.array(v.string()),
  enabled: v.boolean(),
};

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.db.query("report_configs").order("desc").take(200);
  },
});

export const create = mutation({
  args: { token: v.optional(v.string()), ...fields },
  handler: async (ctx, { token, ...rest }) => {
    const user = await requireRole(ctx, token, "staff");
    if (!rest.name.trim()) throw new ConvexError("Give the report a name");
    return await ctx.db.insert("report_configs", { ...rest, name: rest.name.trim(), created_by: user._id, created_at: Date.now() });
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()), id: v.id("report_configs"),
    description: v.optional(v.string()), schedule: v.optional(v.string()), sources: v.optional(v.array(v.string())),
    enabled: v.optional(v.boolean()), recipients: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...rest }) => {
    await requireRole(ctx, token, "staff");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val;
    await ctx.db.patch(id, patch);
  },
});

export const markGenerated = mutation({
  args: { token: v.optional(v.string()), id: v.id("report_configs") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.patch(id, { last_generated: Date.now() });
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("report_configs") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "staff");
    await ctx.db.delete(id);
  },
});
