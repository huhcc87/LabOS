/**
 * Budget limits for reagent requests. A budget in Procurement > Budgets applies to every request whose
 * grant, project or budget code has the same name (ignoring case). Approved, ordered and received
 * requests count against it. Plain helpers, no database access: callers pass the rows.
 * ponytail: the budget's period is not used (all time); add a date window if budgets must reset.
 */
import type { Doc } from "./_generated/dataModel";

type Line = Pick<Doc<"reagent_cart">, "quantity" | "unit_price" | "grant" | "project" | "budget_code">;

export const lineTotal = (r: { unit_price?: number; quantity: number }) => (r.unit_price ?? 0) * r.quantity;

const key = (s?: string) => (s ?? "").trim().toLowerCase();
const COUNTED = ["approved", "ordered", "received"];

export function matchingBudgets(budgets: Doc<"procurement_budgets">[], r: Line) {
  const keys = new Set([r.grant, r.project, r.budget_code].map(key).filter(Boolean));
  return budgets.filter((b) => keys.has(key(b.name)));
}

/** Money already committed against one budget. `skipId` leaves out the request being checked. */
export function committedFor(budget: Doc<"procurement_budgets">, rows: Doc<"reagent_cart">[], skipId?: string) {
  return rows
    .filter((r) => COUNTED.includes(r.status) && r._id !== skipId && matchingBudgets([budget], r).length)
    .reduce((s, r) => s + lineTotal(r), 0);
}

/** Budgets this request would push over their limit. Empty when it fits (or no budget applies). */
export function overBudget(budgets: Doc<"procurement_budgets">[], rows: Doc<"reagent_cart">[], r: Line, skipId?: string) {
  const total = lineTotal(r);
  if (total <= 0) return [];
  return matchingBudgets(budgets, r)
    .map((b) => ({ name: b.name, limit: b.amount, committed: committedFor(b, rows, skipId) }))
    .filter((o) => o.committed + total > o.limit);
}
