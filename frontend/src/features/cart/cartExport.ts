export interface ExportRow {
  name: string; vendor: string; catalog: string; size: string; quantity: number; unit_price: number | null; status: string;
  requested_by?: string; project?: string; grant?: string; budget_code?: string; urgency?: string; po_number?: string; captured_at?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** One CSV cell. A leading = + - @ would run as a spreadsheet formula, so those get a quote mark in front. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function cartCsv(rows: ExportRow[]): string {
  const head = ['Item', 'Supplier', 'Catalog #', 'Size', 'Quantity', 'Unit price', 'Line total', 'Status', 'Requested by', 'Project', 'Grant', 'Budget code', 'Urgency', 'PO', 'Requested on'];
  const lines = rows.map((r) => [
    r.name, r.vendor, r.catalog, r.size, r.quantity, r.unit_price ?? '', r.unit_price != null ? (r.unit_price * r.quantity).toFixed(2) : '',
    r.status, r.requested_by, r.project, r.grant, r.budget_code, r.urgency, r.po_number, r.captured_at?.slice(0, 10),
  ].map(csvCell).join(','));
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}

/** Printable purchase order for one PO number. */
export function poHtml(po: string, supplier: string, rows: ExportRow[], labName = 'LabOS'): string {
  const total = rows.reduce((s, r) => s + (r.unit_price ?? 0) * r.quantity, 0);
  const body = rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.catalog)}</td><td>${esc(r.size)}</td><td class="n">${r.quantity}</td>
    <td class="n">${r.unit_price != null ? r.unit_price.toFixed(2) : '—'}</td><td class="n">${r.unit_price != null ? (r.unit_price * r.quantity).toFixed(2) : '—'}</td>
    <td>${esc([r.project, r.grant, r.budget_code].filter(Boolean).join(' / '))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(po)}</title><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#111} h1{font-size:20px;margin:0} .m{color:#555;font-size:13px;margin:4px 0 18px}
    table{width:100%;border-collapse:collapse;font-size:13px} th,td{border:1px solid #ccc;padding:6px 8px;text-align:left} th{background:#f3f3f3} .n{text-align:right}
    .t{text-align:right;font-weight:700;margin-top:12px}</style></head><body>
    <h1>Purchase order ${esc(po)}</h1><div class="m">${esc(labName)} · Supplier: ${esc(supplier)} · ${new Date().toLocaleDateString()}</div>
    <table><thead><tr><th>Item</th><th>Catalog #</th><th>Size</th><th class="n">Qty</th><th class="n">Unit $</th><th class="n">Total $</th><th>Project / grant / code</th></tr></thead><tbody>${body}</tbody></table>
    <div class="t">Total: $${total.toFixed(2)}</div></body></html>`;
}

export function openPrint(html: string): boolean {
  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return true;
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
