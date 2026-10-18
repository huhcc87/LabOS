import { describe, it, expect } from "vitest";
import { hitRateLimit } from "../../convex/security";

/** A tiny stand-in for the database table the limiter stores its counters in. */
function fakeDb() {
  const rows: Array<{ _id: string; key: string; window_start: number; count: number }> = [];
  return {
    rows,
    query: () => ({ withIndex: (_n: string, f: (q: { eq: (a: string, v: string) => string }) => string) => { const key = f({ eq: (_a, v) => v }); return { first: async () => rows.find((r) => r.key === key) ?? null }; } }),
    patch: async (id: string, p: Partial<{ window_start: number; count: number }>) => { Object.assign(rows.find((r) => r._id === id)!, p); },
    insert: async (_t: string, r: { key: string; window_start: number; count: number }) => { rows.push({ _id: `r${rows.length}`, ...r }); },
  };
}

describe("stored rate limiter", () => {
  it("allows requests up to the limit, then blocks with a wait time", async () => {
    const db = fakeDb();
    for (let i = 0; i < 3; i++) await hitRateLimit(db as never, "login:a", 3, 60_000);
    await expect(hitRateLimit(db as never, "login:a", 3, 60_000)).rejects.toThrow(/Too many attempts/);
  });

  it("counts each key separately", async () => {
    const db = fakeDb();
    for (let i = 0; i < 3; i++) await hitRateLimit(db as never, "login:a", 3, 60_000);
    await expect(hitRateLimit(db as never, "login:b", 3, 60_000)).resolves.toBeUndefined();
  });

  it("starts a new window once the old one has passed", async () => {
    const db = fakeDb();
    for (let i = 0; i < 3; i++) await hitRateLimit(db as never, "k", 3, 60_000);
    db.rows[0].window_start -= 61_000;
    await expect(hitRateLimit(db as never, "k", 3, 60_000)).resolves.toBeUndefined();
    expect(db.rows[0].count).toBe(1);
  });
});
