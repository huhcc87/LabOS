import { describe, it, expect } from "vitest";
import { meetsContrastRatio, prefersReducedMotion } from "../../src/lib/a11y";

describe("a11y utilities", () => {
  it("detects sufficient contrast (black on white)", () => {
    expect(meetsContrastRatio("#000000", "#ffffff")).toBe(true);
  });

  it("detects insufficient contrast (light gray on white)", () => {
    expect(meetsContrastRatio("#cccccc", "#ffffff")).toBe(false);
  });

  it("passes WCAG AA for indigo on white", () => {
    // indigo-600 (#4f46e5) on white should pass
    expect(meetsContrastRatio("#4f46e5", "#ffffff", 4.5)).toBe(true);
  });

  it("prefersReducedMotion returns boolean", () => {
    expect(typeof prefersReducedMotion()).toBe("boolean");
  });
});
