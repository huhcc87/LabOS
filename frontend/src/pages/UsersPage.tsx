import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authApi } from '../lib/api';
import type { User } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { RoleBadge } from '../components/RoleBadge';
import { formatDate } from '../lib/utils';

const ROLES = ['superadmin', 'admin', 'pi', 'manager', 'staff', 'trainee'];

const ROLE_META: Record<string, { color: string; bg: string }> = {
  superadmin: { color: '#9333ea', bg: '#f3e8ff' },
  admin: { color: '#dc2626', bg: '#fee2e2' },
  pi: { color: '#7c3aed', bg: '#ede9fe' },
  manager: { color: '#2563eb', bg: '#dbeafe' },
  staff: { color: '#16a34a', bg: '#dcfce7' },
  trainee: { color: '#d97706', bg: '#fef3c7' },
};

export default function UsersPage() {
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<User>(
    (p, pp, s) => authApi.listUsers(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = roleFilter ? items.filter(i => i.role === roleFilter) : items;
  const roleCounts = ROLES.reduce((acc, r) => { acc[r] = items.filter(i => i.role === r).length; return acc; }, {} as Record<string, number>);
  const activeCount = items.filter(i => i.is_active).length;

  function openCreate() { setEditing(null); reset({ full_name: '', email: '', password: '', role: 'staff', is_active: true }); setModalOpen(true); }
  function openEdit(row: User) { setEditing(row); reset({ full_name: row.full_name, email: row.email, role: row.role, is_active: row.is_active, password: '' }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, is_active: data.is_active === true || data.is_active === 'true' };
      if (editing) {
        if (!payload.password) delete payload.password;
        await authApi.updateUser(editing.id, payload);
        toast.success('User updated');
      } else {
        await authApi.createUser(payload);
        toast.success('User created');
      }
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await authApi.deleteUser(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<User>[] = [
    { key: 'full_name', header: 'Name', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: ROLE_META[r.role]?.bg || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ROLE_META[r.role]?.color || '#64748b', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {r.full_name.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.full_name}</span>
      </div>
    )},
    { key: 'email', header: 'Email', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.email}</span> },
    { key: 'role', header: 'Role', render: (r) => <RoleBadge role={r.role} /> },
    { key: 'is_active', header: 'Status', render: (r) => (
      <span style={{ background: r.is_active ? '#dcfce7' : '#fee2e2', color: r.is_active ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
        {r.is_active ? '● Active' : '○ Inactive'}
      </span>
    )},
    { key: 'created_at', header: 'Joined', render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Users</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} total · {activeCount} active</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['cards', 'table'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400 }}>
                  {m === 'cards' ? '⊞ Cards' : '☰ Table'}
                </button>
              ))}
            </div>
            <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New User</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Role breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
          {ROLES.map(r => {
            const m = ROLE_META[r];
            const active = roleFilter === r;
            return (
              <div key={r} onClick={() => setRoleFilter(active ? '' : r)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{roleCounts[r] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{r}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {roleFilter && <button onClick={() => setRoleFilter('')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Clear filter ✕</button>}
        </div>

        {viewMode === 'table' ? (
          <>
            <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id} onEdit={openEdit} onDelete={(r) => setDeleting(r)} />
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</div> : filtered.map(u => {
              const rm = ROLE_META[u.role] || { color: '#64748b', bg: '#f1f5f9' };
              return (
                <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: rm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: rm.color, fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>{u.full_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <RoleBadge role={u.role} />
                    <span style={{ background: u.is_active ? '#dcfce7' : '#fee2e2', color: u.is_active ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined {formatDate(u.created_at)}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(u)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 0', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                    <button onClick={() => setDeleting(u)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'New User'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Full Name *</label><input style={inp} {...register('full_name', { required: 'Required' })} />{errors.full_name && <span className="field-error">{String(errors.full_name.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>Email *</label><input type="email" style={inp} {...register('email', { required: 'Required' })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" style={inp} {...register('password', editing ? {} : { required: 'Required' })} /></div>
            <div className="form-group"><label style={lbl}>Role</label><select style={inp} {...register('role')}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
          <div className="form-group" style={{ paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" {...register('is_active')} defaultChecked style={{ width: 16, height: 16 }} />
              <span style={{ ...lbl, margin: 0 }}>Active account</span>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete user "${deleting?.email}"? This cannot be undone.`} />
    </div>
  );
}
