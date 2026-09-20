import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── Calendar Events ──────────────────────────────────────────────────────────

export const listCalendar = query({
  args: {
    start_from: v.optional(v.number()),
    start_to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("calendar_events")
      .withIndex("by_start")
      .order("asc")
      .collect();

    if (args.start_from !== undefined) {
      results = results.filter((e) => e.start_time >= args.start_from!);
    }
    if (args.start_to !== undefined) {
      results = results.filter((e) => e.start_time <= args.start_to!);
    }

    return results;
  },
});

export const createCalendarEvent = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    start_time: v.number(),
    end_time: v.number(),
    event_type: v.optional(v.string()),
    location: v.optional(v.string()),
    attendees: v.optional(v.string()),
    recurrence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    return await ctx.db.insert("calendar_events", {
      title: args.title,
      description: args.description,
      start_time: args.start_time,
      end_time: args.end_time,
      event_type: args.event_type,
      location: args.location,
      created_by: userId,
      attendees: args.attendees,
      recurrence: args.recurrence,
      created_at: Date.now(),
    });
  },
});

export const updateCalendarEvent = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("calendar_events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    start_time: v.optional(v.number()),
    end_time: v.optional(v.number()),
    event_type: v.optional(v.string()),
    location: v.optional(v.string()),
    attendees: v.optional(v.string()),
    recurrence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const { id, token: _token, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Calendar event not found");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const deleteCalendarEvent = mutation({
  args: { token: v.optional(v.string()), id: v.id("calendar_events") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Calendar event not found");

    await ctx.db.delete(id);
    return id;
  },
});

// ── Reminders ────────────────────────────────────────────────────────────────

export const listReminders = query({
  args: {
    token: v.optional(v.string()),
    status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, { token, status, paginationOpts }) => {
    const userId = await requireAuth(ctx, token);

    const numItems = paginationOpts?.numItems ?? 20;

    let results;
    if (status) {
      results = await ctx.db
        .query("reminders")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("asc")
        .take(numItems + 1);
    } else {
      results = await ctx.db
        .query("reminders")
        .withIndex("by_user", (q) => q.eq("user_id", userId))
        .order("asc")
        .take(numItems + 1);
    }

    const hasMore = results.length > numItems;
    const page = hasMore ? results.slice(0, numItems) : results;

    return { page, hasMore };
  },
});

export const createReminder = mutation({
  args: {
    token: v.optional(v.string()),
    entity_type: v.string(),
    entity_id: v.string(),
    message: v.string(),
    due_at: v.number(),
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    return await ctx.db.insert("reminders", {
      entity_type: args.entity_type,
      entity_id: args.entity_id,
      message: args.message,
      due_at: args.due_at,
      channel: args.channel,
      status: "pending",
      user_id: userId,
      created_at: Date.now(),
    });
  },
});

export const updateReminder = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("reminders"),
    message: v.optional(v.string()),
    due_at: v.optional(v.number()),
    channel: v.optional(v.string()),
    status: v.optional(v.string()),
    sent_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const { id, token: _token, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Reminder not found");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const deleteReminder = mutation({
  args: { token: v.optional(v.string()), id: v.id("reminders") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Reminder not found");

    await ctx.db.delete(id);
    return id;
  },
});

export const reminderStats = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);

    const now = Date.now();

    const pendingReminders = await ctx.db
      .query("reminders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const userPending = pendingReminders.filter((r) => r.user_id === userId);

    const pending = userPending.filter((r) => r.due_at >= now).length;
    const overdue = userPending.filter((r) => r.due_at < now).length;

    return { pending, overdue };
  },
});
