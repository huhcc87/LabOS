import { useState, useEffect, useCallback } from 'react';
import { biosketchApi } from '../lib/api';

interface PersonalInfo {
  name: string;
  position: string;
  institution: string;
  department: string;
  address: string;
  email: string;
  eraCommons: string;
  orcid: string;
}

interface Education {
  id: number;
  institution: string;
  degree: string;
  field: string;
  year: string;
}

interface Position {
  id: number;
  title: string;
  institution: string;
  startYear: string;
  endYear: string;
}

interface Publication {
  id: number;
  citation: string;
  pmid: string;
  isSelected: boolean;
}

interface Grant {
  id: number;
  number: string;
  title: string;
  role: string;
  dates: string;
  amount: string;
  status: 'active' | 'completed' | 'pending';
}

const INITIAL_PERSONAL: PersonalInfo = {
  name: '',
  position: '',
  institution: '',
  department: '',
  address: '',
  email: '',
  eraCommons: '',
  orcid: '',
};

const INITIAL_EDUCATION: Education[] = [];

const INITIAL_POSITIONS: Position[] = [];

const INITIAL_PUBLICATIONS: Publication[] = [];

const INITIAL_GRANTS: Grant[] = [];

const BIOSKETCH_FORMATS = [
  { value: 'nih', label: 'NIH Biosketch', desc: 'Standard NIH format (5 pages)' },
  { value: 'nsf', label: 'NSF Biographical Sketch', desc: 'NSF format (2 pages)' },
  { value: 'nih_fellowship', label: 'NIH Fellowship', desc: 'For F30/F31/F32 applications' },
  { value: 'cv', label: 'Full CV', desc: 'Complete academic CV' },
];

export default function BiosketchGeneratorPage() {
  const [personal, setPersonal] = useState<PersonalInfo>(INITIAL_PERSONAL);
  const [education, setEducation] = useState<Education[]>(INITIAL_EDUCATION);
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);
  const [publications, setPublications] = useState<Publication[]>(INITIAL_PUBLICATIONS);
  const [grants, setGrants] = useState<Grant[]>(INITIAL_GRANTS);
  const [personalStatement, setPersonalStatement] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('nih');
  const [activeSection, setActiveSection] = useState('personal');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await biosketchApi.get();
      const d = res.data as any;
      if (d.positions?.length) setPositions(d.positions);
      if (d.education?.length) setEducation(d.education);
      if (d.products?.length) setPublications(d.products.map((p: any, i: number) => ({ id: i + 1, citation: p.citation || p, pmid: p.pmid || '', isSelected: true })));
      if (d.research_support?.length) setGrants(d.research_support.map((g: any, i: number) => ({ id: i + 1, number: g.number || '', title: g.title || g, role: g.role || 'PI', dates: g.dates || '', amount: g.amount || '', status: g.status || 'active' })));
    } catch { /* no-op */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await biosketchApi.save({
        education,
        positions,
        products: publications.map(p => ({ citation: p.citation, pmid: p.pmid })),
        research_support: grants.map(g => ({ number: g.number, title: g.title, role: g.role, dates: g.dates, amount: g.amount, status: g.status })),
        honors: [],
        contributions: [],
      });
    } catch { /* no-op */ }
    setSaving(false);
  };

  const togglePublication = (id: number) => {
    setPublications(prev => prev.map(pub =>
      pub.id === id ? { ...pub, isSelected: !pub.isSelected } : pub
    ));
  };

  const selectedPubCount = publications.filter(p => p.isSelected).length;

  const sections = [
    { key: 'personal', label: 'Personal Info', icon: '👤' },
    { key: 'education', label: 'Education', icon: '🎓' },
    { key: 'positions', label: 'Positions', icon: '💼' },
    { key: 'statement', label: 'Personal Statement', icon: '📝' },
    { key: 'publications', label: 'Publications', icon: '📚' },
    { key: 'grants', label: 'Grants & Support', icon: '💰' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Biosketch Generator</h1>
          <p className="page-subtitle">Create NIH, NSF, and custom biosketches</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import from ORCID</button>
          <button className="btn btn-secondary" onClick={() => setShowPreview(true)}>👁️ Preview</button>
          <button className="btn btn-primary">📤 Export PDF</button>
        </div>
      </div>

      {/* Format Selection */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Select Biosketch Format</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {BIOSKETCH_FORMATS.map(format => (
            <button
              key={format.value}
              onClick={() => setSelectedFormat(format.value)}
              style={{
                padding: 16,
                borderRadius: 10,
                border: selectedFormat === format.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: selectedFormat === format.value ? 'var(--accent-light)' : 'var(--surface)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: selectedFormat === format.value ? 'var(--accent)' : 'var(--text)' }}>
                {format.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{format.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24 }}>
        {/* Section Navigation */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'fit-content' }}>
          {sections.map(section => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '14px 16px',
                border: 'none',
                borderLeft: activeSection === section.key ? '3px solid var(--accent)' : '3px solid transparent',
                background: activeSection === section.key ? 'var(--accent-light)' : 'transparent',
                color: activeSection === section.key ? 'var(--accent)' : 'var(--text-soft)',
                fontSize: 13,
                fontWeight: activeSection === section.key ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18 }}>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="card">
          {/* Personal Info Section */}
          {activeSection === 'personal' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>👤 Personal Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input type="text" className="form-input" value={personal.name} onChange={e => setPersonal({...personal, name: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Position/Title</label>
                  <input type="text" className="form-input" value={personal.position} onChange={e => setPersonal({...personal, position: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Institution</label>
                  <input type="text" className="form-input" value={personal.institution} onChange={e => setPersonal({...personal, institution: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Department</label>
                  <input type="text" className="form-input" value={personal.department} onChange={e => setPersonal({...personal, department: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Address</label>
                  <input type="text" className="form-input" value={personal.address} onChange={e => setPersonal({...personal, address: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" className="form-input" value={personal.email} onChange={e => setPersonal({...personal, email: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>eRA Commons ID</label>
                  <input type="text" className="form-input" value={personal.eraCommons} onChange={e => setPersonal({...personal, eraCommons: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>ORCID</label>
                  <input type="text" className="form-input" value={personal.orcid} onChange={e => setPersonal({...personal, orcid: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {/* Education Section */}
          {activeSection === 'education' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>🎓 Education & Training</h3>
                <button className="btn btn-sm btn-primary">+ Add Entry</button>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Degree</th>
                      <th>Field</th>
                      <th>Year</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {education.map(edu => (
                      <tr key={edu.id}>
                        <td style={{ fontWeight: 500 }}>{edu.institution}</td>
                        <td>{edu.degree}</td>
                        <td>{edu.field}</td>
                        <td>{edu.year}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn-icon">✏️</button>
                            <button className="btn-icon">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Positions Section */}
          {activeSection === 'positions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>💼 Positions & Employment</h3>
                <button className="btn btn-sm btn-primary">+ Add Position</button>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Institution</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => (
                      <tr key={pos.id}>
                        <td style={{ fontWeight: 500 }}>{pos.title}</td>
                        <td>{pos.institution}</td>
                        <td>{pos.startYear}</td>
                        <td>{pos.endYear}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn-icon">✏️</button>
                            <button className="btn-icon">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Personal Statement Section */}
          {activeSection === 'statement' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>📝 Personal Statement</h3>
                <button className="btn btn-sm btn-secondary">✨ AI Assist</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Describe your qualifications and experience relevant to this application. NIH recommends addressing:
                your role, your training, and why you are suited for the proposed work.
              </p>
              <textarea
                className="form-textarea"
                value={personalStatement}
                onChange={(e) => setPersonalStatement(e.target.value)}
                placeholder="I am an Associate Professor at MIT with over 10 years of experience in cancer immunotherapy research..."
                style={{ minHeight: 300, fontSize: 14, lineHeight: 1.7 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{personalStatement.split(/\s+/).filter(Boolean).length} words</span>
                <span>Recommended: 300-500 words</span>
              </div>
            </div>
          )}

          {/* Publications Section */}
          {activeSection === 'publications' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>📚 Publications</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Select up to 4 publications most relevant to this application
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: selectedPubCount <= 4 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedPubCount <= 4 ? '#22c55e' : '#ef4444',
                  }}>
                    {selectedPubCount}/4 selected
                  </span>
                  <button className="btn btn-sm btn-secondary">+ Add Publication</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {publications.map(pub => (
                  <div
                    key={pub.id}
                    onClick={() => togglePublication(pub.id)}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      border: pub.isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: pub.isSelected ? 'var(--accent-light)' : 'var(--surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={pub.isSelected}
                        onChange={() => togglePublication(pub.id)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{pub.citation}</p>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'inline-block' }}>
                          PMID: {pub.pmid}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grants Section */}
          {activeSection === 'grants' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>💰 Research Support</h3>
                <button className="btn btn-sm btn-primary">+ Add Grant</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {grants.map(grant => (
                  <div key={grant.id} style={{
                    padding: 16,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${grant.status === 'active' ? '#22c55e' : grant.status === 'completed' ? '#6366f1' : '#f59e0b'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{grant.number}</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            background: grant.status === 'active' ? 'rgba(34, 197, 94, 0.15)' :
                                       grant.status === 'completed' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: grant.status === 'active' ? '#22c55e' :
                                   grant.status === 'completed' ? '#6366f1' : '#f59e0b',
                            textTransform: 'uppercase',
                          }}>
                            {grant.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{grant.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Role: {grant.role} | {grant.dates}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{grant.amount}</div>
                        <div className="table-actions" style={{ marginTop: 8 }}>
                          <button className="btn-icon">✏️</button>
                          <button className="btn-icon">🗑️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
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
        }} onClick={() => setShowPreview(false)}>
          <div style={{
            width: '8.5in',
            maxWidth: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            background: '#fff',
            borderRadius: 8,
            padding: 40,
            fontFamily: 'Times New Roman, serif',
            fontSize: 12,
            lineHeight: 1.5,
            color: '#000',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>BIOGRAPHICAL SKETCH</h1>
              <p style={{ fontSize: 11, margin: 0 }}>Provide the following information for the Senior/key personnel and other significant contributors.</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: 8 }}>NAME: {personal.name}</div>
              <div>eRA COMMONS USER NAME: {personal.eraCommons}</div>
              <div>POSITION TITLE: {personal.position}</div>
              <div>EDUCATION/TRAINING:</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: 4 }}>INSTITUTION AND LOCATION</th>
                  <th style={{ textAlign: 'left', padding: 4 }}>DEGREE</th>
                  <th style={{ textAlign: 'left', padding: 4 }}>FIELD OF STUDY</th>
                  <th style={{ textAlign: 'left', padding: 4 }}>COMPLETION DATE</th>
                </tr>
              </thead>
              <tbody>
                {education.map(edu => (
                  <tr key={edu.id}>
                    <td style={{ padding: 4 }}>{edu.institution}</td>
                    <td style={{ padding: 4 }}>{edu.degree}</td>
                    <td style={{ padding: 4 }}>{edu.field}</td>
                    <td style={{ padding: 4 }}>{edu.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: 8 }}>
              A. Personal Statement
            </div>
            <p style={{ marginBottom: 16 }}>
              {personalStatement || 'No personal statement provided.'}
            </p>

            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: 8 }}>
              B. Positions, Scientific Appointments, and Honors
            </div>
            <div style={{ marginBottom: 16 }}>
              {positions.map(pos => (
                <div key={pos.id}>{pos.startYear}-{pos.endYear}: {pos.title}, {pos.institution}</div>
              ))}
            </div>

            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: 8 }}>
              C. Contributions to Science
            </div>
            <ol style={{ marginBottom: 16, paddingLeft: 20 }}>
              {publications.filter(p => p.isSelected).map(pub => (
                <li key={pub.id} style={{ marginBottom: 8 }}>{pub.citation}</li>
              ))}
            </ol>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => setShowPreview(false)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
