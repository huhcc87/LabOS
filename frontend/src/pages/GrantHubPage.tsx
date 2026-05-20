import { useState, useRef } from 'react';
import ResearchAITab from './ResearchAITab';
import { BudgetCalculator, BiosketschGenerator, SupportLetters, TemplatesLibrary, CollaboratorsManager } from './GrantTools';

// ============ TYPES ============
interface Grant {
  id: number;
  title: string;
  type: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'funded' | 'rejected';
  fundingAgency: string;
  deadline: string;
  amount: number;
  pi: string;
  progress: number;
  submittedDate?: string;
  reviewDate?: string;
  score?: string;
  decisionDate?: string;
  programOfficer?: string;
  studySection?: string;
  notes?: string;
}

interface UploadedFigure {
  id: number;
  name: string;
  url: string;
  type: string;
}

// ============ CONSTANTS ============
const GRANT_TYPES = [
  { value: 'r01', label: 'NIH R01', desc: 'Research Project Grant' },
  { value: 'r21', label: 'NIH R21', desc: 'Exploratory/Development' },
  { value: 'r03', label: 'NIH R03', desc: 'Small Research Grant' },
  { value: 'k99-r00', label: 'NIH K99/R00', desc: 'Pathway to Independence' },
  { value: 'f31', label: 'NIH F31', desc: 'Predoctoral Fellowship' },
  { value: 'f32', label: 'NIH F32', desc: 'Postdoctoral Fellowship' },
  { value: 'nsf-career', label: 'NSF CAREER', desc: 'Faculty Early Career' },
  { value: 'dod', label: 'DoD Research', desc: 'Department of Defense' },
  { value: 'foundation', label: 'Foundation Grant', desc: 'Private Foundation' },
];

const DISEASE_TYPES = [
  { value: 'colorectal', label: 'Colorectal Cancer' },
  { value: 'breast', label: 'Breast Cancer' },
  { value: 'lung', label: 'Lung Cancer' },
  { value: 'pancreatic', label: 'Pancreatic Cancer' },
  { value: 'prostate', label: 'Prostate Cancer' },
  { value: 'ovarian', label: 'Ovarian Cancer' },
  { value: 'leukemia', label: 'Leukemia' },
  { value: 'melanoma', label: 'Melanoma' },
  { value: 'other', label: 'Other Disease' },
];

const SECTIONS = [
  { key: 'abstract', label: 'Abstract', icon: '📋', target: 300 },
  { key: 'aims', label: 'Specific Aims', icon: '🎯', target: 500 },
  { key: 'significance', label: 'Significance', icon: '💡', target: 800 },
  { key: 'innovation', label: 'Innovation', icon: '✨', target: 400 },
  { key: 'approach', label: 'Approach', icon: '🔬', target: 2000 },
  { key: 'preliminary', label: 'Preliminary Data', icon: '📊', target: 500 },
  { key: 'timeline', label: 'Timeline', icon: '📅', target: 300 },
  { key: 'budget', label: 'Budget', icon: '💰', target: 400 },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: 'Draft' },
  in_progress: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'In Progress' },
  submitted: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fbbf24', label: 'Submitted' },
  funded: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', label: 'Funded' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'Rejected' },
};

const TOOLS = [
  { key: 'budget', label: 'Budget Calculator', icon: '🧮', desc: 'Calculate grant budgets with NIH rates' },
  { key: 'biosketch', label: 'Biosketch Generator', icon: '👤', desc: 'Generate NIH-format biosketches' },
  { key: 'references', label: 'Reference Manager', icon: '📚', desc: 'Manage citations and bibliography' },
  { key: 'letters', label: 'Support Letters', icon: '✉️', desc: 'Request and track support letters' },
  { key: 'collaborators', label: 'Collaborators', icon: '🤝', desc: 'Manage collaborator network' },
  { key: 'templates', label: 'Templates', icon: '📄', desc: 'Grant templates and examples' },
];

export default function GrantHubPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'grants' | 'tools' | 'budget' | 'reports' | 'irb' | 'tracker' | 'research_ai'>('compose');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Grants list state
  const [grants, setGrants] = useState<Grant[]>([]);
  const [showNewGrant, setShowNewGrant] = useState(false);
  const [newGrant, setNewGrant] = useState({ title: '', type: 'r01', agency: '', deadline: '', amount: '', pi: '' });

  // Tracker state
  const [trackerGrants, setTrackerGrants] = useState<Grant[]>([
    { id: 101, title: 'Targeting KRAS in Colorectal Cancer', type: 'NIH R01', status: 'funded', fundingAgency: 'NIH/NCI', deadline: '2024-02-05', amount: 2100000, pi: 'Dr. Chen', progress: 100, submittedDate: '2024-02-05', reviewDate: '2024-06-10', score: '8th percentile', decisionDate: '2024-09-15', programOfficer: 'Dr. Williams', studySection: 'ONC', notes: 'Funded for 5 years starting January 2025.' },
    { id: 102, title: 'Immunotherapy Resistance Mechanisms', type: 'NIH R21', status: 'rejected', fundingAgency: 'NIH/NCI', deadline: '2024-05-07', amount: 275000, pi: 'Dr. Patel', progress: 100, submittedDate: '2024-05-07', reviewDate: '2024-09-20', score: '42nd percentile', decisionDate: '2024-12-01', programOfficer: 'Dr. Johnson', studySection: 'IMDI', notes: 'Reviewers requested stronger preliminary data. Revising for resubmission.' },
    { id: 103, title: 'Single-Cell Atlas of Tumor Microenvironment', type: 'NIH R01', status: 'submitted', fundingAgency: 'NIH/NCI', deadline: '2024-10-05', amount: 1800000, pi: 'Dr. Kim', progress: 100, submittedDate: '2024-10-05', reviewDate: '2025-02-15', score: undefined, decisionDate: undefined, programOfficer: 'Dr. Brown', studySection: 'GGG', notes: 'Under review. Study section meeting Feb 2025.' },
    { id: 104, title: 'Metabolic Reprogramming in Pancreatic Cancer', type: 'NSF CAREER', status: 'in_progress', fundingAgency: 'NSF', deadline: '2025-07-17', amount: 500000, pi: 'Dr. Lee', progress: 45, submittedDate: undefined, reviewDate: undefined, score: undefined, decisionDate: undefined, programOfficer: 'Dr. Garcia', studySection: undefined, notes: 'Drafting specific aims. Targeting July 2025 deadline.' },
    { id: 105, title: 'Novel Biomarkers for Early Detection', type: 'NIH R03', status: 'submitted', fundingAgency: 'NIH/NCI', deadline: '2025-01-07', amount: 150000, pi: 'Dr. Martinez', progress: 100, submittedDate: '2025-01-07', reviewDate: '2025-05-08', score: undefined, decisionDate: undefined, programOfficer: 'Dr. Taylor', studySection: 'CBSS', notes: 'First submission. Awaiting review.' },
  ]);
  const [editingTracker, setEditingTracker] = useState<Grant | null>(null);
  const [trackerFilter, setTrackerFilter] = useState<string>('all');

  // Composer state
  const [title, setTitle] = useState('');
  const [grantType, setGrantType] = useState('r01');
  const [diseaseType, setDiseaseType] = useState('colorectal');
  const [activeSection, setActiveSection] = useState('abstract');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [figures, setFigures] = useState<UploadedFigure[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const figureInputRef = useRef<HTMLInputElement>(null);

  // Helper functions
  const getWordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleFigureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      setFigures(prev => [...prev, {
        id: Date.now() + Math.random(),
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
      }]);
    });
    e.target.value = '';
  };

  const handleAIDraft = (sectionKey: string) => {
    if (!title.trim()) {
      alert('Please enter a grant title first');
      return;
    }
    setAiLoading(true);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType)?.label || 'cancer';

    setTimeout(() => {
      const drafts: Record<string, string> = {
        abstract: `Background: ${disease} remains a significant clinical challenge. Recent evidence suggests that [your target/pathway] plays a critical role in disease progression.\n\nObjective: This proposal aims to investigate the mechanistic role of [your target] in ${disease}.\n\nMethods: We will employ in vitro cell models, patient-derived organoids, and in vivo mouse models.\n\nExpected Outcomes: This research will provide critical insights into ${disease} biology.\n\nImpact: Successful completion will advance our understanding and identify new treatment strategies.`,
        aims: `Specific Aim 1: Define the molecular mechanisms of [your target] in ${disease}\n• Hypothesis: [Your target] drives progression through [proposed mechanism]\n• Approach: CRISPR knockout, overexpression, pharmacological inhibition\n\nSpecific Aim 2: Evaluate therapeutic targeting in preclinical models\n• Hypothesis: Inhibiting [your target] will reduce tumor growth\n• Approach: Orthotopic mouse models and PDX\n\nSpecific Aim 3: Identify biomarkers for patient stratification\n• Hypothesis: Molecular signatures predict treatment response\n• Approach: Patient sample analysis`,
        significance: `${disease} represents a major public health burden with significant unmet medical need.\n\nGap in Knowledge: While [your target] has been implicated in ${disease}, the precise molecular mechanisms remain poorly understood.\n\nSignificance:\n1. Addresses a critical barrier in ${disease} research\n2. Provides mechanistic insights with therapeutic implications\n3. Develops clinically relevant preclinical models\n4. Identifies actionable biomarkers for precision medicine`,
        innovation: `This proposal is innovative in several key aspects:\n\n1. Novel Target: First systematic investigation of [your target] in ${disease}\n\n2. Cutting-edge Technology:\n   • CRISPR-based genetic screens\n   • Single-cell RNA sequencing\n   • Patient-derived organoid models\n\n3. Translational Framework: Direct integration of basic research with clinical application\n\n4. Precision Medicine Approach: Biomarker-guided treatment strategies`,
        approach: `Research Design and Methods:\n\nAim 1: Mechanistic Studies\n• Cell line models for initial characterization\n• CRISPR knockout/knockin approaches\n• Biochemical assays: Western blot, IP, mass spectrometry\n• Functional assays: Proliferation, migration, invasion\n\nAim 2: Preclinical Evaluation\n• Mouse models: Orthotopic implantation and PDX\n• Treatment regimens: Single agent and combinations\n• Endpoints: Tumor growth, metastasis, survival\n\nAim 3: Biomarker Development\n• Patient cohort analysis (n=200+ samples)\n• IHC, RNA-seq, DNA sequencing\n• Independent cohort validation`,
        preliminary: `Our preliminary data support the proposed research:\n\nFigure 1: [Your target] is overexpressed in ${disease}\n• TCGA analysis shows 3-fold upregulation\n• Validated in patient samples (n=50)\n\nFigure 2: Knockdown reduces proliferation\n• CRISPR knockout shows 60% reduction\n• Rescued by re-expression\n\nFigure 3: Pharmacological inhibition shows efficacy\n• Small molecule reduces tumor growth in pilot study`,
        timeline: `Year 1:\n• Q1-Q2: Establish cell line models, optimize assays\n• Q3-Q4: Complete Aim 1 genetic studies\n\nYear 2:\n• Q1-Q2: Initiate mouse studies\n• Q3-Q4: Complete Aim 2 efficacy studies\n\nYear 3:\n• Q1-Q2: Biomarker analysis\n• Q3-Q4: Validation and manuscript preparation\n\nMilestones:\n• Month 12: Complete mechanistic characterization\n• Month 24: Demonstrate therapeutic efficacy\n• Month 36: Validated biomarker panel`,
        budget: `Personnel:\n• PI (10% effort): $XX,XXX\n• Postdoctoral fellow (100%): $XX,XXX\n• Graduate student (50%): $XX,XXX\n\nSupplies:\n• Cell culture and reagents: $XX,XXX/year\n• Sequencing and omics: $XX,XXX/year\n• Animal costs: $XX,XXX/year\n\nEquipment:\n• Core facility fees: $XX,XXX/year\n\nTravel:\n• Conference presentations: $X,XXX/year\n\nTotal Direct Costs: $XXX,XXX/year`,
      };
      setSections(prev => ({ ...prev, [sectionKey]: drafts[sectionKey] || '' }));
      setAiLoading(false);
    }, 1500);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      const draft = { id: Date.now(), title, grantType, diseaseType, sections, savedAt: new Date().toISOString() };
      const drafts = JSON.parse(localStorage.getItem('grantDrafts') || '[]');
      drafts.unshift(draft);
      localStorage.setItem('grantDrafts', JSON.stringify(drafts.slice(0, 10)));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleExportDocx = async () => {
    const grant = GRANT_TYPES.find(g => g.value === grantType);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType);
    const { exportGrantDocx } = await import('../lib/exportDocx');
    await exportGrantDocx({
      title,
      grantType: grant?.label || grantType,
      disease: disease?.label || diseaseType,
      sections,
      sectionDefs: SECTIONS,
    });
  };

  const handleExportTxt = () => {
    const grant = GRANT_TYPES.find(g => g.value === grantType);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType);
    let content = `GRANT APPLICATION\n${'='.repeat(60)}\nTitle: ${title || 'Untitled Grant'}\nGrant Type: ${grant?.label || grantType}\nDisease: ${disease?.label || diseaseType}\nDate: ${new Date().toLocaleDateString()}\n${'='.repeat(60)}\n\n`;
    SECTIONS.forEach(s => { if (sections[s.key]) content += `${s.icon} ${s.label.toUpperCase()}\n${'-'.repeat(40)}\n${sections[s.key]}\n\n`; });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || 'grant').slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
  };

  const handleCreateGrant = () => {
    if (!newGrant.title) return;
    setGrants(prev => [...prev, {
      id: Date.now(),
      title: newGrant.title,
      type: GRANT_TYPES.find(g => g.value === newGrant.type)?.label || newGrant.type,
      status: 'draft',
      fundingAgency: newGrant.agency || 'TBD',
      deadline: newGrant.deadline || new Date().toISOString().slice(0, 10),
      amount: parseInt(newGrant.amount) || 0,
      pi: newGrant.pi || 'TBD',
      progress: 0,
    }]);
    setNewGrant({ title: '', type: 'r01', agency: '', deadline: '', amount: '', pi: '' });
    setShowNewGrant(false);
  };

  const currentSection = SECTIONS.find(s => s.key === activeSection);
  const currentContent = sections[activeSection] || '';
  const wordCount = getWordCount(currentContent);
  const target = currentSection?.target || 500;
  const progress = Math.min((wordCount / target) * 100, 100);

  const stats = {
    total: grants.length,
    inProgress: grants.filter(g => g.status === 'in_progress').length,
    submitted: grants.filter(g => g.status === 'submitted').length,
    funded: grants.filter(g => g.status === 'funded').length,
  };

  // NIH standard upcoming deadlines
  const NIH_DEADLINES = (() => {
    const today = new Date();
    const year = today.getFullYear();
    const nextYear = year + 1;
    const raw = [
      { mech: 'R01 (New)', dates: [`${year}-02-05`, `${year}-06-05`, `${year}-10-05`, `${nextYear}-02-05`] },
      { mech: 'R01 (Renewal)', dates: [`${year}-05-07`, `${year}-09-07`, `${year}-01-07`, `${nextYear}-01-07`] },
      { mech: 'R21', dates: [`${year}-02-16`, `${year}-06-16`, `${year}-10-16`, `${nextYear}-02-16`] },
      { mech: 'F31', dates: [`${year}-04-08`, `${year}-08-08`, `${year}-12-08`, `${nextYear}-04-08`] },
      { mech: 'K99/R00', dates: [`${year}-02-12`, `${year}-06-12`, `${year}-10-12`, `${nextYear}-02-12`] },
    ];
    const todayStr = today.toISOString().slice(0, 10);
    return raw.map(r => {
      const next = r.dates.filter(d => d >= todayStr).sort()[0];
      if (!next) return null;
      const daysLeft = Math.ceil((new Date(next).getTime() - today.getTime()) / 86400000);
      return { mech: r.mech, date: next, daysLeft };
    }).filter(Boolean) as { mech: string; date: string; daysLeft: number }[];
  })();

  const totalFunded = grants.filter(g => g.status === 'funded').reduce((a, g) => a + (g.amount || 0), 0);
  const successRate = grants.length > 0 ? Math.round((stats.funded / grants.length) * 100) : 0;
  const urgentGrants = grants.filter(g => {
    if (!g.deadline || g.status === 'funded' || g.status === 'rejected') return false;
    const days = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  });

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Grant Hub</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Write, manage, and track your research grants</p>
        </div>
        {/* Key stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Grants', value: grants.length, color: '#6366f1', icon: '📄' },
            { label: 'In Progress', value: stats.inProgress, color: '#f59e0b', icon: '✍️' },
            { label: 'Funded', value: stats.funded, color: '#22c55e', icon: '✅' },
            { label: 'Total Awarded', value: `$${(totalFunded / 1000000).toFixed(1)}M`, color: '#0071bc', icon: '💰' },
            { label: 'Success Rate', value: `${successRate}%`, color: successRate >= 20 ? '#22c55e' : '#f59e0b', icon: '📈' },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NIH Upcoming Deadlines Strip */}
      <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(0,113,188,0.08)', border: '1px solid rgba(0,113,188,0.2)', borderLeft: '4px solid #0071bc', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>NIH Standard Upcoming Deadlines</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {NIH_DEADLINES.map(d => (
            <div key={d.mech} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12,
              background: d.daysLeft <= 14 ? 'rgba(239,68,68,0.15)' : d.daysLeft <= 30 ? 'rgba(245,158,11,0.12)' : 'var(--surface2)',
              border: `1px solid ${d.daysLeft <= 14 ? 'rgba(239,68,68,0.3)' : d.daysLeft <= 30 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
            }}>
              <span style={{ fontWeight: 700, color: d.daysLeft <= 14 ? '#ef4444' : d.daysLeft <= 30 ? '#f59e0b' : 'var(--text)' }}>{d.mech}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{d.date}</span>
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                background: d.daysLeft <= 14 ? '#ef444430' : d.daysLeft <= 30 ? '#f59e0b30' : '#6366f120',
                color: d.daysLeft <= 14 ? '#ef4444' : d.daysLeft <= 30 ? '#f59e0b' : '#6366f1',
              }}>{d.daysLeft}d</span>
            </div>
          ))}
        </div>
      </div>

      {/* Urgent grant alerts */}
      {urgentGrants.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {urgentGrants.map(g => {
            const days = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000);
            const color = days <= 7 ? '#ef4444' : days <= 14 ? '#f59e0b' : '#6366f1';
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: `${color}12`, border: `1px solid ${color}30`, borderLeft: `4px solid ${color}`, borderRadius: 8 }}>
                <span>⏰</span>
                <span style={{ fontWeight: 600, color, fontSize: 13 }}>{days === 0 ? 'Due today' : `${days} day${days > 1 ? 's' : ''} left`}</span>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{g.title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.type}</span>
                <button onClick={() => setActiveTab('grants')} style={{ marginLeft: 'auto', background: color, color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View →</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0, overflowX: 'auto' }}>
        {[
          { key: 'research_ai', label: 'Research AI', icon: '🧬', highlight: true },
          { key: 'compose', label: 'Write Grant', icon: '✍️' },
          { key: 'grants', label: 'My Grants', icon: '📄', count: grants.length },
          { key: 'tools', label: 'Tools', icon: '🧰' },
          { key: 'budget', label: 'Budget Tracker', icon: '💰' },
          { key: 'reports', label: 'Progress Reports', icon: '📊' },
          { key: 'irb', label: 'IRB/IACUC', icon: '🔬' },
          { key: 'tracker', label: 'Submission Tracker', icon: '📍' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px',
              background: (tab as any).highlight && activeTab !== tab.key ? 'rgba(99,102,241,0.1)' : 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : (tab as any).highlight ? '2px solid rgba(99,102,241,0.4)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent)' : (tab as any).highlight ? '#818cf8' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 700 : (tab as any).highlight ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              marginBottom: -1,
              borderRadius: (tab as any).highlight ? '8px 8px 0 0' : 0,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {(tab as any).highlight && activeTab !== tab.key && (
              <span style={{ background: '#6366f1', color: 'white', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>NEW</span>
            )}
            {(tab as any).count !== undefined && (tab as any).count > 0 && (
              <span style={{ background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                {(tab as any).count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: Write Grant */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Setup */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Grant Setup</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
                <select className="form-select" value={grantType} onChange={(e) => setGrantType(e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                  {GRANT_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Disease</label>
                <select className="form-select" value={diseaseType} onChange={(e) => setDiseaseType(e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                  {DISEASE_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {/* Sections */}
            <div className="card" style={{ flex: 1 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Sections</h3>
              {SECTIONS.map(section => {
                const words = getWordCount(sections[section.key] || '');
                const done = words >= section.target * 0.8;
                const active = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', width: '100%',
                      border: 'none', borderRadius: 6, marginBottom: 4, cursor: 'pointer', textAlign: 'left', fontSize: 12,
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'white' : 'var(--text)',
                    }}
                  >
                    <span>{section.icon}</span>
                    <span style={{ flex: 1 }}>{section.label}</span>
                    {words > 0 && (
                      <span style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 8,
                        background: active ? 'rgba(255,255,255,0.2)' : done ? 'var(--success)' : 'var(--surface2)',
                        color: active ? 'white' : done ? 'white' : 'var(--text-muted)',
                      }}>{words}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Figures */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Figures ({figures.length})</h3>
              {figures.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: 'var(--surface2)', borderRadius: 4, marginBottom: 6, fontSize: 11 }}>
                  {f.type.startsWith('image/') && <img src={f.url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setFigures(prev => prev.filter(x => x.id !== f.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                </div>
              ))}
              <input ref={figureInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFigureUpload} style={{ display: 'none' }} />
              <button className="btn btn-sm btn-secondary" onClick={() => figureInputRef.current?.click()} style={{ width: '100%', fontSize: 11 }}>+ Upload</button>
            </div>
          </div>

          {/* Editor */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Title */}
            <input
              type="text"
              placeholder="Enter your grant title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 0, padding: '12px 0', background: 'transparent', color: 'var(--text)', width: '100%' }}
            />

            {/* Section Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{currentSection?.icon}</span>
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>{currentSection?.label}</h2>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wordCount} / {target} words</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleAIDraft(activeSection)} disabled={aiLoading}>
                  {aiLoading ? 'Generating...' : 'AI Draft'}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(currentContent)}>Copy</button>
              </div>
            </div>

            {/* Progress */}
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress >= 80 ? 'var(--success)' : 'var(--accent)', borderRadius: 2 }} />
            </div>

            {/* Textarea */}
            <textarea
              style={{ flex: 1, minHeight: 400, resize: 'none', fontSize: 14, lineHeight: 1.8, border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface)', color: 'var(--text)' }}
              placeholder={`Start writing your ${currentSection?.label.toLowerCase()}...\n\nClick "AI Draft" to generate content.`}
              value={currentContent}
              onChange={(e) => setSections(prev => ({ ...prev, [activeSection]: e.target.value }))}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={handleSave} disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Draft'}
              </button>
              <button className="btn btn-secondary" onClick={handleExportDocx}>⬇ Word (.docx)</button>
              <button className="btn btn-secondary" onClick={handleExportTxt}>⬇ Text (.txt)</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: My Grants */}
      {activeTab === 'grants' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total', value: stats.total, color: 'var(--text)' },
              { label: 'In Progress', value: stats.inProgress, color: '#60a5fa' },
              { label: 'Submitted', value: stats.submitted, color: '#fbbf24' },
              { label: 'Funded', value: stats.funded, color: '#4ade80' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowNewGrant(true)}>+ New Grant</button>
          </div>

          {/* Grants List */}
          {grants.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
              {grants.map(grant => (
                <div key={grant.id} className="card" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[grant.status].bg, color: STATUS_COLORS[grant.status].text }}>
                      {STATUS_COLORS[grant.status].label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{grant.type}</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{grant.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12 }}>
                    <div>👤 {grant.pi}</div>
                    <div>🏛️ {grant.fundingAgency}</div>
                    <div>💵 ${grant.amount.toLocaleString()}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                      <span>Progress</span>
                      <span>{grant.progress}%</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${grant.progress}%`, background: 'var(--accent)', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Deadline: {new Date(grant.deadline).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Grants Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Create your first grant to start tracking</p>
              <button className="btn btn-primary" onClick={() => setShowNewGrant(true)}>+ Create Grant</button>
            </div>
          )}
        </div>
      )}

      {/* TAB: Tools */}
      {activeTab === 'tools' && (
        <>
          {/* Tool router */}
          {activeTool === 'budget' && (
            <BudgetCalculator onBack={() => setActiveTool(null)} />
          )}
          {activeTool === 'biosketch' && (
            <BiosketschGenerator onBack={() => setActiveTool(null)} />
          )}
          {activeTool === 'letters' && (
            <SupportLetters onBack={() => setActiveTool(null)} />
          )}
          {activeTool === 'templates' && (
            <TemplatesLibrary
              onBack={() => setActiveTool(null)}
              onLoadToComposer={(section, content) => {
                setSections(prev => ({ ...prev, [section]: content }));
                setActiveSection(section);
                setActiveTab('compose');
                setActiveTool(null);
              }}
            />
          )}
          {activeTool === 'collaborators' && (
            <CollaboratorsManager onBack={() => setActiveTool(null)} />
          )}
          {activeTool && !['budget', 'biosketch', 'letters', 'templates', 'collaborators'].includes(activeTool) && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Coming Soon</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>This tool is under development.</p>
              <button className="btn btn-secondary" onClick={() => setActiveTool(null)}>← Back to Tools</button>
            </div>
          )}

          {/* Tools grid (shown when no tool is active) */}
          {!activeTool && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {TOOLS.map(tool => (
                <div
                  key={tool.key}
                  className="card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')}
                >
                  <div style={{ fontSize: 36, marginBottom: 12 }}>{tool.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{tool.label}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{tool.desc}</p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTool(tool.key)}
                  >
                    Open Tool
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: Budget Tracker */}
      {activeTab === 'budget' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Budget', value: '$2,500,000', color: 'var(--text)' },
              { label: 'Spent', value: '$1,245,000', color: '#60a5fa' },
              { label: 'Remaining', value: '$1,255,000', color: '#4ade80' },
              { label: 'Burn Rate', value: '49.8%', color: '#fbbf24' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Budget Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { category: 'Personnel', allocated: 1500000, spent: 780000 },
                { category: 'Equipment', allocated: 300000, spent: 245000 },
                { category: 'Supplies', allocated: 400000, spent: 156000 },
                { category: 'Travel', allocated: 100000, spent: 34000 },
                { category: 'Other', allocated: 200000, spent: 30000 },
              ].map(item => (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{item.category}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      ${item.spent.toLocaleString()} / ${item.allocated.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%',
                      width: `${(item.spent / item.allocated) * 100}%`,
                      background: (item.spent / item.allocated) > 0.9 ? 'var(--danger)' : (item.spent / item.allocated) > 0.7 ? 'var(--warning)' : 'var(--success)',
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Progress Reports */}
      {activeTab === 'reports' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Progress Reports</h3>
            <button className="btn btn-primary">+ New Report</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { id: 1, title: 'Annual Progress Report - Year 1', grant: 'NIH R01 CA123456', due: '2024-06-30', status: 'submitted', submittedDate: '2024-06-28' },
              { id: 2, title: 'Annual Progress Report - Year 2', grant: 'NIH R01 CA123456', due: '2025-06-30', status: 'draft', submittedDate: null },
              { id: 3, title: 'Final Report', grant: 'NSF CAREER 789012', due: '2024-12-15', status: 'pending', submittedDate: null },
            ].map(report => (
              <div key={report.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{report.title}</h4>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{report.grant}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Due: {new Date(report.due).toLocaleDateString()}
                    {report.submittedDate && ` • Submitted: ${new Date(report.submittedDate).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 500,
                    background: report.status === 'submitted' ? 'rgba(34,197,94,0.15)' : report.status === 'draft' ? 'rgba(107,114,128,0.15)' : 'rgba(234,179,8,0.15)',
                    color: report.status === 'submitted' ? '#4ade80' : report.status === 'draft' ? '#9ca3af' : '#fbbf24',
                  }}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                  <button className="btn btn-sm btn-secondary">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: IRB/IACUC */}
      {activeTab === 'irb' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>IRB/IACUC Protocols</h3>
            <button className="btn btn-primary">+ New Protocol</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Active Protocols', value: 4, color: '#4ade80' },
              { label: 'Pending Review', value: 2, color: '#fbbf24' },
              { label: 'Expiring Soon', value: 1, color: '#f87171' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { id: 1, protocol: 'IRB-2024-0123', title: 'Human Subjects Study - Cancer Biomarkers', type: 'IRB', status: 'approved', expires: '2025-06-15' },
              { id: 2, protocol: 'IACUC-2024-0045', title: 'Mouse Model - Tumor Growth Study', type: 'IACUC', status: 'approved', expires: '2025-03-20' },
              { id: 3, protocol: 'IRB-2024-0156', title: 'Patient Survey - Quality of Life', type: 'IRB', status: 'pending', expires: null },
              { id: 4, protocol: 'IACUC-2024-0067', title: 'Zebrafish Model - Drug Screening', type: 'IACUC', status: 'approved', expires: '2024-12-01' },
            ].map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    background: item.type === 'IRB' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                    color: item.type === 'IRB' ? '#60a5fa' : '#a855f7',
                  }}>
                    {item.type === 'IRB' ? '👤' : '🐁'}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{item.protocol}</div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.title}</h4>
                    {item.expires && (
                      <div style={{ fontSize: 12, color: new Date(item.expires) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) ? '#f87171' : 'var(--text-muted)' }}>
                        Expires: {new Date(item.expires).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: item.status === 'approved' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                    color: item.status === 'approved' ? '#4ade80' : '#fbbf24',
                  }}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                  <button className="btn btn-sm btn-secondary">View</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Submission Tracker */}
      {activeTab === 'tracker' && (() => {
        const filtered = trackerFilter === 'all' ? trackerGrants : trackerGrants.filter(g => g.status === trackerFilter);
        const STAGES = [
          { key: 'writing', label: 'Writing', icon: '✍️' },
          { key: 'submitted', label: 'Submitted', icon: '📤' },
          { key: 'review', label: 'Under Review', icon: '🔍' },
          { key: 'scored', label: 'Scored', icon: '📊' },
          { key: 'decision', label: 'Decision', icon: '⚖️' },
        ];

        const getStageIndex = (g: Grant) => {
          if (g.status === 'funded' || g.status === 'rejected') return 5;
          if (g.score) return 4;
          if (g.reviewDate && new Date(g.reviewDate) < new Date()) return 3;
          if (g.submittedDate) return 2;
          return 1;
        };

        return (
          <div>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total Tracked', value: trackerGrants.length, color: '#60a5fa' },
                { label: 'In Progress', value: trackerGrants.filter(g => g.status === 'in_progress').length, color: '#fbbf24' },
                { label: 'Submitted', value: trackerGrants.filter(g => g.status === 'submitted').length, color: '#a78bfa' },
                { label: 'Funded', value: trackerGrants.filter(g => g.status === 'funded').length, color: '#4ade80' },
                { label: 'Total Requested', value: `$${(trackerGrants.reduce((s, g) => s + g.amount, 0) / 1e6).toFixed(1)}M`, color: '#34d399' },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['all', 'in_progress', 'submitted', 'funded', 'rejected'].map(f => (
                  <button key={f} onClick={() => setTrackerFilter(f)} style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    background: trackerFilter === f ? 'var(--accent)' : 'var(--surface)',
                    color: trackerFilter === f ? 'white' : 'var(--text-muted)',
                  }}>
                    {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => {
                const ng: Grant = { id: Date.now(), title: 'New Grant', type: 'NIH R01', status: 'in_progress', fundingAgency: 'NIH', deadline: '', amount: 0, pi: '', progress: 0 };
                setTrackerGrants(prev => [...prev, ng]);
                setEditingTracker(ng);
              }}>+ Add to Tracker</button>
            </div>

            {/* Grant timeline cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filtered.map(grant => {
                const stageIdx = getStageIndex(grant);
                const sc = STATUS_COLORS[grant.status];
                return (
                  <div key={grant.id} className="card" style={{ padding: 20 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{grant.title}</h3>
                          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text }}>
                            {sc.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>🏦 {grant.fundingAgency}</span>
                          <span>📋 {grant.type}</span>
                          <span>👤 {grant.pi}</span>
                          <span>💰 ${grant.amount.toLocaleString()}</span>
                          {grant.programOfficer && <span>📞 PO: {grant.programOfficer}</span>}
                          {grant.studySection && <span>🔬 SS: {grant.studySection}</span>}
                        </div>
                      </div>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingTracker({ ...grant })}>Edit</button>
                    </div>

                    {/* Timeline bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12, position: 'relative' }}>
                      {STAGES.map((stage, idx) => {
                        const isComplete = idx < stageIdx;
                        const isCurrent = idx === stageIdx - 1;
                        const isFuture = idx >= stageIdx;
                        const color = grant.status === 'funded' && idx === 4 ? '#4ade80'
                          : grant.status === 'rejected' && idx === 4 ? '#f87171'
                          : isComplete ? 'var(--accent)' : isCurrent ? 'var(--accent)' : 'var(--border)';
                        return (
                          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 600, zIndex: 1,
                                background: isComplete || isCurrent ? color : 'var(--surface)',
                                border: `2px solid ${color}`,
                                color: isComplete || isCurrent ? 'white' : 'var(--text-muted)',
                              }}>
                                {isComplete ? '✓' : stage.icon}
                              </div>
                              <div style={{ fontSize: 10, color: isFuture ? 'var(--text-muted)' : 'var(--accent)', marginTop: 4, fontWeight: isCurrent ? 600 : 400 }}>
                                {stage.label}
                              </div>
                            </div>
                            {idx < STAGES.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: idx < stageIdx - 1 ? 'var(--accent)' : 'var(--border)', marginBottom: 20 }} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Key dates row */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Deadline', val: grant.deadline, icon: '📅' },
                        { label: 'Submitted', val: grant.submittedDate, icon: '📤' },
                        { label: 'Review Date', val: grant.reviewDate, icon: '🔍' },
                        { label: 'Score', val: grant.score, icon: '📊', isScore: true },
                        { label: 'Decision', val: grant.decisionDate, icon: '⚖️' },
                      ].filter(d => d.val).map(d => (
                        <div key={d.label} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{d.icon} {d.label}:</span>
                          <span style={{ fontWeight: 600, color: d.isScore ? (parseInt(d.val!) < 20 ? '#4ade80' : parseInt(d.val!) < 30 ? '#fbbf24' : '#f87171') : undefined }}>
                            {d.isScore ? d.val : new Date(d.val!).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {grant.notes && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        💬 {grant.notes}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
                  <div>No grants match this filter</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tracker Edit Modal */}
      {editingTracker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 540, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Edit Tracker Entry</h3>
              <button onClick={() => setEditingTracker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label className="form-label">Title</label>
                <input type="text" className="form-input" value={editingTracker.title} onChange={e => setEditingTracker(p => p && ({ ...p, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-select" value={GRANT_TYPES.find(g => g.label === editingTracker.type)?.value || 'r01'} onChange={e => setEditingTracker(p => p && ({ ...p, type: GRANT_TYPES.find(g => g.value === e.target.value)?.label || e.target.value }))}>
                    {GRANT_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-select" value={editingTracker.status} onChange={e => setEditingTracker(p => p && ({ ...p, status: e.target.value as Grant['status'] }))}>
                    {['draft', 'in_progress', 'submitted', 'funded', 'rejected'].map(s => <option key={s} value={s}>{STATUS_COLORS[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Funding Agency</label>
                  <input type="text" className="form-input" value={editingTracker.fundingAgency} onChange={e => setEditingTracker(p => p && ({ ...p, fundingAgency: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">PI</label>
                  <input type="text" className="form-input" value={editingTracker.pi} onChange={e => setEditingTracker(p => p && ({ ...p, pi: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Amount ($)</label>
                  <input type="number" className="form-input" value={editingTracker.amount} onChange={e => setEditingTracker(p => p && ({ ...p, amount: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">Deadline</label>
                  <input type="date" className="form-input" value={editingTracker.deadline} onChange={e => setEditingTracker(p => p && ({ ...p, deadline: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Program Officer</label>
                  <input type="text" className="form-input" value={editingTracker.programOfficer || ''} onChange={e => setEditingTracker(p => p && ({ ...p, programOfficer: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Study Section</label>
                  <input type="text" className="form-input" value={editingTracker.studySection || ''} onChange={e => setEditingTracker(p => p && ({ ...p, studySection: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Submitted Date</label>
                  <input type="date" className="form-input" value={editingTracker.submittedDate || ''} onChange={e => setEditingTracker(p => p && ({ ...p, submittedDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Review Date</label>
                  <input type="date" className="form-input" value={editingTracker.reviewDate || ''} onChange={e => setEditingTracker(p => p && ({ ...p, reviewDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Score (e.g. "12th percentile")</label>
                  <input type="text" className="form-input" placeholder="15th percentile" value={editingTracker.score || ''} onChange={e => setEditingTracker(p => p && ({ ...p, score: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Decision Date</label>
                  <input type="date" className="form-input" value={editingTracker.decisionDate || ''} onChange={e => setEditingTracker(p => p && ({ ...p, decisionDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={editingTracker.notes || ''} onChange={e => setEditingTracker(p => p && ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingTracker(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                setTrackerGrants(prev => prev.map(g => g.id === editingTracker!.id ? editingTracker! : g).concat(
                  prev.some(g => g.id === editingTracker!.id) ? [] : [editingTracker!]
                ));
                setEditingTracker(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Research AI Tab */}
      {activeTab === 'research_ai' && (
        <ResearchAITab
          onSendToGrant={(grantSections, topicTitle) => {
            // Map synthesis output keys to composer section keys and pre-fill
            const sectionMap: Record<string, string> = {
              specific_aims: 'aims',
              significance: 'significance',
              innovation: 'innovation',
              approach: 'approach',
            };
            const updates: Record<string, string> = {};
            Object.entries(grantSections).forEach(([key, content]) => {
              const mapped = sectionMap[key] || key;
              updates[mapped] = content as string;
            });
            setSections(prev => ({ ...prev, ...updates }));
            if (topicTitle) setTitle(topicTitle);
            setActiveSection('aims');
            setActiveTab('compose');
          }}
        />
      )}

      {/* New Grant Modal */}
      {showNewGrant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 450, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>New Grant</h3>
              <button onClick={() => setShowNewGrant(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Title</label>
              <input type="text" className="form-input" placeholder="Grant title" value={newGrant.title} onChange={(e) => setNewGrant(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Type</label>
              <select className="form-select" value={newGrant.type} onChange={(e) => setNewGrant(p => ({ ...p, type: e.target.value }))}>
                {GRANT_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label">Agency</label>
                <input type="text" className="form-input" placeholder="NIH, NSF..." value={newGrant.agency} onChange={(e) => setNewGrant(p => ({ ...p, agency: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Deadline</label>
                <input type="date" className="form-input" value={newGrant.deadline} onChange={(e) => setNewGrant(p => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="form-label">Amount ($)</label>
                <input type="number" className="form-input" placeholder="500000" value={newGrant.amount} onChange={(e) => setNewGrant(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">PI</label>
                <input type="text" className="form-input" placeholder="Dr. Smith" value={newGrant.pi} onChange={(e) => setNewGrant(p => ({ ...p, pi: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewGrant(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateGrant} style={{ flex: 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
