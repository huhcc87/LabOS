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
