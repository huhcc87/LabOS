/**
 * Pick an instrument and book it on one screen. Checks clashes, confirms on the spot, and can remind
 * the person who booked every 2 days until their slot starts.
 */
import { query, mutation } from "./tenant";
import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
const { requireAuth } = hubGuard("Lab Hub");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_LEN = 12 * HOUR;
/** Instruments in these states can't be booked. */
const NOT_BOOKABLE = ["maintenance", "out_of_service", "retired", "offline"];

export const REMINDER_EVERY_MS = 2 * DAY;
const days = (ms: number) => { const d = Math.ceil(ms / DAY); return d <= 1 ? "within the next day" : `in about ${d} days`; };

/** Instruments with their upcoming bookings (who has it, when). */
export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const instruments = (await ctx.db.query("instruments").collect()).filter((i) => i.status !== "retired");
    const now = Date.now();
    const upcoming = (await ctx.db.query("bookings").withIndex("by_start", (q) => q.gte("start_time", now - MAX_LEN)).collect())
      .filter((b) => b.status !== "cancelled" && b.end_time > now);
    const names = new Map<string, string>();
    const bookings = [];
    for (const b of upcoming.sort((a, c) => a.start_time - c.start_time)) {
      if (!names.has(b.user_id)) names.set(b.user_id, (await ctx.db.get(b.user_id))?.full_name ?? "Unknown");
      bookings.push({ ...b, user_name: names.get(b.user_id)!, mine: b.user_id === userId, can_cancel: b.user_id === userId || hasRole(me.role, "manager") });
    }
    return {
      instruments: instruments.map((i) => ({ ...i, bookable: !NOT_BOOKABLE.includes(i.status) })),
      bookings,
      can_add_instrument: hasRole(me.role, "manager"),
    };
  },
});

/** Book a slot. Fails with a clear message if it clashes. Returns what to show as confirmation. */
export const book = mutation({
  args: {
    token: v.optional(v.string()),
    instrument_id: v.id("instruments"),
    start_time: v.number(),
    end_time: v.number(),
    purpose: v.optional(v.string()),
    remind_every_2_days: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const inst = await ctx.db.get(a.instrument_id);
    if (!inst) throw new ConvexError("Instrument not found.");
    if (NOT_BOOKABLE.includes(inst.status)) throw new ConvexError(`${inst.name} can't be booked right now (${inst.status.replace(/_/g, " ")}).`);
    if (!Number.isFinite(a.start_time) || !Number.isFinite(a.end_time)) throw new ConvexError("Choose a start and end time.");
    if (a.end_time <= a.start_time) throw new ConvexError("The end must be after the start.");
    if (a.end_time - a.start_time > MAX_LEN) throw new ConvexError("A booking can be 12 hours at most.");
    if (a.start_time < Date.now() - 5 * 60_000) throw new ConvexError("That time is in the past.");

    const clash = (await ctx.db.query("bookings").withIndex("by_instrument", (q) => q.eq("instrument_id", a.instrument_id)).collect())
      .find((b) => b.status !== "cancelled" && b.start_time < a.end_time && b.end_time > a.start_time);
    if (clash) {
      const who = (await ctx.db.get(clash.user_id))?.full_name ?? "someone";
      throw new ConvexError(`${inst.name} is already booked by ${who} during part of that time. Pick a free slot (see "Already booked").`);
    }
    const now = Date.now();
    const id = await ctx.db.insert("bookings", {
      instrument_id: a.instrument_id,
      user_id: userId,
      start_time: a.start_time,
      end_time: a.end_time,
      purpose: a.purpose?.trim().slice(0, 300) || undefined,
      status: "confirmed",
      remind_every_2_days: a.remind_every_2_days ? true : undefined,
      last_reminded_at: a.remind_every_2_days ? now : undefined,
      created_at: now,
    });
    return { id, instrument: inst.name, location: inst.location, start_time: a.start_time, end_time: a.end_time, reminders: !!a.remind_every_2_days };
  },
});

export const cancel = mutation({
  args: { token: v.optional(v.string()), id: v.id("bookings") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError("Booking not found.");
    if (b.user_id !== userId && !hasRole(me.role, "manager")) throw new ConvexError("You can only cancel your own bookings.");
    await ctx.db.patch(id, { status: "cancelled" });
  },
});

/** Turn the 2-day reminder on or off for one of your bookings. */
export const setReminder = mutation({
  args: { token: v.optional(v.string()), id: v.id("bookings"), on: v.boolean() },
  handler: async (ctx, { token, id, on }) => {
    const userId = await requireAuth(ctx, token);
    const b = await ctx.db.get(id);
    if (!b || b.user_id !== userId) throw new ConvexError("Booking not found.");
    await ctx.db.patch(id, { remind_every_2_days: on || undefined, last_reminded_at: on ? Date.now() : undefined });
  },
});

/** Hourly: remind whoever booked, every 2 days, until the booking starts. */
export const sendReminders = internalMutation({
  args: { every_ms: v.optional(v.number()) }, // only for testing; the schedule uses the 2-day default
  handler: async (ctx, { every_ms }) => {
    const now = Date.now();
    const gap = every_ms ?? REMINDER_EVERY_MS;
    const upcoming = await ctx.db.query("bookings").withIndex("by_start", (q) => q.gt("start_time", now)).take(1000);
    for (const b of upcoming) {
      if (b.status === "cancelled" || !b.remind_every_2_days) continue;
      if (now - (b.last_reminded_at ?? b.created_at) < gap) continue;
      const inst = await ctx.db.get(b.instrument_id);
      await ctx.db.insert("notifications", {
        lab_id: b.lab_id, user_id: b.user_id, channel: "in_app", is_read: false, entity_type: "booking", entity_id: b._id, created_at: now,
        title: `Reminder: ${inst?.name ?? "instrument"} booking`,
        // The server has no time zone for the user, so say "in N days" and let My bookings show the clock time.
        message: `You booked ${inst?.name ?? "an instrument"} ${days(b.start_time - now)}${b.purpose ? ` for "${b.purpose}"` : ""}. See My bookings in Lab Hub.`,
      });
      await ctx.db.patch(b._id, { last_reminded_at: now });
    }
  },
});
