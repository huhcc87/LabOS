import { useState, useEffect } from 'react';
import { API_BASE_URL as API } from '../lib/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

interface Conflict {
  instrument_id: number;
  instrument_name: string;
  booking_a: { id: number; start: string; end: string; user_id: number; purpose: string };
  booking_b: { id: number; start: string; end: string; user_id: number; purpose: string };
}

interface InstrumentUtil {
  instrument_id: number;
  instrument_name: string;
  total_bookings: number;
  total_hours: number;
  by_day: Record<string, number>;
}

interface UtilizationData {
  days: number;
  instruments: InstrumentUtil[];
  heatmap: Record<string, number>;
  total_bookings: number;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6'];

export default function EquipmentAnalyticsPage() {
  const [tab, setTab] = useState<'conflicts' | 'utilization'>('conflicts');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [utilization, setUtilization] = useState<UtilizationData | null>(null);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [loadingUtil, setLoadingUtil] = useState(false);
  const [days, setDays] = useState(30);

  const loadConflicts = async () => {
    setLoadingConflicts(true);
    const r = await fetch(`${API}/scheduling/bookings/conflicts`, { headers: authHeaders() });
    if (r.ok) setConflicts((await r.json()).conflicts ?? []);
    setLoadingConflicts(false);
  };

  const loadUtilization = async () => {
    setLoadingUtil(true);
    const r = await fetch(`${API}/scheduling/bookings/utilization?days=${days}`, { headers: authHeaders() });
    if (r.ok) setUtilization(await r.json());
    setLoadingUtil(false);
  };

  useEffect(() => { loadConflicts(); }, []);
  useEffect(() => { if (tab === 'utilization') loadUtilization(); }, [tab, days]);

  // Build heatmap dates: last N days
  const getHeatmapDates = (n: number) => {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  };

  const maxHeat = utilization ? Math.max(1, ...Object.values(utilization.heatmap)) : 1;

  const formatDT = (s: string) => {
    try { return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return s; }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Equipment Analytics</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Booking conflict detection and utilization heatmap
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'conflicts', label: `⚠ Conflicts${conflicts.length ? ` (${conflicts.length})` : ''}` },
          { key: 'utilization', label: '📊 Utilization Heatmap' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#6366f1' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
              fontSize: 14,
            }}>{t.label}</button>
        ))}
      </div>

      {/* Conflicts tab */}
      {tab === 'conflicts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Scanning all upcoming reserved bookings for time overlaps on the same instrument.
            </div>
            <button onClick={loadConflicts} disabled={loadingConflicts}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
              {loadingConflicts ? '⟳ Scanning…' : '⟳ Re-scan'}
            </button>
          </div>

          {conflicts.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>No conflicts detected</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>All upcoming bookings have non-overlapping time windows.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {conflicts.map((c, i) => (
                <div key={i} className="card" style={{ padding: 20, border: '1px solid #ef444444', background: 'rgba(239,68,68,.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>⚠</span>
                    <div>
                      <span style={{ fontWeight: 700 }}>{c.instrument_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>has an overlapping booking</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[c.booking_a, c.booking_b].map((bk, bi) => (
                      <div key={bi} style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bg-surface, rgba(0,0,0,.04))' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>BOOKING #{bk.id}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{bk.purpose}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatDT(bk.start)} → {formatDT(bk.end)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Utilization tab */}
      {tab === 'utilization' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {utilization ? `${utilization.total_bookings} bookings in the last ${days} days` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Window:</span>
              {[7, 14, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12,
                    background: days === d ? '#6366f1' : 'none', color: days === d ? '#fff' : 'var(--text)' }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {loadingUtil ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading utilization data…</div>
          ) : !utilization ? null : (
            <>
              {/* Activity heatmap */}
              <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Daily Booking Activity</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {getHeatmapDates(days).map(date => {
                    const count = utilization.heatmap[date] ?? 0;
                    const intensity = count / maxHeat;
                    const bg = count === 0
                      ? 'var(--bg-surface, rgba(0,0,0,.05))'
                      : `rgba(99,102,241,${0.15 + intensity * 0.85})`;
                    return (
                      <div key={date} title={`${date}: ${count} booking(s)`}
                        style={{ width: 18, height: 18, borderRadius: 3, background: bg, cursor: 'default' }} />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Less</span>
                  {[0, .2, .4, .6, .8, 1].map(v => (
                    <div key={v} style={{ width: 14, height: 14, borderRadius: 2, background: v === 0 ? 'var(--bg-surface, rgba(0,0,0,.05))' : `rgba(99,102,241,${0.15 + v * 0.85})` }} />
                  ))}
                  <span>More</span>
                </div>
              </div>

              {/* Per-instrument bars */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Instrument Utilization</h3>
                {utilization.instruments.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No bookings in this period.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {utilization.instruments.map((instr, i) => {
                      const maxH = Math.max(...utilization.instruments.map(x => x.total_hours), 1);
                      const pct = (instr.total_hours / maxH) * 100;
                      return (
                        <div key={instr.instrument_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                            <span style={{ fontWeight: 500 }}>{instr.instrument_name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              {instr.total_bookings} booking{instr.total_bookings !== 1 ? 's' : ''} · {instr.total_hours.toFixed(1)}h
                            </span>
                          </div>
                          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-surface, rgba(0,0,0,.08))' }}>
                            <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: COLORS[i % COLORS.length], transition: 'width .3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
