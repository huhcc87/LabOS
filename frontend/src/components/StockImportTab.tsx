import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { stockImportApi, reagentCartApi } from '../lib/api';
import { parseInventorySheet, parseOrders, parseRequests, importReport, type ImportRecord } from '../features/stockimport/parse';
import { csvCell, downloadText } from '../features/cart/cartExport';
import { VENDOR_SEARCHES, vendorSearchUrl } from '../data/vendorSearch';

const BATCH = 250;
const REASONS = ['out of stock', 'below minimum', 'expired', 'expires soon'];

/** Link to the product: the exported URL when it is http(s), else the vendor's own search page for the catalog number, else nothing. */
export function productLink(r: { vendor?: string; catalog?: string; name?: string; data?: string; url?: string }): string | undefined {
  let url = r.url ?? '';
  if (!url && r.data) { try { url = String(JSON.parse(r.data).URL ?? ''); } catch { /* data not JSON */ } }
  if (/^https?:\/\//i.test(url.trim())) return url.trim();
  const v = (r.vendor ?? '').toLowerCase();
  const hit = v && VENDOR_SEARCHES.find((s) => s.name.toLowerCase().split(/[\s(]/)[0] === v.split(/[\s,.]/)[0]);
  const term = r.catalog || r.name;
  return hit && term ? vendorSearchUrl(hit, term) : undefined;
}
const KINDS = ['', 'item', 'instance', 'order', 'request'] as const;
type Loaded = { source: string; records: ImportRecord[] };

/** Reads one export file in the browser. Files never leave this machine except into the lab's own database on import. */
async function readFile(file: File): Promise<Loaded> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  if (/\.xlsx?$/i.test(file.name)) {
    const records = wb.SheetNames.filter((n) => n !== 'Instructions').flatMap((n) => parseInventorySheet(n, XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' })));
    return { source: file.name, records };
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
  const headers = Object.keys(rows[0] ?? {}).map((h) => h.replace(/^﻿/, '').replace(/^="(.*)"$/, '$1'));
  return { source: file.name, records: headers.includes('Order #') ? parseOrders(rows) : parseRequests(rows) };
}

export default function StockImportTab() {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [recon, setRecon] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertFilter, setAlertFilter] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSummary(await stockImportApi.summary());
      setRecon(await stockImportApi.reconcile());
      setAlerts(await stockImportApi.alerts());
    } catch { /* not signed in or no access */ }
  }, []);
  const reorder = async (r: { name: string; vendor?: string; catalog?: string; data?: string; url?: string }) => {
    try {
      await reagentCartApi.create({ name: r.name, quantity: 1, vendor: r.vendor, catalog: r.catalog, url: productLink(r), notes: 'Reorder from imported inventory' });
      toast.success(`Added "${r.name}" to Requests`);
    } catch (e: any) { toast.error(e?.data ?? e?.message ?? 'Could not create the request'); }
  };
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setTimeout(() => { stockImportApi.search({ text, kind: kind || undefined, limit: 100 }).then(setRows).catch(() => setRows([])); }, 250);
    return () => clearTimeout(t);
  }, [text, kind, summary?.total]);

  const pick = async (files: FileList | null) => {
    if (!files) return;
    try { setLoaded(await Promise.all(Array.from(files).map(readFile))); } catch { toast.error('Could not read that file'); }
  };
  const run = async () => {
    setBusy(true);
    try {
      let added = 0, updated = 0;
      for (const f of loaded) for (let i = 0; i < f.records.length; i += BATCH) {
        const r = await stockImportApi.importBatch(f.source, f.records.slice(i, i + BATCH));
        added += r.added; updated += r.updated;
      }
      toast.success(`Imported: ${added} new, ${updated} updated`);
      setLoaded([]); await refresh();
    } catch (e: any) { toast.error(e?.data ?? e?.message ?? 'Import failed'); } finally { setBusy(false); }
  };
  const removeSource = async (source: string) => {
    if (!window.confirm(`Remove all rows imported from "${source}"? Re-import the file to bring them back.`)) return;
    try { const r = await stockImportApi.clearSource(source); toast.success(`Removed ${r.deleted} rows`); await refresh(); }
    catch (e: any) { toast.error(e?.data ?? e?.message ?? 'Only an admin can remove imported rows'); }
  };
  const alertShown =alertFilter ? alerts.filter((a) => a.reason === alertFilter) : alerts;
  const linkBtn: React.CSSProperties = { padding: '2px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, marginRight: 4, color: '#334155', textDecoration: 'none' };
  const actions = (r: any) => {
    const link = productLink(r);
    return (
      <>
        {link && <a href={link} target="_blank" rel="noopener noreferrer" style={linkBtn}>Vendor page</a>}
        <button onClick={() => reorder(r)} style={linkBtn}>Reorder</button>
      </>
    );
  };
  const exportRows = (name: string, list: any[], head = ['kind', 'external_id', 'category', 'name', 'vendor', 'catalog', 'status', 'amount']) => {
    downloadText(name, [head.join(','), ...list.map((r) => head.map((h) => csvCell(r[h])).join(','))].join('\n'));
  };

  const box: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 };
  const counts = (o?: Record<string, number>) => Object.entries(o ?? {}).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ');
  const reconCount = (s: string) => recon.filter((r) => r.state === s).length;

  return (
    <div>
      <div style={box}>
        <h3 style={{ margin: '0 0 6px' }}>Import lab exports</h3>
        <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 13 }}>
          Choose the inventory workbook (.xlsx) and the Orders / Order Requests CSVs. Files are read in your browser; rows keep their original ids. Re-importing updates rows in place.
        </p>
        <input type="file" multiple accept=".xlsx,.xls,.csv" onChange={(e) => pick(e.target.files)} aria-label="Inventory export files" />
        {loaded.map((f) => {
          const r = importReport(f.records);
          return (
            <div key={f.source} style={{ marginTop: 10, fontSize: 13 }}>
              <b>{f.source}</b> — {r.total.toLocaleString()} rows ({counts(r.byKind)}). Missing name: {r.missingName}, missing catalog #: {r.missingCatalog}, repeated ids: {r.duplicateIds.length}.
            </div>
          );
        })}
        {loaded.length > 0 && <button disabled={busy} onClick={run} style={{ marginTop: 10, padding: '8px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Importing…' : 'Import into LabOS'}</button>}
      </div>

      {summary && (
        <div style={box}>
          <h3 style={{ margin: '0 0 6px' }}>In LabOS now: {summary.total.toLocaleString()} imported rows</h3>
          <div style={{ fontSize: 13 }}>{counts(summary.byKind)}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>By file: {counts(summary.bySource)} · Missing name: {summary.missingName} · Missing catalog #: {summary.missingCatalog}</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            {Object.keys(summary.bySource).map((s) => <button key={s} onClick={() => removeSource(s)} style={{ ...linkBtn, color: '#b91c1c' }}>Remove {s}</button>)}
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Requests — Ordered: {reconCount('Ordered')} · Received: {reconCount('Received')} · Stock available: {reconCount('Stock available')}</div>
        </div>
      )}

      {summary && (
        <div style={box}>
          <h3 style={{ margin: '0 0 6px' }}>Stock alerts: {alerts.length.toLocaleString()}</h3>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
            Active instances that are out of stock, under their minimum, expired or expiring within 90 days. Minimum only counts where the export has one set.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {['', ...REASONS].map((x) => (
              <button key={x} onClick={() => setAlertFilter(x)} aria-pressed={alertFilter === x} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #cbd5e1', background: alertFilter === x ? '#6366f1' : '#fff', color: alertFilter === x ? '#fff' : '#334155', cursor: 'pointer', fontSize: 12 }}>
                {x || 'All'} ({(x ? alerts.filter((a) => a.reason === x) : alerts).length})
              </button>
            ))}
            <button onClick={() => exportRows('stock-alerts.csv', alertShown, ['reason', 'name', 'vendor', 'catalog', 'category', 'location', 'amount', 'min'])} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>{['Alert', 'Name', 'Vendor', 'Catalog #', 'Location', 'Amount', ''].map((h) => <th key={h} style={{ padding: 6 }}>{h}</th>)}</tr></thead>
              <tbody>
                {alertShown.slice(0, 200).map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 6 }}>{a.reason}{a.date ? ` (${new Date(a.date).toLocaleDateString()})` : ''}</td><td style={{ padding: 6 }}>{a.name}</td><td style={{ padding: 6 }}>{a.vendor}</td>
                    <td style={{ padding: 6 }}>{a.catalog}</td><td style={{ padding: 6 }}>{a.location}</td><td style={{ padding: 6 }}>{a.amount ?? ''}{a.min !== undefined ? ` / min ${a.min}` : ''}</td>
                    <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{actions(a)}</td>
                  </tr>
                ))}
                {alertShown.length === 0 && <tr><td colSpan={7} style={{ padding: 12, color: '#64748b' }}>No alerts.</td></tr>}
              </tbody>
            </table>
          </div>
          {alertShown.length > 200 && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Showing 200 of {alertShown.length.toLocaleString()}. Export CSV for the full list.</div>}
        </div>
      )}

      <div style={box}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search items, instances, orders, requests (name, vendor, catalog #, id)" aria-label="Search imported records" style={{ flex: 1, minWidth: 220, padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Record type" style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }}>
            {KINDS.map((k) => <option key={k} value={k}>{k || 'All types'}</option>)}
          </select>
          <button onClick={() => exportRows('import-search.csv', rows)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Export CSV</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>{['Type', 'Name', 'Vendor', 'Catalog #', 'Category', 'Status', 'Id', ''].map((h) => <th key={h} style={{ padding: 6 }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 6 }}>{r.kind}</td><td style={{ padding: 6 }}>{r.name}</td><td style={{ padding: 6 }}>{r.vendor}</td>
                  <td style={{ padding: 6 }}>{r.catalog}</td><td style={{ padding: 6 }}>{r.category}</td><td style={{ padding: 6 }}>{r.status}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace', fontSize: 11 }}>{String(r.external_id).slice(0, 24)}</td>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{r.kind === 'order' ? null : actions(r)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 12, color: '#64748b' }}>No records. Import an export above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
