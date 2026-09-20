import { useState, useEffect, useMemo } from 'react';
import { activityApi } from '../lib/api';
import toast from 'react-hot-toast';
import { Pagination } from '../components/Table';

interface ActivityEvent {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string;
  user_id: number | null;
  user_name: string;
  timestamp: string;
  details: string;
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  create: { color: '#22c55e', icon: '+', label: 'Created' },
  update: { color: '#6366f1', icon: '✎', label: 'Updated' },
  delete: { color: '#ef4444', icon: '×', label: 'Deleted' },
  login: { color: '#64748b', icon: '→', label: 'Login' },
  logout: { color: '#64748b', icon: '←', label: 'Logout' },
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');

  async function fetchActivities() {
    setLoading(true);
    try {
      const res = await activityApi.list(page, perPage, entityFilter, undefined, actionFilter);
      setActivities(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivities();
  }, [page, perPage, actionFilter, entityFilter]);

  const entities = useMemo(() => Array.from(new Set(activities.map(a => a.entity_type))), [activities]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ActivityEvent[]> = {};
    activities.forEach(a => {
      const date = a.timestamp.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(a);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activities]);

  const stats = useMemo(() => ({
    total: total,
    today: activities.filter(a => a.timestamp.startsWith(new Date().toISOString().split('T')[0])).length,
    creates: activities.filter(a => a.action === 'create').length,
    updates: activities.filter(a => a.action === 'update').length,
  }), [activities, total]);

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function getConfig(action: string) {
    return TYPE_CONFIG[action] || { color: '#64748b', icon: '•', label: action };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Activity Timeline</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Recent activity across the lab</p>
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{stats.total}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Events</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{stats.today}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Today</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{stats.creates}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Created</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1' }}>{stats.updates}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Updated</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="">All Actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
            <option value="login">Login</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="">All Entities</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            Loading activities...
          </div>
        )}

        {/* Timeline */}
        {!loading && (
          <div style={{ maxWidth: 800 }}>
            {groupedByDate.map(([date, events]) => (
              <div key={date} style={{ marginBottom: 32 }}>
                <h3 style={{
                  margin: '0 0 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {formatDate(date)}
                </h3>
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                  {/* Timeline line */}
                  <div style={{
                    position: 'absolute',
                    left: 11,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: 'var(--border)',
                  }} />

                  {events.map((event, idx) => {
                    const config = getConfig(event.action);
                    return (
                      <div key={event.id} style={{
                        position: 'relative',
                        marginBottom: idx === events.length - 1 ? 0 : 16,
                      }}>
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute',
                          left: -32,
                          top: 4,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: config.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 700,
                          zIndex: 1,
                        }}>
                          {config.icon}
                        </div>

                        {/* Event card */}
                        <div style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: 16,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 600,
                              }}>
                                {event.user_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{event.user_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(event.timestamp)}</div>
                              </div>
                            </div>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: `${config.color}20`,
                              color: config.color,
                            }}>
                              {config.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, color: 'var(--text)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{event.entity_type}:</span>{' '}
                            <strong>{event.entity_name}</strong>
                          </div>
                          {event.details && event.details !== '{}' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                              {event.details}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
            <p>No activities found</p>
          </div>
        )}

        {!loading && activities.length > 0 && (
          <div style={{ marginTop: 20, maxWidth: 800 }}>
            <Pagination
              page={page}
              pages={totalPages}
              total={total}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
