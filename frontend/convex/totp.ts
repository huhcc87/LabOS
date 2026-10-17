import { action, mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { sealSecret, openSecret } from "./cryptoSecrets";

export const setupTotp = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ secret: string; otpauth_url: string }> => {
    const session = await ctx.runQuery(api.totp.getSession, { token });
    if (!session) throw new ConvexError("Unauthorized");

    // Re-running setup would quietly switch two-factor off. Turning it off needs the password (disable below).
    const existing = await ctx.runQuery(internal.totp.getUser, { user_id: session.user_id });
    if (existing?.totp_enabled) throw new ConvexError("Two-factor is already on. Turn it off first if you want to set it up again.");

    const { generateSecret, generateURI } = await import("otplib");
    const secret = generateSecret();
    const otpauth_url = generateURI({ issuer: "LabOS", label: session.email, secret });

    await ctx.runMutation(internal.totp.storePendingSecret, {
      user_id: session.user_id,
      secret: await sealSecret(secret),
    });

    return { secret, otpauth_url };
  },
});

export const verifyAndEnable = action({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, { token, code }): Promise<{ success: boolean }> => {
    const session = await ctx.runQuery(api.totp.getSession, { token });
    if (!session) throw new ConvexError("Unauthorized");

    const user = await ctx.runQuery(internal.totp.getUser, { user_id: session.user_id });
    if (!user || !user.totp_secret) throw new ConvexError("TOTP not set up");

    const { verifySync } = await import("otplib");
    const isValid = verifySync({ secret: await openSecret(user.totp_secret), token: code }).valid;
    if (!isValid) throw new ConvexError("Invalid verification code");

    await ctx.runMutation(internal.totp.enableTotp, { user_id: session.user_id });
    return { success: true };
  },
});

export const disable = action({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, { token, password }): Promise<{ success: boolean }> => {
    const session = await ctx.runQuery(api.totp.getSession, { token });
    if (!session) throw new ConvexError("Unauthorized");

    const user = await ctx.runQuery(internal.totp.getUser, { user_id: session.user_id });
    if (!user) throw new ConvexError("Unauthorized");

    await ctx.runMutation(internal.security.rateLimit, { key: `2fa-off:${session.user_id}`, max: 5, window_ms: 15 * 60_000 });
    if (await ctx.runQuery(internal.security.disableBlocked, { user_id: session.user_id })) {
      throw new ConvexError("Your lab requires two-factor for your role, so it can't be turned off.");
    }
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) throw new ConvexError("Invalid password");

    await ctx.runMutation(internal.totp.disableTotp, { user_id: session.user_id });
    return { success: true };
  },
});

// Internal helpers
export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session || session.expires_at < Date.now()) return null;
    const user = await ctx.db.get(session.user_id);
    if (!user || !user.is_active) return null;
    return { user_id: session.user_id, email: user.email };
  },
});

export const getUser = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    return await ctx.db.get(user_id);
  },
});

export const storePendingSecret = internalMutation({
  args: { user_id: v.id("users"), secret: v.string() },
  handler: async (ctx, { user_id, secret }) => {
    await ctx.db.patch(user_id, {
      totp_secret: secret,
      totp_enabled: false,
      updated_at: Date.now(),
    });
  },
});

export const enableTotp = internalMutation({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    await ctx.db.patch(user_id, {
      totp_enabled: true,
      updated_at: Date.now(),
    });
    await ctx.db.insert("audit_logs", {
      lab_id: (await ctx.db.get(user_id))?.home_lab_id,
      user_id,
      action: "TOTP_ENABLED",
      entity_type: "auth",
      details: "[INFO] Two-factor authentication enabled",
      created_at: Date.now(),
    });
  },
});

export const disableTotp = internalMutation({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    await ctx.db.patch(user_id, {
      totp_secret: undefined,
      recovery_codes: undefined,
      totp_enabled: false,
      updated_at: Date.now(),
    });
    await ctx.db.insert("audit_logs", {
      lab_id: (await ctx.db.get(user_id))?.home_lab_id,
      user_id,
      action: "TOTP_DISABLED",
      entity_type: "auth",
      details: "[WARN] Two-factor authentication disabled",
      created_at: Date.now(),
    });
  },
});
