import { useState } from 'react';

interface Resource {
  id: number;
  title: string;
  category: 'guidelines' | 'samples' | 'tips' | 'templates' | 'videos' | 'checklists';
  source: string;
  description: string;
  url?: string;
  content?: string;
  tags: string[];
  isFavorite: boolean;
}

interface WritingTip {
  id: number;
  section: string;
  tip: string;
  doExample?: string;
  dontExample?: string;
}

const WRITING_TIPS: WritingTip[] = [
  {
    id: 1,
    section: 'Specific Aims',
    tip: 'Start with a compelling hook that establishes the clinical or scientific problem.',
    doExample: 'Cancer remains the second leading cause of death in the United States, claiming over 600,000 lives annually.',
    dontExample: 'Cancer is a disease that affects many people and is important to study.',
  },
  {
    id: 2,
    section: 'Specific Aims',
    tip: 'Clearly state your hypothesis and how your aims will test it.',
    doExample: 'We hypothesize that XYZ pathway activation drives resistance to immunotherapy, and targeting this pathway will restore anti-tumor immunity.',
    dontExample: 'We will study the XYZ pathway because it might be important in cancer.',
  },
  {
    id: 3,
    section: 'Significance',
    tip: 'Quantify the impact of the problem using statistics and data.',
    doExample: 'Pancreatic cancer has a 5-year survival rate of only 11%, representing the lowest among all major cancers.',
    dontExample: 'Pancreatic cancer is very deadly and we need better treatments.',
  },
  {
    id: 4,
    section: 'Innovation',
    tip: 'Clearly articulate what is new about your approach compared to existing methods.',
    doExample: 'Unlike existing CAR-T therapies that target a single antigen, our dual-targeting approach simultaneously engages two tumor-specific markers.',
    dontExample: 'Our approach is innovative and different from what others have done.',
  },
  {
    id: 5,
    section: 'Approach',
    tip: 'Include preliminary data that demonstrates feasibility.',
    doExample: 'In our pilot study (n=15), we observed a 73% response rate with this treatment regimen (Figure 2A).',
    dontExample: 'We have done some preliminary experiments that show this might work.',
  },
  {
    id: 6,
    section: 'Approach',
    tip: 'Address potential pitfalls and alternative approaches proactively.',
    doExample: 'If siRNA knockdown is insufficient, we will generate CRISPR knockout cell lines (we have validated guide RNAs, Fig. S3).',
    dontExample: 'If this does not work, we will try something else.',
  },
  {
    id: 7,
    section: 'Budget',
    tip: 'Justify all costs with specific calculations and necessity.',
    doExample: 'Single-cell RNA-seq ($200/sample × 50 samples × 3 timepoints = $30,000) is required to identify the heterogeneous cell populations.',
    dontExample: 'We need money for sequencing experiments.',
  },
  {
    id: 8,
    section: 'General',
    tip: 'Use active voice and strong action verbs.',
    doExample: 'We will determine the mechanism by which...',
    dontExample: 'The mechanism will be determined...',
  },
];

const RESOURCES: Resource[] = [
  {
    id: 1,
    title: 'NIH Grant Writing Tips',
    category: 'guidelines',
    source: 'NIH Office of Extramural Research',
    description: 'Official NIH guidelines for writing competitive grant applications, including format requirements and review criteria.',
    url: 'https://grants.nih.gov/grants/how-to-apply-application-guide/format-and-write/write-your-application.htm',
    tags: ['NIH', 'official', 'guidelines'],
    isFavorite: true,
  },
  {
    id: 2,
    title: 'Specific Aims Page Template',
    category: 'templates',
    source: 'LabOS',
    description: 'A structured template for writing an effective Specific Aims page with sections for introduction, gap, hypothesis, and aims.',
    content: `SPECIFIC AIMS

[PARAGRAPH 1 - HOOK & IMPORTANCE]
[Start with a compelling statement about the clinical/scientific problem. Include statistics and establish urgency.]

[PARAGRAPH 2 - WHAT IS KNOWN]
[Summarize current knowledge and existing approaches. Establish your expertise.]

[PARAGRAPH 3 - GAP & BARRIER]
[Clearly identify what is NOT known and why this gap exists. What barrier has prevented progress?]

[PARAGRAPH 4 - LONG-TERM GOAL & OBJECTIVE]
The long-term goal of our research is to [broad impact statement]. The objective of this application is to [specific goal for this project].

[PARAGRAPH 5 - HYPOTHESIS & RATIONALE]
Our central hypothesis is that [testable hypothesis]. This hypothesis is supported by [preliminary data/rationale].

[PARAGRAPH 6 - AIMS]
Aim 1: [Action verb] [specific goal]. [Brief approach]. We hypothesize that [expected outcome].

Aim 2: [Action verb] [specific goal]. [Brief approach]. We hypothesize that [expected outcome].

Aim 3 (if applicable): [Action verb] [specific goal]. [Brief approach].

[FINAL PARAGRAPH - IMPACT]
[How will completing these aims advance the field? What is the expected outcome and its significance?]`,
    tags: ['template', 'specific aims', 'structure'],
    isFavorite: true,
  },
  {
    id: 3,
    title: 'Sample Scored R01 Applications',
    category: 'samples',
    source: 'NIAID',
    description: 'Collection of funded R01 applications with actual scores, summary statements, and reviewer feedback.',
    url: 'https://www.niaid.nih.gov/grants-contracts/sample-applications',
    tags: ['samples', 'R01', 'NIAID'],
    isFavorite: false,
  },
  {
    id: 4,
    title: 'Understanding NIH Review Criteria',
    category: 'guidelines',
    source: 'NIH CSR',
    description: 'Detailed explanation of how applications are scored based on significance, innovation, approach, investigators, and environment.',
    url: 'https://grants.nih.gov/grants/peer/guidelines_general/scoring_guidance_research.pdf',
    tags: ['review criteria', 'scoring', 'CSR'],
    isFavorite: true,
  },
  {
    id: 5,
    title: 'Pre-Submission Checklist',
    category: 'checklists',
    source: 'LabOS',
    description: 'Comprehensive checklist to ensure your application is complete before submission.',
    content: `PRE-SUBMISSION CHECKLIST

FORMATTING
□ All sections within page limits
□ Font: Arial 11pt or larger (Helvetica, Palatino, Georgia also accepted)
□ Margins: 0.5" minimum on all sides
□ Single-spaced text
□ Figures and tables legible when printed
□ No hyperlinks (except in references)

SPECIFIC AIMS (1 page)
□ Clear statement of problem/gap
□ Explicit hypothesis stated
□ Each aim has measurable outcomes
□ Impact statement included

RESEARCH STRATEGY (12 pages for R01)
□ Significance section addresses importance and impact
□ Innovation section highlights novel aspects
□ Approach includes detailed methodology
□ Preliminary data supports feasibility
□ Potential pitfalls addressed with alternatives
□ Timeline included (if required)

BIOSKETCHES
□ Current NIH format used
□ Personal statement tailored to this application
□ Positions and honors updated
□ Contributions to science (up to 5 narratives)
□ All key personnel included

BUDGET
□ Personnel effort accurately calculated
□ All costs justified in budget justification
□ Subcontract budgets and justifications included
□ F&A rates current and accurate
□ Modular vs detailed budget format correct

OTHER DOCUMENTS
□ Letters of support from collaborators
□ Resource sharing plan
□ Authentication of key resources
□ Vertebrate animals or human subjects sections
□ IRB/IACUC approval letters or pending status`,
    tags: ['checklist', 'submission', 'formatting'],
    isFavorite: true,
  },
  {
    id: 6,
    title: 'NSF CAREER Award Writing Guide',
    category: 'guidelines',
    source: 'NSF',
    description: 'Guidelines specific to NSF CAREER proposals including education and outreach requirements.',
    url: 'https://www.nsf.gov/pubs/2023/nsf23525/nsf23525.htm',
    tags: ['NSF', 'CAREER', 'guidelines'],
    isFavorite: false,
  },
  {
    id: 7,
    title: 'Responding to Reviewer Critiques',
    category: 'tips',
    source: 'LabOS',
    description: 'Strategies for effectively addressing reviewer concerns in resubmission applications.',
    content: `RESPONDING TO REVIEWER CRITIQUES

GENERAL PRINCIPLES
1. Thank reviewers for their feedback (briefly)
2. Address EVERY critique - never ignore
3. Be specific about what you changed
4. Point to exact pages/sections in revised application
5. Be professional, never defensive

RESPONSE FORMAT
For each critique:
- Quote or paraphrase the concern
- State your response clearly
- Reference specific changes with page numbers

EXAMPLE RESPONSE:
Critique: "The sample size calculation is not provided for Aim 2."
Response: "We appreciate this important point. We have now included a detailed power analysis on page 7 of the Research Strategy. Based on our pilot data (effect size d=0.8), we calculated that n=25 per group provides 80% power to detect significant differences at α=0.05."

WHEN YOU DISAGREE
- Acknowledge the reviewer's perspective
- Provide data or literature to support your position
- Consider if partial accommodation is possible

Example: "We understand the reviewer's concern about [X]. While we considered [alternative], our approach is supported by [references/data]. However, we have strengthened our rationale on page X by..."

STRENGTHENING LANGUAGE
- "We have now..." (shows action taken)
- "As suggested by the reviewer..." (shows responsiveness)
- "In response to this valuable feedback..."
- "We have strengthened..."
- "We have clarified..."`,
    tags: ['resubmission', 'A1', 'response'],
    isFavorite: true,
  },
  {
    id: 8,
    title: 'Grant Writing Webinar Series',
    category: 'videos',
    source: 'NIH NIGMS',
    description: 'Video series covering all aspects of NIH grant writing from program officers.',
    url: 'https://www.nigms.nih.gov/training/pages/webinars.aspx',
    tags: ['videos', 'webinar', 'NIGMS'],
    isFavorite: false,
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All Resources' },
  { key: 'guidelines', label: 'Guidelines' },
  { key: 'templates', label: 'Templates' },
  { key: 'samples', label: 'Sample Applications' },
  { key: 'tips', label: 'Writing Tips' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'videos', label: 'Videos' },
];

const SECTIONS = ['All', 'Specific Aims', 'Significance', 'Innovation', 'Approach', 'Budget', 'General'];

export default function WritingResourcesPage() {
  const [resources, setResources] = useState<Resource[]>(RESOURCES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [activeTab, setActiveTab] = useState<'resources' | 'tips'>('resources');
  const [selectedSection, setSelectedSection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResources = resources.filter(r => {
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !r.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredTips = WRITING_TIPS.filter(t => {
    if (selectedSection !== 'All' && t.section !== selectedSection) return false;
    return true;
  });

  const toggleFavorite = (id: number) => {
    setResources(prev => prev.map(r =>
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    ));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'guidelines': return '📋';
      case 'templates': return '📝';
      case 'samples': return '📄';
      case 'tips': return '💡';
      case 'checklists': return '✅';
      case 'videos': return '🎥';
      default: return '📚';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Writing Resources & Tips</h1>
          <p className="page-subtitle">Guidelines, templates, and best practices for successful grant applications</p>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Resources</span>
          <div className="metric-value">{resources.length}</div>
          <div className="metric-sub">Curated materials</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Writing Tips</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>{WRITING_TIPS.length}</div>
          <div className="metric-sub">Section-specific</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#ef4444' }}>
          <span className="metric-label">Favorites</span>
          <div className="metric-value" style={{ color: '#ef4444' }}>{resources.filter(r => r.isFavorite).length}</div>
          <div className="metric-sub">Saved resources</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Templates</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{resources.filter(r => r.category === 'templates').length}</div>
          <div className="metric-sub">Ready to use</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('resources')}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'resources' ? 'var(--accent)' : 'var(--surface2)',
            color: activeTab === 'resources' ? 'white' : 'var(--text-soft)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Resources & Templates
        </button>
        <button
          onClick={() => setActiveTab('tips')}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'tips' ? 'var(--accent)' : 'var(--surface2)',
            color: activeTab === 'tips' ? 'white' : 'var(--text-soft)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Writing Tips
        </button>
      </div>

      {activeTab === 'resources' && (
        <>
          {/* Search and Filter */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, maxWidth: 300 }}
            />
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: 180 }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedResource ? '1fr 450px' : '1fr', gap: 24 }}>
            {/* Resources Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filteredResources.map(resource => (
                <div
                  key={resource.id}
                  onClick={() => setSelectedResource(resource)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedResource?.id === resource.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{getCategoryIcon(resource.category)}</span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'var(--surface2)',
                        textTransform: 'capitalize',
                      }}>
                        {resource.category}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(resource.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                    >
                      {resource.isFavorite ? '★' : '☆'}
                    </button>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{resource.title}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    {resource.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{resource.source}</span>
                    {resource.url && (
                      <span style={{ fontSize: 11, color: 'var(--accent)' }}>External Link</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Resource Detail */}
            {selectedResource && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 24 }}>{getCategoryIcon(selectedResource.category)}</span>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--surface2)',
                      textTransform: 'capitalize',
                    }}>
                      {selectedResource.category}
                    </span>
                  </div>
                  <button onClick={() => setSelectedResource(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{selectedResource.title}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Source: {selectedResource.source}</div>
                <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 20, lineHeight: 1.6 }}>
                  {selectedResource.description}
                </p>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {selectedResource.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '4px 10px',
                      background: 'var(--accent-light)',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--accent)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Content or Link */}
                {selectedResource.content ? (
                  <div style={{
                    background: 'var(--surface2)',
                    borderRadius: 8,
                    padding: 16,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}>
                    <pre style={{
                      fontFamily: 'inherit',
                      fontSize: 12,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}>
                      {selectedResource.content}
                    </pre>
                  </div>
                ) : selectedResource.url && (
                  <a
                    href={selectedResource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
                  >
                    Open Resource
                  </a>
                )}

                {selectedResource.content && (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
                    Copy to Clipboard
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'tips' && (
        <>
          {/* Section Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {SECTIONS.map(section => (
              <button
                key={section}
                onClick={() => setSelectedSection(section)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: 'none',
                  background: selectedSection === section ? 'var(--accent)' : 'var(--surface2)',
                  color: selectedSection === section ? 'white' : 'var(--text-soft)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {section}
              </button>
            ))}
          </div>

          {/* Tips List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredTips.map(tip => (
              <div key={tip.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}>
                    {tip.section}
                  </span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
                  💡 {tip.tip}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {tip.doExample && (
                    <div style={{
                      padding: 12,
                      background: 'rgba(34, 197, 94, 0.1)',
                      borderRadius: 8,
                      borderLeft: '3px solid #22c55e',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>✓ DO</div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{tip.doExample}"
                      </div>
                    </div>
                  )}
                  {tip.dontExample && (
                    <div style={{
                      padding: 12,
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: 8,
                      borderLeft: '3px solid #ef4444',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>✗ DON'T</div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{tip.dontExample}"
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
