import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area,
} from 'recharts';
import toast from 'react-hot-toast';
import { dashboardApi, tasksApi, instrumentsApi, iotApi, freezerApi, grantSubmissionsApi } from '../lib/api';
import type { DashboardSummary } from '../lib/types';
import { formatDateTime, statusColor } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../context/NavigationContext';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function computeHealthScore(s: DashboardSummary): number {
  let score = 100;
  score -= Math.min((s.overdue_tasks ?? 0) * 8, 24);
  score -= Math.min(((s.incidents_by_severity as any)?.critical ?? 0) * 15, 20);
  score -= Math.min((s.upcoming_maintenance ?? 0) * 5, 15);
  return Math.max(0, Math.round(score));
}

function HealthRing({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#6366f1' : score >= 60 ? '#f59e0b' : '#ef4444';
  const grade = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Attention';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--surface2)" strokeWidth={9} />
        <circle
          cx={55} cy={55} r={r} fill="none"
          stroke={color} strokeWidth={9}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x={55} y={50} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontSize={20} fontWeight={700}>{score}</text>
        <text x={55} y={68} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" fontSize={9}>/ 100</text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{grade}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lab Health Score</div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { icon: '🧪', label: 'New Sample', desc: 'Register a sample', page: 'samples', color: '#6366f1' },
  { icon: '📅', label: 'Book Equipment', desc: 'Schedule instrument time', page: 'protocols', color: '#22c55e' },
  { icon: '📋', label: 'New Protocol', desc: 'Draft a protocol', page: 'protocols', color: '#f59e0b' },
  { icon: '✓', label: 'Add Task', desc: 'Create a task', page: 'tasks', color: '#38bdf8' },
  { icon: '📝', label: 'Write Grant', desc: 'AI-assisted drafting', page: 'grants', color: '#8b5cf6' },
  { icon: '⚠', label: 'Report Incident', desc: 'Log a safety event', page: 'incidents', color: '#ef4444' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [equipmentAtRisk, setEquipmentAtRisk] = useState<any[]>([]);
  const [expiringItems, setExpiringItems] = useState<any[]>([]);
  const [grantDeadlines, setGrantDeadlines] = useState<any[]>([]);
  const [sensorAlerts, setSensorAlerts] = useState<any[]>([]);
  const [sensorSparkData, setSensorSparkData] = useState<{ name: string; value: number }[]>([]);

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    Promise.all([
      dashboardApi.summary(),
      tasksApi.list(1, 50, ''),
      instrumentsApi.list(1, 50, '').catch(() => ({ data: { items: [] } })),
      iotApi.listAlerts(true).catch(() => ({ data: [] })),
      freezerApi.getExpiring(14).catch(() => ({ data: [] })),
      grantSubmissionsApi.list(1, 20).catch(() => ({ data: { items: [] } })),
    ])
      .then(([summaryRes, tasksRes, instrRes, alertsRes, expiringRes, grantsRes]) => {
        setSummary(summaryRes.data);
        const tasks = (tasksRes.data as any).items || [];
        setTodayTasks(tasks.filter((t: any) =>
          t.due_date === today || t.status === 'overdue'
        ).slice(0, 8));
        setLastRefreshed(new Date());

        // Equipment at risk: overdue maintenance or critical status
        const instruments: any[] = (instrRes.data as any).items || [];
        setEquipmentAtRisk(instruments.filter((i: any) =>
          i.status === 'maintenance_due' || i.status === 'offline' ||
          (i.next_maintenance_date && i.next_maintenance_date <= in30)
        ).slice(0, 4));

        // Sensor alerts (unacknowledged)
        const alerts: any[] = Array.isArray(alertsRes.data) ? alertsRes.data : [];
        setSensorAlerts(alerts.slice(0, 5));
        setSensorSparkData(alerts.slice(0, 20).map((a: any, idx: number) => ({
          name: String(idx),
          value: a.level === 'critical' ? 3 : a.level === 'warning' ? 2 : 1,
        })));

        // Expiring freezer samples
        const expiring: any[] = Array.isArray(expiringRes.data) ? expiringRes.data : [];
        setExpiringItems(expiring.slice(0, 4));

        // Grant deadlines within 30 days
        const grants: any[] = (grantsRes.data as any).items || [];
        setGrantDeadlines(grants.filter((g: any) =>
          g.deadline_date && g.deadline_date >= today && g.deadline_date <= in30
        ).slice(0, 4));
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => load(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 16, color: 'var(--text-muted)' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>⬡</div>
      <div style={{ fontSize: 15 }}>Loading your research command center...</div>
    </div>
  );
  if (!summary) return <div style={{ color: 'var(--danger)', padding: 32 }}>Failed to load dashboard.</div>;

  const healthScore = computeHealthScore(summary);
  const taskData = Object.entries(summary.tasks_by_status).map(([name, value]) => ({ name, value }));
  const incidentData = Object.entries(summary.incidents_by_severity).map(([name, value]) => ({ name, value }));
  const sampleData = Object.entries(summary.samples_by_status).map(([name, value]) => ({ name, value }));
  const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };
  const axisStyle = { fill: 'var(--text-muted)', fontSize: 11 };

  const criticalCount = (summary.incidents_by_severity as any)?.critical ?? 0;

  type Priority = { icon: string; label: string; count: number; color: string; severity: 'high' | 'medium' | 'low' };
  const priorities: Priority[] = (
    [
      summary.overdue_tasks > 0 ? { icon: '⚠', label: 'Overdue Tasks', count: summary.overdue_tasks, color: '#ef4444', severity: 'high' } : null,
      criticalCount > 0 ? { icon: '🚨', label: 'Critical Incidents', count: criticalCount, color: '#ef4444', severity: 'high' } : null,
      summary.upcoming_maintenance > 0 ? { icon: '🔧', label: 'Maintenance Due', count: summary.upcoming_maintenance, color: '#f59e0b', severity: 'medium' } : null,
      summary.reminders_pending > 0 ? { icon: '🔔', label: 'Pending Reminders', count: summary.reminders_pending, color: '#6366f1', severity: 'low' } : null,
      (summary as any).low_stock_items > 0 ? { icon: '📦', label: 'Low Stock Items', count: (summary as any).low_stock_items, color: '#f59e0b', severity: 'medium' } : null,
    ] as (Priority | null)[]
  ).filter((p): p is Priority => p !== null);

  const PULSE_STATS = [
    { key: 'samples', label: 'Samples', icon: '🧪', color: '#6366f1', page: 'samples' },
    { key: 'instruments', label: 'Instruments', icon: '🔬', color: '#8b5cf6', page: 'protocols' },
    { key: 'protocols', label: 'Protocols', icon: '📋', color: '#22c55e', page: 'protocols' },
    { key: 'tasks_open', label: 'Open Tasks', icon: '✓', color: '#f59e0b', page: 'tasks' },
    { key: 'inventory_items', label: 'Inventory Items', icon: '📦', color: '#06b6d4', page: 'inventory' },
    { key: 'training_records', label: 'Training Records', icon: '🎓', color: '#ec4899', page: 'incidents' },
    { key: 'workspaces', label: 'Workspaces', icon: '🏗', color: '#10b981', page: 'workspaces' },
    { key: 'calendar_events', label: 'Calendar Events', icon: '🗓', color: '#38bdf8', page: 'calendar' },
  ];

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>
            {todayLabel()}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>
            {greeting()}, {user?.full_name?.split(' ')[0] ?? 'Researcher'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 480 }}>
            {priorities.length === 0
              ? 'Your lab is running smoothly. Great work keeping everything on track.'
              : `You have ${priorities.length} item${priorities.length > 1 ? 's' : ''} that need${priorities.length === 1 ? 's' : ''} attention today.`}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
            >
              {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · auto-refreshes every 5 min
            </span>
            <button onClick={() => navigate('tasks')} className="btn btn-sm" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
              View Tasks
            </button>
            <button onClick={() => navigate('grants')} className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
              Grant Hub
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <HealthRing score={healthScore} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
            {[
              { label: 'Compliance Rate', value: criticalCount === 0 ? '100%' : `${Math.max(0, 100 - criticalCount * 10)}%`, color: criticalCount === 0 ? '#22c55e' : '#ef4444' },
              { label: 'Open Tasks', value: String(summary.tasks_open ?? 0), color: '#f59e0b' },
              { label: 'Active Samples', value: String(summary.samples ?? 0), color: '#6366f1' },
            ].map(stat => (
              <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Priority Alerts ── */}
      {priorities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {priorities.map((p, i) => (
            <div key={i} style={{
              background: p.severity === 'high' ? 'rgba(239,68,68,0.08)' : p.severity === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)',
              border: `1px solid ${p.color}40`,
              borderLeft: `4px solid ${p.color}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: p.color }}>{p.count} {p.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {p.severity === 'high' ? '— requires immediate attention' : p.severity === 'medium' ? '— action recommended' : '— scheduled for delivery'}
                  </span>
                </div>
              </div>
              <button onClick={() => navigate(p.label.includes('Task') ? 'tasks' : p.label.includes('Incident') ? 'incidents' : p.label.includes('Maintenance') ? 'protocols' : 'reminders')}
                style={{ fontSize: 12, background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                View →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Research Pulse (key metrics) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {PULSE_STATS.slice(0, 4).map(stat => {
          const val = (summary as any)[stat.key] ?? 0;
          return (
            <button key={stat.key} onClick={() => navigate(stat.page)}
              style={{ all: 'unset', cursor: 'pointer' }}>
              <div className="card" style={{
                padding: '20px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: '1px solid var(--border)',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: `${stat.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  {stat.icon}
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Smart Lab Intelligence ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>

        {/* Equipment Health */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>🔬</span>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Equipment Health</h3>
            {equipmentAtRisk.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: 10, padding: '2px 8px' }}>
                {equipmentAtRisk.length} at risk
              </span>
            )}
          </div>
          {equipmentAtRisk.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
              All equipment healthy ✓
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {equipmentAtRisk.map((eq: any) => {
                const isOffline = eq.status === 'offline';
                const color = isOffline ? '#ef4444' : '#f59e0b';
                return (
                  <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: `${color}12`, borderRadius: 7, borderLeft: `3px solid ${color}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {eq.next_maintenance_date ? `Maint: ${eq.next_maintenance_date}` : eq.status}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' }}>{isOffline ? 'Offline' : 'Due'}</span>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => navigate('protocols')} style={{ marginTop: 10, width: '100%', padding: '5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            View All Equipment →
          </button>
        </div>

        {/* Inventory Risk */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Inventory Risk</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Low Stock', value: (summary as any).low_stock_items ?? 0, color: '#f59e0b', icon: '⚠' },
              { label: 'Expiring Soon', value: expiringItems.length, color: '#ef4444', icon: '⏰' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '10px 6px', background: `${s.color}12`, borderRadius: 8, border: `1px solid ${s.color}30` }}>
                <div style={{ fontSize: 11 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {expiringItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {expiringItems.slice(0, 3).map((slot: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: '#ef4444', background: '#ef444410', borderRadius: 5, padding: '4px 8px' }}>
                  {slot.sample_label ?? slot.barcode ?? `Slot ${slot.id}`} — expires {slot.expiry_date}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('inventory')} style={{ marginTop: 10, width: '100%', padding: '5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            Manage Inventory →
          </button>
        </div>

        {/* Grant Deadlines */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>📝</span>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Grant Deadlines</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>next 30 days</span>
          </div>
          {grantDeadlines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 12 }}>
              No grant deadlines in the next 30 days
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {grantDeadlines.map((g: any) => {
                const daysLeft = Math.ceil((new Date(g.deadline_date).getTime() - Date.now()) / 86_400_000);
                const color = daysLeft <= 7 ? '#ef4444' : daysLeft <= 14 ? '#f59e0b' : '#22c55e';
                return (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: `${color}10`, borderRadius: 7, borderLeft: `3px solid ${color}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title ?? g.grant_type}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{g.deadline_date}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color, whiteSpace: 'nowrap' }}>{daysLeft}d</span>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => navigate('grants')} style={{ marginTop: 10, width: '100%', padding: '5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            Open Grant Hub →
          </button>
        </div>

        {/* Sensor Alerts */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🌡</span>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Sensor Alerts</h3>
            {sensorAlerts.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 10, padding: '2px 8px' }}>
                {sensorAlerts.length} active
              </span>
            )}
          </div>
          {sensorSparkData.length > 0 && (
            <div style={{ height: 40, marginBottom: 8 }}>
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart data={sensorSparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {sensorAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
              No active sensor alerts ✓
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sensorAlerts.slice(0, 4).map((a: any) => {
                const color = a.level === 'critical' ? '#ef4444' : '#f59e0b';
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: `${color}10`, borderRadius: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', flexShrink: 0 }}>{a.level}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.message ?? a.sensor_name}</span>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => navigate('iot')} style={{ marginTop: 10, width: '100%', padding: '5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            IoT Dashboard →
          </button>
        </div>
      </div>

      {/* ── Main Content: 2-column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 24, alignItems: 'start' }}>

        {/* LEFT: Quick Actions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Quick Actions</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Start something new</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {QUICK_ACTIONS.map(action => (
              <button key={action.label} onClick={() => navigate(action.page)}
                style={{ all: 'unset', cursor: 'pointer' }}>
                <div className="card" style={{
                  padding: '18px 14px',
                  textAlign: 'center',
                  transition: 'transform 0.15s',
                  border: `1px solid var(--border)`,
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = action.color; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${action.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, margin: '0 auto 10px',
                  }}>
                    {action.icon}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{action.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{action.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Today's Priorities */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>📌</span>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Today's Focus</h2>
          </div>

          {priorities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>All clear!</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No urgent items today. Great work.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {priorities.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${p.color}`,
                }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.count}× {p.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>More Stats</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PULSE_STATS.slice(4).map(stat => {
                const val = (summary as any)[stat.key] ?? 0;
                return (
                  <div key={stat.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{stat.icon}</span>{stat.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity Feed + Upcoming Side-by-side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>

        {/* Activity Feed */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📊</span> Recent Activity
            </h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{summary.audit_recent.length} events</span>
          </div>

          {summary.audit_recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No recent activity yet. Start using the system to see events here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
              {summary.audit_recent.slice(0, 12).map((log) => {
                const actionColors: Record<string, { bg: string; text: string }> = {
                  create: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
                  update: { bg: 'rgba(99,102,241,0.15)', text: '#6366f1' },
                  delete: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
                };
                const ac = actionColors[log.action] || { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' };
                return (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ background: ac.bg, color: ac.text, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, textTransform: 'uppercase', flexShrink: 0 }}>
                      {log.action}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.entity_type} #{log.entity_id}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user_email}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDateTime(log.timestamp)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Today's Work */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Today's Work</h2>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Due Today', value: todayTasks.filter(t => t.status !== 'completed').length, color: '#f59e0b', icon: '📅' },
              { label: 'Overdue', value: todayTasks.filter(t => t.status === 'overdue').length, color: '#ef4444', icon: '⚠' },
              { label: 'Low Stock', value: (summary as any)?.low_stock_items ?? 0, color: '#06b6d4', icon: '📦' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--surface2)', borderRadius: 8, border: `1px solid ${s.color}30` }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Task list */}
          {todayTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>Nothing due today!</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>You're all caught up.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {todayTasks.map(task => {
                const statusColors: Record<string, string> = { overdue: '#ef4444', pending: '#f59e0b', 'in_progress': '#6366f1', completed: '#22c55e' };
                const priorityColors: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
                const sc = statusColors[task.status] || '#94a3b8';
                const pc = priorityColors[task.priority] || '#94a3b8';
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${sc}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${sc}20`, color: sc, fontWeight: 600, textTransform: 'capitalize' }}>{task.status}</span>
                        {task.priority && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${pc}18`, color: pc, fontWeight: 600, textTransform: 'capitalize' }}>{task.priority}</span>}
                        {task.due_date && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Due {task.due_date}</span>}
                      </div>
                    </div>
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => tasksApi.update(task.id, { status: 'completed' }).then(() => load())}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #22c55e40', background: '#22c55e15', color: '#22c55e', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        ✓ Done
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => navigate('tasks')}
            style={{ width: '100%', marginTop: 12, padding: '8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            View All Tasks →
          </button>
        </div>
      </div>

      {/* ── Analytics (expandable) ── */}
      <div className="card" style={{ padding: 20 }}>
        <button
          onClick={() => setShowAnalytics(v => !v)}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Research Analytics</h2>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, transition: 'transform 0.2s', transform: showAnalytics ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>

        {showAnalytics && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>Tasks by Status</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={taskData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {taskData.map((e, i) => <Cell key={i} fill={statusColor(e.name)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>Incidents by Severity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={incidentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                      {incidentData.map((e, i) => <Cell key={i} fill={statusColor(e.name)} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>Samples by Status</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sampleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                      {sampleData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>Sample Intake — Last 8 Weeks</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={summary.sample_intake_by_week} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} name="Samples" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
