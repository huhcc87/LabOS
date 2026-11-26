/**
 * Long-lived, revocable key for the LabOS Reagent Capture browser extension.
 *  - A person makes a key in Settings; it is shown once and only its hash is stored.
 *  - The extension sends it to POST /extension/reagent-cart (http.ts); the request lands in that person's
 *    Reagent Cart in their own lab, exactly as if they had typed it in (same role, hub, budget and audit rules).
 *  - Not a session token: it does not expire on its own, and it can do nothing except add requests.
 */
import { internalMutation } from "./_generated/server";
import { query, mutation, scopeDb } from "./tenant";
import { v, ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { requireAuth, assertHub, mustSetUp2fa } from "./authHelper";
import { sha256Hex } from "./cryptoSecrets";
import { hitRateLimit } from "./security";
import { insertRequest } from "./reagentCart";
import { recordCommunityProduct } from "./community";
import { EXTENSION_KEY_PREFIX, parseCapture } from "./extensionApi";

const CAPTURES_PER_MINUTE = 30;

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return EXTENSION_KEY_PREFIX + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Used by the Settings screen ───────────────────────────────────────────────

export const status = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const rows = await ctx.db.query("extension_keys").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    const live = rows.find((r) => !r.revoked_at);
    return live
      ? { has_key: true as const, key_hint: live.key_hint, created_at: live.created_at, last_used_at: live.last_used_at ?? null }
      : { has_key: false as const };
  },
});

/** Makes a new key and switches off the old one. The key is returned once and never again. */
export const create = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const now = Date.now();
    const rows = await ctx.db.query("extension_keys").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    for (const r of rows) if (!r.revoked_at) await ctx.db.patch(r._id, { revoked_at: now });
    const key = newKey();
    await ctx.db.insert("extension_keys", { user_id: userId, key_hash: await sha256Hex(key), key_hint: key.slice(-4), created_at: now });
    return { key };
  },
});

export const revoke = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const now = Date.now();
    const rows = await ctx.db.query("extension_keys").withIndex("by_user", (q) => q.eq("user_id", userId)).collect();
    for (const r of rows) if (!r.revoked_at) await ctx.db.patch(r._id, { revoked_at: now });
  },
});

// ── Used by the HTTP endpoints (http.ts) ──────────────────────────────────────

type Fail = { ok: false; status: number; error: string };

/**
 * Who a key belongs to, after the same account checks as signing in.
 * Unknown or revoked keys write nothing; a known key is rate limited per minute.
 */
async function authenticate(ctx: MutationCtx, key: string) {
  if (!key) return { ok: false, status: 401, error: "Send your extension key as 'Authorization: Bearer <key>'" } as Fail;
  const hash = await sha256Hex(key);
  const row = await ctx.db.query("extension_keys").withIndex("by_hash", (q) => q.eq("key_hash", hash)).first();
  const user = row && !row.revoked_at ? await ctx.db.get(row.user_id) : null;
  if (!row || !user || user.is_active === false) return { ok: false, status: 401, error: "Unknown or revoked extension key" } as Fail;
  if (await mustSetUp2fa(ctx, user)) return { ok: false, status: 403, error: "Two-factor sign-in is required. Set it up in LabOS first." } as Fail;
  try { assertHub(user, "Resources"); } catch (e) { return { ok: false, status: 403, error: e instanceof ConvexError ? String(e.data) : "Forbidden" } as Fail; }
  const lab = (user.role === "superadmin" ? user.active_lab_id ?? user.home_lab_id : user.home_lab_id) ?? null;
  if (!lab) return { ok: false, status: 403, error: "Your account isn't part of a lab yet." } as Fail;
  try { await hitRateLimit(ctx.db, `ext:${row._id}`, CAPTURES_PER_MINUTE, 60_000); } // throws only when blocked, before any write
  catch { return { ok: false, status: 429, error: "Too many requests. Try again in a minute." } as Fail; }
  await ctx.db.patch(row._id, { last_used_at: Date.now() });
  return { ok: true as const, user, lab };
}

/** GET /extension/health: is the key good, and whose cart will it add to? */
export const health = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const a = await authenticate(ctx, key);
    if (a.ok === false) return a;
    return { ok: true as const, status: 200, user: a.user.full_name ?? a.user.email };
  },
});

/** POST /extension/reagent-cart: one captured product becomes one pending request in the person's lab. */
export const capture = internalMutation({
  args: { key: v.string(), body: v.any() },
  handler: async (ctx, { key, body }) => {
    const a = await authenticate(ctx, key);
    if (a.ok === false) return a;
    const parsed = parseCapture(body);
    if (parsed.ok === false) return { ok: false as const, status: 400, error: parsed.error };
    // Internal functions get the raw database, so scope it to the key owner's lab the same way the app does.
    const db = scopeDb(ctx.db, a.lab, a.user._id);
    const fields = Object.fromEntries(Object.entries(parsed.fields).filter(([, val]) => val !== undefined)) as typeof parsed.fields;
    try {
      const id = await insertRequest({ db }, a.user._id, fields);
      // Share the product's public facts with every LabOS lab (never the lab, person, quantity or price).
      const image = (body as { image_url?: unknown })?.image_url;
      await recordCommunityProduct(ctx.db, { ...fields, image_url: typeof image === "string" ? image : undefined });
      return { ok: true as const, status: 200, id };
    } catch (e) {
      if (e instanceof ConvexError) return { ok: false as const, status: 400, error: String(e.data) };
      throw e;
    }
  },
});
