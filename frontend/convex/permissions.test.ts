// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { roleRank, hasStoragePermission, requireLabAccess, requireStoragePermission } from "./permissions";

describe("roleRank / hasStoragePermission (pure)", () => {
  it("ranks owner roles above lab admin above standard above readonly", () => {
    expect(roleRank("superadmin")).toBeGreaterThan(roleRank("pi"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("pi"));
    expect(roleRank("pi")).toBeGreaterThan(roleRank("manager"));
    expect(roleRank("staff")).toBe(roleRank("manager"));
    expect(roleRank("manager")).toBeGreaterThan(roleRank("trainee"));
  });

  it("unknown roles rank below trainee (no access)", () => {
    expect(roleRank("not-a-role")).toBeLessThan(roleRank("trainee"));
  });

  it("delete requires owner or lab admin (pi), not standard or readonly", () => {
    expect(hasStoragePermission("superadmin", "delete")).toBe(true);
    expect(hasStoragePermission("admin", "delete")).toBe(true);
    expect(hasStoragePermission("pi", "delete")).toBe(true);
    expect(hasStoragePermission("manager", "delete")).toBe(false);
    expect(hasStoragePermission("staff", "delete")).toBe(false);
    expect(hasStoragePermission("trainee", "delete")).toBe(false);
  });

  it("trainees can view and checkout/return but not create", () => {
    expect(hasStoragePermission("trainee", "view")).toBe(true);
    expect(hasStoragePermission("trainee", "checkout")).toBe(true);
    expect(hasStoragePermission("trainee", "return")).toBe(true);
    expect(hasStoragePermission("trainee", "create")).toBe(false);
  });

  it("staff and managers can create/move/archive but not delete", () => {
    for (const role of ["staff", "manager"]) {
      expect(hasStoragePermission(role, "create")).toBe(true);
      expect(hasStoragePermission(role, "move")).toBe(true);
      expect(hasStoragePermission(role, "archive")).toBe(true);
      expect(hasStoragePermission(role, "delete")).toBe(false);
    }
  });
});

describe("requireLabAccess (db-backed)", () => {
  async function seed(t: ReturnType<typeof convexTest>) {
    return t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", { name: "Org", created_at: Date.now() });
      const siteId = await ctx.db.insert("sites", {
        organization_id: orgId,
        name: "Site",
        created_at: Date.now(),
      });
      const labId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab A", created_at: Date.now() });
      const otherLabId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab B", created_at: Date.now() });
      const memberUserId = await ctx.db.insert("users", {
        email: "member@lab.com",
        hashed_password: "x",
        full_name: "Member",
        role: "staff",
        is_active: true,
        totp_enabled: false,
        failed_login_attempts: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      const outsiderUserId = await ctx.db.insert("users", {
        email: "outsider@lab.com",
        hashed_password: "x",
        full_name: "Outsider",
        role: "pi",
        is_active: true,
        totp_enabled: false,
        failed_login_attempts: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      await ctx.db.insert("lab_memberships", {
        lab_id: labId,
        user_id: memberUserId,
        lab_role: "member",
        status: "active",
        created_at: Date.now(),
      });
      return { labId, otherLabId, memberUserId, outsiderUserId };
    });
  }

  it("resolves the role for an active member of the lab", async () => {
    const t = convexTest(schema);
    const { labId, memberUserId } = await seed(t);
    const result = await t.run((ctx) => requireLabAccess(ctx, memberUserId, labId));
    expect(result.role).toBe("staff");
  });

  it("rejects a user with no membership in that lab", async () => {
    const t = convexTest(schema);
    const { labId, outsiderUserId } = await seed(t);
    await expect(t.run((ctx) => requireLabAccess(ctx, outsiderUserId, labId))).rejects.toThrow(
      /Forbidden/,
    );
  });

  it("rejects a member checking access against a different lab", async () => {
    const t = convexTest(schema);
    const { otherLabId, memberUserId } = await seed(t);
    await expect(t.run((ctx) => requireLabAccess(ctx, memberUserId, otherLabId))).rejects.toThrow(
      /Forbidden/,
    );
  });

  it("requireStoragePermission rejects a permitted-role member on an action their rank lacks", async () => {
    const t = convexTest(schema);
    const { labId, memberUserId } = await seed(t); // role: staff
    await expect(
      t.run((ctx) => requireStoragePermission(ctx, memberUserId, labId, "delete")),
    ).rejects.toThrow(/Forbidden/);
  });

  it("requireStoragePermission allows a staff member to create", async () => {
    const t = convexTest(schema);
    const { labId, memberUserId } = await seed(t);
    const result = await t.run((ctx) => requireStoragePermission(ctx, memberUserId, labId, "create"));
    expect(result.role).toBe("staff");
  });
});
