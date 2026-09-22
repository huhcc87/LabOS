import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/Modal';
import Barcode from '../../components/Barcode';
import { samplesApi, storageNodesApi, storagePositionsApi } from '../../lib/api';
import { PositionGrid } from './PositionGrid';

interface SampleSummary {
  id: string;
  sample_id: string;
  name: string;
  status: string;
  checked_out_by?: string;
}

interface BoxOption {
  id: string;
  name: string;
}

interface SampleActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labId: string;
  unitId: string;
  sampleId: string;
  currentLabel: string;
  onChanged: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};

type Mode = 'menu' | 'move' | 'dispose' | 'label';

export function SampleActionsDialog({ isOpen, onClose, labId, unitId, sampleId, currentLabel, onChanged }: SampleActionsDialogProps) {
  const [mode, setMode] = useState<Mode>('menu');
  const [sample, setSample] = useState<SampleSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const [boxes, setBoxes] = useState<BoxOption[]>([]);
  const [destBoxId, setDestBoxId] = useState('');
  const [destGrid, setDestGrid] = useState<{ rows: number; cols: number; positions: any[] } | null>(null);
  const [destCell, setDestCell] = useState<{ row: number; col: number; label: string } | null>(null);

  const [disposalReason, setDisposalReason] = useState('');

  const loadSample = useCallback(async () => {
    try {
      const res = await samplesApi.get(sampleId);
      setSample(res.data as SampleSummary);
    } catch {
      setSample(null);
    }
  }, [sampleId]);

  useEffect(() => {
    if (isOpen) {
      setMode('menu');
      setDestBoxId(''); setDestGrid(null); setDestCell(null); setDisposalReason('');
      loadSample();
    }
  }, [isOpen, loadSample]);

  async function openMove() {
    setMode('move');
    try {
      const res = await storageNodesApi.listBoxes(labId, unitId);
      setBoxes(res.data as BoxOption[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load destination boxes');
    }
  }

  async function selectDestBox(boxId: string) {
    setDestBoxId(boxId);
    setDestCell(null);
    try {
      const res = await storagePositionsApi.listForBox(labId, boxId);
      setDestGrid(res.data as any);
    } catch {
      setDestGrid(null);
    }
  }

  async function handleMoveConfirm() {
    if (!destBoxId || !destCell) return;
    setBusy(true);
    try {
      await samplesApi.move(labId, sampleId, destBoxId, destCell.row, destCell.col, destCell.label);
      toast.success(`Moved to ${destCell.label}`);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed — destination may already be occupied');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckout() {
    setBusy(true);
    try {
      await samplesApi.checkout(labId, sampleId);
      toast.success('Checked out');
      onChanged();
      loadSample();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    setBusy(true);
    try {
      await samplesApi.returnSample(labId, sampleId);
      toast.success('Returned');
      onChanged();
      loadSample();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Return failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDispose() {
    if (!disposalReason.trim()) { toast.error('A disposal reason is required'); return; }
    setBusy(true);
    try {
      await samplesApi.dispose(labId, sampleId, disposalReason);
      toast.success('Sample disposed');
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dispose failed');
    } finally {
      setBusy(false);
    }
  }

  const isCheckedOut = !!sample?.checked_out_by;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={sample ? `${sample.name} — ${currentLabel}` : currentLabel} size="md">
      {mode === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sample && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sample.sample_id} · {sample.status}{isCheckedOut ? ' · checked out' : ''}</div>}
          <button type="button" onClick={() => setMode('label')} style={menuButtonStyle}>🏷️ Print label</button>
          <button type="button" onClick={openMove} style={menuButtonStyle}>📤 Move to another position</button>
          {isCheckedOut ? (
            <button type="button" onClick={handleReturn} disabled={busy} style={menuButtonStyle}>↩️ Return</button>
          ) : (
            <button type="button" onClick={handleCheckout} disabled={busy} style={menuButtonStyle}>📋 Check out</button>
          )}
          <button type="button" onClick={() => setMode('dispose')} style={{ ...menuButtonStyle, color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>🗑️ Dispose</button>
        </div>
      )}

      {mode === 'move' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }} htmlFor="dest-box">Destination box</label>
            <select id="dest-box" style={inputStyle} value={destBoxId} onChange={(e) => selectDestBox(e.target.value)}>
              <option value="">Select a box…</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {destGrid && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Click an empty position:</p>
              <PositionGrid
                rows={destGrid.rows}
                cols={destGrid.cols}
                positions={destGrid.positions}
                onCellClick={(cell) => cell.state === 'empty' && setDestCell(cell)}
              />
              {destCell && <p style={{ fontSize: 12, marginTop: 8 }}>Selected: <strong>{destCell.label}</strong></p>}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => setMode('menu')} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>Back</button>
            <button type="button" onClick={handleMoveConfirm} disabled={!destCell || busy} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: !destCell || busy ? 0.6 : 1 }}>
              {busy ? 'Moving…' : 'Confirm move'}
            </button>
          </div>
        </div>
      )}

      {mode === 'label' && sample && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .label-print-area, .label-print-area * { visibility: visible; }
              .label-print-area { position: absolute; left: 0; top: 0; }
            }
          `}</style>
          <div className="label-print-area" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#fff', color: '#111' }}>
            <Barcode value={sample.sample_id} type="barcode" width={220} height={60} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>{sample.name}</div>
            <div style={{ fontSize: 12 }}>{sample.sample_id} · {currentLabel}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" onClick={() => setMode('menu')} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>Back</button>
            <button type="button" onClick={() => setTimeout(() => window.print(), 50)} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              🖨️ Print
            </button>
          </div>
        </div>
      )}

      {mode === 'dispose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }} htmlFor="dispose-reason">Disposal reason</label>
          <textarea id="dispose-reason" style={{ ...inputStyle, minHeight: 70 }} value={disposalReason} onChange={(e) => setDisposalReason(e.target.value)} placeholder="e.g. expired, used up, contaminated" />
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>This frees the position and keeps the sample's full history — it is not a permanent delete.</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" onClick={() => setMode('menu')} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>Back</button>
            <button type="button" onClick={handleDispose} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Disposing…' : 'Confirm dispose'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const menuButtonStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text)',
};
