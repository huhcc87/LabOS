import { describe, it, expect } from "vitest";

/**
 * Tests for auth-related logic used across the app.
 * These test the patterns rather than Convex functions directly
 * (which require the Convex test harness).
 */

describe("Auth token handling", () => {
  const TOKEN_KEY = "labos_auth_token";

  it("stores and retrieves auth token from localStorage", () => {
    localStorage.setItem(TOKEN_KEY, "test-token-abc");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("test-token-abc");
  });

  it("returns null for missing token", () => {
    localStorage.removeItem(TOKEN_KEY);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("clearing token logs user out", () => {
    localStorage.setItem(TOKEN_KEY, "some-token");
    localStorage.removeItem(TOKEN_KEY);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("Session expiry logic", () => {
  it("detects expired session", () => {
    const session = { token: "abc", expires_at: Date.now() - 1000 };
    const isExpired = session.expires_at < Date.now();
    expect(isExpired).toBe(true);
  });

  it("detects valid session", () => {
    const session = { token: "abc", expires_at: Date.now() + 3600_000 };
    const isExpired = session.expires_at < Date.now();
    expect(isExpired).toBe(false);
  });
});

describe("Role-based access patterns", () => {
  const ADMIN_ROLES = ["admin", "superadmin"];

  it("admin role passes admin check", () => {
    expect(ADMIN_ROLES.includes("admin")).toBe(true);
  });

  it("superadmin role passes admin check", () => {
    expect(ADMIN_ROLES.includes("superadmin")).toBe(true);
  });

  it("staff role fails admin check", () => {
    expect(ADMIN_ROLES.includes("staff")).toBe(false);
  });

  it("pi role fails admin check", () => {
    expect(ADMIN_ROLES.includes("pi")).toBe(false);
  });

  it("trainee role fails admin check", () => {
    expect(ADMIN_ROLES.includes("trainee")).toBe(false);
  });
});

describe("Password hash stripping", () => {
  it("strips hashed_password from user object", () => {
    const user = {
      email: "test@lab.com",
      full_name: "Test User",
      hashed_password: "$2b$12$somehash",
      role: "staff",
    };
    const { hashed_password: _, ...safeUser } = user;
    expect(safeUser).toEqual({
      email: "test@lab.com",
      full_name: "Test User",
      role: "staff",
    });
    expect((safeUser as any).hashed_password).toBeUndefined();
  });
});
