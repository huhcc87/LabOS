/**
 * Where sensors send readings.
 *   POST /iot/reading   Authorization: Bearer <sensor key>   {"value": -79.6}
 *   GET  /iot/ping      connectivity check (no key needed)
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const http = httpRouter();

http.route({
  path: "/iot/ping",
  method: "GET",
  handler: httpAction(async () => json({ ok: true, service: "labos", time: Date.now() })),
});

http.route({
  path: "/iot/reading",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = request.headers.get("authorization") ?? "";
    const key = (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : request.headers.get("x-api-key") ?? "").trim();
    if (!key) return json({ ok: false, error: "Send your sensor key as 'Authorization: Bearer <key>'" }, 401);
    let body: { value?: unknown; timestamp?: unknown };
    try { body = await request.json(); } catch { return json({ ok: false, error: "Body must be JSON like {\"value\": -80.1}" }, 400); }
    const value = typeof body.value === "string" ? Number(body.value) : body.value;
    if (typeof value !== "number") return json({ ok: false, error: "'value' must be a number" }, 400);
    const timestamp = typeof body.timestamp === "number" ? body.timestamp : undefined; // ms since 1970
    const res = await ctx.runMutation(internal.iot.ingest, { key, value, timestamp });
    return res.ok ? json({ ok: true }) : json({ ok: false, error: res.error }, res.status);
  }),
});

export default http;
