/**
 * Seeding helpers for convex-test mutation tests.
 * Builds the real chain the app's auth/tenancy model requires:
 * organizations -> sites -> labs -> lab_memberships -> users -> sessions.
 */
import { convexTest } from "convex-test";
import schema from "./schema";

// `import.meta.glob` is Vite-only syntax — Convex's own deployment bundler
// (a separate, non-Vite pipeline) chokes on it if it appears in any file
// under convex/ that isn't a *.test.ts (which the bundler already skips).
// So the glob call has to happen in the *.test.ts file itself, not here;
// this just takes the already-resolved modules map as a parameter.
export function makeTest(modules: Record<string, () => Promise<unknown>>) {
  return convexTest(schema, modules);
}

export type Role = "superadmin" | "admin" | "pi" | "manager" | "staff" | "trainee";

/** Creates an org/site/lab, a user with the given role as an active member, and a session token. */
export async function seedUserInLab(
  t: ReturnType<typeof makeTest>,
  role: Role,
  opts?: { labId?: any; labName?: string }
) {
  return await t.run(async (ctx) => {
    let labId = opts?.labId;
    if (!labId) {
      const orgId = await ctx.db.insert("organizations", { name: "Test Org", created_at: Date.now() });
      const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Test Site", created_at: Date.now() });
      labId = await ctx.db.insert("labs", { site_id: siteId, name: opts?.labName ?? "Test Lab", created_at: Date.now() });
    }

    const userId = await ctx.db.insert("users", {
      email: `${role}-${Math.random().toString(36).slice(2)}@test.local`,
      hashed_password: "x",
      full_name: `Test ${role}`,
      role,
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await ctx.db.insert("lab_memberships", {
      lab_id: labId, user_id: userId, lab_role: role, status: "active", created_at: Date.now(),
    });

    const token = `test-token-${userId}`;
    await ctx.db.insert("sessions", { user_id: userId, token, expires_at: Date.now() + 3600_000, created_at: Date.now() });

    return { userId, labId, token };
  });
}

/** Creates a lab with no membership for the given user — used for isolation tests. */
export async function seedOtherLab(t: ReturnType<typeof makeTest>) {
  return await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Other Org", created_at: Date.now() });
    const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Other Site", created_at: Date.now() });
    return await ctx.db.insert("labs", { site_id: siteId, name: "Other Lab", created_at: Date.now() });
  });
}
