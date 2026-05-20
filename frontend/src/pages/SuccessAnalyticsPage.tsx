import { useState, useEffect, useCallback } from 'react';
import { grantSubmissionsApi } from '../lib/api';

interface SuccessRate {
  institute: string;
  type: string;
  year: number;
  applications: number;
  funded: number;
  rate: number;
}

interface FundingTrend {
  year: number;
  totalBudget: number;
  rpdReview: number;
  applications: number;
  awards: number;
}

interface PersonalStats {
  totalSubmitted: number;
  totalFunded: number;
  successRate: number;
  totalFunding: number;
  avgScore: number;
  revisions: number;
}

const INITIAL_NIH_SUCCESS_RATES: SuccessRate[] = [];

const INITIAL_FUNDING_TRENDS: FundingTrend[] = [];

const INITIAL_PERSONAL_STATS: PersonalStats = {
  totalSubmitted: 0,
  totalFunded: 0,
  successRate: 0,
  totalFunding: 0,
  avgScore: 0,
  revisions: 0,
};

const INITIAL_MY_SUBMISSIONS: any[] = [];

export default function SuccessAnalyticsPage() {
  const [selectedInstitute, setSelectedInstitute] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [activeTab, setActiveTab] = useState<'nih' | 'personal'>('nih');
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSub, setNewSub] = useState({ title: '', grant_number: '', agency: 'NIH', institute: '', grant_type: 'R01', submitted_at: '', status: 'submitted', score: '', percentile: '', total_amount: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, analyticsRes] = await Promise.all([
        grantSubmissionsApi.list(1, 100),
        grantSubmissionsApi.analytics(),
      ]);
      setMySubmissions((listRes.data as any).items || []);
      setAnalytics(analyticsRes.data);
    } catch { /* no-op */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddSubmission = async () => {
    if (!newSub.title) return;
    try {
      await grantSubmissionsApi.create({
        ...newSub,
        score: newSub.score ? Number(newSub.score) : null,
        percentile: newSub.percentile ? Number(newSub.percentile) : null,
        total_amount: Number(newSub.total_amount) || 0,
      });
      setNewSub({ title: '', grant_number: '', agency: 'NIH', institute: '', grant_type: 'R01', submitted_at: '', status: 'submitted', score: '', percentile: '', total_amount: '', notes: '' });
      setShowAddModal(false);
      await load();
    } catch { /* no-op */ }
  };

  const handleDelete = async (id: number) => {
    await grantSubmissionsApi.delete(id);
    await load();
  };

  const personalStats: PersonalStats = analytics ? {
    totalSubmitted: analytics.total_submitted,
    totalFunded: analytics.total_funded,
    successRate: analytics.success_rate,
    totalFunding: analytics.total_funding,
    avgScore: analytics.avg_score || 0,
    revisions: mySubmissions.filter((s: any) => s.revision_number > 0).length,
  } : INITIAL_PERSONAL_STATS;

  const institutes = ['All', ...new Set(INITIAL_NIH_SUCCESS_RATES.map(r => r.institute))];
  const types = ['All', ...new Set(INITIAL_NIH_SUCCESS_RATES.map(r => r.type))];

  const filteredRates = INITIAL_NIH_SUCCESS_RATES.filter(r =>
    (selectedInstitute === 'All' || r.institute === selectedInstitute) &&
    (selectedType === 'All' || r.type === selectedType)
  );
  const avgSuccessRate = filteredRates.length > 0 ? filteredRates.reduce((sum, r) => sum + r.rate, 0) / filteredRates.length : 0;

  const INP: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Success Analytics</h1>
          <p className="page-subtitle">NIH funding rates, trends, and your personal statistics</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📊 Export Report</button>
          <button className="btn btn-secondary">🔄 Refresh Data</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="view-toggle" style={{ marginBottom: 24 }}>
        <button className={`view-toggle-btn ${activeTab === 'nih' ? 'active' : ''}`} onClick={() => setActiveTab('nih')}>
          🏛️ NIH Statistics
        </button>
        <button className={`view-toggle-btn ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
          👤 My Statistics
        </button>
      </div>

      {activeTab === 'nih' ? (
        <>
          {/* NIH Overview Stats */}
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card">
              <span className="metric-label">FY2024 NIH Budget</span>
              <div className="metric-value">$48.5B</div>
              <div className="metric-sub">+2.1% from FY2023</div>
            </div>
            <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
              <span className="metric-label">Avg Success Rate</span>
              <div className="metric-value" style={{ color: '#22c55e' }}>{avgSuccessRate.toFixed(1)}%</div>
              <div className="metric-sub">R01 + R21 combined</div>
            </div>
            <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
              <span className="metric-label">Total Applications</span>
              <div className="metric-value" style={{ color: '#6366f1' }}>63,456</div>
              <div className="metric-sub">FY2024 (est.)</div>
            </div>
            <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
              <span className="metric-label">Awards Made</span>
              <div className="metric-value" style={{ color: '#f59e0b' }}>12,987</div>
              <div className="metric-sub">FY2024 (est.)</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
            {/* Success Rates Table */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>📊 Success Rates by Institute</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <select
                    className="form-select"
                    value={selectedInstitute}
                    onChange={(e) => setSelectedInstitute(e.target.value)}
                    style={{ width: 120 }}
                  >
                    {institutes.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <select
                    className="form-select"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    style={{ width: 100 }}
                  >
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Institute</th>
                      <th>Grant Type</th>
                      <th>Applications</th>
                      <th>Funded</th>
                      <th>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRates.map((rate, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{rate.institute}</td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            background: 'var(--accent-light)',
                            color: 'var(--accent)',
                          }}>{rate.type}</span>
                        </td>
                        <td>{rate.applications.toLocaleString()}</td>
                        <td>{rate.funded.toLocaleString()}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 8, background: 'var(--surface2)', borderRadius: 4 }}>
                              <div style={{
                                width: `${(rate.rate / 25) * 100}%`,
                                height: '100%',
                                background: rate.rate > 20 ? '#22c55e' : rate.rate > 15 ? '#f59e0b' : '#ef4444',
                                borderRadius: 4,
                              }} />
                            </div>
                            <span style={{ fontWeight: 700, color: rate.rate > 20 ? '#22c55e' : rate.rate > 15 ? '#f59e0b' : '#ef4444' }}>
                              {rate.rate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Funding Trends */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>📈 5-Year Trends</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {INITIAL_FUNDING_TRENDS.map(trend => (
                  <div key={trend.year} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 50, fontWeight: 700, fontSize: 14 }}>{trend.year}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                        <span>Budget: ${trend.totalBudget}B</span>
                        <span>Rate: {((trend.awards / trend.applications) * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4 }}>
                        <div style={{
                          width: `${(trend.totalBudget / 50) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--accent), #818cf8)',
                          borderRadius: 4,
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, padding: 16, background: 'var(--surface2)', borderRadius: 10 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Key Insights</h4>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.8 }}>
                  <li>NIH budget increased 16% over 5 years</li>
                  <li>Application volume up 17% since 2020</li>
                  <li>Success rates relatively stable at 19-21%</li>
                  <li>NCI and NIAID remain most competitive</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Personal Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>My Grant Submissions</h3>
            <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>+ Add Submission</button>
          </div>
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card">
              <span className="metric-label">Total Submitted</span>
              <div className="metric-value">{personalStats.totalSubmitted}</div>
              <div className="metric-sub">Lifetime applications</div>
            </div>
            <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
              <span className="metric-label">Funded</span>
              <div className="metric-value" style={{ color: '#22c55e' }}>{personalStats.totalFunded}</div>
              <div className="metric-sub">Successful grants</div>
            </div>
            <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
              <span className="metric-label">Success Rate</span>
              <div className="metric-value" style={{ color: '#6366f1' }}>{personalStats.successRate}%</div>
              <div className="metric-sub">Personal success rate</div>
            </div>
            <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
              <span className="metric-label">Total Funding</span>
              <div className="metric-value" style={{ color: '#f59e0b' }}>${(personalStats.totalFunding / 1000000).toFixed(2)}M</div>
              <div className="metric-sub">Career total</div>
            </div>
          </div>

          {showAddModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 500, maxWidth: '95vw' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Add Grant Submission</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[['Grant Title*', 'title', 'text'], ['Grant Number', 'grant_number', 'text'], ['Agency', 'agency', 'text'], ['Institute', 'institute', 'text'], ['Grant Type', 'grant_type', 'text'], ['Submitted Date', 'submitted_at', 'date'], ['Score (1-90)', 'score', 'number'], ['Percentile', 'percentile', 'number'], ['Award Amount ($)', 'total_amount', 'number'], ['Notes', 'notes', 'text']].map(([label, key, type]) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input type={type} value={(newSub as any)[key]} onChange={e => setNewSub(p => ({ ...p, [key]: e.target.value }))} style={INP} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
                    <select value={newSub.status} onChange={e => setNewSub(p => ({ ...p, status: e.target.value }))} style={INP}>
                      {['submitted', 'under_review', 'scored', 'funded', 'rejected', 'withdrawn', 'deferred'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button onClick={handleAddSubmission} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                  <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
            {/* Submission History */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>My Submission History</h3>
              {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</p>}
              {!loading && mySubmissions.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No submissions yet. Click "+ Add Submission" to track your grants.</p>
              )}
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Grant Title</th>
                      <th>Type</th>
                      <th>Agency</th>
                      <th>Submitted</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySubmissions.map(sub => (
                      <tr key={sub.id}>
                        <td style={{ fontWeight: 500 }}>{sub.title}</td>
                        <td><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{sub.grant_type}</span></td>
                        <td>{sub.agency}</td>
                        <td>{sub.submitted_at || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{sub.score ?? '—'}</td>
                        <td><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sub.status === 'funded' ? 'rgba(34,197,94,0.15)' : sub.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: sub.status === 'funded' ? '#22c55e' : sub.status === 'rejected' ? '#ef4444' : '#fbbf24' }}>{sub.status}</span></td>
                        <td><button onClick={() => handleDelete(sub.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#f87171', fontSize: 14 }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Insights */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Score Distribution</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>Average Score</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{personalStats.avgScore || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>Funded on Revision</span>
                    <span style={{ fontWeight: 700 }}>{personalStats.revisions}</span>
                  </div>
                  {analytics?.by_type && Object.entries(analytics.by_type).map(([type, data]: [string, any]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{type}</span>
                      <span style={{ fontWeight: 600 }}>{data.funded}/{data.submitted} funded</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#22c55e' }}>✨ Your Strengths</h3>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.8 }}>
                  <li>Above-average success rate (42% vs 20%)</li>
                  <li>Strong scores at NCI and NIAID</li>
                  <li>Good track record with R21 mechanisms</li>
                </ul>
              </div>

              <div className="card" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f59e0b' }}>💡 Recommendations</h3>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.8 }}>
                  <li>Consider NHGRI for genomics grants</li>
                  <li>Approach scores improved on revision</li>
                  <li>Target institutes with higher success rates</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
