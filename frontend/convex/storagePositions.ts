import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAuth } from "./authHelper";
import { requireStoragePermission } from "./permissions";
import { writeAudit } from "./lib/audit";

async function loadBoxInLab(ctx: QueryCtx | MutationCtx, boxId: Id<"storage_nodes">, labId: Id<"labs">) {
  const box = await ctx.db.get(boxId);
  if (!box || box.lab_id !== labId) throw new Error("Storage box not found");
  if (box.kind !== "box") throw new Error("Storage node is not a box");
  return box;
}

/** Sparse positions for one box, plus its declared grid dimensions. Empty cells are simply absent. */
export const listForBox = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), boxId: v.id("storage_nodes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    const box = await loadBoxInLab(ctx, args.boxId, args.labId);

    const positions = await ctx.db
      .query("storage_positions")
      .withIndex("by_box", (q) => q.eq("box_id", args.boxId))
      .collect();

    return { rows: box.rows ?? 0, cols: box.cols ?? 0, positions };
  },
});

export const reserve = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    boxId: v.id("storage_nodes"),
    row: v.number(),
    col: v.number(),
    label: v.string(),
    reservedUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "create");
    const box = await loadBoxInLab(ctx, args.boxId, args.labId);
    if (args.row < 0 || args.row >= (box.rows ?? 0) || args.col < 0 || args.col >= (box.cols ?? 0)) {
      throw new Error("Position is outside the box's declared grid");
    }

    // Read-then-write inside one mutation: Convex's OCC retries a concurrent
    // writer that raced this read, so exactly one caller ever observes an
    // empty slot here for a given (box, row, col).
    const existing = await ctx.db
      .query("storage_positions")
      .withIndex("by_box_pos", (q) => q.eq("box_id", args.boxId).eq("row", args.row).eq("col", args.col))
      .first();
    if (existing) throw new Error(`Position ${args.label} is already ${existing.state}`);

    const now = Date.now();
    const id = await ctx.db.insert("storage_positions", {
      lab_id: args.labId,
      box_id: args.boxId,
      row: args.row,
      col: args.col,
      label: args.label,
      state: "reserved",
      reserved_by: userId,
      reserved_until: args.reservedUntil,
      created_at: now,
      created_by: userId,
      updated_at: now,
      version: 1,
    });

    await writeAudit(ctx, { userId, action: "storagePositions.reserve", entityType: "storage_positions", entityId: id });
    return await ctx.db.get(id);
  },
});

export const release = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_positions"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "update");
    const position = await ctx.db.get(args.id);
    if (!position || position.lab_id !== args.labId) throw new Error("Storage position not found");
    if (position.state !== "reserved") throw new Error("Only a reserved (unoccupied) position can be released");
    if (position.version !== args.version) throw new Error("CONFLICT: position was updated by someone else");

    // Sparse table: releasing a reserved slot means it goes back to "empty",
    // i.e. no row at all — not a state flip.
    await ctx.db.delete(args.id);
    await writeAudit(ctx, { userId, action: "storagePositions.release", entityType: "storage_positions", entityId: args.id });
    return { success: true };
  },
});
