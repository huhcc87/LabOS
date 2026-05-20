import { useState } from 'react';

interface Protocol {
  id: number;
  protocolNumber: string;
  title: string;
  type: 'irb' | 'iacuc';
  status: 'active' | 'pending' | 'expired' | 'suspended' | 'closed';
  pi: string;
  approvalDate: string;
  expirationDate: string;
  reviewType: 'full' | 'expedited' | 'exempt';
  riskLevel: 'minimal' | 'moderate' | 'greater';
  linkedGrants: string[];
  species?: string;
  animalCount?: number;
  humanSubjects?: number;
  amendments: number;
  continuingReviews: number;
  lastAction: string;
  nextAction?: string;
  nextActionDate?: string;
}

interface Amendment {
  id: number;
  protocolId: number;
  type: 'modification' | 'personnel' | 'consent' | 'protocol';
  description: string;
  submittedDate: string;
  status: 'submitted' | 'under_review' | 'approved' | 'revision_requested';
  reviewNotes?: string;
}

const INITIAL_PROTOCOLS: Protocol[] = [];

const INITIAL_AMENDMENTS: Amendment[] = [];

export default function IRBTrackerPage() {
  const [protocols] = useState<Protocol[]>(INITIAL_PROTOCOLS);
  const [amendments] = useState<Amendment[]>(INITIAL_AMENDMENTS);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'irb' | 'iacuc'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewProtocol, setShowNewProtocol] = useState(false);

  const filteredProtocols = protocols.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const getDaysUntilExpiration = (date: string) => {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'expired': return '#ef4444';
      case 'suspended': return '#ef4444';
      case 'closed': return '#6b7280';
      case 'approved': return '#22c55e';
      case 'under_review': return '#3b82f6';
      case 'submitted': return '#f59e0b';
      case 'revision_requested': return '#f97316';
      default: return '#9ca3af';
    }
  };

  const protocolAmendments = selectedProtocol
    ? amendments.filter(a => a.protocolId === selectedProtocol.id)
    : [];

  const activeCount = protocols.filter(p => p.status === 'active').length;
  const pendingCount = protocols.filter(p => p.status === 'pending').length;
  const expiringCount = protocols.filter(p => {
    const days = getDaysUntilExpiration(p.expirationDate);
    return days !== null && days > 0 && days <= 60;
  }).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">IRB/IACUC Protocol Tracker</h1>
          <p className="page-subtitle">Manage human subjects and animal research protocols</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowNewProtocol(true)}>+ New Protocol</button>
          <button className="btn btn-secondary">+ New Amendment</button>
          <button className="btn btn-primary">Export Report</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Active Protocols</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{activeCount}</div>
          <div className="metric-sub">Currently approved</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Pending Review</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>{pendingCount}</div>
          <div className="metric-sub">Awaiting approval</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#ef4444' }}>
          <span className="metric-label">Expiring Soon</span>
          <div className="metric-value" style={{ color: '#ef4444' }}>{expiringCount}</div>
          <div className="metric-sub">Within 60 days</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Total Protocols</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{protocols.length}</div>
          <div className="metric-sub">All time</div>
        </div>
      </div>

      {/* Alerts */}
      {expiringCount > 0 && (
        <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#ef4444' }}>Protocol Renewal Required</div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                {expiringCount} protocol(s) will expire within 60 days. Submit continuing review applications.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select
          className="form-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'irb' | 'iacuc')}
          style={{ width: 150 }}
        >
          <option value="all">All Types</option>
          <option value="irb">IRB Only</option>
          <option value="iacuc">IACUC Only</option>
        </select>
        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 150 }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedProtocol ? '1fr 400px' : '1fr', gap: 24 }}>
        {/* Protocols Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Protocol</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Expiration</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Linked Grants</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProtocols.map(protocol => {
                const daysLeft = getDaysUntilExpiration(protocol.expirationDate);
                const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 60;
                return (
                  <tr
                    key={protocol.id}
                    onClick={() => setSelectedProtocol(protocol)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedProtocol?.id === protocol.id ? 'var(--accent-light)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{protocol.protocolNumber}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, lineHeight: 1.3 }}>{protocol.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PI: {protocol.pi}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: protocol.type === 'irb' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: protocol.type === 'irb' ? '#6366f1' : '#10b981',
                        textTransform: 'uppercase',
                      }}>
                        {protocol.type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${getStatusColor(protocol.status)}20`,
                        color: getStatusColor(protocol.status),
                        textTransform: 'uppercase',
                      }}>
                        {protocol.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {protocol.expirationDate ? (
                        <div>
                          <div style={{ fontSize: 13 }}>{new Date(protocol.expirationDate).toLocaleDateString()}</div>
                          {daysLeft !== null && daysLeft > 0 && (
                            <div style={{
                              fontSize: 11,
                              color: isExpiring ? '#ef4444' : 'var(--text-muted)',
                              fontWeight: isExpiring ? 600 : 400,
                            }}>
                              {daysLeft} days left
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {protocol.linkedGrants.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {protocol.linkedGrants.map(grant => (
                            <span key={grant} style={{
                              padding: '2px 8px',
                              background: 'var(--surface2)',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 500,
                            }}>
                              {grant}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Protocol Details */}
        {selectedProtocol && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: selectedProtocol.type === 'irb' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: selectedProtocol.type === 'irb' ? '#6366f1' : '#10b981',
                  textTransform: 'uppercase',
                }}>
                  {selectedProtocol.type}
                </span>
              </div>
              <button onClick={() => setSelectedProtocol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{selectedProtocol.protocolNumber}</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, lineHeight: 1.4 }}>{selectedProtocol.title}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: `${getStatusColor(selectedProtocol.status)}20`,
                  color: getStatusColor(selectedProtocol.status),
                  textTransform: 'uppercase',
                }}>
                  {selectedProtocol.status}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Review Type</div>
                <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{selectedProtocol.reviewType}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Approval Date</div>
                <div style={{ fontSize: 13 }}>{selectedProtocol.approvalDate ? new Date(selectedProtocol.approvalDate).toLocaleDateString() : 'Pending'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Expiration</div>
                <div style={{ fontSize: 13 }}>{selectedProtocol.expirationDate ? new Date(selectedProtocol.expirationDate).toLocaleDateString() : 'Pending'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Risk Level</div>
                <div style={{ fontSize: 13, textTransform: 'capitalize' }}>{selectedProtocol.riskLevel}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {selectedProtocol.type === 'irb' ? 'Human Subjects' : 'Animals'}
                </div>
                <div style={{ fontSize: 13 }}>
                  {selectedProtocol.type === 'irb'
                    ? `${selectedProtocol.humanSubjects} enrolled`
                    : `${selectedProtocol.animalCount} ${selectedProtocol.species}`
                  }
                </div>
              </div>
            </div>

            {/* Next Action */}
            {selectedProtocol.nextAction && (
              <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Next Required Action</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedProtocol.nextAction}</div>
                <div style={{ fontSize: 12, color: 'var(--accent)' }}>
                  Due: {selectedProtocol.nextActionDate ? new Date(selectedProtocol.nextActionDate).toLocaleDateString() : 'TBD'}
                </div>
              </div>
            )}

            {/* Linked Grants */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Linked Grants</div>
              {selectedProtocol.linkedGrants.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedProtocol.linkedGrants.map(grant => (
                    <span key={grant} style={{
                      padding: '6px 12px',
                      background: 'var(--accent-light)',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--accent)',
                    }}>
                      {grant}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No linked grants</div>
              )}
            </div>

            {/* Amendments */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Amendments & Modifications</div>
              {protocolAmendments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {protocolAmendments.map(amendment => (
                    <div key={amendment.id} style={{ padding: 10, background: 'var(--surface2)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#6366f1',
                          textTransform: 'capitalize',
                        }}>
                          {amendment.type}
                        </span>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: `${getStatusColor(amendment.status)}20`,
                          color: getStatusColor(amendment.status),
                          textTransform: 'uppercase',
                        }}>
                          {amendment.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>{amendment.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Submitted: {new Date(amendment.submittedDate).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No amendments</div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }}>Submit Amendment</button>
              <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}>Continuing Review</button>
            </div>
          </div>
        )}
      </div>

      {/* New Protocol Modal */}
      {showNewProtocol && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>New Protocol Submission</h3>
              <button onClick={() => setShowNewProtocol(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Protocol Type</label>
              <select className="form-select">
                <option value="irb">IRB - Human Subjects Research</option>
                <option value="iacuc">IACUC - Animal Research</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Protocol Title</label>
              <input type="text" className="form-input" placeholder="Enter protocol title" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Review Type</label>
              <select className="form-select">
                <option value="exempt">Exempt</option>
                <option value="expedited">Expedited</option>
                <option value="full">Full Board Review</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Risk Level</label>
              <select className="form-select">
                <option value="minimal">Minimal Risk</option>
                <option value="moderate">Moderate Risk</option>
                <option value="greater">Greater Than Minimal Risk</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Link to Grant (Optional)</label>
              <select className="form-select">
                <option value="">Select grant...</option>
                <option value="R01-CA234567">R01-CA234567 - Novel CAR-T Cell Therapy</option>
                <option value="R21-AI345678">R21-AI345678 - Microbiome-Immune Axis Study</option>
                <option value="R01-CA456789">R01-CA456789 - Tumor Microenvironment</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewProtocol(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }}>Create Protocol</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
