import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../lib/utils';
import { errText } from '../lib/errors';
import { ago, presetById, sensorState, STATE_LABEL, STATE_STYLE, type SensorState } from '../features/iot/presets';
import { AddSensorDialog } from '../features/iot/AddSensorDialog';
import { SensorDetail, type SensorRow } from '../features/iot/SensorDetail';

const QUICK = ['ult80', 'f20', 'ln2temp', 'ln2level'];

export default function IoTDashboardPage() {
  const { user, token } = useAuth();
  const sensors = useQuery(api.iot.overview, token ? { token } : 'skip');
  const alerts = useQuery(api.iot.listAlerts, token ? { token, unack_only: true, limit: 8 } : 'skip');
  const freezers = useQuery(api.freezer.list, token ? { token } : 'skip');
  const ack = useMutation(api.iot.acknowledgeAlert);
  const [adding, setAdding] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const canManage = !!user && hasRole(user.role, 'staff');
  const canDelete = !!user && hasRole(user.role, 'manager');
  const rows = (sensors ?? []) as Array<SensorRow & { spark: { t: number; v: number }[] }>;
  const open = rows.find((s) => s._id === openId);
  const freezerName = (id?: string) => (freezers ?? []).find((f) => f._id === id)?.name;

  const counts = rows.reduce<Record<SensorState, number>>((a, s) => { a[sensorState(s)]++; return a; }, { ok: 0, warning: 0, critical: 0, offline: 0, nodata: 0, off: 0 });
  const chips: Array<[SensorState, number]> = [['ok', counts.ok], ['warning', counts.warning], ['critical', counts.critical], ['offline', counts.offline], ['nodata', counts.nodata]];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Sensors</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Freezers, liquid nitrogen tanks, fridges and incubators, watched around the clock.</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => setAdding('ult80')}>+ Add sensor</button>}
      </div>

      {sensors === undefined ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : rows.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>No sensors yet</h2>
          <p style={{ color: 'var(--text-muted)' }}>Add one for each freezer or tank. You get a key and the exact wiring and code for an ESP32 or Raspberry Pi, with alert limits already set.</p>
          {canManage ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {QUICK.map((id) => <button key={id} className="btn btn-secondary" onClick={() => setAdding(id)}>{presetById(id)!.label}</button>)}
              <button className="btn btn-secondary" onClick={() => setAdding('ult80')}>Other…</button>
            </div>
          ) : <p>Ask a lab manager to add sensors.</p>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {chips.filter(([, n]) => n > 0).map(([s, n]) => (
              <span key={s} style={{ background: STATE_STYLE[s].bg, color: STATE_STYLE[s].fg, padding: '5px 12px', borderRadius: 14, fontSize: 13, fontWeight: 600 }}>{n} {STATE_LABEL[s].toLowerCase()}</span>
            ))}
          </div>

          {(alerts ?? []).length > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }} role="region" aria-label="Open alerts">
              <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Open alerts</h2>
              {(alerts ?? []).map((a) => (
                <div key={a._id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ background: a.severity === 'critical' ? 'var(--bad-bg)' : 'var(--warn-bg)', color: a.severity === 'critical' ? 'var(--bad-text)' : 'var(--warn-text)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{a.severity.toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}>{a.message}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ago(a.created_at)}</span>
                  <button className="btn btn-sm btn-secondary" onClick={() => ack({ token: token ?? undefined, id: a._id as Id<'iot_alerts'> }).catch((e) => toast.error(errText(e)))}>Acknowledge</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
            {rows.map((s) => {
              const state = sensorState(s);
              const st = STATE_STYLE[state];
              const linked = freezerName(s.freezer_id);
              return (
                <button key={s._id} type="button" onClick={() => setOpenId(s._id)} aria-label={`${s.name}: ${STATE_LABEL[state]}`}
                  style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, cursor: 'pointer', color: 'var(--text)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[linked ?? s.location, presetById(s.preset)?.label].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span style={{ background: st.bg, color: st.fg, padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{STATE_LABEL[state]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 4px' }}>
                    <span style={{ fontSize: 30, fontWeight: 700 }}>{s.last_reading !== undefined ? s.last_reading : '—'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{s.unit}</span>
                  </div>
                  <div style={{ height: 36 }}>
                    {s.spark.length > 1 && (
                      <ResponsiveContainer width="100%" height={36}>
                        <LineChart data={s.spark}><YAxis hide domain={['auto', 'auto']} /><Line type="monotone" dataKey="v" stroke={st.fg} strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Updated {ago(s.last_reading_at)}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {adding && <AddSensorDialog token={token} initialPreset={adding} onClose={() => setAdding(null)} />}
      {open && <SensorDetail sensor={open} token={token} canManage={canManage} canDelete={canDelete} onClose={() => setOpenId(null)} />}
    </div>
  );
}
