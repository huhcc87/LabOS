/**
 * Production admin account setup.
 * Run once after deployment: npx convex run seedProdAdmin:createAdmin
 *
 * IMPORTANT: Change the default password immediately after first login!
 */
import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const createAdmin = internalAction({
  args: {
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    full_name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const email = args.email ?? "admin@labos.app";
    const password = args.password ?? "ChangeMeImmediately!2024";
    const fullName = args.full_name ?? "System Administrator";

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 12);

    const result: string = await ctx.runMutation(internal.seedProdAdmin.insertAdmin, {
      email,
      hashed_password: hashedPassword,
      full_name: fullName,
    });

    return result;
  },
});

export const insertAdmin = internalMutation({
  args: {
    email: v.string(),
    hashed_password: v.string(),
    full_name: v.string(),
  },
  handler: async (ctx, { email, hashed_password, full_name }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      return `Admin already exists: ${email}`;
    }

    const now = Date.now();
    await ctx.db.insert("users", {
      email,
      hashed_password,
      full_name,
      role: "superadmin",
      department: "Administration",
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: now,
      updated_at: now,
    });

    return `Admin created: ${email} — CHANGE PASSWORD ON FIRST LOGIN`;
  },
});
