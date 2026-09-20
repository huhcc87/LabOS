import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// Built-in lab assistant that answers from database context
// Can be upgraded to use external LLM API when credentials are available

export const chat = mutation({
  args: {
    token: v.optional(v.string()),
    question: v.string(),
  },
  handler: async (ctx, { token, question }) => {
    const userId = await requireAuth(ctx, token);
    const q = question.toLowerCase();

    let answer = "";
    const suggestions: string[] = [];

    // Query relevant data to build context-aware answers
    if (q.includes("inventory") || q.includes("stock") || q.includes("reagent")) {
      const items = await ctx.db.query("inventory").collect();
      const low = items.filter((i) => i.minimum_quantity !== undefined && i.quantity <= i.minimum_quantity);
      const outOfStock = items.filter((i) => i.quantity === 0);
      answer = `You have ${items.length} inventory items total. ${low.length} items are low stock, ${outOfStock.length} are out of stock.`;
      if (low.length > 0) {
        answer += ` Items needing attention: ${low.slice(0, 5).map((i) => i.name).join(", ")}.`;
        suggestions.push("Show low stock items", "Create purchase order");
      }
    } else if (q.includes("sample") || q.includes("specimen")) {
      const samples = await ctx.db.query("samples").collect();
      answer = `You have ${samples.length} samples tracked in the system.`;
      suggestions.push("View all samples", "Create new sample");
    } else if (q.includes("task") || q.includes("todo") || q.includes("assigned")) {
      const tasks = await ctx.db.query("tasks").collect();
      const pending = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
      answer = `There are ${tasks.length} total tasks, ${pending.length} are pending or in progress.`;
      suggestions.push("View pending tasks", "Create new task");
    } else if (q.includes("protocol")) {
      const protocols = await ctx.db.query("protocols").collect();
      answer = `You have ${protocols.length} protocols in the system.`;
      suggestions.push("View all protocols", "Create new protocol");
    } else if (q.includes("instrument") || q.includes("equipment")) {
      const instruments = await ctx.db.query("instruments").collect();
      const maintenance = instruments.filter((i) => i.status === "maintenance");
      answer = `You have ${instruments.length} instruments. ${maintenance.length} are currently in maintenance.`;
      suggestions.push("View instruments", "Schedule maintenance");
    } else if (q.includes("meeting") || q.includes("calendar")) {
      const meetings = await ctx.db.query("meetings").collect();
      const upcoming = meetings.filter((m) => m.scheduled_at > Date.now());
      answer = `You have ${upcoming.length} upcoming meetings scheduled.`;
      suggestions.push("View calendar", "Schedule a meeting");
    } else if (q.includes("grant") || q.includes("funding")) {
      const submissions = await ctx.db.query("grant_submissions").collect();
      answer = `You have ${submissions.length} grant submissions tracked.`;
      suggestions.push("View grant submissions", "Create new submission");
    } else if (q.includes("safety") || q.includes("incident")) {
      const incidents = await ctx.db.query("incidents").collect();
      const open = incidents.filter((i) => i.status === "open" || i.status === "investigating");
      answer = `There are ${incidents.length} incidents recorded, ${open.length} are currently open.`;
      suggestions.push("View incidents", "Report new incident");
    } else if (q.includes("iot") || q.includes("sensor") || q.includes("temperature")) {
      const sensors = await ctx.db.query("iot_sensors").collect();
      const alerts = await ctx.db.query("iot_alerts").collect();
      const unacked = alerts.filter((a) => !a.acknowledged_at);
      answer = `Monitoring ${sensors.length} IoT sensors. ${unacked.length} unacknowledged alerts.`;
      suggestions.push("View IoT dashboard", "View alerts");
    } else if (q.includes("freezer") || q.includes("storage") || q.includes("biobank")) {
      const freezers = await ctx.db.query("freezers").collect();
      answer = `You have ${freezers.length} freezers/storage units configured.`;
      suggestions.push("View freezer map", "Search stored samples");
    } else if (q.includes("help") || q.includes("what can you")) {
      answer = "I can help you with: inventory status, sample tracking, task management, protocol lookup, instrument status, meeting scheduling, grant submissions, safety incidents, IoT monitoring, and freezer management. Just ask!";
      suggestions.push("Inventory status", "Pending tasks", "Upcoming meetings");
    } else {
      // Generic response with system overview
      const tasks = await ctx.db.query("tasks").collect();
      const pending = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
      const alerts = await ctx.db.query("iot_alerts").collect();
      const unacked = alerts.filter((a) => !a.acknowledged_at);
      answer = `I'm your lab assistant. Currently: ${pending.length} pending tasks, ${unacked.length} unacknowledged alerts. Ask me about inventory, samples, tasks, protocols, instruments, or any other lab topic.`;
      suggestions.push("What can you help with?", "Inventory status", "Pending tasks");
    }

    // Save to chat history
    await ctx.db.insert("ai_chat_history", {
      user_id: userId,
      question,
      answer,
      created_at: Date.now(),
    });

    return { answer, suggestions, source: "built-in" };
  },
});

export const inventoryPredictions = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    const items = await ctx.db.query("inventory").collect();
    const predictions = [];
    for (const item of items) {
      const isOut = item.quantity === 0;
      const isLow = item.minimum_quantity !== undefined && item.quantity <= item.minimum_quantity;
      if (isOut || isLow) {
        predictions.push({
          item_id: item._id,
          name: item.name,
          current_quantity: item.quantity,
          predicted_runout: isOut ? "Now" : "Within 2 weeks",
          recommendation: isOut ? "Reorder immediately" : "Plan reorder",
          confidence: 0.8,
        });
      }
    }
    return predictions;
  },
});

export const history = query({
  args: { token: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { token, limit }) => {
    const userId = await requireAuth(ctx, token);
    return ctx.db
      .query("ai_chat_history")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .order("desc")
      .take(limit ?? 50);
  },
});
