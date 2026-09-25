/**
 * Auth helper for custom token-based auth.
 * Each protected function receives a `token` arg and calls requireAuth to get the userId.
 */
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";

/**
 * Validates a session token and returns the user_id.
 * Throws "Unauthorized" if token is missing, invalid, or expired.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined | null
): Promise<Id<"users">> {
  if (!token) throw new ConvexError("Unauthorized");
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session || session.expires_at < Date.now()) {
    throw new ConvexError("Unauthorized");
  }
  return session.user_id;
}

export type UserRole = "superadmin" | "admin" | "pi" | "manager" | "staff" | "trainee";

const ROLE_ORDER: UserRole[] = ["trainee", "staff", "manager", "pi", "admin", "superadmin"];

export function hasRole(userRole: string, minRole: UserRole): boolean {
  return ROLE_ORDER.indexOf(userRole as UserRole) >= ROLE_ORDER.indexOf(minRole);
}

/**
 * Validates a session token AND that the caller's role meets minRole.
 * Throws "Unauthorized" (no session) or "Forbidden" (insufficient role).
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined | null,
  minRole: UserRole
): Promise<Doc<"users">> {
  const userId = await requireAuth(ctx, token);
  const user = await ctx.db.get(userId);
  if (!user || !user.is_active) throw new ConvexError("Unauthorized");
  if (!hasRole(user.role, minRole)) {
    throw new ConvexError(`Forbidden: requires ${minRole} role or higher`);
  }
  return user;
}

/** Strips password hash and TOTP secret before a user document crosses a function boundary. */
export function sanitizeUser<T extends { hashed_password?: unknown; totp_secret?: unknown }>(
  user: T
): Omit<T, "hashed_password" | "totp_secret"> {
  const { hashed_password: _h, totp_secret: _t, ...safe } = user;
  return safe;
}
