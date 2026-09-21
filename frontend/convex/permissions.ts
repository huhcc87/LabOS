import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Storage-hierarchy tenancy + permissions (Checkpoint B).
 *
 * Tenancy boundary is `lab_id` (via `lab_memberships`), not `workspace_id`
 * (see ADR correction note). Permission tiers map to the existing global
 * `users.role` enum — there is no per-feature 16-permission list in this
 * repo (Gap Report §9 was never captured), so this maps the decided
 * Owner/Lab-Admin split onto the roles that already exist:
 *
 *   superadmin, admin  -> owner      (rank 3) — full control, incl. delete
 *   pi                 -> labAdmin   (rank 2) — delete, plus everything below
 *   manager, staff     -> standard   (rank 1) — create/update/move/archive
 *   trainee            -> readonly   (rank 0) — view, checkout/return only
 */

export type StorageAction =
  | "view"
  | "checkout"
  | "return"
  | "create"
  | "update"
  | "move"
  | "place"
  | "archive"
  | "restore"
  | "dispose"
  | "delete";

const ROLE_RANK: Record<string, number> = {
  superadmin: 3,
  admin: 3,
  pi: 2,
  manager: 1,
  staff: 1,
  trainee: 0,
};

const ACTION_MIN_RANK: Record<StorageAction, number> = {
  view: 0,
  checkout: 0,
  return: 0,
  create: 1,
  update: 1,
  move: 1,
  place: 1,
  archive: 1,
  restore: 1,
  dispose: 1,
  delete: 2, // Owner + Lab Admin only (Plan §5 Q6)
};

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? -1; // unknown role: no access
}

export function hasStoragePermission(role: string, action: StorageAction): boolean {
  return roleRank(role) >= ACTION_MIN_RANK[action];
}

/**
 * Confirms the user has an active membership in `labId` and returns their
 * global role. Throws rather than returning false so callers can't
 * accidentally proceed on a missing check.
 */
export async function requireLabAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  labId: Id<"labs">,
): Promise<{ role: string }> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Unauthorized");

  const membership = await ctx.db
    .query("lab_memberships")
    .withIndex("by_user", (q) => q.eq("user_id", userId))
    .filter((q) => q.and(q.eq(q.field("lab_id"), labId), q.eq(q.field("status"), "active")))
    .first();
  if (!membership) throw new Error("Forbidden: not a member of this lab");

  return { role: user.role };
}

export async function requireStoragePermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  labId: Id<"labs">,
  action: StorageAction,
): Promise<{ role: string }> {
  const { role } = await requireLabAccess(ctx, userId, labId);
  if (!hasStoragePermission(role, action)) {
    throw new Error(`Forbidden: role '${role}' cannot '${action}'`);
  }
  return { role };
}
