/**
 * Protocol approval rules, shared by the Convex functions (which enforce them)
 * and the frontend (which shows the matching buttons).
 */
import { v } from "convex/values";

export type ApprovalMode = "user" | "pi";

export interface ProtocolApproval {
  mode: ApprovalMode;
  /** Named PI for "user" mode; optional label for "pi" mode. */
  approver?: string;
  state: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
}

export const approvalValidator = v.object({
  mode: v.union(v.literal("user"), v.literal("pi")),
  approver: v.optional(v.string()),
  state: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  decidedBy: v.optional(v.string()),
  decidedAt: v.optional(v.string()),
});

interface Approver { full_name?: string; email?: string; role?: string }

/** No approval configured counts as approved. */
export const isApproved = (a?: ProtocolApproval): boolean => !a || a.state === "approved";

/**
 * Only PI accounts approve — admins and super admins do not.
 * "pi" mode: any PI. "user" mode: only the named PI (name or email).
 */
export function canDecide(a: ProtocolApproval | undefined, user: Approver | null): boolean {
  if (!a || !user || user.role !== "pi") return false;
  if (a.mode === "pi") return true;
  const want = (a.approver ?? "").trim().toLowerCase();
  return !!want && [user.full_name, user.email].some((x) => x?.trim().toLowerCase() === want);
}

/** Content changed: anyone other than an eligible approver sends it back to pending. */
export function afterEdit(a: ProtocolApproval | undefined, editor: Approver | null): ProtocolApproval | undefined {
  if (!a || a.state === "pending" || canDecide(a, editor)) return a;
  return { mode: a.mode, approver: a.approver, state: "pending" };
}
