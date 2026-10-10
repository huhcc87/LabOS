import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { errText } from '../../lib/errors';

/** Plain modal: Escape and backdrop close it, focus moves in and returns on close. */
export function Modal({ title, onClose, children, width = 440 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="modal-panel" style={{ width }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text)' };
const field: React.CSSProperties = { marginBottom: 14 };

function useSubmit(onSubmit: () => Promise<void>, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try { await onSubmit(); onClose(); }
    catch (err) { setError(errText(err)); setBusy(false); }
  };
  return { busy, error, run };
}

function Footer({ error, busy, confirm, onClose, danger }: { error: string; busy: boolean; confirm: string; onClose: () => void; danger?: boolean }) {
  return (
    <>
      {error && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}
          style={danger ? { background: 'var(--bad-text)', borderColor: 'var(--bad-text)' } : undefined}>
          {busy ? 'Saving…' : confirm}
        </button>
      </div>
    </>
  );
}

/** One text field: new/rename freezer, shelf, rack or box. */
export function NameDialog({ title, fieldLabel, initial = '', placeholder, confirm, onSubmit, onClose }: {
  title: string; fieldLabel: string; initial?: string; placeholder?: string; confirm: string;
  onSubmit: (name: string) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const { busy, error, run } = useSubmit(() => onSubmit(name), onClose);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={run}>
        <div style={field}>
          <label style={label} htmlFor="dlg-name">{fieldLabel}</label>
          <input id="dlg-name" className="form-input" style={{ width: '100%' }} value={name} maxLength={60}
            placeholder={placeholder} onChange={e => setName(e.target.value)} />
        </div>
        <Footer error={error} busy={busy || !name.trim()} confirm={confirm} onClose={onClose} />
      </form>
    </Modal>
  );
}

export function FreezerDialog({ initial, onSubmit, onClose }: {
  initial?: { name: string; location?: string; temperature?: number };
  onSubmit: (v: { name: string; location?: string; temperature?: number }) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [temp, setTemp] = useState(initial?.temperature !== undefined ? String(initial.temperature) : '-80');
  const { busy, error, run } = useSubmit(
    () => onSubmit({ name, location: location.trim() || undefined, temperature: temp.trim() === '' ? undefined : Number(temp) }), onClose);
  return (
    <Modal title={initial ? 'Edit freezer' : 'New freezer'} onClose={onClose}>
      <form onSubmit={run}>
        <div style={field}>
          <label style={label} htmlFor="fz-name">Name *</label>
          <input id="fz-name" className="form-input" style={{ width: '100%' }} value={name} maxLength={60} placeholder="e.g. ULT Freezer 1" onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, ...field }}>
          <div>
            <label style={label} htmlFor="fz-loc">Location</label>
            <input id="fz-loc" className="form-input" style={{ width: '100%' }} value={location} placeholder="Room 204" onChange={e => setLocation(e.target.value)} />
          </div>
          <div>
            <label style={label} htmlFor="fz-temp">Temperature (°C)</label>
            <input id="fz-temp" className="form-input" style={{ width: '100%' }} type="number" value={temp} onChange={e => setTemp(e.target.value)} />
          </div>
        </div>
        <Footer error={error} busy={busy || !name.trim() || Number.isNaN(Number(temp))} confirm={initial ? 'Save' : 'Create freezer'} onClose={onClose} />
      </form>
    </Modal>
  );
}

const PRESETS = [{ r: 9, c: 9 }, { r: 10, c: 10 }, { r: 8, c: 12 }];

/** New box: name and its grid size. */
export function BoxDialog({ onSubmit, onClose }: { onSubmit: (v: { name: string; rows: number; cols: number }) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<number | 'custom'>(0);
  const [rows, setRows] = useState(9);
  const [cols, setCols] = useState(9);
  const size = preset === 'custom' ? { r: rows, c: cols } : PRESETS[preset];
  const valid = size.r >= 1 && size.r <= 26 && size.c >= 1 && size.c <= 26;
  const { busy, error, run } = useSubmit(() => onSubmit({ name, rows: size.r, cols: size.c }), onClose);
  return (
    <Modal title="New box" onClose={onClose}>
      <form onSubmit={run}>
        <div style={field}>
          <label style={label} htmlFor="bx-name">Box name *</label>
          <input id="bx-name" className="form-input" style={{ width: '100%' }} value={name} maxLength={60} placeholder="e.g. DNA — patient samples" onChange={e => setName(e.target.value)} />
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0, ...field }}>
          <legend style={label}>Size (rows × columns)</legend>
          {PRESETS.map((p, i) => (
            <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 14 }}>
              <input type="radio" name="size" checked={preset === i} onChange={() => setPreset(i)} /> {p.r} × {p.c}
            </label>
          ))}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="radio" name="size" checked={preset === 'custom'} onChange={() => setPreset('custom')} /> Custom
            {preset === 'custom' && (
              <>
                <input aria-label="Rows" type="number" min={1} max={26} className="form-input" style={{ width: 64 }} value={rows} onChange={e => setRows(Number(e.target.value))} />
                ×
                <input aria-label="Columns" type="number" min={1} max={26} className="form-input" style={{ width: 64 }} value={cols} onChange={e => setCols(Number(e.target.value))} />
              </>
            )}
          </label>
          {!valid && <p style={{ color: 'var(--bad-text)', fontSize: 12, margin: '6px 0 0' }}>Rows and columns must be between 1 and 26.</p>}
        </fieldset>
        <Footer error={error} busy={busy || !name.trim() || !valid} confirm="Create box" onClose={onClose} />
      </form>
    </Modal>
  );
}

/** Delete confirmation that says exactly what will disappear. */
export function ConfirmDelete({ title, what, impact, onConfirm, onClose }: {
  title: string; what: string; impact: { racks: number; boxes: number; samples: number } | undefined;
  onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const { busy, error, run } = useSubmit(onConfirm, onClose);
  const parts = impact ? [
    impact.racks ? `${impact.racks} rack${impact.racks > 1 ? 's' : ''}` : '',
    impact.boxes ? `${impact.boxes} box${impact.boxes > 1 ? 'es' : ''}` : '',
    impact.samples ? `${impact.samples} sample${impact.samples > 1 ? 's' : ''}` : '',
  ].filter(Boolean) : [];
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={run}>
        <p style={{ fontSize: 14, marginTop: 0 }}>
          Delete <strong>{what}</strong>?{' '}
          {impact === undefined ? 'Checking what it contains…'
            : parts.length ? <>This also permanently deletes {parts.join(', ')} inside it.</> : 'It is empty.'}
          {' '}This can't be undone.
        </p>
        <Footer error={error} busy={busy || impact === undefined} confirm="Delete" onClose={onClose} danger />
      </form>
    </Modal>
  );
}

export interface SampleValues {
  sample_id: string; label: string; sample_type: string; owner: string; volume: string;
  barcode: string; expiry: string; notes: string;
}
export const SAMPLE_TYPES = ['DNA', 'RNA', 'Protein', 'Serum', 'Plasma', 'FFPE', 'Cell line', 'PDX', 'Organoid', 'Reagent', 'Other'];

/** Add, edit or remove the sample at one position. */
export function SampleDialog({ position, existing, defaultOwner, initial, onSave, onDelete, onClose }: {
  position: string; existing: boolean; defaultOwner: string; initial?: SampleValues;
  onSave: (v: SampleValues) => Promise<void>; onDelete: () => Promise<void>; onClose: () => void;
}) {
  const [v, setV] = useState<SampleValues>(initial ?? { sample_id: '', label: '', sample_type: '', owner: defaultOwner, volume: '', barcode: '', expiry: '', notes: '' });
  const [confirming, setConfirming] = useState(false);
  const save = useSubmit(() => onSave(v), onClose);
  const del = useSubmit(onDelete, onClose);
  const set = (k: keyof SampleValues) => (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value }));
  const ready = !!(v.sample_id.trim() || v.label.trim());
  return (
    <Modal title={`${existing ? 'Sample' : 'Add sample'} · ${position}`} onClose={onClose} width={500}>
      <form onSubmit={save.run}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={field}><label style={label} htmlFor="s-id">Sample ID</label>
            <input id="s-id" className="form-input" style={{ width: '100%' }} value={v.sample_id} onChange={set('sample_id')} placeholder="S-00123" /></div>
          <div style={field}><label style={label} htmlFor="s-label">Name / label</label>
            <input id="s-label" className="form-input" style={{ width: '100%' }} value={v.label} onChange={set('label')} placeholder="HeLa P12" /></div>
          <div style={field}><label style={label} htmlFor="s-type">Type</label>
            <input id="s-type" className="form-input" style={{ width: '100%' }} list="sample-types" value={v.sample_type} onChange={set('sample_type')} placeholder="Pick or type your own" />
            <datalist id="sample-types">{SAMPLE_TYPES.map(t => <option key={t} value={t} />)}</datalist></div>
          <div style={field}><label style={label} htmlFor="s-owner">Owner</label>
            <input id="s-owner" className="form-input" style={{ width: '100%' }} value={v.owner} onChange={set('owner')} /></div>
          <div style={field}><label style={label} htmlFor="s-vol">Volume / amount</label>
            <input id="s-vol" className="form-input" style={{ width: '100%' }} value={v.volume} onChange={set('volume')} placeholder="200 µL" /></div>
          <div style={field}><label style={label} htmlFor="s-exp">Expiry date</label>
            <input id="s-exp" className="form-input" style={{ width: '100%' }} type="date" value={v.expiry} onChange={set('expiry')} /></div>
        </div>
        <div style={field}><label style={label} htmlFor="s-bar">Barcode</label>
          <input id="s-bar" className="form-input" style={{ width: '100%' }} value={v.barcode} onChange={set('barcode')} /></div>
        <div style={field}><label style={label} htmlFor="s-notes">Notes</label>
          <textarea id="s-notes" className="form-input" style={{ width: '100%', resize: 'vertical' }} rows={2} value={v.notes} onChange={set('notes')} /></div>
        {(save.error || del.error) && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13, margin: '0 0 12px' }}>{save.error || del.error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          {existing ? (
            confirming
              ? <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>Delete this sample?
                  <button type="button" className="btn btn-sm" style={{ background: 'var(--bad-text)', color: '#fff', border: 0 }} disabled={del.busy} onClick={() => del.run()}>Yes, delete</button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setConfirming(false)}>No</button></span>
              : <button type="button" className="btn btn-sm" style={{ background: 'var(--bad-bg)', color: 'var(--bad-text)', border: '1px solid transparent', fontWeight: 700 }} onClick={() => setConfirming(true)}>Delete sample</button>
          ) : <span />}
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={save.busy || !ready}>{save.busy ? 'Saving…' : 'Save sample'}</button>
          </span>
        </div>
      </form>
    </Modal>
  );
}
