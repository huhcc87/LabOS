import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireAuth } from "./authHelper";
import { requireStoragePermission } from "./permissions";
import { writeAudit } from "./lib/audit";
import { computeChildPath, computeDepth } from "./lib/storageTree";

/**
 * A hierarchy template: N shelves, each with the same number of racks, each
 * with the same number of boxes of a fixed grid size. Not part of any
 * captured spec (Gap Report M8 names the shape, "2 shelves x 5 racks x 4
 * boxes", but the exact field names are the prompt's, not in this repo) —
 * kept to this minimal shape rather than guessing a richer one.
 */
const templateArg = v.object({
  shelves: v.number(),
  racksPerShelf: v.number(),
  boxesPerRack: v.number(),
  boxRows: v.number(),
  boxCols: v.number(),
});

function templateCounts(template: { shelves: number; racksPerShelf: number; boxesPerRack: number; boxRows: number; boxCols: number }) {
  const racks = template.shelves * template.racksPerShelf;
  const boxes = racks * template.boxesPerRack;
  const positions = boxes * template.boxRows * template.boxCols;
  return { shelves: template.shelves, racks, boxes, positions };
}

async function materializeTemplate(
  ctx: MutationCtx,
  args: { labId: Id<"labs">; unitId: Id<"storage_units">; userId: Id<"users">; template: typeof templateArg.type },
) {
  const now = Date.now();
  for (let s = 1; s <= args.template.shelves; s++) {
    const shelfPath = computeChildPath(undefined);
    const shelfId = await ctx.db.insert("storage_nodes", {
      lab_id: args.labId, unit_id: args.unitId, parent_id: undefined,
      path: shelfPath, depth: computeDepth(shelfPath), kind: "shelf", name: `Shelf ${s}`,
      ordinal: s, created_at: now, created_by: args.userId, updated_at: now, version: 1,
    });
    const shelf = { _id: shelfId, path: shelfPath };

    for (let r = 1; r <= args.template.racksPerShelf; r++) {
      const rackPath = computeChildPath(shelf);
      const rackId = await ctx.db.insert("storage_nodes", {
        lab_id: args.labId, unit_id: args.unitId, parent_id: shelfId,
        path: rackPath, depth: computeDepth(rackPath), kind: "rack", name: `Rack ${s}.${r}`,
        ordinal: r, created_at: now, created_by: args.userId, updated_at: now, version: 1,
      });
      const rack = { _id: rackId, path: rackPath };

      for (let b = 1; b <= args.template.boxesPerRack; b++) {
        const boxPath = computeChildPath(rack);
        await ctx.db.insert("storage_nodes", {
          lab_id: args.labId, unit_id: args.unitId, parent_id: rackId,
          path: boxPath, depth: computeDepth(boxPath), kind: "box", name: `Box ${s}.${r}.${b}`,
          ordinal: b, rows: args.template.boxRows, cols: args.template.boxCols,
          created_at: now, created_by: args.userId, updated_at: now, version: 1,
        });
      }
    }
  }
}

export const previewTemplate = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), template: templateArg },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    return templateCounts(args.template);
  },
});

export const list = query({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    storageType: v.optional(v.string()),
    status: v.optional(v.string()),
    ownerTeam: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");

    const numItems = args.paginationOpts?.numItems ?? 20;
    const cursor = args.paginationOpts?.cursor ?? null;

    const dbQuery = args.status
      ? ctx.db.query("storage_units").withIndex("by_lab_status", (q) => q.eq("lab_id", args.labId).eq("status", args.status!))
      : ctx.db.query("storage_units").withIndex("by_lab", (q) => q.eq("lab_id", args.labId));

    const result = await dbQuery.paginate({ numItems, cursor });
    result.page = result.page.filter((u) => {
      if (!args.includeArchived && u.archived_at !== undefined) return false;
      if (args.storageType && u.storage_type !== args.storageType) return false;
      if (args.ownerTeam && u.owner_team !== args.ownerTeam) return false;
      return true;
    });
    return result;
  },
});

export const get = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_units") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    const unit = await ctx.db.get(args.id);
    if (!unit || unit.lab_id !== args.labId) throw new Error("Storage unit not found");
    return unit;
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    facilityId: v.optional(v.id("storage_facilities")),
    name: v.string(),
    storage_type: v.string(),
    target_temp: v.optional(v.number()),
    temp_unit: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    serial_number: v.optional(v.string()),
    asset_number: v.optional(v.string()),
    owner_team: v.optional(v.string()),
    iot_sensor_id: v.optional(v.id("iot_sensors")),
    status: v.string(),
    notes: v.optional(v.string()),
    template: v.optional(templateArg),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "create");
    if (args.facilityId) {
      const facility = await ctx.db.get(args.facilityId);
      if (!facility || facility.lab_id !== args.labId) throw new Error("Storage facility not found");
    }

    const now = Date.now();
    const id = await ctx.db.insert("storage_units", {
      lab_id: args.labId,
      facility_id: args.facilityId,
      name: args.name,
      storage_type: args.storage_type,
      target_temp: args.target_temp,
      temp_unit: args.temp_unit,
      manufacturer: args.manufacturer,
      model: args.model,
      serial_number: args.serial_number,
      asset_number: args.asset_number,
      owner_team: args.owner_team,
      iot_sensor_id: args.iot_sensor_id,
      status: args.status,
      notes: args.notes,
      created_at: now,
      created_by: userId,
      updated_at: now,
      version: 1,
    });

    if (args.template) await materializeTemplate(ctx, { labId: args.labId, unitId: id, userId, template: args.template });

    await writeAudit(ctx, {
      userId, action: "storageUnits.create", entityType: "storage_units", entityId: id,
      details: args.template ? { template: templateCounts(args.template) } : undefined,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    id: v.id("storage_units"),
    version: v.number(),
    name: v.optional(v.string()),
    target_temp: v.optional(v.number()),
    temp_unit: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    serial_number: v.optional(v.string()),
    asset_number: v.optional(v.string()),
    owner_team: v.optional(v.string()),
    iot_sensor_id: v.optional(v.id("iot_sensors")),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "update");
    const unit = await ctx.db.get(args.id);
    if (!unit || unit.lab_id !== args.labId) throw new Error("Storage unit not found");
    if (unit.version !== args.version) throw new Error("CONFLICT: storage unit was updated by someone else");

    const patch: Record<string, unknown> = { updated_at: Date.now(), updated_by: userId, version: unit.version + 1 };
    const fields = [
      "name", "target_temp", "temp_unit", "manufacturer", "model",
      "serial_number", "asset_number", "owner_team", "iot_sensor_id", "status", "notes",
    ] as const;
    for (const key of fields) {
      if (args[key] !== undefined) patch[key] = args[key];
    }
    await ctx.db.patch(args.id, patch);

    await writeAudit(ctx, { userId, action: "storageUnits.update", entityType: "storage_units", entityId: args.id });
    return await ctx.db.get(args.id);
  },
});

async function unitHasOccupiedPositions(ctx: MutationCtx, unitId: Id<"storage_units">) {
  const boxes = await ctx.db
    .query("storage_nodes")
    .withIndex("by_unit", (q) => q.eq("unit_id", unitId))
    .filter((q) => q.eq(q.field("kind"), "box"))
    .collect();
  // Parallel per-box existence checks instead of a sequential N+1 loop.
  const firsts = await Promise.all(
    boxes.map((box) => ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", box._id)).first())
  );
  return firsts.some((first) => first !== null);
}

export const archive = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_units"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "archive");
    const unit = await ctx.db.get(args.id);
    if (!unit || unit.lab_id !== args.labId) throw new Error("Storage unit not found");
    if (unit.version !== args.version) throw new Error("CONFLICT: storage unit was updated by someone else");

    if (await unitHasOccupiedPositions(ctx, args.id)) {
      throw new Error("Cannot archive: this storage unit still has occupied, reserved, or flagged positions");
    }

    await ctx.db.patch(args.id, {
      archived_at: Date.now(), archived_by: userId, updated_at: Date.now(), updated_by: userId, version: unit.version + 1,
    });
    await writeAudit(ctx, { userId, action: "storageUnits.archive", entityType: "storage_units", entityId: args.id });
    return await ctx.db.get(args.id);
  },
});

export const restore = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_units"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "restore");
    const unit = await ctx.db.get(args.id);
    if (!unit || unit.lab_id !== args.labId) throw new Error("Storage unit not found");
    if (unit.version !== args.version) throw new Error("CONFLICT: storage unit was updated by someone else");
    if (unit.archived_at === undefined) throw new Error("Storage unit is not archived");

    await ctx.db.patch(args.id, {
      archived_at: undefined, archived_by: undefined, updated_at: Date.now(), updated_by: userId, version: unit.version + 1,
    });
    await writeAudit(ctx, { userId, action: "storageUnits.restore", entityType: "storage_units", entityId: args.id });
    return await ctx.db.get(args.id);
  },
});

export const occupancy = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_units") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    const unit = await ctx.db.get(args.id);
    if (!unit || unit.lab_id !== args.labId) throw new Error("Storage unit not found");

    const boxes = await ctx.db
      .query("storage_nodes")
      .withIndex("by_unit", (q) => q.eq("unit_id", args.id))
      .filter((q) => q.eq(q.field("kind"), "box"))
      .collect();

    // Parallel per-box position reads instead of a sequential N+1 loop.
    const positionsByBox = await Promise.all(
      boxes.map((box) => ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", box._id)).collect())
    );

    let capacity = 0, occupied = 0, reserved = 0, quarantined = 0, unavailable = 0;
    boxes.forEach((box, i) => {
      capacity += (box.rows ?? 0) * (box.cols ?? 0);
      for (const p of positionsByBox[i]) {
        if (p.state === "occupied") occupied++;
        else if (p.state === "reserved") reserved++;
        else if (p.state === "quarantined") quarantined++;
        else if (p.state === "unavailable") unavailable++;
      }
    });
    return { capacity, occupied, reserved, quarantined, unavailable, boxCount: boxes.length };
  },
});

/** Permanent delete. Owner/Lab Admin only (Plan §5 Q6); requires typing the unit's name to confirm (§2.5). */
export const purge = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_units"), confirmName: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "delete");
    const unit = await ctx.db.get(args.id);
    if (!unit || unit.lab_id !== args.labId) throw new Error("Storage unit not found");
    if (args.confirmName !== unit.name) throw new Error("Name confirmation does not match");

    const anyNode = await ctx.db.query("storage_nodes").withIndex("by_unit", (q) => q.eq("unit_id", args.id)).first();
    if (anyNode) {
      throw new Error("Cannot permanently delete: this storage unit still has shelves, racks, or boxes");
    }

    await ctx.db.delete(args.id);
    await writeAudit(ctx, { userId, action: "storageUnits.purge", entityType: "storage_units", entityId: args.id });
    return { success: true };
  },
});
