import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAuth } from "./authHelper";
import { requireStoragePermission } from "./permissions";
import { writeAudit } from "./lib/audit";

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 20;
    const cursor = args.paginationOpts?.cursor ?? null;

    // Use search index when a search term is provided and no status filter
    if (args.search && !args.status) {
      const results = await ctx.db
        .query("samples")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!)
        )
        .take(numItems);
      return { page: results, isDone: true, continueCursor: null };
    }

    let dbQuery;
    if (args.status) {
      dbQuery = ctx.db
        .query("samples")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      dbQuery = ctx.db.query("samples");
    }

    const result = await dbQuery.paginate({ numItems, cursor });

    if (args.search) {
      const term = args.search.toLowerCase();
      result.page = result.page.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.sample_id.toLowerCase().includes(term) ||
          (s.barcode ?? "").toLowerCase().includes(term)
      );
    }

    return result;
  },
});

export const get = query({
  args: { id: v.id("samples") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    sample_id: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
    status: v.string(),
    location: v.optional(v.string()),
    collected_at: v.optional(v.number()),
    collected_by: v.optional(v.id("users")),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { token: _, ...fields } = args;
    const now = Date.now();
    return await ctx.db.insert("samples", {
      ...fields,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("samples"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    location: v.optional(v.string()),
    collected_at: v.optional(v.number()),
    collected_by: v.optional(v.id("users")),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _, ...fields } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("samples") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const listEvents = query({
  args: {
    sampleId: v.id("samples"),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 50;
    const cursor = args.paginationOpts?.cursor ?? null;

    return await ctx.db
      .query("sample_events")
      .withIndex("by_sample", (q) => q.eq("sample_id", args.sampleId))
      .order("desc")
      .paginate({ numItems, cursor });
  },
});

export const createEvent = mutation({
  args: {
    token: v.optional(v.string()),
    sample_id: v.id("samples"),
    event_type: v.string(),
    description: v.optional(v.string()),
    performed_by: v.optional(v.id("users")),
    performed_at: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.insert("sample_events", {
      sample_id: args.sample_id,
      event_type: args.event_type,
      description: args.description,
      performed_by: args.performed_by,
      performed_at: args.performed_at ?? Date.now(),
      notes: args.notes,
    });
  },
});

export const updateEvent = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("sample_events"),
    event_type: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAuth(ctx, token);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
    return { success: true };
  },
});

export const deleteEvent = mutation({
  args: { token: v.optional(v.string()), id: v.id("sample_events") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.delete(id);
    return { success: true };
  },
});

// ── Storage-hierarchy lifecycle (Checkpoint B) ──────────────────────────
// docs/adr/ADR-freezer-storage-hierarchy.md · docs/plans/FREEZER_SAMPLE_STORAGE_IMPLEMENTATION_PLAN.md
// `remove` above (hard delete) is untouched and still reachable — Checkpoint
// B does not change existing exports, only adds. Retiring it in favour of
// `dispose` everywhere is a UI-layer (Checkpoint C-E) decision, not made here.

async function loadSampleInLab(ctx: QueryCtx | MutationCtx, sampleId: Id<"samples">, labId: Id<"labs">) {
  const sample = await ctx.db.get(sampleId);
  if (!sample) throw new Error("Sample not found");
  if (sample.lab_id !== undefined && sample.lab_id !== labId) throw new Error("Sample belongs to a different lab");
  return sample;
}

async function loadBoxForPlacement(ctx: QueryCtx | MutationCtx, boxId: Id<"storage_nodes">, labId: Id<"labs">) {
  const box = await ctx.db.get(boxId);
  if (!box || box.lab_id !== labId) throw new Error("Storage box not found");
  if (box.kind !== "box") throw new Error("Storage node is not a box");
  return box;
}

async function currentPositionOf(ctx: QueryCtx | MutationCtx, sampleId: Id<"samples">) {
  return await ctx.db
    .query("storage_positions")
    .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
    .first();
}

/** Place a sample into an empty box position. Rejects if the slot or the sample is already occupied (testing plan #5, #6). */
export const place = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    sampleId: v.id("samples"),
    boxId: v.id("storage_nodes"),
    row: v.number(),
    col: v.number(),
    label: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "place");
    const sample = await loadSampleInLab(ctx, args.sampleId, args.labId);
    const box = await loadBoxForPlacement(ctx, args.boxId, args.labId);
    if (args.row < 0 || args.row >= (box.rows ?? 0) || args.col < 0 || args.col >= (box.cols ?? 0)) {
      throw new Error("Position is outside the box's declared grid");
    }

    const alreadyPlaced = await currentPositionOf(ctx, args.sampleId);
    if (alreadyPlaced) throw new Error(`Sample is already placed at ${alreadyPlaced.label}; use move instead`);

    // Read-then-write inside one mutation: Convex's OCC retries a concurrent
    // writer that raced this read, so exactly one caller ever observes an
    // empty slot for a given (box, row, col) — original placement, if any,
    // is left completely untouched on the losing side.
    const existing = await ctx.db
      .query("storage_positions")
      .withIndex("by_box_pos", (q) => q.eq("box_id", args.boxId).eq("row", args.row).eq("col", args.col))
      .first();
    if (existing) throw new Error(`Position ${args.label} is already ${existing.state}`);

    const now = Date.now();
    const positionId = await ctx.db.insert("storage_positions", {
      lab_id: args.labId, box_id: args.boxId, row: args.row, col: args.col, label: args.label,
      state: "occupied", sample_id: args.sampleId,
      created_at: now, created_by: userId, updated_at: now, version: 1,
    });
    await ctx.db.insert("storage_moves", {
      lab_id: args.labId, sample_id: args.sampleId,
      to_box_id: args.boxId, to_label: args.label, reason: args.reason,
      moved_by: userId, moved_at: now,
    });
    const patch: Record<string, unknown> = { location: args.label, updated_at: now };
    if (sample.lab_id === undefined) patch.lab_id = args.labId;
    await ctx.db.patch(args.sampleId, patch);

    await writeAudit(ctx, { userId, action: "samples.place", entityType: "samples", entityId: args.sampleId, details: { boxId: args.boxId, label: args.label } });
    return await ctx.db.get(positionId);
  },
});

/** Move a placed sample to a different position. Source-clear + destination-set + ledger row happen in one transaction: all or nothing (testing plan #7). */
export const move = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    sampleId: v.id("samples"),
    toBoxId: v.id("storage_nodes"),
    toRow: v.number(),
    toCol: v.number(),
    toLabel: v.string(),
    reason: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "move");
    await loadSampleInLab(ctx, args.sampleId, args.labId);

    if (args.requestId) {
      const existingMove = await ctx.db
        .query("storage_moves")
        .withIndex("by_request_id", (q) => q.eq("request_id", args.requestId))
        .first();
      if (existingMove) return existingMove; // idempotent replay
    }

    const from = await currentPositionOf(ctx, args.sampleId);
    if (!from) throw new Error("Sample is not currently placed; use place instead");

    const toBox = await loadBoxForPlacement(ctx, args.toBoxId, args.labId);
    if (args.toRow < 0 || args.toRow >= (toBox.rows ?? 0) || args.toCol < 0 || args.toCol >= (toBox.cols ?? 0)) {
      throw new Error("Destination position is outside the box's declared grid");
    }
    const destExisting = await ctx.db
      .query("storage_positions")
      .withIndex("by_box_pos", (q) => q.eq("box_id", args.toBoxId).eq("row", args.toRow).eq("col", args.toCol))
      .first();
    if (destExisting) throw new Error(`Destination ${args.toLabel} is already ${destExisting.state}`);

    const now = Date.now();
    await ctx.db.delete(from._id);
    await ctx.db.insert("storage_positions", {
      lab_id: args.labId, box_id: args.toBoxId, row: args.toRow, col: args.toCol, label: args.toLabel,
      state: "occupied", sample_id: args.sampleId,
      created_at: now, created_by: userId, updated_at: now, version: 1,
    });
    const moveId = await ctx.db.insert("storage_moves", {
      lab_id: args.labId, sample_id: args.sampleId,
      from_box_id: from.box_id, from_label: from.label,
      to_box_id: args.toBoxId, to_label: args.toLabel,
      reason: args.reason, moved_by: userId, moved_at: now, request_id: args.requestId,
    });
    await ctx.db.patch(args.sampleId, { location: args.toLabel, updated_at: now });

    await writeAudit(ctx, { userId, action: "samples.move", entityType: "samples", entityId: args.sampleId, details: { toBoxId: args.toBoxId, toLabel: args.toLabel } });
    return await ctx.db.get(moveId);
  },
});

export const checkout = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), sampleId: v.id("samples"), expectedReturn: v.optional(v.number()), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "checkout");
    const sample = await loadSampleInLab(ctx, args.sampleId, args.labId);
    if (sample.checked_out_by) throw new Error("Sample is already checked out");

    await ctx.db.patch(args.sampleId, {
      checked_out_by: userId, checked_out_at: Date.now(), expected_return: args.expectedReturn, updated_at: Date.now(),
    });
    await ctx.db.insert("sample_events", {
      sample_id: args.sampleId, event_type: "checkout", performed_by: userId, performed_at: Date.now(), notes: args.reason,
    });
    await writeAudit(ctx, { userId, action: "samples.checkout", entityType: "samples", entityId: args.sampleId });
    return await ctx.db.get(args.sampleId);
  },
});

export const returnSample = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), sampleId: v.id("samples") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "return");
    const sample = await loadSampleInLab(ctx, args.sampleId, args.labId);
    if (!sample.checked_out_by) throw new Error("Sample is not checked out");

    await ctx.db.patch(args.sampleId, {
      checked_out_by: undefined, checked_out_at: undefined, expected_return: undefined, updated_at: Date.now(),
    });
    await ctx.db.insert("sample_events", {
      sample_id: args.sampleId, event_type: "return", performed_by: userId, performed_at: Date.now(),
    });
    await writeAudit(ctx, { userId, action: "samples.returnSample", entityType: "samples", entityId: args.sampleId });
    return await ctx.db.get(args.sampleId);
  },
});

/** Soft, tracked disposal. Retains full move/event history; does not touch `remove` (testing plan #14). */
export const dispose = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), sampleId: v.id("samples"), disposalReason: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "dispose");
    const sample = await loadSampleInLab(ctx, args.sampleId, args.labId);
    if (sample.disposed_at) throw new Error("Sample is already disposed");

    const position = await currentPositionOf(ctx, args.sampleId);
    const now = Date.now();
    if (position) {
      await ctx.db.delete(position._id);
      await ctx.db.insert("storage_moves", {
        lab_id: args.labId, sample_id: args.sampleId,
        from_box_id: position.box_id, from_label: position.label,
        reason: `disposed: ${args.disposalReason}`, moved_by: userId, moved_at: now,
      });
    }
    await ctx.db.patch(args.sampleId, { disposed_at: now, disposal_reason: args.disposalReason, status: "disposed", updated_at: now });
    await ctx.db.insert("sample_events", {
      sample_id: args.sampleId, event_type: "dispose", performed_by: userId, performed_at: now, notes: args.disposalReason,
    });
    await writeAudit(ctx, { userId, action: "samples.dispose", entityType: "samples", entityId: args.sampleId });
    return await ctx.db.get(args.sampleId);
  },
});

export const archiveSample = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), sampleId: v.id("samples"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "archive");
    const sample = await loadSampleInLab(ctx, args.sampleId, args.labId);
    if ((sample.version ?? 0) !== args.version) throw new Error("CONFLICT: sample was updated by someone else");

    await ctx.db.patch(args.sampleId, { archived_at: Date.now(), version: (sample.version ?? 0) + 1, updated_at: Date.now() });
    await writeAudit(ctx, { userId, action: "samples.archiveSample", entityType: "samples", entityId: args.sampleId });
    return await ctx.db.get(args.sampleId);
  },
});

export const restoreSample = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), sampleId: v.id("samples"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "restore");
    const sample = await loadSampleInLab(ctx, args.sampleId, args.labId);
    if ((sample.version ?? 0) !== args.version) throw new Error("CONFLICT: sample was updated by someone else");
    if (sample.archived_at === undefined) throw new Error("Sample is not archived");

    await ctx.db.patch(args.sampleId, { archived_at: undefined, version: (sample.version ?? 0) + 1, updated_at: Date.now() });
    await writeAudit(ctx, { userId, action: "samples.restoreSample", entityType: "samples", entityId: args.sampleId });
    return await ctx.db.get(args.sampleId);
  },
});

/** The storage_moves ledger for one sample, newest first. */
export const history = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), sampleId: v.id("samples") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    const sample = await ctx.db.get(args.sampleId);
    if (!sample || (sample.lab_id !== undefined && sample.lab_id !== args.labId)) throw new Error("Sample not found");

    return await ctx.db
      .query("storage_moves")
      .withIndex("by_sample", (q) => q.eq("sample_id", args.sampleId))
      .order("desc")
      .collect();
  },
});

const batchRow = v.object({
  sampleId: v.id("samples"),
  boxId: v.id("storage_nodes"),
  row: v.number(),
  col: v.number(),
  label: v.string(),
});

async function validateBatchRows(ctx: QueryCtx | MutationCtx, labId: Id<"labs">, rows: (typeof batchRow.type)[]) {
  const errors: { index: number; message: string }[] = [];
  const claimedSlots = new Set<string>();
  const claimedSamples = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const slotKey = `${row.boxId}:${row.row}:${row.col}`;
    if (claimedSlots.has(slotKey)) {
      errors.push({ index: i, message: "Duplicate destination slot within this batch" });
      continue;
    }
    if (claimedSamples.has(row.sampleId)) {
      errors.push({ index: i, message: "Duplicate sample within this batch" });
      continue;
    }

    const box = await ctx.db.get(row.boxId);
    if (!box || box.lab_id !== labId || box.kind !== "box") {
      errors.push({ index: i, message: "Storage box not found" });
      continue;
    }
    if (row.row < 0 || row.row >= (box.rows ?? 0) || row.col < 0 || row.col >= (box.cols ?? 0)) {
      errors.push({ index: i, message: "Position is outside the box's declared grid" });
      continue;
    }
    const existingPosition = await ctx.db
      .query("storage_positions")
      .withIndex("by_box_pos", (q) => q.eq("box_id", row.boxId).eq("row", row.row).eq("col", row.col))
      .first();
    if (existingPosition) {
      errors.push({ index: i, message: `Position ${row.label} is already ${existingPosition.state}` });
      continue;
    }
    const alreadyPlaced = await currentPositionOf(ctx, row.sampleId);
    if (alreadyPlaced) {
      errors.push({ index: i, message: `Sample is already placed at ${alreadyPlaced.label}` });
      continue;
    }

    claimedSlots.add(slotKey);
    claimedSamples.add(row.sampleId);
  }
  return errors;
}

/** Dry-run validation for a batch placement — no writes. */
export const batchValidate = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), rows: v.array(batchRow) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "place");
    const errors = await validateBatchRows(ctx, args.labId, args.rows);
    return { valid: errors.length === 0, errors };
  },
});

/** All-or-nothing batch placement (testing plan #11): any invalid row aborts before any write happens. */
export const batchCommit = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), rows: v.array(batchRow) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "place");

    const errors = await validateBatchRows(ctx, args.labId, args.rows);
    if (errors.length > 0) return { success: false as const, errors, placed: [] };

    const now = Date.now();
    const placed: Id<"storage_positions">[] = [];
    for (const row of args.rows) {
      const positionId = await ctx.db.insert("storage_positions", {
        lab_id: args.labId, box_id: row.boxId, row: row.row, col: row.col, label: row.label,
        state: "occupied", sample_id: row.sampleId,
        created_at: now, created_by: userId, updated_at: now, version: 1,
      });
      await ctx.db.insert("storage_moves", {
        lab_id: args.labId, sample_id: row.sampleId, to_box_id: row.boxId, to_label: row.label,
        moved_by: userId, moved_at: now,
      });
      await ctx.db.patch(row.sampleId, { location: row.label, updated_at: now });
      placed.push(positionId);
    }

    await writeAudit(ctx, { userId, action: "samples.batchCommit", entityType: "samples", entityId: args.labId, details: { count: placed.length } });
    return { success: true as const, errors: [], placed };
  },
});

/** Scan a barcode to its sample and current location (or null position if unplaced). */
export const resolveBarcode = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), barcode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");

    const byBarcode = await ctx.db
      .query("samples")
      .withIndex("by_sample_id", (q) => q.eq("sample_id", args.barcode))
      .first();
    const sample =
      byBarcode ??
      (await ctx.db
        .query("samples")
        .filter((q) => q.eq(q.field("barcode"), args.barcode))
        .first());
    if (!sample) return null;

    const position = await currentPositionOf(ctx, sample._id);
    return { sample, position };
  },
});
