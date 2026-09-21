// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type T = ReturnType<typeof convexTest>;

async function seedLabAndUnit(t: T) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Org", created_at: Date.now() });
    const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Site", created_at: Date.now() });
    const labId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab A", created_at: Date.now() });
    const staffId = await ctx.db.insert("users", {
      email: "staff@lab.com",
      hashed_password: "x",
      full_name: "Staff",
      role: "staff",
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    await ctx.db.insert("lab_memberships", {
      lab_id: labId,
      user_id: staffId,
      lab_role: "member",
      status: "active",
      created_at: Date.now(),
    });
    const token = "test-token";
    await ctx.db.insert("sessions", { user_id: staffId, token, expires_at: Date.now() + 3600_000, created_at: Date.now() });

    const unitId = await ctx.db.insert("storage_units", {
      lab_id: labId,
      name: "Freezer 1",
      storage_type: "-80",
      status: "normal",
      created_at: Date.now(),
      created_by: staffId,
      updated_at: Date.now(),
      version: 1,
    });

    return { labId, staffId, token, unitId };
  });
}

describe("storageNodes.create — kind legality", () => {
  let t: T;
  let labId: Id<"labs">;
  let token: string;
  let unitId: Id<"storage_units">;

  beforeEach(async () => {
    t = convexTest(schema, import.meta.glob("./**/*.ts"));
    ({ labId, token, unitId } = await seedLabAndUnit(t));
  });

  it("creates a shelf directly under the unit", async () => {
    const shelf = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "shelf", name: "Shelf A",
    });
    expect(shelf?.kind).toBe("shelf");
    expect(shelf?.path).toEqual([]);
    expect(shelf?.depth).toBe(0);
  });

  it("creates a rack under a shelf, and a box under that rack, with correct path/depth", async () => {
    const shelf = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf A" });
    const rack = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "rack", name: "Rack 1", parentId: shelf!._id,
    });
    expect(rack?.path).toEqual([shelf!._id]);
    expect(rack?.depth).toBe(1);

    const box = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "box", name: "Box 1", parentId: rack!._id, rows: 9, cols: 9,
    });
    expect(box?.path).toEqual([shelf!._id, rack!._id]);
    expect(box?.depth).toBe(2);
  });

  it("rejects a rack created directly under the unit (no shelf)", async () => {
    await expect(
      t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "rack", name: "Rack X" }),
    ).rejects.toThrow(/Invalid parent/);
  });

  it("rejects a box created directly under a shelf (skipping rack)", async () => {
    const shelf = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf A" });
    await expect(
      t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "box", name: "Box X", parentId: shelf!._id }),
    ).rejects.toThrow(/Invalid parent/);
  });
});

describe("storageNodes.createBatch", () => {
  it("creates count siblings with padded, prefixed names sharing the parent's path", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, unitId } = await seedLabAndUnit(t);
    const shelf = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf A" });

    const result = await t.mutation(api.storageNodes.createBatch, {
      token, labId, unitId, parentId: shelf!._id, kind: "rack",
      count: 3, prefix: "R", start: 1, padding: 2,
    });
    expect(result.count).toBe(3);

    const racks = await t.query(api.storageNodes.list, { token, labId, unitId, parentId: shelf!._id });
    expect(racks.map((r) => r.name).sort()).toEqual(["R01", "R02", "R03"]);
    for (const r of racks) expect(r.path).toEqual([shelf!._id]);
  });
});

describe("storageNodes.move — cycle detection and path rewrite", () => {
  let t: T;
  let labId: Id<"labs">;
  let token: string;
  let unitId: Id<"storage_units">;

  beforeEach(async () => {
    t = convexTest(schema, import.meta.glob("./**/*.ts"));
    ({ labId, token, unitId } = await seedLabAndUnit(t));
  });

  async function buildTree() {
    const shelf1 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf 1" });
    const shelf2 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf 2" });
    const rack = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "rack", name: "Rack 1", parentId: shelf1!._id,
    });
    const box = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "box", name: "Box 1", parentId: rack!._id,
    });
    return { shelf1: shelf1!, shelf2: shelf2!, rack: rack!, box: box! };
  }

  it("rejects moving a rack into its own descendant box", async () => {
    const { rack, box } = await buildTree();
    await expect(
      t.mutation(api.storageNodes.move, { token, labId, id: rack._id, version: rack.version, newParentId: box._id }),
    ).rejects.toThrow(/cycle|Invalid parent/);
  });

  it("rejects moving a node into itself", async () => {
    const { rack } = await buildTree();
    await expect(
      t.mutation(api.storageNodes.move, { token, labId, id: rack._id, version: rack.version, newParentId: rack._id }),
    ).rejects.toThrow();
  });

  it("moving a rack to a new shelf rewrites its own path and every descendant's path", async () => {
    const { shelf2, rack, box } = await buildTree();

    const moved = await t.mutation(api.storageNodes.move, {
      token, labId, id: rack._id, version: rack.version, newParentId: shelf2._id,
    });
    expect(moved?.path).toEqual([shelf2._id]);
    expect(moved?.depth).toBe(1);

    const reloadedBox = await t.query(api.storageNodes.get, { token, labId, id: box._id });
    expect(reloadedBox?.path).toEqual([shelf2._id, rack._id]);
    expect(reloadedBox?.depth).toBe(2);
  });

  it("rejects a stale version (optimistic concurrency)", async () => {
    const { shelf2, rack } = await buildTree();
    await expect(
      t.mutation(api.storageNodes.move, { token, labId, id: rack._id, version: rack.version + 1, newParentId: shelf2._id }),
    ).rejects.toThrow(/CONFLICT/);
  });
});

describe("storageNodes.archive — blocked while occupied", () => {
  it("blocks archiving a box with a position on record, allows once cleared", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, unitId, staffId } = await seedLabAndUnit(t);
    const shelf = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf A" });
    const rack = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "rack", name: "Rack 1", parentId: shelf!._id,
    });
    const box = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "box", name: "Box 1", parentId: rack!._id, rows: 9, cols: 9,
    });

    const positionId = await t.run((ctx) =>
      ctx.db.insert("storage_positions", {
        lab_id: labId,
        box_id: box!._id,
        row: 0,
        col: 0,
        label: "A1",
        state: "occupied",
        created_at: Date.now(),
        created_by: staffId,
        updated_at: Date.now(),
        version: 1,
      }),
    );

    await expect(
      t.mutation(api.storageNodes.archive, { token, labId, id: box!._id, version: box!.version }),
    ).rejects.toThrow(/occupied|reserved|flagged/);

    await t.run((ctx) => ctx.db.delete(positionId));

    const archived = await t.mutation(api.storageNodes.archive, { token, labId, id: box!._id, version: box!.version });
    expect(archived?.archived_at).toBeDefined();
  });

  it("blocks archiving a shelf whose descendant box is occupied", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, unitId, staffId } = await seedLabAndUnit(t);
    const shelf = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf A" });
    const rack = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "rack", name: "Rack 1", parentId: shelf!._id,
    });
    const box = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "box", name: "Box 1", parentId: rack!._id, rows: 9, cols: 9,
    });
    await t.run((ctx) =>
      ctx.db.insert("storage_positions", {
        lab_id: labId, box_id: box!._id, row: 0, col: 0, label: "A1", state: "reserved",
        created_at: Date.now(), created_by: staffId, updated_at: Date.now(), version: 1,
      }),
    );

    await expect(
      t.mutation(api.storageNodes.archive, { token, labId, id: shelf!._id, version: shelf!.version }),
    ).rejects.toThrow(/occupied|reserved|flagged/);
  });
});

describe("storageNodes.breadcrumbs", () => {
  it("returns the root-first trail including the node itself", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, unitId } = await seedLabAndUnit(t);
    const shelf = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf A" });
    const rack = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "rack", name: "Rack 1", parentId: shelf!._id,
    });
    const box = await t.mutation(api.storageNodes.create, {
      token, labId, unitId, kind: "box", name: "Box 1", parentId: rack!._id,
    });

    const crumbs = await t.query(api.storageNodes.breadcrumbs, { token, labId, id: box!._id });
    expect(crumbs.map((c) => c.name)).toEqual(["Shelf A", "Rack 1", "Box 1"]);
  });
});

describe("storageNodes.listBoxes", () => {
  it("returns every box in the unit regardless of shelf/rack nesting, excluding archived ones", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, unitId } = await seedLabAndUnit(t);
    const shelf1 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf 1" });
    const shelf2 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "shelf", name: "Shelf 2" });
    const rack1 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "rack", name: "Rack 1", parentId: shelf1!._id });
    const rack2 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "rack", name: "Rack 2", parentId: shelf2!._id });
    const box1 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "box", name: "Box 1", parentId: rack1!._id });
    const box2 = await t.mutation(api.storageNodes.create, { token, labId, unitId, kind: "box", name: "Box 2", parentId: rack2!._id });
    await t.mutation(api.storageNodes.archive, { token, labId, id: box2!._id, version: box2!.version });

    const boxes = await t.query(api.storageNodes.listBoxes, { token, labId, unitId });
    expect(boxes.map((b) => b.name)).toEqual([box1!.name]);
  });
});
