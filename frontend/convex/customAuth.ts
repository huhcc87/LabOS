/**
 * Custom password authentication — no OAuth, no rotating secrets.
 * Uses bcryptjs for hashing + a sessions table for token storage.
 */
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { checkRateLimit } from "./rateLimit";

// ── Token helpers ─────────────────────────────────────────────────────────
function generateToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 64);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.charAt(0)}***@${domain}`;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (hardened)

// ── Register ─────────────────────────────────────────────────────────────
export const register = action({
  args: {
    email: v.string(),
    password: v.string(),
    full_name: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, full_name, role }): Promise<{ token: string; user_id: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    checkRateLimit(`register:${normalizedEmail}`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new ConvexError("Invalid email format");
    if (password.length < 8) throw new ConvexError("Password must be at least 8 characters");
    if (!/\d/.test(password)) throw new ConvexError("Password must contain at least one digit");
    if (full_name.trim().length < 2) throw new ConvexError("Name must be at least 2 characters");
    const bcrypt = await import("bcryptjs");
    const hashed_password = await bcrypt.hash(password, 12);
    const token = generateToken();

    const result = await ctx.runMutation(internal.customAuth.createUserAndSession, {
      email,
      hashed_password,
      full_name,
      role: (role as any) ?? "staff",
      token,
      expires_at: Date.now() + SESSION_TTL_MS,
    });

    return result;
  },
});

// ── Login ─────────────────────────────────────────────────────────────────
export const login = action({
  args: { email: v.string(), password: v.string(), totp_code: v.optional(v.string()) },
  handler: async (ctx, { email, password, totp_code }): Promise<{ token: string; user: Record<string, any>; totp_required?: boolean }> => {
    checkRateLimit(`login:${email.trim().toLowerCase()}`);
    const bcrypt = await import("bcryptjs");

    const user = await ctx.runQuery(internal.customAuth.getUserByEmail, { email });
    if (!user) throw new ConvexError("Invalid email or password");
    if (!user.is_active) throw new ConvexError("Account is disabled");

    // Account lockout check (5 failed attempts → 30 min lock)
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MS = 30 * 60 * 1000;
    if (user.failed_login_attempts >= MAX_ATTEMPTS && user.locked_until && user.locked_until > Date.now()) {
      const minutes = Math.ceil((user.locked_until - Date.now()) / 60000);
      await ctx.runMutation(internal.customAuth.logSecurityEvent, {
        user_id: user._id,
        action: "LOGIN_BLOCKED_LOCKED",
        severity: "HIGH",
        details: `Blocked login attempt for locked account ${maskEmail(email)} (${minutes}min remaining)`,
      });
      throw new ConvexError(`Account locked. Try again in ${minutes} minute(s).`);
    }

    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) {
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      await ctx.runMutation(internal.customAuth.trackFailedLogin, {
        user_id: user._id,
        attempts,
        locked_until: locked ? Date.now() + LOCKOUT_MS : undefined,
      });
      await ctx.runMutation(internal.customAuth.logSecurityEvent, {
        user_id: user._id,
        action: locked ? "ACCOUNT_LOCKED_BRUTE_FORCE" : "LOGIN_FAILED",
        severity: locked ? "HIGH" : "WARN",
        details: `Failed login for ${maskEmail(email)} (attempt ${attempts})`,
      });
      throw new ConvexError("Invalid email or password");
    }

    // 2FA check: if TOTP is enabled, verify the code
    if (user.totp_enabled && user.totp_secret) {
      if (!totp_code) {
        return { token: "", user: {}, totp_required: true };
      }
      const { verifySync } = await import("otplib");
      const totpValid = verifySync({ secret: user.totp_secret, token: totp_code }).valid;
      if (!totpValid) throw new ConvexError("Invalid two-factor code");
    }

    // Reset failed attempts on successful login
    if (user.failed_login_attempts > 0) {
      await ctx.runMutation(internal.customAuth.trackFailedLogin, {
        user_id: user._id,
        attempts: 0,
        locked_until: undefined,
      });
    }

    const token = generateToken();
    await ctx.runMutation(internal.customAuth.createSession, {
      user_id: user._id,
      token,
      expires_at: Date.now() + SESSION_TTL_MS,
    });

    await ctx.runMutation(internal.customAuth.logSecurityEvent, {
      user_id: user._id,
      action: "LOGIN_SUCCESS",
      severity: "INFO",
      details: `Successful login for ${maskEmail(email)} (${user.role})`,
    });

    return {
      token,
      user: {
        _id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        avatar_url: user.avatar_url,
      },
    };
  },
});

// ── Logout ───────────────────────────────────────────────────────────────
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) {
      await ctx.db.insert("audit_logs", {
        user_id: session.user_id,
        action: "LOGOUT",
        entity_type: "auth",
        details: "User logged out",
        created_at: Date.now(),
      });
      await ctx.db.delete(session._id);
    }
  },
});

// ── Get current user by token ─────────────────────────────────────────────
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session || session.expires_at < Date.now()) return null;
    const user = await ctx.db.get(session.user_id);
    if (!user || !user.is_active) return null;
    const { hashed_password: _, ...safeUser } = user;
    return safeUser;
  },
});

// ── Internal mutations (called by actions above) ──────────────────────────
export const getSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const getUserById = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    return await ctx.db.get(user_id);
  },
});

export const trackFailedLogin = internalMutation({
  args: {
    user_id: v.id("users"),
    attempts: v.number(),
    locked_until: v.optional(v.number()),
  },
  handler: async (ctx, { user_id, attempts, locked_until }) => {
    await ctx.db.patch(user_id, {
      failed_login_attempts: attempts,
      locked_until,
      updated_at: Date.now(),
    });
  },
});

export const createSession = internalMutation({
  args: {
    user_id: v.id("users"),
    token: v.string(),
    expires_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      user_id: args.user_id,
      token: args.token,
      expires_at: args.expires_at,
      created_at: Date.now(),
    });
  },
});

export const createUserAndSession = internalMutation({
  args: {
    email: v.string(),
    hashed_password: v.string(),
    full_name: v.string(),
    role: v.union(
      v.literal("superadmin"), v.literal("admin"), v.literal("pi"),
      v.literal("manager"), v.literal("staff"), v.literal("trainee")
    ),
    token: v.string(),
    expires_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check unique email
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) throw new ConvexError("Email already registered");

    const userId = await ctx.db.insert("users", {
      email: args.email,
      hashed_password: args.hashed_password,
      full_name: args.full_name,
      role: args.role,
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await ctx.db.insert("sessions", {
      user_id: userId,
      token: args.token,
      expires_at: args.expires_at,
      created_at: Date.now(),
    });

    return { token: args.token, user_id: userId };
  },
});

// ── Security audit event logging ────────────────────────────────────────
export const logSecurityEvent = internalMutation({
  args: {
    user_id: v.id("users"),
    action: v.string(),
    severity: v.string(),
    details: v.string(),
  },
  handler: async (ctx, { user_id, action, severity, details }) => {
    await ctx.db.insert("audit_logs", {
      user_id,
      action,
      entity_type: "auth",
      details: `[${severity}] ${details}`,
      created_at: Date.now(),
    });
  },
});

// ── Admin: reset another user's password ──────────────────────────────────
export const adminResetPassword = action({
  args: { token: v.string(), target_email: v.string(), new_password: v.string() },
  handler: async (ctx, { token, target_email, new_password }): Promise<{ success: true }> => {
    if (new_password.length < 8) throw new ConvexError("Password must be at least 8 characters");
    if (!/\d/.test(new_password)) throw new ConvexError("Password must contain at least one digit");

    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new ConvexError("Unauthorized");

    const admin = await ctx.runQuery(internal.customAuth.getUserById, { user_id: session.user_id });
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError("Admin access required");
    }

    const target = await ctx.runQuery(internal.customAuth.getUserByEmail, { email: target_email.trim().toLowerCase() });
    if (!target) throw new ConvexError("No user found with that email");

    const bcrypt = await import("bcryptjs");
    const hashed_password = await bcrypt.hash(new_password, 12);

    await ctx.runMutation(internal.customAuth.setPasswordAndUnlock, {
      user_id: target._id,
      hashed_password,
    });

    await ctx.runMutation(internal.customAuth.logSecurityEvent, {
      user_id: target._id,
      action: "ADMIN_PASSWORD_RESET",
      severity: "HIGH",
      details: `Admin ${maskEmail(admin.email)} reset password for ${maskEmail(target.email)}`,
    });

    return { success: true };
  },
});

export const setPasswordAndUnlock = internalMutation({
  args: { user_id: v.id("users"), hashed_password: v.string() },
  handler: async (ctx, { user_id, hashed_password }) => {
    await ctx.db.patch(user_id, {
      hashed_password,
      failed_login_attempts: 0,
      locked_until: undefined,
      updated_at: Date.now(),
    });
  },
});

// ── Force logout all users (admin) ──────────────────────────────────────
export const forceLogoutAll = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session) throw new Error("Unauthorized");
    const user = await ctx.db.get(session.user_id);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Admin access required");
    }

    const allSessions = await ctx.db.query("sessions").collect();
    let count = 0;
    for (const s of allSessions) {
      if (s._id !== session._id) {
        await ctx.db.delete(s._id);
        count++;
      }
    }

    await ctx.db.insert("audit_logs", {
      user_id: session.user_id,
      action: "ADMIN_FORCE_LOGOUT",
      entity_type: "auth",
      details: `[HIGH] Admin force-logged out ${count} session(s)`,
      created_at: Date.now(),
    });

    return { cleared: count };
  },
});
