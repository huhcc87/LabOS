import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { requireAuth, requireRole, hasRole, sanitizeUser } from "./authHelper";
import { issueInvite, NO_PASSWORD } from "./invites";
import { sha256Hex } from "./cryptoSecrets";

export const getMe = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const hashed = await sha256Hex(token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", hashed))
      .first();
    if (!session || session.expires_at < Date.now()) return null;
    const user = await ctx.db.get(session.user_id);
    if (!user || !user.is_active) return null;
    const { hashed_password: _h, totp_secret: _t, recovery_codes: _r, ...safeUser } = user;
    return safeUser;
  },
});

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("superadmin"),
        v.literal("admin"),
        v.literal("pi"),
        v.literal("manager"),
        v.literal("staff"),
        v.literal("trainee")
      )
    ),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.token, "admin");
    const numItems = args.paginationOpts?.numItems ?? 20;
    const cursor = args.paginationOpts?.cursor ?? null;

    let dbQuery;
    if (args.role) {
      dbQuery = ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", args.role!));
    } else {
      dbQuery = ctx.db.query("users");
    }

    const result = await dbQuery.paginate({ numItems, cursor });

    // client-side search filter (Convex search index only covers one field;
    // role index + search don't compose — filter in memory for small sets)
    if (args.search) {
      const term = args.search.toLowerCase();
      result.page = result.page.filter(
        (u) =>
          u.full_name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.department ?? "").toLowerCase().includes(term)
      );
    }

    return {
      ...result,
      page: result.page.map((u) => ({ ...sanitizeUser(u), invite_pending: u.hashed_password === NO_PASSWORD })),
    };
  },
});

export const getById = query({
  args: { token: v.optional(v.string()), id: v.id("users") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    return sanitizeUser(user);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    email: v.string(),
    full_name: v.string(),
    role: v.union(
      v.literal("superadmin"),
      v.literal("admin"),
      v.literal("pi"),
      v.literal("manager"),
      v.literal("staff"),
      v.literal("trainee")
    ),
    department: v.optional(v.string()),
    position: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    data_classification_clearance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, args.token, "admin");
    if (!hasRole(caller.role, args.role)) {
      throw new ConvexError("Forbidden: cannot grant a role higher than your own");
    }
    const email = args.email.trim().toLowerCase();
    // Emails are unique across all labs, so check without the lab filter.
    const existing = await ctx.rawDb.query("users").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (existing) throw new ConvexError("A user with this email already exists");
    const now = Date.now();
    const id = await ctx.db.insert("users", {
      email,
      hashed_password: NO_PASSWORD,
      full_name: args.full_name,
      role: args.role,
      department: args.department,
      position: args.position,
      phone: args.phone,
      avatar_url: args.avatar_url,
      data_classification_clearance: args.data_classification_clearance,
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: now,
      updated_at: now,
    });
    // The new user signs up through this one-time link and picks their own password.
    const { token: invite_token, emailed } = await issueInvite(ctx, id, caller._id);
    return { id, invite_token, emailed };
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("users"),
    full_name: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("superadmin"),
        v.literal("admin"),
        v.literal("pi"),
        v.literal("manager"),
        v.literal("staff"),
        v.literal("trainee")
      )
    ),
    department: v.optional(v.string()),
    position: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    totp_enabled: v.optional(v.boolean()),
    failed_login_attempts: v.optional(v.number()),
    locked_until: v.optional(v.number()),
    data_classification_clearance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, args.token, "admin");
    if (args.role && !hasRole(caller.role, args.role)) {
      throw new ConvexError("Forbidden: cannot grant a role higher than your own");
    }
    const { id, token: _, ...fields } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("users") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.token, "admin");
    await ctx.db.patch(args.id, {
      is_active: false,
      updated_at: Date.now(),
    });
    return { success: true };
  },
});
