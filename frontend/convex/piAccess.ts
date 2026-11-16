/**
 * PI-controlled access: a PI adds students and chooses which hubs each one can use.
 * A student is any non-PI, non-admin user whose `pi_id` points at a PI.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireAuth, requireRole, sanitizeUser } from "./authHelper";
import { DEFAULT_HUBS, HUBS, isHub } from "./hubs";

const LEADER_ROLES = ["pi", "admin", "superadmin"];

/** Hubs the caller may use. `restricted: false` means everything. */
export const myAccess = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user || !user.pi_id || LEADER_ROLES.includes(user.role)) {
      return { restricted: false, hubs: [...HUBS] as string[], piName: null as string | null };
    }
    const pi = await ctx.db.get(user.pi_id);
    return { restricted: true, hubs: user.allowed_hubs ?? DEFAULT_HUBS, piName: pi?.full_name ?? null };
  },
});

export const listMyStudents = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await requireRole(ctx, token, "pi");
    const students = await ctx.db
      .query("users")
      .withIndex("by_pi", (q) => q.eq("pi_id", me._id))
      .collect();
    return students.map((s) => ({ ...sanitizeUser(s), allowed_hubs: s.allowed_hubs ?? DEFAULT_HUBS }));
  },
});

/** The student's own PI, or an admin / super admin, may change their access. */
async function requireSupervisor(ctx: MutationCtx, token: string | undefined, studentId: Id<"users">) {
  const me = await requireRole(ctx, token, "pi");
  const student = await ctx.db.get(studentId);
  if (!student) throw new ConvexError("Student not found");
  const isAdmin = me.role === "admin" || me.role === "superadmin";
  if (student.pi_id !== me._id && !isAdmin) throw new ConvexError("Forbidden: not your student");
  return student;
}

export const addStudent = mutation({
  args: { token: v.optional(v.string()), email: v.string() },
  handler: async (ctx, { token, email }) => {
    const me = await requireRole(ctx, token, "pi");
    const student: Doc<"users"> | null = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();
    if (!student) throw new ConvexError("No account with that email. Create the user first (Admin → Users).");
    if (student._id === me._id) throw new ConvexError("You can't add yourself");
    if (LEADER_ROLES.includes(student.role)) throw new ConvexError("PIs and admins can't be added as students");
    if (student.pi_id && student.pi_id !== me._id) throw new ConvexError("This user already belongs to another PI");
    await ctx.db.patch(student._id, {
      pi_id: me._id,
      allowed_hubs: student.allowed_hubs ?? DEFAULT_HUBS,
      updated_at: Date.now(),
    });
    return student._id;
  },
});

export const setStudentHubs = mutation({
  args: { token: v.optional(v.string()), student_id: v.id("users"), hubs: v.array(v.string()) },
  handler: async (ctx, { token, student_id, hubs }) => {
    await requireSupervisor(ctx, token, student_id);
    const bad = hubs.filter((h) => !isHub(h));
    if (bad.length) throw new ConvexError(`Unknown hub: ${bad.join(", ")}`);
    await ctx.db.patch(student_id, { allowed_hubs: [...new Set(hubs)], updated_at: Date.now() });
  },
});

export const removeStudent = mutation({
  args: { token: v.optional(v.string()), student_id: v.id("users") },
  handler: async (ctx, { token, student_id }) => {
    await requireSupervisor(ctx, token, student_id);
    await ctx.db.patch(student_id, { pi_id: undefined, allowed_hubs: undefined, updated_at: Date.now() });
  },
});

// ── Access requests: a limited user asks for a hub they can see but not open ─────────────

/** The caller's own requests, newest first (so the lock screen can say "request sent"). */
export const myRequests = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const rows = await ctx.db.query("access_requests").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    return rows.sort((a, b) => b.created_at - a.created_at).slice(0, 20).map((r) => ({ _id: r._id, hub: r.hub, status: r.status, created_at: r.created_at }));
  },
});

/** Ask the PI (or the lab's admins if there is no PI) to open a hub. One open request per hub. */
export const requestAccess = mutation({
  args: { token: v.optional(v.string()), hub: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { token, hub, note }) => {
    const userId = await requireAuth(ctx, token);
    if (!isHub(hub)) throw new ConvexError("Unknown hub");
    const me = (await ctx.db.get(userId))!;
    if ((me.allowed_hubs ?? DEFAULT_HUBS).includes(hub) || !me.pi_id) throw new ConvexError("You already have access to this hub.");
    const open = (await ctx.db.query("access_requests").withIndex("by_user", (q) => q.eq("user_id", userId)).collect()).find((r) => r.hub === hub && r.status === "pending");
    if (open) throw new ConvexError("You already asked for this. Your PI has been notified.");
    const now = Date.now();
    const id = await ctx.db.insert("access_requests", { lab_id: me.home_lab_id, user_id: userId, hub, note: note?.trim().slice(0, 300) || undefined, status: "pending", created_at: now });
    const decider = await ctx.db.get(me.pi_id);
    const admins = (await ctx.db.query("users").collect()).filter((u) => u.is_active && (u.role === "admin" || u.role === "superadmin") && (u.home_lab_id === me.home_lab_id || u.role === "superadmin"));
    for (const u of [...(decider ? [decider] : []), ...admins.filter((a) => a._id !== decider?._id)]) {
      await ctx.db.insert("notifications", { user_id: u._id, channel: "in_app", is_read: false, entity_type: "access_request", entity_id: id, created_at: now, title: `Access request: ${hub}`, message: `${me.full_name} asks for ${hub}.${note ? ` "${note.trim().slice(0, 200)}"` : ""} Approve it under My Students.` });
    }
    return id;
  },
});

/** Requests the caller can decide: their own students' (PI) or the whole lab's (admin). */
export const pendingRequests = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await requireRole(ctx, token, "pi");
    const isAdmin = me.role === "admin" || me.role === "superadmin";
    const rows = await ctx.db.query("access_requests").withIndex("by_status", (q) => q.eq("status", "pending")).collect();
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.user_id);
      if (!u || !(u.pi_id === me._id || (isAdmin && (me.role === "superadmin" || u.home_lab_id === me.home_lab_id)))) continue;
      out.push({ _id: r._id, hub: r.hub, note: r.note, created_at: r.created_at, user_name: u.full_name, user_email: u.email });
    }
    return out.sort((a, b) => a.created_at - b.created_at);
  },
});

/** Approve (opens the hub for that user) or decline. The user is notified either way. */
export const decideRequest = mutation({
  args: { token: v.optional(v.string()), id: v.id("access_requests"), approve: v.boolean() },
  handler: async (ctx, { token, id, approve }) => {
    const req = await ctx.db.get(id);
    if (!req || req.status !== "pending") throw new ConvexError("This request was already handled.");
    const student = await requireSupervisor(ctx, token, req.user_id);
    const me = await requireRole(ctx, token, "pi");
    const now = Date.now();
    if (approve) await ctx.db.patch(student._id, { allowed_hubs: [...new Set([...(student.allowed_hubs ?? DEFAULT_HUBS), req.hub])], updated_at: now });
    await ctx.db.patch(id, { status: approve ? "approved" : "declined", decided_by: me._id, decided_at: now });
    await ctx.db.insert("notifications", { user_id: student._id, channel: "in_app", is_read: false, entity_type: "access_request", entity_id: id, created_at: now, title: `${req.hub}: ${approve ? "access granted" : "request declined"}`, message: approve ? `${me.full_name} opened ${req.hub} for you. Reload the app to see it.` : `${me.full_name} did not open ${req.hub}.` });
  },
});
