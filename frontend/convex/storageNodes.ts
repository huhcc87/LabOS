import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAuth } from "./authHelper";
import { requireStoragePermission } from "./permissions";
import { writeAudit } from "./lib/audit";
import {
  ALLOWED_PARENT,
  computeChildPath,
  computeDepth,
  isAllowedParent,
  rewriteDescendantPath,
  wouldCreateCycle,
  type NodeKind,
} from "./lib/storageTree";

const nodeKind = v.union(v.literal("shelf"), v.literal("rack"), v.literal("box"));

async function loadUnitInLab(ctx: QueryCtx | MutationCtx, unitId: Id<"storage_units">, labId: Id<"labs">) {
  const unit = await ctx.db.get(unitId);
  if (!unit || unit.lab_id !== labId) throw new Error("Storage unit not found");
  return unit;
}

async function loadNodeInLab(ctx: QueryCtx | MutationCtx, id: Id<"storage_nodes">, labId: Id<"labs">) {
  const node = await ctx.db.get(id);
  if (!node || node.lab_id !== labId) throw new Error("Storage node not found");
  return node;
}

/** Parent kind for the legality check: "unit" when there is no node parent. */
function parentKindOf(parent: Doc<"storage_nodes"> | undefined): "unit" | NodeKind {
  return parent ? parent.kind : "unit";
}

async function resolveParent(
  ctx: QueryCtx | MutationCtx,
  parentId: Id<"storage_nodes"> | undefined,
  labId: Id<"labs">,
  unitId: Id<"storage_units">,
) {
  if (!parentId) return undefined;
  const parent = await loadNodeInLab(ctx, parentId, labId);
  if (parent.unit_id !== unitId) throw new Error("Parent node belongs to a different storage unit");
  return parent;
}

/** All boxes in the subtree rooted at `node` (inclusive), scanned within its unit. */
async function boxesInSubtree(ctx: QueryCtx | MutationCtx, node: Doc<"storage_nodes">) {
  if (node.kind === "box") return [node];
  const unitNodes = await ctx.db
    .query("storage_nodes")
    .withIndex("by_unit", (q) => q.eq("unit_id", node.unit_id))
    .collect();
  return unitNodes.filter((n) => n.kind === "box" && n.path.includes(node._id));
}

async function boxHasPositions(ctx: QueryCtx | MutationCtx, boxId: Id<"storage_nodes">) {
  const first = await ctx.db
    .query("storage_positions")
    .withIndex("by_box", (q) => q.eq("box_id", boxId))
    .first();
  return first !== null;
}

export const get = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_nodes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    return await loadNodeInLab(ctx, args.id, args.labId);
  },
});

export const list = query({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    unitId: v.id("storage_units"),
    parentId: v.optional(v.id("storage_nodes")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    await loadUnitInLab(ctx, args.unitId, args.labId);

    const rows = args.parentId
      ? await ctx.db
          .query("storage_nodes")
          .withIndex("by_parent", (q) => q.eq("parent_id", args.parentId))
          .collect()
      : await ctx.db
          .query("storage_nodes")
          .withIndex("by_unit", (q) => q.eq("unit_id", args.unitId))
          .filter((q) => q.eq(q.field("parent_id"), undefined))
          .collect();

    return args.includeArchived ? rows : rows.filter((n) => n.archived_at === undefined);
  },
});

/** Every non-archived box in a unit, flat, regardless of shelf/rack nesting — for destination pickers (Checkpoint D move). */
export const listBoxes = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), unitId: v.id("storage_units") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    await loadUnitInLab(ctx, args.unitId, args.labId);

    const nodes = await ctx.db
      .query("storage_nodes")
      .withIndex("by_unit", (q) => q.eq("unit_id", args.unitId))
      .filter((q) => q.eq(q.field("kind"), "box"))
      .collect();
    return nodes.filter((n) => n.archived_at === undefined);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    unitId: v.id("storage_units"),
    parentId: v.optional(v.id("storage_nodes")),
    kind: nodeKind,
    name: v.string(),
    ordinal: v.optional(v.number()),
    rows: v.optional(v.number()),
    cols: v.optional(v.number()),
    position_naming: v.optional(v.union(v.literal("alpha_row"), v.literal("numeric"))),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "create");
    await loadUnitInLab(ctx, args.unitId, args.labId);
    const parent = await resolveParent(ctx, args.parentId, args.labId, args.unitId);

    if (!isAllowedParent(args.kind, parentKindOf(parent))) {
      throw new Error(
        `Invalid parent: a '${args.kind}' must be created under a '${ALLOWED_PARENT[args.kind]}'`,
      );
    }

    const path = computeChildPath(parent);
    const now = Date.now();
    const id = await ctx.db.insert("storage_nodes", {
      lab_id: args.labId,
      unit_id: args.unitId,
      parent_id: args.parentId,
      path,
      depth: computeDepth(path),
      kind: args.kind,
      name: args.name,
      ordinal: args.ordinal,
      rows: args.rows,
      cols: args.cols,
      position_naming: args.position_naming,
      capacity: args.capacity,
      created_at: now,
      created_by: userId,
      updated_at: now,
      version: 1,
    });

    await writeAudit(ctx, {
      userId,
      action: "storageNodes.create",
      entityType: "storage_nodes",
      entityId: id,
      details: { kind: args.kind, unitId: args.unitId, parentId: args.parentId },
    });
    return await ctx.db.get(id);
  },
});

export const createBatch = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    unitId: v.id("storage_units"),
    parentId: v.optional(v.id("storage_nodes")),
    kind: nodeKind,
    count: v.number(),
    prefix: v.string(),
    start: v.number(),
    padding: v.number(),
    rows: v.optional(v.number()),
    cols: v.optional(v.number()),
    position_naming: v.optional(v.union(v.literal("alpha_row"), v.literal("numeric"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "create");
    if (args.count < 1) throw new Error("count must be at least 1");
    await loadUnitInLab(ctx, args.unitId, args.labId);
    const parent = await resolveParent(ctx, args.parentId, args.labId, args.unitId);

    if (!isAllowedParent(args.kind, parentKindOf(parent))) {
      throw new Error(
        `Invalid parent: a '${args.kind}' must be created under a '${ALLOWED_PARENT[args.kind]}'`,
      );
    }

    const path = computeChildPath(parent);
    const depth = computeDepth(path);
    const now = Date.now();
    const ids: Id<"storage_nodes">[] = [];
    for (let i = args.start; i < args.start + args.count; i++) {
      const name = `${args.prefix}${String(i).padStart(args.padding, "0")}`;
      const id = await ctx.db.insert("storage_nodes", {
        lab_id: args.labId,
        unit_id: args.unitId,
        parent_id: args.parentId,
        path,
        depth,
        kind: args.kind,
        name,
        ordinal: i,
        rows: args.rows,
        cols: args.cols,
        position_naming: args.position_naming,
        created_at: now,
        created_by: userId,
        updated_at: now,
        version: 1,
      });
      ids.push(id);
    }

    await writeAudit(ctx, {
      userId,
      action: "storageNodes.createBatch",
      entityType: "storage_nodes",
      entityId: args.unitId,
      details: { kind: args.kind, count: args.count, prefix: args.prefix },
    });
    return { count: ids.length, ids };
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    id: v.id("storage_nodes"),
    version: v.number(),
    name: v.optional(v.string()),
    ordinal: v.optional(v.number()),
    rows: v.optional(v.number()),
    cols: v.optional(v.number()),
    position_naming: v.optional(v.union(v.literal("alpha_row"), v.literal("numeric"))),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "update");
    const node = await loadNodeInLab(ctx, args.id, args.labId);
    if (node.version !== args.version) throw new Error("CONFLICT: storage node was updated by someone else");

    const patch: Record<string, unknown> = { updated_at: Date.now(), updated_by: userId, version: node.version + 1 };
    for (const key of ["name", "ordinal", "rows", "cols", "position_naming", "capacity"] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }
    await ctx.db.patch(args.id, patch);

    await writeAudit(ctx, { userId, action: "storageNodes.update", entityType: "storage_nodes", entityId: args.id });
    return await ctx.db.get(args.id);
  },
});

export const move = mutation({
  args: {
    token: v.optional(v.string()),
    labId: v.id("labs"),
    id: v.id("storage_nodes"),
    version: v.number(),
    newParentId: v.id("storage_nodes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "move");
    const node = await loadNodeInLab(ctx, args.id, args.labId);
    if (node.version !== args.version) throw new Error("CONFLICT: storage node was updated by someone else");

    const newParent = await loadNodeInLab(ctx, args.newParentId, args.labId);
    if (newParent.unit_id !== node.unit_id) {
      throw new Error("Cannot move a node to a different storage unit");
    }
    if (!isAllowedParent(node.kind, newParent.kind)) {
      throw new Error(`Invalid parent: a '${node.kind}' must be moved under a '${ALLOWED_PARENT[node.kind]}'`);
    }
    if (wouldCreateCycle(node._id, newParent)) {
      throw new Error("Cannot move a node into itself or one of its own descendants");
    }

    const newPath = computeChildPath(newParent);
    const now = Date.now();

    // Descendants first, so a mid-way failure never leaves the moved node
    // pointing at a new path while descendants still reference the old one.
    const unitNodes = await ctx.db
      .query("storage_nodes")
      .withIndex("by_unit", (q) => q.eq("unit_id", node.unit_id))
      .collect();
    const descendants = unitNodes.filter((n) => n.path.includes(node._id));
    for (const descendant of descendants) {
      const rewrittenPath = rewriteDescendantPath(descendant.path, node._id, newPath);
      await ctx.db.patch(descendant._id, {
        path: rewrittenPath,
        depth: rewrittenPath.length,
        updated_at: now,
        updated_by: userId,
        version: descendant.version + 1,
      });
    }

    await ctx.db.patch(node._id, {
      parent_id: newParent._id,
      path: newPath,
      depth: computeDepth(newPath),
      updated_at: now,
      updated_by: userId,
      version: node.version + 1,
    });

    await writeAudit(ctx, {
      userId,
      action: "storageNodes.move",
      entityType: "storage_nodes",
      entityId: args.id,
      details: { newParentId: args.newParentId, descendantsRewritten: descendants.length },
    });
    return await ctx.db.get(node._id);
  },
});

export const archive = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_nodes"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "archive");
    const node = await loadNodeInLab(ctx, args.id, args.labId);
    if (node.version !== args.version) throw new Error("CONFLICT: storage node was updated by someone else");

    const boxes = await boxesInSubtree(ctx, node);
    // Parallel per-box existence checks instead of a sequential N+1 loop.
    const occupiedFlags = await Promise.all(boxes.map((box) => boxHasPositions(ctx, box._id)));
    if (occupiedFlags.some(Boolean)) {
      throw new Error("Cannot archive: one or more positions in this subtree are occupied, reserved, or flagged");
    }

    await ctx.db.patch(args.id, {
      archived_at: Date.now(),
      archived_by: userId,
      updated_at: Date.now(),
      updated_by: userId,
      version: node.version + 1,
    });
    await writeAudit(ctx, { userId, action: "storageNodes.archive", entityType: "storage_nodes", entityId: args.id });
    return await ctx.db.get(args.id);
  },
});

export const restore = mutation({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_nodes"), version: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "restore");
    const node = await loadNodeInLab(ctx, args.id, args.labId);
    if (node.version !== args.version) throw new Error("CONFLICT: storage node was updated by someone else");
    if (node.archived_at === undefined) throw new Error("Storage node is not archived");

    await ctx.db.patch(args.id, {
      archived_at: undefined,
      archived_by: undefined,
      updated_at: Date.now(),
      updated_by: userId,
      version: node.version + 1,
    });
    await writeAudit(ctx, { userId, action: "storageNodes.restore", entityType: "storage_nodes", entityId: args.id });
    return await ctx.db.get(args.id);
  },
});

/** Root-first breadcrumb trail, including the node itself. Zero re-traversal: one batch read of `path`. */
export const breadcrumbs = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_nodes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    const node = await loadNodeInLab(ctx, args.id, args.labId);
    const ancestors = await Promise.all(node.path.map((ancestorId) => ctx.db.get(ancestorId)));
    return [...ancestors, node]
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .map((n) => ({ id: n._id, name: n.name, kind: n.kind }));
  },
});

export const occupancy = query({
  args: { token: v.optional(v.string()), labId: v.id("labs"), id: v.id("storage_nodes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx, args.token);
    await requireStoragePermission(ctx, userId, args.labId, "view");
    const node = await loadNodeInLab(ctx, args.id, args.labId);
    const boxes = await boxesInSubtree(ctx, node);

    // Parallel per-box position reads instead of a sequential N+1 loop.
    const positionsByBox = await Promise.all(
      boxes.map((box) =>
        ctx.db.query("storage_positions").withIndex("by_box", (q) => q.eq("box_id", box._id)).collect()
      )
    );

    let capacity = 0;
    let occupied = 0;
    let reserved = 0;
    let quarantined = 0;
    let unavailable = 0;
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
