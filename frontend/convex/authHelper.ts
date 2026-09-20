/**
 * Auth helper for custom token-based auth.
 * Each protected function receives a `token` arg and calls requireAuth to get the userId.
 */
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Validates a session token and returns the user_id.
 * Throws "Unauthorized" if token is missing, invalid, or expired.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined | null
): Promise<Id<"users">> {
  if (!token) throw new Error("Unauthorized");
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session || session.expires_at < Date.now()) {
    throw new Error("Unauthorized");
  }
  return session.user_id;
}
