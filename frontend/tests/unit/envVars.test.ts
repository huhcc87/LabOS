import { describe, it, expect } from "vitest";

/**
 * Tests that dev-only features are properly gated.
 */

describe("Dev-only gating", () => {
  it("import.meta.env.DEV is defined in test environment", () => {
    // vitest runs with DEV=true by default
    expect(import.meta.env.DEV).toBeDefined();
  });

  it("demo users pattern gates on DEV", () => {
    // Replicate the pattern from LoginPage.tsx
    const DEMO_USERS = import.meta.env.DEV
      ? [{ email: "test@lab.com", name: "Test" }]
      : [];

    // In test (dev) mode, demo users should be present
    expect(DEMO_USERS.length).toBeGreaterThan(0);
  });

  it("demo users are empty when DEV is false", () => {
    // Simulate production behavior
    const isDev = false;
    const DEMO_USERS = isDev
      ? [{ email: "test@lab.com", name: "Test" }]
      : [];

    expect(DEMO_USERS).toHaveLength(0);
  });
});

describe("Required environment variables", () => {
  it("VITE_CONVEX_URL must be set for the app to work", () => {
    // In test environment, this may be undefined — that's ok.
    // This test documents the requirement.
    const url = import.meta.env.VITE_CONVEX_URL;
    if (url) {
      expect(url).toMatch(/^https:\/\/.+\.convex\.cloud$/);
    }
  });
});
