/**
 * Sensors (freezers, LN₂ tanks, fridges, incubators…). Devices post readings to the HTTP endpoint in
 * http.ts with their own key; the app reads and manages everything else with the signed-in user.
 * Keys are shown once when a sensor is created and only a hash is stored.
 */
import { internalMutation } from "./_generated/server";
import { query, mutation } from "./tenant";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { hubGuard } from "./authHelper";
// Students only reach this module if their PI allowed this hub.
const { requireAuth, requireRole } = hubGuard("Resources");

const DEFAULT_OFFLINE_MIN = 15;
const MIN_GAP_MS = 5_000; // a device may post at most once every 5 s
const ALERT_REPEAT_MS = 30 * 60_000; // same problem is re-raised at most every 30 min until acknowledged

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "lbk_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Never send key material to the browser. */
const safe = (s: Doc<"iot_sensors">) => {
  const { api_key: _a, api_key_hash: _h, ...rest } = s;
  return { ...rest, has_key: !!(s.api_key_hash || s.api_key) };
};

const limits = {
  min_threshold: v.optional(v.number()),
  max_threshold: v.optional(v.number()),
  critical_min: v.optional(v.number()),
  critical_max: v.optional(v.number()),
};

// ── Sensors ───────────────────────────────────────────────────────────────

/** Every sensor with its last readings (for the small trend line). */
export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const sensors = await ctx.db.query("iot_sensors").collect();
    return await Promise.all(sensors.map(async (s) => {
      const recent = await ctx.db.query("iot_readings").withIndex("by_sensor", (q) => q.eq("sensor_id", s._id)).order("desc").take(48);
      return { ...safe(s), spark: recent.reverse().map((r) => ({ t: r.timestamp, v: r.value })) };
    }));
  },
});

export const createSensor = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    sensor_type: v.string(),
    preset: v.optional(v.string()),
    location: v.optional(v.string()),
    freezer_id: v.optional(v.id("freezers")),
    unit: v.optional(v.string()),
    offline_after_min: v.optional(v.number()),
    ...limits,
  },
  handler: async (ctx, { token, ...args }) => {
    await requireRole(ctx, token, "staff");
    if (!args.name.trim()) throw new ConvexError("Give the sensor a name");
    const api_key = newKey();
    const id = await ctx.db.insert("iot_sensors", {
      ...args, name: args.name.trim(), is_active: true, api_key_hash: await sha256(api_key), created_at: Date.now(),
    });
    return { id, api_key }; // the only time the key is visible
  },
});

export const updateSensor = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("iot_sensors"),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
    freezer_id: v.optional(v.id("freezers")),
    unit: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    offline_after_min: v.optional(v.number()),
    ...limits,
  },
  handler: async (ctx, { token, id, ...rest }) => {
    await requireRole(ctx, token, "staff");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val;
    await ctx.db.patch(id, patch);
  },
});

/** Replace a lost or leaked key. The old one stops working immediately. */
export const rotateKey = mutation({
  args: { token: v.optional(v.string()), id: v.id("iot_sensors") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "staff");
    const api_key = newKey();
    await ctx.db.patch(id, { api_key_hash: await sha256(api_key), api_key: undefined });
    return { api_key };
  },
});

export const deleteSensor = mutation({
  args: { token: v.optional(v.string()), id: v.id("iot_sensors") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "manager");
    for (;;) {
      const rows = await ctx.db.query("iot_readings").withIndex("by_sensor", (q) => q.eq("sensor_id", id)).take(500);
      if (!rows.length) break;
      await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
    }
    const alerts = await ctx.db.query("iot_alerts").withIndex("by_sensor", (q) => q.eq("sensor_id", id)).collect();
    await Promise.all(alerts.map((a) => ctx.db.delete(a._id)));
    await ctx.db.delete(id);
  },
});

// ── Readings (from devices) ───────────────────────────────────────────────

async function raise(ctx: MutationCtx, sensor: Doc<"iot_sensors">, kind: string, severity: string, message: string, value: number | undefined, at: number) {
  const open = await ctx.db.query("iot_alerts").withIndex("by_sensor", (q) => q.eq("sensor_id", sensor._id)).order("desc").take(20);
  // Same problem at the same or higher severity was raised recently: don't repeat it. A worse reading still alerts.
  const rank = (x: string) => (x === "critical" ? 2 : 1);
  if (open.some((o) => o.kind === kind && rank(o.severity) >= rank(severity) && at - o.created_at < ALERT_REPEAT_MS)) return;
  await ctx.db.insert("iot_alerts", { lab_id: sensor.lab_id, sensor_id: sensor._id, kind, message, severity, value, is_acknowledged: false, created_at: at });
}

/** Called by the HTTP endpoint. The key identifies the sensor; there is no user session. */
export const ingest = internalMutation({
  args: { key: v.string(), value: v.number(), timestamp: v.optional(v.number()) },
  handler: async (ctx, { key, value, timestamp }) => {
    const hash = await sha256(key);
    const sensor = (await ctx.db.query("iot_sensors").withIndex("by_key_hash", (q) => q.eq("api_key_hash", hash)).first())
      ?? (await ctx.db.query("iot_sensors").filter((q) => q.eq(q.field("api_key"), key)).first()); // keys made before hashing
    if (!sensor) return { ok: false as const, status: 401, error: "Unknown sensor key" };
    if (!sensor.is_active) return { ok: false as const, status: 403, error: "This sensor is switched off in LabOS" };
    if (!Number.isFinite(value) || value < -300 || value > 2000) return { ok: false as const, status: 400, error: "Value out of range" };

    const now = Date.now();
    if (sensor.last_reading_at && now - sensor.last_reading_at < MIN_GAP_MS) return { ok: false as const, status: 429, error: "Too fast: send at most one reading every 5 seconds" };
    // Devices without a clock send nothing; a clock far from ours is ignored.
    const ts = timestamp && Math.abs(timestamp - now) < 24 * 3_600_000 ? timestamp : now;

    await ctx.db.insert("iot_readings", { lab_id: sensor.lab_id, sensor_id: sensor._id, value, timestamp: ts });
    await ctx.db.patch(sensor._id, { last_reading: value, last_reading_at: ts });

    const u = sensor.unit ? ` ${sensor.unit}` : "";
    const { min_threshold: lo, max_threshold: hi, critical_min: clo, critical_max: chi } = sensor;
    if (hi !== undefined && value > hi) {
      const crit = chi !== undefined && value > chi;
      await raise(ctx, sensor, "high", crit ? "critical" : "warning", `${sensor.name} is ${value}${u}, above the limit of ${crit ? chi : hi}${u}.`, value, ts);
    } else if (lo !== undefined && value < lo) {
      const crit = clo !== undefined && value < clo;
      await raise(ctx, sensor, "low", crit ? "critical" : "warning", `${sensor.name} is ${value}${u}, below the limit of ${crit ? clo : lo}${u}.`, value, ts);
    }
    return { ok: true as const, status: 200 };
  },
});

/** Cron: a sensor that stops reporting is as bad as one that reads too high (power cut, Wi-Fi, dead probe). */
export const checkOffline = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sensors = await ctx.db.query("iot_sensors").collect();
    for (const s of sensors) {
      if (!s.is_active || !s.last_reading_at) continue;
      const limitMs = (s.offline_after_min ?? DEFAULT_OFFLINE_MIN) * 60_000;
      if (now - s.last_reading_at > limitMs) {
        const mins = Math.round((now - s.last_reading_at) / 60_000);
        await raise(ctx, s, "offline", "critical", `${s.name} has not reported for ${mins} minutes. Check its power, Wi-Fi and probe.`, undefined, now);
      }
    }
  },
});

// ── History and alerts ────────────────────────────────────────────────────

export const getHistory = query({
  args: { token: v.optional(v.string()), sensor_id: v.id("iot_sensors"), hours: v.optional(v.number()) },
  handler: async (ctx, { token, sensor_id, hours }) => {
    await requireAuth(ctx, token);
    const cutoff = Date.now() - Math.min(hours ?? 24, 24 * 30) * 3_600_000;
    const rows = await ctx.db.query("iot_readings").withIndex("by_sensor", (q) => q.eq("sensor_id", sensor_id))
      .order("desc").filter((q) => q.gte(q.field("timestamp"), cutoff)).take(2000);
    return rows.reverse().map((r) => ({ t: r.timestamp, v: r.value }));
  },
});

export const listAlerts = query({
  args: { token: v.optional(v.string()), unack_only: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, { token, unack_only, limit }) => {
    await requireAuth(ctx, token);
    const rows = await ctx.db.query("iot_alerts").order("desc").take(300);
    const sensors = new Map<Id<"iot_sensors">, string>();
    const out = [];
    for (const a of rows) {
      if (unack_only && a.is_acknowledged) continue;
      if (!sensors.has(a.sensor_id)) sensors.set(a.sensor_id, (await ctx.db.get(a.sensor_id))?.name ?? "(deleted sensor)");
      out.push({ ...a, sensor_name: sensors.get(a.sensor_id)! });
      if (out.length >= (limit ?? 50)) break;
    }
    return out;
  },
});

export const acknowledgeAlert = mutation({
  args: { token: v.optional(v.string()), id: v.id("iot_alerts") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const alert = await ctx.db.get(id);
    if (!alert) throw new ConvexError("Alert not found");
    if (alert.is_acknowledged) return;
    await ctx.db.patch(id, { is_acknowledged: true, acknowledged_by: userId, acknowledged_at: Date.now() });
  },
});
