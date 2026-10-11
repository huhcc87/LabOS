// @vitest-environment edge-runtime
/** Every table with a `lab_id` must be listed for scoping, so a new table can't quietly leak between labs. */
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { LAB_TABLES } from "../../convex/tenantTables";

const NOT_SCOPED_ON_PURPOSE = new Set(["lab_memberships"]); // a membership row names its lab by design

describe("lab scoping covers the schema", () => {
  const tables = schema.tables as Record<string, { validator: { fields: Record<string, unknown> } }>;
  const withLab = Object.keys(tables).filter((t) => "lab_id" in tables[t].validator.fields && !NOT_SCOPED_ON_PURPOSE.has(t));

  it("scopes every table that has a lab_id", () => {
    expect(withLab.filter((t) => !(LAB_TABLES as readonly string[]).includes(t))).toEqual([]);
  });
  it("only lists tables that exist and carry a lab_id", () => {
    expect([...LAB_TABLES].filter((t) => !withLab.includes(t))).toEqual([]);
  });
  it("gives users a home lab", () => {
    expect("home_lab_id" in tables.users.validator.fields).toBe(true);
  });
});
