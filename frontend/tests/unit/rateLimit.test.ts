import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../../convex/rateLimit";

describe("rate limiter", () => {
  it("allows requests under the limit", () => {
    const key = `test_${Date.now()}`;
    expect(() => checkRateLimit(key)).not.toThrow();
    expect(() => checkRateLimit(key)).not.toThrow();
    expect(() => checkRateLimit(key)).not.toThrow();
  });

  it("blocks after exceeding max attempts", () => {
    const key = `flood_${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key); // 10 allowed
    }
    expect(() => checkRateLimit(key)).toThrow(/Too many requests/);
  });

  it("uses separate counters per key", () => {
    const key1 = `separate1_${Date.now()}`;
    const key2 = `separate2_${Date.now()}`;
    for (let i = 0; i < 10; i++) checkRateLimit(key1);
    // key1 is exhausted, but key2 should still work
    expect(() => checkRateLimit(key2)).not.toThrow();
  });
});
