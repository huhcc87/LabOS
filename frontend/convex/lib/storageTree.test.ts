import { describe, it, expect } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  isAllowedParent,
  computeChildPath,
  computeDepth,
  wouldCreateCycle,
  rewriteDescendantPath,
} from "./storageTree";

const id = (s: string) => s as unknown as Id<"storage_nodes">;

describe("isAllowedParent", () => {
  it("shelf under unit is allowed", () => {
    expect(isAllowedParent("shelf", "unit")).toBe(true);
  });
  it("rack under shelf is allowed", () => {
    expect(isAllowedParent("rack", "shelf")).toBe(true);
  });
  it("box under rack is allowed", () => {
    expect(isAllowedParent("box", "rack")).toBe(true);
  });
  it("rack directly under unit is rejected", () => {
    expect(isAllowedParent("rack", "unit")).toBe(false);
  });
  it("box directly under shelf is rejected", () => {
    expect(isAllowedParent("box", "shelf")).toBe(false);
  });
  it("shelf under rack is rejected", () => {
    expect(isAllowedParent("shelf", "rack")).toBe(false);
  });
});

describe("computeChildPath / computeDepth", () => {
  it("a shelf (no node parent) gets an empty path", () => {
    expect(computeChildPath(undefined)).toEqual([]);
    expect(computeDepth([])).toBe(0);
  });

  it("a rack under a shelf gets [shelfId]", () => {
    const shelf = { _id: id("shelf-1"), path: [] as Id<"storage_nodes">[] };
    const path = computeChildPath(shelf);
    expect(path).toEqual([id("shelf-1")]);
    expect(computeDepth(path)).toBe(1);
  });

  it("a box under a rack gets [shelfId, rackId]", () => {
    const rack = { _id: id("rack-1"), path: [id("shelf-1")] };
    const path = computeChildPath(rack);
    expect(path).toEqual([id("shelf-1"), id("rack-1")]);
    expect(computeDepth(path)).toBe(2);
  });
});

describe("wouldCreateCycle", () => {
  it("moving to the storage unit root is never a cycle", () => {
    expect(wouldCreateCycle(id("rack-1"), undefined)).toBe(false);
  });

  it("moving a node into itself is a cycle", () => {
    const self = { _id: id("rack-1"), path: [id("shelf-1")] };
    expect(wouldCreateCycle(id("rack-1"), self)).toBe(true);
  });

  it("moving a shelf into its own descendant rack is a cycle", () => {
    // shelf-1 -> rack-1 (path [shelf-1]) -> box-1 (path [shelf-1, rack-1])
    const rack1 = { _id: id("rack-1"), path: [id("shelf-1")] };
    expect(wouldCreateCycle(id("shelf-1"), rack1)).toBe(true);
  });

  it("moving a rack under an unrelated shelf is not a cycle", () => {
    const otherShelf = { _id: id("shelf-2"), path: [] as Id<"storage_nodes">[] };
    expect(wouldCreateCycle(id("rack-1"), otherShelf)).toBe(false);
  });
});

describe("rewriteDescendantPath", () => {
  it("rewrites only the prefix up to and including the moved node", () => {
    // box's original path: [shelf-1, rack-1] (rack-1 moved)
    // rack-1 moves under shelf-2, whose own path is [] -> rack-1's new path is [shelf-2]
    const boxOldPath = [id("shelf-1"), id("rack-1")];
    const rewritten = rewriteDescendantPath(boxOldPath, id("rack-1"), [id("shelf-2")]);
    expect(rewritten).toEqual([id("shelf-2"), id("rack-1")]);
  });

  it("keeps everything below the moved node unchanged", () => {
    // a deeper descendant path with an extra segment after the moved node
    const deepPath = [id("shelf-1"), id("rack-1"), id("box-1")];
    const rewritten = rewriteDescendantPath(deepPath, id("rack-1"), [id("shelf-2")]);
    expect(rewritten).toEqual([id("shelf-2"), id("rack-1"), id("box-1")]);
  });

  it("throws when the moved node is not an ancestor of the given path", () => {
    const unrelated = [id("shelf-9"), id("rack-9")];
    expect(() => rewriteDescendantPath(unrelated, id("rack-1"), [id("shelf-2")])).toThrow();
  });
});
