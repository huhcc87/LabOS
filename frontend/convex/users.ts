import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) return null;
    // authTables links auth identity → users row via email
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const email = identity.email;
    if (!email) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const list = query({
  args: {
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

    return result;
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
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
    phone: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    data_classification_clearance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      email: args.email,
      full_name: args.full_name,
      role: args.role,
      department: args.department,
      phone: args.phone,
      avatar_url: args.avatar_url,
      data_classification_clearance: args.data_classification_clearance,
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
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
    phone: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    totp_enabled: v.optional(v.boolean()),
    failed_login_attempts: v.optional(v.number()),
    locked_until: v.optional(v.number()),
    data_classification_clearance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      is_active: false,
      updated_at: Date.now(),
    });
    return { success: true };
  },
});
