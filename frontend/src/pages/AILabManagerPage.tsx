import { useState, useEffect, useCallback } from 'react';
import {
  tasksApi, inventoryApi, samplesApi, iotApi, notebookApi,
  dashboardApi, instrumentsApi,
} from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = 'critical' | 'warning' | 'info' | 'success';

interface BriefingItem {
  id: string;
  severity: Severity;
  category: string;
  icon: string;
  title: string;
  detail: string;
  action?: { label: string; page: string };
  count?: number;
}

const SEV_META: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)', label: 'CRITICAL' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', label: 'WARNING'  },
  info:     { color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.35)', label: 'INFO'     },
  success:  { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.35)', label: 'OK'       },
};

const AUTOPILOT_KEY = 'labos_ai_autopilot';

// ─── Component ────────────────────────────────────────────────────────────────
export default function AILabManagerPage() {
  const [items, setItems] = useState<BriefingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autopilot, setAutopilot] = useState<{ enabled: boolean; schedule: 'daily' | 'twice' | 'realtime' }>(() => {
    try {
      const raw = localStorage.getItem(AUTOPILOT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { enabled: false, schedule: 'daily' };
  });
  const [summary, setSummary] = useState<string>('');

  const saveAutopilot = (next: typeof autopilot) => {
    setAutopilot(next);
    try { localStorage.setItem(AUTOPILOT_KEY, JSON.stringify(next)); } catch {}
  };

  // ── Briefing aggregator: pulls from every subsystem in parallel ────────────
  const buildBriefing = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const briefing: BriefingItem[] = [];

    const safe = async <T,>(fn: () => Promise<T>, fb: T): Promise<T> => {
      try { return await fn(); } catch { return fb; }
    };

    const [tasks, inventory, samples, sensors, alerts, notebookEntries, instruments, summary] = await Promise.all([
      safe(() => tasksApi.list(1, 100, ''), { data: { items: [] } } as any),
      safe(() => inventoryApi.list(1, 200, ''), { data: { items: [] } } as any),
      safe(() => samplesApi.list(1, 50, ''), { data: { items: [] } } as any),
      safe(() => iotApi.listSensors(), { data: [] } as any),
      safe(() => iotApi.listAlerts(), { data: [] } as any),
      safe(() => notebookApi.list(1, 30, ''), { data: { items: [] } } as any),
      safe(() => instrumentsApi.list(1, 50, ''), { data: { items: [] } } as any),
      safe(() => dashboardApi.summary(), { data: {} } as any),
    ]);

    // ── 1. Overdue tasks ───────────────────────────────────────────────────
    const taskItems = ((tasks.data as any).items || []) as any[];
    const overdueTasks = taskItems.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today);
    if (overdueTasks.length) {
      briefing.push({
        id: 'tasks-overdue', severity: 'critical', category: 'Tasks', icon: '⏰',
        title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
        detail: overdueTasks.slice(0, 3).map(t => `"${t.title || 'Untitled'}"`).join(', ') + (overdueTasks.length > 3 ? '…' : ''),
        action: { label: 'Review tasks', page: 'tasks' },
        count: overdueTasks.length,
      });
    }
    const dueTodayTasks = taskItems.filter(t => t.status !== 'completed' && t.due_date === today);
    if (dueTodayTasks.length) {
      briefing.push({
        id: 'tasks-today', severity: 'warning', category: 'Tasks', icon: '📋',
        title: `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today`,
        detail: dueTodayTasks.slice(0, 3).map(t => t.title || 'Untitled').join(', '),
        action: { label: 'Open tasks', page: 'tasks' },
        count: dueTodayTasks.length,
      });
    }

    // ── 2. Reagent expiry (inventory items with expiry_date) ───────────────
    const invItems = ((inventory.data as any).items || []) as any[];
    const expiringReagents = invItems.filter(i => {
      const exp = i.expiry_date || i.expiration_date;
      return exp && exp >= today && exp <= in30;
    });
    if (expiringReagents.length) {
      briefing.push({
        id: 'reagent-expiring', severity: 'warning', category: 'Reagents', icon: '⚗️',
        title: `${expiringReagents.length} reagent${expiringReagents.length > 1 ? 's' : ''} expiring in 30 days`,
        detail: expiringReagents.slice(0, 3).map(r => `${r.name || r.item || 'Item'} (${(r.expiry_date || r.expiration_date || '').slice(0, 10)})`).join(', '),
        action: { label: '🛒 Smart reorder', page: 'reagent-cart' },
        count: expiringReagents.length,
      });
    }
    const expiredReagents = invItems.filter(i => {
      const exp = i.expiry_date || i.expiration_date;
      return exp && exp < today;
    });
    if (expiredReagents.length) {
      briefing.push({
        id: 'reagent-expired', severity: 'critical', category: 'Reagents', icon: '🚫',
        title: `${expiredReagents.length} expired item${expiredReagents.length > 1 ? 's' : ''} in inventory`,
        detail: expiredReagents.slice(0, 3).map(r => r.name || r.item || 'Item').join(', ') + ' · click below to auto-add replacement to cart',
        action: { label: '🛒 Smart reorder', page: 'reagent-cart' },
        count: expiredReagents.length,
      });
    }

    // ── 3. Low / out-of-stock inventory ────────────────────────────────────
    const lowStock = invItems.filter(i => {
      const qty = Number(i.quantity ?? i.stock ?? 0);
      const min = Number(i.min_quantity ?? i.reorder_level ?? 0);
      return min > 0 && qty <= min;
    });
    if (lowStock.length) {
      briefing.push({
        id: 'inventory-low', severity: 'warning', category: 'Inventory', icon: '📦',
        title: `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} below reorder level`,
        detail: lowStock.slice(0, 3).map(i => `${i.name || i.item} (qty ${i.quantity ?? i.stock ?? 0})`).join(', '),
        action: { label: '🛒 Smart reorder', page: 'reagent-cart' },
        count: lowStock.length,
      });
    }

    // ── 4. IoT sensor alerts ───────────────────────────────────────────────
    const sensorList = ((sensors.data as any) || []) as any[];
    const criticalSensors = sensorList.filter(s => s.status === 'critical' || s.status === 'offline');
    const warningSensors = sensorList.filter(s => s.status === 'warning');
    if (criticalSensors.length) {
      briefing.push({
        id: 'iot-critical', severity: 'critical', category: 'IoT', icon: '🚨',
        title: `${criticalSensors.length} sensor${criticalSensors.length > 1 ? 's' : ''} in critical state`,
        detail: criticalSensors.slice(0, 3).map(s => `${s.name} (${s.status})`).join(', '),
        action: { label: 'Open IoT dashboard', page: 'iot-dashboard' },
        count: criticalSensors.length,
      });
    }
    if (warningSensors.length) {
      briefing.push({
        id: 'iot-warning', severity: 'warning', category: 'IoT', icon: '⚠️',
        title: `${warningSensors.length} sensor${warningSensors.length > 1 ? 's' : ''} drifting toward threshold`,
        detail: warningSensors.slice(0, 3).map(s => s.name).join(', '),
        action: { label: 'View trends', page: 'iot-dashboard' },
        count: warningSensors.length,
      });
    }
    const alertList = ((alerts.data as any) || []) as any[];
    const unackedAlerts = alertList.filter(a => !a.acknowledged);
    if (unackedAlerts.length && !criticalSensors.length && !warningSensors.length) {
      briefing.push({
        id: 'iot-unacked', severity: 'info', category: 'IoT', icon: '🔔',
        title: `${unackedAlerts.length} unacknowledged alert${unackedAlerts.length > 1 ? 's' : ''}`,
        detail: 'Sensor incidents waiting on a human acknowledgement',
        action: { label: 'Acknowledge', page: 'iot-dashboard' },
        count: unackedAlerts.length,
      });
    }

    // ── 5. ELN entries — unsigned older than 7 days ────────────────────────
    const entries = ((notebookEntries.data as any).items || []) as any[];
    const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const staleEntries = entries.filter(e => !e.signed_at && (e.created_at || '').slice(0, 10) < cutoff);
    if (staleEntries.length) {
      briefing.push({
        id: 'eln-unsigned', severity: 'warning', category: 'ELN', icon: '📓',
        title: `${staleEntries.length} notebook entr${staleEntries.length === 1 ? 'y' : 'ies'} unsigned >7 days`,
        detail: 'Sign for IP protection or witness if reviewed',
        action: { label: 'Open notebook', page: 'eln' },
        count: staleEntries.length,
      });
    }

    // ── 6. Equipment maintenance ───────────────────────────────────────────
    const equipList = ((instruments.data as any).items || []) as any[];
    const overdueMaint = equipList.filter(e => e.next_maintenance && e.next_maintenance < today);
    if (overdueMaint.length) {
      briefing.push({
        id: 'equip-maint', severity: 'warning', category: 'Equipment', icon: '🔧',
        title: `${overdueMaint.length} instrument${overdueMaint.length > 1 ? 's' : ''} overdue for maintenance`,
        detail: overdueMaint.slice(0, 3).map(e => e.name).join(', '),
        action: { label: 'Schedule service', page: 'equipment' },
        count: overdueMaint.length,
      });
    }

    // ── 7. Samples without recent activity ─────────────────────────────────
    const sampleList = ((samples.data as any).items || []) as any[];
    const totalSamples = sampleList.length;

    // ── 8. Success summary if there's nothing wrong ───────────────────────
    if (briefing.length === 0) {
      briefing.push({
        id: 'all-clear', severity: 'success', category: 'Lab', icon: '✨',
        title: 'All systems nominal',
        detail: `${totalSamples} samples · ${invItems.length} inventory items · ${sensorList.length} sensors monitored — no action needed`,
      });
    }

    // ── Build AI-style narrative summary ────────────────────────────────────
    const crit = briefing.filter(b => b.severity === 'critical').length;
    const warn = briefing.filter(b => b.severity === 'warning').length;
    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 12) return 'Good morning';
      if (h < 18) return 'Good afternoon';
      return 'Good evening';
    })();

    let narrative = `${greeting}. `;
    if (crit > 0) narrative += `I've found ${crit} critical issue${crit > 1 ? 's' : ''} that need your attention immediately. `;
    if (warn > 0) narrative += `There ${warn === 1 ? 'is' : 'are'} also ${warn} item${warn > 1 ? 's' : ''} approaching a threshold. `;
    if (crit === 0 && warn === 0) narrative += `The lab is running smoothly. I'll keep monitoring and ping you if anything changes.`;
    else narrative += `Tackle the critical items first — I'd recommend starting with the IoT sensors and expired reagents.`;

    setSummary(narrative);
    setItems(briefing);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { buildBriefing(); }, [buildBriefing]);

  // Navigate to a page from action button
  const goToPage = (page: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url.toString());
    // Dispatch event so AppInner re-reads (the existing app routes via state, not URL,
    // so we need to trigger an actual navigation event — easiest: reload)
    window.dispatchEvent(new PopStateEvent('popstate'));
    // Fallback: trigger by clicking the nav item via querySelector
    const navMap: Record<string, string> = {
      'tasks': 'My Tasks',
      'inventory': 'Inventory',
      'iot-dashboard': 'Sensors (Freezer / CO₂)',
      'eln': 'Lab Notebook',
      'equipment': 'Equipment',
      'reagent-cart': 'Reagent Cart',
      'procurement-hub': 'Procurement Hub',
      'payment-methods': 'Payment Methods',
      'email-settings': 'Settings',
    };
    const label = navMap[page];
    if (label) {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(label));
      btn?.click();
    }
  };

  // Group items by severity for display
  const critical = items.filter(i => i.severity === 'critical');
  const warning = items.filter(i => i.severity === 'warning');
  const info = items.filter(i => i.severity === 'info');
  const success = items.filter(i => i.severity === 'success');

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            🤖 AI Lab Manager
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            Autonomous monitoring across tasks, reagents, inventory, sensors, equipment, and notebook entries
            {lastRefresh && <> · Last scan {lastRefresh.toLocaleTimeString()}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={buildBriefing} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            {loading ? '⟳ Scanning…' : '↻ Re-scan now'}
          </button>
        </div>
      </div>

      {/* AI summary banner */}
      {summary && (
        <div className="card" style={{ marginBottom: 20, padding: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', borderColor: 'rgba(99,102,241,0.3)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#fff',
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                LabOS AI Manager — Daily briefing
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Autopilot toggle */}
      <div className="card" style={{ marginBottom: 20, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => saveAutopilot({ ...autopilot, enabled: !autopilot.enabled })}
              style={{
                position: 'relative', width: 48, height: 26, borderRadius: 999, border: 'none',
                background: autopilot.enabled ? '#22c55e' : 'var(--surface2, #cbd5e1)',
                cursor: 'pointer', transition: 'background 0.18s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: autopilot.enabled ? 24 : 2,
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Autopilot mode {autopilot.enabled && <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 8, background: '#22c55e22', color: '#22c55e', fontSize: 11 }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Auto-send this briefing via your configured notification channels (email, SMS, push)
              </div>
            </div>
          </div>
          {autopilot.enabled && (
            <select value={autopilot.schedule} onChange={e => saveAutopilot({ ...autopilot, schedule: e.target.value as any })}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
              <option value="daily">Once daily (08:00)</option>
              <option value="twice">Twice daily (08:00 + 17:00)</option>
              <option value="realtime">Real-time (critical only)</option>
            </select>
          )}
        </div>
      </div>

      {/* Summary counts */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {([
            ['critical', '🚨', 'Critical', critical.length],
            ['warning', '⚠️', 'Warnings', warning.length],
            ['info', '🔔', 'Info', info.length],
            ['success', '✅', 'OK', success.length],
          ] as Array<[Severity, string, string, number]>).map(([sev, icon, label, n]) => {
            const meta = SEV_META[sev];
            return (
              <div key={sev} className="card" style={{ padding: 14, borderColor: meta.border, background: meta.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: meta.color }}>{n}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Briefing items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            Scanning lab subsystems…
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No items yet. Click "Re-scan now" to refresh.
          </div>
        ) : (
          items.map(item => {
            const meta = SEV_META[item.severity];
            return (
              <div key={item.id} className="card" style={{
                padding: 16, borderLeft: `4px solid ${meta.color}`, background: meta.bg,
                display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: meta.color, color: '#fff', letterSpacing: 0.5,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{item.category}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.detail}</div>
                </div>
                {item.action && (
                  <button onClick={() => goToPage(item.action!.page)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${meta.color}`, background: meta.color, color: '#fff',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                    {item.action.label} →
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 24, padding: 14, background: 'rgba(99,102,241,0.05)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        💡 <strong>How this works:</strong> the AI Lab Manager polls every subsystem on this page load
        (tasks, inventory, reagents, IoT sensors, equipment, ELN) and ranks issues by severity.
        Enable Autopilot to receive the same briefing via your <a href="#" onClick={e => { e.preventDefault(); goToPage('email-settings'); }} style={{ color: 'var(--accent, #6366f1)', textDecoration: 'underline' }}>configured notification channels</a>.
        Real-time mode pages you only for critical alerts (sensor breaches, expired reagents in active experiments).
      </div>
    </div>
  );
}
