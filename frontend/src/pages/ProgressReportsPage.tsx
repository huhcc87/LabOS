import { useState } from 'react';

interface ProgressReport {
  id: number;
  grantNumber: string;
  grantTitle: string;
  reportType: 'annual' | 'final' | 'interim';
  reportingPeriod: string;
  dueDate: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved';
  progress: number;
  lastModified: string;
}

interface ReportSection {
  key: string;
  title: string;
  description: string;
  wordLimit?: number;
  required: boolean;
  status: 'not_started' | 'draft' | 'complete';
  content: string;
}

const INITIAL_REPORTS: ProgressReport[] = [];

const RPPR_SECTIONS: ReportSection[] = [
  { key: 'accomplishments', title: 'A. Accomplishments', description: 'What are the major goals of the project? What was accomplished under these goals?', wordLimit: 2000, required: true, status: 'not_started', content: '' },
  { key: 'products', title: 'B. Products', description: 'What has the project produced? Publications, patents, datasets, software, etc.', required: true, status: 'not_started', content: '' },
  { key: 'participants', title: 'C. Participants & Other Collaborating Organizations', description: 'Who has been involved? What organizations have been involved?', required: true, status: 'not_started', content: '' },
  { key: 'impact', title: 'D. Impact', description: 'What is the impact of the project? Describe the impact on the development of the principal discipline(s)', required: true, status: 'not_started', content: '' },
  { key: 'changes', title: 'E. Changes/Problems', description: 'What changes/problems has the project encountered? Changes in approach, delays, adverse conditions, etc.', required: false, status: 'not_started', content: '' },
  { key: 'specialRequirements', title: 'F. Special Reporting Requirements', description: 'Address any special reporting requirements specified in the terms and conditions.', required: false, status: 'not_started', content: '' },
  { key: 'budget', title: 'G. Budget', description: 'Is there any change in active support, foreign component, or budget? Attach revised budget if needed.', required: true, status: 'not_started', content: '' },
];

export default function ProgressReportsPage() {
  const [reports] = useState<ProgressReport[]>(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(null);
  const [sections, setSections] = useState<ReportSection[]>(RPPR_SECTIONS);
  const [activeSection, setActiveSection] = useState('accomplishments');

  const currentSection = sections.find(s => s.key === activeSection);
  const completedSections = sections.filter(s => s.status === 'complete').length;

  const handleUpdateSection = (key: string, content: string) => {
    setSections(prev => prev.map(s =>
      s.key === key ? { ...s, content, status: content.length > 50 ? 'draft' : 'not_started' } : s
    ));
  };

  const handleMarkComplete = (key: string) => {
    setSections(prev => prev.map(s =>
      s.key === key ? { ...s, status: 'complete' } : s
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#22c55e';
      case 'in_progress': return '#f59e0b';
      case 'approved': return '#6366f1';
      default: return '#9ca3af';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Progress Reports (RPPR)</h1>
          <p className="page-subtitle">Create and manage NIH Research Performance Progress Reports</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import Data</button>
          <button className="btn btn-secondary">📤 Export PDF</button>
          <button className="btn btn-primary">✅ Submit to eRA Commons</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Pending Reports</span>
          <div className="metric-value">{reports.filter(r => r.status !== 'submitted' && r.status !== 'approved').length}</div>
          <div className="metric-sub">To be completed</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Due This Month</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>
            {reports.filter(r => getDaysUntilDue(r.dueDate) <= 30 && r.status !== 'submitted').length}
          </div>
          <div className="metric-sub">Urgent</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Submitted</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>
            {reports.filter(r => r.status === 'submitted' || r.status === 'approved').length}
          </div>
          <div className="metric-sub">Completed</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Active Grants</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{reports.length}</div>
          <div className="metric-sub">Requiring reports</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedReport ? '350px 1fr' : '1fr', gap: 24 }}>
        {/* Reports List */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>📋 Reports Due</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map(report => {
              const daysLeft = getDaysUntilDue(report.dueDate);
              const isUrgent = daysLeft <= 30;
              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedReport?.id === report.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      background: `${getStatusColor(report.status)}20`,
                      color: getStatusColor(report.status),
                      textTransform: 'uppercase',
                    }}>
                      {report.status.replace('_', ' ')}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      background: report.reportType === 'final' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: report.reportType === 'final' ? '#ef4444' : '#3b82f6',
                      textTransform: 'uppercase',
                    }}>
                      {report.reportType}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
                    {report.grantNumber}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>
                    {report.grantTitle}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {report.reportingPeriod}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                      <span>Progress</span>
                      <span>{report.progress}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
                      <div style={{
                        height: '100%',
                        width: `${report.progress}%`,
                        background: report.progress === 100 ? '#22c55e' : 'var(--accent)',
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Due: {new Date(report.dueDate).toLocaleDateString()}</span>
                    <span style={{ fontWeight: 600, color: isUrgent ? '#ef4444' : 'var(--text-soft)' }}>
                      {daysLeft} days left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Report Editor */}
        {selectedReport && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
                  {selectedReport.grantNumber}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedReport.grantTitle}</h2>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {selectedReport.reportType.toUpperCase()} Report • {selectedReport.reportingPeriod}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sections Complete</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
                  {completedSections}/{sections.length}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
              {/* Section Navigation */}
              <div style={{ borderRight: '1px solid var(--border)', paddingRight: 16 }}>
                {sections.map(section => (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      marginBottom: 4,
                      borderRadius: 8,
                      border: 'none',
                      background: activeSection === section.key ? 'var(--accent-light)' : 'transparent',
                      color: activeSection === section.key ? 'var(--accent)' : 'var(--text-soft)',
                      fontSize: 12,
                      fontWeight: activeSection === section.key ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{section.title}</span>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: section.status === 'complete' ? '#22c55e' :
                                 section.status === 'draft' ? '#f59e0b' : '#e2e8f0',
                    }} />
                  </button>
                ))}
              </div>

              {/* Section Editor */}
              <div>
                {currentSection && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{currentSection.title}</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {currentSection.description}
                      </p>
                      {currentSection.required && (
                        <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>* Required</span>
                      )}
                    </div>

                    <textarea
                      className="form-textarea"
                      value={currentSection.content}
                      onChange={(e) => handleUpdateSection(currentSection.key, e.target.value)}
                      placeholder={`Enter content for ${currentSection.title}...`}
                      style={{ minHeight: 300, fontSize: 14, lineHeight: 1.7 }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {currentSection.content.split(/\s+/).filter(Boolean).length} words
                        {currentSection.wordLimit && ` / ${currentSection.wordLimit} max`}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-secondary">✨ AI Assist</button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleMarkComplete(currentSection.key)}
                        >
                          ✓ Mark Complete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
