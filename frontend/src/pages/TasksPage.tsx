import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { tasksApi } from '../lib/api';
import api from '../lib/api';
import type { Task, TaskStatus } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'overdue'];
const STATUS_META: Record<TaskStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:     { label: 'Pending',     color: '#d97706', bg: '#fef3c7', icon: '⏳' },
  in_progress: { label: 'In Progress', color: '#6366f1', bg: '#e0e7ff', icon: '▶' },
  completed:   { label: 'Completed',   color: '#16a34a', bg: '#dcfce7', icon: '✓' },
  overdue:     { label: 'Overdue',     color: '#dc2626', bg: '#fee2e2', icon: '⚠' },
};

// Feature 1: priority
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
type Priority = typeof PRIORITY_OPTIONS[number];
const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; icon: string }> = {
  high:   { label: 'High',   color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fef3c7', icon: '🟡' },
  low:    { label: 'Low',    color: '#16a34a', bg: '#dcfce7', icon: '🟢' },
};

interface LabUser { id: number; full_name: string; email: string; }
interface Subtask  { id: string; text: string; done: boolean; }
interface Comment  { id: string; author: string; text: string; created_at: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePriority(p: string): Priority {
  return PRIORITY_OPTIONS.includes(p as Priority) ? (p as Priority) : 'medium';
}

function dueDateBar(dueDate: string, status: TaskStatus) {
  if (status === 'completed') return null;
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const created = due - 7 * 86400000; // assume 7-day window
  const total = due - created;
  const elapsed = now - created;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const color = pct >= 100 ? '#dc2626' : pct >= 75 ? '#f59e0b' : '#22c55e';
  const daysLeft = Math.ceil((due - now) / 86400000);
  return { pct, color, daysLeft };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user, hasRole } = useAuth();
  const canCreate = hasRole('staff');
  const canEdit   = hasRole('manager');

  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } =
    usePagedApi<Task>((p, pp, s) => tasksApi.list(p, pp, s));

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Task | null>(null);
  const [deleting, setDeleting]     = useState<Task | null>(null);
  const [saving, setSaving]         = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [viewMode, setViewMode]     = useState<'table' | 'kanban'>('table');

  // Feature 1: priority filter
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');

  // Feature 6: bulk selection
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Feature 7: my tasks toggle
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  // Feature 2: users list for assignee picker
  const [labUsers, setLabUsers]     = useState<LabUser[]>([]);

  // Feature 4: subtasks state (editing modal)
  const [subtasks, setSubtasks]     = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  // Feature 5: comments state
  const [comments, setComments]     = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const { register, handleSubmit, reset, watch } = useForm<any>();

  useEffect(() => {
    api.get('/auth/users?per_page=100').then(r => setLabUsers(r.data.items || [])).catch(() => {});
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  let filtered = statusFilter ? items.filter(t => t.status === statusFilter) : items;
  if (priorityFilter) filtered = filtered.filter(t => parsePriority(t.priority) === priorityFilter);
  if (myTasksOnly)    filtered = filtered.filter(t => t.assigned_to === user?.id);

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = items.filter(t => t.status === s).length; return acc;
  }, {} as Record<string, number>);

  const overdue  = items.filter(t => t.status === 'overdue');
  const myTasks  = items.filter(t => t.assigned_to === user?.id);

  // ── Subtask helpers ──────────────────────────────────────────────────────

  function addSubtask() {
    if (!newSubtask.trim()) return;
    setSubtasks(prev => [...prev, { id: Date.now().toString(), text: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  }

  function toggleSubtask(id: string) {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  }

  function removeSubtask(id: string) {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  }

  // ── Modal helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    reset({ title: '', description: '', due_date: '', status: 'pending', assigned_to: '', reminder_type: 'email', priority: 'medium' });
    setSubtasks([]);
    setComments([]);
    setNewSubtask('');
    setNewComment('');
    setModalOpen(true);
  }

  function openEdit(row: Task) {
    setEditing(row);
    reset({ ...row, assigned_to: row.assigned_to || '' });
    try { setSubtasks(JSON.parse(row.subtasks || '[]')); } catch { setSubtasks([]); }
    try { setComments(JSON.parse(row.comments || '[]')); } catch { setComments([]); }
    setNewSubtask('');
    setNewComment('');
    setModalOpen(true);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function quickDone(task: Task) {
    try {
      await tasksApi.update(task.id, { ...task, status: 'completed' });
      toast.success('Marked done!');
      reload();
    } catch { toast.error('Update failed'); }
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        assigned_to: data.assigned_to ? Number(data.assigned_to) : null,
        subtasks: JSON.stringify(subtasks),
        comments: JSON.stringify(comments),
      };
      editing ? await tasksApi.update(editing.id, payload) : await tasksApi.create(payload);
      toast.success(editing ? 'Task updated' : 'Task created');
      setModalOpen(false);
      reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try { await tasksApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); }
    finally { setSaving(false); }
  }

  // Feature 5: add comment
  function addComment() {
    if (!newComment.trim()) return;
    const c: Comment = {
      id: Date.now().toString(),
      author: user?.full_name || 'You',
      text: newComment.trim(),
      created_at: new Date().toISOString(),
    };
    setComments(prev => [...prev, c]);
    setNewComment('');
  }

  // Feature 6: bulk actions
  function toggleSelect(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  }

  async function bulkMarkDone() {
    setBulkSaving(true);
    try {
      await Promise.all([...selected].map(id => tasksApi.update(id, { status: 'completed' as any })));
      toast.success(`${selected.size} tasks marked done`);
      setSelected(new Set());
      reload();
    } catch { toast.error('Bulk update failed'); }
    finally { setBulkSaving(false); }
  }

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selected.size} tasks?`)) return;
    setBulkSaving(true);
    try {
      await Promise.all([...selected].map(id => tasksApi.delete(id)));
      toast.success(`${selected.size} tasks deleted`);
      setSelected(new Set());
      reload();
    } catch { toast.error('Bulk delete failed'); }
    finally { setBulkSaving(false); }
  }

  // ── Styles ───────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 };

  // ── Table columns ────────────────────────────────────────────────────────

  const columns: Column<Task>[] = [
    // Feature 6: bulk select checkbox
    {
      key: 'select' as any,
      header: (
        <input type="checkbox"
          checked={selected.size === filtered.length && filtered.length > 0}
          onChange={toggleSelectAll} />
      ) as any,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(r.id); }} />
      ),
    },
    {
      key: 'title', header: 'Task', render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Feature 1: priority badge inline */}
            {(() => { const pm = PRIORITY_META[parsePriority(r.priority)]; return <span title={pm.label}>{pm.icon}</span>; })()}
            {r.title}
          </div>
          {r.description && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}</div>}
          {/* Feature 4: subtask progress */}
          {(() => { try { const st: Subtask[] = JSON.parse(r.subtasks || '[]'); if (!st.length) return null; const done = st.filter(s => s.done).length; return <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>✓ {done}/{st.length} subtasks</div>; } catch { return null; } })()}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', render: (r) => {
        const m = STATUS_META[r.status] || STATUS_META.pending;
        return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{m.icon} {m.label}</span>;
      },
    },
    // Feature 1: priority column
    {
      key: 'priority' as any, header: 'Priority', render: (r) => {
        const pm = PRIORITY_META[parsePriority(r.priority)];
        return <span style={{ background: pm.bg, color: pm.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{pm.label}</span>;
      },
    },
    {
      key: 'due_date', header: 'Due', render: (r) => {
        const diff = Math.ceil((new Date(r.due_date).getTime() - Date.now()) / 86400000);
        const late = diff < 0 && r.status !== 'completed';
        return <span style={{ color: late ? '#ef4444' : diff <= 3 && r.status !== 'completed' ? '#f59e0b' : 'var(--text-soft)', fontWeight: late ? 700 : 400 }}>{formatDate(r.due_date)}</span>;
      },
    },
    {
      key: 'assignee_name', header: 'Assigned To', render: (r) =>
        r.assignee_name
          ? <span style={{ background: 'var(--surface2)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{r.assignee_name}</span>
          : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'done' as any, header: '', render: (r) =>
        r.status !== 'completed'
          ? <button onClick={(e) => { e.stopPropagation(); quickDone(r); }} style={{ background: '#dcfce7', border: 'none', borderRadius: 5, color: '#16a34a', padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓ Done</button>
          : <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>✓</span>,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Tasks</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {total} total · {myTasks.length} assigned to you
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Feature 7: My Tasks toggle */}
            <button
              onClick={() => setMyTasksOnly(p => !p)}
              style={{ background: myTasksOnly ? 'var(--accent)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: myTasksOnly ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: myTasksOnly ? 700 : 400 }}
            >
              👤 My Tasks {myTasksOnly && `(${myTasks.length})`}
            </button>
            {/* View toggle */}
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['table', 'kanban'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12 }}>
                  {m === 'table' ? '☰ Table' : '⊞ Board'}
                </button>
              ))}
            </div>
            {canCreate && (
              <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                + New Task
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>⚠</span><strong>{overdue.length} overdue:</strong> {overdue.slice(0, 3).map(t => t.title).join(', ')}{overdue.length > 3 ? ` +${overdue.length - 3} more` : ''}
          </div>
        )}

        {/* Status cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {STATUS_OPTIONS.map(s => {
            const m = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <div key={s} onClick={() => setStatusFilter(active ? '' : s)}
                style={{ background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color + '66' : 'var(--border)'}`, borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{counts[s] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* Feature 1: Priority filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>PRIORITY:</span>
          {PRIORITY_OPTIONS.map(p => {
            const pm = PRIORITY_META[p];
            const active = priorityFilter === p;
            return (
              <button key={p} onClick={() => setPriorityFilter(active ? '' : p)}
                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 600, border: `1px solid ${pm.color}`, background: active ? pm.color : 'transparent', color: active ? '#fff' : pm.color, transition: 'all 0.15s' }}>
                {pm.icon} {pm.label}
              </button>
            );
          })}
          {priorityFilter && <button onClick={() => setPriorityFilter('')} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear ✕</button>}
        </div>

        {/* Search + clear */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tasks..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {statusFilter && <button onClick={() => setStatusFilter('')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Clear ✕</button>}
        </div>

        {/* Feature 6: Bulk actions bar */}
        {selected.size > 0 && (
          <div style={{ background: 'var(--accent)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
            <button onClick={bulkMarkDone} disabled={bulkSaving}
              style={{ background: '#dcfce7', border: 'none', borderRadius: 6, color: '#16a34a', padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ✓ Mark Done
            </button>
            <button onClick={bulkDelete} disabled={bulkSaving}
              style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              🗑 Delete
            </button>
            <button onClick={() => setSelected(new Set())}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              ✕ Clear
            </button>
          </div>
        )}

        {/* Table / Kanban */}
        {viewMode === 'table' ? (
          <>
            <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id}
              onEdit={canEdit ? openEdit : undefined}
              onDelete={canEdit ? (r) => setDeleting(r) : undefined} />
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {STATUS_OPTIONS.map(s => {
              const m = STATUS_META[s];
              const lane = filtered.filter(t => t.status === s);
              return (
                <div key={s} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{m.icon} {m.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>{lane.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lane.map(t => {
                      const pm  = PRIORITY_META[parsePriority(t.priority)];
                      const bar = dueDateBar(t.due_date, t.status);
                      let st: Subtask[] = []; try { st = JSON.parse(t.subtasks || '[]'); } catch {}
                      const stDone = st.filter(s => s.done).length;
                      return (
                        <div key={t.id} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderLeft: `3px solid ${pm.color}`, borderRadius: 8, padding: '10px 12px' }}>
                          {/* Title + priority */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                            <span style={{ fontSize: 10, color: pm.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{pm.icon} {pm.label}</span>
                          </div>
                          {t.assignee_name && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>👤 {t.assignee_name}</div>}
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>📅 {formatDate(t.due_date)}</div>

                          {/* Feature 3: due date progress bar */}
                          {bar && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ background: 'var(--border)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${bar.pct}%`, height: '100%', background: bar.color, borderRadius: 4, transition: 'width 0.3s' }} />
                              </div>
                              <div style={{ fontSize: 10, color: bar.color, marginTop: 2, fontWeight: 600 }}>
                                {bar.daysLeft < 0 ? `${Math.abs(bar.daysLeft)}d overdue` : bar.daysLeft === 0 ? 'Due today' : `${bar.daysLeft}d left`}
                              </div>
                            </div>
                          )}

                          {/* Feature 4: subtask mini progress */}
                          {st.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              ✓ {stDone}/{st.length} subtasks
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                            {t.status !== 'completed' && (
                              <button onClick={() => quickDone(t)} style={{ background: '#dcfce7', border: 'none', borderRadius: 4, color: '#16a34a', padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
                            )}
                            {canEdit && (
                              <button onClick={() => openEdit(t)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {lane.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No tasks</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Task' : 'New Task'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          {/* Title */}
          <div className="form-group">
            <label style={lbl}>Title *</label>
            <input style={inp} {...register('title', { required: true })} />
          </div>

          {/* Description */}
          <div className="form-group">
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} {...register('description')} />
          </div>

          {/* Due + Status */}
          <div className="form-row">
            <div className="form-group">
              <label style={lbl}>Due Date *</label>
              <input type="date" style={inp} {...register('due_date', { required: true })} />
            </div>
            <div className="form-group">
              <label style={lbl}>Status</label>
              <select style={{ ...inp, cursor: 'pointer' }} {...register('status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>

          {/* Feature 1: Priority */}
          <div className="form-group">
            <label style={lbl}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITY_OPTIONS.map(p => {
                const pm = PRIORITY_META[p];
                const active = watch('priority') === p;
                return (
                  <label key={p} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, border: `2px solid ${active ? pm.color : 'var(--border)'}`, background: active ? pm.bg : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: active ? pm.color : 'var(--text-muted)' }}>
                    <input type="radio" value={p} {...register('priority')} style={{ display: 'none' }} />
                    {pm.icon} {pm.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Feature 2: Assignee name picker */}
          <div className="form-row">
            <div className="form-group">
              <label style={lbl}>Assign To</label>
              <select style={{ ...inp, cursor: 'pointer' }} {...register('assigned_to')}>
                <option value="">— Unassigned —</option>
                {labUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label style={lbl}>Reminder</label>
              <select style={{ ...inp, cursor: 'pointer' }} {...register('reminder_type')}>
                <option value="email">Email</option>
                <option value="dashboard">Dashboard</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>

          {/* Feature 4: Subtasks checklist */}
          <div className="form-group">
            <label style={lbl}>Subtasks / Checklist</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface2)' }}>
              {subtasks.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>No subtasks yet</div>}
              {subtasks.map(st => (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input type="checkbox" checked={st.done} onChange={() => toggleSubtask(st.id)} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', textDecoration: st.done ? 'line-through' : 'none', opacity: st.done ? 0.6 : 1 }}>{st.text}</span>
                  <button type="button" onClick={() => removeSubtask(st.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Add a subtask..."
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                  style={{ ...inp, flex: 1, padding: '6px 8px', fontSize: 12 }}
                />
                <button type="button" onClick={addSubtask}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                  + Add
                </button>
              </div>
              {subtasks.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {subtasks.filter(s => s.done).length}/{subtasks.length} completed
                </div>
              )}
            </div>
          </div>

          {/* Feature 5: Comments / Activity log */}
          <div className="form-group">
            <label style={lbl}>Comments & Activity</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', maxHeight: 200, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comments.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No comments yet</div>}
              {comments.map(c => (
                <div key={c.id} style={{ background: 'var(--surface)', borderRadius: 6, padding: '8px 10px', borderLeft: '3px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.author}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.text}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComment())}
                style={{ ...inp, flex: 1, padding: '6px 8px', fontSize: 12 }}
              />
              <button type="button" onClick={addComment}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                Post
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            {editing && canEdit && (
              <button type="button" className="btn btn-danger" onClick={() => { setDeleting(editing); setModalOpen(false); }}>Delete</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete "${deleting?.title}"?`} />
    </div>
  );
}
