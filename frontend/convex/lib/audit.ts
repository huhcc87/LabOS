import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Writes one row to the existing `audit_logs` table (schema.ts) — reused as
 * the storage-hierarchy audit trail rather than adding a parallel table.
 * Call in the same mutation as the write it records, per the ADR's
 * cross-cutting requirement ("audit row written in the same mutation").
 */
export async function writeAudit(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    action: string; // e.g. "storage_units.create", "samples.move"
    entityType: string; // e.g. "storage_units", "samples"
    entityId: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("audit_logs", {
    user_id: args.userId,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId,
    details: args.details ? JSON.stringify(args.details) : undefined,
    created_at: Date.now(),
  });
}
