/**
 * How fast a budget is being spent and when the money would run out at that pace.
 * Uses what the lab actually committed recently; it knows nothing about award dates, so it is a rough guide.
 * Matching follows the backend (convex/cartBudgets.ts): a request counts against a budget when its grant,
 * project or budget code equals the budget name (ignoring case); approved, ordered and received requests count.
 */
export interface ForecastRow {
  status: string; unit_price: number | null; quantity: number; grant?: string; project?: string; budget_code?: string;
  ordered_at?: string | null; captured_at?: string;
}

export interface BudgetForecast {
  committed: number;
  remaining: number;
  /** Money committed per day over the recent window; null when nothing was committed in it. */
  perDay: number | null;
  /** Whole days until the remaining money is used up at that pace; null when there is no pace or nothing is left. */
  daysLeft: number | null;
  runOut: Date | null;
}

const DAY = 86_400_000;
const COUNTED = new Set(['approved', 'ordered', 'received']);
/** A single recent purchase should not be read as a daily habit, so the pace is spread over at least this many days. */
export const MIN_WINDOW_DAYS = 14;

const key = (s?: string) => (s ?? '').trim().toLowerCase();
const total = (r: ForecastRow) => (r.unit_price ?? 0) * r.quantity;
const when = (r: ForecastRow) => new Date(r.ordered_at ?? r.captured_at ?? 0).getTime();

export function forecastBudget(budget: { name: string; amount: number }, rows: ForecastRow[], now = Date.now(), windowDays = 90): BudgetForecast {
  const mine = rows.filter((r) => COUNTED.has(r.status) && [r.grant, r.project, r.budget_code].some((k) => key(k) && key(k) === key(budget.name)));
  const committed = mine.reduce((s, r) => s + total(r), 0);
  const remaining = budget.amount - committed;

  const recent = mine.filter((r) => when(r) >= now - windowDays * DAY && total(r) > 0);
  if (!recent.length) return { committed, remaining, perDay: null, daysLeft: null, runOut: null };

  const earliest = Math.min(...recent.map(when));
  const span = Math.min(windowDays, Math.max(MIN_WINDOW_DAYS, (now - earliest) / DAY));
  const perDay = recent.reduce((s, r) => s + total(r), 0) / span;
  if (remaining <= 0) return { committed, remaining, perDay, daysLeft: null, runOut: null };
  const daysLeft = Math.floor(remaining / perDay);
  return { committed, remaining, perDay, daysLeft, runOut: new Date(now + daysLeft * DAY) };
}
