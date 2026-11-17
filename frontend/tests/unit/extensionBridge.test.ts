// @vitest-environment edge-runtime
/** Browser extension bridge: key lifecycle, POST /extension/reagent-cart, GET /extension/health, CORS. */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { sha256Hex } from "../../convex/cryptoSecrets";
import { corsHeaders, keyFromHeaders, parseCapture } from "../../convex/extensionApi";

const modules = import.meta.glob("../../convex/**/*.ts");
const ORIGIN = "chrome-extension://abcdefghijklmnop";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const labA = await ctx.db.insert("labs", { name: "Lab A", created_at: now });
    const labB = await ctx.db.insert("labs", { name: "Lab B", created_at: now });
    const base = { hashed_password: "x", is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: now, updated_at: now };
    const piA = await ctx.db.insert("users", { ...base, email: "pia@a.test", full_name: "PI A", role: "pi", home_lab_id: labA });
    // A student whose PI has not allowed the Resources hub.
    const blocked = await ctx.db.insert("users", { ...base, email: "s@a.test", full_name: "Student", role: "trainee", home_lab_id: labA, pi_id: piA, allowed_hubs: ["Lab Hub"] });
    const piB = await ctx.db.insert("users", { ...base, email: "pib@b.test", full_name: "PI B", role: "pi", home_lab_id: labB });
    for (const [u, tok] of [[piA, "tA"], [blocked, "tBlocked"], [piB, "tB"]] as const) {
      await ctx.db.insert("sessions", { user_id: u, token: await sha256Hex(tok), expires_at: now + 1e9, created_at: now });
    }
    return { labA, labB, piA, blocked, piB };
  });
  return { t, ...ids };
}

const post = (t: ReturnType<typeof convexTest>, key: string, body: unknown) =>
  t.fetch("/extension/reagent-cart", { method: "POST", headers: { Authorization: `Bearer ${key}`, Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("extension key lifecycle", () => {
  it("shows the key once, stores only its hash, and a new key replaces the old one", async () => {
    const { t } = await setup();
    expect(await t.query(api.extensionKeys.status, { token: "tA" })).toEqual({ has_key: false });
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tA" });
    expect(key).toMatch(/^lbx_[0-9a-f]{48}$/);
    const rows = await t.run((ctx) => ctx.db.query("extension_keys").collect());
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(key);
    expect(rows[0].key_hash).toBe(await sha256Hex(key));
    const status = await t.query(api.extensionKeys.status, { token: "tA" });
    expect(status).toMatchObject({ has_key: true, key_hint: key.slice(-4) });

    const second = (await t.mutation(api.extensionKeys.create, { token: "tA" })).key;
    expect((await post(t, key, { name: "x" })).status).toBe(401); // replaced
    expect((await post(t, second, { name: "x" })).status).toBe(200);
  });

  it("needs a signed-in session to make or revoke a key", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.extensionKeys.create, { token: "nope" })).rejects.toThrow();
    await expect(t.mutation(api.extensionKeys.revoke, { token: undefined })).rejects.toThrow();
  });

  it("stops working at once when revoked", async () => {
    const { t } = await setup();
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tA" });
    expect((await t.fetch("/extension/health", { headers: { Authorization: `Bearer ${key}` } })).status).toBe(200);
    await t.mutation(api.extensionKeys.revoke, { token: "tA" });
    expect((await t.fetch("/extension/health", { headers: { Authorization: `Bearer ${key}` } })).status).toBe(401);
    expect((await post(t, key, { name: "x" })).status).toBe(401);
  });
});

describe("POST /extension/reagent-cart", () => {
  it("puts the captured product in the key owner's Reagent Cart, in their lab", async () => {
    const { t, labA, piA } = await setup();
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tA" });
    const res = await post(t, key, { vendor: "Sigma-Aldrich", name: " Tris base ", catalog: "T1503", size: "500 g", unit_price: "$45.20", url: "https://www.sigmaaldrich.com/p/T1503", cas: "77-86-1", currency: "USD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const { id } = await res.json();
    const doc = await t.run((ctx) => ctx.db.get(id)) as Record<string, unknown>;
    expect(doc).toMatchObject({ name: "Tris base", supplier: "Sigma-Aldrich", catalog_number: "T1503", size: "500 g", unit_price: 45.2, cas: "77-86-1", quantity: 1, status: "pending", lab_id: labA, user_id: piA });
    // The app's own list shows it, and another lab never does.
    expect((await t.query(api.reagentCart.list, { token: "tA" })).map((r) => r.name)).toEqual(["Tris base"]);
    expect(await t.query(api.reagentCart.list, { token: "tB" })).toEqual([]);
    // Same audit entry as a request typed in the app.
    const audit = await t.run((ctx) => ctx.db.query("audit_logs").collect());
    expect(audit.some((a) => a.action === "request" && a.entity_id === id)).toBe(true);
  });

  it("rejects missing or bad keys, and bad bodies", async () => {
    const { t } = await setup();
    expect((await t.fetch("/extension/reagent-cart", { method: "POST", body: "{}" })).status).toBe(401);
    expect((await post(t, "lbx_" + "0".repeat(48), { name: "x" })).status).toBe(401);
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tA" });
    expect((await post(t, key, { vendor: "no name" })).status).toBe(400);
    expect((await t.fetch("/extension/reagent-cart", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: "not json" })).status).toBe(400);
  });

  it("respects hub access: a student without the Resources hub is refused", async () => {
    const { t } = await setup();
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tBlocked" });
    const res = await post(t, key, { name: "x" });
    expect(res.status).toBe(403);
    expect(await t.run((ctx) => ctx.db.query("reagent_cart").collect())).toEqual([]);
  });

  it("refuses a deactivated account", async () => {
    const { t, piA } = await setup();
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tA" });
    await t.run((ctx) => ctx.db.patch(piA, { is_active: false }));
    expect((await post(t, key, { name: "x" })).status).toBe(401);
  });

  it("rate limits a key at 30 sends a minute", async () => {
    const { t } = await setup();
    const { key } = await t.mutation(api.extensionKeys.create, { token: "tA" });
    for (let i = 0; i < 30; i++) expect((await post(t, key, { name: `item ${i}` })).status).toBe(200);
    expect((await post(t, key, { name: "one too many" })).status).toBe(429);
  });
});

describe("CORS and parsing helpers", () => {
  it("answers preflight for extension origins only", async () => {
    const { t } = await setup();
    const ok = await t.fetch("/extension/reagent-cart", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(ok.headers.get("access-control-allow-headers")).toContain("Authorization");
    const evil = await t.fetch("/extension/reagent-cart", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("corsHeaders allows chrome-, moz- and safari-web-extension origins only", () => {
    expect(corsHeaders("moz-extension://1234-abcd")["Access-Control-Allow-Origin"]).toBe("moz-extension://1234-abcd");
    expect(corsHeaders("https://labos.app")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(null)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("reads the key from Authorization or X-Api-Key", () => {
    expect(keyFromHeaders((n) => (n === "authorization" ? "Bearer  abc " : null))).toBe("abc");
    expect(keyFromHeaders((n) => (n === "x-api-key" ? "def" : null))).toBe("def");
    expect(keyFromHeaders(() => null)).toBe("");
  });

  it("parseCapture validates, clips and drops unsafe links", () => {
    expect(parseCapture("x")).toMatchObject({ ok: false });
    expect(parseCapture({ name: "  " })).toMatchObject({ ok: false });
    expect(parseCapture({ name: "a", quantity: 0 })).toMatchObject({ ok: false });
    expect(parseCapture({ name: "a", unit_price: -1 })).toMatchObject({ ok: false });
    const r = parseCapture({ name: "a".repeat(400), url: "javascript:alert(1)", purity: "99%", currency: "EUR", unit_price: 5 });
    expect(r.ok && r.fields.name.length).toBe(300);
    expect(r.ok && r.fields.url).toBeUndefined();
    expect(r.ok && r.fields.notes).toContain("purity 99%");
    expect(r.ok && r.fields.notes).toContain("price in EUR");
  });
});
