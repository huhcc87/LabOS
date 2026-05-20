import { useState } from 'react';

interface Grant {
  id: number;
  title: string;
  type: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'funded' | 'rejected';
  fundingAgency: string;
  deadline: string;
  amount: number;
  pi: string;
  progress: number;
  lastModified: string;
}

// Empty initial state - user will add their own grants
const INITIAL_GRANTS: Grant[] = [];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: 'Draft' },
  in_progress: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'In Progress' },
  submitted: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fbbf24', label: 'Submitted' },
  funded: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', label: 'Funded' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'Rejected' },
};

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>(INITIAL_GRANTS);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showNewGrant, setShowNewGrant] = useState(false);

  const filteredGrants = grants.filter(g => {
    const matchesFilter = filter === 'all' || g.status === filter;
    const matchesSearch = g.title.toLowerCase().includes(search.toLowerCase()) ||
                          g.pi.toLowerCase().includes(search.toLowerCase()) ||
                          g.type.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: grants.length,
    inProgress: grants.filter(g => g.status === 'in_progress').length,
    submitted: grants.filter(g => g.status === 'submitted').length,
    funded: grants.filter(g => g.status === 'funded').length,
    totalFunding: grants.filter(g => g.status === 'funded').reduce((sum, g) => sum + g.amount, 0),
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grant Writing & Management</h1>
          <p className="page-subtitle">Compose, track, and manage your research grants</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewGrant(true)}>
          + New Grant Proposal
        </button>
      </div>

      {/* Stats Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Grants</span>
          <div className="metric-value">{stats.total}</div>
          <div className="metric-sub">Active proposals</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#60a5fa' }}>
          <span className="metric-label">In Progress</span>
          <div className="metric-value" style={{ color: '#60a5fa' }}>{stats.inProgress}</div>
          <div className="metric-sub">Being written</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#fbbf24' }}>
          <span className="metric-label">Submitted</span>
          <div className="metric-value" style={{ color: '#fbbf24' }}>{stats.submitted}</div>
          <div className="metric-sub">Awaiting decision</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#4ade80' }}>
          <span className="metric-label">Total Funded</span>
          <div className="metric-value" style={{ color: '#4ade80' }}>${(stats.totalFunding / 1000000).toFixed(1)}M</div>
          <div className="metric-sub">{stats.funded} grants funded</div>
        </div>
      </div>

      {/* Upcoming Deadlines Alert - Only show when there are grants with upcoming deadlines */}
      {grants.length > 0 && grants.some(g => {
        const daysUntil = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil > 0 && daysUntil <= 60 && g.status !== 'funded' && g.status !== 'rejected';
      }) && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>⏰</span>
          <div>
            <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>Upcoming Deadlines</div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
              {grants.filter(g => {
                const daysUntil = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return daysUntil > 0 && daysUntil <= 60 && g.status !== 'funded' && g.status !== 'rejected';
              }).length} grant(s) due within 60 days.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="table-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search grants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="view-toggle">
          {['all', 'draft', 'in_progress', 'submitted', 'funded'].map(status => (
            <button
              key={status}
              className={`view-toggle-btn ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : STATUS_COLORS[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {/* Grants Grid */}
      {filteredGrants.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
          {filteredGrants.map(grant => (
            <div key={grant.id} className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: STATUS_COLORS[grant.status].bg,
                  color: STATUS_COLORS[grant.status].text,
                }}>
                  {STATUS_COLORS[grant.status].label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{grant.type}</span>
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                {grant.title}
              </h3>

              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>👤 {grant.pi}</div>
                <div style={{ marginBottom: 4 }}>🏛️ {grant.fundingAgency}</div>
                <div>💵 ${grant.amount.toLocaleString()}</div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ color: 'var(--text-soft)' }}>{grant.progress}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
                  <div style={{
                    height: '100%',
                    width: `${grant.progress}%`,
                    background: grant.progress === 100 ? 'var(--success)' : 'var(--accent)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Deadline: {new Date(grant.deadline).toLocaleDateString()}
                </span>
                <button className="btn btn-sm btn-secondary">Open →</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Grant Proposals Yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Start your first grant proposal to track your submissions, deadlines, and funding progress.
          </p>
          <button className="btn btn-primary" onClick={() => setShowNewGrant(true)}>
            + Create Your First Grant
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary">
            📋 Browse NIH FOAs
          </button>
          <button className="btn btn-secondary">
            📊 Funding Analytics
          </button>
          <button className="btn btn-secondary">
            📚 Reference Library
          </button>
          <button className="btn btn-secondary">
            👥 Collaborator Network
          </button>
        </div>
      </div>

      {/* New Grant Modal */}
      {showNewGrant && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>New Grant Proposal</h3>
              <button onClick={() => setShowNewGrant(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Grant Title</label>
              <input type="text" className="form-input" placeholder="Enter your grant title" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Grant Type</label>
              <select className="form-select">
                <option value="">Select type...</option>
                <option value="nih-r01">NIH R01 - Research Project Grant</option>
                <option value="nih-r21">NIH R21 - Exploratory/Developmental</option>
                <option value="nih-r03">NIH R03 - Small Research Grant</option>
                <option value="nih-k01">NIH K01 - Career Development Award</option>
                <option value="nsf-career">NSF CAREER</option>
                <option value="nsf-research">NSF Research Grant</option>
                <option value="dod">DoD Grant</option>
                <option value="foundation">Foundation Grant</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Funding Agency</label>
              <input type="text" className="form-input" placeholder="e.g., NIH/NCI, NSF, DoD" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label">Deadline</label>
                <input type="date" className="form-input" />
              </div>
              <div>
                <label className="form-label">Requested Amount ($)</label>
                <input type="number" className="form-input" placeholder="e.g., 2500000" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Principal Investigator</label>
              <input type="text" className="form-input" placeholder="Enter PI name" />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewGrant(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                // Add new grant logic would go here
                setShowNewGrant(false);
              }} style={{ flex: 1 }}>Create Grant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
