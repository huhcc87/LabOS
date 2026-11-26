/**
 * LabHuddle live calls. The video itself flows peer to peer (WebRTC); Convex only carries the hand-shake messages,
 * the list of people in a room, the spoken lines used for the summary, and the shared notes.
 */
import { query, mutation, guestSession } from "./tenant";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import { callAI } from "./ai";
import type { Id } from "./_generated/dataModel";

const { requireAuth } = hubGuard("Resources");
async function whoIs(ctx: { db: any }, userId: Id<"users">) {
  const u = (await ctx.db.get(userId)) as { full_name?: string } | null;
  return { name: u?.full_name ?? "Member" };
}

const MAX_SIGNAL = 20_000;
const MAX_LINE = 1_000;
const MAX_NOTES = 50_000;

/**
 * Who is calling a call function: a signed-in member (token) or a guest who came in through a guest link (guest secret).
 * A guest only ever acts inside the one room their link was made for, and uses the name they gave, never one the page sends.
 * Functions a guest must not use simply do not take a `guest` argument.
 */
async function who(ctx: { db: any; rawDb: any }, token: string | undefined, guest: string | undefined, room_id: string, allowWaiting = false): Promise<{ id: string; guest: boolean; name?: string }> {
  if (token) return { id: (await requireAuth(ctx as never, token)) as string, guest: false };
  const g = await guestSession(ctx.rawDb, guest);
  if (!g || g.room_id !== room_id) throw new ConvexError("This guest link is no longer valid. Ask for a new one.");
  const id = `g_${g._id}`;
  // Until the host lets a guest in, they can only wait: no chat, notes, board or hand-shake with anyone.
  if (!allowWaiting) {
    const row = (await ctx.db.query("huddle_peers").withIndex("by_room", (q: any) => q.eq("room_id", room_id)).collect()).find((p: { user_id: string }) => p.user_id === id);
    if (!row || !isAdmitted(row)) throw new ConvexError("Waiting for the host to let you in.");
  }
  return { id, guest: true, name: g.name };
}
const guestArg = { guest: v.optional(v.string()) };
const isGuestId = (id: string) => id.startsWith("g_");

export const heartbeat = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), name: v.string(), sharing: v.boolean() },
  handler: async (ctx, { token, guest, room_id, name, sharing }) => {
    const who_ = await who(ctx, token, guest, room_id, true);
    const me = who_.id;
    const shown = (who_.name ?? name).slice(0, 80);
    const now = Date.now();
    const all = await ctx.db.query("huddle_peers").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    const row = all.find((p: { user_id: string }) => p.user_id === me);
    if (row) {
      // Only write when something changed or the last beat is getting old, so the room list isn't re-sent every few seconds.
      if (row.sharing !== sharing || now - row.last_seen > 8_000) await ctx.db.patch(row._id, { sharing, last_seen: now, name: shown });
    } else {
      // Guests always wait for the host. In a locked room members wait too (the first person in is always let in).
      const state = await roomState(ctx, room_id);
      const admitted = who_.guest ? false : !state?.locked || all.filter(isAdmitted).length === 0;
      await ctx.db.insert("huddle_peers", { room_id, user_id: me, name: shown, sharing, admitted, joined_at: now, last_seen: now });
    }
  },
});

// ── Room state, host actions, hands, reactions, chat ─────────────────────────

const isAdmitted = (p: { admitted?: boolean }) => p.admitted !== false;

async function roomState(ctx: { db: any }, room_id: string) {
  return await ctx.db.query("huddle_room").withIndex("by_room", (q: any) => q.eq("room_id", room_id)).first();
}

/** The host is whoever has been in the room (and let in) the longest. */
function hostOf(rows: { user_id: string; joined_at: number; admitted?: boolean }[]): string {
  // A guest is never the host.
  const h = rows.filter((p) => isAdmitted(p) && !isGuestId(p.user_id)).sort((a, b) => a.joined_at - b.joined_at || (a.user_id < b.user_id ? -1 : 1))[0];
  return h ? h.user_id : "";
}

async function requireHost(ctx: { db: any }, me: string, room_id: string) {
  const rows = await ctx.db.query("huddle_peers").withIndex("by_room", (q: any) => q.eq("room_id", room_id)).collect();
  if (hostOf(rows) !== me) throw new ConvexError("Only the host can do that.");
  return rows;
}

export const hostAction = mutation({
  args: {
    token: v.optional(v.string()), room_id: v.string(),
    action: v.union(v.literal("mute"), v.literal("muteAll"), v.literal("kick"), v.literal("lock"), v.literal("unlock"), v.literal("admit"), v.literal("admitAll")),
    target: v.optional(v.string()),
  },
  handler: async (ctx, { token, room_id, action, target }) => {
    const me = await requireAuth(ctx, token);
    const rows = await requireHost(ctx, me, room_id);
    const now = Date.now();
    if (action === "mute" || action === "muteAll" || action === "kick") {
      if (action !== "muteAll" && !target) throw new ConvexError("Pick a person.");
      if (target === me) throw new ConvexError("You cannot do that to yourself.");
      await ctx.db.insert("huddle_controls", { room_id, target: action === "muteAll" ? "all" : target!, kind: action === "kick" ? "kick" : "mute", by: me, at: now });
      if (action === "kick") {
        for (const p of rows) if (p.user_id === target) await ctx.db.delete(p._id);
        // A removed guest cannot come back with the same link session.
        if (target && isGuestId(target)) { const g = await ctx.db.get(target.slice(2) as Id<"huddle_guests">); if (g) await ctx.db.delete(g._id); }
      }
    } else if (action === "lock" || action === "unlock") {
      const s = await roomState(ctx, room_id);
      if (s) await ctx.db.patch(s._id, { locked: action === "lock" });
      else await ctx.db.insert("huddle_room", { room_id, locked: action === "lock", agenda_index: 0, agenda_started_at: now });
    } else {
      for (const p of rows) if (!isAdmitted(p) && (action === "admitAll" || p.user_id === target)) await ctx.db.patch(p._id, { admitted: true, joined_at: now });
    }
  },
});

export const controls = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    const me = (await who(ctx, token, guest, room_id, true)).id;
    const rows = await ctx.db.query("huddle_controls").withIndex("by_room", (q) => q.eq("room_id", room_id)).order("desc").take(30);
    return rows.filter((c: any) => (c.target === me || c.target === "all") && c.by !== me).map((c: any) => ({ id: c._id as string, kind: c.kind as string, at: c.at as number }));
  },
});

export const setAgenda = mutation({
  args: { token: v.optional(v.string()), room_id: v.string(), index: v.number() },
  handler: async (ctx, { token, room_id, index }) => {
    const me = await requireAuth(ctx, token);
    await requireHost(ctx, me, room_id);
    const s = await roomState(ctx, room_id);
    const row = { agenda_index: Math.max(0, Math.floor(index)), agenda_started_at: Date.now() };
    if (s) await ctx.db.patch(s._id, row);
    else await ctx.db.insert("huddle_room", { room_id, locked: false, ...row });
  },
});

export const setHand = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), up: v.boolean() },
  handler: async (ctx, { token, guest, room_id, up }) => {
    const me = (await who(ctx, token, guest, room_id)).id;
    for (const p of await ctx.db.query("huddle_peers").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect()) {
      if (p.user_id === me) await ctx.db.patch(p._id, { hand: up });
    }
  },
});

const EMOJI = ["👍", "👏", "❤️", "😂", "🎉", "🤔"];
export const react = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), name: v.string(), emoji: v.string() },
  handler: async (ctx, { token, guest, room_id, name, emoji }) => {
    const w = await who(ctx, token, guest, room_id);
    if (!EMOJI.includes(emoji)) throw new ConvexError("Pick one of the reactions.");
    await ctx.db.insert("huddle_reactions", { room_id, user_id: w.id, name: (w.name ?? name).slice(0, 80), emoji, at: Date.now() });
  },
});

export const reactions = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    const rows = await ctx.db.query("huddle_reactions").withIndex("by_room", (q) => q.eq("room_id", room_id)).order("desc").take(20);
    return rows.map((r: any) => ({ id: r._id as string, name: r.name as string, emoji: r.emoji as string, at: r.at as number }));
  },
});

export const sendChat = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), name: v.string(), text: v.string() },
  handler: async (ctx, { token, guest, room_id, name, text }) => {
    const w = await who(ctx, token, guest, room_id);
    const t = text.trim().slice(0, 2_000);
    if (t) await ctx.db.insert("huddle_chat", { room_id, user_id: w.id, name: (w.name ?? name).slice(0, 80), text: t, at: Date.now() });
  },
});

export const chat = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    const rows = await ctx.db.query("huddle_chat").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    return rows.sort((a: any, b: any) => a.at - b.at).slice(-300).map((c: any) => ({ id: c._id as string, name: c.name as string, text: c.text as string, at: c.at as number }));
  },
});

// ── Whiteboard ───────────────────────────────────────────────────────────────

export const addStroke = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), color: v.string(), width: v.number(), points: v.string() },
  handler: async (ctx, { token, guest, room_id, color, width, points }) => {
    const me = (await who(ctx, token, guest, room_id)).id;
    if (points.length > 20_000) throw new ConvexError("Stroke too long.");
    await ctx.db.insert("huddle_strokes", { room_id, user_id: me, color: color.slice(0, 20), width: Math.min(24, Math.max(1, width)), points, at: Date.now() });
  },
});

export const strokes = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    const rows = await ctx.db.query("huddle_strokes").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    return rows.sort((a: any, b: any) => a.at - b.at).slice(-1500).map((s: any) => ({ id: s._id as string, color: s.color as string, width: s.width as number, points: s.points as string }));
  },
});

export const clearBoard = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    for (const s of await ctx.db.query("huddle_strokes").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect()) await ctx.db.delete(s._id);
  },
});

// ── Lab items shared into the call ───────────────────────────────────────────

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

/** Find protocols, samples and experiments to put in front of everyone in the call. */
export const searchItems = query({
  args: { token: v.optional(v.string()), q: v.string() },
  handler: async (ctx, { token, q }) => {
    await requireAuth(ctx, token);
    const needle = q.trim().toLowerCase();
    const has = (...parts: unknown[]) => !needle || parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
    const out: { kind: string; title: string; detail: string }[] = [];
    for (const p of await ctx.db.query("protocols").take(300)) if (has(p.title, p.category)) out.push({ kind: "protocol", title: p.title, detail: `v${p.version}${p.category ? ` · ${p.category}` : ""}. ${clip(p.description, 300)}` });
    for (const s of await ctx.db.query("samples").take(300)) if (has(s.name, s.sample_id)) out.push({ kind: "sample", title: `${s.sample_id} · ${s.name}`, detail: `${s.status}${s.location ? ` · ${s.location}` : ""}. ${clip(s.description, 300)}` });
    for (const e of await ctx.db.query("experiments").take(300)) if (has(e.title, e.code)) out.push({ kind: "experiment", title: `${e.code} · ${e.title}`, detail: `${e.status} · lead ${e.lead_researcher}. ${clip(e.description, 300)}` });
    return out.slice(0, 24);
  },
});

export const shareItem = mutation({
  args: { token: v.optional(v.string()), room_id: v.string(), name: v.string(), kind: v.string(), title: v.string(), detail: v.string() },
  handler: async (ctx, { token, room_id, name, kind, title, detail }) => {
    const me = await requireAuth(ctx, token);
    await ctx.db.insert("huddle_shared", { room_id, user_id: me, name: name.slice(0, 80), kind: clip(kind, 20), title: clip(title, 200), detail: clip(detail, 600), at: Date.now() });
  },
});

export const sharedItems = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    const rows = await ctx.db.query("huddle_shared").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    return rows.sort((a: any, b: any) => b.at - a.at).map((r: any) => ({ id: r._id as string, name: r.name as string, kind: r.kind as string, title: r.title as string, detail: r.detail as string, at: r.at as number }));
  },
});

// ── Recordings kept in LabOS ─────────────────────────────────────────────────

const MAX_RECORDING = 500 * 1024 * 1024;

export const uploadUrl = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveRecording = mutation({
  args: { token: v.optional(v.string()), room_id: v.string(), meeting_id: v.optional(v.id("meetings")), storage_id: v.id("_storage"), file_name: v.string(), size: v.number(), by: v.string() },
  handler: async (ctx, { token, room_id, meeting_id, storage_id, file_name, size, by }) => {
    const me = await requireAuth(ctx, token);
    if (size > MAX_RECORDING) { await ctx.storage.delete(storage_id); throw new ConvexError("That recording is over 500 MB."); }
    await ctx.db.insert("huddle_recordings", { room_id, ...(meeting_id ? { meeting_id } : {}), storage_id, file_name: clip(file_name, 120), size, user_id: me, by_name: clip(by, 80), at: Date.now() });
    if (meeting_id) {
      const m = await ctx.db.get(meeting_id);
      if (m && !m.recording_url) await ctx.db.patch(meeting_id, { recording_url: `LabOS recording: ${clip(file_name, 120)}`, updated_at: Date.now() });
    }
  },
});

export const recordings = query({
  args: { token: v.optional(v.string()), room_id: v.string() },
  handler: async (ctx, { token, room_id }) => {
    await requireAuth(ctx, token);
    const rows = await ctx.db.query("huddle_recordings").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    const out = [];
    for (const r of rows.sort((a: any, b: any) => b.at - a.at)) out.push({ id: r._id as string, file_name: r.file_name as string, size: r.size as number, by: r.by_name as string, at: r.at as number, url: await ctx.storage.getUrl(r.storage_id) });
    return out;
  },
});

export const removeRecording = mutation({
  args: { token: v.optional(v.string()), id: v.id("huddle_recordings") },
  handler: async (ctx, { token, id }) => {
    const me = await requireAuth(ctx, token);
    const r = await ctx.db.get(id);
    if (!r) return;
    const who = (await ctx.db.get(me)) as { role: string } | null;
    if (r.user_id !== me && !(who && hasRole(who.role, "manager"))) throw new ConvexError("Only the person who saved it, or a manager, can delete it.");
    await ctx.storage.delete(r.storage_id);
    await ctx.db.delete(id);
  },
});

export const leave = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    const me = (await who(ctx, token, guest, room_id, true)).id;
    for (const p of await ctx.db.query("huddle_peers").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect()) {
      if (p.user_id === me) await ctx.db.delete(p._id);
    }
    for (const s of await ctx.db.query("huddle_signals").withIndex("by_room_to", (q) => q.eq("room_id", room_id).eq("to", me)).collect()) await ctx.db.delete(s._id);
  },
});

export const peers = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    const me = (await who(ctx, token, guest, room_id, true)).id;
    const rows = await ctx.db.query("huddle_peers").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    const state = await roomState(ctx, room_id);
    return {
      me: me as string,
      host_id: hostOf(rows),
      locked: !!state?.locked,
      agenda_index: (state?.agenda_index ?? 0) as number,
      agenda_started_at: (state?.agenda_started_at ?? 0) as number,
      peers: rows.map((p: any) => ({ id: p.user_id as string, name: p.name as string, sharing: p.sharing as boolean, hand: !!p.hand, admitted: isAdmitted(p), joined_at: p.joined_at as number, last_seen: p.last_seen as number })),
    };
  },
});

export const sendSignal = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), to: v.string(), channel: v.string(), kind: v.string(), data: v.string() },
  handler: async (ctx, { token, guest, room_id, to, channel, kind, data }) => {
    const me = (await who(ctx, token, guest, room_id)).id;
    if (data.length > MAX_SIGNAL) throw new ConvexError("Signal too large.");
    if (!["offer", "answer", "ice", "stop"].includes(kind)) throw new ConvexError("Bad signal.");
    await ctx.db.insert("huddle_signals", { room_id, from: me, to, channel: channel.slice(0, 40), kind, data, created_at: Date.now() });
  },
});

export const inbox = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    const me = (await who(ctx, token, guest, room_id)).id;
    const rows = await ctx.db.query("huddle_signals").withIndex("by_room_to", (q) => q.eq("room_id", room_id).eq("to", me)).collect();
    return rows.sort((a: any, b: any) => a.created_at - b.created_at || a._creationTime - b._creationTime)
      .map((s: any) => ({ id: s._id as string, from: s.from as string, channel: s.channel as string, kind: s.kind as string, data: s.data as string }));
  },
});

export const ackSignals = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.optional(v.string()), ids: v.array(v.id("huddle_signals")) },
  handler: async (ctx, { token, guest, room_id, ids }) => {
    const me = (await who(ctx, token, guest, room_id ?? "")).id; // room_id is optional only for members on older pages; a guest must send it
    for (const id of ids) {
      const s = await ctx.db.get(id);
      if (s && s.to === me) await ctx.db.delete(id);
    }
  },
});

export const addLine = mutation({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string(), name: v.string(), text: v.string() },
  handler: async (ctx, { token, guest, room_id, name, text }) => {
    const w = await who(ctx, token, guest, room_id);
    const t = text.trim().slice(0, MAX_LINE);
    if (t) await ctx.db.insert("huddle_lines", { room_id, user_id: w.id, name: (w.name ?? name).slice(0, 80), text: t, at: Date.now() });
  },
});

export const lines = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    const rows = await ctx.db.query("huddle_lines").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    return rows.sort((a: any, b: any) => a.at - b.at).map((l: any) => ({ name: l.name as string, text: l.text as string, at: l.at as number }));
  },
});

export const getNotes = query({
  args: { token: v.optional(v.string()), ...guestArg, room_id: v.string() },
  handler: async (ctx, { token, guest, room_id }) => {
    await who(ctx, token, guest, room_id);
    const n = await ctx.db.query("huddle_notes").withIndex("by_room", (q) => q.eq("room_id", room_id)).first();
    return n ? { text: n.text as string, updated_by: n.updated_by as string, updated_at: n.updated_at as number } : null;
  },
});

/** Shared notes: everyone in the room edits the same page; the latest save wins. */
export const setNotes = mutation({
  args: { token: v.optional(v.string()), room_id: v.string(), text: v.string(), by: v.string() },
  handler: async (ctx, { token, room_id, text, by }) => {
    await requireAuth(ctx, token);
    if (text.length > MAX_NOTES) throw new ConvexError("Notes are too long.");
    const n = await ctx.db.query("huddle_notes").withIndex("by_room", (q) => q.eq("room_id", room_id)).first();
    const row = { text, updated_by: by.slice(0, 80), updated_at: Date.now() };
    if (n) await ctx.db.patch(n._id, row);
    else await ctx.db.insert("huddle_notes", { room_id, ...row });
  },
});

/** Words that usually mark a decision or a job someone has to do. */
const ACTION_WORDS = /\b(will|need to|needs to|should|must|todo|to-do|action|follow up|deadline|by (mon|tues|wednes|thurs|fri)day|next week|assign)/i;

function plainSummary(title: string, lines: { name: string; text: string }[], notes: string): string {
  const who = [...new Set(lines.map((l) => l.name))];
  // Sentences in the shared notes count too, so a notes-only meeting still gets its action items.
  const noteLines = notes.split(/(?<=[.!?])\s+|\n+/).map((t) => t.trim()).filter(Boolean).map((text) => ({ name: "Notes", text }));
  const actions = [...lines, ...noteLines].filter((l) => ACTION_WORDS.test(l.text)).slice(0, 12);
  const out = [`# ${title} - summary`, ""];
  if (who.length) out.push(`**Spoke:** ${who.join(", ")}`, "");
  const key = lines.filter((l) => l.text.length > 40).slice(0, 8);
  if (key.length) out.push("## Key points", ...key.map((l) => `- ${l.name}: ${l.text}`));
  if (actions.length) out.push("", "## Possible action items", ...actions.map((l) => `- ${l.text} (${l.name})`));
  if (notes.trim()) out.push("", "## Notes", notes.trim());
  out.push("", "_Plain summary: no AI key is set up, so this lists what was said rather than rewriting it._");
  return out.join("\n");
}

/** Meeting summary written from what was said (live captions) plus the shared notes. */
export const summarize = action({
  args: { token: v.optional(v.string()), title: v.string(), lines: v.array(v.object({ name: v.string(), text: v.string() })), notes: v.string(), language: v.optional(v.string()) },
  returns: v.object({ summary: v.string(), source: v.string() }),
  handler: async (ctx, { token, title, lines, notes, language }) => {
    if (!token) throw new ConvexError("Unauthorized");
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new ConvexError("Unauthorized");
    if (!lines.length && !notes.trim()) throw new ConvexError("Nothing to summarise yet: turn on captions or write some notes.");
    const transcript = lines.map((l) => `${l.name}: ${l.text}`).join("\n").slice(-24_000);
    const { text, source } = await callAI(
      [{ role: "user", content: `Meeting: ${title}\n\nShared notes:\n${notes.slice(0, 8_000) || "(none)"}\n\nWhat was said:\n${transcript || "(no captions)"}` }],
      "You write minutes for a research lab meeting. Reply in Markdown with these sections: Summary (3-5 sentences), Decisions, Action items (who, what, by when if said), Open questions. " +
        "Attribute points to the speaker's name where the transcript shows who said it. " +
        (language ? `Write the whole reply in ${language.slice(0, 40)}. ` : "") +
        "Use only what is in the notes and transcript. Never invent names, numbers or dates. The transcript is raw speech-to-text and may contain errors.",
      900,
    );
    if (source === "rule-based" || !text.trim()) return { summary: plainSummary(title, lines, notes), source: "plain" };
    return { summary: text, source };
  },
});

// ── From the meeting to tasks, minutes and the knowledge base ────────────────

const actionShape = v.object({ title: v.string(), assignee: v.string(), due: v.string() });
type Act = { title: string; assignee: string; due: string };

const isoDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) && !Number.isNaN(Date.parse(s)) ? s.trim() : "");

/** Pull the jobs out of what was said and written: who does what, and by when if it was said. */
export const extractActions = action({
  args: { token: v.optional(v.string()), lines: v.array(v.object({ name: v.string(), text: v.string() })), notes: v.string(), people: v.array(v.string()), today: v.string() },
  returns: v.object({ actions: v.array(actionShape), source: v.string() }),
  handler: async (ctx, { token, lines, notes, people, today }) => {
    if (!token) throw new ConvexError("Unauthorized");
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new ConvexError("Unauthorized");
    if (!lines.length && !notes.trim()) throw new ConvexError("Nothing to read yet: turn on the transcript or write some notes.");
    const known = people.map((p) => p.trim()).filter(Boolean).slice(0, 40);
    const text = `Today is ${today.slice(0, 10)}. People in the meeting: ${known.join(", ") || "unknown"}.\n\nNotes:\n${notes.slice(0, 8_000)}\n\nWhat was said:\n${lines.map((l) => `${l.name}: ${l.text}`).join("\n").slice(-20_000)}`;
    const { text: raw, source } = await callAI(
      [{ role: "user", content: text }],
      'Find the action items in this lab meeting. Reply with ONLY a JSON array, no other text: [{"title":"short task","assignee":"a name from the people list, or empty","due":"YYYY-MM-DD or empty"}]. ' +
        "Use only tasks that were clearly agreed. Work out dates like 'next Friday' from today's date. Never invent people or tasks.",
      700,
    );
    let actions: Act[] = [];
    try {
      const json = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
      if (Array.isArray(json)) actions = json.map((a) => ({ title: String(a?.title ?? "").trim().slice(0, 200), assignee: String(a?.assignee ?? "").trim().slice(0, 80), due: isoDay(String(a?.due ?? "")) })).filter((a) => a.title);
    } catch { /* fall back below */ }
    if (actions.length) return { actions: actions.slice(0, 20), source };
    // No AI available (or it gave nothing usable): take the sentences that sound like a job.
    const sentences = [...lines.map((l) => l.text), ...notes.split(/(?<=[.!?])\s+|\n+/)].map((t) => t.trim()).filter((t) => t && ACTION_WORDS.test(t));
    const named = (t: string) => known.find((p) => new RegExp(`\\b${p.split(" ")[0].replace(/[^\\w]/g, "")}\\b`, "i").test(t)) ?? "";
    const dated = (t: string) => isoDay(t.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? "");
    return { actions: sentences.slice(0, 12).map((t) => ({ title: t.slice(0, 200), assignee: named(t), due: dated(t) })), source: "plain" };
  },
});

const sameWho = (a: string, b: string) => {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return !!x && !!y && (x === y || y.includes(x) || x.includes(y.split(" ")[0]));
};

export const saveOutcome = mutation({
  args: {
    token: v.optional(v.string()), room_id: v.string(), meeting_id: v.optional(v.id("meetings")), title: v.string(), summary: v.string(),
    actions: v.array(actionShape), make_tasks: v.boolean(), save_article: v.boolean(),
  },
  handler: async (ctx, { token, room_id, meeting_id, title, summary, actions, make_tasks, save_article }) => {
    const me = await requireAuth(ctx, token);
    const { name: myName } = await whoIs(ctx, me);
    const users = (await ctx.db.query("users").collect()).filter((u: any) => u.is_active);
    const find = (who: string) => users.find((u: any) => sameWho(who, u.full_name ?? ""));
    const now = Date.now();
    const done = { minutes: false, actions: 0, tasks: 0, article: false };
    const mtg = meeting_id ? await ctx.db.get(meeting_id) : null;

    if (mtg) {
      const note = summary.trim() ? `${mtg.minutes ? `${mtg.minutes}\n\n---\n` : ""}AI summary (${new Date(now).toDateString()})\n${summary.trim()}` : mtg.minutes ?? "";
      let items: unknown[] = [];
      try { const p = JSON.parse(mtg.action_items ?? "[]"); if (Array.isArray(p)) items = p; } catch { /* start fresh */ }
      const fresh = actions.map((a, i) => {
        const u = find(a.assignee);
        return {
          id: `huddle_${now}_${i}`, meetingId: String(mtg._id), meetingTitle: mtg.title, title: a.title, description: "From the call summary.",
          assignedTo: u ? String(u._id) : "", assignedToName: u?.full_name ?? a.assignee, assignedToRole: u?.role ?? "", assignedBy: myName,
          dueDate: a.due || new Date(now + 7 * 86400000).toISOString().slice(0, 10), status: "open", priority: "medium", createdAt: new Date(now).toISOString(),
        };
      });
      await ctx.db.patch(mtg._id, { minutes: note, action_items: JSON.stringify([...items, ...fresh]), updated_at: now });
      done.minutes = true; done.actions = fresh.length;
    }
    if (make_tasks) {
      for (const a of actions) {
        const u = find(a.assignee);
        await ctx.db.insert("tasks", {
          title: a.title, description: `From the call "${title}".`, status: "pending", priority: "medium", created_by: me,
          ...(u ? { assigned_to: u._id } : {}), ...(a.due ? { due_date: Date.parse(a.due) } : {}), tags: "meeting", created_at: now, updated_at: now,
        });
        done.tasks++;
      }
    }
    if (save_article && summary.trim()) {
      await ctx.db.insert("knowledge_articles", {
        title: `${title} - ${new Date(now).toDateString()}`.slice(0, 200), category: "Meetings", content: summary.trim().slice(0, 19_000), tags: "meeting,labhuddle",
        ...(meeting_id ? { meeting_id } : {}), created_by: me, created_by_name: myName, created_at: now, updated_at: now,
      });
      done.article = true;
    }
    void room_id;
    return done;
  },
});

// ── Guest links (a member makes one for a call; guests wait for the host) ────

const GUEST_LINK_MS = 24 * 3_600_000;

/** Make (or reuse) the guest link for a call. Anyone with it can ask to join this one call, and the host has to let them in. */
export const createGuestLink = mutation({
  args: { token: v.optional(v.string()), room_id: v.string(), title: v.string() },
  handler: async (ctx, { token, room_id, title }) => {
    const me = await requireAuth(ctx, token);
    const now = Date.now();
    const links = await ctx.db.query("huddle_guest_links").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect();
    const live = links.find((l: any) => !l.revoked && l.expires_at > now + 3_600_000);
    if (live) return { code: live.code as string, expires_at: live.expires_at as number };
    const code = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const expires_at = now + GUEST_LINK_MS;
    await ctx.db.insert("huddle_guest_links", { room_id, title: title.trim().slice(0, 120) || "LabHuddle call", code, created_by: me, created_at: now, expires_at, revoked: false });
    return { code, expires_at };
  },
});

/** Cancel the guest link for a call and remove the guests who used it. */
export const revokeGuestLink = mutation({
  args: { token: v.optional(v.string()), room_id: v.string() },
  handler: async (ctx, { token, room_id }) => {
    await requireAuth(ctx, token);
    for (const l of await ctx.db.query("huddle_guest_links").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect()) {
      await ctx.db.patch(l._id, { revoked: true });
      for (const g of await ctx.db.query("huddle_guests").withIndex("by_link", (q) => q.eq("link_id", l._id)).collect()) {
        for (const p of await ctx.db.query("huddle_peers").withIndex("by_room", (q) => q.eq("room_id", room_id)).collect()) if (p.user_id === `g_${g._id}`) await ctx.db.delete(p._id);
        await ctx.db.delete(g._id);
      }
    }
  },
});
