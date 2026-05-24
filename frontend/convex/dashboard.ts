import { query } from "./_generated/server";
import { v } from "convex/values";

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Total samples
    const samples = await ctx.db.query("samples").collect();
    const total_samples = samples.length;

    // Low-stock inventory items (quantity <= minimum_quantity)
    const inventoryItems = await ctx.db.query("inventory").collect();
    const low_stock_items = inventoryItems.filter(
      (item) =>
        item.minimum_quantity !== undefined &&
        item.quantity <= item.minimum_quantity
    ).length;

    // Pending tasks (any status that is not "completed" or "cancelled")
    const pendingTasksList = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const inProgressTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();
    const pending_tasks = pendingTasksList.length + inProgressTasks.length;

    // Active incidents (status = "open" or "investigating")
    const openIncidents = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const investigatingIncidents = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "investigating"))
      .collect();
    const active_incidents = openIncidents.length + investigatingIncidents.length;

    // Upcoming instrument bookings (start_time > now, status = "confirmed" or "pending")
    const upcomingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_start")
      .order("asc")
      .collect();
    const upcoming_bookings = upcomingBookings.filter(
      (b) => b.start_time > now && b.status !== "cancelled"
    ).length;

    // Pending reminders (status = "pending")
    const pendingRemindersList = await ctx.db
      .query("reminders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const pending_reminders = pendingRemindersList.length;

    // Recent activity (last 10 items ordered by created_at desc)
    const recent_activity = await ctx.db
      .query("activity")
      .withIndex("by_created")
      .order("desc")
      .take(10);

    return {
      total_samples,
      low_stock_items,
      pending_tasks,
      active_incidents,
      upcoming_bookings,
      pending_reminders,
      recent_activity,
    };
  },
});
