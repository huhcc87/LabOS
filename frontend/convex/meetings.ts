import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

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
    const numItems = args.paginationOpts?.numItems ?? 20;

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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const now = Date.now();
    return await ctx.db.insert("meetings", {
      title: args.title,
      meeting_type: args.meeting_type,
      status: "scheduled",
      scheduled_at: args.scheduled_at,
      duration_minutes: args.duration_minutes,
      location: args.location,
      agenda: args.agenda,
      organizer_id: userId,
      attendees: args.attendees,
      recording_url: args.recording_url,
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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    const { id, token: _token, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Meeting not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
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
    if (!existing) throw new Error("Meeting not found");

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
    if (!existing) throw new Error("Meeting not found");

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
    if (!existing) throw new Error("Meeting not found");

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
