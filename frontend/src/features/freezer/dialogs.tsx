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

function Footer({ error, busy, disabled, confirm, onClose, danger }: { error: string; busy: boolean; disabled?: boolean; confirm: string; onClose: () => void; danger?: boolean }) {
  return (
    <>
      {error && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || disabled}
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
        <Footer error={error} busy={busy} disabled={!name.trim()} confirm={confirm} onClose={onClose} />
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
        <Footer error={error} busy={busy} disabled={!name.trim() || Number.isNaN(Number(temp))} confirm={initial ? 'Save' : 'Create freezer'} onClose={onClose} />
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
        <Footer error={error} busy={busy} disabled={!name.trim() || !valid} confirm="Create box" onClose={onClose} />
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
        <Footer error={error} busy={busy} disabled={impact === undefined} confirm="Delete" onClose={onClose} danger />
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

const ordinal = (n: number) => (n === 1 ? 'Top' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

/** Shelf: pick a ready-made name or type your own, and where it sits counted from the top. */
export function ShelfDialog({ count, initialName, onSubmit, onClose }: {
  /** Shelves already in the freezer (new shelf only). Omit when renaming. */
  count?: number; initialName?: string;
  onSubmit: (v: { name: string; position?: number }) => Promise<void>; onClose: () => void;
}) {
  const adding = count !== undefined;
  const slots = (count ?? 0) + 1;
  const [position, setPosition] = useState(slots); // 1 = top; default: new shelf goes at the bottom
  const [preset, setPreset] = useState<string>(initialName ? 'custom' : slots === 1 ? 'Top shelf' : 'numbered');
  const [custom, setCustom] = useState(initialName ?? '');
  const name = preset === 'numbered' ? `${ordinal(position)} shelf` : preset === 'custom' ? custom : preset;
  const { busy, error, run } = useSubmit(() => onSubmit({ name, position: adding ? position - 1 : undefined }), onClose);
  return (
    <Modal title={adding ? 'Add shelf' : 'Rename shelf'} onClose={onClose}>
      <form onSubmit={run}>
        {adding && (
          <div style={field}>
            <label style={label} htmlFor="sh-pos">Position from the top</label>
            <select id="sh-pos" className="form-select" style={{ width: '100%' }} value={position} onChange={e => setPosition(Number(e.target.value))}>
              {Array.from({ length: slots }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n} — {n === 1 ? 'top' : n === slots ? 'bottom' : `${ordinal(n)} from top`}</option>
              ))}
            </select>
          </div>
        )}
        <div style={field}>
          <label style={label} htmlFor="sh-name">Shelf name</label>
          <select id="sh-name" className="form-select" style={{ width: '100%' }} value={preset} onChange={e => setPreset(e.target.value)}>
            <option value="numbered">Numbered — {ordinal(position)} shelf</option>
            <option value="Top shelf">Top shelf</option>
            <option value="Middle shelf">Middle shelf</option>
            <option value="Bottom shelf">Bottom shelf</option>
            <option value="custom">Custom…</option>
          </select>
          {preset === 'custom' && (
            <input aria-label="Custom shelf name" className="form-input" style={{ width: '100%', marginTop: 8 }} autoFocus maxLength={60}
              value={custom} placeholder="Type your own name" onChange={e => setCustom(e.target.value)} />
          )}
        </div>
        <Footer error={error} busy={busy} disabled={!name.trim()} confirm={adding ? 'Add shelf' : 'Save'} onClose={onClose} />
      </form>
    </Modal>
  );
}

/** Rack: choose its number on the shelf (left to right), keep "Rack #n" or type your own name. */
export function RackDialog({ count, initialName, onSubmit, onClose }: {
  count?: number; initialName?: string;
  onSubmit: (v: { name: string; position?: number }) => Promise<void>; onClose: () => void;
}) {
  const adding = count !== undefined;
  const slots = (count ?? 0) + 1;
  const [number, setNumber] = useState(slots);
  const [custom, setCustom] = useState(!!initialName);
  const [text, setText] = useState(initialName ?? '');
  const name = custom ? text : `Rack #${number}`;
  const { busy, error, run } = useSubmit(() => onSubmit({ name, position: adding ? number - 1 : undefined }), onClose);
  return (
    <Modal title={adding ? 'Add rack' : 'Rename rack'} onClose={onClose}>
      <form onSubmit={run}>
        {adding && (
          <div style={field}>
            <label style={label} htmlFor="rk-num">Rack number</label>
            <select id="rk-num" className="form-select" style={{ width: '100%' }} value={number} onChange={e => setNumber(Number(e.target.value))}>
              {Array.from({ length: slots }, (_, i) => i + 1).map(n => <option key={n} value={n}>Rack #{n}</option>)}
            </select>
          </div>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 10 }}>
          <input type="checkbox" checked={custom} onChange={e => setCustom(e.target.checked)} /> Use a custom name
        </label>
        {custom && (
          <div style={field}>
            <label style={label} htmlFor="rk-name">Rack name</label>
            <input id="rk-name" className="form-input" style={{ width: '100%' }} autoFocus maxLength={60} value={text} placeholder="e.g. Cell lines" onChange={e => setText(e.target.value)} />
          </div>
        )}
        <Footer error={error} busy={busy} disabled={!name.trim()} confirm={adding ? 'Add rack' : 'Save'} onClose={onClose} />
      </form>
    </Modal>
  );
}

export interface QuickSetup { shelves: number; racks: number; boxes: number; rows: number; cols: number; names: string[] }

const shelfName = (i: number, n: number) => (i === 0 ? 'Top Shelf' : i === n - 1 && n > 1 ? 'Bottom Shelf' : `${ordinal(i + 1)} Shelf`);

/** Build the whole freezer in one go: shelves, racks on each shelf, and (optionally) empty boxes in every rack. */
export function QuickSetupDialog({ onSubmit, onClose }: { onSubmit: (v: QuickSetup) => Promise<void>; onClose: () => void }) {
  const [shelves, setShelves] = useState(5);
  const [racks, setRacks] = useState(4);
  const [boxes, setBoxes] = useState(0);
  const [rows, setRows] = useState(9);
  const [cols, setCols] = useState(9);
  const bad = shelves < 1 || shelves > 12 || racks < 1 || racks > 12 || boxes < 0 || boxes > 12 || rows < 1 || rows > 26 || cols < 1 || cols > 26;
  const names = Array.from({ length: shelves }, (_, i) => shelfName(i, shelves));
  const { busy, error, run } = useSubmit(() => onSubmit({ shelves, racks, boxes, rows, cols, names }), onClose);
  const num = (id: string, text: string, value: number, set: (n: number) => void, max: number, min = 1) => (
    <div style={field}>
      <label style={label} htmlFor={id}>{text}</label>
      <input id={id} type="number" min={min} max={max} className="form-input" style={{ width: '100%' }} value={value} onChange={e => set(Number(e.target.value))} />
    </div>
  );
  return (
    <Modal title="Quick setup" onClose={onClose}>
      <form onSubmit={run}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>Adds shelves (Top Shelf, 2nd Shelf, … Bottom Shelf) with racks (Rack #1, #2, …). You can rename or change anything afterwards.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {num('qs-shelves', 'Shelves', shelves, setShelves, 12)}
          {num('qs-racks', 'Racks on each shelf', racks, setRacks, 12)}
          {num('qs-boxes', 'Empty boxes in each rack', boxes, setBoxes, 12, 0)}
          <div />
          {boxes > 0 && num('qs-rows', 'Box rows', rows, setRows, 26)}
          {boxes > 0 && num('qs-cols', 'Box columns', cols, setCols, 26)}
        </div>
        <p style={{ fontSize: 13, margin: '0 0 12px' }}>This creates {shelves} shelves, {shelves * racks} racks{boxes > 0 ? ` and ${shelves * racks * boxes} boxes` : ''}.</p>
        {error && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || bad}>{busy ? 'Building…' : 'Build freezer'}</button>
        </div>
      </form>
    </Modal>
  );
}
