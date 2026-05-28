import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const list = query({
  args: {
    token: v.optional(v.string()),
    entity_type: v.string(),
    entity_id: v.string(),
  },
  handler: async (ctx, { entity_type, entity_id }) => {
    return ctx.db
      .query("attachments")
      .withIndex("by_entity", (q) =>
        q.eq("entity_type", entity_type).eq("entity_id", entity_id)
      )
      .collect();
  },
});

export const upload = mutation({
  args: {
    token: v.optional(v.string()),
    entity_type: v.string(),
    entity_id: v.string(),
    filename: v.string(),
    file_size: v.optional(v.number()),
    mime_type: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, { token, entity_type, entity_id, filename, file_size, mime_type, url }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.insert("attachments", {
      entity_type,
      entity_id,
      filename,
      file_size,
      mime_type,
      url,
      uploaded_by: userId,
      created_at: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("attachments"),
  },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.delete(id);
    return { success: true };
  },
});

export const get = query({
  args: { id: v.id("attachments") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});
