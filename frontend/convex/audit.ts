import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── List audit logs (paginated, filter by entity_type) ────────────────────────

export const list = query({
  args: {
    entity_type: v.optional(v.string()),
    page: v.optional(v.number()),
    per_page: v.optional(v.number()),
    user_id: v.optional(v.id("users")),
  },
  handler: async (ctx, { entity_type, page, per_page, user_id }) => {
    await getAuthUserId(ctx);

    let logs;

    if (user_id !== undefined) {
      logs = await ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("user_id", user_id))
        .order("desc")
        .collect();
      if (entity_type) {
        logs = logs.filter((l) => l.entity_type === entity_type);
      }
    } else if (entity_type) {
      logs = await ctx.db
        .query("audit_logs")
        .withIndex("by_entity", (q) => q.eq("entity_type", entity_type))
        .order("desc")
        .collect();
    } else {
      logs = await ctx.db.query("audit_logs").order("desc").collect();
    }

    const perPage = per_page ?? 50;
    const pageNum = page ?? 1;
    const startIdx = (pageNum - 1) * perPage;
    const items = logs.slice(startIdx, startIdx + perPage);
    const total = logs.length;
    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      total,
      page: pageNum,
      per_page: perPage,
      total_pages: totalPages,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1,
    };
  },
});

// ── Log an audit event ────────────────────────────────────────────────────────

export const log = mutation({
  args: {
    action: v.string(),
    entity_type: v.string(),
    entity_id: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    return await ctx.db.insert("audit_logs", {
      user_id: userId ?? undefined,
      action: args.action,
      entity_type: args.entity_type,
      entity_id: args.entity_id,
      details: args.details,
      created_at: Date.now(),
    });
  },
});
