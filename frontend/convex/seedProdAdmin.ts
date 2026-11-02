/**
 * Production admin account setup.
 * Run once after deployment: npx convex run seedProdAdmin:createAdmin
 *
 * IMPORTANT: Change the default password immediately after first login!
 */
import { internalAction, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
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

    // Enforce minimum password strength for production admin
    if (password.length < 12) {
      throw new ConvexError("Admin password must be at least 12 characters");
    }

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

    // Every account must belong to a lab, or the app has nothing to show it. Give a lab-less admin one.
    const ensureLab = async (userId: Id<"users">) => {
      const labId = await ctx.db.insert("labs", { name: "My Lab", pi_user_id: userId, created_at: Date.now() });
      await ctx.db.patch(userId, { home_lab_id: labId, updated_at: Date.now() });
    };
    if (existing) {
      if (!existing.home_lab_id) { await ensureLab(existing._id); return `Admin ${email} was missing a lab: created "My Lab" for it`; }
      return `Admin already exists: ${email}`;
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
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

    await ensureLab(userId);
    return `Admin created: ${email} (lab "My Lab")`;
  },
});
