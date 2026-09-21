// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

type T = ReturnType<typeof convexTest>;

async function seedBox(t: T) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Org", created_at: Date.now() });
    const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Site", created_at: Date.now() });
    const labId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab A", created_at: Date.now() });
    const userId = await ctx.db.insert("users", {
      email: "staff@lab.com", hashed_password: "x", full_name: "Staff", role: "staff",
      is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: Date.now(), updated_at: Date.now(),
    });
    await ctx.db.insert("lab_memberships", { lab_id: labId, user_id: userId, lab_role: "member", status: "active", created_at: Date.now() });
    const token = "test-token";
    await ctx.db.insert("sessions", { user_id: userId, token, expires_at: Date.now() + 3600_000, created_at: Date.now() });
    const unitId = await ctx.db.insert("storage_units", {
      lab_id: labId, name: "Freezer 1", storage_type: "-80", status: "normal",
      created_at: Date.now(), created_by: userId, updated_at: Date.now(), version: 1,
    });
    const boxId = await ctx.db.insert("storage_nodes", {
      lab_id: labId, unit_id: unitId, parent_id: undefined, path: [], depth: 0, kind: "box",
      name: "Box 1", rows: 9, cols: 9, created_at: Date.now(), created_by: userId, updated_at: Date.now(), version: 1,
    });
    return { labId, userId, token, boxId };
  });
}

describe("storagePositions.reserve / release", () => {
  it("reserves an empty slot and lists it back", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxId } = await seedBox(t);

    const pos = await t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 0, col: 0, label: "A1" });
    expect(pos?.state).toBe("reserved");

    const listed = await t.query(api.storagePositions.listForBox, { token, labId, boxId });
    expect(listed.rows).toBe(9);
    expect(listed.positions).toHaveLength(1);
    expect(listed.positions[0].label).toBe("A1");
  });

  it("rejects reserving an already-reserved slot", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxId } = await seedBox(t);
    await t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 0, col: 0, label: "A1" });
    await expect(
      t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 0, col: 0, label: "A1" }),
    ).rejects.toThrow(/already/);
  });

  it("rejects a position outside the box's declared grid", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxId } = await seedBox(t);
    await expect(
      t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 99, col: 0, label: "Z1" }),
    ).rejects.toThrow(/outside/);
  });

  it("release frees the slot so it can be reserved again", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxId } = await seedBox(t);
    const pos = await t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 0, col: 0, label: "A1" });

    await t.mutation(api.storagePositions.release, { token, labId, id: pos!._id, version: pos!.version });
    const listed = await t.query(api.storagePositions.listForBox, { token, labId, boxId });
    expect(listed.positions).toHaveLength(0);

    const again = await t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 0, col: 0, label: "A1" });
    expect(again?.state).toBe("reserved");
  });

  it("concurrent reserve calls on the same slot: exactly one wins", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxId } = await seedBox(t);

    const results = await Promise.allSettled([
      t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 3, col: 3, label: "D4" }),
      t.mutation(api.storagePositions.reserve, { token, labId, boxId, row: 3, col: 3, label: "D4" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const listed = await t.query(api.storagePositions.listForBox, { token, labId, boxId });
    expect(listed.positions).toHaveLength(1);
  });
});
