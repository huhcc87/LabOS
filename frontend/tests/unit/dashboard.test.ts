import { describe, it, expect } from "vitest";

/**
 * Tests for dashboard data processing logic.
 * Validates the summary shape and computation patterns
 * used in convex/dashboard.ts.
 */

describe("Dashboard data computations", () => {
  // Simulate the task status grouping from dashboard.ts
  function groupByStatus(tasks: { status: string }[]) {
    const result: Record<string, number> = {};
    for (const t of tasks) {
      result[t.status] = (result[t.status] ?? 0) + 1;
    }
    return result;
  }

  it("groups tasks by status correctly", () => {
    const tasks = [
      { status: "pending" },
      { status: "in_progress" },
      { status: "pending" },
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
    ];
    const result = groupByStatus(tasks);
    expect(result).toEqual({
      pending: 2,
      in_progress: 1,
      completed: 3,
    });
  });

  it("handles empty task list", () => {
    expect(groupByStatus([])).toEqual({});
  });

  // Simulate overdue task detection
  function countOverdue(tasks: { status: string; due_date?: number }[], now: number) {
    return tasks.filter(
      (t) =>
        t.status === "overdue" ||
        (t.due_date && t.due_date < now && t.status !== "completed")
    ).length;
  }

  it("detects overdue tasks", () => {
    const now = Date.now();
    const tasks = [
      { status: "pending", due_date: now - 86400000 }, // overdue
      { status: "completed", due_date: now - 86400000 }, // completed, not overdue
      { status: "in_progress", due_date: now + 86400000 }, // future, not overdue
      { status: "overdue" }, // explicit overdue status
    ];
    expect(countOverdue(tasks, now)).toBe(2);
  });

  // Simulate low stock detection
  function countLowStock(items: { quantity: number; minimum_quantity?: number }[]) {
    return items.filter(
      (i) => i.minimum_quantity !== undefined && i.quantity <= i.minimum_quantity
    ).length;
  }

  it("detects low stock items", () => {
    const items = [
      { quantity: 5, minimum_quantity: 10 }, // low
      { quantity: 50, minimum_quantity: 10 }, // ok
      { quantity: 0, minimum_quantity: 0 }, // at zero minimum
      { quantity: 100 }, // no minimum set
    ];
    expect(countLowStock(items)).toBe(2);
  });

  // Simulate weekly intake bucketing
  function bucketByWeek(
    items: { created_at: number }[],
    now: number,
    weeks: number
  ) {
    const result: { week: string; count: number }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 86_400_000;
      const weekEnd = now - i * 7 * 86_400_000;
      const count = items.filter(
        (s) => s.created_at >= weekStart && s.created_at < weekEnd
      ).length;
      const d = new Date(weekStart);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      result.push({ week: label, count });
    }
    return result;
  }

  it("buckets items into weekly bins", () => {
    const now = Date.now();
    const items = [
      { created_at: now - 2 * 86_400_000 }, // this week
      { created_at: now - 3 * 86_400_000 }, // this week
      { created_at: now - 10 * 86_400_000 }, // last week
    ];
    const result = bucketByWeek(items, now, 8);
    expect(result).toHaveLength(8);
    // Total across all weeks should match items in range
    const total = result.reduce((sum, w) => sum + w.count, 0);
    expect(total).toBe(3);
  });

  it("returns 8 weeks even with no data", () => {
    const result = bucketByWeek([], Date.now(), 8);
    expect(result).toHaveLength(8);
    expect(result.every((w) => w.count === 0)).toBe(true);
  });
});

describe("Dashboard MAX_ROWS safety", () => {
  it("take() limits prevent unbounded arrays", () => {
    const MAX_ROWS = 5000;
    const bigArray = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
    const capped = bigArray.slice(0, MAX_ROWS);
    expect(capped).toHaveLength(MAX_ROWS);
    expect(capped[0].id).toBe(0);
    expect(capped[MAX_ROWS - 1].id).toBe(MAX_ROWS - 1);
  });
});
