/** Warnings an approver should see before saying yes. Worked out from the requests the lab already has. */
export interface FlagRow {
  id: string; name: string; vendor: string; catalog: string; unit_price: number | null;
  status: string; captured_at: string;
}

export interface RequestFlag { kind: 'duplicate' | 'price-up'; text: string }

const OPEN = new Set(['pending', 'approved', 'ordered']);
const BOUGHT = new Set(['ordered', 'received']);
/** A price rise smaller than this is treated as noise. */
export const PRICE_RISE_THRESHOLD = 0.1;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Same product: same catalog number from the same vendor, or (with no catalog number) the same name. */
function sameItem(a: FlagRow, b: FlagRow): boolean {
  if (a.catalog && b.catalog) return norm(a.catalog) === norm(b.catalog) && norm(a.vendor) === norm(b.vendor);
  return !a.catalog && !b.catalog && norm(a.name) === norm(b.name);
}

/** Flags for each request id. Only requests still waiting for a decision (or approved) are flagged. */
export function flagRequests(rows: FlagRow[]): Map<string, RequestFlag[]> {
  const out = new Map<string, RequestFlag[]>();
  const add = (id: string, f: RequestFlag) => out.set(id, [...(out.get(id) ?? []), f]);
  for (const r of rows) {
    if (r.status !== 'pending' && r.status !== 'approved') continue;
    const twins = rows.filter((o) => o.id !== r.id && OPEN.has(o.status) && sameItem(r, o));
    if (twins.length) add(r.id, { kind: 'duplicate', text: `${twins.length} other open request${twins.length === 1 ? '' : 's'} for this item` });

    // Compare with the most recent earlier purchase of the same item.
    const last = rows
      .filter((o) => o.id !== r.id && BOUGHT.has(o.status) && o.unit_price != null && o.unit_price > 0 && o.captured_at < r.captured_at && sameItem(r, o))
      .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
    if (last && r.unit_price != null && last.unit_price != null) {
      const rise = (r.unit_price - last.unit_price) / last.unit_price;
      if (rise > PRICE_RISE_THRESHOLD) add(r.id, { kind: 'price-up', text: `Price up ${Math.round(rise * 100)}% since the last order (${last.unit_price.toFixed(2)} to ${r.unit_price.toFixed(2)})` });
    }
  }
  return out;
}
