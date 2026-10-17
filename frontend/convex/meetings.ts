import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
// Students only reach this module if their PI allowed this hub.
const { requireAuth } = hubGuard("Resources");

/** Extra optional fields the Lab Meetings page stores on a meeting (lists are JSON text). */
const extraArgs = {
  end_time: v.optional(v.number()),
  description: v.optional(v.string()),
  video_link: v.optional(v.string()),
  is_recurring: v.optional(v.boolean()),
  recurring_pattern: v.optional(v.string()),
  tags: v.optional(v.string()),
  minutes_published: v.optional(v.boolean()),
  minutes_published_at: v.optional(v.number()),
  action_items: v.optional(v.string()),
  progress_reports: v.optional(v.string()),
  reminders: v.optional(v.string()),
};

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    meeting_type: v.optional(v.string()),
    status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 500;

    let results = await ctx.db
      .query("meetings")
      .withIndex("by_scheduled")
      .order("desc")
      .collect();

    if (args.meeting_type) {
      results = results.filter((m) => m.meeting_type === args.meeting_type);
    }
    if (args.status) {
      results = results.filter((m) => m.status === args.status);
    }
    if (args.search) {
      const term = args.search.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(term) ||
          (m.agenda ?? "").toLowerCase().includes(term)
      );
    }

    const hasMore = results.length > numItems;
    const page = hasMore ? results.slice(0, numItems) : results;

    return { page, hasMore };
  },
});

export const get = query({
  args: { id: v.id("meetings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    meeting_type: v.string(),
    scheduled_at: v.number(),
    duration_minutes: v.optional(v.number()),
    location: v.optional(v.string()),
    agenda: v.optional(v.string()),
    attendees: v.optional(v.string()),
    recording_url: v.optional(v.string()),
    ...extraArgs,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    const organizer = await ctx.db.get(userId);

    const now = Date.now();
    const { token: _token, ...fields } = args;
    return await ctx.db.insert("meetings", {
      ...fields,
      status: "scheduled",
      organizer_id: userId,
      organizer_name: (organizer as any)?.full_name,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("meetings"),
    title: v.optional(v.string()),
    meeting_type: v.optional(v.string()),
    status: v.optional(v.string()),
    scheduled_at: v.optional(v.number()),
    duration_minutes: v.optional(v.number()),
    location: v.optional(v.string()),
    agenda: v.optional(v.string()),
    minutes: v.optional(v.string()),
    attendees: v.optional(v.string()),
    recording_url: v.optional(v.string()),
    ...extraArgs,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const { id, token: _token, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("Meeting not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    // A new time or new reminder choices mean reminders should fire again.
    if ((fields.scheduled_at !== undefined && fields.scheduled_at !== existing.scheduled_at) || (fields.reminders !== undefined && fields.reminders !== existing.reminders)) {
      patch.reminders_sent = "[]";
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("meetings") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("Meeting not found");

    await ctx.db.delete(id);
    return id;
  },
});

export const upcoming = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = await ctx.db
      .query("meetings")
      .withIndex("by_scheduled")
      .order("asc")
      .collect();

    return results
      .filter((m) => m.scheduled_at > now && m.status !== "cancelled")
      .slice(0, 10);
  },
});

export const past = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = await ctx.db
      .query("meetings")
      .withIndex("by_scheduled")
      .order("desc")
      .collect();

    return results.filter((m) => m.scheduled_at <= now).slice(0, 20);
  },
});

export const cancel = mutation({
  args: { token: v.optional(v.string()), id: v.id("meetings") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("Meeting not found");

    await ctx.db.patch(id, {
      status: "cancelled",
      updated_at: Date.now(),
    });
    return id;
  },
});

export const complete = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("meetings"),
    minutes: v.optional(v.string()),
    recording_url: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, minutes, recording_url }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("Meeting not found");

    await ctx.db.patch(id, {
      status: "completed",
      updated_at: Date.now(),
      ...(minutes !== undefined && { minutes: minutes }),
      ...(recording_url !== undefined && {
        recording_url: recording_url,
      }),
    });
    return id;
  },
});

// ── Reminders ─────────────────────────────────────────────────────────────

const DEFAULT_REMINDERS = [1440, 60]; // a day and an hour before
const parseNums = (raw?: string): number[] => {
  try { const v = JSON.parse(raw ?? ""); return Array.isArray(v) ? v.filter((n) => typeof n === "number") : []; } catch { return []; }
};
const parseList = (raw?: string): any[] => {
  try { const v = JSON.parse(raw ?? ""); return Array.isArray(v) ? v : []; } catch { return []; }
};
const sameName = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function inWords(mins: number): string {
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;
  if (mins < 2880) { const h = Math.round(mins / 60); return `in ${h} hour${h === 1 ? "" : "s"}`; }
  const d = Math.round(mins / 1440);
  return `in ${d} days`;
}

/** Lab members who should hear about a meeting: its organizer and named attendees (everyone if none are named). */
async function recipients(ctx: MutationCtx, m: Doc<"meetings">): Promise<Doc<"users">[]> {
  const labUsers = m.lab_id
    ? await ctx.db.query("users").withIndex("by_home_lab", (q) => q.eq("home_lab_id", m.lab_id)).collect()
    : [];
  const names = parseList(m.attendees).map((a) => a?.name as string);
  return labUsers.filter((u) => u.is_active && (names.length === 0 || u._id === m.organizer_id || names.some((n) => sameName(n, u.full_name))));
}

async function notify(ctx: MutationCtx, users: Doc<"users">[], labId: Doc<"meetings">["lab_id"], title: string, message: string, entityId: string) {
  const now = Date.now();
  for (const u of users) {
    await ctx.db.insert("notifications", {
      lab_id: labId, user_id: u._id, title, message, channel: "in_app", is_read: false,
      entity_type: "meeting", entity_id: entityId, created_at: now,
    });
  }
  return users.length;
}

/** Organizer or PI sends the reminder right now. */
export const remindNow = mutation({
  args: { token: v.optional(v.string()), id: v.id("meetings") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    const m = await ctx.db.get(id);
    if (!m) throw new ConvexError("Meeting not found");
    const mins = Math.round((m.scheduled_at - Date.now()) / 60000);
    const where = m.location ? ` · ${m.location}` : "";
    const sent = await notify(ctx, await recipients(ctx, m), m.lab_id, `Reminder: ${m.title}`, `Starts ${inWords(mins)}${where}`, id);
    return { sent };
  },
});

/** Every 5 minutes: meeting reminders at the chosen offsets, and action items that are due soon or late. */
export const sendReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const meetings = await ctx.db.query("meetings").withIndex("by_scheduled").order("desc").take(500);
    for (const m of meetings) {
      if (m.status === "cancelled") continue;
      const patch: Record<string, unknown> = {};

      if (m.status === "scheduled" && m.scheduled_at > now) {
        const sent = parseNums(m.reminders_sent);
        const offsets = m.reminders !== undefined ? parseNums(m.reminders) : DEFAULT_REMINDERS;
        const due = offsets.filter((o) => !sent.includes(o) && m.scheduled_at - o * 60000 <= now);
        if (due.length) {
          const mins = Math.round((m.scheduled_at - now) / 60000);
          const where = m.location ? ` · ${m.location}` : "";
          await notify(ctx, await recipients(ctx, m), m.lab_id, `Reminder: ${m.title}`, `Starts ${inWords(mins)}${where}`, m._id);
          patch.reminders_sent = JSON.stringify([...sent, ...due]);
        }
      }

      const items = parseList(m.action_items);
      let changed = false;
      for (const it of items) {
        if (it.reminded || it.status === "completed" || it.status === "cancelled" || !it.dueDate) continue;
        const dueAt = Date.parse(it.dueDate);
        if (Number.isNaN(dueAt) || dueAt - now > 86400000) continue;
        const labUsers = m.lab_id ? await ctx.db.query("users").withIndex("by_home_lab", (q) => q.eq("home_lab_id", m.lab_id)).collect() : [];
        const who = labUsers.filter((u) => u.is_active && (sameName(it.assignedToName, u.full_name) || sameName(it.assignedTo, u.full_name)));
        const late = dueAt < now;
        await notify(ctx, who, m.lab_id, late ? `Overdue: ${it.title}` : `Due soon: ${it.title}`, `${late ? "Was due" : "Due"} ${new Date(dueAt).toDateString()} · from "${m.title}"`, m._id);
        it.reminded = true;
        changed = true;
      }
      if (changed) patch.action_items = JSON.stringify(items);

      if (Object.keys(patch).length) await ctx.db.patch(m._id, patch);
    }
  },
});
