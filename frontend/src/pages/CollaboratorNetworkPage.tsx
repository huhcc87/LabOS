import { useState } from 'react';

interface Collaborator {
  id: number;
  name: string;
  title: string;
  institution: string;
  department: string;
  email: string;
  expertise: string[];
  hIndex: number;
  publications: number;
  grants: number;
  avatar: string;
  status: 'active' | 'pending' | 'past';
  sharedGrants: string[];
  lastCollaboration: string;
  notes: string;
}

interface SharedDocument {
  id: number;
  name: string;
  type: 'grant' | 'manuscript' | 'protocol';
  sharedWith: string[];
  lastModified: string;
  status: 'editing' | 'review' | 'final';
}

// Empty initial state - user will add their own collaborators
const INITIAL_COLLABORATORS: Collaborator[] = [];
const INITIAL_DOCUMENTS: SharedDocument[] = [];

export default function CollaboratorNetworkPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>(INITIAL_COLLABORATORS);
  const [documents] = useState<SharedDocument[]>(INITIAL_DOCUMENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'past'>('all');
  const [selectedCollab, setSelectedCollab] = useState<Collaborator | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expertiseFilter, setExpertiseFilter] = useState('');

  const allExpertise = [...new Set(collaborators.flatMap(c => c.expertise))];

  const filteredCollaborators = collaborators.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.institution.toLowerCase().includes(search.toLowerCase()) ||
                          c.expertise.some(e => e.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesExpertise = !expertiseFilter || c.expertise.includes(expertiseFilter);
    return matchesSearch && matchesStatus && matchesExpertise;
  });

  const stats = {
    total: collaborators.length,
    active: collaborators.filter(c => c.status === 'active').length,
    pending: collaborators.filter(c => c.status === 'pending').length,
    institutions: new Set(collaborators.map(c => c.institution)).size,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Collaborator Network</h1>
          <p className="page-subtitle">Manage co-investigators, share documents, and build your research network</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import from ORCID</button>
          <button className="btn btn-secondary">🔍 Find Experts</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Collaborator</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Collaborators</span>
          <div className="metric-value">{stats.total}</div>
          <div className="metric-sub">In your network</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Active</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{stats.active}</div>
          <div className="metric-sub">Current projects</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Pending</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
          <div className="metric-sub">Awaiting response</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Institutions</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{stats.institutions}</div>
          <div className="metric-sub">Partner institutions</div>
        </div>
      </div>

      {/* Shared Documents */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>📄 Shared Documents</h3>
          <button className="btn btn-sm btn-secondary">+ Share New Document</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ padding: 16, background: 'var(--surface2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>
                  {doc.type === 'grant' ? '📝' : doc.type === 'manuscript' ? '📰' : '🧪'}
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  background: doc.status === 'final' ? 'rgba(34, 197, 94, 0.15)' :
                             doc.status === 'review' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: doc.status === 'final' ? '#22c55e' :
                         doc.status === 'review' ? '#f59e0b' : '#60a5fa',
                }}>
                  {doc.status}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Shared with: {doc.sharedWith.join(', ')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Last modified: {new Date(doc.lastModified).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="table-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, institution, or expertise..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <select
          className="form-select"
          value={expertiseFilter}
          onChange={(e) => setExpertiseFilter(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">All Expertise</option>
          {allExpertise.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div className="view-toggle">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'pending', label: 'Pending' },
            { key: 'past', label: 'Past' },
          ].map(f => (
            <button
              key={f.key}
              className={`view-toggle-btn ${statusFilter === f.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.key as any)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collaborators Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedCollab ? '1fr 380px' : '1fr', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredCollaborators.map(collab => (
            <div
              key={collab.id}
              className="card"
              onClick={() => setSelectedCollab(collab)}
              style={{
                cursor: 'pointer',
                border: selectedCollab?.id === collab.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {collab.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{collab.name}</span>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: collab.status === 'active' ? '#22c55e' :
                                 collab.status === 'pending' ? '#f59e0b' : '#9ca3af',
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 2 }}>{collab.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{collab.institution}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
                {collab.expertise.slice(0, 3).map(exp => (
                  <span key={exp} style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    background: 'var(--surface2)',
                    color: 'var(--text-soft)',
                  }}>{exp}</span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>h-index: {collab.hIndex}</span>
                <span>{collab.publications} pubs</span>
                <span>{collab.grants} grants</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedCollab && (
          <div className="card" style={{ position: 'sticky', top: 20, height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 24,
                fontWeight: 700,
              }}>
                {selectedCollab.avatar}
              </div>
              <button onClick={() => setSelectedCollab(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{selectedCollab.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 2 }}>{selectedCollab.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{selectedCollab.department}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 16 }}>{selectedCollab.institution}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{selectedCollab.hIndex}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>h-index</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedCollab.publications}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Publications</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedCollab.grants}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Grants</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Expertise</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedCollab.expertise.map(exp => (
                  <span key={exp} style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}>{exp}</span>
                ))}
              </div>
            </div>

            {selectedCollab.sharedGrants.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Shared Grants</div>
                {selectedCollab.sharedGrants.map(g => (
                  <div key={g} style={{ fontSize: 12, color: 'var(--text-soft)', padding: '4px 0' }}>📋 {g}</div>
                ))}
              </div>
            )}

            {selectedCollab.notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Notes</div>
                <p style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, margin: 0 }}>{selectedCollab.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={`mailto:${selectedCollab.email}`} className="btn btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                ✉️ Send Email
              </a>
              <button className="btn btn-secondary">📄 Share Document</button>
              <button className="btn btn-secondary">📋 Add to Grant</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Collaborator Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowAddModal(false)}>
          <div className="card" style={{ width: 500, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Add New Collaborator</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input type="text" className="form-input" placeholder="Dr. John Smith" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Title</label>
                  <input type="text" className="form-input" placeholder="Associate Professor" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email *</label>
                  <input type="email" className="form-input" placeholder="email@institution.edu" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Institution</label>
                <input type="text" className="form-input" placeholder="Harvard University" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Department</label>
                <input type="text" className="form-input" placeholder="Department of Biology" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Expertise (comma-separated)</label>
                <input type="text" className="form-input" placeholder="Immunology, Cancer Biology, T cells" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea className="form-textarea" placeholder="Add any notes about this collaborator..." style={{ minHeight: 80 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-primary" style={{ flex: 1 }}>+ Add Collaborator</button>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
