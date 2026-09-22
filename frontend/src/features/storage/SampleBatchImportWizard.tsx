import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/Modal';
import { samplesApi, storageNodesApi } from '../../lib/api';

interface SampleBatchImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  labId: string;
  unitId: string;
  onImported: () => void;
}

interface ParsedRow {
  lineNo: number;
  raw: string;
  barcode: string;
  boxName: string;
  row: number;
  col: number;
  label: string;
}

interface ResolvedRow extends ParsedRow {
  sampleId?: string;
  sampleName?: string;
  boxId?: string;
  resolveError?: string;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  lines.forEach((line, i) => {
    if (i === 0 && /^(barcode|sample)/i.test(line)) return; // skip an optional header row
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 5) return;
    const [barcode, boxName, rowStr, colStr, label] = parts;
    rows.push({ lineNo: i + 1, raw: line, barcode, boxName, row: Number(rowStr), col: Number(colStr), label });
  });
  return rows;
}

/** CSV batch placement: barcode,box_name,row,col,label per line. Reuses samples.batchValidate/batchCommit (Checkpoint B) — one atomic commit, all-or-nothing. */
export function SampleBatchImportWizard({ isOpen, onClose, labId, unitId, onImported }: SampleBatchImportWizardProps) {
  const [csv, setCsv] = useState('');
  const [resolved, setResolved] = useState<ResolvedRow[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ index: number; message: string }[]>([]);
  const [resolving, setResolving] = useState(false);
  const [committing, setCommitting] = useState(false);

  async function handleResolve() {
    const parsed = parseCsv(csv);
    if (parsed.length === 0) { toast.error('No valid rows found — expected: barcode,box_name,row,col,label'); return; }
    setResolving(true);
    setResolved(null);
    setValidationErrors([]);
    try {
      const boxesRes = await storageNodesApi.listBoxes(labId, unitId);
      const boxByName = new Map((boxesRes.data as Array<{ id: string; name: string }>).map((b) => [b.name.toLowerCase(), b.id]));

      const out: ResolvedRow[] = [];
      for (const row of parsed) {
        const boxId = boxByName.get(row.boxName.toLowerCase());
        if (!boxId) { out.push({ ...row, resolveError: `Box "${row.boxName}" not found` }); continue; }
        const barcodeRes = await samplesApi.resolveBarcode(labId, row.barcode);
        const found = (barcodeRes.data as { sample: { id: string; name: string } } | null)?.sample;
        if (!found) { out.push({ ...row, resolveError: `No sample for "${row.barcode}"` }); continue; }
        out.push({ ...row, boxId, sampleId: found.id, sampleName: found.name });
      }
      setResolved(out);

      const validRows = out.filter((r): r is ResolvedRow & { sampleId: string; boxId: string } => !r.resolveError && !!r.sampleId && !!r.boxId);
      if (validRows.length > 0) {
        const res = await samplesApi.batchValidate(
          labId,
          validRows.map((r) => ({ sampleId: r.sampleId, boxId: r.boxId, row: r.row, col: r.col, label: r.label })),
        );
        setValidationErrors((res.data as { errors: { index: number; message: string }[] }).errors);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resolve rows');
    } finally {
      setResolving(false);
    }
  }

  async function handleCommit() {
    if (!resolved) return;
    const validRows = resolved.filter((r): r is ResolvedRow & { sampleId: string; boxId: string } => !r.resolveError && !!r.sampleId && !!r.boxId);
    if (validRows.length === 0 || validationErrors.length > 0) { toast.error('Fix all rows before importing'); return; }
    setCommitting(true);
    try {
      const res = await samplesApi.batchCommit(
        labId,
        validRows.map((r) => ({ sampleId: r.sampleId, boxId: r.boxId, row: r.row, col: r.col, label: r.label })),
      );
      const result = res.data as { success: boolean; placed: string[] };
      if (result.success) {
        toast.success(`Placed ${result.placed.length} samples`);
        onImported();
        onClose();
        setCsv(''); setResolved(null); setValidationErrors([]);
      } else {
        toast.error('Import rejected — a row became invalid between validation and commit');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed — no rows were placed (all-or-nothing)');
    } finally {
      setCommitting(false);
    }
  }

  const resolveErrors = (resolved ?? []).filter((r) => r.resolveError);
  const canCommit = resolved !== null && resolveErrors.length === 0 && validationErrors.length === 0 && resolved.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch import samples" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          One row per line: <code>barcode,box_name,row,col,label</code> — e.g. <code>BC2024001,Box 1,0,0,A1</code>
        </p>
        <textarea style={{ ...inputStyle, minHeight: 140, fontFamily: 'monospace' }} value={csv} onChange={(e) => { setCsv(e.target.value); setResolved(null); }} placeholder="BC2024001,Box 1,0,0,A1&#10;BC2024002,Box 1,0,1,A2" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleResolve} disabled={resolving || !csv.trim()} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', opacity: resolving ? 0.6 : 1 }}>
            {resolving ? 'Checking…' : 'Preview'}
          </button>
        </div>

        {resolved && (
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: 6 }}>Line</th><th style={{ padding: 6 }}>Barcode</th><th style={{ padding: 6 }}>Sample</th><th style={{ padding: 6 }}>Box</th><th style={{ padding: 6 }}>Position</th><th style={{ padding: 6 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => {
                  const validationError = validationErrors.find((e) => resolved.filter((x) => !x.resolveError).indexOf(r) === e.index);
                  const error = r.resolveError ?? validationError?.message;
                  return (
                    <tr key={r.lineNo} style={{ borderBottom: '1px solid var(--border)', color: error ? '#f87171' : 'inherit' }}>
                      <td style={{ padding: 6 }}>{r.lineNo}</td>
                      <td style={{ padding: 6 }}>{r.barcode}</td>
                      <td style={{ padding: 6 }}>{r.sampleName ?? '—'}</td>
                      <td style={{ padding: 6 }}>{r.boxName}</td>
                      <td style={{ padding: 6 }}>{r.label}</td>
                      <td style={{ padding: 6 }}>{error ?? '✓ ready'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleCommit} disabled={!canCommit || committing} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: !canCommit || committing ? 0.6 : 1 }}>
            {committing ? 'Importing…' : `Import ${resolved?.filter((r) => !r.resolveError).length ?? 0} samples`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
