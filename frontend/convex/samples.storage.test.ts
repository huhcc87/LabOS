// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type T = ReturnType<typeof convexTest>;

async function seedWorld(t: T) {
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
    const boxAId = await ctx.db.insert("storage_nodes", {
      lab_id: labId, unit_id: unitId, parent_id: undefined, path: [], depth: 0, kind: "box",
      name: "Box A", rows: 9, cols: 9, created_at: Date.now(), created_by: userId, updated_at: Date.now(), version: 1,
    });
    const boxBId = await ctx.db.insert("storage_nodes", {
      lab_id: labId, unit_id: unitId, parent_id: undefined, path: [], depth: 0, kind: "box",
      name: "Box B", rows: 9, cols: 9, created_at: Date.now(), created_by: userId, updated_at: Date.now(), version: 1,
    });

    const now = Date.now();
    const sampleId = await ctx.db.insert("samples", {
      sample_id: "S-001", name: "Sample One", status: "stored", created_at: now, updated_at: now, barcode: "BC-001",
    });
    const sample2Id = await ctx.db.insert("samples", {
      sample_id: "S-002", name: "Sample Two", status: "stored", created_at: now, updated_at: now,
    });

    return { labId, userId, token, boxAId, boxBId, sampleId, sample2Id };
  });
}

describe("samples.place", () => {
  it("places a sample into an empty position", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId } = await seedWorld(t);
    const pos = await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });
    expect(pos?.state).toBe("occupied");
    expect(pos?.sample_id).toBe(sampleId);
  });

  it("rejects placing into an occupied position, leaving the original placement intact (#5)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId, sample2Id } = await seedWorld(t);
    const first = await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });

    await expect(
      t.mutation(api.samples.place, { token, labId, sampleId: sample2Id, boxId: boxAId, row: 0, col: 0, label: "A1" }),
    ).rejects.toThrow(/already occupied/);

    const stillThere = await t.run((ctx) => ctx.db.get(first!._id));
    expect(stillThere?.sample_id).toBe(sampleId);
  });

  it("concurrent place calls on the same slot: exactly one wins (#6)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId, sample2Id } = await seedWorld(t);

    const results = await Promise.allSettled([
      t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 5, col: 5, label: "F6" }),
      t.mutation(api.samples.place, { token, labId, sampleId: sample2Id, boxId: boxAId, row: 5, col: 5, label: "F6" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("rejects placing a sample that is already placed elsewhere", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });
    await expect(
      t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 1, col: 1, label: "B2" }),
    ).rejects.toThrow(/already placed/);
  });
});

describe("samples.move — atomic source-clear + destination-set + ledger (#7)", () => {
  it("clears the source, sets the destination, and writes one ledger row", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, boxBId, sampleId } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });

    await t.mutation(api.samples.move, { token, labId, sampleId, toBoxId: boxBId, toRow: 2, toCol: 2, toLabel: "C3" });

    const remaining = await t.run((ctx) =>
      ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", boxAId)).collect(),
    );
    expect(remaining).toHaveLength(0);

    const destination = await t.run((ctx) =>
      ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", boxBId)).collect(),
    );
    expect(destination).toHaveLength(1);
    expect(destination[0].sample_id).toBe(sampleId);

    const moves = await t.query(api.samples.history, { token, labId, sampleId });
    expect(moves).toHaveLength(2); // initial place + this move
    expect(moves[0].to_label).toBe("C3");
  });

  it("rejects moving into an already-occupied destination, leaving the sample at its original position", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, boxBId, sampleId, sample2Id } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });
    await t.mutation(api.samples.place, { token, labId, sampleId: sample2Id, boxId: boxBId, row: 0, col: 0, label: "A1" });

    await expect(
      t.mutation(api.samples.move, { token, labId, sampleId, toBoxId: boxBId, toRow: 0, toCol: 0, toLabel: "A1" }),
    ).rejects.toThrow(/already/);

    const stillAtSource = await t.run((ctx) =>
      ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", boxAId)).collect(),
    );
    expect(stillAtSource).toHaveLength(1);
    expect(stillAtSource[0].sample_id).toBe(sampleId);
  });

  it("is idempotent when given the same requestId twice", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, boxBId, sampleId } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });

    const requestId = "req-123";
    const first = await t.mutation(api.samples.move, { token, labId, sampleId, toBoxId: boxBId, toRow: 0, toCol: 0, toLabel: "A1", requestId });
    const second = await t.mutation(api.samples.move, { token, labId, sampleId, toBoxId: boxBId, toRow: 0, toCol: 0, toLabel: "A1", requestId });
    expect(second?._id).toBe(first?._id);

    const moves = await t.query(api.samples.history, { token, labId, sampleId });
    expect(moves).toHaveLength(2); // place + one move, not two moves
  });
});

describe("samples.dispose — retains history, does not hard-delete (#14)", () => {
  it("clears the position, records the disposal in the ledger, and keeps the sample row", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });

    const disposed = await t.mutation(api.samples.dispose, { token, labId, sampleId, disposalReason: "expired" });
    expect(disposed?.disposed_at).toBeDefined();
    expect(disposed?.status).toBe("disposed");

    const stillExists = await t.run((ctx) => ctx.db.get(sampleId));
    expect(stillExists).not.toBeNull();

    const positions = await t.run((ctx) =>
      ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", boxAId)).collect(),
    );
    expect(positions).toHaveLength(0);

    const moves = await t.query(api.samples.history, { token, labId, sampleId });
    expect(moves.some((m) => m.reason?.includes("disposed"))).toBe(true);
  });
});

describe("samples.checkout / returnSample", () => {
  it("checks out then returns, rejecting a double checkout in between", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, sampleId } = await seedWorld(t);

    const checkedOut = await t.mutation(api.samples.checkout, { token, labId, sampleId });
    expect(checkedOut?.checked_out_by).toBeDefined();

    await expect(t.mutation(api.samples.checkout, { token, labId, sampleId })).rejects.toThrow(/already checked out/);

    const returned = await t.mutation(api.samples.returnSample, { token, labId, sampleId });
    expect(returned?.checked_out_by).toBeUndefined();
  });
});

describe("samples.batchValidate / batchCommit — all-or-nothing (#11)", () => {
  it("validate reports the offending row without writing anything", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId, sample2Id } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });

    const result = await t.query(api.samples.batchValidate, {
      token, labId,
      rows: [{ sampleId: sample2Id, boxId: boxAId, row: 0, col: 0, label: "A1" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].index).toBe(0);
  });

  it("commit rolls back entirely when any row is invalid — no partial writes", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId, sample2Id } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" }); // occupies A1

    const thirdSampleId: Id<"samples"> = await t.run((ctx) =>
      ctx.db.insert("samples", { sample_id: "S-003", name: "Sample Three", status: "stored", created_at: Date.now(), updated_at: Date.now() }),
    );

    const result = await t.mutation(api.samples.batchCommit, {
      token, labId,
      rows: [
        { sampleId: sample2Id, boxId: boxAId, row: 1, col: 1, label: "B2" }, // valid on its own
        { sampleId: thirdSampleId, boxId: boxAId, row: 0, col: 0, label: "A1" }, // occupied — invalid
      ],
    });
    expect(result.success).toBe(false);
    expect(result.placed).toHaveLength(0);

    // the valid row must NOT have been written despite being first / on its own valid
    const b2 = await t.run((ctx) =>
      ctx.db.query("storage_positions").withIndex("by_box_pos", (q) => q.eq("box_id", boxAId).eq("row", 1).eq("col", 1)).first(),
    );
    expect(b2).toBeNull();
  });

  it("commit succeeds and places every row when all are valid", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId, sample2Id } = await seedWorld(t);
    const result = await t.mutation(api.samples.batchCommit, {
      token, labId,
      rows: [
        { sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" },
        { sampleId: sample2Id, boxId: boxAId, row: 1, col: 1, label: "B2" },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.placed).toHaveLength(2);
  });
});

describe("samples.resolveBarcode", () => {
  it("resolves a barcode to its sample and current position", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });

    const result = await t.query(api.samples.resolveBarcode, { token, labId, barcode: "S-001" });
    expect(result?.sample._id).toBe(sampleId);
    expect(result?.position?.label).toBe("A1");
  });

  it("returns null for an unknown barcode", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedWorld(t);
    const result = await t.query(api.samples.resolveBarcode, { token, labId, barcode: "NOPE" });
    expect(result).toBeNull();
  });

  it("never returns another lab's sample, even when its sample_id/barcode matches (cross-tenant leak, code review finding)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token } = await seedWorld(t);
    const otherLabId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", { name: "Other Org", created_at: Date.now() });
      const siteId = await ctx.db.insert("sites", { organization_id: orgId, name: "Other Site", created_at: Date.now() });
      return ctx.db.insert("labs", { site_id: siteId, name: "Lab B", created_at: Date.now() });
    });
    await t.run((ctx) =>
      ctx.db.insert("samples", {
        sample_id: "OTHER-1", name: "Other Lab's Sample", status: "stored", lab_id: otherLabId,
        created_at: Date.now(), updated_at: Date.now(), barcode: "BC-OTHER",
      }),
    );

    const result = await t.query(api.samples.resolveBarcode, { token, labId, barcode: "OTHER-1" });
    expect(result).toBeNull();
  });
});

describe("samples lab-ownership backfill on legacy (unscoped) samples", () => {
  it("move claims a legacy sample for the acting lab immediately, not just on next touch", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, boxBId, sampleId } = await seedWorld(t);
    await t.mutation(api.samples.place, { token, labId, sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" });
    await t.run((ctx) => ctx.db.patch(sampleId, { lab_id: undefined })); // simulate a pre-migration legacy sample

    await t.mutation(api.samples.move, { token, labId, sampleId, toBoxId: boxBId, toRow: 0, toCol: 0, toLabel: "A1" });

    const sample = await t.run((ctx) => ctx.db.get(sampleId));
    expect(sample?.lab_id).toBe(labId);
  });

  it("batchCommit claims each placed legacy sample for the acting lab", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { labId, token, boxAId, sampleId } = await seedWorld(t);
    await t.run((ctx) => ctx.db.patch(sampleId, { lab_id: undefined }));

    await t.mutation(api.samples.batchCommit, { token, labId, rows: [{ sampleId, boxId: boxAId, row: 0, col: 0, label: "A1" }] });

    const sample = await t.run((ctx) => ctx.db.get(sampleId));
    expect(sample?.lab_id).toBe(labId);
  });
});
