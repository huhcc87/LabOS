import { describe, it, expect } from "vitest";
import { matchPo } from "../../convex/invoiceMatch";

const lines = [
  { quantity: 2, received_quantity: 2, unit_price: 50 },
  { quantity: 1, received_quantity: 1, unit_price: 20 },
]; // ordered 120, received 120

describe("matchPo", () => {
  it("waits for goods, then for an invoice", () => {
    expect(matchPo([{ quantity: 1, unit_price: 10 }], []).status).toBe("awaiting_goods");
    expect(matchPo(lines, []).status).toBe("awaiting_invoice");
  });
  it("matches an invoice equal to what was received", () => {
    expect(matchPo(lines, [120]).status).toBe("matched");
    expect(matchPo(lines, [60, 60]).status).toBe("matched"); // split across invoices
    expect(matchPo(lines, [120.5]).status).toBe("matched"); // within a dollar
  });
  it("flags an invoice above the PO or above what arrived", () => {
    const over = matchPo(lines, [150]);
    expect(over.status).toBe("mismatch");
    expect(over.issues.length).toBeGreaterThan(0);
    expect(matchPo([{ quantity: 1, unit_price: 100 }], [100]).status).toBe("mismatch"); // nothing received
    expect(matchPo([{ quantity: 2, received_quantity: 1, unit_price: 50 }], [100]).status).toBe("mismatch"); // billed for the undelivered half
  });
  it("calls a short invoice partial and unpriced lines unverified", () => {
    expect(matchPo(lines, [40]).status).toBe("partial");
    expect(matchPo([{ quantity: 1, received_quantity: 1 }], [5]).status).toBe("mismatch"); // 5 > received 0 value
    expect(matchPo([{ quantity: 1, received_quantity: 1, unit_price: 10 }, { quantity: 1, received_quantity: 1 }], [10]).status).toBe("unverified");
  });
});
