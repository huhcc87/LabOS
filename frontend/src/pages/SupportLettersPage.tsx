import { useState } from 'react';

interface LetterTemplate {
  id: number;
  name: string;
  type: 'institutional' | 'collaboration' | 'mentor' | 'resource' | 'commitment';
  description: string;
  sections: string[];
  usageCount: number;
}

interface SavedLetter {
  id: number;
  templateId: number;
  grantTitle: string;
  recipient: string;
  status: 'draft' | 'pending_signature' | 'signed' | 'submitted';
  createdDate: string;
  content: string;
}

const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    id: 1,
    name: 'Institutional Support Letter',
    type: 'institutional',
    description: 'Letter from department chair or dean confirming institutional support, resources, and protected time',
    sections: ['Introduction', 'Investigator Qualifications', 'Institutional Resources', 'Space & Equipment', 'Protected Time Commitment', 'Closing'],
    usageCount: 12,
  },
  {
    id: 2,
    name: 'Letter of Collaboration',
    type: 'collaboration',
    description: 'Letter from collaborating investigator confirming their role and contributions to the project',
    sections: ['Introduction', 'Collaborator Expertise', 'Specific Contributions', 'Resource Sharing', 'Closing'],
    usageCount: 28,
  },
  {
    id: 3,
    name: 'Mentor Support Letter (K Awards)',
    type: 'mentor',
    description: 'Letter from primary mentor for career development awards (K01, K08, K23, K99)',
    sections: ['Introduction', 'Mentee Qualifications', 'Training Plan', 'Research Environment', 'Mentor Commitment', 'Career Development Plan', 'Closing'],
    usageCount: 8,
  },
  {
    id: 4,
    name: 'Resource Access Letter',
    type: 'resource',
    description: 'Letter confirming access to core facilities, equipment, or specialized resources',
    sections: ['Introduction', 'Resource Description', 'Access Commitment', 'Pricing/Availability', 'Contact Information', 'Closing'],
    usageCount: 15,
  },
  {
    id: 5,
    name: 'Letter of Commitment',
    type: 'commitment',
    description: 'General letter confirming participation, effort, or support for the project',
    sections: ['Introduction', 'Role Description', 'Time Commitment', 'Specific Contributions', 'Closing'],
    usageCount: 22,
  },
];

const INITIAL_SAVED_LETTERS: SavedLetter[] = [];

const SAMPLE_CONTENT = `[Date]

[Recipient Name]
[Title]
[Institution]
[Address]

Dear [Grants Officer/Review Committee]:

I am writing to confirm my enthusiastic support for [PI Name]'s application titled "[Grant Title]" submitted to [Funding Agency].

[Body paragraphs specific to letter type]

Please do not hesitate to contact me if you require any additional information.

Sincerely,

[Signature]
[Name]
[Title]
[Institution]
[Contact Information]`;

export default function SupportLettersPage() {
  const [templates] = useState<LetterTemplate[]>(LETTER_TEMPLATES);
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>(INITIAL_SAVED_LETTERS);
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [editingLetter, setEditingLetter] = useState<SavedLetter | null>(null);
  const [letterContent, setLetterContent] = useState(SAMPLE_CONTENT);
  const [activeTab, setActiveTab] = useState<'templates' | 'saved'>('templates');
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorData, setGeneratorData] = useState({
    piName: 'Dr. Sarah Chen',
    grantTitle: '',
    fundingAgency: 'NIH',
    recipientName: '',
    recipientTitle: '',
    recipientInstitution: '',
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return '#22c55e';
      case 'submitted': return '#6366f1';
      case 'pending_signature': return '#f59e0b';
      default: return '#9ca3af';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'institutional': return '🏛️';
      case 'collaboration': return '🤝';
      case 'mentor': return '👨‍🏫';
      case 'resource': return '🔬';
      case 'commitment': return '✍️';
      default: return '📄';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Letters</h1>
          <p className="page-subtitle">Generate and manage letters of support for grant applications</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import Letter</button>
          <button className="btn btn-primary" onClick={() => setShowGenerator(true)}>+ Generate New Letter</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Letters</span>
          <div className="metric-value">{savedLetters.length}</div>
          <div className="metric-sub">In library</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Signed</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>
            {savedLetters.filter(l => l.status === 'signed').length}
          </div>
          <div className="metric-sub">Ready to submit</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Pending Signature</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>
            {savedLetters.filter(l => l.status === 'pending_signature').length}
          </div>
          <div className="metric-sub">Awaiting</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Templates</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{templates.length}</div>
          <div className="metric-sub">Available</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="view-toggle" style={{ marginBottom: 24 }}>
        <button className={`view-toggle-btn ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          📋 Letter Templates
        </button>
        <button className={`view-toggle-btn ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
          💾 Saved Letters ({savedLetters.length})
        </button>
      </div>

      {activeTab === 'templates' ? (
        /* Templates Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {templates.map(template => (
            <div
              key={template.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => { setSelectedTemplate(template); setShowGenerator(true); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>{getTypeIcon(template.type)}</span>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {template.type}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{template.name}</h3>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 16, lineHeight: 1.5 }}>
                {template.description}
              </p>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Sections
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {template.sections.slice(0, 4).map(section => (
                    <span key={section} style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      background: 'var(--surface2)',
                      color: 'var(--text-soft)',
                    }}>{section}</span>
                  ))}
                  {template.sections.length > 4 && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{template.sections.length - 4} more</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Used {template.usageCount} times</span>
                <button className="btn btn-sm btn-primary">Use Template →</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Saved Letters */
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grant</th>
                  <th>Letter Type</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedLetters.map(letter => {
                  const template = templates.find(t => t.id === letter.templateId);
                  return (
                    <tr key={letter.id}>
                      <td style={{ fontWeight: 500 }}>{letter.grantTitle}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{getTypeIcon(template?.type || '')}</span>
                          {template?.name}
                        </span>
                      </td>
                      <td>{letter.recipient}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${getStatusColor(letter.status)}20`,
                          color: getStatusColor(letter.status),
                          textTransform: 'capitalize',
                        }}>
                          {letter.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{new Date(letter.createdDate).toLocaleDateString()}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn-icon" title="Edit">✏️</button>
                          <button className="btn-icon" title="Download">📥</button>
                          <button className="btn-icon" title="Send for Signature">✉️</button>
                          <button className="btn-icon" title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Letter Generator Modal */}
      {showGenerator && (
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
        }} onClick={() => setShowGenerator(false)}>
          <div className="card" style={{ width: 900, maxWidth: '95%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>
                {getTypeIcon(selectedTemplate?.type || 'commitment')} Generate {selectedTemplate?.name || 'Support Letter'}
              </h3>
              <button onClick={() => setShowGenerator(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
              {/* Form */}
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Grant Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={generatorData.grantTitle}
                    onChange={e => setGeneratorData({ ...generatorData, grantTitle: e.target.value })}
                    placeholder="Novel CAR-T Cell Therapy..."
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Funding Agency</label>
                  <select
                    className="form-select"
                    value={generatorData.fundingAgency}
                    onChange={e => setGeneratorData({ ...generatorData, fundingAgency: e.target.value })}
                  >
                    <option value="NIH">NIH</option>
                    <option value="NSF">NSF</option>
                    <option value="DoD">DoD</option>
                    <option value="ACS">American Cancer Society</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>PI Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={generatorData.piName}
                    onChange={e => setGeneratorData({ ...generatorData, piName: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Letter Recipient</label>
                  <input
                    type="text"
                    className="form-input"
                    value={generatorData.recipientName}
                    onChange={e => setGeneratorData({ ...generatorData, recipientName: e.target.value })}
                    placeholder="Dr. John Smith"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Recipient Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={generatorData.recipientTitle}
                    onChange={e => setGeneratorData({ ...generatorData, recipientTitle: e.target.value })}
                    placeholder="Department Chair"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Recipient Institution</label>
                  <input
                    type="text"
                    className="form-input"
                    value={generatorData.recipientInstitution}
                    onChange={e => setGeneratorData({ ...generatorData, recipientInstitution: e.target.value })}
                    placeholder="MIT"
                  />
                </div>
                <button className="btn btn-primary btn-full">✨ Generate with AI</button>
              </div>

              {/* Letter Preview */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>LETTER PREVIEW</span>
                  <button className="btn btn-sm btn-secondary">📋 Copy</button>
                </div>
                <textarea
                  className="form-textarea"
                  value={letterContent}
                  onChange={(e) => setLetterContent(e.target.value)}
                  style={{ minHeight: 400, fontFamily: 'serif', fontSize: 13, lineHeight: 1.8 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowGenerator(false)}>Cancel</button>
              <button className="btn btn-secondary">💾 Save as Draft</button>
              <button className="btn btn-primary">📤 Export as DOCX</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
