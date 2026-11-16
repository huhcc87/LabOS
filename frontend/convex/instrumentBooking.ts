/**
 * Pick an instrument and book it on one screen. Checks clashes, confirms on the spot, and can remind
 * the person who booked every 2 days until their slot starts.
 */
import { query, mutation } from "./tenant";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
const { requireAuth } = hubGuard("Lab Hub");

/** Working hours bookable without approval: minutes after local midnight (08:00 to 18:00 unless an admin sets others). */
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;
const dupKey = (i: { name: string; location?: string }) => `${i.name.trim().toLowerCase()}|${(i.location ?? "").trim().toLowerCase()}`;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_LEN = 7 * DAY;
/** Instruments in these states can't be booked. */
const NOT_BOOKABLE = ["not_used", "maintenance", "out_of_service", "retired", "offline"];
/** A booking in these states no longer holds its time slot; every other booking blocks it. */
const FREE = ["cancelled", "completed"];

export const REMINDER_EVERY_MS = 2 * DAY;
/** All the booking details in one line, for notifications. */
const detailLine = (
  b: { room?: string; lab_name?: string; person_name?: string; when_text?: string; purpose?: string; start_time: number },
  inst: { name: string; location?: string } | null,
  now: number,
) => [
  `Instrument: ${inst?.name ?? "instrument"}`,
  (b.room || inst?.location) && `Room: ${b.room ?? inst?.location}`,
  b.lab_name && `Lab: ${b.lab_name}`,
  b.person_name && `Booked by: ${b.person_name}`,
  `When: ${b.when_text ?? days(b.start_time - now)}`,
  b.purpose && `For: ${b.purpose}`,
].filter(Boolean).join(" · ");

const days = (ms: number) => { const d = Math.ceil(ms / DAY); return d <= 1 ? "within the next day" : `in about ${d} days`; };

/** Instruments with their upcoming bookings (who has it, when). */
export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const labId = me.role === "superadmin" ? me.active_lab_id ?? me.home_lab_id : me.home_lab_id;
    const lab = labId ? await ctx.db.get(labId) : null;
    // One entry per instrument: the same name in the same room is shown once (the oldest record wins), A to Z.
    const all = (await ctx.db.query("instruments").collect()).filter((i) => i.status !== "retired").sort((a, c) => a.created_at - c.created_at);
    const canon = new Map<string, Id<"instruments">>(); // duplicate id -> the one shown
    const firstByKey = new Map<string, Id<"instruments">>();
    const instruments = all.filter((i) => {
      const k = dupKey(i);
      const first = firstByKey.get(k);
      canon.set(i._id, first ?? i._id);
      if (first) return false;
      firstByKey.set(k, i._id);
      return true;
    }).sort((a, c) => a.name.localeCompare(c.name, undefined, { sensitivity: "base", numeric: true }));
    const now = Date.now();
    const manager = hasRole(me.role, "manager");
    const upcoming = (await ctx.db.query("bookings").withIndex("by_start", (q) => q.gte("start_time", now - MAX_LEN)).collect())
      .filter((b) => !FREE.includes(b.status) && b.end_time > now);
    const names = new Map<string, string>();
    const bookings = [];
    for (const b of upcoming.sort((a, c) => a.start_time - c.start_time)) {
      if (!names.has(b.user_id)) names.set(b.user_id, (await ctx.db.get(b.user_id))?.full_name ?? "Unknown");
      bookings.push({
        ...b, instrument_id: canon.get(b.instrument_id) ?? b.instrument_id, user_name: names.get(b.user_id)!, mine: b.user_id === userId,
        can_cancel: b.user_id === userId || manager, can_decide: manager && b.status === "pending_approval",
      });
    }
    return {
      instruments: instruments.map((i) => ({ ...i, bookable: !NOT_BOOKABLE.includes(i.status), work_start_min: i.work_start_min ?? DEFAULT_START, work_end_min: i.work_end_min ?? DEFAULT_END })),
      duplicates: all.length - instruments.length,
      bookings,
      can_add_instrument: manager, // only an admin / PI adds instruments; everyone else books
      can_manage: manager, // switch Active / Not used, set working hours, approve out-of-hours requests
      person: me.full_name,
      lab: lab?.name ?? "",
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
    lab_name: v.optional(v.string()),
    person_name: v.optional(v.string()),
    room: v.optional(v.string()),
    when_text: v.optional(v.string()),
    remind_every_2_days: v.optional(v.boolean()),
    // Local clock times of the start and end (minutes after midnight), to check the working hours in the booker's time zone
    start_min: v.optional(v.number()),
    end_min: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const me = (await ctx.db.get(userId))!;
    const inst = await ctx.db.get(a.instrument_id);
    if (!inst) throw new ConvexError("Instrument not found.");
    if (NOT_BOOKABLE.includes(inst.status)) throw new ConvexError(`${inst.name} can't be booked right now (${inst.status.replace(/_/g, " ")}).`);
    if (!Number.isFinite(a.start_time) || !Number.isFinite(a.end_time)) throw new ConvexError("Choose a start and end time.");
    if (a.end_time <= a.start_time) throw new ConvexError("The end must be after the start.");
    if (a.end_time - a.start_time > MAX_LEN) throw new ConvexError("A booking can be 7 days at most.");
    if (a.start_time < Date.now() - 5 * 60_000) throw new ConvexError("That time is in the past.");

    const clash = (await ctx.db.query("bookings").withIndex("by_instrument", (q) => q.eq("instrument_id", a.instrument_id)).collect())
      .find((b) => !FREE.includes(b.status) && b.start_time < a.end_time && b.end_time > a.start_time);
    if (clash) {
      const who = (await ctx.db.get(clash.user_id))?.full_name ?? "someone";
      throw new ConvexError(`${inst.name} is already booked by ${who} during part of that time. Pick a free slot (see "Already booked").`);
    }
    const now = Date.now();
    // Outside the instrument's working hours: a manager books freely, anyone else waits for an admin/PI to approve.
    const ws = inst.work_start_min ?? DEFAULT_START, we = inst.work_end_min ?? DEFAULT_END;
    const outside = a.start_min !== undefined && a.end_min !== undefined && (a.start_min < ws || a.end_min > we || a.end_min <= 0);
    const pending = outside && !hasRole(me.role, "manager");
    const id = await ctx.db.insert("bookings", {
      instrument_id: a.instrument_id,
      user_id: userId,
      start_time: a.start_time,
      end_time: a.end_time,
      purpose: a.purpose?.trim().slice(0, 300) || undefined,
      lab_name: a.lab_name?.trim().slice(0, 100) || undefined,
      person_name: a.person_name?.trim().slice(0, 100) || undefined,
      room: a.room?.trim().slice(0, 60) || undefined,
      when_text: a.when_text?.slice(0, 120),
      status: pending ? "pending_approval" : "confirmed",
      outside_hours: outside || undefined,
      remind_every_2_days: a.remind_every_2_days ? true : undefined,
      last_reminded_at: a.remind_every_2_days ? now : undefined,
      created_at: now,
    });
    const line = detailLine({ ...a, purpose: a.purpose?.trim() }, inst, now);
    if (pending) {
      // Ask the admins / PIs of the booker's lab to approve; the booker is told it is waiting.
      const leaders = (await ctx.db.query("users").collect()).filter((u) => u.is_active && hasRole(u.role, "manager") && (u.home_lab_id === me.home_lab_id || u.role === "superadmin") && u._id !== userId);
      for (const u of leaders) await ctx.db.insert("notifications", { user_id: u._id, channel: "in_app", is_read: false, entity_type: "booking", entity_id: id, created_at: now, title: `Approve out-of-hours booking: ${inst.name}`, message: `${me.full_name} asks for time outside ${fmtMin(ws)}-${fmtMin(we)}. ${line}` });
      await ctx.db.insert("notifications", { user_id: userId, channel: "in_app", is_read: false, entity_type: "booking", entity_id: id, created_at: now, title: `Waiting for approval: ${inst.name}`, message: `Outside working hours (${fmtMin(ws)}-${fmtMin(we)}); an admin or PI must approve. ${line}` });
    } else {
      // Send the full details right away; the reminders (if on) repeat them every 2 days.
      await ctx.db.insert("notifications", { user_id: userId, channel: "in_app", is_read: false, entity_type: "booking", entity_id: id, created_at: now, title: `Booking confirmed: ${inst.name}`, message: line });
      await emailBooking(ctx, me, id, inst.name, a.room?.trim() || inst.location, a.start_time, a.end_time, `Booking confirmed. ${line}`);
    }
    return { id, instrument: inst.name, location: a.room?.trim() || inst.location, start_time: a.start_time, end_time: a.end_time, reminders: !!a.remind_every_2_days, pending };
  },
});

const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Email the booker the details plus a calendar invite (no-op unless email is configured and the user has an address). */
async function emailBooking(ctx: MutationCtx, user: { email?: string; full_name: string }, id: Id<"bookings">, name: string, location: string | undefined, start: number, end: number, body: string) {
  if (!user.email) return;
  await ctx.scheduler.runAfter(0, internal.instrumentEmail.sendBookingEmail, { to: user.email, name: user.full_name, subject: `Instrument booked: ${name}`, body, uid: id, title: `${name} (LabOS booking)`, location, start, end });
}

/** Admin / PI: approve or decline an out-of-hours request. */
export const decide = mutation({
  args: { token: v.optional(v.string()), id: v.id("bookings"), approve: v.boolean() },
  handler: async (ctx, { token, id, approve }) => {
    const userId = await requireAuth(ctx, token);
    if (!hasRole((await ctx.db.get(userId))!.role, "manager")) throw new ConvexError("Only an admin or PI can approve bookings.");
    const b = await ctx.db.get(id);
    if (!b || b.status !== "pending_approval") throw new ConvexError("This request is no longer waiting for approval.");
    const inst = await ctx.db.get(b.instrument_id);
    const booker = await ctx.db.get(b.user_id);
    await ctx.db.patch(id, { status: approve ? "confirmed" : "cancelled", decided_by: userId });
    const line = detailLine(b, inst, Date.now());
    await ctx.db.insert("notifications", { user_id: b.user_id, channel: "in_app", is_read: false, entity_type: "booking", entity_id: id, created_at: Date.now(), title: `${approve ? "Approved" : "Declined"}: ${inst?.name ?? "instrument"} booking`, message: line });
    if (approve && booker && inst) await emailBooking(ctx, booker, id, inst.name, b.room ?? inst.location, b.start_time, b.end_time, `Booking approved. ${line}`);
  },
});

/** Admin / PI: set the hours (minutes after midnight) that can be booked without approval. */
export const setHours = mutation({
  args: { token: v.optional(v.string()), id: v.id("instruments"), start_min: v.number(), end_min: v.number() },
  handler: async (ctx, { token, id, start_min, end_min }) => {
    const userId = await requireAuth(ctx, token);
    if (!hasRole((await ctx.db.get(userId))!.role, "manager")) throw new ConvexError("Only an admin or PI can set working hours.");
    if (!(start_min >= 0 && end_min <= 24 * 60 && start_min < end_min)) throw new ConvexError("Working hours must start before they end.");
    await ctx.db.patch(id, { work_start_min: start_min, work_end_min: end_min, updated_at: Date.now() });
  },
});

/** Admin / PI: retire the extra copies of an instrument (same name and room), moving their bookings to the one kept. */
export const removeDuplicates = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    if (!hasRole((await ctx.db.get(userId))!.role, "manager")) throw new ConvexError("Only an admin or PI can clean up instruments.");
    const all = (await ctx.db.query("instruments").collect()).filter((i) => i.status !== "retired").sort((a, c) => a.created_at - c.created_at);
    const keep = new Map<string, Id<"instruments">>();
    let removed = 0;
    for (const i of all) {
      const first = keep.get(dupKey(i));
      if (!first) { keep.set(dupKey(i), i._id); continue; }
      for (const b of await ctx.db.query("bookings").withIndex("by_instrument", (q) => q.eq("instrument_id", i._id)).collect()) await ctx.db.patch(b._id, { instrument_id: first });
      await ctx.db.patch(i._id, { status: "retired", updated_at: Date.now() });
      removed++;
    }
    return { removed };
  },
});

export const cancel = mutation({
  args: { token: v.optional(v.string()), id: v.id("bookings") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError("Booking not found.");
    if (b.user_id !== userId && !hasRole((await ctx.db.get(userId))!.role, "manager")) throw new ConvexError("Only the person who booked, or an admin / PI, can cancel this booking.");
    await ctx.db.patch(id, { status: "cancelled" });
  },
});

/** Done with the instrument: frees the rest of the slot so others can book it. */
export const complete = mutation({
  args: { token: v.optional(v.string()), id: v.id("bookings") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError("Booking not found.");
    if (b.user_id !== userId) throw new ConvexError("Only the person who booked can mark this booking complete.");
    await ctx.db.patch(id, { status: "completed", remind_every_2_days: undefined });
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
      if (FREE.includes(b.status) || !b.remind_every_2_days) continue;
      if (now - (b.last_reminded_at ?? b.created_at) < gap) continue;
      const inst = await ctx.db.get(b.instrument_id);
      await ctx.db.insert("notifications", {
        lab_id: b.lab_id, user_id: b.user_id, channel: "in_app", is_read: false, entity_type: "booking", entity_id: b._id, created_at: now,
        title: `Reminder: ${inst?.name ?? "instrument"} booking`,
        // The server has no time zone for the user, so say "in N days" and let My bookings show the clock time.
        message: detailLine(b, inst, now),
      });
      await ctx.db.patch(b._id, { last_reminded_at: now });
    }
  },
});

/** Manager: mark an instrument Active (bookable) or Not used (can't be booked). */
export const setActive = mutation({
  args: { token: v.optional(v.string()), id: v.id("instruments"), active: v.boolean() },
  handler: async (ctx, { token, id, active }) => {
    const userId = await requireAuth(ctx, token);
    if (!hasRole((await ctx.db.get(userId))!.role, "manager")) throw new ConvexError("Only a manager can change an instrument's status.");
    if (!(await ctx.db.get(id))) throw new ConvexError("Instrument not found.");
    await ctx.db.patch(id, { status: active ? "active" : "not_used", updated_at: Date.now() });
  },
});

// ── Calendar notes ──────────────────────────────────────────────────────────

/** Notes from today on (a week back for context), with who wrote them. */
export const notes = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const since = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
    const rows = await ctx.db.query("calendar_notes").withIndex("by_date", (q) => q.gte("date", since)).take(500);
    const names = new Map<string, string>();
    const out = [];
    for (const n of rows) {
      if (!names.has(n.user_id)) names.set(n.user_id, (await ctx.db.get(n.user_id))?.full_name ?? "Unknown");
      out.push({ _id: n._id, instrument_id: n.instrument_id, date: n.date, text: n.text, author: names.get(n.user_id)!, can_delete: n.user_id === userId || hasRole(me.role, "manager") });
    }
    return out;
  },
});

/** Anyone can pin a note to a day (optionally for one instrument). */
export const addNote = mutation({
  args: { token: v.optional(v.string()), date: v.string(), text: v.string(), instrument_id: v.optional(v.id("instruments")) },
  handler: async (ctx, { token, date, text, instrument_id }) => {
    const userId = await requireAuth(ctx, token);
    const clean = text.trim().slice(0, 500);
    if (!clean) throw new ConvexError("Write a note first.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ConvexError("Pick a day.");
    const me = (await ctx.db.get(userId))!;
    return await ctx.db.insert("calendar_notes", { lab_id: me.home_lab_id, instrument_id, user_id: userId, date, text: clean, created_at: Date.now() });
  },
});

/** The author, or an admin / PI, can remove a note. */
export const removeNote = mutation({
  args: { token: v.optional(v.string()), id: v.id("calendar_notes") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const n = await ctx.db.get(id);
    if (!n) return;
    if (n.user_id !== userId && !hasRole((await ctx.db.get(userId))!.role, "manager")) throw new ConvexError("Only the author or an admin / PI can delete this note.");
    await ctx.db.delete(id);
  },
});
