export interface OccupancyStats {
  capacity: number;
  occupied: number;
  reserved: number;
  quarantined: number;
  unavailable: number;
}

export function OccupancySummary({ stats }: { stats: OccupancyStats }) {
  const used = stats.occupied + stats.reserved + stats.quarantined + stats.unavailable;
  const pct = stats.capacity > 0 ? Math.round((used / stats.capacity) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        <span>{used} / {stats.capacity} positions used</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#fbbf24' : '#4ade80', borderRadius: 3 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginTop: 6, flexWrap: 'wrap' }}>
        <span>● {stats.occupied} occupied</span>
        <span>◐ {stats.reserved} reserved</span>
        <span>▲ {stats.quarantined} quarantined</span>
        <span>✕ {stats.unavailable} unavailable</span>
      </div>
    </div>
  );
}
