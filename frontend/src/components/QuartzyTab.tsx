import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { quartzyApi } from '../lib/api';
import { parseInventorySheet, parseOrders, parseRequests, importReport, type QRecord } from '../features/quartzy/parse';
import { csvCell, downloadText } from '../features/cart/cartExport';

const BATCH = 250;
const KINDS = ['', 'item', 'instance', 'order', 'request'] as const;
type Loaded = { source: string; records: QRecord[] };

/** Reads one Quartzy export in the browser. Files never leave this machine except into the lab's own database on import. */
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

export default function QuartzyTab() {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [recon, setRecon] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSummary(await quartzyApi.summary());
      setRecon(await quartzyApi.reconcile());
    } catch { /* not signed in or no access */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setTimeout(() => { quartzyApi.search({ text, kind: kind || undefined, limit: 100 }).then(setRows).catch(() => setRows([])); }, 250);
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
        const r = await quartzyApi.importBatch(f.source, f.records.slice(i, i + BATCH));
        added += r.added; updated += r.updated;
      }
      toast.success(`Imported: ${added} new, ${updated} updated`);
      setLoaded([]); await refresh();
    } catch (e: any) { toast.error(e?.data ?? e?.message ?? 'Import failed'); } finally { setBusy(false); }
  };
  const exportRows = (name: string, list: any[]) => {
    const head = ['kind', 'external_id', 'category', 'name', 'vendor', 'catalog', 'status', 'amount'];
    downloadText(name, [head.join(','), ...list.map((r) => head.map((h) => csvCell(r[h])).join(','))].join('\n'));
  };

  const box: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 };
  const counts = (o?: Record<string, number>) => Object.entries(o ?? {}).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ');
  const reconCount = (s: string) => recon.filter((r) => r.state === s).length;

  return (
    <div>
      <div style={box}>
        <h3 style={{ margin: '0 0 6px' }}>Import Quartzy exports</h3>
        <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 13 }}>
          Choose the inventory workbook (.xlsx) and the Orders / Order Requests CSVs. Files are read in your browser; rows keep their Quartzy ids. Re-importing updates rows in place.
        </p>
        <input type="file" multiple accept=".xlsx,.xls,.csv" onChange={(e) => pick(e.target.files)} aria-label="Quartzy export files" />
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
          <h3 style={{ margin: '0 0 6px' }}>In LabOS now: {summary.total.toLocaleString()} Quartzy rows</h3>
          <div style={{ fontSize: 13 }}>{counts(summary.byKind)}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>By file: {counts(summary.bySource)} · Missing name: {summary.missingName} · Missing catalog #: {summary.missingCatalog}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Requests — Ordered: {reconCount('Ordered')} · Received: {reconCount('Received')} · Stock available: {reconCount('Stock available')}</div>
        </div>
      )}

      <div style={box}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search items, instances, orders, requests (name, vendor, catalog #, id)" aria-label="Search Quartzy records" style={{ flex: 1, minWidth: 220, padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Record type" style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }}>
            {KINDS.map((k) => <option key={k} value={k}>{k || 'All types'}</option>)}
          </select>
          <button onClick={() => exportRows('quartzy-search.csv', rows)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Export CSV</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>{['Type', 'Name', 'Vendor', 'Catalog #', 'Category', 'Status', 'Id'].map((h) => <th key={h} style={{ padding: 6 }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 6 }}>{r.kind}</td><td style={{ padding: 6 }}>{r.name}</td><td style={{ padding: 6 }}>{r.vendor}</td>
                  <td style={{ padding: 6 }}>{r.catalog}</td><td style={{ padding: 6 }}>{r.category}</td><td style={{ padding: 6 }}>{r.status}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace', fontSize: 11 }}>{String(r.external_id).slice(0, 24)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 12, color: '#64748b' }}>No records. Import an export above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
