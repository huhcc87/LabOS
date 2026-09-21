// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type T = ReturnType<typeof convexTest>;

async function seedLab(t: T, role: string = "staff") {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Org", created_at: Date.now() });
    const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Site", created_at: Date.now() });
    const labId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab A", created_at: Date.now() });
    const otherLabId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab B", created_at: Date.now() });
    const userId = await ctx.db.insert("users", {
      email: `${role}@lab.com`, hashed_password: "x", full_name: role, role,
      is_active: true, totp_enabled: false, failed_login_attempts: 0,
      created_at: Date.now(), updated_at: Date.now(),
    });
    await ctx.db.insert("lab_memberships", {
      lab_id: labId, user_id: userId, lab_role: "member", status: "active", created_at: Date.now(),
    });
    const token = `token-${role}`;
    await ctx.db.insert("sessions", { user_id: userId, token, expires_at: Date.now() + 3600_000, created_at: Date.now() });
    return { labId, otherLabId, userId, token };
  });
}

describe("storageUnits CRUD + tenancy", () => {
  it("creates a unit and lists it back scoped to its lab", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedLab(t);

    const unit = await t.mutation(api.storageUnits.create, {
      token, labId, name: "Freezer 1", storage_type: "-80", status: "normal",
    });
    expect(unit?.name).toBe("Freezer 1");
    expect(unit?.version).toBe(1);

    const page = await t.query(api.storageUnits.list, { token, labId });
    expect(page.page.map((u) => u._id)).toContain(unit!._id);
  });

  it("a lab cannot read another lab's units", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, otherLabId, userId, token } = await seedLab(t);
    // give the same user membership in the other lab too, but as an outsider check
    // we instead assert the created unit never shows up when listing under otherLabId.
    await t.mutation(api.storageUnits.create, { token, labId, name: "Freezer 1", storage_type: "-80", status: "normal" });

    await t.run((ctx) =>
      ctx.db.insert("lab_memberships", { lab_id: otherLabId, user_id: userId, lab_role: "member", status: "active", created_at: Date.now() }),
    );
    const page = await t.query(api.storageUnits.list, { token, labId: otherLabId });
    expect(page.page).toHaveLength(0);
  });

  it("update rejects a stale version", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedLab(t);
    const unit = await t.mutation(api.storageUnits.create, { token, labId, name: "Freezer 1", storage_type: "-80", status: "normal" });

    await t.mutation(api.storageUnits.update, { token, labId, id: unit!._id, version: unit!.version, name: "Freezer 1 (renamed)" });
    await expect(
      t.mutation(api.storageUnits.update, { token, labId, id: unit!._id, version: unit!.version, name: "stale write" }),
    ).rejects.toThrow(/CONFLICT/);
  });
});

describe("storageUnits.previewTemplate", () => {
  it("computes counts without writing anything", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedLab(t);
    const preview = await t.query(api.storageUnits.previewTemplate, {
      token, labId, template: { shelves: 2, racksPerShelf: 5, boxesPerRack: 4, boxRows: 9, boxCols: 9 },
    });
    expect(preview.shelves).toBe(2);
    expect(preview.racks).toBe(10);
    expect(preview.boxes).toBe(40);
  });
});

describe("storageUnits.create with template", () => {
  it("materializes the full shelf/rack/box tree", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedLab(t);
    const unit = await t.mutation(api.storageUnits.create, {
      token, labId, name: "Freezer 1", storage_type: "-80", status: "normal",
      template: { shelves: 2, racksPerShelf: 2, boxesPerRack: 2, boxRows: 9, boxCols: 9 },
    });

    const nodes = await t.run((ctx) =>
      ctx.db.query("storage_nodes").withIndex("by_unit", (q) => q.eq("unit_id", unit!._id)).collect(),
    );
    expect(nodes.filter((n) => n.kind === "shelf")).toHaveLength(2);
    expect(nodes.filter((n) => n.kind === "rack")).toHaveLength(4);
    expect(nodes.filter((n) => n.kind === "box")).toHaveLength(8);
    for (const box of nodes.filter((n) => n.kind === "box")) {
      expect(box.path).toHaveLength(2);
    }
  });
});

describe("storageUnits.archive / purge", () => {
  it("blocks archive while a position is occupied, allows once cleared", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, userId } = await seedLab(t);
    const unit = await t.mutation(api.storageUnits.create, { token, labId, name: "Freezer 1", storage_type: "-80", status: "normal" });
    const boxId = await t.run(async (ctx) =>
      ctx.db.insert("storage_nodes", {
        lab_id: labId, unit_id: unit!._id, parent_id: undefined, path: [], depth: 0, kind: "box",
        name: "Box 1", rows: 9, cols: 9, created_at: Date.now(), created_by: userId, updated_at: Date.now(), version: 1,
      }),
    );
    const positionId = await t.run((ctx) =>
      ctx.db.insert("storage_positions", {
        lab_id: labId, box_id: boxId, row: 0, col: 0, label: "A1", state: "occupied",
        created_at: Date.now(), created_by: userId, updated_at: Date.now(), version: 1,
      }),
    );

    await expect(t.mutation(api.storageUnits.archive, { token, labId, id: unit!._id, version: unit!.version })).rejects.toThrow(/occupied/);
    await t.run((ctx) => ctx.db.delete(positionId));
    const archived = await t.mutation(api.storageUnits.archive, { token, labId, id: unit!._id, version: unit!.version });
    expect(archived?.archived_at).toBeDefined();
  });

  it("purge requires an exact name match and blocks when nodes still exist", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedLab(t, "admin");
    const unit = await t.mutation(api.storageUnits.create, {
      token, labId, name: "Freezer 1", storage_type: "-80", status: "normal",
      template: { shelves: 1, racksPerShelf: 1, boxesPerRack: 1, boxRows: 1, boxCols: 1 },
    });

    await expect(
      t.mutation(api.storageUnits.purge, { token, labId, id: unit!._id, confirmName: "wrong name" }),
    ).rejects.toThrow(/confirmation/);

    await expect(
      t.mutation(api.storageUnits.purge, { token, labId, id: unit!._id, confirmName: "Freezer 1" }),
    ).rejects.toThrow(/still has/);
  });

  it("purge is denied for a staff-tier role (Owner/Lab Admin only)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedLab(t, "staff");
    const unit = await t.mutation(api.storageUnits.create, { token, labId, name: "Freezer 1", storage_type: "-80", status: "normal" });
    await expect(
      t.mutation(api.storageUnits.purge, { token, labId, id: unit!._id, confirmName: "Freezer 1" }),
    ).rejects.toThrow(/Forbidden/);
  });
});
