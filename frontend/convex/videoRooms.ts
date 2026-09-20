import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const createRoom = mutation({
  args: {
    token: v.optional(v.string()),
    meeting_id: v.optional(v.id("meetings")),
  },
  handler: async (ctx, { token, meeting_id }) => {
    const userId = await requireAuth(ctx, token);
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const id = await ctx.db.insert("video_rooms", {
      room_id: roomId,
      meeting_id,
      status: "active",
      created_by: userId,
      created_at: Date.now(),
    });
    return { _id: id, room_id: roomId };
  },
});

export const getRoom = query({
  args: { room_id: v.string() },
  handler: async (ctx, { room_id }) => {
    return ctx.db
      .query("video_rooms")
      .withIndex("by_room_id", (q) => q.eq("room_id", room_id))
      .first();
  },
});

export const getRoomForMeeting = query({
  args: { meeting_id: v.id("meetings") },
  handler: async (ctx, { meeting_id }) => {
    return ctx.db
      .query("video_rooms")
      .withIndex("by_meeting", (q) => q.eq("meeting_id", meeting_id))
      .order("desc")
      .first();
  },
});

export const deleteRoom = mutation({
  args: { token: v.optional(v.string()), room_id: v.string() },
  handler: async (ctx, { token, room_id }) => {
    await requireAuth(ctx, token);
    const room = await ctx.db
      .query("video_rooms")
      .withIndex("by_room_id", (q) => q.eq("room_id", room_id))
      .first();
    if (room) {
      await ctx.db.patch(room._id, { status: "ended", ended_at: Date.now() });
    }
    return { success: true };
  },
});

export const getChatHistory = query({
  args: { room_id: v.string() },
  handler: async (ctx, { room_id }) => {
    return ctx.db
      .query("video_chat_messages")
      .withIndex("by_room", (q) => q.eq("room_id", room_id))
      .collect();
  },
});

export const sendChatMessage = mutation({
  args: {
    token: v.optional(v.string()),
    room_id: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { token, room_id, message }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db.insert("video_chat_messages", {
      room_id,
      user_id: userId,
      message,
      created_at: Date.now(),
    });
  },
});
