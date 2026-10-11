import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { errText } from '../lib/errors';
import { ExportMenu } from '../components/ExportMenu';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabType = 'overview' | 'tasks' | 'samples' | 'equipment' | 'experiments' | 'safety' | 'custom';

interface DashboardSummary {
  protocols: number;
  instruments: number;
  bookings: number;
  tasks_open: number;
  compliance_logs: number;
  overdue_tasks: number;
  samples: number;
  inventory_items: number;
  incident_reports: number;
  low_stock_items: number;
  samples_by_status: Record<string, number>;
  tasks_by_status: Record<string, number>;
  incidents_by_severity: Record<string, number>;
  sample_intake_by_week: { week: string; count: number }[];
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  assignee_name: string | null;
  due_date: string | null;
}

interface LabUser {
  id: string;
  full_name: string;
  role: string;
}

interface KpiGoal {
  id: string;
  label: string;
  target: number;
  unit: string;
  getValue: (s: DashboardSummary) => number;
}

type ReportConfig = Doc<'report_configs'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

const DEFAULT_KPI_GOALS: KpiGoal[] = [
  { id: 'samples', label: 'Total Samples', target: 100, unit: 'samples', getValue: (s) => s.samples },
  { id: 'tasks_open', label: 'Open Tasks (max)', target: 10, unit: 'tasks', getValue: (s) => s.tasks_open },
  { id: 'instruments', label: 'Instruments', target: 5, unit: 'instruments', getValue: (s) => s.instruments },
  { id: 'protocols', label: 'Protocols', target: 10, unit: 'protocols', getValue: (s) => s.protocols },
];

// Data a saved report can include, and ready-made starting points.
const SOURCES = ['Samples', 'Equipment', 'Tasks', 'Safety', 'Compliance', 'Users'] as const;
const TEMPLATES = [
  { name: 'Weekly Sample Report', description: 'Sample processing and storage metrics', type: 'summary', schedule: 'weekly', sources: ['Samples'] },
  { name: 'Monthly Equipment Review', description: 'Equipment utilization and calibration', type: 'trend', schedule: 'monthly', sources: ['Equipment'] },
  { name: 'Daily Activity Summary', description: 'Tasks and their owners', type: 'summary', schedule: 'daily', sources: ['Tasks', 'Users'] },
  { name: 'Quarterly Compliance', description: 'Compliance status and incidents', type: 'comparison', schedule: 'monthly', sources: ['Compliance', 'Safety'] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isOverdue = (t: TaskItem, today = ymd(new Date())) =>
  t.status !== 'completed' && t.status !== 'cancelled' && (t.status === 'overdue' || (!!t.due_date && t.due_date < today));
const KPI_KEY = 'labos_report_kpi_targets';
const loadTargets = (): Record<string, number> => {
  const base = { samples: 100, tasks_open: 10, instruments: 5, protocols: 10 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(KPI_KEY) || '{}') }; } catch { return base; }
};

function kpiColor(pct: number, invertBad = false): string {
  if (invertBad) {
    // lower is better (e.g. open tasks)
    if (pct <= 60) return '#10b981';
    if (pct <= 90) return '#f59e0b';
    return '#ef4444';
  }
  if (pct >= 90) return '#10b981';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { token } = useAuth();
  const t = token ?? undefined;
  const summary = useQuery(api.dashboard.summary, token ? { token } : 'skip') as DashboardSummary | undefined;
  const live = useQuery(api.reports.data, token ? { token } : 'skip');
  const reports = useQuery(api.reports.list, token ? { token } : 'skip') ?? [];
  const createReport = useMutation(api.reports.create);
  const updateReport = useMutation(api.reports.update);
  const removeReport = useMutation(api.reports.remove);
  const markGenerated = useMutation(api.reports.markGenerated);
  const loading = summary === undefined || live === undefined;
  const tasks: TaskItem[] = live?.tasks ?? [];
  const users: LabUser[] = live?.users ?? [];
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [draft, setDraft] = useState({ name: '', description: '', type: 'summary', schedule: 'manual', sources: [] as string[] });
  const [kpiTargets, setKpiTargets] = useState<Record<string, number>>(loadTargets);
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem(KPI_KEY, JSON.stringify(kpiTargets)); } catch { /* private mode */ } }, [kpiTargets]);
  const [dateRange, setDateRange] = useState({
    start: ymd(new Date(Date.now() - 180 * 86400000)),
    end: ymd(new Date()),
  });
  const printRef = useRef<HTMLDivElement>(null);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Filter tasks by date range
  const filteredTasks = tasks.filter((t) => {
    if (!t.due_date) return true;
    return t.due_date >= dateRange.start && t.due_date <= dateRange.end;
  });

  // Tasks by status pie data
  const taskStatusData = summary
    ? Object.entries(summary.tasks_by_status).map(([name, value], i) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : [];

  // Tasks by priority bar data
  const taskPriorityData = ['high', 'medium', 'low'].map((p) => ({
    priority: p.charAt(0).toUpperCase() + p.slice(1),
    count: filteredTasks.filter((t) => t.priority === p).length,
  }));

  // Sample intake chart (live from summary)
  const sampleIntakeData = summary?.sample_intake_by_week ?? [];

  // Sample type distribution from summary
  const sampleStatusData = summary
    ? Object.entries(summary.samples_by_status).map(([name, value], i) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
        value,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : [];

  // User leaderboard: tasks completed per assignee
  const leaderboard = users.map((u) => {
    const userTasks = filteredTasks.filter((t) => t.assigned_to === u.id);
    return {
      id: u.id,
      name: u.full_name,
      role: u.role,
      completed: userTasks.filter((t) => t.status === 'completed').length,
      inProgress: userTasks.filter((t) => t.status === 'in_progress').length,
      overdue: userTasks.filter((t) => isOverdue(t)).length,
      total: userTasks.length,
    };
  }).sort((a, b) => b.completed - a.completed);

  // Comparative: this period vs previous period
  const periodMs = new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime();
  const prevEnd = dateRange.start;
  const prevStart = new Date(new Date(dateRange.start).getTime() - periodMs).toISOString().split('T')[0];

  const thisPeriodTasks = tasks.filter((t) => t.due_date && t.due_date >= dateRange.start && t.due_date <= dateRange.end);
  const prevPeriodTasks = tasks.filter((t) => t.due_date && t.due_date >= prevStart && t.due_date < prevEnd);

  const comparativeData = [
    {
      metric: 'Total Tasks',
      current: thisPeriodTasks.length,
      previous: prevPeriodTasks.length,
    },
    {
      metric: 'Completed',
      current: thisPeriodTasks.filter((t) => t.status === 'completed').length,
      previous: prevPeriodTasks.filter((t) => t.status === 'completed').length,
    },
    {
      metric: 'Overdue',
      current: thisPeriodTasks.filter((t) => isOverdue(t)).length,
      previous: prevPeriodTasks.filter((t) => isOverdue(t)).length,
    },
    {
      metric: 'High Priority',
      current: thisPeriodTasks.filter((t) => t.priority === 'high').length,
      previous: prevPeriodTasks.filter((t) => t.priority === 'high').length,
    },
  ];

  // Equipment: booked hours in the date range ÷ working hours (8 h × weekdays)
  const rangeStart = new Date(`${dateRange.start}T00:00:00`).getTime();
  const rangeEnd = new Date(`${dateRange.end}T23:59:59`).getTime();
  let workdays = 0;
  for (let d = rangeStart; d <= rangeEnd; d += 86400000) { const w = new Date(d).getDay(); if (w !== 0 && w !== 6) workdays++; }
  const workHours = Math.max(1, workdays * 8);
  const equipmentRows = (live?.instruments ?? []).map((i) => {
    const ms = (live?.bookings ?? []).filter((b) => b.instrument_id === i.id && b.status !== 'cancelled')
      .reduce((sum, b) => sum + Math.max(0, Math.min(b.end, rangeEnd) - Math.max(b.start, rangeStart)), 0);
    const hours = Math.round(ms / 360000) / 10;
    const daysLeft = i.next_calibration ? Math.ceil((i.next_calibration - Date.now()) / 86400000) : null;
    return { name: i.name, status: i.status, hours, utilization: Math.min(100, Math.round((hours / workHours) * 100)), next: i.next_calibration ? ymd(new Date(i.next_calibration)) : null, daysLeft };
  }).sort((a, b) => b.utilization - a.utilization);
  const calibrationDue = equipmentRows.filter((e) => e.daysLeft !== null && e.daysLeft <= 30).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  // Safety: incidents per month (last 6 months) and compliance by regulation
  const safetyTrend = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - k));
    const next = new Date(d); next.setMonth(next.getMonth() + 1);
    const inMonth = (live?.incidents ?? []).filter((i) => i.occurred_at >= d.getTime() && i.occurred_at < next.getTime());
    return {
      month: d.toLocaleString('en', { month: 'short' }),
      incidents: inMonth.length,
      serious: inMonth.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
      resolved: inMonth.filter((i) => i.resolved).length,
    };
  });
  const complianceByReg = Object.values((live?.compliance ?? []).reduce<Record<string, { standard: string; total: number; done: number }>>((acc, c) => {
    const row = (acc[c.regulation] ??= { standard: c.regulation, total: 0, done: 0 });
    row.total++; if (c.completed) row.done++;
    return acc;
  }, {})).map((r) => ({ ...r, score: Math.round((r.done / r.total) * 100) }));

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  // Build an Excel file with the data the report includes.
  const sheetsFor = (sources: string[]) => {
    const sheets: Record<string, Record<string, unknown>[]> = {};
    for (const src of sources) {
      if (src === 'Samples') sheets.Samples = (summary ? Object.entries(summary.samples_by_status).map(([status, count]) => ({ Status: status, Count: count })) : []).concat(
        (summary?.sample_intake_by_week ?? []).map((w) => ({ Status: `Intake week of ${w.week}`, Count: w.count })));
      if (src === 'Equipment') sheets.Equipment = equipmentRows.map((e) => ({ Instrument: e.name, Status: e.status, 'Utilization %': e.utilization, 'Booked hours': e.hours, 'Next calibration': e.next ?? '' }));
      if (src === 'Tasks') sheets.Tasks = filteredTasks.map((x) => ({ Title: x.title, Status: x.status, Priority: x.priority, Assignee: x.assignee_name ?? '', Due: x.due_date ?? '', Overdue: isOverdue(x) ? 'yes' : '' }));
      if (src === 'Safety') sheets.Safety = (live?.incidents ?? []).map((i) => ({ Title: i.title, Severity: i.severity, Status: i.status, Date: ymd(new Date(i.occurred_at)), Resolved: i.resolved ?? '' }));
      if (src === 'Compliance') sheets.Compliance = (live?.compliance ?? []).map((c) => ({ Item: c.title, Regulation: c.regulation, Status: c.status, Due: c.due_date ? ymd(new Date(c.due_date)) : '', Done: c.completed ? 'yes' : '' }));
      if (src === 'Users') sheets.Users = leaderboard.map((u) => ({ Name: u.name, Role: u.role, Completed: u.completed, 'In progress': u.inProgress, Overdue: u.overdue, Total: u.total }));
    }
    return sheets;
  };

  const handleGenerateReport = async (r: ReportConfig) => {
    const sheets = sheetsFor(r.sources);
    if (!Object.keys(sheets).length) { toast.error('This report has no data sources — configure it first'); return; }
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data yet' }]), name);
      XLSX.writeFile(wb, `${r.name.replace(/[\\/:*?"<>|]/g, '-')} - ${ymd(new Date())}.xlsx`);
      await markGenerated({ token: t, id: r._id });
      toast.success('Report downloaded');
    } catch (e) { toast.error(errText(e)); }
  };

  const handleToggleReport = async (r: ReportConfig) => {
    try { await updateReport({ token: t, id: r._id, enabled: !r.enabled }); } catch (e) { toast.error(errText(e)); }
  };

  const addReport = async (d: { name: string; description: string; type: string; schedule: string; sources: string[] }) => {
    try { await createReport({ token: t, ...d, enabled: true }); toast.success('Report saved'); return true; }
    catch (e) { toast.error(errText(e)); return false; }
  };

  // ── Live metric cards ─────────────────────────────────────────────────────────

  const metricCards = summary
    ? [
        { label: 'Total Samples', value: summary.samples, change: null, color: '#3b82f6' },
        { label: 'Open Tasks', value: summary.tasks_open, change: null, color: '#f59e0b' },
        { label: 'Overdue Tasks', value: summary.overdue_tasks, change: null, color: '#ef4444' },
        { label: 'Instruments', value: summary.instruments, change: null, color: '#10b981' },
        { label: 'Protocols', value: summary.protocols, change: null, color: '#8b5cf6' },
        { label: 'Inventory Items', value: summary.inventory_items, change: null, color: '#6b7280' },
        { label: 'Low Stock Items', value: summary.low_stock_items, change: null, color: '#ef4444' },
        { label: 'Incident Reports', value: summary.incident_reports, change: null, color: '#f59e0b' },
      ]
    : [];

  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: 'Tasks Analytics' },
    { key: 'samples', label: 'Samples' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'safety', label: 'Safety' },
    { key: 'custom', label: 'Custom Reports' },
  ];

  const chartTooltipStyle = {
    contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 },
    labelStyle: { color: 'var(--text)' },
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="page reports-page" ref={printRef}>
      <style>{`
        @media print {
          body > *:not(.reports-page) { display: none !important; }
          .no-print { display: none !important; }
          .reports-page { padding: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Live insights, metrics, and data visualization</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Range Filter — wired to data */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }}
            />
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <button
            onClick={handlePrint}
            style={{ padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
          >
            Print / PDF
          </button>
          <ExportMenu data={tasks as unknown as Record<string, unknown>[]} filename="reports_export" title="Lab Analytics" />
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading live data…</div>
      )}

      {!loading && (
        <>
          {/* Tabs */}
          <div className="hub-tabs no-print" style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 8, flexWrap: 'wrap' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div>
              {/* Live metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                {metricCards.map((m, i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{m.label}</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Live</div>
                  </div>
                ))}
              </div>

              {/* KPI Goal Tracking */}
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>KPI Goal Tracking</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click target to edit</span>
                </div>
                <div style={{ display: 'grid', gap: 16 }}>
                  {summary && DEFAULT_KPI_GOALS.map((kpi) => {
                    const actual = kpi.getValue(summary);
                    const target = kpiTargets[kpi.id] ?? kpi.target;
                    const pct = Math.min(100, Math.round((actual / target) * 100));
                    const invertBad = kpi.id === 'tasks_open';
                    const color = kpiColor(pct, invertBad);
                    const status = invertBad
                      ? (pct <= 60 ? 'On Track' : pct <= 90 ? 'At Risk' : 'Exceeded')
                      : (pct >= 90 ? 'On Track' : pct >= 60 ? 'At Risk' : 'Below Target');
                    return (
                      <div key={kpi.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{kpi.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color, fontWeight: 600 }}>{status}</span>
                            <span style={{ color: 'var(--text)' }}>{actual}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            {editingKpi === kpi.id ? (
                              <input
                                type="number"
                                defaultValue={target}
                                style={{ width: 60, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }}
                                autoFocus
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val > 0) setKpiTargets((t) => ({ ...t, [kpi.id]: val }));
                                  setEditingKpi(null);
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              />
                            ) : (
                              <button
                                onClick={() => setEditingKpi(kpi.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline dotted' }}
                              >
                                {target} {kpi.unit}
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Charts row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
                {/* Sample intake by week — live */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Sample Intake (Last 8 Weeks) — Live</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={sampleIntakeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip {...chartTooltipStyle} />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} name="Samples" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Tasks by status — live */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Tasks by Status — Live</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {taskStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparative Period Panel */}
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>This Period vs Previous Period</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on selected date range</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={comparativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="metric" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend />
                    <Bar dataKey="current" fill="#3b82f6" name="This Period" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="previous" fill="#6b7280" name="Previous Period" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Delta badges */}
                <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                  {comparativeData.map((row) => {
                    const delta = row.current - row.previous;
                    const pct = row.previous > 0 ? Math.round((delta / row.previous) * 100) : null;
                    const isPositive = delta >= 0;
                    return (
                      <div key={row.metric} style={{ background: 'var(--surface2)', padding: '8px 14px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.metric}:</span>
                        <span style={{ fontWeight: 700, color: isPositive ? '#10b981' : '#ef4444', fontSize: 14 }}>
                          {isPositive ? '+' : ''}{delta}
                        </span>
                        {pct !== null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({pct}%)</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TASKS ANALYTICS TAB ──────────────────────────────────────────── */}
          {activeTab === 'tasks' && (
            <div>
              {/* Summary stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Total (filtered)', value: filteredTasks.length, color: '#3b82f6' },
                  { label: 'Completed', value: filteredTasks.filter((t) => t.status === 'completed').length, color: '#10b981' },
                  { label: 'In Progress', value: filteredTasks.filter((t) => t.status === 'in_progress').length, color: '#f59e0b' },
                  { label: 'Overdue', value: filteredTasks.filter((t) => isOverdue(t)).length, color: '#ef4444' },
                  { label: 'High Priority', value: filteredTasks.filter((t) => t.priority === 'high').length, color: '#8b5cf6' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24, marginBottom: 24 }}>
                {/* Tasks by priority */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Tasks by Priority</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={taskPriorityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="priority" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]}>
                        {taskPriorityData.map((entry, i) => (
                          <Cell key={i} fill={entry.priority === 'High' ? '#ef4444' : entry.priority === 'Medium' ? '#f59e0b' : '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tasks by status pie */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Tasks by Status</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={taskStatusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {taskStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Completion rate bar per assignee */}
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Completion Rate by Assignee</h3>
                {leaderboard.filter((u) => u.total > 0).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No assigned tasks in selected range.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {leaderboard.filter((u) => u.total > 0).map((u) => {
                      const pct = Math.round((u.completed / u.total) * 100);
                      return (
                        <div key={u.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text)', fontSize: 14 }}>{u.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.completed}/{u.total} completed ({pct}%)</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: kpiColor(pct), borderRadius: 4, transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* User Productivity Leaderboard */}
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>User Productivity Leaderboard</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Rank', 'Name', 'Role', 'Completed', 'In Progress', 'Overdue', 'Total'].map((h) => (
                        <th key={h} style={{ textAlign: h === 'Rank' ? 'center' : 'left', padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)' }}>
                            #{i + 1}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text)', fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{u.role}</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 700 }}>{u.completed}</td>
                        <td style={{ padding: '12px 14px', color: '#f59e0b', fontWeight: 600 }}>{u.inProgress}</td>
                        <td style={{ padding: '12px 14px', color: '#ef4444', fontWeight: 600 }}>{u.overdue}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text)' }}>{u.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SAMPLES TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'samples' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Sample Intake by Week — Live</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={sampleIntakeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip {...chartTooltipStyle} />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6' }} name="Samples" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Sample Status Distribution — Live</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={sampleStatusData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {sampleStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Live Sample Counts by Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {sampleStatusData.map((s, i) => (
                    <div key={i} style={{ background: 'var(--surface2)', padding: 16, borderRadius: 10, borderLeft: `4px solid ${s.color}` }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── EQUIPMENT TAB ────────────────────────────────────────────────── */}
          {activeTab === 'equipment' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Equipment Utilization (booked hours ÷ working hours, selected dates)</h3>
                  {equipmentRows.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>No instruments yet. Add them in Lab Hub → Equipment.</p> : (
                    <ResponsiveContainer width="100%" height={Math.max(220, equipmentRows.length * 44)}>
                      <BarChart data={equipmentRows} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                        <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} width={130} />
                        <Tooltip {...chartTooltipStyle} />
                        <Bar dataKey="utilization" fill="#3b82f6" name="Utilization %" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Calibration due within 30 days</h3>
                  {calibrationDue.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Nothing due or overdue.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {calibrationDue.map((e) => (
                        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ flex: 1, color: 'var(--text)' }}>{e.name}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{e.next}</span>
                          <span style={{ fontWeight: 700, color: (e.daysLeft ?? 0) < 0 ? 'var(--bad-text)' : 'var(--warn-text)' }}>
                            {(e.daysLeft ?? 0) < 0 ? `${Math.abs(e.daysLeft ?? 0)} d overdue` : `in ${e.daysLeft} d`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 20 }}>
                    {[
                      { label: 'Instruments', count: summary?.instruments ?? 0 },
                      { label: 'Bookings', count: summary?.bookings ?? 0 },
                      { label: 'Inventory items', count: summary?.inventory_items ?? 0 },
                      { label: 'Low stock', count: summary?.low_stock_items ?? 0 },
                    ].map((x) => (
                      <div key={x.label} style={{ background: 'var(--surface2)', padding: 12, borderRadius: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{x.count}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{x.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SAFETY TAB ───────────────────────────────────────────────────── */}
          {activeTab === 'safety' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 24 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Incidents, last 6 months</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={safetyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="incidents" stroke="#f59e0b" strokeWidth={2} name="Incidents" />
                      <Line type="monotone" dataKey="serious" stroke="#ef4444" strokeWidth={2} name="High / critical" />
                      <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Compliance completion by regulation</h3>
                  {complianceByReg.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>No compliance items yet. Add them in Compliance.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {complianceByReg.map((item) => {
                        const color = item.score >= 90 ? '#10b981' : item.score >= 60 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={item.standard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ color: 'var(--text)' }}>{item.standard} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({item.done}/{item.total})</span></span>
                              <span style={{ fontWeight: 600, color }}>{item.score}%</span>
                            </div>
                            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${item.score}%`, height: '100%', background: color, borderRadius: 4 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Incidents by severity</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {Object.entries(summary?.incidents_by_severity ?? {}).map(([sev, count]) => (
                    <div key={sev} style={{ background: 'var(--surface2)', padding: 20, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f59e0b' : '#10b981' }}>{count}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 4 }}>{sev}</div>
                    </div>
                  ))}
                  <div style={{ background: 'var(--surface2)', padding: 20, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6' }}>{summary?.incident_reports ?? 0}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total reports</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CUSTOM REPORTS TAB ───────────────────────────────────────────── */}
          {activeTab === 'custom' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Saved Reports</h2>
                <button onClick={() => setShowReportModal(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>+ Create Report</button>
              </div>

              {reports.length === 0 && <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>No saved reports yet. Create one, or start from a template below. Generate downloads an Excel file with the latest data.</p>}
              <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
                {reports.map((report) => (
                  <div key={report._id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span className={report.enabled ? 'badge badge-ok' : 'badge badge-neutral'} style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{report.enabled ? 'ACTIVE' : 'PAUSED'}</span>
                          <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{report.schedule.toUpperCase()}</span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{report.name}</h3>
                        {report.description && <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 8px' }}>{report.description}</p>}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Includes: {report.sources.join(', ') || 'nothing yet'} · Last generated: <strong>{report.last_generated ? new Date(report.last_generated).toLocaleString() : 'never'}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <button onClick={() => handleGenerateReport(report)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>Generate</button>
                        <button onClick={() => handleToggleReport(report)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>{report.enabled ? 'Pause' : 'Resume'}</button>
                        <button onClick={() => setSelectedReport(report)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Configure</button>
                        <button onClick={async () => { if (confirm(`Delete "${report.name}"?`)) { try { await removeReport({ token: t, id: report._id }); } catch (e) { toast.error(errText(e)); } } }} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Quick Templates</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.name} type="button" onClick={() => addReport({ ...tpl })}
                    style={{ textAlign: 'left', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, cursor: 'pointer' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{tpl.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{tpl.description}</p>
                    <p style={{ fontSize: 12, color: 'var(--accent)', margin: '8px 0 0' }}>+ Save as a report</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create Report Modal ──────────────────────────────────────────────── */}
      {showReportModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create report" style={{ padding: 20 }}>
          <div className="modal-panel" style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Create Report</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="rp-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Report name</label>
                <input id="rp-name" type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Monthly lab summary" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="rp-desc" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
                <textarea id="rp-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label htmlFor="rp-type" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Report type</label>
                  <select id="rp-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }}>
                    <option value="summary">Summary</option><option value="trend">Trend</option><option value="comparison">Comparison</option><option value="distribution">Distribution</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rp-sched" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Schedule</label>
                  <select id="rp-sched" value={draft.schedule} onChange={(e) => setDraft({ ...draft, schedule: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }}><option value="manual">Manual</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Include data from</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SOURCES.map((src) => (
                    <label key={src} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--surface2)', borderRadius: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={draft.sources.includes(src)} onChange={() => setDraft({ ...draft, sources: draft.sources.includes(src) ? draft.sources.filter((x) => x !== src) : [...draft.sources, src] })} />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{src}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReportModal(false)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button disabled={!draft.name.trim() || draft.sources.length === 0} className="btn btn-primary" style={{ padding: '10px 20px' }}
                onClick={async () => { if (await addReport(draft)) { setShowReportModal(false); setDraft({ name: '', description: '', type: 'summary', schedule: 'manual', sources: [] }); } }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Configure Modal ──────────────────────────────────────────────────── */}
      {selectedReport && (
        <ConfigureReport report={selectedReport} onClose={() => setSelectedReport(null)}
          onSave={async (patch) => { try { await updateReport({ token: t, id: selectedReport._id, ...patch }); toast.success('Saved'); setSelectedReport(null); } catch (e) { toast.error(errText(e)); } }} />
      )}
    </div>
  );
}

function ConfigureReport({ report, onClose, onSave }: {
  report: ReportConfig; onClose: () => void;
  onSave: (patch: { schedule: string; sources: string[]; enabled: boolean; recipients: string }) => void;
}) {
  const [schedule, setSchedule] = useState(report.schedule);
  const [sources, setSources] = useState<string[]>(report.sources);
  const [enabled, setEnabled] = useState(report.enabled);
  const [recipients, setRecipients] = useState(report.recipients ?? '');
  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Configure report" style={{ padding: 20 }}>
      <div className="modal-panel" style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Configure: {report.name}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="cf-sched" style={lbl}>Schedule</label>
            <select id="cf-sched" value={schedule} onChange={(e) => setSchedule(e.target.value)} style={inp}>
              <option value="manual">Manual</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Include data from</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SOURCES.map((src) => (
                <label key={src} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--surface2)', borderRadius: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sources.includes(src)} onChange={() => setSources(sources.includes(src) ? sources.filter((x) => x !== src) : [...sources, src])} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{src}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="cf-rcpt" style={lbl}>Email recipients (saved for scheduled sending)</label>
            <input id="cf-rcpt" type="text" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="name@example.com, other@example.com" style={inp} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span style={{ color: 'var(--text)' }}>Active</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
          <button onClick={() => onSave({ schedule, sources, enabled, recipients })} className="btn btn-primary" style={{ padding: '10px 20px' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
