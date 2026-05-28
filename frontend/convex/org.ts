import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── Organizations ──────────────────────────────────────────────────────────

export const listOrgs = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.db.query("organizations").collect();
  },
});

export const createOrg = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
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
    token: v.optional(v.string()),
    id: v.id("organizations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _token, ...fields } = args;
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
    token: v.optional(v.string()),
    org_id: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { token, org_id }) => {
    await requireAuth(ctx, token);
    if (org_id !== undefined) {
      return await ctx.db
        .query("sites")
        .withIndex("by_org", (q) => q.eq("organization_id", org_id!))
        .collect();
    }
    return await ctx.db.query("sites").collect();
  },
});

export const createSite = mutation({
  args: {
    token: v.optional(v.string()),
    organization_id: v.id("organizations"),
    name: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
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
    token: v.optional(v.string()),
    id: v.id("sites"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _token, ...fields } = args;
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
    token: v.optional(v.string()),
    site_id: v.optional(v.id("sites")),
  },
  handler: async (ctx, { token, site_id }) => {
    await requireAuth(ctx, token);
    if (site_id !== undefined) {
      return await ctx.db
        .query("labs")
        .withIndex("by_site", (q) => q.eq("site_id", site_id!))
        .collect();
    }
    return await ctx.db.query("labs").collect();
  },
});

export const createLab = mutation({
  args: {
    token: v.optional(v.string()),
    site_id: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    pi_user_id: v.optional(v.id("users")),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
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
    token: v.optional(v.string()),
    id: v.id("labs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    pi_user_id: v.optional(v.id("users")),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _token, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.pi_user_id !== undefined) patch.pi_user_id = fields.pi_user_id;
    if (fields.department !== undefined) patch.department = fields.department;
    await ctx.db.patch(id, patch);
    return id;
  },
});
