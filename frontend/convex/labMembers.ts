import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── List all members of a lab ─────────────────────────────────────────────

export const listForLab = query({
  args: {
    token: v.optional(v.string()),
    lab_id: v.id("labs"),
  },
  handler: async (ctx, { token, lab_id }) => {
    await requireAuth(ctx, token);
    const memberships = await ctx.db
      .query("lab_memberships")
      .withIndex("by_lab", (q) => q.eq("lab_id", lab_id))
      .collect();

    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.user_id);
        return { ...m, user };
      })
    );
  },
});

// ── List labs the current user belongs to ────────────────────────────────

export const listMy = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);

    // Look up our internal users record by the auth identity
    const user = await ctx.db
      .query("users")
      .withIndex("by_email")
      .filter((q) => q.eq(q.field("email"), userId))
      .first();

    // If the auth userId is already a users table ID, fall back to direct lookup
    const internalUser = user ?? (await ctx.db.get(userId as unknown as any));
    if (!internalUser) return [];

    const memberships = await ctx.db
      .query("lab_memberships")
      .withIndex("by_user", (q) => q.eq("user_id", internalUser._id as any))
      .collect();

    return await Promise.all(
      memberships.map(async (m) => {
        const lab = await ctx.db.get(m.lab_id);
        return { ...m, lab };
      })
    );
  },
});

// ── Invite a user to a lab ────────────────────────────────────────────────

export const invite = mutation({
  args: {
    token: v.optional(v.string()),
    lab_id: v.id("labs"),
    user_id: v.id("users"),
    lab_role: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, lab_id, user_id, lab_role, notes }) => {
    const authId = await requireAuth(ctx, token);

    // Resolve inviter's internal user record
    const inviter = await ctx.db
      .query("users")
      .withIndex("by_email")
      .filter((q) => q.eq(q.field("email"), authId))
      .first();

    const invitedBy = inviter?._id ?? (authId as unknown as any);

    // Check for existing membership
    const existing = await ctx.db
      .query("lab_memberships")
      .withIndex("by_lab", (q) => q.eq("lab_id", lab_id))
      .filter((q) => q.eq(q.field("user_id"), user_id))
      .first();

    if (existing) throw new Error("User already has a membership for this lab");

    return await ctx.db.insert("lab_memberships", {
      lab_id: lab_id,
      user_id: user_id,
      lab_role: lab_role,
      status: "invited",
      invited_by: invitedBy,
      notes: notes,
      created_at: Date.now(),
    });
  },
});

// ── Approve an invitation ─────────────────────────────────────────────────

export const approve = mutation({
  args: {
    token: v.optional(v.string()),
    membership_id: v.id("lab_memberships"),
  },
  handler: async (ctx, { token, membership_id }) => {
    await requireAuth(ctx, token);
    const membership = await ctx.db.get(membership_id);
    if (!membership) throw new Error("Membership not found");

    await ctx.db.patch(membership_id, {
      status: "active",
      joined_at: Date.now(),
    });
    return membership_id;
  },
});

// ── Revoke a membership ───────────────────────────────────────────────────

export const revoke = mutation({
  args: {
    token: v.optional(v.string()),
    membership_id: v.id("lab_memberships"),
  },
  handler: async (ctx, { token, membership_id }) => {
    await requireAuth(ctx, token);
    const membership = await ctx.db.get(membership_id);
    if (!membership) throw new Error("Membership not found");

    await ctx.db.patch(membership_id, { status: "revoked" });
    return membership_id;
  },
});

// ── Update a member's role ────────────────────────────────────────────────

export const updateRole = mutation({
  args: {
    token: v.optional(v.string()),
    membership_id: v.id("lab_memberships"),
    lab_role: v.string(),
  },
  handler: async (ctx, { token, membership_id, lab_role }) => {
    await requireAuth(ctx, token);
    const membership = await ctx.db.get(membership_id);
    if (!membership) throw new Error("Membership not found");

    await ctx.db.patch(membership_id, { lab_role: lab_role });
    return membership_id;
  },
});

// ── Pending approvals for labs the current user manages ───────────────────

export const pendingApprovals = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const authId = await requireAuth(ctx, token);

    // Resolve the current user's internal record
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email")
      .filter((q) => q.eq(q.field("email"), authId))
      .first();

    const currentUserId = currentUser?._id ?? (authId as unknown as any);

    // Find labs where this user is PI or has an active membership with manager/admin role
    const allLabs = await ctx.db.query("labs").collect();
    const managedLabIds = new Set<string>();

    for (const lab of allLabs) {
      if (lab.pi_user_id && lab.pi_user_id === currentUserId) {
        managedLabIds.add(lab._id);
        continue;
      }

      const activeMembership = await ctx.db
        .query("lab_memberships")
        .withIndex("by_lab", (q) => q.eq("lab_id", lab._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("user_id"), currentUserId),
            q.eq(q.field("status"), "active"),
            q.or(
              q.eq(q.field("lab_role"), "pi"),
              q.eq(q.field("lab_role"), "manager"),
              q.eq(q.field("lab_role"), "admin")
            )
          )
        )
        .first();

      if (activeMembership) managedLabIds.add(lab._id);
    }

    if (managedLabIds.size === 0) return [];

    // Collect all pending invitations for those labs
    const pending: any[] = [];
    for (const labId of managedLabIds) {
      const invitations = await ctx.db
        .query("lab_memberships")
        .withIndex("by_lab", (q) => q.eq("lab_id", labId as any))
        .filter((q) => q.eq(q.field("status"), "invited"))
        .collect();

      for (const inv of invitations) {
        const user = await ctx.db.get(inv.user_id);
        const lab = await ctx.db.get(inv.lab_id);
        pending.push({ ...inv, user, lab });
      }
    }

    return pending;
  },
});
