import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useNavigate } from '../../context/NavigationContext';

export interface Location { box_id: Id<'freezer_boxes'>; row: number; col: number }

/** Where a unit keeps things, judged by its set temperature (°C). A unit with no temperature is "Other". */
export const storageKind = (t?: number): string =>
  t === undefined ? 'Other' : t <= -150 ? 'Liquid nitrogen' : t <= -60 ? '-80 °C freezer' : t <= -10 ? '-20 °C freezer' : t <= 10 ? 'Fridge (4 °C)' : 'Room temperature';

// The last freezer, rack and box used are remembered on this computer, so the next scan is already pointing at them.
const LAST_KEY = 'labos_last_location';
const lastUsed = (): { freezer?: string; rack?: string; box?: string } => {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); } catch { return {}; }
};

const letter = (n: number) => String.fromCharCode(65 + n);
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 };

/** Freezer → rack (grouped by shelf) → box → first free position. Reports a valid choice, or null. */
export function LocationPicker({ token, onChange }: { token: string | undefined; onChange: (l: Location | null) => void }) {
  const navigate = useNavigate();
  const freezers = useQuery(api.freezer.list, token ? { token } : 'skip');
  const [freezerId, setFreezerId] = useState<Id<'freezers'> | ''>(() => (lastUsed().freezer ?? '') as Id<'freezers'> | '');
  const [kind, setKind] = useState('');
  const [rackId, setRackId] = useState('');
  const [boxId, setBoxId] = useState('');
  const [pos, setPos] = useState('');

  const kinds = [...new Set((freezers ?? []).map(f => storageKind(f.temperature)))];
  const shown = (freezers ?? []).filter(f => !kind || storageKind(f.temperature) === kind);
  const fid = (freezerId && shown.some(f => f._id === freezerId) ? freezerId : shown[0]?._id);
  const structure = useQuery(api.freezer.structure, fid && token ? { token, freezer_id: fid } : 'skip');
  const boxes = (structure?.boxes ?? []).filter(b => b.rack_id === rackId);
  const box = boxes.find(b => b._id === boxId);
  const slots = useQuery(api.freezer.boxSlots, box && token ? { token, box_id: box._id } : 'skip');

  const free = useMemo(() => {
    if (!box || !slots) return [];
    const used = new Set(slots.map(s => `${s.row}:${s.col}`));
    const out: { row: number; col: number }[] = [];
    for (let r = 0; r < box.rows; r++) for (let c = 0; c < box.cols; c++) if (!used.has(`${r}:${c}`)) out.push({ row: r, col: c });
    return out;
  }, [box, slots]);

  // Pick sensible defaults as the choices load
  useEffect(() => { setRackId(''); setBoxId(''); }, [fid]);
  useEffect(() => {
    if (!rackId && structure?.racks.length) {
      const saved = structure.racks.find(r => r._id === lastUsed().rack);
      const firstWithBox = saved ?? structure.racks.find(r => structure.boxes.some(b => b.rack_id === r._id)) ?? structure.racks[0];
      setRackId(firstWithBox._id);
    }
  }, [structure, rackId]);
  useEffect(() => { if (boxes.length && !boxes.some(b => b._id === boxId)) setBoxId((boxes.find(b => b._id === lastUsed().box) ?? boxes[0])._id); }, [boxes, boxId]);
  useEffect(() => { if (free.length && !free.some(p => `${p.row}:${p.col}` === pos)) setPos(`${free[0].row}:${free[0].col}`); }, [free, pos]);
  useEffect(() => {
    const [r, c] = pos.split(':').map(Number);
    const ok = !!box && free.some(p => p.row === r && p.col === c);
    onChange(ok ? { box_id: box._id, row: r, col: c } : null);
    if (ok && fid) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ freezer: fid, rack: rackId, box: box._id })); } catch { /* not remembered */ } }
  }, [box, pos, free, onChange, fid, rackId]);

  if (freezers === undefined) return <p style={{ color: 'var(--text-muted)' }}>Loading freezers…</p>;
  if (freezers.length === 0) return (
    <div>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 8px' }}>No freezers yet. Add a freezer with a shelf, rack and box, then scan again.</p>
      <button type="button" className="btn btn-secondary" onClick={() => navigate('freezer-biobank')}>Set up a freezer</button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
      {kinds.length > 1 && <div><label style={lbl} htmlFor="lp-k">Storage type</label>
        <select id="lp-k" className="form-select" style={{ width: '100%' }} value={kind} onChange={e => { setKind(e.target.value); setFreezerId(''); }}>
          <option value="">All</option>{kinds.map(k => <option key={k} value={k}>{k}</option>)}
        </select></div>}
      <div><label style={lbl} htmlFor="lp-f">Freezer</label>
        <select id="lp-f" className="form-select" style={{ width: '100%' }} value={fid ?? ''} onChange={e => setFreezerId(e.target.value as Id<'freezers'>)}>
          {shown.map(f => <option key={f._id} value={f._id}>{f.name}{f.temperature !== undefined ? ` (${f.temperature} °C)` : ''}</option>)}
        </select></div>
      <div><label style={lbl} htmlFor="lp-r">Shelf › rack</label>
        <select id="lp-r" className="form-select" style={{ width: '100%' }} value={rackId} onChange={e => { setRackId(e.target.value); setBoxId(''); }}>
          {structure?.shelves.map(s => (
            <optgroup key={s._id} label={s.name}>
              {structure.racks.filter(r => r.shelf_id === s._id).map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
            </optgroup>
          ))}
        </select>
        {structure && structure.racks.length === 0 && <span style={{ fontSize: 12, color: 'var(--warn-text)' }}>This freezer has no racks yet.</span>}</div>
      <div><label style={lbl} htmlFor="lp-b">Box</label>
        <select id="lp-b" className="form-select" style={{ width: '100%' }} value={boxId} onChange={e => { setBoxId(e.target.value); setPos(''); }}>
          {boxes.map(b => <option key={b._id} value={b._id}>{b.name} ({b.filled}/{b.rows * b.cols})</option>)}
        </select>
        {rackId && boxes.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--warn-text)' }}>No boxes in this rack yet.{' '}
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('freezer-biobank')}>Add a box</button>
          </span>
        )}</div>
      <div><label style={lbl} htmlFor="lp-p">Position</label>
        <select id="lp-p" className="form-select" style={{ width: '100%' }} value={pos} onChange={e => setPos(e.target.value)} disabled={!free.length}>
          {free.map(p => <option key={`${p.row}:${p.col}`} value={`${p.row}:${p.col}`}>{letter(p.row)}{p.col + 1}</option>)}
        </select>
        {box && slots && free.length === 0 && <span style={{ fontSize: 12, color: 'var(--bad-text)' }}>This box is full.</span>}</div>
    </div>
  );
}
