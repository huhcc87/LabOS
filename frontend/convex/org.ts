import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Organizations ──────────────────────────────────────────────────────────

export const listOrgs = query({
  args: {},
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    return await ctx.db.query("organizations").collect();
  },
});

export const createOrg = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("organizations", {
      name: args.name,
      description: args.description,
      website: args.website,
      created_at: now,
    });
  },
});

export const updateOrg = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.website !== undefined) patch.website = fields.website;
    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Sites ─────────────────────────────────────────────────────────────────

export const listSites = query({
  args: {
    org_id: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    if (args.org_id !== undefined) {
      return await ctx.db
        .query("sites")
        .withIndex("by_org", (q) => q.eq("organization_id", args.org_id!))
        .collect();
    }
    return await ctx.db.query("sites").collect();
  },
});

export const createSite = mutation({
  args: {
    organization_id: v.id("organizations"),
    name: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await ctx.db.insert("sites", {
      organization_id: args.organization_id,
      name: args.name,
      address: args.address,
      city: args.city,
      country: args.country,
      created_at: Date.now(),
    });
  },
});

export const updateSite = mutation({
  args: {
    id: v.id("sites"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.address !== undefined) patch.address = fields.address;
    if (fields.city !== undefined) patch.city = fields.city;
    if (fields.country !== undefined) patch.country = fields.country;
    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Labs ──────────────────────────────────────────────────────────────────

export const listLabs = query({
  args: {
    site_id: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    if (args.site_id !== undefined) {
      return await ctx.db
        .query("labs")
        .withIndex("by_site", (q) => q.eq("site_id", args.site_id!))
        .collect();
    }
    return await ctx.db.query("labs").collect();
  },
});

export const createLab = mutation({
  args: {
    site_id: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    pi_user_id: v.optional(v.id("users")),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await ctx.db.insert("labs", {
      site_id: args.site_id,
      name: args.name,
      description: args.description,
      pi_user_id: args.pi_user_id,
      department: args.department,
      created_at: Date.now(),
    });
  },
});

export const updateLab = mutation({
  args: {
    id: v.id("labs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    pi_user_id: v.optional(v.id("users")),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.pi_user_id !== undefined) patch.pi_user_id = fields.pi_user_id;
    if (fields.department !== undefined) patch.department = fields.department;
    await ctx.db.patch(id, patch);
    return id;
  },
});
