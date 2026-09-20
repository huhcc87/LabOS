import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
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
  id: number;
  title: string;
  status: string;
  priority: string;
  assigned_to: number | null;
  assignee_name: string | null;
  due_date: string | null;
}

interface LabUser {
  id: number;
  full_name: string;
  role: string;
  email: string;
}

interface KpiGoal {
  id: string;
  label: string;
  target: number;
  unit: string;
  getValue: (s: DashboardSummary) => number;
}

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: string;
  lastGenerated: string;
  schedule: string;
  enabled: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

const SAFETY_TRENDS = [
  { month: 'Jan', incidents: 2, nearMisses: 5, audits: 1 },
  { month: 'Feb', incidents: 1, nearMisses: 3, audits: 0 },
  { month: 'Mar', incidents: 3, nearMisses: 4, audits: 2 },
  { month: 'Apr', incidents: 1, nearMisses: 2, audits: 1 },
  { month: 'May', incidents: 2, nearMisses: 3, audits: 0 },
  { month: 'Jun', incidents: 0, nearMisses: 1, audits: 1 },
];

const EQUIPMENT_UTILIZATION = [
  { name: 'Centrifuge', utilization: 85, maintenance: 15 },
  { name: 'PCR Machine', utilization: 92, maintenance: 8 },
  { name: 'Microscope', utilization: 68, maintenance: 12 },
  { name: 'Spectrophotometer', utilization: 74, maintenance: 6 },
  { name: 'Incubator', utilization: 88, maintenance: 10 },
];

const DEFAULT_KPI_GOALS: KpiGoal[] = [
  { id: 'samples', label: 'Total Samples', target: 100, unit: 'samples', getValue: (s) => s.samples },
  { id: 'tasks_open', label: 'Open Tasks (max)', target: 10, unit: 'tasks', getValue: (s) => s.tasks_open },
  { id: 'instruments', label: 'Instruments', target: 5, unit: 'instruments', getValue: (s) => s.instruments },
  { id: 'protocols', label: 'Protocols', target: 10, unit: 'protocols', getValue: (s) => s.protocols },
];

const INITIAL_REPORTS: ReportConfig[] = [
  { id: 'R001', name: 'Monthly Sample Summary', description: 'Overview of sample collection, processing, and storage', type: 'summary', lastGenerated: '2024-01-25', schedule: 'monthly', enabled: true },
  { id: 'R002', name: 'Equipment Utilization', description: 'Equipment usage rates and maintenance schedules', type: 'trend', lastGenerated: '2024-01-24', schedule: 'weekly', enabled: true },
  { id: 'R003', name: 'Experiment Progress', description: 'Status and progress of all active experiments', type: 'summary', lastGenerated: '2024-01-25', schedule: 'daily', enabled: true },
  { id: 'R004', name: 'Safety & Compliance', description: 'Incident reports and compliance metrics', type: 'comparison', lastGenerated: '2024-01-20', schedule: 'monthly', enabled: true },
  { id: 'R005', name: 'Inventory Levels', description: 'Stock levels and reorder alerts', type: 'distribution', lastGenerated: '2024-01-25', schedule: 'weekly', enabled: true },
  { id: 'R006', name: 'User Activity', description: 'Login patterns and system usage', type: 'trend', lastGenerated: '2024-01-24', schedule: 'weekly', enabled: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function api<T>(path: string): Promise<T> {
  return fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('lab_token') ?? ''}` },
  }).then((r) => {
    if (!r.ok) throw new Error(`API ${path} failed`);
    return r.json() as Promise<T>;
  });
}

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
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<LabUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportConfig[]>(INITIAL_REPORTS);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [kpiTargets, setKpiTargets] = useState<Record<string, number>>({ samples: 100, tasks_open: 10, instruments: 5, protocols: 10 });
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const printRef = useRef<HTMLDivElement>(null);

  // ── Fetch live data ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, taskRes, userRes] = await Promise.all([
        api<DashboardSummary>('/dashboard/summary'),
        api<{ items: TaskItem[] }>('/tasks?per_page=500'),
        api<{ items: LabUser[] }>('/auth/users?per_page=200'),
      ]);
      setSummary(sum);
      setTasks(taskRes.items);
      setUsers(userRes.items);
    } catch (e) {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      overdue: userTasks.filter((t) => t.status === 'overdue').length,
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
      current: thisPeriodTasks.filter((t) => t.status === 'overdue').length,
      previous: prevPeriodTasks.filter((t) => t.status === 'overdue').length,
    },
    {
      metric: 'High Priority',
      current: thisPeriodTasks.filter((t) => t.priority === 'high').length,
      previous: prevPeriodTasks.filter((t) => t.priority === 'high').length,
    },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateReport = (id: string) => {
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, lastGenerated: new Date().toISOString().split('T')[0] } : r));
    toast.success('Report generated successfully');
  };

  const handleToggleReport = (id: string) => {
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
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
            onClick={loadData}
            style={{ padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
          >
            Refresh
          </button>
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
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Live · from API</div>
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
                  { label: 'Overdue', value: filteredTasks.filter((t) => t.status === 'overdue').length, color: '#ef4444' },
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Equipment Utilization Rate</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={EQUIPMENT_UTILIZATION} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} width={120} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend />
                      <Bar dataKey="utilization" fill="#3b82f6" name="Utilization %" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="maintenance" fill="#f59e0b" name="Maintenance %" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Instrument Count — Live</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { status: 'Total Instruments', count: summary?.instruments ?? 0, color: '#3b82f6' },
                      { status: 'Active Bookings', count: summary?.bookings ?? 0, color: '#10b981' },
                      { status: 'Inventory Items', count: summary?.inventory_items ?? 0, color: '#f59e0b' },
                      { status: 'Low Stock Alerts', count: summary?.low_stock_items ?? 0, color: '#ef4444' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
                        <span style={{ flex: 1, color: 'var(--text)' }}>{item.status}</span>
                        <span style={{ fontWeight: 700, color: item.color, fontSize: 18 }}>{item.count}</span>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Safety Trends</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={SAFETY_TRENDS}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="incidents" stroke="#ef4444" strokeWidth={2} name="Incidents" />
                      <Line type="monotone" dataKey="nearMisses" stroke="#f59e0b" strokeWidth={2} name="Near Misses" />
                      <Line type="monotone" dataKey="audits" stroke="#3b82f6" strokeWidth={2} name="Audits" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Compliance Scorecard</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { standard: 'GLP Compliance', score: 100, color: '#10b981' },
                      { standard: '21 CFR Part 11', score: 98, color: '#10b981' },
                      { standard: 'ISO 17025', score: 95, color: '#10b981' },
                      { standard: 'Biosafety Level 2', score: 100, color: '#10b981' },
                      { standard: 'Chemical Safety', score: 92, color: '#f59e0b' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ color: 'var(--text)' }}>{item.standard}</span>
                          <span style={{ fontWeight: 600, color: item.color }}>{item.score}%</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${item.score}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live incident counts from API */}
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Live Incident Stats</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {Object.entries(summary?.incidents_by_severity ?? {}).map(([sev, count], i) => (
                    <div key={i} style={{ background: 'var(--surface2)', padding: 20, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f59e0b' : '#10b981' }}>{count}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 4 }}>{sev}</div>
                    </div>
                  ))}
                  <div style={{ background: 'var(--surface2)', padding: 20, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6' }}>{summary?.incident_reports ?? 0}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total Reports</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CUSTOM REPORTS TAB ───────────────────────────────────────────── */}
          {activeTab === 'custom' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Scheduled Reports</h2>
                <button onClick={() => setShowReportModal(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  + Create Report
                </button>
              </div>

              <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
                {reports.map((report) => (
                  <div key={report.id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{report.id}</span>
                          <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: report.enabled ? '#166534' : '#374151', color: report.enabled ? '#86efac' : '#9ca3af' }}>
                            {report.enabled ? 'ACTIVE' : 'DISABLED'}
                          </span>
                          <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                            {report.schedule.toUpperCase()}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{report.name}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 10px' }}>{report.description}</p>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last generated: <strong>{report.lastGenerated}</strong></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => handleGenerateReport(report.id)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>Generate</button>
                        <button onClick={() => handleToggleReport(report.id)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>{report.enabled ? 'Disable' : 'Enable'}</button>
                        <button onClick={() => setSelectedReport(report)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Configure</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Quick Templates</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  { name: 'Daily Activity Summary', description: 'All activities from the past 24 hours' },
                  { name: 'Weekly Sample Report', description: 'Sample processing and storage metrics' },
                  { name: 'Monthly Equipment Review', description: 'Equipment utilization and maintenance' },
                  { name: 'Quarterly Compliance', description: 'Compliance status and audit results' },
                ].map((t, i) => (
                  <div key={i} onClick={() => toast.success(`Generating ${t.name}…`)}
                    style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{t.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create Report Modal ──────────────────────────────────────────────── */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Create Custom Report</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Report Name</label>
                <input type="text" placeholder="Enter report name" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
                <textarea placeholder="Describe the report…" rows={3} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Report Type</label>
                  <select style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="summary">Summary</option>
                    <option value="trend">Trend Analysis</option>
                    <option value="comparison">Comparison</option>
                    <option value="distribution">Distribution</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Schedule</label>
                  <select style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="manual">Manual</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Data Sources</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Samples', 'Equipment', 'Tasks', 'Inventory', 'Safety', 'Users'].map((src) => (
                    <label key={src} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--surface2)', borderRadius: 6, cursor: 'pointer' }}>
                      <input type="checkbox" />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{src}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReportModal(false)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={() => { toast.success('Report created'); setShowReportModal(false); }} className="btn btn-primary" style={{ padding: '10px 20px' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Configure Modal ──────────────────────────────────────────────────── */}
      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>Configure: {selectedReport.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Schedule</label>
                <select defaultValue={selectedReport.schedule} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                  <option value="manual">Manual</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Email Recipients</label>
                <input type="text" placeholder="email@example.com, another@example.com" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={selectedReport.enabled} />
                <span style={{ color: 'var(--text)' }}>Enable automatic generation</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedReport(null)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={() => { toast.success('Configuration saved'); setSelectedReport(null); }} className="btn btn-primary" style={{ padding: '10px 20px' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
