import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const setupTotp = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ secret: string; otpauth_url: string }> => {
    const session = await ctx.runQuery(api.totp.getSession, { token });
    if (!session) throw new Error("Unauthorized");

    const { generateSecret, generateURI } = await import("otplib");
    const secret = generateSecret();
    const otpauth_url = generateURI({ issuer: "LabOS", label: session.email, secret });

    await ctx.runMutation(api.totp.storePendingSecret, {
      user_id: session.user_id,
      secret,
    });

    return { secret, otpauth_url };
  },
});

export const verifyAndEnable = action({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, { token, code }): Promise<{ success: boolean }> => {
    const session = await ctx.runQuery(api.totp.getSession, { token });
    if (!session) throw new Error("Unauthorized");

    const user = await ctx.runQuery(api.totp.getUser, { user_id: session.user_id });
    if (!user || !user.totp_secret) throw new Error("TOTP not set up");

    const { verifySync } = await import("otplib");
    const result = verifySync({ token: code, secret: user.totp_secret });
    if (!(result as any).valid) throw new Error("Invalid verification code");

    await ctx.runMutation(api.totp.enableTotp, { user_id: session.user_id });
    return { success: true };
  },
});

export const disable = action({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, { token, password }): Promise<{ success: boolean }> => {
    const session = await ctx.runQuery(api.totp.getSession, { token });
    if (!session) throw new Error("Unauthorized");

    const user = await ctx.runQuery(api.totp.getUser, { user_id: session.user_id });
    if (!user) throw new Error("Unauthorized");

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) throw new Error("Invalid password");

    await ctx.runMutation(api.totp.disableTotp, { user_id: session.user_id });
    return { success: true };
  },
});

export const verifyLogin = action({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }): Promise<{ valid: boolean }> => {
    const user = await ctx.runQuery(api.customAuth.getUserByEmail, { email });
    if (!user || !user.totp_secret || !user.totp_enabled) {
      throw new Error("TOTP not enabled");
    }

    const { verifySync } = await import("otplib");
    const result = verifySync({ token: code, secret: user.totp_secret });
    return { valid: !!(result as any).valid };
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

export const getUser = query({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    return await ctx.db.get(user_id);
  },
});

export const storePendingSecret = mutation({
  args: { user_id: v.id("users"), secret: v.string() },
  handler: async (ctx, { user_id, secret }) => {
    await ctx.db.patch(user_id, {
      totp_secret: secret,
      totp_enabled: false,
      updated_at: Date.now(),
    });
  },
});

export const enableTotp = mutation({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    await ctx.db.patch(user_id, {
      totp_enabled: true,
      updated_at: Date.now(),
    });
    await ctx.db.insert("audit_logs", {
      user_id,
      action: "TOTP_ENABLED",
      entity_type: "auth",
      details: "[INFO] Two-factor authentication enabled",
      created_at: Date.now(),
    });
  },
});

export const disableTotp = mutation({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    await ctx.db.patch(user_id, {
      totp_secret: undefined,
      totp_enabled: false,
      updated_at: Date.now(),
    });
    await ctx.db.insert("audit_logs", {
      user_id,
      action: "TOTP_DISABLED",
      entity_type: "auth",
      details: "[WARN] Two-factor authentication disabled",
      created_at: Date.now(),
    });
  },
});
