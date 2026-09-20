import { useState } from 'react';

// Types
interface Incident {
  id: number;
  title: string;
  description: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'investigating' | 'resolved';
  location: string;
  reportedBy: string;
  date: string;
  resolution?: string;
}

interface Compliance {
  id: number;
  name: string;
  standard: string;
  status: 'compliant' | 'non-compliant' | 'pending' | 'in-review';
  lastAudit: string;
  nextAudit: string;
  auditor: string;
  notes: string;
}

interface Training {
  id: number;
  name: string;
  description: string;
  category: string;
  status: 'completed' | 'in_progress' | 'required' | 'expired';
  assignedTo: string;
  dueDate: string;
  completedDate?: string;
  certificate?: string;
}

// Constants
const INCIDENT_TYPES = ['Chemical Spill', 'Equipment Malfunction', 'Injury', 'Fire', 'Biohazard', 'Electrical', 'Slip/Fall', 'Other'];
const LOCATIONS = ['Lab 101', 'Lab 102', 'Lab 103', 'Storage Room', 'Common Area', 'Equipment Room', 'Office', 'Other'];
const TRAINING_CATEGORIES = ['Safety', 'Compliance', 'Technical', 'Equipment', 'Certification', 'Other'];
const COMPLIANCE_STANDARDS = ['GLP', 'GMP', 'ISO 17025', 'OSHA', '21 CFR Part 11', 'CLIA', 'CAP', 'Other'];

export default function SafetyHubPage() {
  const [activeTab, setActiveTab] = useState<'incidents' | 'compliance' | 'training'>('incidents');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Incidents state
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null);
  const [incidentFilter, setIncidentFilter] = useState({ status: '', severity: '' });
  const [newIncident, setNewIncident] = useState<{ title: string; description: string; type: string; severity: Incident['severity']; location: string; reportedBy: string }>({
    title: '', description: '', type: 'Chemical Spill', severity: 'low', location: 'Lab 101', reportedBy: ''
  });

  // Compliance state
  const [compliances, setCompliances] = useState<Compliance[]>([]);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [editingCompliance, setEditingCompliance] = useState<Compliance | null>(null);
  const [newCompliance, setNewCompliance] = useState({
    name: '', standard: 'GLP', lastAudit: '', nextAudit: '', auditor: '', notes: ''
  });

  // Training state
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [newTraining, setNewTraining] = useState({
    name: '', description: '', category: 'Safety', assignedTo: '', dueDate: ''
  });

  // Incident handlers
  const handleCreateIncident = () => {
    if (!newIncident.title) {
      showToast('Please enter incident title', 'error');
      return;
    }
    const incident: Incident = {
      id: Date.now(),
      ...newIncident,
      status: 'open',
      date: new Date().toISOString().slice(0, 10)
    };
    setIncidents(prev => [...prev, incident]);
    setNewIncident({ title: '', description: '', type: 'Chemical Spill', severity: 'low', location: 'Lab 101', reportedBy: '' });
    setShowIncidentModal(false);
    showToast('Incident reported!');
  };

  const handleUpdateIncident = () => {
    if (!editingIncident) return;
    setIncidents(prev => prev.map(i => i.id === editingIncident.id ? editingIncident : i));
    setEditingIncident(null);
    showToast('Incident updated!');
  };

  const handleDeleteIncident = (incident: Incident) => {
    setIncidents(prev => prev.filter(i => i.id !== incident.id));
    showToast('Incident deleted');
  };

  const handleIncidentStatus = (incident: Incident, status: Incident['status'], resolution?: string) => {
    setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status, resolution } : i));
    showToast(`Incident ${status}`);
    setViewingIncident(null);
  };

  // Compliance handlers
  const handleCreateCompliance = () => {
    if (!newCompliance.name) {
      showToast('Please enter compliance name', 'error');
      return;
    }
    const compliance: Compliance = {
      id: Date.now(),
      ...newCompliance,
      status: 'pending'
    };
    setCompliances(prev => [...prev, compliance]);
    setNewCompliance({ name: '', standard: 'GLP', lastAudit: '', nextAudit: '', auditor: '', notes: '' });
    setShowComplianceModal(false);
    showToast('Compliance record added!');
  };

  const handleUpdateCompliance = () => {
    if (!editingCompliance) return;
    setCompliances(prev => prev.map(c => c.id === editingCompliance.id ? editingCompliance : c));
    setEditingCompliance(null);
    showToast('Compliance updated!');
  };

  const handleDeleteCompliance = (compliance: Compliance) => {
    setCompliances(prev => prev.filter(c => c.id !== compliance.id));
    showToast('Compliance deleted');
  };

  const handleComplianceStatus = (compliance: Compliance, status: Compliance['status']) => {
    setCompliances(prev => prev.map(c => c.id === compliance.id ? { ...c, status } : c));
    showToast(`Status updated to ${status}`);
  };

  // Training handlers
  const handleCreateTraining = () => {
    if (!newTraining.name) {
      showToast('Please enter training name', 'error');
      return;
    }
    const training: Training = {
      id: Date.now(),
      ...newTraining,
      status: 'required'
    };
    setTrainings(prev => [...prev, training]);
    setNewTraining({ name: '', description: '', category: 'Safety', assignedTo: '', dueDate: '' });
    setShowTrainingModal(false);
    showToast('Training assigned!');
  };

  const handleUpdateTraining = () => {
    if (!editingTraining) return;
    setTrainings(prev => prev.map(t => t.id === editingTraining.id ? editingTraining : t));
    setEditingTraining(null);
    showToast('Training updated!');
  };

  const handleDeleteTraining = (training: Training) => {
    setTrainings(prev => prev.filter(t => t.id !== training.id));
    showToast('Training deleted');
  };

  const handleTrainingStatus = (training: Training, status: Training['status']) => {
    const updates: Partial<Training> = { status };
    if (status === 'completed') {
      updates.completedDate = new Date().toISOString().slice(0, 10);
    }
    setTrainings(prev => prev.map(t => t.id === training.id ? { ...t, ...updates } : t));
    showToast(`Training ${status.replace('_', ' ')}`);
  };

  // Filtered data
  const filteredIncidents = incidents.filter(i => {
    if (incidentFilter.status && i.status !== incidentFilter.status) return false;
    if (incidentFilter.severity && i.severity !== incidentFilter.severity) return false;
    return true;
  });

  const severityColors: Record<string, { bg: string; text: string }> = {
    low: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    medium: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    high: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    investigating: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    resolved: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    completed: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    in_progress: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    required: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    expired: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    compliant: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    'non-compliant': { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    pending: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    'in-review': { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  };

  const tabs = [
    { key: 'incidents', label: 'Incidents', icon: '⚠️', count: incidents.filter(i => i.status !== 'resolved').length },
    { key: 'compliance', label: 'Compliance', icon: '✅', count: compliances.length },
    { key: 'training', label: 'Training', icon: '🎓', count: trainings.filter(t => t.status === 'required').length },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 24, width: 500, maxHeight: '90vh', overflow: 'auto'
  };

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, padding: '12px 20px', borderRadius: 8,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
          color: 'white', fontWeight: 500, fontSize: 14, zIndex: 2000
        }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Quality & Safety</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage incidents, compliance, and training</p>
        </div>
        <button onClick={() => setShowHelpModal(true)} className="btn btn-secondary">
          ❓ How to Use
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Open Incidents', value: incidents.filter(i => i.status === 'open').length, icon: '🚨', color: '#f87171' },
          { label: 'Investigating', value: incidents.filter(i => i.status === 'investigating').length, icon: '🔍', color: '#fbbf24' },
          { label: 'Compliant', value: compliances.filter(c => c.status === 'compliant').length, icon: '✅', color: '#4ade80' },
          { label: 'Training Due', value: trainings.filter(t => t.status === 'required').length, icon: '🎓', color: '#60a5fa' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: -1
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'var(--accent)' : 'rgba(239,68,68,0.15)',
                color: activeTab === tab.key ? 'white' : '#f87171',
                padding: '2px 8px', borderRadius: 10, fontSize: 11
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div>
          {/* Filters & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <select
                className="form-select"
                value={incidentFilter.status}
                onChange={e => setIncidentFilter({ ...incidentFilter, status: e.target.value })}
                style={{ minWidth: 140 }}
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                className="form-select"
                value={incidentFilter.severity}
                onChange={e => setIncidentFilter({ ...incidentFilter, severity: e.target.value })}
                style={{ minWidth: 120 }}
              >
                <option value="">All Severity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {(incidentFilter.status || incidentFilter.severity) && (
                <button className="btn btn-secondary" onClick={() => setIncidentFilter({ status: '', severity: '' })}>
                  Clear Filters
                </button>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => setShowIncidentModal(true)}>+ Report Incident</button>
          </div>

          {incidents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Incidents Reported</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Report safety incidents to track and resolve them</p>
              <button className="btn btn-primary" onClick={() => setShowIncidentModal(true)}>+ Report First Incident</button>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No incidents match current filters</p>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setIncidentFilter({ status: '', severity: '' })}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredIncidents.map(inc => (
                <div key={inc.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: severityColors[inc.severity]?.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                    }}>
                      {inc.severity === 'high' ? '🚨' : inc.severity === 'medium' ? '⚠️' : '📋'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600 }}>{inc.title}</h4>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[inc.status]?.bg, color: statusColors[inc.status]?.text }}>
                          {inc.status}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: severityColors[inc.severity]?.bg, color: severityColors[inc.severity]?.text }}>
                          {inc.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {inc.type} • {inc.location} • {inc.date}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setViewingIncident(inc)}>👁️ View</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingIncident(inc)}>✏️ Edit</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteIncident(inc)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowComplianceModal(true)}>+ Add Compliance Record</button>
          </div>

          {compliances.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Compliance Records</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Track your regulatory compliance and audits</p>
              <button className="btn btn-primary" onClick={() => setShowComplianceModal(true)}>+ Add First Record</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {compliances.map(c => (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28 }}>{c.status === 'compliant' ? '✅' : c.status === 'non-compliant' ? '❌' : c.status === 'in-review' ? '🔍' : '⏳'}</span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{c.name}</h3>
                        <span style={{ fontSize: 11, color: 'var(--accent)' }}>{c.standard}</span>
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 500, background: statusColors[c.status]?.bg, color: statusColors[c.status]?.text }}>
                      {c.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    <div>Last Audit: {c.lastAudit || 'N/A'}</div>
                    <div>Next Audit: {c.nextAudit || 'N/A'}</div>
                    {c.auditor && <div>Auditor: {c.auditor}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none', flex: 1 }} onClick={() => handleComplianceStatus(c, 'compliant')}>✓ Compliant</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'none', flex: 1 }} onClick={() => handleComplianceStatus(c, 'in-review')}>🔍 Review</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => setEditingCompliance(c)}>✏️ Edit</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteCompliance(c)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Training Tab */}
      {activeTab === 'training' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Completed', value: trainings.filter(t => t.status === 'completed').length, color: '#4ade80' },
              { label: 'In Progress', value: trainings.filter(t => t.status === 'in_progress').length, color: '#60a5fa' },
              { label: 'Required', value: trainings.filter(t => t.status === 'required').length, color: '#f87171' },
              { label: 'Expired', value: trainings.filter(t => t.status === 'expired').length, color: '#6b7280' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowTrainingModal(true)}>+ Assign Training</button>
          </div>

          {trainings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Training Assigned</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Assign training to team members</p>
              <button className="btn btn-primary" onClick={() => setShowTrainingModal(true)}>+ Assign First Training</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {trainings.map(t => (
                <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      🎓
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</h4>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[t.status]?.bg, color: statusColors[t.status]?.text }}>
                          {t.status.replace('_', ' ')}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                          {t.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Assigned to: {t.assignedTo || 'Unassigned'} • Due: {t.dueDate || 'No deadline'}
                        {t.completedDate && ` • Completed: ${t.completedDate}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {t.status !== 'completed' && (
                      <>
                        {t.status === 'required' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'none' }} onClick={() => handleTrainingStatus(t, 'in_progress')}>▶️ Start</button>
                        )}
                        {t.status === 'in_progress' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none' }} onClick={() => handleTrainingStatus(t, 'completed')}>✓ Complete</button>
                        )}
                      </>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingTraining(t)}>✏️ Edit</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteTraining(t)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report/Edit Incident Modal */}
      {(showIncidentModal || editingIncident) && (
        <div style={modalStyle} onClick={() => { setShowIncidentModal(false); setEditingIncident(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingIncident ? 'Edit Incident' : 'Report Incident'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Incident Title *</label>
                <input type="text" className="form-input" placeholder="Brief description of incident"
                  value={editingIncident ? editingIncident.title : newIncident.title}
                  onChange={e => editingIncident ? setEditingIncident({ ...editingIncident, title: e.target.value }) : setNewIncident({ ...newIncident, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingIncident ? editingIncident.type : newIncident.type}
                    onChange={e => editingIncident ? setEditingIncident({ ...editingIncident, type: e.target.value }) : setNewIncident({ ...newIncident, type: e.target.value })}>
                    {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Severity</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingIncident ? editingIncident.severity : newIncident.severity}
                    onChange={e => editingIncident ? setEditingIncident({ ...editingIncident, severity: e.target.value as Incident['severity'] }) : setNewIncident({ ...newIncident, severity: e.target.value as Incident['severity'] })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Location</label>
                <select className="form-select" style={{ width: '100%' }}
                  value={editingIncident ? editingIncident.location : newIncident.location}
                  onChange={e => editingIncident ? setEditingIncident({ ...editingIncident, location: e.target.value }) : setNewIncident({ ...newIncident, location: e.target.value })}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" rows={3} placeholder="Detailed description..."
                  value={editingIncident ? editingIncident.description : newIncident.description}
                  onChange={e => editingIncident ? setEditingIncident({ ...editingIncident, description: e.target.value }) : setNewIncident({ ...newIncident, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Reported By</label>
                <input type="text" className="form-input" placeholder="Your name"
                  value={editingIncident ? editingIncident.reportedBy : newIncident.reportedBy}
                  onChange={e => editingIncident ? setEditingIncident({ ...editingIncident, reportedBy: e.target.value }) : setNewIncident({ ...newIncident, reportedBy: e.target.value })} />
              </div>
              {editingIncident && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingIncident.status}
                    onChange={e => setEditingIncident({ ...editingIncident, status: e.target.value as Incident['status'] })}>
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowIncidentModal(false); setEditingIncident(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingIncident ? handleUpdateIncident : handleCreateIncident} style={{ flex: 1 }}>
                {editingIncident ? 'Save Changes' : 'Report Incident'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Incident Modal */}
      {viewingIncident && (
        <div style={modalStyle} onClick={() => setViewingIncident(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{viewingIncident.title}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: statusColors[viewingIncident.status]?.bg, color: statusColors[viewingIncident.status]?.text }}>{viewingIncident.status}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: severityColors[viewingIncident.severity]?.bg, color: severityColors[viewingIncident.severity]?.text }}>{viewingIncident.severity}</span>
                </div>
              </div>
              <button onClick={() => setViewingIncident(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{viewingIncident.description || 'No description provided'}</p>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              <div>Type: {viewingIncident.type}</div>
              <div>Location: {viewingIncident.location}</div>
              <div>Reported by: {viewingIncident.reportedBy || 'Unknown'}</div>
              <div>Date: {viewingIncident.date}</div>
            </div>
            {viewingIncident.resolution && (
              <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>Resolution:</div>
                <p style={{ fontSize: 14 }}>{viewingIncident.resolution}</p>
              </div>
            )}
            {viewingIncident.status !== 'resolved' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Resolution Notes</label>
                <textarea id="resolution-notes" className="form-input" placeholder="How was this resolved?" rows={3} />
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  {viewingIncident.status === 'open' && (
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleIncidentStatus(viewingIncident, 'investigating')}>🔍 Start Investigation</button>
                  )}
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                    const resolution = (document.getElementById('resolution-notes') as HTMLTextAreaElement).value;
                    handleIncidentStatus(viewingIncident, 'resolved', resolution);
                  }}>✓ Mark Resolved</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Compliance Modal */}
      {(showComplianceModal || editingCompliance) && (
        <div style={modalStyle} onClick={() => { setShowComplianceModal(false); setEditingCompliance(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingCompliance ? 'Edit Compliance' : 'Add Compliance Record'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Compliance Name *</label>
                <input type="text" className="form-input" placeholder="e.g., GLP Certification"
                  value={editingCompliance ? editingCompliance.name : newCompliance.name}
                  onChange={e => editingCompliance ? setEditingCompliance({ ...editingCompliance, name: e.target.value }) : setNewCompliance({ ...newCompliance, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Standard</label>
                <select className="form-select" style={{ width: '100%' }}
                  value={editingCompliance ? editingCompliance.standard : newCompliance.standard}
                  onChange={e => editingCompliance ? setEditingCompliance({ ...editingCompliance, standard: e.target.value }) : setNewCompliance({ ...newCompliance, standard: e.target.value })}>
                  {COMPLIANCE_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Last Audit Date</label>
                  <input type="date" className="form-input"
                    value={editingCompliance ? editingCompliance.lastAudit : newCompliance.lastAudit}
                    onChange={e => editingCompliance ? setEditingCompliance({ ...editingCompliance, lastAudit: e.target.value }) : setNewCompliance({ ...newCompliance, lastAudit: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Next Audit Date</label>
                  <input type="date" className="form-input"
                    value={editingCompliance ? editingCompliance.nextAudit : newCompliance.nextAudit}
                    onChange={e => editingCompliance ? setEditingCompliance({ ...editingCompliance, nextAudit: e.target.value }) : setNewCompliance({ ...newCompliance, nextAudit: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Auditor</label>
                <input type="text" className="form-input" placeholder="Auditor name or company"
                  value={editingCompliance ? editingCompliance.auditor : newCompliance.auditor}
                  onChange={e => editingCompliance ? setEditingCompliance({ ...editingCompliance, auditor: e.target.value }) : setNewCompliance({ ...newCompliance, auditor: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea className="form-input" rows={3} placeholder="Additional notes..."
                  value={editingCompliance ? editingCompliance.notes : newCompliance.notes}
                  onChange={e => editingCompliance ? setEditingCompliance({ ...editingCompliance, notes: e.target.value }) : setNewCompliance({ ...newCompliance, notes: e.target.value })} />
              </div>
              {editingCompliance && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingCompliance.status}
                    onChange={e => setEditingCompliance({ ...editingCompliance, status: e.target.value as Compliance['status'] })}>
                    <option value="pending">Pending</option>
                    <option value="in-review">In Review</option>
                    <option value="compliant">Compliant</option>
                    <option value="non-compliant">Non-Compliant</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowComplianceModal(false); setEditingCompliance(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingCompliance ? handleUpdateCompliance : handleCreateCompliance} style={{ flex: 1 }}>
                {editingCompliance ? 'Save Changes' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Training Modal */}
      {(showTrainingModal || editingTraining) && (
        <div style={modalStyle} onClick={() => { setShowTrainingModal(false); setEditingTraining(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingTraining ? 'Edit Training' : 'Assign Training'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Training Name *</label>
                <input type="text" className="form-input" placeholder="e.g., Biosafety Level 2"
                  value={editingTraining ? editingTraining.name : newTraining.name}
                  onChange={e => editingTraining ? setEditingTraining({ ...editingTraining, name: e.target.value }) : setNewTraining({ ...newTraining, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                <select className="form-select" style={{ width: '100%' }}
                  value={editingTraining ? editingTraining.category : newTraining.category}
                  onChange={e => editingTraining ? setEditingTraining({ ...editingTraining, category: e.target.value }) : setNewTraining({ ...newTraining, category: e.target.value })}>
                  {TRAINING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Assigned To</label>
                <input type="text" className="form-input" placeholder="Team member name"
                  value={editingTraining ? editingTraining.assignedTo : newTraining.assignedTo}
                  onChange={e => editingTraining ? setEditingTraining({ ...editingTraining, assignedTo: e.target.value }) : setNewTraining({ ...newTraining, assignedTo: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Due Date</label>
                <input type="date" className="form-input"
                  value={editingTraining ? editingTraining.dueDate : newTraining.dueDate}
                  onChange={e => editingTraining ? setEditingTraining({ ...editingTraining, dueDate: e.target.value }) : setNewTraining({ ...newTraining, dueDate: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" rows={3} placeholder="Training description..."
                  value={editingTraining ? editingTraining.description : newTraining.description}
                  onChange={e => editingTraining ? setEditingTraining({ ...editingTraining, description: e.target.value }) : setNewTraining({ ...newTraining, description: e.target.value })} />
              </div>
              {editingTraining && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingTraining.status}
                    onChange={e => setEditingTraining({ ...editingTraining, status: e.target.value as Training['status'] })}>
                    <option value="required">Required</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowTrainingModal(false); setEditingTraining(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingTraining ? handleUpdateTraining : handleCreateTraining} style={{ flex: 1 }}>
                {editingTraining ? 'Save Changes' : 'Assign Training'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How to Use Modal */}
      {showHelpModal && (
        <div style={modalStyle} onClick={() => setShowHelpModal(false)}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>How to Use Quality & Safety</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ Incidents</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Report safety incidents with type, severity, and location</li>
                  <li>Track incident status: Open → Investigating → Resolved</li>
                  <li>Filter incidents by status or severity</li>
                  <li>Add resolution notes when closing incidents</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>✅ Compliance</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Track regulatory standards (GLP, GMP, ISO, OSHA, etc.)</li>
                  <li>Record audit dates and auditor information</li>
                  <li>Update compliance status: Pending → In Review → Compliant</li>
                  <li>Schedule next audit dates</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>🎓 Training</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Assign training to team members</li>
                  <li>Set due dates and track completion</li>
                  <li>Mark training as Started or Completed</li>
                  <li>Categorize by type: Safety, Compliance, Technical, etc.</li>
                </ul>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowHelpModal(false)} style={{ marginTop: 24, width: '100%' }}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
