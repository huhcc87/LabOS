// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

type T = ReturnType<typeof convexTest>;

async function seedLegacy(t: T) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Org", created_at: Date.now() });
    const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Site", created_at: Date.now() });
    const labId = await ctx.db.insert("labs", { site_id: siteId, name: "Lab A", created_at: Date.now() });
    const actorUserId = await ctx.db.insert("users", {
      email: "admin@lab.com", hashed_password: "x", full_name: "Admin", role: "admin",
      is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: Date.now(), updated_at: Date.now(),
    });

    const matchedSampleId = await ctx.db.insert("samples", {
      sample_id: "LEGACY-001", name: "Legacy Sample", status: "stored", created_at: Date.now(), updated_at: Date.now(),
    });

    const freezerId = await ctx.db.insert("freezers", { name: "Old Freezer", created_at: Date.now() });
    await ctx.db.insert("freezer_slots", {
      freezer_id: freezerId, rack: 1, box: 1, row: 0, col: 0, sample_id: "LEGACY-001", label: "A1", updated_at: Date.now(),
    });
    await ctx.db.insert("freezer_slots", {
      freezer_id: freezerId, rack: 1, box: 1, row: 0, col: 1, sample_id: "LEGACY-MISSING", label: "A2", updated_at: Date.now(),
    });
    await ctx.db.insert("freezer_slots", {
      freezer_id: freezerId, rack: 1, box: 1, row: 1, col: 0, sample_id: undefined, label: "B1", updated_at: Date.now(),
    });
    await ctx.db.insert("freezer_slots", {
      freezer_id: freezerId, rack: 2, box: 1, row: 0, col: 0, sample_id: "LEGACY-001", label: "A1", updated_at: Date.now(),
    });

    return { labId, actorUserId, freezerId, matchedSampleId };
  });
}

describe("migrations.backfillStorage", () => {
  it("creates a unit, shelf-per-rack, one rack node, box-per-box, and only non-empty positions", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, actorUserId, freezerId } = await seedLegacy(t);

    const result = await t.action(internal.migrations.backfillStorage.run, { labId, actorUserId });
    expect(result.freezersProcessed).toBe(1);
    expect(result.positionsCreated).toBe(3); // two rows in rack 1's box, one in rack 2's box; the undefined-sample_id row is skipped
    expect(result.unresolvedCount).toBe(1);
    expect(result.report).toContain("LEGACY-MISSING");

    const unit = await t.run((ctx) =>
      ctx.db.query("storage_units").withIndex("by_legacy_freezer", (q) => q.eq("legacy_freezer_id", freezerId)).first(),
    );
    expect(unit).not.toBeNull();

    const nodes = await t.run((ctx) => ctx.db.query("storage_nodes").withIndex("by_unit", (q) => q.eq("unit_id", unit!._id)).collect());
    expect(nodes.filter((n) => n.kind === "shelf")).toHaveLength(2); // rack 1 and rack 2
    expect(nodes.filter((n) => n.kind === "rack")).toHaveLength(2); // one synthetic rack per shelf
    expect(nodes.filter((n) => n.kind === "box")).toHaveLength(2); // box 1 under each rack

    const box = nodes.find((n) => n.kind === "box")!;
    expect(box.rows).toBe(2); // max row observed (1) + 1
    expect(box.cols).toBe(2); // max col observed (1) + 1
  });

  it("resolves a matching sample_id to a real sample reference", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, actorUserId, matchedSampleId } = await seedLegacy(t);
    await t.action(internal.migrations.backfillStorage.run, { labId, actorUserId });

    const positions = await t.run((ctx) => ctx.db.query("storage_positions").collect());
    const resolved = positions.filter((p) => p.sample_id === matchedSampleId);
    expect(resolved).toHaveLength(2); // placed in both racks per the seed data
  });

  it("is idempotent: re-running does not duplicate a freezer already migrated", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, actorUserId } = await seedLegacy(t);

    await t.action(internal.migrations.backfillStorage.run, { labId, actorUserId });
    const second = await t.action(internal.migrations.backfillStorage.run, { labId, actorUserId });
    expect(second.freezersProcessed).toBe(0);
    expect(second.freezersSkipped).toBe(1);

    const units = await t.run((ctx) => ctx.db.query("storage_units").collect());
    expect(units).toHaveLength(1);
  });

  it("never writes to the legacy tables", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, actorUserId } = await seedLegacy(t);
    const beforeSlots = await t.run((ctx) => ctx.db.query("freezer_slots").collect());

    await t.action(internal.migrations.backfillStorage.run, { labId, actorUserId });

    const afterSlots = await t.run((ctx) => ctx.db.query("freezer_slots").collect());
    expect(afterSlots).toEqual(beforeSlots);
  });
});
