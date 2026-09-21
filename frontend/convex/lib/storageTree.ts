import type { Id } from "../_generated/dataModel";

/**
 * Storage-node tree helpers: kind legality, path/depth computation, cycle
 * detection, and descendant path rewriting on move.
 *
 * `storage_nodes.path` stores ANCESTOR ids only, root-first, never including
 * the node itself. A shelf's parent is the storage_unit (not a node), so a
 * shelf's own path is empty.
 *
 * See docs/adr/ADR-freezer-storage-hierarchy.md "1. One storage_nodes
 * adjacency table with a materialised path".
 */

export type NodeKind = "shelf" | "rack" | "box";
export type ParentKind = "unit" | NodeKind;

/** Legal parent kind for each child kind. A shelf's parent is the unit itself. */
export const ALLOWED_PARENT: Record<NodeKind, ParentKind> = {
  shelf: "unit",
  rack: "shelf",
  box: "rack",
};

export function isAllowedParent(childKind: NodeKind, parentKind: ParentKind): boolean {
  return ALLOWED_PARENT[childKind] === parentKind;
}

/**
 * The path a new child of `parent` would get. `parent` is `undefined` when
 * the child is a direct child of the storage unit (i.e. a shelf).
 */
export function computeChildPath(
  parent: { _id: Id<"storage_nodes">; path: Id<"storage_nodes">[] } | undefined,
): Id<"storage_nodes">[] {
  if (!parent) return [];
  return [...parent.path, parent._id];
}

export function computeDepth(path: Id<"storage_nodes">[]): number {
  return path.length;
}

/**
 * True if moving `nodeId` under `newParent` would create a cycle: moving a
 * node into itself, or into one of its own descendants. `newParent` is
 * `undefined` when moving directly under the storage unit (never a cycle).
 */
export function wouldCreateCycle(
  nodeId: Id<"storage_nodes">,
  newParent: { _id: Id<"storage_nodes">; path: Id<"storage_nodes">[] } | undefined,
): boolean {
  if (!newParent) return false;
  if (newParent._id === nodeId) return true;
  return newParent.path.includes(nodeId);
}

/**
 * Recompute a descendant's path after an ancestor (`movedNodeId`) moved to
 * `newAncestorPath` (the moved node's own new path, i.e. its new parent's
 * path + new parent id). Only the prefix up to and including `movedNodeId`
 * changes; everything below it keeps its relative shape.
 */
export function rewriteDescendantPath(
  descendantPath: Id<"storage_nodes">[],
  movedNodeId: Id<"storage_nodes">,
  newAncestorPath: Id<"storage_nodes">[],
): Id<"storage_nodes">[] {
  const cutIndex = descendantPath.indexOf(movedNodeId);
  if (cutIndex === -1) {
    throw new Error("rewriteDescendantPath: movedNodeId not found in descendant path");
  }
  const below = descendantPath.slice(cutIndex + 1);
  return [...newAncestorPath, movedNodeId, ...below];
}
