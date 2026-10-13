/**
 * Managing labs. A lab is one PI's workspace: its own people and its own data.
 * Super admins create labs and can step into any of them; a PI only ever sees their own.
 * (Plain builders on purpose: these functions look across labs, so they check roles themselves.)
 */
import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth, requireRole } from "./authHelper";
import { issueInvite, NO_PASSWORD } from "./invites";

/** The lab the caller is working in (for the header), and whether they can switch. */
export const current = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const labId = user.role === "superadmin" ? user.active_lab_id ?? user.home_lab_id : user.home_lab_id;
    const lab = labId ? await ctx.db.get(labId) : null;
    return { lab: lab ? { id: lab._id, name: lab.name } : null, canSwitch: user.role === "superadmin" };
  },
});

/** Super admin: every lab, with its PI and head-count. */
export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireRole(ctx, token, "superadmin");
    const labs = await ctx.db.query("labs").collect();
    const users = await ctx.db.query("users").collect();
    return labs.map((l) => ({
      id: l._id, name: l.name, created_at: l.created_at,
      pi: l.pi_user_id ? users.find((u) => u._id === l.pi_user_id)?.full_name ?? null : null,
      people: users.filter((u) => u.home_lab_id === l._id && u.is_active).length,
    }));
  },
});

/** Super admin: a new lab and its PI. The PI gets a one-time link to choose their own password. */
export const create = mutation({
  args: { token: v.optional(v.string()), name: v.string(), pi_email: v.string(), pi_name: v.string() },
  handler: async (ctx, { token, name, pi_email, pi_name }) => {
    const me = await requireRole(ctx, token, "superadmin");
    if (!name.trim() || !pi_name.trim()) throw new ConvexError("Enter the lab name and the PI's name");
    const email = pi_email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ConvexError("Enter a valid email for the PI");
    if (await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first()) {
      throw new ConvexError("An account with that email already exists");
    }
    const now = Date.now();
    const labId = await ctx.db.insert("labs", { name: name.trim(), created_at: now });
    const piId = await ctx.db.insert("users", {
      email, hashed_password: NO_PASSWORD, full_name: pi_name.trim(), role: "pi", is_active: true, totp_enabled: false,
      failed_login_attempts: 0, home_lab_id: labId, created_at: now, updated_at: now,
    });
    await ctx.db.patch(labId, { pi_user_id: piId });
    const { token: invite_token, emailed } = await issueInvite(ctx, piId, me._id);
    return { lab_id: labId, invite_token, emailed };
  },
});

export const rename = mutation({
  args: { token: v.optional(v.string()), lab_id: v.id("labs"), name: v.string() },
  handler: async (ctx, { token, lab_id, name }) => {
    const me = await requireRole(ctx, token, "pi");
    const lab = await ctx.db.get(lab_id);
    if (!lab) throw new ConvexError("Lab not found");
    if (me.role !== "superadmin" && me.home_lab_id !== lab_id) throw new ConvexError("Lab not found");
    if (!name.trim()) throw new ConvexError("Enter a name");
    await ctx.db.patch(lab_id, { name: name.trim() });
  },
});

/** Super admin: work inside another lab (everything in the app then shows that lab). */
export const switchTo = mutation({
  args: { token: v.optional(v.string()), lab_id: v.id("labs") },
  handler: async (ctx, { token, lab_id }) => {
    const me = await requireRole(ctx, token, "superadmin");
    if (!(await ctx.db.get(lab_id))) throw new ConvexError("Lab not found");
    await ctx.db.patch(me._id, { active_lab_id: lab_id });
  },
});
