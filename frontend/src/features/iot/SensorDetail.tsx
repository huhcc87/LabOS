import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { errText } from '../../lib/errors';
import { ago, sensorState, STATE_LABEL, STATE_STYLE } from './presets';
import { ConnectGuide } from './ConnectGuide';

export type SensorRow = Omit<Doc<'iot_sensors'>, 'api_key' | 'api_key_hash'> & { has_key: boolean };

const RANGES: Array<[string, number]> = [['6 h', 6], ['24 h', 24], ['7 days', 168], ['30 days', 720]];
const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

export function SensorDetail({ sensor, token, canManage, canDelete, onClose }: {
  sensor: SensorRow; token: string | null; canManage: boolean; canDelete: boolean; onClose: () => void;
}) {
  const t = token ?? undefined;
  const [hours, setHours] = useState(24);
  const history = useQuery(api.iot.getHistory, token ? { token, sensor_id: sensor._id as Id<'iot_sensors'>, hours } : 'skip');
  const update = useMutation(api.iot.updateSensor);
  const rotate = useMutation(api.iot.rotateKey);
  const remove = useMutation(api.iot.deleteSensor);
  const [tab, setTab] = useState<'data' | 'connect'>('data');
  const [newKey, setNewKey] = useState<string | undefined>();
  const [lim, setLim] = useState({ min: sensor.min_threshold?.toString() ?? '', max: sensor.max_threshold?.toString() ?? '', cmin: sensor.critical_min?.toString() ?? '', cmax: sensor.critical_max?.toString() ?? '' });
  const state = sensorState(sensor);
  const st = STATE_STYLE[state];
  const guard = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); } catch (e) { toast.error(errText(e)); } };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={sensor.name} style={{ padding: 16 }}>
      <div className="modal-panel" style={{ width: '100%', maxWidth: 820, maxHeight: '92vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{sensor.name}</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{[sensor.location, sensor.sensor_type].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ background: st.bg, color: st.fg, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{STATE_LABEL[state]}</span>
            <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 34, fontWeight: 700 }}>{sensor.last_reading !== undefined ? sensor.last_reading : '—'}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}> {sensor.unit}</span></span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>last reading {ago(sensor.last_reading_at)}</span>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button role="tab" aria-selected={tab === 'data'} className={`btn btn-sm ${tab === 'data' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('data')}>History &amp; limits</button>
          <button role="tab" aria-selected={tab === 'connect'} className={`btn btn-sm ${tab === 'connect' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('connect')}>Connect the device</button>
        </div>

        {tab === 'data' ? (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {RANGES.map(([label, h]) => <button key={h} className={`btn btn-sm ${hours === h ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setHours(h)}>{label}</button>)}
            </div>
            {history === undefined ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : history.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No readings in this period yet. Use “Connect the device” to start sending data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} stroke="var(--text-muted)" fontSize={11}
                    tickFormatter={(x: number) => new Date(x).toLocaleString([], hours <= 24 ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' })} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} domain={['auto', 'auto']} />
                  <Tooltip labelFormatter={(x) => new Date(Number(x)).toLocaleString()} formatter={(v) => [`${v} ${sensor.unit ?? ''}`, 'Reading']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  {sensor.max_threshold !== undefined && <ReferenceLine y={sensor.max_threshold} stroke="#f59e0b" strokeDasharray="4 4" />}
                  {sensor.min_threshold !== undefined && <ReferenceLine y={sensor.min_threshold} stroke="#f59e0b" strokeDasharray="4 4" />}
                  {sensor.critical_max !== undefined && <ReferenceLine y={sensor.critical_max} stroke="#ef4444" strokeDasharray="4 4" />}
                  {sensor.critical_min !== undefined && <ReferenceLine y={sensor.critical_min} stroke="#ef4444" strokeDasharray="4 4" />}
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {canManage && (
              <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 16 }}>
                <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Alert limits ({sensor.unit || 'units'})</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  {([['min', 'Warn below'], ['max', 'Warn above'], ['cmin', 'Critical below'], ['cmax', 'Critical above']] as const).map(([k, l]) => (
                    <div key={k}>
                      <label htmlFor={`d-${k}`} style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</label>
                      <input id={`d-${k}`} className="form-input" style={{ width: '100%' }} inputMode="decimal" value={lim[k]} onChange={(e) => setLim({ ...lim, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => guard(() => update({ token: t, id: sensor._id as Id<'iot_sensors'>, min_threshold: num(lim.min), max_threshold: num(lim.max), critical_min: num(lim.cmin), critical_max: num(lim.cmax) }), 'Limits saved')}>Save limits</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => guard(() => update({ token: t, id: sensor._id as Id<'iot_sensors'>, is_active: !sensor.is_active }), sensor.is_active ? 'Switched off' : 'Switched on')}>{sensor.is_active ? 'Switch off' : 'Switch on'}</button>
                  {canDelete && <button className="btn btn-sm btn-secondary" onClick={async () => { if (confirm(`Delete "${sensor.name}" and all its readings?`)) { await guard(() => remove({ token: t, id: sensor._id as Id<'iot_sensors'> }), 'Sensor deleted'); onClose(); } }}>Delete</button>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>Clearing a limit turns that alert off. Existing readings are kept.</p>
              </fieldset>
            )}
          </>
        ) : (
          <>
            {canManage && (
              <div style={{ marginBottom: 14 }}>
                <button className="btn btn-sm btn-secondary" onClick={async () => { if (confirm('Make a new key? The current key stops working immediately and the device must be updated.')) { try { setNewKey((await rotate({ token: t, id: sensor._id as Id<'iot_sensors'> })).api_key); toast.success('New key made — copy it into the device code'); } catch (e) { toast.error(errText(e)); } } }}>New key</button>
                {newKey && <div className="card" style={{ padding: 12, marginTop: 10 }}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shown only now:</div><code style={{ wordBreak: 'break-all' }}>{newKey}</code></div>}
              </div>
            )}
            <ConnectGuide presetId={sensor.preset} sensorKey={newKey} />
          </>
        )}
      </div>
    </div>
  );
}
