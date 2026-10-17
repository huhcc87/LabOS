/**
 * Account security: password rules, rate limiting, sessions, recovery codes, sign-in history,
 * two-factor policy, consent, data export and erasure requests.
 * The functions here read the session token themselves instead of using requireAuth, so a person who
 * must still set up two-factor can reach them (requireAuth refuses them everywhere else).
 */
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { encryptionConfigured, sha256Hex } from "./cryptoSecrets";
import { hasRole, mustSetUp2fa, twoFactorPolicyOn, REQUIRE_2FA_KEY, PRIVILEGED_ROLES } from "./authHelper";


// ── Password rules ────────────────────────────────────────────────────────────

const COMMON = ["password", "qwerty", "letmein", "welcome", "admin", "labos", "123456", "iloveyou", "changeme"];

/** Why a password is not allowed, or null if it is fine. */
export function passwordProblem(pw: string, email = "", name = ""): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (pw.length > 200) return "That password is too long.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3 && pw.length < 16) return "Mix upper and lower case letters, numbers and symbols, or make it 16+ characters long.";
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) return "That password is too easy to guess.";
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && low.includes(local)) return "The password can't contain your email name.";
  for (const part of name.toLowerCase().split(/\s+/)) if (part.length >= 4 && low.includes(part)) return "The password can't contain your name.";
  if (/^(.)\1+$/.test(pw)) return "That password is too easy to guess.";
  return null;
}

// ── Rate limiting (stored, so it holds across function instances) ─────────────

export async function hitRateLimit(db: MutationCtx["db"], key: string, max: number, windowMs: number): Promise<void> {
  const now = Date.now();
  const row = await db.query("rate_limits").withIndex("by_key", (q) => q.eq("key", key)).first();
  if (!row || row.window_start + windowMs < now) {
    if (row) await db.patch(row._id, { window_start: now, count: 1 });
    else await db.insert("rate_limits", { key, window_start: now, count: 1 });
    return;
  }
  if (row.count >= max) {
    const minutes = Math.max(1, Math.ceil((row.window_start + windowMs - now) / 60000));
    throw new ConvexError(`Too many attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`);
  }
  await db.patch(row._id, { count: row.count + 1 });
}

export const rateLimit = internalMutation({
  args: { key: v.string(), max: v.number(), window_ms: v.number() },
  handler: async (ctx, { key, max, window_ms }) => hitRateLimit(ctx.db, key, max, window_ms),
});

/** Removes expired counters so the table does not grow forever. Run by a cron. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("rate_limits").filter((q) => q.lt(q.field("window_start"), Date.now() - 24 * 3600_000)).take(200);
    for (const r of old) await ctx.db.delete(r._id);
    const expired = await ctx.db.query("sessions").filter((q) => q.lt(q.field("expires_at"), Date.now())).take(200);
    for (const s of expired) await ctx.db.delete(s._id);
  },
});

// ── Session helper ────────────────────────────────────────────────────────────

async function who(ctx: QueryCtx | MutationCtx, token: string | undefined | null) {
  if (!token) throw new ConvexError("Unauthorized");
  const hashed = await sha256Hex(token);
  const session = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", hashed)).first();
  if (!session || session.expires_at < Date.now()) throw new ConvexError("Unauthorized");
  const user = await ctx.db.get(session.user_id);
  if (!user || !user.is_active) throw new ConvexError("Unauthorized");
  return { session, user };
}

async function audit(ctx: MutationCtx, user: Doc<"users">, action: string, severity: string, details: string) {
  await ctx.db.insert("audit_logs", { lab_id: user.home_lab_id, user_id: user._id, action, entity_type: "auth", details: `[${severity}] ${details}`, created_at: Date.now() });
}



// ── What the Security page shows ──────────────────────────────────────────────

export const status = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    // A dead session answers null instead of throwing, so a screen watching this never crashes.
    const found = await who(ctx, token).catch(() => null);
    if (!found) return null;
    const { session, user } = found;
    const sessions = (await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect()).filter((s) => s.expires_at > Date.now());
    const history = (await ctx.db.query("audit_logs").withIndex("by_user", (q) => q.eq("user_id", user._id)).order("desc").take(60))
      .filter((a) => a.entity_type === "auth").slice(0, 20)
      .map((a) => ({ action: a.action, details: a.details ?? "", at: a.created_at }));
    return {
      totp_enabled: user.totp_enabled,
      recovery_left: user.recovery_codes?.length ?? 0,
      must_setup_2fa: await mustSetUp2fa(ctx, user),
      secrets_encrypted: encryptionConfigured(),
      session_hours: 8,
      sessions: sessions.sort((a, b) => b.created_at - a.created_at).map((s) => ({ id: s._id, created_at: s.created_at, expires_at: s.expires_at, current: s._id === session._id })),
      history,
    };
  },
});

export const revokeSession = mutation({
  args: { token: v.optional(v.string()), session_id: v.id("sessions") },
  handler: async (ctx, { token, session_id }) => {
    const { user } = await who(ctx, token);
    const s = await ctx.db.get(session_id);
    if (!s || s.user_id !== user._id) throw new ConvexError("Session not found.");
    await ctx.db.delete(session_id);
    await audit(ctx, user, "SESSION_REVOKED", "INFO", "A sign-in session was ended");
  },
});

export const revokeOthers = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const { session, user } = await who(ctx, token);
    const mine = (await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect()).filter((s) => s._id !== session._id);
    for (const s of mine) await ctx.db.delete(s._id);
    await audit(ctx, user, "SESSIONS_REVOKED_ALL", "INFO", `Signed out ${mine.length} other session(s)`);
    return { ended: mine.length };
  },
});

// ── Change password ───────────────────────────────────────────────────────────

export const getForPasswordChange = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { session, user } = await who(ctx, token);
    return { session_id: session._id, user_id: user._id, hashed_password: user.hashed_password, email: user.email, full_name: user.full_name };
  },
});

export const applyPasswordChange = internalMutation({
  args: { user_id: v.id("users"), session_id: v.id("sessions"), hashed_password: v.string() },
  handler: async (ctx, { user_id, session_id, hashed_password }) => {
    const user = (await ctx.db.get(user_id))!;
    await ctx.db.patch(user_id, { hashed_password, failed_login_attempts: 0, locked_until: undefined, updated_at: Date.now() });
    // A new password signs out every other device.
    for (const s of (await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("user_id", user_id)).collect()).filter((x) => x._id !== session_id)) await ctx.db.delete(s._id);
    await audit(ctx, user, "PASSWORD_CHANGED", "INFO", "Password changed; other sessions signed out");
  },
});

export const changePassword = action({
  args: { token: v.string(), current_password: v.string(), new_password: v.string() },
  handler: async (ctx, { token, current_password, new_password }): Promise<{ ok: true }> => {
    const me = await ctx.runQuery(internal.security.getForPasswordChange, { token });
    await ctx.runMutation(internal.security.rateLimit, { key: `chpw:${me.user_id}`, max: 5, window_ms: 15 * 60_000 });
    const bcrypt = await import("bcryptjs");
    if (!(await bcrypt.compare(current_password, me.hashed_password))) throw new ConvexError("Your current password is not right.");
    const problem = passwordProblem(new_password, me.email, me.full_name);
    if (problem) throw new ConvexError(problem);
    if (new_password === current_password) throw new ConvexError("Choose a password you have not used just now.");
    await ctx.runMutation(internal.security.applyPasswordChange, { user_id: me.user_id, session_id: me.session_id, hashed_password: await bcrypt.hash(new_password, 12) });
    return { ok: true };
  },
});

// ── Recovery codes (two-factor backup) ────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const c = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export const storeRecoveryCodes = internalMutation({
  args: { user_id: v.id("users"), hashes: v.array(v.string()) },
  handler: async (ctx, { user_id, hashes }) => {
    const user = (await ctx.db.get(user_id))!;
    await ctx.db.patch(user_id, { recovery_codes: hashes, updated_at: Date.now() });
    await audit(ctx, user, "RECOVERY_CODES_CREATED", "INFO", "New recovery codes created; old ones no longer work");
  },
});

/** Makes 10 new one-time codes (replacing any old ones). Shown once. Needs the password and two-factor on. */
export const createRecoveryCodes = action({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, { token, password }): Promise<{ codes: string[] }> => {
    const me = await ctx.runQuery(internal.security.getForPasswordChange, { token });
    await ctx.runMutation(internal.security.rateLimit, { key: `recovery:${me.user_id}`, max: 5, window_ms: 15 * 60_000 });
    const bcrypt = await import("bcryptjs");
    if (!(await bcrypt.compare(password, me.hashed_password))) throw new ConvexError("That password is not right.");
    const st = await ctx.runQuery(internal.security.totpOn, { user_id: me.user_id });
    if (!st) throw new ConvexError("Turn on two-factor first, then create recovery codes.");
    const codes = Array.from({ length: 10 }, newCode);
    await ctx.runMutation(internal.security.storeRecoveryCodes, { user_id: me.user_id, hashes: await Promise.all(codes.map((c) => sha256Hex(normalizeCode(c)))) });
    return { codes };
  },
});

export const totpOn = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => !!(await ctx.db.get(user_id))?.totp_enabled,
});

/** At sign-in: a recovery code works once, then is gone. */
export const consumeRecoveryCode = internalMutation({
  args: { user_id: v.id("users"), code: v.string() },
  handler: async (ctx, { user_id, code }) => {
    const user = await ctx.db.get(user_id);
    if (!user?.recovery_codes?.length) return false;
    const hash = await sha256Hex(normalizeCode(code));
    if (!user.recovery_codes.includes(hash)) return false;
    await ctx.db.patch(user_id, { recovery_codes: user.recovery_codes.filter((h) => h !== hash) });
    await audit(ctx, user, "RECOVERY_CODE_USED", "WARN", `A recovery code was used to sign in (${user.recovery_codes.length - 1} left)`);
    return true;
  },
});

// ── Lab policy: require two-factor for managers, PIs and admins ───────────────

export const getPolicy = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const { user } = await who(ctx, token);
    const privileged = (await ctx.db.query("users").withIndex("by_home_lab", (q) => q.eq("home_lab_id", user.home_lab_id)).collect()).filter((u) => u.is_active && PRIVILEGED_ROLES.includes(u.role));
    return {
      require_2fa: await twoFactorPolicyOn(ctx, user.home_lab_id),
      can_edit: hasRole(user.role, "admin"),
      privileged_total: privileged.length,
      privileged_without_2fa: privileged.filter((u) => !u.totp_enabled).map((u) => ({ id: u._id, name: u.full_name, role: u.role })),
    };
  },
});

export const setRequire2fa = mutation({
  args: { token: v.optional(v.string()), required: v.boolean() },
  handler: async (ctx, { token, required }) => {
    const { user } = await who(ctx, token);
    if (!hasRole(user.role, "admin")) throw new ConvexError("Only an admin can change this.");
    // Turning it on while you have no two-factor would lock you out of your own lab.
    if (required && !user.totp_enabled) throw new ConvexError("Turn on two-factor for your own account first, so you are not locked out.");
    const now = Date.now();
    const row = (await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", REQUIRE_2FA_KEY)).collect()).find((r) => r.lab_id === user.home_lab_id);
    if (row) await ctx.db.patch(row._id, { value: String(required), updated_at: now });
    else await ctx.db.insert("settings", { lab_id: user.home_lab_id, key: REQUIRE_2FA_KEY, value: String(required), category: "security", label: "Require two-factor for managers, PIs and admins", created_at: now, updated_at: now });
    await audit(ctx, user, required ? "POLICY_2FA_REQUIRED" : "POLICY_2FA_OPTIONAL", "WARN", `Two-factor ${required ? "is now required" : "is no longer required"} for managers, PIs and admins`);
  },
});

// ── Consent ───────────────────────────────────────────────────────────────────

export const CONSENT_TYPES = [
  { type: "essential", label: "Essential processing", description: "Needed to run your account and keep the lab's data safe. Always on.", required: true },
  { type: "analytics", label: "Usage analytics", description: "Anonymous page-use statistics that help improve LabOS." },
  { type: "ai_assist", label: "AI assistance", description: "Send the text you choose to an AI provider to get suggestions." },
  { type: "email_notifications", label: "Email notifications", description: "Reminders and alerts sent to your email address." },
];

export const myConsents = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const { user } = await who(ctx, token);
    const rows = await ctx.db.query("consent_records").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect();
    return CONSENT_TYPES.map((c) => {
      const latest = rows.filter((r) => r.consent_type === c.type).sort((a, b) => b.created_at - a.created_at)[0];
      return { ...c, granted: c.required ? true : latest?.granted ?? false, updated_at: latest?.created_at ?? null };
    });
  },
});

export const setConsent = mutation({
  args: { token: v.optional(v.string()), consent_type: v.string(), granted: v.boolean() },
  handler: async (ctx, { token, consent_type, granted }) => {
    const { user } = await who(ctx, token);
    const def = CONSENT_TYPES.find((c) => c.type === consent_type);
    if (!def) throw new ConvexError("Unknown consent type.");
    if (def.required) throw new ConvexError("This one is needed to use LabOS.");
    // Append-only: every change is kept as a record of what you agreed to and when.
    await ctx.db.insert("consent_records", { lab_id: user.home_lab_id, user_id: user._id, consent_type, granted, version: "1", created_at: Date.now() });
    await audit(ctx, user, granted ? "CONSENT_GRANTED" : "CONSENT_REVOKED", "INFO", `${def.label}`);
  },
});

// ── Your data: export and erasure ─────────────────────────────────────────────

export const exportMyData = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const { user } = await who(ctx, token);
    const { hashed_password: _h, totp_secret: _t, recovery_codes: _r, ...profile } = user;
    const mine = <T extends { user_id: Id<"users"> }>(rows: T[]) => rows.filter((r) => r.user_id === user._id);
    return {
      exported_at: new Date().toISOString(),
      profile,
      consents: await ctx.db.query("consent_records").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect(),
      sign_in_and_security_history: (await ctx.db.query("audit_logs").withIndex("by_user", (q) => q.eq("user_id", user._id)).order("desc").take(500)),
      reagent_requests: mine(await ctx.db.query("reagent_cart").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect()),
      notifications: mine(await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("user_id", user._id)).order("desc").take(500)),
      erasure_requests: await ctx.db.query("erasure_requests").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect(),
    };
  },
});

export const myErasureRequests = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const { user } = await who(ctx, token);
    return (await ctx.db.query("erasure_requests").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect()).sort((a, b) => b.created_at - a.created_at);
  },
});

export const requestErasure = mutation({
  args: { token: v.optional(v.string()), reason: v.optional(v.string()) },
  handler: async (ctx, { token, reason }) => {
    const { user } = await who(ctx, token);
    const open = (await ctx.db.query("erasure_requests").withIndex("by_user", (q) => q.eq("user_id", user._id)).collect()).some((r) => r.status === "pending");
    if (open) throw new ConvexError("You already have a request waiting for review.");
    await ctx.db.insert("erasure_requests", { lab_id: user.home_lab_id, user_id: user._id, reason: reason?.trim().slice(0, 1000) || undefined, status: "pending", created_at: Date.now() });
    await audit(ctx, user, "ERASURE_REQUESTED", "WARN", "A request to erase personal data was submitted");
  },
});

export const listErasureRequests = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const { user } = await who(ctx, token);
    if (!hasRole(user.role, "admin")) throw new ConvexError("Forbidden: requires admin role or higher");
    const rows = (await ctx.db.query("erasure_requests").collect()).sort((a, b) => b.created_at - a.created_at);
    const out = [];
    for (const r of rows) { const u = await ctx.db.get(r.user_id); out.push({ ...r, person: u ? `${u.full_name} (${u.email})` : "(deleted user)" }); }
    return out;
  },
});

export const reviewErasureRequest = mutation({
  args: { token: v.optional(v.string()), id: v.id("erasure_requests"), status: v.union(v.literal("approved"), v.literal("rejected")), rejection_reason: v.optional(v.string()) },
  handler: async (ctx, { token, id, status, rejection_reason }) => {
    const { user } = await who(ctx, token);
    if (!hasRole(user.role, "admin")) throw new ConvexError("Forbidden: requires admin role or higher");
    const r = await ctx.db.get(id);
    if (!r || r.status !== "pending") throw new ConvexError("This request was already reviewed.");
    if (status === "rejected" && !rejection_reason?.trim()) throw new ConvexError("Say why it is rejected.");
    await ctx.db.patch(id, { status, reviewed_by: user._id, reviewed_at: Date.now(), rejection_reason: rejection_reason?.trim() || undefined });
    await audit(ctx, user, "ERASURE_REVIEWED", "WARN", `Erasure request ${status}`);
  },
});

/** True when the lab requires two-factor for this person's role, so they must not turn it off. */
export const disableBlocked = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    const user = await ctx.db.get(user_id);
    return !!user && PRIVILEGED_ROLES.includes(user.role) && (await twoFactorPolicyOn(ctx, user.home_lab_id));
  },
});
