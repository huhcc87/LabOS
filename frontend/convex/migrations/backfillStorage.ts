import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Legacy → new storage-hierarchy backfill (ADR migration plan, step 2-4).
 * docs/adr/ADR-freezer-storage-hierarchy.md
 *
 * Legacy `freezers`/`freezer_slots` have no lab/tenant link and no shelf
 * concept — the caller supplies the target lab, and legacy `rack` numbers
 * become SHELVES (freezer -> shelf -> rack -> box requires 3 levels; legacy
 * data only has 2, `rack` and `box`). One synthetic rack node is inserted
 * under each shelf so the box still lands one level below a rack, per the
 * kind-legality rule. Box dimensions are inferred per box as
 * (max observed row + 1, max observed col + 1) from that box's own slots —
 * legacy data does not declare box dimensions explicitly.
 *
 * Sparse: only slots with a non-empty `sample_id` string get a
 * `storage_positions` row. A `sample_id` that matches no `samples.sample_id`
 * is still recorded (state "occupied", `sample_id: undefined`) and reported
 * as unresolved (step 3), never silently dropped.
 *
 * Idempotent per freezer: re-running skips a freezer already migrated
 * (`storage_units.legacy_freezer_id` already set).
 *
 * Reversible: only ever inserts into the new tables; legacy tables are
 * untouched. Re-running after fixing data does not duplicate a freezer
 * already migrated, but does NOT retract a previous (now-stale) migration —
 * clear the previously created storage_units/nodes/positions for that
 * freezer first if you need to re-run it with different data.
 *
 * Step 4 (preflight report) and step 5 (cutover) are NOT done here — this
 * only performs step 2-3 (populate the new tables) and returns the counts
 * a human reviews before either of those next steps. Step 6 (drop legacy
 * tables) is explicitly out of scope for Checkpoint B.
 *
 * Run with:
 *   npx convex run migrations/backfillStorage:run '{"labId":"...","actorUserId":"..."}'
 */

type UnresolvedSlot = { freezerId: Id<"freezers">; rack: number; box: number; row: number; col: number; sampleIdText: string };

export const listFreezerIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"freezers">[]> => {
    const freezers = await ctx.db.query("freezers").collect();
    return freezers.map((f) => f._id);
  },
});

export const backfillOneFreezer = internalMutation({
  args: { labId: v.id("labs"), actorUserId: v.id("users"), freezerId: v.id("freezers") },
  handler: async (ctx, args): Promise<{ skipped: boolean; positionsCreated: number; unresolved: UnresolvedSlot[] }> => {
    const already = await ctx.db
      .query("storage_units")
      .withIndex("by_legacy_freezer", (q) => q.eq("legacy_freezer_id", args.freezerId))
      .first();
    if (already) return { skipped: true, positionsCreated: 0, unresolved: [] };

    const freezer = await ctx.db.get(args.freezerId);
    if (!freezer) throw new Error(`freezer ${args.freezerId} not found`);

    const now = Date.now();
    const unitId = await ctx.db.insert("storage_units", {
      lab_id: args.labId,
      name: freezer.name,
      storage_type: "custom",
      target_temp: freezer.temperature,
      status: "normal",
      notes: freezer.notes,
      legacy_freezer_id: args.freezerId,
      created_at: now,
      created_by: args.actorUserId,
      updated_at: now,
      version: 1,
    });

    const slots = await ctx.db
      .query("freezer_slots")
      .withIndex("by_freezer", (q) => q.eq("freezer_id", args.freezerId))
      .collect();

    const slotsByRack = new Map<number, typeof slots>();
    for (const slot of slots) {
      const forRack = slotsByRack.get(slot.rack) ?? [];
      forRack.push(slot);
      slotsByRack.set(slot.rack, forRack);
    }

    let positionsCreated = 0;
    const unresolved: UnresolvedSlot[] = [];

    for (const [rackNumber, rackSlots] of slotsByRack) {
      const shelfId = await ctx.db.insert("storage_nodes", {
        lab_id: args.labId, unit_id: unitId, parent_id: undefined, path: [], depth: 0,
        kind: "shelf", name: `Rack ${rackNumber}`, ordinal: rackNumber,
        created_at: now, created_by: args.actorUserId, updated_at: now, version: 1,
      });
      const rackNodePath = [shelfId];
      const rackNodeId = await ctx.db.insert("storage_nodes", {
        lab_id: args.labId, unit_id: unitId, parent_id: shelfId, path: rackNodePath, depth: 1,
        kind: "rack", name: "Legacy positions", created_at: now, created_by: args.actorUserId, updated_at: now, version: 1,
      });
      const boxNodePath = [shelfId, rackNodeId];

      const slotsByBox = new Map<number, typeof rackSlots>();
      for (const slot of rackSlots) {
        const forBox = slotsByBox.get(slot.box) ?? [];
        forBox.push(slot);
        slotsByBox.set(slot.box, forBox);
      }

      for (const [boxNumber, boxSlots] of slotsByBox) {
        const maxRow = Math.max(...boxSlots.map((s) => s.row));
        const maxCol = Math.max(...boxSlots.map((s) => s.col));
        const boxId = await ctx.db.insert("storage_nodes", {
          lab_id: args.labId, unit_id: unitId, parent_id: rackNodeId, path: boxNodePath, depth: 2,
          kind: "box", name: `Box ${boxNumber}`, ordinal: boxNumber, rows: maxRow + 1, cols: maxCol + 1,
          created_at: now, created_by: args.actorUserId, updated_at: now, version: 1,
        });

        for (const slot of boxSlots) {
          const sampleIdText = slot.sample_id?.trim();
          if (!sampleIdText) continue; // sparse: empty legacy slot gets no row

          const matched = await ctx.db
            .query("samples")
            .withIndex("by_sample_id", (q) => q.eq("sample_id", sampleIdText))
            .first();

          await ctx.db.insert("storage_positions", {
            lab_id: args.labId, box_id: boxId, row: slot.row, col: slot.col,
            label: slot.label ?? `${slot.row},${slot.col}`,
            state: "occupied",
            sample_id: matched?._id,
            created_at: now, created_by: args.actorUserId, updated_at: now, version: 1,
          });
          positionsCreated++;

          // Claim the matched sample for this lab now, not on next touch —
          // otherwise every migrated sample stays lab-unscoped (readable and
          // actionable from any lab) until someone happens to call
          // place/move/etc. on it again (code review finding).
          if (matched && matched.lab_id === undefined) {
            await ctx.db.patch(matched._id, { lab_id: args.labId });
          }

          if (!matched) {
            unresolved.push({ freezerId: args.freezerId, rack: rackNumber, box: boxNumber, row: slot.row, col: slot.col, sampleIdText });
          }
        }
      }
    }

    return { skipped: false, positionsCreated, unresolved };
  },
});

export const run = internalAction({
  args: { labId: v.id("labs"), actorUserId: v.id("users") },
  handler: async (ctx, args): Promise<{ freezersProcessed: number; freezersSkipped: number; positionsCreated: number; unresolvedCount: number; report: string }> => {
    const freezerIds = await ctx.runQuery(internal.migrations.backfillStorage.listFreezerIds, {});

    let processed = 0;
    let skipped = 0;
    let positionsCreated = 0;
    const unresolved: UnresolvedSlot[] = [];

    for (const freezerId of freezerIds) {
      const result = await ctx.runMutation(internal.migrations.backfillStorage.backfillOneFreezer, {
        labId: args.labId, actorUserId: args.actorUserId, freezerId,
      });
      if (result.skipped) skipped++; else processed++;
      positionsCreated += result.positionsCreated;
      unresolved.push(...result.unresolved);
    }

    const report = [
      "# Storage Migration Preflight",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      `- Freezers in legacy table: ${freezerIds.length}`,
      `- Freezers migrated this run: ${processed}`,
      `- Freezers already migrated (skipped): ${skipped}`,
      `- Positions created: ${positionsCreated}`,
      `- Unresolved slots (sample_id matched no sample): ${unresolved.length}`,
      "",
      unresolved.length > 0 ? "## Unresolved slots\n" : "",
      ...unresolved.map(
        (u) => `- freezer ${u.freezerId} rack ${u.rack} box ${u.box} (${u.row},${u.col}) — sample_id "${u.sampleIdText}" not found`,
      ),
      "",
      "Review gate: do not proceed to cutover (migration plan step 5) until this report has been reviewed.",
    ].join("\n");

    return { freezersProcessed: processed, freezersSkipped: skipped, positionsCreated, unresolvedCount: unresolved.length, report };
  },
});
