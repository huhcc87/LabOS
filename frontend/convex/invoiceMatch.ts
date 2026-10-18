/**
 * Three-way match for one purchase order: what was ordered (PO), what arrived (receiving), what the
 * supplier billed (invoices). Plain function, no database access.
 */
export type PoLine = { quantity: number; received_quantity?: number; unit_price?: number };

export type MatchStatus = "awaiting_goods" | "awaiting_invoice" | "matched" | "partial" | "mismatch" | "unverified";

export type PoMatch = { status: MatchStatus; ordered: number; received: number; invoiced: number; issues: string[] };

const cents = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${cents(Math.abs(n)).toFixed(2)}`;

export function matchPo(lines: PoLine[], invoices: number[]): PoMatch {
  const ordered = cents(lines.reduce((s, l) => s + l.quantity * (l.unit_price ?? 0), 0));
  const received = cents(lines.reduce((s, l) => s + (l.received_quantity ?? 0) * (l.unit_price ?? 0), 0));
  const invoiced = cents(invoices.reduce((s, a) => s + a, 0));
  const tol = Math.max(1, ordered * 0.01); // a dollar or 1%: shipping rounding, not a real difference
  const allReceived = lines.length > 0 && lines.every((l) => (l.received_quantity ?? 0) >= l.quantity);
  const base = { ordered, received, invoiced };

  if (invoices.length === 0) {
    return { ...base, status: allReceived || received > 0 ? "awaiting_invoice" : "awaiting_goods", issues: [] };
  }
  const issues: string[] = [];
  if (invoiced > ordered + tol) issues.push(`Invoiced ${usd(invoiced - ordered)} more than the PO.`);
  if (invoiced > received + tol) issues.push(received === 0 ? "Invoice entered but nothing is received yet." : `Invoiced ${usd(invoiced - received)} more than what was received.`);
  if (issues.length) return { ...base, status: "mismatch", issues };
  if (lines.some((l) => !l.unit_price)) return { ...base, status: "unverified", issues: ["Some lines have no price, so the match can't be checked."] };
  if (invoiced < received - tol) {
    return { ...base, status: "partial", issues: [`Invoiced ${usd(received - invoiced)} less than what was received. Another invoice may be due.`] };
  }
  return { ...base, status: "matched", issues: [] };
}
