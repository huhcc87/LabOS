import { query } from "./_generated/server";
import { v } from "convex/values";

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const in30 = now + 30 * 86_400_000;
    const in14 = now + 14 * 86_400_000;
    const sevenWeeksAgo = now - 56 * 86_400_000;

    // ── Basic counts ──────────────────────────────────────────────────────
    const [
      protocols, instruments, bookings, tasks, training,
      inventory, incidents, workspaces, samples, sampleEvents,
      calendarEvents, reminders, feedback, compliance,
    ] = await Promise.all([
      ctx.db.query("protocols").collect(),
      ctx.db.query("instruments").collect(),
      ctx.db.query("bookings").collect(),
      ctx.db.query("tasks").collect(),
      ctx.db.query("training").collect(),
      ctx.db.query("inventory").collect(),
      ctx.db.query("incidents").collect(),
      ctx.db.query("workspaces").collect(),
      ctx.db.query("samples").collect(),
      ctx.db.query("sample_events").collect(),
      ctx.db.query("calendar_events").collect(),
      ctx.db.query("reminders").collect(),
      ctx.db.query("feedback").collect(),
      ctx.db.query("compliance").collect(),
    ]);

    // ── Task stats ────────────────────────────────────────────────────────
    const tasks_open = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
    const overdue_tasks = tasks.filter(t => t.status === "overdue" || (t.due_date && t.due_date < now && t.status !== "completed")).length;
    const tasks_by_status: Record<string, number> = {};
    for (const t of tasks) {
      tasks_by_status[t.status] = (tasks_by_status[t.status] ?? 0) + 1;
    }

    // ── Incident stats ────────────────────────────────────────────────────
    const incidents_by_severity: Record<string, number> = {};
    for (const inc of incidents) {
      incidents_by_severity[inc.severity] = (incidents_by_severity[inc.severity] ?? 0) + 1;
    }

    // ── Sample stats ──────────────────────────────────────────────────────
    const samples_by_status: Record<string, number> = {};
    for (const s of samples) {
      samples_by_status[s.status] = (samples_by_status[s.status] ?? 0) + 1;
    }

    // ── Sample intake by week (last 8 weeks) ──────────────────────────────
    const sample_intake_by_week: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 86_400_000;
      const weekEnd = now - i * 7 * 86_400_000;
      const count = samples.filter(s => s.created_at >= weekStart && s.created_at < weekEnd).length;
      const d = new Date(weekStart);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      sample_intake_by_week.push({ week: label, count });
    }

    // ── Upcoming maintenance ──────────────────────────────────────────────
    const maintenanceRecs = await ctx.db.query("maintenance").collect();
    const upcoming_maintenance = maintenanceRecs.filter(m =>
      m.next_due && m.next_due > now && m.next_due < in30 && m.status !== "completed"
    ).length;

    // ── Inventory ─────────────────────────────────────────────────────────
    const low_stock_items = inventory.filter(i =>
      i.minimum_quantity !== undefined && i.quantity <= i.minimum_quantity
    ).length;

    // ── Pending reminders ─────────────────────────────────────────────────
    const reminders_pending = reminders.filter(r => r.status === "pending").length;
    const overdue_reminders = reminders.filter(r => r.status === "pending" && r.due_at < now).length;

    // ── Quarantine samples ────────────────────────────────────────────────
    const quarantine_samples = samples.filter(s => s.status === "quarantine").length;

    // ── Recent activity (from activity table) ─────────────────────────────
    const activityRows = await ctx.db
      .query("activity")
      .withIndex("by_created")
      .order("desc")
      .take(20);

    const audit_recent = activityRows.map(a => ({
      id: a._id,
      action: a.action,
      entity_type: a.entity_type ?? "",
      entity_id: a.entity_id ?? "",
      user_email: "",
      timestamp: new Date(a.created_at).toISOString(),
    }));

    // ── Today's tasks (due today or overdue) ──────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const today_tasks = tasks.filter(t =>
      t.status !== "completed" && t.status !== "cancelled" &&
      (t.status === "overdue" || (t.due_date && t.due_date >= todayStart.getTime() && t.due_date <= todayEnd.getTime()))
    ).slice(0, 10).map(t => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date ? new Date(t.due_date).toISOString().slice(0, 10) : null,
    }));

    // ── Equipment at risk ─────────────────────────────────────────────────
    const equipment_at_risk = instruments.filter(i =>
      i.status === "offline" || i.status === "maintenance_due" ||
      (i.next_calibration && i.next_calibration < in30)
    ).slice(0, 4).map(i => ({
      _id: i._id,
      name: i.name,
      status: i.status,
      next_maintenance_date: i.next_calibration ? new Date(i.next_calibration).toISOString().slice(0, 10) : null,
    }));

    // ── IoT sensor alerts ─────────────────────────────────────────────────
    const iotAlerts = await ctx.db.query("iot_alerts").collect();
    const sensor_alerts = iotAlerts.filter(a => !a.is_acknowledged).slice(0, 8).map(a => ({
      _id: a._id,
      message: a.message,
      level: a.severity,
    }));

    // ── Expiring freezer slots ─────────────────────────────────────────────
    const freezerSlots = await ctx.db.query("freezer_slots").collect();
    const expiring_items = freezerSlots.filter(s =>
      s.expiry_date && s.expiry_date > now && s.expiry_date < in14
    ).slice(0, 4).map(s => ({
      _id: s._id,
      sample_label: s.label,
      barcode: s.barcode,
      expiry_date: s.expiry_date ? new Date(s.expiry_date).toISOString().slice(0, 10) : null,
    }));

    // ── Grant deadlines (next 30 days) ────────────────────────────────────
    const submissions = await ctx.db.query("grant_submissions").collect();
    const grant_deadlines = submissions.filter(g =>
      g.submission_date && g.submission_date > now && g.submission_date < in30
    ).slice(0, 4).map(g => ({
      _id: g._id,
      title: g.title,
      grant_type: g.grant_type,
      deadline_date: g.submission_date ? new Date(g.submission_date).toISOString().slice(0, 10) : null,
    }));

    return {
      // Counts
      protocols: protocols.length,
      instruments: instruments.length,
      bookings: bookings.length,
      tasks_open,
      compliance_logs: compliance.length,
      feedback_open: feedback.filter(f => (f as any).status === "open").length,
      upcoming_maintenance,
      overdue_tasks,
      training_records: training.length,
      inventory_items: inventory.length,
      incident_reports: incidents.length,
      workspaces: workspaces.length,
      notification_rules: 0,
      samples: samples.length,
      sample_events: sampleEvents.length,
      calendar_events: calendarEvents.length,
      reminders_pending,
      overdue_reminders,
      quarantine_samples,
      low_stock_items,
      // Breakdowns
      samples_by_status,
      tasks_by_status,
      incidents_by_severity,
      sample_intake_by_week,
      // Widget data
      audit_recent,
      today_tasks,
      equipment_at_risk,
      sensor_alerts,
      expiring_items,
      grant_deadlines,
    };
  },
});
