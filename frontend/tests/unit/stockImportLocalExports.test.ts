// Validates the parsers against the lab's real exports. Skipped when the files are not on this machine
// (they are institutional records and are never committed). Set IMPORT_DIR to the folder holding them.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { parseInventorySheet, parseOrders, parseRequests, importReport } from "../../src/features/stockimport/parse";

const dir = process.env.IMPORT_DIR ?? `${process.env.HOME}/Downloads`;
const book = `${dir}/Nekhai_Lab_Inventory_Nov_1_2026.xlsx`;
const orders = `${dir}/New Folder With Items 2/Orders (Nov 1, 2026) (1).csv`;
const requests = `${dir}/Nekhai_Lab's Order Requests (Nov 1, 2026).csv`;
const csv = (f: string) => { const w = XLSX.read(readFileSync(f, "utf8"), { type: "string", raw: false }); return XLSX.utils.sheet_to_json<Record<string, unknown>>(w.Sheets[w.SheetNames[0]], { defval: "", raw: false }); };

describe.skipIf(!existsSync(book))("local exports", () => {
  it("workbook gives 3,988 items and 3,054 instances", () => {
    const wb = XLSX.readFile(book);
    const recs = wb.SheetNames.filter((n) => n !== "Instructions").flatMap((n) => parseInventorySheet(n, XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" })));
    const rep = importReport(recs);
    expect(rep.byKind).toEqual({ item: 3988, instance: 3054 });
  });
  it.skipIf(!existsSync(orders) || !existsSync(requests))("pHCMV-EcoEnv: order 1022716 and its request", () => {
    const o = parseOrders(csv(orders)).find((r) => r.external_id === "1022716");
    expect(o).toMatchObject({ vendor: expect.stringMatching(/addgene/i), amount: 94 });
    const r = parseRequests(csv(requests)).find((x) => /pHCMV-EcoEnv/i.test(x.name));
    expect(r).toMatchObject({ catalog: "15802", amount: 94 });
    expect(r?.status).toMatch(/ordered/i);
  });
});
