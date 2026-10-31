import { describe, it, expect } from "vitest";
import { flagRequests, type FlagRow } from "../../src/features/cart/requestFlags";

const row = (o: Partial<FlagRow> & { id: string }): FlagRow => ({
  name: "Tris buffer", vendor: "Sigma", catalog: "T1503", unit_price: 50, status: "pending", captured_at: "2026-10-10T00:00:00Z", ...o,
});

describe("flagRequests", () => {
  it("flags a second open request for the same vendor and catalog number", () => {
    const flags = flagRequests([row({ id: "a" }), row({ id: "b", vendor: "SIGMA", catalog: "t-1503" })]);
    expect(flags.get("a")?.[0].kind).toBe("duplicate");
    expect(flags.get("b")?.[0].kind).toBe("duplicate");
  });

  it("does not call different catalog numbers duplicates", () => {
    expect(flagRequests([row({ id: "a" }), row({ id: "b", catalog: "T9999" })]).size).toBe(0);
  });

  it("matches by name only when neither request has a catalog number", () => {
    const flags = flagRequests([row({ id: "a", catalog: "" }), row({ id: "b", catalog: "", name: "TRIS Buffer" })]);
    expect(flags.get("a")?.[0].kind).toBe("duplicate");
  });

  it("flags a price rise of more than 10% against the last purchase", () => {
    const flags = flagRequests([
      row({ id: "old", status: "received", unit_price: 50, captured_at: "2026-01-01T00:00:00Z" }),
      row({ id: "new", unit_price: 60, captured_at: "2026-10-01T00:00:00Z" }),
    ]);
    expect(flags.get("new")?.[0]).toMatchObject({ kind: "price-up" });
    expect(flags.get("new")?.[0].text).toContain("20%");
  });

  it("ignores small price changes and price drops", () => {
    const base = row({ id: "old", status: "received", unit_price: 50, captured_at: "2026-01-01T00:00:00Z" });
    expect(flagRequests([base, row({ id: "n1", unit_price: 54 })]).size).toBe(0);
    expect(flagRequests([base, row({ id: "n2", unit_price: 40 })]).size).toBe(0);
  });

  it("only flags requests still waiting or approved", () => {
    expect(flagRequests([row({ id: "a", status: "received" }), row({ id: "b", status: "pending" })]).has("a")).toBe(false);
  });
});
