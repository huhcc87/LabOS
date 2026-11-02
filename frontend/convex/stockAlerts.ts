/** Stock and expiry alerts over imported instance rows. Plain functions, no database access, so they can be tested directly. */
export interface AlertRow {
  _id: string; kind: string; name: string; vendor?: string; catalog?: string; category?: string; status?: string; date?: number; data: string;
}
export type AlertReason = "out of stock" | "below minimum" | "expired" | "expires soon";
export interface StockAlert {
  id: string; reason: AlertReason; name: string; vendor?: string; catalog?: string; category?: string;
  location?: string; url?: string; amount?: number; min?: number; date?: number;
}

export const SOON_DAYS = 90;
const DAY = 86_400_000;

const num = (v: unknown) => { const n = parseFloat(String(v ?? "").trim()); return Number.isFinite(n) ? n : undefined; };
const field = (data: string, key: string): unknown => { try { return JSON.parse(data)[key]; } catch { return undefined; } };

/**
 * Looks at active instances only (an item row holds counts, not stock). Out of stock = amount is 0;
 * below minimum = "Min to Stock" is set and amount is under it; expired / expires soon = Expiration Date.
 * One alert per instance, most urgent reason first.
 */
export function stockAlerts(rows: AlertRow[], now: number): StockAlert[] {
  const out: StockAlert[] = [];
  for (const r of rows) {
    if (r.kind !== "instance" || r.status === "archived") continue;
    const amount = num(field(r.data, "Amount in Stock"));
    const min = num(field(r.data, "Min to Stock"));
    const reason: AlertReason | undefined =
      r.date !== undefined && r.date < now ? "expired"
      : r.date !== undefined && r.date < now + SOON_DAYS * DAY ? "expires soon"
      : amount === 0 ? "out of stock"
      : amount !== undefined && min !== undefined && amount < min ? "below minimum"
      : undefined;
    if (!reason) continue;
    const loc = String(field(r.data, "Location") ?? "").trim();
    const url = String(field(r.data, "URL") ?? "").trim();
    out.push({ id: r._id, reason, name: r.name, vendor: r.vendor, catalog: r.catalog, category: r.category, location: loc || undefined, url: url || undefined, amount, min, date: r.date });
  }
  return out;
}
