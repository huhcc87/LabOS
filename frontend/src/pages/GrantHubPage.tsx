import React, { useState, useRef, lazy, Suspense } from 'react';

// Lazy-load heavy sub-pages so the main shell loads fast
const ResearchAITab = lazy(() => import('./ResearchAITab'));
const GrantToolsModule = lazy(() => import('./GrantTools').then(m => ({
  default: ({ tool, onBack, onLoadToComposer }: any) => {
    if (tool === 'budget') return <m.BudgetCalculator onBack={onBack} />;
    if (tool === 'biosketch') return <m.BiosketschGenerator onBack={onBack} />;
    if (tool === 'letters') return <m.SupportLetters onBack={onBack} />;
    if (tool === 'templates') return <m.TemplatesLibrary onBack={onBack} onLoadToComposer={onLoadToComposer} />;
    if (tool === 'collaborators') return <m.CollaboratorsManager onBack={onBack} />;
    return null;
  }
})));

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GRANT_TYPES = [
  { value: 'r01', label: 'NIH R01' },
  { value: 'r21', label: 'NIH R21' },
  { value: 'r03', label: 'NIH R03' },
  { value: 'k99-r00', label: 'NIH K99/R00' },
  { value: 'f31', label: 'NIH F31' },
  { value: 'f32', label: 'NIH F32' },
  { value: 'nsf-career', label: 'NSF CAREER' },
  { value: 'dod', label: 'DoD Research' },
  { value: 'foundation', label: 'Foundation Grant' },
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
  draft: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', label: 'Draft' },
  in_progress: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'In Progress' },
  submitted: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24', label: 'Submitted' },
  funded: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Funded' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Rejected' },
};

// ─── Loader ──────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
      Loading…
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type Tab = 'research_ai' | 'compose' | 'grants' | 'tools';

export default function GrantHubPage() {
  // ── Navigation ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('research_ai');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // ── Grants list ──────────────────────────────────────────────────────────
  const [grants, setGrants] = useState<Grant[]>([]);
  const [showNewGrant, setShowNewGrant] = useState(false);
  const [newGrant, setNewGrant] = useState({ title: '', type: 'r01', agency: '', deadline: '', amount: '', pi: '' });

  // ── Composer ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [grantType, setGrantType] = useState('r01');
  const [diseaseType, setDiseaseType] = useState('colorectal');
  const [activeSection, setActiveSection] = useState('abstract');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const figureInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
  const currentSection = SECTIONS.find(s => s.key === activeSection);
  const currentContent = sections[activeSection] || '';
  const words = wordCount(currentContent);
  const progress = Math.min((words / (currentSection?.target || 500)) * 100, 100);
  const hasContent = SECTIONS.some(s => (sections[s.key] || '').trim());

  const handleAIDraft = (key: string) => {
    if (!title.trim()) { alert('Enter a grant title first.'); return; }
    setAiLoading(true);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType)?.label || 'cancer';
    setTimeout(() => {
      const drafts: Record<string, string> = {
        abstract: `Background: ${disease} remains a significant clinical challenge. Recent evidence suggests that [your target/pathway] plays a critical role in disease progression.\n\nObjective: This proposal aims to investigate the mechanistic role of [your target] in ${disease}.\n\nMethods: We will employ in vitro cell models, patient-derived organoids, and in vivo mouse models.\n\nExpected Outcomes: This research will provide critical insights into ${disease} biology.\n\nImpact: Successful completion will advance our understanding and identify new treatment strategies.`,
        aims: `Specific Aim 1: Define the molecular mechanisms of [your target] in ${disease}\n• Hypothesis: [Your target] drives progression through [proposed mechanism]\n• Approach: CRISPR knockout, overexpression, pharmacological inhibition\n\nSpecific Aim 2: Evaluate therapeutic targeting in preclinical models\n• Hypothesis: Inhibiting [your target] will reduce tumor growth\n• Approach: Orthotopic mouse models and PDX\n\nSpecific Aim 3: Identify biomarkers for patient stratification\n• Hypothesis: Molecular signatures predict treatment response\n• Approach: Patient sample analysis`,
        significance: `${disease} represents a major public health burden with significant unmet medical need.\n\nGap in Knowledge: While [your target] has been implicated in ${disease}, the precise molecular mechanisms remain poorly understood.\n\nSignificance:\n1. Addresses a critical barrier in ${disease} research\n2. Provides mechanistic insights with therapeutic implications\n3. Develops clinically relevant preclinical models\n4. Identifies actionable biomarkers for precision medicine`,
        innovation: `This proposal is innovative in several key aspects:\n\n1. Novel Target: First systematic investigation of [your target] in ${disease}\n2. Cutting-edge Technology: CRISPR-based genetic screens, single-cell RNA sequencing, patient-derived organoid models\n3. Translational Framework: Direct integration of basic research with clinical application\n4. Precision Medicine Approach: Biomarker-guided treatment strategies`,
        approach: `Research Design and Methods:\n\nAim 1: Mechanistic Studies\n• Cell line models, CRISPR knockout/knockin, biochemical assays\n• Functional assays: Proliferation, migration, invasion\n\nAim 2: Preclinical Evaluation\n• Mouse models: Orthotopic implantation and PDX\n• Endpoints: Tumor growth, metastasis, survival\n\nAim 3: Biomarker Development\n• Patient cohort analysis (n=200+ samples)\n• IHC, RNA-seq, DNA sequencing\n• Independent cohort validation`,
        preliminary: `Our preliminary data support the proposed research:\n\nFigure 1: [Your target] is overexpressed in ${disease}\n• TCGA analysis shows 3-fold upregulation (validated in n=50 patient samples)\n\nFigure 2: Knockdown reduces proliferation (60% reduction, rescued by re-expression)\n\nFigure 3: Pharmacological inhibition shows efficacy in pilot mouse study`,
        timeline: `Year 1: Establish models, complete Aim 1 genetic studies\nYear 2: Mouse studies, complete Aim 2 efficacy\nYear 3: Biomarker analysis, validation, manuscript prep\n\nMilestones:\n• Month 12: Complete mechanistic characterization\n• Month 24: Demonstrate therapeutic efficacy\n• Month 36: Validated biomarker panel`,
        budget: `Personnel: PI (10%), Postdoc (100%), Graduate student (50%)\nSupplies: Cell culture, reagents, sequencing, animal costs\nEquipment: Core facility fees\nTravel: Conference presentations\n\nTotal Direct Costs: $XXX,XXX/year`,
      };
      setSections(prev => ({ ...prev, [key]: drafts[key] || '' }));
      setAiLoading(false);
    }, 1200);
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
    }, 400);
  };

  const handleExportDocx = async () => {
    if (!hasContent) { alert('Add content to at least one section first.'); return; }
    try {
      const { exportGrantDocx } = await import('../lib/exportDocx');
      await exportGrantDocx({
        title,
        grantType: GRANT_TYPES.find(g => g.value === grantType)?.label || grantType,
        disease: DISEASE_TYPES.find(d => d.value === diseaseType)?.label || diseaseType,
        sections,
        sectionDefs: SECTIONS,
      });
    } catch (err) {
      console.error('DOCX export failed:', err);
      alert('Export failed — try Text export instead.');
    }
  };

  const handleExportTxt = () => {
    if (!hasContent) { alert('Add content to at least one section first.'); return; }
    const grant = GRANT_TYPES.find(g => g.value === grantType);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType);
    let content = `GRANT APPLICATION\n${'='.repeat(60)}\nTitle: ${title || 'Untitled'}\nType: ${grant?.label || grantType}\nDisease: ${disease?.label || diseaseType}\nDate: ${new Date().toLocaleDateString()}\n${'='.repeat(60)}\n\n`;
    SECTIONS.forEach(s => { if (sections[s.key]) content += `${s.icon} ${s.label.toUpperCase()}\n${'-'.repeat(40)}\n${sections[s.key]}\n\n`; });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'grant').slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '_')}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 5000);
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

  // ── NIH upcoming deadlines ──────────────────────────────────────────────
  const NIH_DEADLINES = (() => {
    const today = new Date();
    const y = today.getFullYear();
    const ny = y + 1;
    const raw = [
      { mech: 'R01 (New)', dates: [`${y}-02-05`, `${y}-06-05`, `${y}-10-05`, `${ny}-02-05`] },
      { mech: 'R01 (Renew)', dates: [`${y}-05-07`, `${y}-09-07`, `${y}-01-07`, `${ny}-01-07`] },
      { mech: 'R21', dates: [`${y}-02-16`, `${y}-06-16`, `${y}-10-16`, `${ny}-02-16`] },
      { mech: 'F31', dates: [`${y}-04-08`, `${y}-08-08`, `${y}-12-08`, `${ny}-04-08`] },
      { mech: 'K99/R00', dates: [`${y}-02-12`, `${y}-06-12`, `${y}-10-12`, `${ny}-02-12`] },
    ];
    const todayStr = today.toISOString().slice(0, 10);
    return raw.map(r => {
      const next = r.dates.filter(d => d >= todayStr).sort()[0];
      if (!next) return null;
      const days = Math.ceil((new Date(next).getTime() - today.getTime()) / 86400000);
      return { mech: r.mech, date: next, days };
    }).filter(Boolean) as { mech: string; date: string; days: number }[];
  })();

  // ── Tabs config ──────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string; highlight?: boolean }[] = [
    { key: 'research_ai', label: 'Research AI', icon: '🧬', highlight: true },
    { key: 'compose', label: 'Write Grant', icon: '✍️' },
    { key: 'grants', label: 'My Grants', icon: '📄' },
    { key: 'tools', label: 'Tools', icon: '🧰' },
  ];

  const TOOLS = [
    { key: 'budget', label: 'Budget Calculator', icon: '🧮', desc: 'NIH-rate budget calculations' },
    { key: 'biosketch', label: 'Biosketch Generator', icon: '👤', desc: 'NIH-format biosketches' },
    { key: 'letters', label: 'Support Letters', icon: '✉️', desc: 'Request & track letters' },
    { key: 'collaborators', label: 'Collaborators', icon: '🤝', desc: 'Manage collaborators' },
    { key: 'templates', label: 'Templates', icon: '📄', desc: 'Grant templates & examples' },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Grant Hub</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Research AI · Write · Manage · Export
        </p>
      </div>

      {/* ── NIH Deadlines (compact) ────────────────────────────────────── */}
      <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(0,113,188,0.06)', border: '1px solid rgba(0,113,188,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>📅 NIH Deadlines</span>
        {NIH_DEADLINES.map(d => (
          <span key={d.mech} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11,
            background: d.days <= 14 ? 'rgba(239,68,68,0.12)' : d.days <= 30 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
            color: d.days <= 14 ? '#f87171' : d.days <= 30 ? '#fbbf24' : 'var(--text-muted)',
          }}>
            <b>{d.mech}</b> {d.date} <span style={{ fontWeight: 700 }}>({d.days}d)</span>
          </span>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setActiveTool(null); }}
            style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              background: tab.highlight && activeTab !== tab.key ? 'rgba(99,102,241,0.08)' : 'none',
              color: activeTab === tab.key ? 'var(--accent)' : tab.highlight ? '#818cf8' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 700 : 400,
              marginBottom: -1,
            }}
          >
            {tab.icon} {tab.label}
            {tab.highlight && activeTab !== tab.key && (
              <span style={{ background: '#6366f1', color: 'white', padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>NEW</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Research AI ────────────────────────────────────────────────── */}
      {activeTab === 'research_ai' && (
        <Suspense fallback={<Loader />}>
          <ResearchAITab
            onSendToGrant={(grantSections, topicTitle) => {
              const map: Record<string, string> = { specific_aims: 'aims', significance: 'significance', innovation: 'innovation', approach: 'approach' };
              const updates: Record<string, string> = {};
              Object.entries(grantSections).forEach(([k, v]) => { updates[map[k] || k] = v as string; });
              setSections(prev => ({ ...prev, ...updates }));
              if (topicTitle) setTitle(topicTitle);
              setActiveSection('aims');
              setActiveTab('compose');
            }}
          />
        </Suspense>
      )}

      {/* ── Write Grant ────────────────────────────────────────────────── */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Setup */}
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Setup</div>
              <select className="form-select" value={grantType} onChange={e => setGrantType(e.target.value)} style={{ width: '100%', fontSize: 12, marginBottom: 8 }}>
                {GRANT_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <select className="form-select" value={diseaseType} onChange={e => setDiseaseType(e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                {DISEASE_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {/* Sections */}
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Sections</div>
              {SECTIONS.map(s => {
                const w = wordCount(sections[s.key] || '');
                const done = w >= s.target * 0.8;
                const active = activeSection === s.key;
                return (
                  <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', width: '100%',
                    border: 'none', borderRadius: 6, marginBottom: 2, cursor: 'pointer', textAlign: 'left', fontSize: 12,
                    background: active ? 'var(--accent)' : 'transparent', color: active ? 'white' : 'var(--text)',
                  }}>
                    <span>{s.icon}</span>
                    <span style={{ flex: 1 }}>{s.label}</span>
                    {w > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: active ? 'rgba(255,255,255,0.2)' : done ? '#22c55e' : 'var(--surface2)', color: active ? 'white' : done ? 'white' : 'var(--text-muted)' }}>{w}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <input type="text" placeholder="Grant title…" value={title} onChange={e => setTitle(e.target.value)}
              style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 0, padding: '10px 0', background: 'transparent', color: 'var(--text)', width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{currentSection?.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{currentSection?.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{words} / {currentSection?.target} words</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleAIDraft(activeSection)} disabled={aiLoading}>
                  {aiLoading ? '⏳ Generating…' : '✨ AI Draft'}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(currentContent)}>Copy</button>
              </div>
            </div>
            <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2, marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress >= 80 ? '#22c55e' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <textarea
              style={{ flex: 1, minHeight: 380, resize: 'none', fontSize: 14, lineHeight: 1.8, border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--surface)', color: 'var(--text)' }}
              placeholder={`Start writing your ${currentSection?.label.toLowerCase()}…\nClick "AI Draft" to generate a starting point.`}
              value={currentContent}
              onChange={e => setSections(prev => ({ ...prev, [activeSection]: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={handleSave} disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? '⏳ Saving…' : saveStatus === 'saved' ? '✅ Saved' : '💾 Save Draft'}
              </button>
              <button className="btn btn-secondary" onClick={handleExportDocx}>⬇ Word</button>
              <button className="btn btn-secondary" onClick={handleExportTxt}>⬇ Text</button>
            </div>
          </div>
        </div>
      )}

      {/* ── My Grants ──────────────────────────────────────────────────── */}
      {activeTab === 'grants' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{grants.length} grant{grants.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewGrant(true)}>+ New Grant</button>
          </div>

          {grants.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {grants.map(g => {
                const sc = STATUS_COLORS[g.status] || STATUS_COLORS.draft;
                return (
                  <div key={g.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text }}>{sc.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.type}</span>
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{g.title}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>👤 {g.pi}</span>
                      <span>🏛 {g.fundingAgency}</span>
                      {g.amount > 0 && <span>💵 ${g.amount.toLocaleString()}</span>}
                    </div>
                    {g.deadline && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>📅 Deadline: {new Date(g.deadline).toLocaleDateString()}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 50 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No Grants Yet</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Create your first grant to start tracking.</p>
              <button className="btn btn-primary" onClick={() => setShowNewGrant(true)}>+ Create Grant</button>
            </div>
          )}
        </div>
      )}

      {/* ── Tools ──────────────────────────────────────────────────────── */}
      {activeTab === 'tools' && (
        <Suspense fallback={<Loader />}>
          {activeTool ? (
            <GrantToolsModule
              tool={activeTool}
              onBack={() => setActiveTool(null)}
              onLoadToComposer={(section: string, content: string) => {
                setSections(prev => ({ ...prev, [section]: content }));
                setActiveSection(section);
                setActiveTab('compose');
                setActiveTool(null);
              }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {TOOLS.map(t => (
                <div key={t.key} className="card" style={{ cursor: 'pointer', padding: 20, textAlign: 'center' }} onClick={() => setActiveTool(t.key)}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          )}
        </Suspense>
      )}

      {/* ── New Grant Modal ────────────────────────────────────────────── */}
      {showNewGrant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) setShowNewGrant(false); }}>
          <div className="card" style={{ width: 420, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>New Grant</h3>
              <button onClick={() => setShowNewGrant(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="form-label">Title *</label>
                <input type="text" className="form-input" placeholder="Grant title" value={newGrant.title} onChange={e => setNewGrant(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Type</label>
                <select className="form-select" value={newGrant.type} onChange={e => setNewGrant(p => ({ ...p, type: e.target.value }))}>
                  {GRANT_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Agency</label>
                  <input type="text" className="form-input" placeholder="NIH, NSF…" value={newGrant.agency} onChange={e => setNewGrant(p => ({ ...p, agency: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Deadline</label>
                  <input type="date" className="form-input" value={newGrant.deadline} onChange={e => setNewGrant(p => ({ ...p, deadline: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Amount ($)</label>
                  <input type="number" className="form-input" placeholder="500000" value={newGrant.amount} onChange={e => setNewGrant(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">PI</label>
                  <input type="text" className="form-input" placeholder="Dr. Smith" value={newGrant.pi} onChange={e => setNewGrant(p => ({ ...p, pi: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewGrant(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateGrant} disabled={!newGrant.title.trim()} style={{ flex: 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
