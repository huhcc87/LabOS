/**
 * One place that writes the audit entry for a purchasing event, so requests, approvals, orders and budgets
 * all show up in the Audit Trail with the same shape. The lab is stamped by the lab-scoped database.
 */
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type ProcurementAction = "request" | "approve" | "reject" | "order" | "update" | "cancel" | "budget_create" | "budget_delete";

export async function logProcurement(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  action: ProcurementAction,
  entityId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await ctx.db.insert("audit_logs", {
    user_id: userId, action, entity_type: "procurement", entity_id: entityId,
    details: JSON.stringify(details), created_at: Date.now(),
  });
}
