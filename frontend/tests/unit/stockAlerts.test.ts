import { describe, it, expect } from "vitest";
import { stockAlerts, type AlertRow } from "../../convex/stockAlerts";
import { productLink, detailFields } from "../../src/components/StockImportTab";

describe("detailFields", () => {
  it("puts the columns after CAS Number first as category details and hides bookkeeping columns", () => {
    const data = JSON.stringify({ Archived: "N", "Item Name *": "Anti-GFP", "CAS Number": "-", Clone: "9F9", Isotype: "IgG1" });
    const d = detailFields(data);
    expect(d.specific).toEqual([["Clone", "9F9"], ["Isotype", "IgG1"]]);
    expect(d.common.map(([k]) => k)).toEqual(["Item Name *", "CAS Number"]);
  });
  it("copes with missing or broken data", () => {
    expect(detailFields(undefined)).toEqual({ common: [], specific: [] });
    expect(detailFields("{oops")).toEqual({ common: [], specific: [] });
  });
});

const NOW = Date.parse("2026-11-01");
const DAY = 86_400_000;
const inst = (id: string, data: Record<string, string>, over: Partial<AlertRow> = {}): AlertRow => ({
  _id: id, kind: "instance", name: `Item ${id}`, vendor: "Sigma", catalog: "X1", status: "active", data: JSON.stringify(data), ...over,
});

describe("stockAlerts", () => {
  it("flags out of stock, below minimum, expired and expiring instances", () => {
    const rows = [
      inst("a", { "Amount in Stock": "0" }),
      inst("b", { "Amount in Stock": "1", "Min to Stock": "3" }),
      inst("c", { "Amount in Stock": "5" }, { date: NOW - DAY }),
      inst("d", { "Amount in Stock": "5" }, { date: NOW + 30 * DAY }),
      inst("e", { "Amount in Stock": "5", "Min to Stock": "3" }),
    ];
    expect(stockAlerts(rows, NOW).map((a) => [a.id, a.reason])).toEqual([
      ["a", "out of stock"], ["b", "below minimum"], ["c", "expired"], ["d", "expires soon"],
    ]);
  });

  it("skips archived instances, item rows and rows with no amount", () => {
    const rows = [
      inst("a", { "Amount in Stock": "0" }, { status: "archived" }),
      inst("b", { "Amount in Stock": "0" }, { kind: "item" }),
      inst("c", {}),
      inst("d", { "Amount in Stock": "not a number" }),
    ];
    expect(stockAlerts(rows, NOW)).toEqual([]);
  });
});

describe("productLink", () => {
  it("prefers the exported http(s) URL and never returns other schemes", () => {
    expect(productLink({ data: JSON.stringify({ URL: "https://x.test/p" }) })).toBe("https://x.test/p");
    expect(productLink({ data: JSON.stringify({ URL: "javascript:alert(1)" }) })).toBeUndefined();
  });

  it("falls back to the vendor's own search for the catalog number", () => {
    expect(productLink({ vendor: "Sigma-Aldrich", catalog: "A1234" })).toContain("sigmaaldrich.com");
    expect(productLink({ vendor: "Unknown Co", catalog: "A1" })).toBeUndefined();
  });
});
