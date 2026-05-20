import { usePagedApi } from '../hooks/useApi';
import { auditApi, API_BASE_URL as API } from '../lib/api';
import type { AuditLog } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { formatDateTime } from '../lib/utils';
import { useState } from 'react';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

const ACTION_META: Record<string, { color: string; bg: string }> = {
  create: { color: '#16a34a', bg: '#dcfce7' },
  update: { color: '#6366f1', bg: '#e0e7ff' },
  delete: { color: '#ef4444', bg: '#fee2e2' },
};

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [chainResult, setChainResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const verifyChain = async () => {
    setVerifying(true);
    const r = await fetch(`${API}/audit/chain/verify`, { headers: authHeaders() });
    if (r.ok) setChainResult(await r.json());
    setVerifying(false);
  };
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading } = usePagedApi<AuditLog>(
    (p, pp, s) => auditApi.list(p, pp, s, actionFilter ? { action: actionFilter } : {})
  );

  const actionCounts = ['create', 'update', 'delete'].reduce((acc, a) => {
    acc[a] = items.filter(i => i.action === a).length;
    return acc;
  }, {} as Record<string, number>);

  // Get unique entity types
  const entityTypes = Array.from(new Set(items.map(i => i.entity_type).filter(Boolean)));

  const columns: Column<AuditLog>[] = [
    { key: 'action', header: 'Action', width: '90px', render: (r) => {
      const m = ACTION_META[r.action] || { color: '#94a3b8', bg: '#f1f5f9' };
      return <span style={{ background: m.bg, color: m.color, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>{r.action.toUpperCase()}</span>;
    }},
    { key: 'entity_type', header: 'Entity', render: (r) => (
      <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, padding: '2px 8px', borderRadius: 4, color: 'var(--text-soft)' }}>{r.entity_type}</span>
    )},
    { key: 'entity_id', header: 'ID', width: '60px', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{r.entity_id ?? '—'}</span> },
    { key: 'user_email', header: 'User', render: (r) => <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>{r.user_email}</span> },
    { key: 'changes_json', header: 'Changes', render: (r) => {
      try {
        const obj = JSON.parse(r.changes_json);
        const text = Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(', ');
        return <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{text.slice(0, 80)}{text.length > 80 ? '…' : ''}</span>;
      } catch {
        return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.changes_json?.slice(0, 80)}</span>;
      }
    }},
    { key: 'timestamp', header: 'Timestamp', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDateTime(r.timestamp)}</span> },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Audit Log</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} entries · {entityTypes.length} entity types</p>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Action breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {['create', 'update', 'delete'].map(a => {
            const m = ACTION_META[a];
            const active = actionFilter === a;
            return (
              <div key={a} onClick={() => setActionFilter(active ? '' : a)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: m.color }}>{actionCounts[a] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{a}d</div>
              </div>
            );
          })}
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by entity or user..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </div>

        {/* Timeline view for recent items */}
        {!loading && items.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700 }}>Recent Activity</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Latest {Math.min(items.length, 8)} entries</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {items.slice(0, 8).map((log, i) => {
                const m = ACTION_META[log.action] || { color: '#94a3b8', bg: '#f1f5f9' };
                return (
                  <div key={log.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 16px', borderBottom: i < 7 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ background: m.bg, color: m.color, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 3 }}>{log.action.toUpperCase()}</span>
                        <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>{log.entity_type} <strong style={{ color: 'var(--text)' }}>#{log.entity_id}</strong></span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>by {log.user_email}</span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDateTime(log.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Table columns={columns} data={items} loading={loading} rowKey={(r) => r.id} />
        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />

        {/* Tamper-evident chain verification */}
        <div style={{ marginTop: 28, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🔗 Tamper-Evident Chain Verification</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Each audit entry is SHA-256 hashed and linked to the previous entry. Verify integrity of the full chain.
              </p>
            </div>
            <button onClick={verifyChain} disabled={verifying}
              style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: verifying ? 0.6 : 1 }}>
              {verifying ? '⟳ Verifying…' : '🔍 Verify Chain'}
            </button>
          </div>

          {chainResult && (
            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: chainResult.valid ? '#22c55e11' : '#ef444411',
              border: `1px solid ${chainResult.valid ? '#22c55e44' : '#ef444444'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{chainResult.valid ? '✅' : '⚠️'}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: chainResult.valid ? '#22c55e' : '#ef4444' }}>
                  {chainResult.valid ? 'Chain Intact' : 'Tampering Detected'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {chainResult.entries_checked} entries checked
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{chainResult.message}</div>
              {chainResult.tampered_entries?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>TAMPERED ENTRIES:</div>
                  {chainResult.tampered_entries.map((e: any) => (
                    <div key={e.id} style={{ fontSize: 11, fontFamily: 'monospace', color: '#ef4444', marginBottom: 4 }}>
                      Entry #{e.id} ({e.timestamp.slice(0, 19)}) — {e.entity_type}<br/>
                      Expected: {e.expected_hash}<br/>
                      Stored:&nbsp;&nbsp; {e.stored_hash}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
