import { useState } from 'react';

interface Application {
  id: number;
  applicationNumber: string;
  grantNumber?: string;
  title: string;
  type: 'new' | 'resubmission' | 'renewal' | 'supplement';
  mechanism: string;
  institute: string;
  piName: string;
  submissionDate: string;
  receiptDate: string;
  councilDate?: string;
  currentStatus: string;
  statusDate: string;
  statusHistory: StatusEvent[];
  score?: number;
  percentile?: number;
  fundingDecision?: 'pending' | 'funded' | 'not_funded';
  justInTimeStatus?: 'not_requested' | 'requested' | 'submitted' | 'complete';
  awardDate?: string;
}

interface StatusEvent {
  status: string;
  date: string;
  details?: string;
}

const INITIAL_APPLICATIONS: Application[] = [];

export default function ERACommonsPage() {
  const [applications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredApps = applications.filter(app => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return app.fundingDecision === 'pending' || !app.fundingDecision;
    if (filterStatus === 'funded') return app.fundingDecision === 'funded';
    if (filterStatus === 'not_funded') return app.fundingDecision === 'not_funded';
    return true;
  });

  const pendingCount = applications.filter(a => a.fundingDecision === 'pending' || !a.fundingDecision).length;
  const fundedCount = applications.filter(a => a.fundingDecision === 'funded').length;
  const underReviewCount = applications.filter(a => a.currentStatus === 'Under Review').length;

  const getStatusColor = (status: string) => {
    if (status.includes('Award') || status.includes('Funded') || status === 'funded') return '#22c55e';
    if (status.includes('Not Funded') || status.includes('Not Selected') || status === 'not_funded') return '#ef4444';
    if (status.includes('Review') || status.includes('Pending')) return '#f59e0b';
    if (status.includes('Received') || status.includes('Assigned')) return '#3b82f6';
    if (status.includes('Just-in-Time')) return '#8b5cf6';
    return '#6b7280';
  };

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'funded': return { text: 'FUNDED', color: '#22c55e' };
      case 'not_funded': return { text: 'NOT FUNDED', color: '#ef4444' };
      default: return { text: 'PENDING', color: '#f59e0b' };
    }
  };

  const getJITStatusText = (status?: string) => {
    switch (status) {
      case 'requested': return 'JIT Requested';
      case 'submitted': return 'JIT Submitted';
      case 'complete': return 'JIT Complete';
      default: return null;
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">eRA Commons Status</h1>
          <p className="page-subtitle">Track NIH application status and funding decisions</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">Sync Status</button>
          <button className="btn btn-primary" onClick={() => window.open('https://commons.era.nih.gov', '_blank')}>
            Open eRA Commons
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Applications</span>
          <div className="metric-value">{applications.length}</div>
          <div className="metric-sub">All submissions</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Pending Decision</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>{pendingCount}</div>
          <div className="metric-sub">Awaiting outcome</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Funded</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{fundedCount}</div>
          <div className="metric-sub">Awards received</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#3b82f6' }}>
          <span className="metric-label">Under Review</span>
          <div className="metric-value" style={{ color: '#3b82f6' }}>{underReviewCount}</div>
          <div className="metric-sub">Currently reviewing</div>
        </div>
      </div>

      {/* JIT Alerts */}
      {applications.some(a => a.justInTimeStatus === 'requested') && (
        <div className="card" style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: '#8b5cf6', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>📋</span>
            <div>
              <div style={{ fontWeight: 600, color: '#8b5cf6' }}>Just-in-Time Information Requested</div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                {applications.filter(a => a.justInTimeStatus === 'requested').length} application(s) require JIT submission.
              </div>
            </div>
            <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}>Submit JIT</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="all">All Applications</option>
          <option value="pending">Pending Decision</option>
          <option value="funded">Funded</option>
          <option value="not_funded">Not Funded</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedApp ? '1fr 420px' : '1fr', gap: 24 }}>
        {/* Applications List */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredApps.map(app => {
              const decision = getDecisionBadge(app.fundingDecision);
              const jitStatus = getJITStatusText(app.justInTimeStatus);
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedApp?.id === app.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{app.applicationNumber}</span>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 600,
                          background: 'var(--surface2)',
                          textTransform: 'uppercase',
                        }}>
                          {app.type}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>{app.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {app.mechanism} • {app.institute} • PI: {app.piName}
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      background: `${decision.color}20`,
                      color: decision.color,
                    }}>
                      {decision.text}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getStatusColor(app.currentStatus),
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{app.currentStatus}</span>
                    </div>

                    {app.score && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Score: <span style={{ fontWeight: 600, color: app.score <= 30 ? '#22c55e' : '#f59e0b' }}>{app.score}</span>
                        {app.percentile && <span> ({app.percentile}%ile)</span>}
                      </div>
                    )}

                    {jitStatus && (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: '#8b5cf6',
                      }}>
                        {jitStatus}
                      </span>
                    )}

                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      Updated: {new Date(app.statusDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Application Details */}
        {selectedApp && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{selectedApp.applicationNumber}</span>
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, lineHeight: 1.4 }}>{selectedApp.title}</h3>

            {/* Score Card */}
            {selectedApp.score && (
              <div style={{
                padding: 16,
                background: selectedApp.score <= 20 ? 'rgba(34, 197, 94, 0.1)' :
                           selectedApp.score <= 30 ? 'rgba(245, 158, 11, 0.1)' :
                           'rgba(239, 68, 68, 0.1)',
                borderRadius: 8,
                marginBottom: 16,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Impact Score</div>
                <div style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: selectedApp.score <= 20 ? '#22c55e' :
                         selectedApp.score <= 30 ? '#f59e0b' : '#ef4444',
                }}>
                  {selectedApp.score}
                </div>
                {selectedApp.percentile && (
                  <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>{selectedApp.percentile}th percentile</div>
                )}
              </div>
            )}

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Type</div>
                <div style={{ fontSize: 13, textTransform: 'capitalize' }}>{selectedApp.type}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Mechanism</div>
                <div style={{ fontSize: 13 }}>{selectedApp.mechanism}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Institute</div>
                <div style={{ fontSize: 13 }}>{selectedApp.institute}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PI</div>
                <div style={{ fontSize: 13 }}>{selectedApp.piName}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Submission Date</div>
                <div style={{ fontSize: 13 }}>{new Date(selectedApp.submissionDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Council Date</div>
                <div style={{ fontSize: 13 }}>
                  {selectedApp.councilDate ? new Date(selectedApp.councilDate).toLocaleDateString() : 'TBD'}
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Current Status</div>
              <div style={{
                padding: 12,
                background: `${getStatusColor(selectedApp.currentStatus)}15`,
                borderRadius: 8,
                borderLeft: `4px solid ${getStatusColor(selectedApp.currentStatus)}`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: getStatusColor(selectedApp.currentStatus) }}>
                  {selectedApp.currentStatus}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  As of {new Date(selectedApp.statusDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Status History</div>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* Timeline line */}
                <div style={{
                  position: 'absolute',
                  left: 5,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  background: 'var(--border)',
                }} />

                {selectedApp.statusHistory.map((event, index) => (
                  <div key={index} style={{ position: 'relative', paddingBottom: 16 }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute',
                      left: -17,
                      top: 4,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: index === 0 ? getStatusColor(event.status) : 'var(--surface2)',
                      border: `2px solid ${getStatusColor(event.status)}`,
                    }} />

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: index === 0 ? getStatusColor(event.status) : 'var(--text)' }}>
                        {event.status}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                      {event.details && (
                        <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                          {event.details}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {selectedApp.justInTimeStatus === 'requested' && (
              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }}>Submit JIT Documents</button>
              </div>
            )}

            {selectedApp.fundingDecision === 'not_funded' && (
              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }}>View Summary Statement</button>
                <button className="btn btn-primary" style={{ flex: 1 }}>Start Resubmission</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Understanding Application Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Received/Assigned</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Application received and assigned to study section</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Under Review</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Being reviewed by scientific review group</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Just-in-Time</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Additional info requested prior to funding</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Award Issued</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grant has been funded</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
