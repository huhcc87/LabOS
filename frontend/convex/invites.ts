/**
 * One-time links for setting a password:
 *  - invite: a PI/admin adds a user; the user opens the link and picks their password.
 *  - reset:  "Forgot password" on the sign-in page emails a link to choose a new one.
 */
import { action, mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireRole } from "./authHelper";
import { emailConfigured } from "./inviteEmail";
import { checkRateLimit } from "./rateLimit";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Password placeholder for accounts that haven't accepted their invite yet. */
export const NO_PASSWORD = "!";

type Kind = "invite" | "reset";

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** An invite needs a not-yet-joined account; a reset works for any active account. */
const usable = (user: Doc<"users"> | null, kind: Kind): user is Doc<"users"> =>
  !!user && user.is_active && (kind === "reset" || user.hashed_password === NO_PASSWORD);

/**
 * Replaces any earlier link for this user with a fresh one and returns its token.
 * ponytail: token stored as-is in its own table and never returned with user records;
 * hash it at rest if the database itself is ever exposed to less-trusted readers.
 */
export async function issueInvite(
  ctx: MutationCtx, userId: Id<"users">, createdBy: Id<"users">, kind: Kind = "invite"
): Promise<{ token: string; emailed: boolean }> {
  const old = await ctx.db.query("invites").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
  await Promise.all(old.map((i) => ctx.db.delete(i._id)));
  const token = newToken();
  const now = Date.now();
  const ttl = kind === "reset" ? RESET_TTL_MS : INVITE_TTL_MS;
  await ctx.db.insert("invites", { user_id: userId, token, kind, expires_at: now + ttl, created_by: createdBy, created_at: now });

  // Email it automatically when Brevo is configured (sent right after this mutation commits).
  const emailed = emailConfigured();
  if (emailed) {
    const [user, inviter] = await Promise.all([ctx.db.get(userId), ctx.db.get(createdBy)]);
    if (user) {
      await ctx.scheduler.runAfter(0, internal.inviteEmail.sendInvite, {
        to: user.email, name: user.full_name, token, invitedBy: inviter?.full_name ?? "Your PI", kind,
      });
    }
  }
  return { token, emailed };
}

/** New link for someone who hasn't joined yet (e.g. the first one expired or was lost). */
export const regenerate = mutation({
  args: { token: v.optional(v.string()), user_id: v.id("users") },
  handler: async (ctx, { token, user_id }) => {
    const me = await requireRole(ctx, token, "admin");
    const user = await ctx.db.get(user_id);
    if (!user) throw new ConvexError("User not found");
    if (user.hashed_password !== NO_PASSWORD) throw new ConvexError("This user has already joined");
    // Only for people in the caller's own lab (a super admin may do it for any lab).
    if (me.role !== "superadmin" && user.home_lab_id !== me.home_lab_id) throw new ConvexError("User not found");
    return await issueInvite(ctx, user_id, me._id);
  },
});

/** Public: who is this link for? Returns null for unknown, expired or used links. */
export const lookup = query({
  args: { invite: v.string() },
  handler: async (ctx, { invite }) => {
    const row = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", invite)).first();
    if (!row || row.expires_at < Date.now()) return null;
    const kind: Kind = row.kind ?? "invite";
    const user = await ctx.db.get(row.user_id);
    if (!usable(user, kind)) return null;
    return { email: user.email, full_name: user.full_name, kind };
  },
});

export const consume = internalMutation({
  args: { invite: v.string(), hashed_password: v.string() },
  handler: async (ctx, { invite, hashed_password }) => {
    const row = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", invite)).first();
    if (!row || row.expires_at < Date.now()) throw new ConvexError("This link is invalid or has expired. Please request a new one.");
    const kind: Kind = row.kind ?? "invite";
    const user = await ctx.db.get(row.user_id);
    if (!usable(user, kind)) throw new ConvexError("This link has already been used");
    await ctx.db.patch(user._id, { hashed_password, failed_login_attempts: 0, locked_until: undefined, updated_at: Date.now() });
    await ctx.db.delete(row._id);
    if (kind === "reset") {
      // Sign out every existing session after a password reset.
      // ponytail: full scan — sessions has no by_user index; add one if the table grows large.
      const sessions = await ctx.db.query("sessions").filter((q) => q.eq(q.field("user_id"), user._id)).collect();
      await Promise.all(sessions.map((s) => ctx.db.delete(s._id)));
    }
    return { email: user.email };
  },
});

/** Public: set your password from an invite or reset link. The client then signs in normally. */
export const accept = action({
  args: { invite: v.string(), password: v.string() },
  handler: async (ctx, { invite, password }): Promise<{ email: string }> => {
    if (password.length < 8) throw new ConvexError("Password must be at least 8 characters");
    if (!/\d/.test(password)) throw new ConvexError("Password must contain at least one digit");
    const bcrypt = await import("bcryptjs");
    const hashed_password = await bcrypt.hash(password, 12);
    return await ctx.runMutation(internal.invites.consume, { invite, hashed_password });
  },
});

export const startReset = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (!user || !user.is_active) return; // say nothing: don't reveal which emails exist
    await issueInvite(ctx, user._id, user._id, "reset");
  },
});

/**
 * Public "Forgot password". Always answers the same way so it can't be used to discover accounts.
 * `emailEnabled: false` tells the page to suggest asking an admin instead.
 */
export const requestReset = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ emailEnabled: boolean }> => {
    const normalized = email.trim().toLowerCase();
    checkRateLimit(`reset:${normalized}`);
    if (!emailConfigured()) return { emailEnabled: false };
    await ctx.runMutation(internal.invites.startReset, { email: normalized });
    return { emailEnabled: true };
  },
});
