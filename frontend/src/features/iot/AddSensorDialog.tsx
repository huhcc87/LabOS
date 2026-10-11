import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { errText } from '../../lib/errors';
import { PRESETS, presetById } from './presets';
import { ConnectGuide } from './ConnectGuide';

const limitsOf = (q: { min_threshold?: number; max_threshold?: number; critical_min?: number; critical_max?: number }) =>
  ({ min: q.min_threshold?.toString() ?? '', max: q.max_threshold?.toString() ?? '', cmin: q.critical_min?.toString() ?? '', cmax: q.critical_max?.toString() ?? '' });
const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

export function AddSensorDialog({ token, initialPreset, onClose }: { token: string | null; initialPreset?: string; onClose: () => void }) {
  const create = useMutation(api.iot.createSensor);
  const freezers = useQuery(api.freezer.list, token ? { token } : 'skip');
  const [presetId, setPresetId] = useState(initialPreset ?? 'ult80');
  const p = presetById(presetId)!;
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [freezerId, setFreezerId] = useState('');
  const [lim, setLim] = useState(() => limitsOf(presetById(initialPreset ?? 'ult80')!));
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ key: string; preset: string } | null>(null);

  const pick = (id: string) => {
    const q = presetById(id)!;
    setPresetId(id);
    setLim(limitsOf(q));
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await create({
        token: token ?? undefined, name, sensor_type: p.sensor_type, preset: p.id, unit: p.unit || undefined,
        location: location.trim() || undefined, freezer_id: freezerId ? (freezerId as Id<'freezers'>) : undefined,
        min_threshold: num(lim.min), max_threshold: num(lim.max), critical_min: num(lim.cmin), critical_max: num(lim.cmax),
        offline_after_min: p.offline_after_min,
      });
      setMade({ key: res.api_key, preset: p.id });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const field: React.CSSProperties = { width: '100%' };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add sensor" style={{ padding: 16 }}>
      <div className="modal-panel" style={{ width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{made ? 'Sensor ready — connect the device' : 'Add a sensor'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose} aria-label="Close">{made ? 'Done' : 'Cancel'}</button>
        </div>

        {made ? (
          <>
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Sensor key — shown only now. Copy it into the device code.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 14, wordBreak: 'break-all' }}>{made.key}</code>
                <button className="btn btn-sm btn-primary" onClick={() => navigator.clipboard.writeText(made.key).then(() => toast.success('Key copied'))}>Copy key</button>
              </div>
            </div>
            <ConnectGuide presetId={made.preset} sensorKey={made.key} />
          </>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label htmlFor="sn-preset" style={{ fontSize: 13, fontWeight: 600 }}>What are you monitoring?</label>
              <select id="sn-preset" className="form-select" style={field} value={presetId} onChange={(e) => pick(e.target.value)}>
                {PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sn-name" style={{ fontSize: 13, fontWeight: 600 }}>Name *</label>
              <input id="sn-name" className="form-input" style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ULT-1 in Room 204" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label htmlFor="sn-loc" style={{ fontSize: 13, fontWeight: 600 }}>Room / location</label>
                <input id="sn-loc" className="form-input" style={field} value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <label htmlFor="sn-fz" style={{ fontSize: 13, fontWeight: 600 }}>Linked freezer (optional)</label>
                <select id="sn-fz" className="form-select" style={field} value={freezerId} onChange={(e) => setFreezerId(e.target.value)}>
                  <option value="">— none —</option>
                  {(freezers ?? []).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Alert limits ({p.unit || 'units'}) — leave blank for none</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {([['min', 'Warn below'], ['max', 'Warn above'], ['cmin', 'Critical below'], ['cmax', 'Critical above']] as const).map(([k, l]) => (
                  <div key={k}>
                    <label htmlFor={`sn-${k}`} style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</label>
                    <input id={`sn-${k}`} className="form-input" style={field} inputMode="decimal" value={lim[k]} onChange={(e) => setLim({ ...lim, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
            </fieldset>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? 'Saving…' : 'Create sensor'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
