/** Turns exports (inventory workbook sheets, Orders CSV, Order Requests CSV) into rows for convex/stockImport.ts. Nothing is merged by name. */
export type ImportKind = "item" | "instance" | "order" | "request";
export interface ImportRecord {
  kind: ImportKind; external_id: string; category?: string; name: string; vendor?: string; catalog?: string;
  status?: string; date?: number; amount?: number; data: string;
}
type Row = Record<string, unknown>;

const s = (v: unknown) => String(v ?? "").trim();
const opt = (v: unknown) => s(v) || undefined;
const num = (v: unknown) => { const n = parseFloat(s(v).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : undefined; };
const ts = (v: unknown) => { const t = Date.parse(s(v)); return Number.isNaN(t) ? undefined : t; };
/** CSV exports start the first header with a BOM and ="..." (a spreadsheet text guard). */
export const cleanHeader = (h: string) => h.replace(/^﻿/, "").replace(/^="(.*)"$/, "$1").trim();
const clean = (r: Row): Row => Object.fromEntries(Object.entries(r).map(([k, v]) => [cleanHeader(k), typeof v === "string" ? v.replace(/^="(.*)"$/, "$1") : v]));
const pack = (r: Row) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([, v]) => s(v) !== "")));

/** One workbook sheet. Item rows are keyed by Serial Number, Instance rows by their Instance ID. */
export function parseInventorySheet(category: string, rows: Row[]): ImportRecord[] {
  const out: ImportRecord[] = [];
  for (const raw of rows) {
    const r = clean(raw);
    const type = s(r["Row Type"]).toLowerCase();
    if (type !== "item" && type !== "instance") continue;
    const serial = s(r["Serial Number"]);
    const id = type === "instance" ? s(r["Instance ID"]) : serial;
    out.push({
      kind: type, external_id: id || `${serial}|${s(r["Item Name *"])}`, category, name: s(r["Item Name *"]),
      vendor: opt(r["Vendor"]), catalog: opt(r["Catalog #"]), status: s(r["Archived"]).toUpperCase() === "Y" ? "archived" : "active",
      date: ts(r["Expiration Date"]), amount: num(r["Price"]), data: pack(r),
    });
  }
  return out;
}

export function parseOrders(rows: Row[]): ImportRecord[] {
  return rows.map(clean).filter((r) => s(r["Order #"])).map((r) => ({
    kind: "order" as const, external_id: s(r["Order #"]), name: `Order ${s(r["Order #"])}`, vendor: opt(r["Vendor"]),
    catalog: undefined, status: "ordered", date: ts(r["Date Ordered"]), amount: num(r["Order Total"]), data: pack(r),
  }));
}

/** Requests have no id column, so the key is name + vendor + catalog + date requested. */
export function parseRequests(rows: Row[]): ImportRecord[] {
  return rows.map(clean).filter((r) => s(r["Item Name"])).map((r) => ({
    kind: "request" as const, external_id: [s(r["Item Name"]), s(r["Vendor"]), s(r["Catalog #"]), s(r["Date Requested"])].join("|"),
    category: opt(r["Type"]), name: s(r["Item Name"]), vendor: opt(r["Vendor"]), catalog: opt(r["Catalog #"]),
    status: opt(r["Status"]), date: ts(r["Date Ordered"]) ?? ts(r["Date Requested"]), amount: num(r["Total Price"]), data: pack(r),
  }));
}

/** Import report for a parsed file: counts per kind and category, rows missing required fields, repeated ids. */
export function importReport(records: ImportRecord[]) {
  const count = (f: (r: ImportRecord) => string) => records.reduce<Record<string, number>>((m, r) => { const k = f(r); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const seen = new Set<string>(); const duplicateIds: string[] = [];
  for (const r of records) { const k = `${r.kind}|${r.external_id}`; if (seen.has(k)) duplicateIds.push(k); seen.add(k); }
  return {
    total: records.length, byKind: count((r) => r.kind), byCategory: count((r) => `${r.kind}: ${r.category ?? "-"}`),
    missingName: records.filter((r) => !r.name).length,
    missingCatalog: records.filter((r) => (r.kind === "item" || r.kind === "instance" || r.kind === "request") && !r.catalog).length,
    duplicateIds,
  };
}

/** Same product (vendor + catalog number) already in stock? Distinct instances stay distinct; this only compares keys. */
export const stockKey = (r: { vendor?: string; catalog?: string }) => {
  const n = (x?: string) => (x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return n(r.vendor) && n(r.catalog) ? `${n(r.vendor)}|${n(r.catalog)}` : "";
};
