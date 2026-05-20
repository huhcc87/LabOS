import { useState } from 'react';

interface Subcontract {
  id: number;
  grantNumber: string;
  grantTitle: string;
  subcontractorName: string;
  subcontractorInstitution: string;
  subcontractorEmail: string;
  totalAmount: number;
  currentYearAmount: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'active' | 'expired' | 'terminated';
  documentsStatus: {
    scopeOfWork: 'pending' | 'submitted' | 'approved';
    budget: 'pending' | 'submitted' | 'approved';
    biosketches: 'pending' | 'submitted' | 'approved';
    otherSupport: 'pending' | 'submitted' | 'approved';
    letter: 'pending' | 'submitted' | 'approved';
    faceSheet: 'pending' | 'submitted' | 'approved';
  };
  invoices: Invoice[];
  notes: string;
}

interface Invoice {
  id: number;
  period: string;
  amount: number;
  submittedDate: string;
  status: 'submitted' | 'approved' | 'paid' | 'rejected';
  paidDate?: string;
}

const INITIAL_SUBCONTRACTS: Subcontract[] = [];

export default function SubcontractManagerPage() {
  const [subcontracts] = useState<Subcontract[]>(INITIAL_SUBCONTRACTS);
  const [selectedSubcontract, setSelectedSubcontract] = useState<Subcontract | null>(null);
  const [showNewSubcontract, setShowNewSubcontract] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'invoices'>('overview');

  const totalSubcontractValue = subcontracts.reduce((sum, s) => sum + s.totalAmount, 0);
  const activeSubcontracts = subcontracts.filter(s => s.status === 'active').length;
  const pendingDocuments = subcontracts.reduce((count, s) => {
    return count + Object.values(s.documentsStatus).filter(status => status !== 'approved').length;
  }, 0);
  const pendingInvoices = subcontracts.reduce((count, s) => {
    return count + s.invoices.filter(i => i.status === 'submitted').length;
  }, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'approved': case 'paid': return '#22c55e';
      case 'pending': case 'submitted': return '#f59e0b';
      case 'expired': case 'rejected': return '#ef4444';
      case 'terminated': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getDocumentIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✓';
      case 'submitted': return '○';
      default: return '×';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subcontract Manager</h1>
          <p className="page-subtitle">Manage multi-institution collaborations and subcontract documentation</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowNewSubcontract(true)}>+ New Subcontract</button>
          <button className="btn btn-primary">Export All</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Subcontract Value</span>
          <div className="metric-value">{formatCurrency(totalSubcontractValue)}</div>
          <div className="metric-sub">Across all grants</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Active Subcontracts</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{activeSubcontracts}</div>
          <div className="metric-sub">Currently active</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Pending Documents</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>{pendingDocuments}</div>
          <div className="metric-sub">Need attention</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#3b82f6' }}>
          <span className="metric-label">Pending Invoices</span>
          <div className="metric-value" style={{ color: '#3b82f6' }}>{pendingInvoices}</div>
          <div className="metric-sub">Awaiting approval</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSubcontract ? '1fr 450px' : '1fr', gap: 24 }}>
        {/* Subcontracts List */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>All Subcontracts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subcontracts.map(sub => {
              const docsComplete = Object.values(sub.documentsStatus).filter(s => s === 'approved').length;
              const totalDocs = Object.keys(sub.documentsStatus).length;
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubcontract(sub)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedSubcontract?.id === sub.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{sub.grantNumber}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{sub.subcontractorInstitution}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{sub.subcontractorName}</div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      background: `${getStatusColor(sub.status)}20`,
                      color: getStatusColor(sub.status),
                      textTransform: 'uppercase',
                    }}>
                      {sub.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Value</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(sub.totalAmount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Year</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(sub.currentYearAmount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Documents</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: docsComplete === totalDocs ? '#22c55e' : '#f59e0b' }}>
                        {docsComplete}/{totalDocs}
                      </div>
                    </div>
                  </div>

                  {/* Document Status Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(sub.documentsStatus).map(([doc, status]) => (
                      <span key={doc} style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: `${getStatusColor(status)}15`,
                        color: getStatusColor(status),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <span>{getDocumentIcon(status)}</span>
                        {doc.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subcontract Details */}
        {selectedSubcontract && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{selectedSubcontract.grantNumber}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{selectedSubcontract.subcontractorInstitution}</h3>
              </div>
              <button onClick={() => setSelectedSubcontract(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            {/* Contact Info */}
            <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedSubcontract.subcontractorName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{selectedSubcontract.subcontractorEmail}</div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['overview', 'documents', 'invoices'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeTab === tab ? 'var(--accent)' : 'var(--surface2)',
                    color: activeTab === tab ? 'white' : 'var(--text-soft)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${getStatusColor(selectedSubcontract.status)}20`,
                      color: getStatusColor(selectedSubcontract.status),
                      textTransform: 'uppercase',
                    }}>
                      {selectedSubcontract.status}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Period</div>
                    <div style={{ fontSize: 12 }}>
                      {new Date(selectedSubcontract.startDate).toLocaleDateString()} - {new Date(selectedSubcontract.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Amount</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(selectedSubcontract.totalAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Current Year</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(selectedSubcontract.currentYearAmount)}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{selectedSubcontract.notes || 'No notes'}</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Grant</div>
                  <div style={{ fontSize: 13 }}>{selectedSubcontract.grantTitle}</div>
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Required Documents</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(selectedSubcontract.documentsStatus).map(([doc, status]) => (
                    <div key={doc} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      background: 'var(--surface2)',
                      borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${getStatusColor(status)}20`,
                          color: getStatusColor(status),
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {getDocumentIcon(status)}
                        </span>
                        <span style={{ fontSize: 13, textTransform: 'capitalize' }}>
                          {doc.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: `${getStatusColor(status)}20`,
                          color: getStatusColor(status),
                          textTransform: 'uppercase',
                        }}>
                          {status}
                        </span>
                        {status !== 'approved' && (
                          <button className="btn btn-sm btn-secondary">Upload</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}>Download All</button>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1 }}>Request Documents</button>
                </div>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Invoice History</div>
                  <button className="btn btn-sm btn-primary">+ Add Invoice</button>
                </div>

                {selectedSubcontract.invoices.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedSubcontract.invoices.map(invoice => (
                      <div key={invoice.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 12,
                        background: 'var(--surface2)',
                        borderRadius: 8,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{invoice.period}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Submitted: {new Date(invoice.submittedDate).toLocaleDateString()}
                            {invoice.paidDate && ` • Paid: ${new Date(invoice.paidDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(invoice.amount)}</div>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            background: `${getStatusColor(invoice.status)}20`,
                            color: getStatusColor(invoice.status),
                            textTransform: 'uppercase',
                          }}>
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No invoices yet
                  </div>
                )}

                {/* Invoice Summary */}
                <div style={{ marginTop: 16, padding: 12, background: 'var(--accent-light)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Invoiced</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatCurrency(selectedSubcontract.invoices.reduce((sum, i) => sum + i.amount, 0))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paid</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                      {formatCurrency(selectedSubcontract.invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remaining Budget</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatCurrency(selectedSubcontract.currentYearAmount - selectedSubcontract.invoices.reduce((sum, i) => sum + i.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Subcontract Modal */}
      {showNewSubcontract && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Add New Subcontract</h3>
              <button onClick={() => setShowNewSubcontract(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Parent Grant</label>
              <select className="form-select">
                <option value="">Select grant...</option>
                <option value="R01-CA234567">R01-CA234567 - Novel CAR-T Cell Therapy</option>
                <option value="R21-AI345678">R21-AI345678 - Microbiome-Immune Axis Study</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Subcontractor Institution</label>
              <input type="text" className="form-input" placeholder="e.g., Johns Hopkins University" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Subcontractor PI Name</label>
              <input type="text" className="form-input" placeholder="e.g., Dr. John Smith" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Subcontractor Email</label>
              <input type="email" className="form-input" placeholder="e.g., jsmith@jhu.edu" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label">Total Amount</label>
                <input type="number" className="form-input" placeholder="450000" />
              </div>
              <div>
                <label className="form-label">Current Year Amount</label>
                <input type="number" className="form-input" placeholder="150000" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" />
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" placeholder="Description of subcontractor's role..." style={{ minHeight: 80 }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewSubcontract(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }}>Create Subcontract</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
