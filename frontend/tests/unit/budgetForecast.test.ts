import { describe, it, expect } from "vitest";
import { forecastBudget, type ForecastRow } from "../../src/features/cart/budgetForecast";

const NOW = new Date("2026-10-31T00:00:00Z").getTime();
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const row = (o: Partial<ForecastRow>): ForecastRow => ({ status: "ordered", unit_price: 100, quantity: 1, grant: "R01-123", captured_at: day(10), ...o });

describe("forecastBudget", () => {
  it("projects the run-out date from recent spending", () => {
    // $900 over the last 30 days = $30/day; $4,000 budget, $900 spent -> $3,100 left -> 103 days
    const rows = [row({ unit_price: 300, captured_at: day(30) }), row({ unit_price: 300, captured_at: day(15) }), row({ unit_price: 300, captured_at: day(1) })];
    const f = forecastBudget({ name: "r01-123", amount: 4000 }, rows, NOW);
    expect(f.committed).toBe(900);
    expect(f.remaining).toBe(3100);
    expect(f.perDay).toBeCloseTo(30, 5);
    expect(f.daysLeft).toBe(103);
  });

  it("matches on grant, project or budget code, ignoring case", () => {
    const rows = [row({ grant: "", project: "Alpha", unit_price: 50 }), row({ grant: "", budget_code: "ALPHA", unit_price: 70 }), row({ grant: "Other" })];
    expect(forecastBudget({ name: "alpha", amount: 1000 }, rows, NOW).committed).toBe(120);
  });

  it("ignores requests that were never approved", () => {
    const rows = [row({ status: "pending" }), row({ status: "rejected" }), row({ status: "cancelled" })];
    expect(forecastBudget({ name: "R01-123", amount: 500 }, rows, NOW).committed).toBe(0);
  });

  it("gives no pace when nothing was spent in the last 90 days", () => {
    const f = forecastBudget({ name: "R01-123", amount: 500 }, [row({ captured_at: day(200) })], NOW);
    expect(f.perDay).toBeNull();
    expect(f.runOut).toBeNull();
    expect(f.remaining).toBe(400);
  });

  it("does not turn one recent purchase into a daily habit", () => {
    const f = forecastBudget({ name: "R01-123", amount: 1000 }, [row({ unit_price: 140, captured_at: day(0) })], NOW);
    expect(f.perDay).toBeCloseTo(10, 5); // $140 spread over the 14-day minimum, not over 1 day
  });

  it("reports an overspent budget without a run-out date", () => {
    const f = forecastBudget({ name: "R01-123", amount: 50 }, [row({ unit_price: 100 })], NOW);
    expect(f.remaining).toBe(-50);
    expect(f.daysLeft).toBeNull();
  });
});
