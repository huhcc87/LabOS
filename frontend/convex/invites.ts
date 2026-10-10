/**
 * Invite links: a PI/admin adds a user, the app makes a one-time link,
 * and the invited person opens it to set their own password.
 */
import { action, mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireRole } from "./authHelper";
import { emailConfigured } from "./inviteEmail";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Password placeholder for accounts that haven't accepted their invite yet. */
export const NO_PASSWORD = "!";

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Replaces any earlier invite for this user with a fresh one and returns its token.
 * ponytail: token stored as-is in its own table and never returned with user records;
 * hash it at rest if the database itself is ever exposed to less-trusted readers.
 */
export async function issueInvite(
  ctx: MutationCtx, userId: Id<"users">, createdBy: Id<"users">
): Promise<{ token: string; emailed: boolean }> {
  const old = await ctx.db.query("invites").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
  await Promise.all(old.map((i) => ctx.db.delete(i._id)));
  const token = newToken();
  const now = Date.now();
  await ctx.db.insert("invites", { user_id: userId, token, expires_at: now + INVITE_TTL_MS, created_by: createdBy, created_at: now });

  // Email it automatically when Brevo is configured (sent right after this mutation commits).
  const emailed = emailConfigured();
  if (emailed) {
    const [user, inviter] = await Promise.all([ctx.db.get(userId), ctx.db.get(createdBy)]);
    if (user) {
      await ctx.scheduler.runAfter(0, internal.inviteEmail.sendInvite, {
        to: user.email, name: user.full_name, token, invitedBy: inviter?.full_name ?? "Your PI",
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
    return await issueInvite(ctx, user_id, me._id);
  },
});

/** Public: who is this invite for? Returns null for unknown or expired links. */
export const lookup = query({
  args: { invite: v.string() },
  handler: async (ctx, { invite }) => {
    const row = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", invite)).first();
    if (!row || row.expires_at < Date.now()) return null;
    const user = await ctx.db.get(row.user_id);
    if (!user || !user.is_active || user.hashed_password !== NO_PASSWORD) return null;
    return { email: user.email, full_name: user.full_name };
  },
});

export const consume = internalMutation({
  args: { invite: v.string(), hashed_password: v.string() },
  handler: async (ctx, { invite, hashed_password }) => {
    const row = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", invite)).first();
    if (!row || row.expires_at < Date.now()) throw new ConvexError("This invite link is invalid or has expired. Ask your PI for a new one.");
    const user = await ctx.db.get(row.user_id);
    if (!user || !user.is_active || user.hashed_password !== NO_PASSWORD) {
      throw new ConvexError("This invite has already been used");
    }
    await ctx.db.patch(user._id, { hashed_password, failed_login_attempts: 0, updated_at: Date.now() });
    await ctx.db.delete(row._id);
    return { email: user.email };
  },
});

/** Public: set your own password from an invite link. The client then signs in normally. */
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
