import { describe, it, expect } from "vitest";
import { parseInventorySheet, parseOrders, parseRequests, importReport } from "../../src/features/stockimport/parse";

describe("stockimport parsers", () => {
  it("keeps items and instances separate by the source system id", () => {
    const rows = [
      { "Row Type": "Item", "Serial Number": "AR1", "Item Name *": "Anti-X", Vendor: "Abcam", "Catalog #": "ab1", Archived: "N" },
      { "Row Type": "Instance", "Serial Number": "AR1", "Instance ID": "u-1", "Item Name *": "Anti-X", Vendor: "Abcam", "Catalog #": "ab1", Archived: "N" },
      { "Row Type": "Instance", "Serial Number": "AR1", "Instance ID": "u-2", "Item Name *": "Anti-X", Vendor: "Abcam", "Catalog #": "ab1", Archived: "Y" },
    ];
    const out = parseInventorySheet("Antibody", rows);
    expect(out.map((r) => r.external_id)).toEqual(["AR1", "u-1", "u-2"]);
    expect(out[2].status).toBe("archived");
    expect(importReport(out).byKind).toEqual({ item: 1, instance: 2 });
  });
  it("reads CSV headers with BOM and the =\"...\" guard", () => {
    const o = parseOrders([{ '﻿="Order #"': '="1022716"', Vendor: "Addgene", "Date Ordered": "2026-10-27", "Order Total": "$94.00" }]);
    expect(o[0]).toMatchObject({ external_id: "1022716", vendor: "Addgene", amount: 94 });
  });
  it("parses the pHCMV-EcoEnv request and flags missing catalog numbers", () => {
    const r = parseRequests([{ "Item Name": "pHCMV-EcoEnv", Vendor: "Addgene", "Catalog #": "15802", Status: "Ordered", "Total Price": "94", "Date Requested": "2026-10-20" }, { "Item Name": "No catalog" }]);
    expect(r[0]).toMatchObject({ name: "pHCMV-EcoEnv", catalog: "15802", amount: 94, status: "Ordered" });
    expect(importReport(r).missingCatalog).toBe(1);
  });
});
