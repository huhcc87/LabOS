import { useState, useRef } from 'react';
import { grantsApi } from '../lib/api';
import type { GrantExportOptions } from '../lib/exportDocx';

interface UploadedFigure {
  id: number;
  name: string;
  url: string;
  type: string;
  size: string;
}

// Simplified grant types - most common ones
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
  { value: 'other', label: 'Other', desc: 'Custom grant type' },
];

// Simplified cancer/disease types
const DISEASE_TYPES = [
  { value: 'colorectal', label: 'Colorectal Cancer' },
  { value: 'breast', label: 'Breast Cancer' },
  { value: 'lung', label: 'Lung Cancer' },
  { value: 'pancreatic', label: 'Pancreatic Cancer' },
  { value: 'prostate', label: 'Prostate Cancer' },
  { value: 'ovarian', label: 'Ovarian Cancer' },
  { value: 'leukemia', label: 'Leukemia' },
  { value: 'lymphoma', label: 'Lymphoma' },
  { value: 'brain', label: 'Brain Cancer' },
  { value: 'melanoma', label: 'Melanoma' },
  { value: 'other', label: 'Other Disease' },
];

// Grant sections with targets
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

export default function GrantComposePage() {
  // Core state
  const [title, setTitle] = useState('');
  const [grantType, setGrantType] = useState('r01');
  const [diseaseType, setDiseaseType] = useState('colorectal');
  const [activeSection, setActiveSection] = useState<string>('abstract');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [figures, setFigures] = useState<UploadedFigure[]>([]);

  // UI state
  const [aiLoading, setAiLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showCompliance, setShowCompliance] = useState(false);

  const figureInputRef = useRef<HTMLInputElement>(null);

  // Helper functions
  const getWordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleFigureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const size = file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      setFigures(prev => [...prev, {
        id: Date.now() + Math.random(),
        name: file.name,
        url,
        type: file.type,
        size
      }]);
    });
    e.target.value = '';
  };

  const removeFigure = (id: number) => {
    setFigures(prev => prev.filter(f => f.id !== id));
  };

  // AI Draft generation
  const handleAIDraft = async (sectionKey: string) => {
    if (!title.trim()) {
      alert('Please enter a grant title first');
      return;
    }

    setAiLoading(true);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType)?.label || 'cancer';
    const grantLabel = GRANT_TYPES.find(g => g.value === grantType)?.label || grantType;

    try {
      const res = await grantsApi.aiDraft({
        grant_type: grantLabel,
        disease,
        title,
        section: sectionKey,
        context: sections[sectionKey] ? `Existing draft: ${sections[sectionKey].slice(0, 300)}` : '',
      });
      setSections(prev => ({ ...prev, [sectionKey]: res.data.content }));
    } catch {
      alert('AI draft generation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Save Draft
  const handleSaveDraft = () => {
    setSaveStatus('saving');
    try {
      const draft = {
        id: `draft-${Date.now()}`,
        title,
        grantType,
        diseaseType,
        sections,
        figures: figures.map(f => ({ id: f.id, name: f.name })),
        savedAt: new Date().toISOString()
      };

      const drafts = JSON.parse(localStorage.getItem('grantDrafts') || '[]');
      drafts.unshift(draft);
      localStorage.setItem('grantDrafts', JSON.stringify(drafts.slice(0, 10)));

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // Export as .docx
  const handleExportDocx = async () => {
    const grant = GRANT_TYPES.find(g => g.value === grantType);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType);
    const opts: GrantExportOptions = {
      title,
      grantType: grant?.label || grantType,
      disease: disease?.label || diseaseType,
      sections,
      sectionDefs: SECTIONS,
    };
    const { exportGrantDocx } = await import('../lib/exportDocx');
    await exportGrantDocx(opts);
  };

  // Export as .txt
  const handleExportTxt = () => {
    const grant = GRANT_TYPES.find(g => g.value === grantType);
    const disease = DISEASE_TYPES.find(d => d.value === diseaseType);
    let content = `GRANT APPLICATION\n${'='.repeat(60)}\n`;
    content += `Title: ${title || 'Untitled Grant'}\n`;
    content += `Grant Type: ${grant?.label || grantType}\n`;
    content += `Disease: ${disease?.label || diseaseType}\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n`;
    content += `${'='.repeat(60)}\n\n`;
    SECTIONS.forEach(s => {
      if (sections[s.key]) {
        content += `${s.icon} ${s.label.toUpperCase()}\n${'-'.repeat(40)}\n${sections[s.key]}\n\n`;
      }
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || 'grant').slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
  };

  // Check Compliance
  const getComplianceItems = () => {
    const items = [
      { label: 'Grant title', pass: title.trim().length > 10 },
      { label: 'Abstract (250-300 words)', pass: getWordCount(sections.abstract || '') >= 200 },
      { label: 'Specific Aims defined', pass: (sections.aims || '').toLowerCase().includes('aim') },
      { label: 'Significance section', pass: getWordCount(sections.significance || '') >= 300 },
      { label: 'Innovation points', pass: (sections.innovation || '').includes('•') || (sections.innovation || '').includes('-') },
      { label: 'Approach detailed', pass: getWordCount(sections.approach || '') >= 500 },
      { label: 'Preliminary data', pass: getWordCount(sections.preliminary || '') >= 100 },
      { label: 'Timeline included', pass: (sections.timeline || '').toLowerCase().includes('year') },
      { label: 'Budget justification', pass: (sections.budget || '').toLowerCase().includes('$') },
    ];
    return items;
  };

  const complianceItems = getComplianceItems();
  const complianceScore = Math.round((complianceItems.filter(i => i.pass).length / complianceItems.length) * 100);

  const currentSection = SECTIONS.find(s => s.key === activeSection);
  const currentContent = sections[activeSection] || '';
  const wordCount = getWordCount(currentContent);
  const target = currentSection?.target || 500;
  const progress = Math.min((wordCount / target) * 100, 100);

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Grant Composer</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Write your grant with AI assistance</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handleSaveDraft}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Draft'}
          </button>
          <button className="btn btn-secondary" onClick={handleExportDocx}>⬇ Word (.docx)</button>
          <button className="btn btn-secondary" onClick={handleExportTxt}>⬇ Text (.txt)</button>
          <button className="btn btn-primary" onClick={() => setShowCompliance(true)}>
            Check ({complianceScore}%)
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Grant Setup */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Grant Setup</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Grant Type
              </label>
              <select
                className="form-select"
                value={grantType}
                onChange={(e) => setGrantType(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              >
                {GRANT_TYPES.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Disease Focus
              </label>
              <select
                className="form-select"
                value={diseaseType}
                onChange={(e) => setDiseaseType(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              >
                {DISEASE_TYPES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sections */}
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sections</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SECTIONS.map(section => {
                const sectionWords = getWordCount(sections[section.key] || '');
                const isComplete = sectionWords >= section.target * 0.8;
                const isActive = activeSection === section.key;

                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: 6,
                      background: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive ? 'white' : 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                    }}
                  >
                    <span>{section.icon}</span>
                    <span style={{ flex: 1 }}>{section.label}</span>
                    {sectionWords > 0 && (
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 10,
                        background: isActive ? 'rgba(255,255,255,0.2)' : isComplete ? 'var(--success)' : 'var(--surface2)',
                        color: isActive ? 'white' : isComplete ? 'white' : 'var(--text-muted)',
                      }}>
                        {sectionWords}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Figures */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Figures ({figures.length})
            </h3>

            {figures.map(fig => (
              <div key={fig.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: 'var(--surface2)',
                borderRadius: 6,
                marginBottom: 8,
                fontSize: 12,
              }}>
                {fig.type.startsWith('image/') && (
                  <img src={fig.url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fig.name}
                </span>
                <button onClick={() => removeFigure(fig.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
              </div>
            ))}

            <input ref={figureInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFigureUpload} style={{ display: 'none' }} />
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => figureInputRef.current?.click()}
              style={{ width: '100%' }}
            >
              + Upload Figure
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Title */}
          <input
            type="text"
            className="form-input"
            placeholder="Enter your grant title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 16,
              border: 'none',
              borderBottom: '2px solid var(--border)',
              borderRadius: 0,
              padding: '12px 0',
            }}
          />

          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{currentSection?.icon}</span>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{currentSection?.label}</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {wordCount} / {target} words
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleAIDraft(activeSection)}
                disabled={aiLoading}
              >
                {aiLoading ? 'Generating...' : 'AI Draft'}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(currentContent);
                  alert('Copied to clipboard!');
                }}
              >
                Copy
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, marginBottom: 16 }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: wordCount > target ? 'var(--warning)' : progress >= 80 ? 'var(--success)' : 'var(--accent)',
              borderRadius: 2,
              transition: 'width 0.3s',
            }} />
          </div>

          {/* Textarea */}
          <textarea
            className="form-textarea"
            style={{
              flex: 1,
              minHeight: 500,
              resize: 'none',
              fontSize: 14,
              lineHeight: 1.8,
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
            }}
            placeholder={`Start writing your ${currentSection?.label.toLowerCase()}...\n\nClick "AI Draft" to generate initial content based on your title and disease focus.`}
            value={currentContent}
            onChange={(e) => setSections(prev => ({ ...prev, [activeSection]: e.target.value }))}
          />
        </div>
      </div>

      {/* Compliance Modal */}
      {showCompliance && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Compliance Check</h2>
              <button onClick={() => setShowCompliance(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>

            {/* Score */}
            <div style={{
              textAlign: 'center',
              padding: 20,
              background: complianceScore >= 80 ? 'rgba(34,197,94,0.1)' : complianceScore >= 50 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
              borderRadius: 12,
              marginBottom: 20,
            }}>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                color: complianceScore >= 80 ? 'var(--success)' : complianceScore >= 50 ? 'var(--warning)' : 'var(--danger)',
              }}>
                {complianceScore}%
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {complianceScore >= 80 ? 'Looking good!' : complianceScore >= 50 ? 'Almost there' : 'Needs work'}
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {complianceItems.map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  background: item.pass ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  borderRadius: 6,
                  fontSize: 14,
                }}>
                  <span style={{ color: item.pass ? 'var(--success)' : 'var(--danger)' }}>
                    {item.pass ? '✓' : '○'}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowCompliance(false)}
              style={{ width: '100%', marginTop: 20 }}
            >
              Continue Editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
