import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── Sensors ───────────────────────────────────────────────────────────────────

export const listSensors = query({
  args: {
    active_only: v.optional(v.boolean()),
  },
  handler: async (ctx, { active_only }) => {
    const sensors = await ctx.db.query("iot_sensors").collect();
    if (active_only) {
      return sensors.filter((s) => s.is_active);
    }
    return sensors;
  },
});

export const createSensor = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    sensor_type: v.string(),
    location: v.optional(v.string()),
    unit: v.optional(v.string()),
    min_threshold: v.optional(v.number()),
    max_threshold: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
    api_key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);

    return await ctx.db.insert("iot_sensors", {
      name: args.name,
      sensor_type: args.sensor_type,
      location: args.location,
      unit: args.unit,
      min_threshold: args.min_threshold,
      max_threshold: args.max_threshold,
      is_active: args.is_active ?? true,
      api_key: args.api_key,
      created_at: Date.now(),
    });
  },
});

export const updateSensor = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("iot_sensors"),
    name: v.optional(v.string()),
    sensor_type: v.optional(v.string()),
    location: v.optional(v.string()),
    unit: v.optional(v.string()),
    min_threshold: v.optional(v.number()),
    max_threshold: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
    api_key: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    const userId = await requireAuth(ctx, token);

    const sensor = await ctx.db.get(id);
    if (!sensor) throw new Error("Sensor not found");

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, updates);
  },
});

export const deleteSensor = mutation({
  args: { token: v.optional(v.string()), id: v.id("iot_sensors") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const sensor = await ctx.db.get(id);
    if (!sensor) throw new Error("Sensor not found");

    await ctx.db.delete(id);
  },
});

// ── Readings ──────────────────────────────────────────────────────────────────

/**
 * Record a new reading from a sensor.
 * Automatically checks thresholds and inserts an alert if the value is out of range.
 */
export const recordReading = mutation({
  args: {
    sensor_id: v.id("iot_sensors"),
    value: v.number(),
    timestamp: v.optional(v.number()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, { sensor_id, value, timestamp, metadata }) => {
    const sensor = await ctx.db.get(sensor_id);
    if (!sensor) throw new Error("Sensor not found");

    const ts = timestamp ?? Date.now();

    // Insert the reading
    const readingId = await ctx.db.insert("iot_readings", {
      sensor_id,
      value,
      timestamp: ts,
      metadata,
    });

    // Update sensor's last reading
    await ctx.db.patch(sensor_id, {
      last_reading: value,
      last_reading_at: ts,
    });

    // Threshold check — create an alert if out of range
    const alerts: Array<{ severity: string; message: string }> = [];

    if (sensor.min_threshold !== undefined && value < sensor.min_threshold) {
      alerts.push({
        severity: "warning",
        message:
          `${sensor.name} reading ${value}${sensor.unit ? " " + sensor.unit : ""} ` +
          `is BELOW the minimum threshold of ${sensor.min_threshold}${sensor.unit ? " " + sensor.unit : ""}.`,
      });
    }

    if (sensor.max_threshold !== undefined && value > sensor.max_threshold) {
      const isHigh = sensor.max_threshold > 0 && value > sensor.max_threshold * 1.1;
      alerts.push({
        severity: isHigh ? "critical" : "warning",
        message:
          `${sensor.name} reading ${value}${sensor.unit ? " " + sensor.unit : ""} ` +
          `is ABOVE the maximum threshold of ${sensor.max_threshold}${sensor.unit ? " " + sensor.unit : ""}.`,
      });
    }

    const alertIds: string[] = [];
    for (const alert of alerts) {
      const alertId = await ctx.db.insert("iot_alerts", {
        sensor_id,
        message: alert.message,
        severity: alert.severity,
        value,
        is_acknowledged: false,
        created_at: ts,
      });
      alertIds.push(alertId);
    }

    return { reading_id: readingId, alert_ids: alertIds };
  },
});

export const getHistory = query({
  args: {
    sensor_id: v.id("iot_sensors"),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, { sensor_id, hours }) => {
    const lookbackHours = hours ?? 24;
    const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;

    return await ctx.db
      .query("iot_readings")
      .withIndex("by_sensor", (q) => q.eq("sensor_id", sensor_id))
      .filter((q) => q.gte(q.field("timestamp"), cutoff))
      .order("asc")
      .collect();
  },
});

// ── Alerts ────────────────────────────────────────────────────────────────────

export const listAlerts = query({
  args: {
    sensor_id: v.optional(v.id("iot_sensors")),
    unack_only: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sensor_id, unack_only, limit }) => {
    let alerts;

    if (sensor_id) {
      alerts = await ctx.db
        .query("iot_alerts")
        .withIndex("by_sensor", (q) => q.eq("sensor_id", sensor_id))
        .order("desc")
        .collect();
    } else {
      alerts = await ctx.db.query("iot_alerts").order("desc").collect();
    }

    if (unack_only) {
      alerts = alerts.filter((a) => !a.is_acknowledged);
    }

    if (limit && limit > 0) {
      alerts = alerts.slice(0, limit);
    }

    return alerts;
  },
});

export const acknowledgeAlert = mutation({
  args: { token: v.optional(v.string()), id: v.id("iot_alerts") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);

    const alert = await ctx.db.get(id);
    if (!alert) throw new Error("Alert not found");

    if (alert.is_acknowledged) {
      throw new Error("Alert has already been acknowledged.");
    }

    await ctx.db.patch(id, {
      is_acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: Date.now(),
    });
  },
});
