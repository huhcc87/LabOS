/**
 * Where sensors and the browser extension send data (extension routes are further down).
 * Sensors:
 *   POST /iot/reading   Authorization: Bearer <sensor key>   {"value": -79.6}
 *   GET  /iot/ping      connectivity check (no key needed)
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { corsHeaders, keyFromHeaders } from "./extensionApi";

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


// ── Browser extension (LabOS Reagent Capture) ────────────────────────────────
//   GET  /extension/health         Authorization: Bearer <extension key>
//   POST /extension/reagent-cart   Authorization: Bearer <extension key>   {name, vendor, catalog, ...}
// Keys are made in Settings (extensionKeys.ts). CORS is open only to chrome-/moz-extension:// origins.

const extJson = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(request.headers.get("origin")) } });

for (const path of ["/extension/health", "/extension/reagent-cart"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) })),
  });
}

http.route({
  path: "/extension/health",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const key = keyFromHeaders((n) => request.headers.get(n));
    const res = await ctx.runMutation(internal.extensionKeys.health, { key });
    return res.ok === false ? extJson(request, { ok: false, error: res.error }, res.status) : extJson(request, { ok: true, service: "labos", user: res.user });
  }),
});

http.route({
  path: "/extension/reagent-cart",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const key = keyFromHeaders((n) => request.headers.get(n));
    let body: unknown;
    try { body = await request.json(); } catch { return extJson(request, { ok: false, error: "Body must be JSON" }, 400); }
    const res = await ctx.runMutation(internal.extensionKeys.capture, { key, body });
    return res.ok === false ? extJson(request, { ok: false, error: res.error }, res.status) : extJson(request, { ok: true, id: res.id });
  }),
});

export default http;
