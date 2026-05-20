import { useState } from 'react';

interface Template {
  id: number;
  name: string;
  type: string;
  agency: string;
  description: string;
  sections: string[];
  wordLimits: Record<string, number>;
  lastUsed: string;
  popularity: number;
  icon: string;
}

const TEMPLATES: Template[] = [
  {
    id: 1,
    name: 'NIH R01 Research Project',
    type: 'NIH R01',
    agency: 'NIH',
    description: 'Standard research project grant for established investigators. Up to 5 years, typically $250K-$500K/year direct costs.',
    sections: ['Abstract', 'Specific Aims', 'Significance', 'Innovation', 'Approach', 'Preliminary Data', 'Timeline', 'Budget'],
    wordLimits: { abstract: 300, aims: 500, significance: 1000, innovation: 600, approach: 3000, preliminary: 800 },
    lastUsed: '2024-04-10',
    popularity: 95,
    icon: '🔬',
  },
  {
    id: 2,
    name: 'NIH R21 Exploratory Grant',
    type: 'NIH R21',
    agency: 'NIH',
    description: 'Exploratory/developmental research for novel ideas. 2 years max, $275K total direct costs.',
    sections: ['Abstract', 'Specific Aims', 'Significance', 'Innovation', 'Approach'],
    wordLimits: { abstract: 250, aims: 450, significance: 800, innovation: 500, approach: 2000 },
    lastUsed: '2024-04-05',
    popularity: 78,
    icon: '💡',
  },
  {
    id: 3,
    name: 'NIH K99/R00 Pathway to Independence',
    type: 'NIH K99/R00',
    agency: 'NIH',
    description: 'Career transition award for postdocs to independent faculty. K99 (1-2 years) + R00 (up to 3 years).',
    sections: ['Abstract', 'Specific Aims', 'Candidate', 'Career Development', 'Research Strategy', 'Mentorship', 'Environment'],
    wordLimits: { abstract: 300, aims: 500, candidate: 1000, career: 800, research: 2500, mentorship: 600 },
    lastUsed: '2024-03-20',
    popularity: 65,
    icon: '🎓',
  },
  {
    id: 4,
    name: 'NSF CAREER Award',
    type: 'NSF CAREER',
    agency: 'NSF',
    description: 'Premier award for early-career faculty. Integrates research and education, 5 years.',
    sections: ['Project Summary', 'Project Description', 'Broader Impacts', 'Data Management', 'Facilities'],
    wordLimits: { summary: 300, description: 4000, impacts: 1000, data: 500 },
    lastUsed: '2024-02-15',
    popularity: 72,
    icon: '⭐',
  },
  {
    id: 5,
    name: 'DoD CDMRP Research Award',
    type: 'DoD',
    agency: 'Department of Defense',
    description: 'Congressionally Directed Medical Research Programs. Focus on military-relevant health issues.',
    sections: ['Abstract', 'Background', 'Hypothesis', 'Specific Aims', 'Research Strategy', 'Impact'],
    wordLimits: { abstract: 250, background: 600, hypothesis: 200, aims: 400, strategy: 2500, impact: 500 },
    lastUsed: '2024-01-10',
    popularity: 45,
    icon: '🎖️',
  },
  {
    id: 6,
    name: 'American Cancer Society Research Grant',
    type: 'Foundation',
    agency: 'ACS',
    description: 'Research grants for cancer research. Various funding levels available.',
    sections: ['Lay Summary', 'Scientific Abstract', 'Background', 'Specific Aims', 'Research Plan', 'Timeline'],
    wordLimits: { lay: 200, abstract: 300, background: 800, aims: 400, plan: 2000 },
    lastUsed: '2024-03-01',
    popularity: 58,
    icon: '🎗️',
  },
];

export default function GrantTemplatesPage() {
  const [templates] = useState<Template[]>(TEMPLATES);
  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesAgency = agencyFilter === 'all' || t.agency === agencyFilter;
    return matchesSearch && matchesAgency;
  });

  const agencies = [...new Set(templates.map(t => t.agency))];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grant Templates</h1>
          <p className="page-subtitle">Pre-configured templates for major funding agencies</p>
        </div>
        <button className="btn btn-primary">+ Create Custom Template</button>
      </div>

      {/* Filters */}
      <div className="table-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          value={agencyFilter}
          onChange={(e) => setAgencyFilter(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="all">All Agencies</option>
          {agencies.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Templates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
        {filteredTemplates.map(template => (
          <div key={template.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>{template.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {template.type}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{template.name}</h3>
                </div>
              </div>
              <span style={{
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
              }}>
                {template.agency}
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>
              {template.description}
            </p>

            {/* Sections Preview */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Sections Included
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {template.sections.map(section => (
                  <span key={section} style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    background: 'var(--surface2)',
                    color: 'var(--text-soft)',
                  }}>
                    {section}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ marginRight: 12 }}>📊 {template.popularity}% popularity</span>
                <span>📅 Last used: {new Date(template.lastUsed).toLocaleDateString()}</span>
              </div>
              <button className="btn btn-sm btn-primary">Use Template →</button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start Guide */}
      <div className="card" style={{ marginTop: 32, background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📚 Quick Start Guide</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>1. Choose a Template</h4>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              Select a template that matches your funding agency and grant type. Each template includes optimized sections and word limits.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>2. Draft with AI</h4>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              Use our AI-powered drafting to generate initial content based on your research goals and preliminary data.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>3. Check Compliance</h4>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              Our compliance checker ensures your grant meets all requirements before submission.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>4. Export & Submit</h4>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              Export to DOCX or PDF format ready for submission through your institution's grants office.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
