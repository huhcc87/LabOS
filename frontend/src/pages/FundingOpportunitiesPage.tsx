import { useState } from 'react';

interface FundingOpportunity {
  id: string;
  title: string;
  agency: string;
  institute: string;
  type: string;
  deadline: string;
  amount: string;
  description: string;
  eligibility: string[];
  keywords: string[];
  url: string;
  isNew: boolean;
  isSaved: boolean;
}

// Empty initial state - search results will be populated dynamically
const INITIAL_OPPORTUNITIES: FundingOpportunity[] = [];

const AGENCIES = ['All', 'NIH', 'NSF', 'DoD', 'ACS', 'DOE', 'DARPA'];
const GRANT_TYPES = ['All', 'R01', 'R21', 'R03', 'K99/R00', 'CAREER', 'Idea Award', 'RSG'];
const INSTITUTES = ['All', 'NCI', 'NIAID', 'NINDS', 'NHLBI', 'NIGMS', 'NHGRI', 'BIO', 'CDMRP'];

export default function FundingOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>(INITIAL_OPPORTUNITIES);
  const [search, setSearch] = useState('');
  const [agency, setAgency] = useState('All');
  const [grantType, setGrantType] = useState('All');
  const [institute, setInstitute] = useState('All');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'deadline' | 'amount' | 'new'>('deadline');
  const [selectedOpp, setSelectedOpp] = useState<FundingOpportunity | null>(null);

  const filteredOpportunities = opportunities
    .filter(opp => {
      const matchesSearch = opp.title.toLowerCase().includes(search.toLowerCase()) ||
                            opp.description.toLowerCase().includes(search.toLowerCase()) ||
                            opp.keywords.some(k => k.toLowerCase().includes(search.toLowerCase()));
      const matchesAgency = agency === 'All' || opp.agency === agency;
      const matchesType = grantType === 'All' || opp.type === grantType;
      const matchesInstitute = institute === 'All' || opp.institute === institute;
      const matchesSaved = !showSavedOnly || opp.isSaved;
      return matchesSearch && matchesAgency && matchesType && matchesInstitute && matchesSaved;
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (sortBy === 'new') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      return 0;
    });

  const toggleSave = (id: string) => {
    setOpportunities(prev => prev.map(opp =>
      opp.id === id ? { ...opp, isSaved: !opp.isSaved } : opp
    ));
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funding Opportunity Finder</h1>
          <p className="page-subtitle">Search NIH, NSF, DoD, and foundation funding opportunities</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import from Grants.gov</button>
          <button className="btn btn-secondary">🔔 Set Alerts</button>
          <button className="btn btn-primary">🔄 Refresh Database</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Opportunities</span>
          <div className="metric-value">{opportunities.length}</div>
          <div className="metric-sub">Active FOAs</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">New This Week</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{opportunities.filter(o => o.isNew).length}</div>
          <div className="metric-sub">Recently posted</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Closing Soon</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>
            {opportunities.filter(o => getDaysUntilDeadline(o.deadline) <= 30).length}
          </div>
          <div className="metric-sub">Within 30 days</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Saved</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{opportunities.filter(o => o.isSaved).length}</div>
          <div className="metric-sub">Your watchlist</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by keyword, title, or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 250 }}
          />
          <select className="form-select" value={agency} onChange={(e) => setAgency(e.target.value)} style={{ width: 120 }}>
            {AGENCIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="form-select" value={grantType} onChange={(e) => setGrantType(e.target.value)} style={{ width: 130 }}>
            {GRANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-select" value={institute} onChange={(e) => setInstitute(e.target.value)} style={{ width: 130 }}>
            {INSTITUTES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showSavedOnly} onChange={(e) => setShowSavedOnly(e.target.checked)} />
            Saved only
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sort by:</span>
          {[
            { key: 'deadline', label: 'Deadline' },
            { key: 'new', label: 'Newest' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key as any)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: sortBy === s.key ? 'var(--accent)' : 'var(--surface2)',
                color: sortBy === s.key ? '#fff' : 'var(--text-soft)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedOpp ? '1fr 400px' : '1fr', gap: 24 }}>
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            {filteredOpportunities.length > 0 ? `Showing ${filteredOpportunities.length} opportunities` : 'No opportunities found'}
          </div>
          {filteredOpportunities.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Funding Opportunities Found</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                Click "Refresh Database" to search for funding opportunities from NIH, NSF, DoD, and foundations, or import from Grants.gov.
              </p>
              <button className="btn btn-primary">
                🔄 Search Funding Opportunities
              </button>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredOpportunities.map(opp => {
              const daysLeft = getDaysUntilDeadline(opp.deadline);
              const isUrgent = daysLeft <= 14;
              const isClosingSoon = daysLeft <= 30;

              return (
                <div
                  key={opp.id}
                  className="card"
                  onClick={() => setSelectedOpp(opp)}
                  style={{
                    cursor: 'pointer',
                    border: selectedOpp?.id === opp.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {opp.isNew && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                          }}>NEW</span>
                        )}
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                        }}>{opp.agency}</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: 'var(--surface2)',
                          color: 'var(--text-muted)',
                        }}>{opp.type}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opp.id}</span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                        {opp.title}
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12, lineHeight: 1.5 }}>
                        {opp.description.substring(0, 150)}...
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {opp.keywords.slice(0, 4).map(kw => (
                          <span key={kw} style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            background: 'var(--surface2)',
                            color: 'var(--text-soft)',
                          }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 20 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSave(opp.id); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: 20,
                          cursor: 'pointer',
                          marginBottom: 8,
                        }}
                      >
                        {opp.isSaved ? '⭐' : '☆'}
                      </button>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                        {opp.amount}
                      </div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isUrgent ? '#ef4444' : isClosingSoon ? '#f59e0b' : 'var(--text-soft)',
                      }}>
                        {isUrgent ? '🔴' : isClosingSoon ? '🟡' : '🟢'} {daysLeft} days left
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(opp.deadline).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedOpp && (
          <div className="card" style={{ position: 'sticky', top: 20, height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                }}>{selectedOpp.agency}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedOpp.id}</span>
              </div>
              <button onClick={() => setSelectedOpp(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, lineHeight: 1.4 }}>
              {selectedOpp.title}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Funding Amount</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{selectedOpp.amount}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Deadline</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{new Date(selectedOpp.deadline).toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Description</div>
              <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>{selectedOpp.description}</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Eligibility</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedOpp.eligibility.map(e => (
                  <div key={e} style={{ fontSize: 12, color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--success)' }}>✓</span> {e}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Keywords</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedOpp.keywords.map(kw => (
                  <span key={kw} style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}>{kw}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a
                href={selectedOpp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                🔗 View Full FOA
              </a>
              <button className="btn btn-secondary" onClick={() => window.location.hash = '#grant-compose'}>
                📝 Start Application
              </button>
              <button className="btn btn-secondary" onClick={() => toggleSave(selectedOpp.id)}>
                {selectedOpp.isSaved ? '⭐ Remove from Saved' : '☆ Save to Watchlist'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
