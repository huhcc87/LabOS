import { useState, lazy, Suspense } from 'react';
import NotebookCanvas from '../components/NotebookCanvas';
import type { NotebookCanvasValue } from '../components/NotebookCanvas';
import { SignaturePanel } from '../components/ElectronicSignatureDialog';
import { ExperimentResultsPanel, type ResultPoint } from '../components/ExperimentResultsPanel';

const RichELNEditor = lazy(() =>
  import('../components/RichELNEditor').then(m => ({ default: m.RichELNEditor }))
);

// ─── Types ──────────────────────────────────────────────────────────────────
type EntryStatus = 'draft' | 'in_review' | 'signed' | 'locked';
type FAIRTag = 'findable' | 'accessible' | 'interoperable' | 'reusable';

interface ExperimentEntry {
  id: number;
  title: string;
  template: string;
  date: string;
  author: string;
  status: EntryStatus;
  tags: string[];
  fairTags: FAIRTag[];
  protocol?: string;
  data: Record<string, string>;
  notes: string;
  handwriting?: NotebookCanvasValue;
  results?: ResultPoint[];
  figures: { name: string; url: string }[];
  version: number;
  signedBy?: string;
  signedAt?: string;
}

// ─── Templates ──────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    key: 'pcr', label: 'PCR / qPCR', icon: '🧬',
    fields: [
      { key: 'gene_target', label: 'Gene Target', type: 'text' },
      { key: 'primer_forward', label: 'Forward Primer (5\'→3\')', type: 'text' },
      { key: 'primer_reverse', label: 'Reverse Primer (5\'→3\')', type: 'text' },
      { key: 'template_dna', label: 'Template DNA', type: 'text' },
      { key: 'cycles', label: 'Cycle Number', type: 'number' },
      { key: 'annealing_temp', label: 'Annealing Temp (°C)', type: 'number' },
      { key: 'extension_time', label: 'Extension Time (s)', type: 'number' },
      { key: 'results', label: 'Results / Ct Values', type: 'textarea' },
    ],
  },
  {
    key: 'western', label: 'Western Blot', icon: '🔬',
    fields: [
      { key: 'antibody_primary', label: 'Primary Antibody', type: 'text' },
      { key: 'antibody_secondary', label: 'Secondary Antibody', type: 'text' },
      { key: 'blocking', label: 'Blocking Condition', type: 'text' },
      { key: 'dilution_primary', label: 'Primary Dilution', type: 'text' },
      { key: 'dilution_secondary', label: 'Secondary Dilution', type: 'text' },
      { key: 'exposure_time', label: 'Exposure Time', type: 'text' },
      { key: 'band_size', label: 'Expected Band (kDa)', type: 'text' },
      { key: 'results', label: 'Results / Observations', type: 'textarea' },
    ],
  },
  {
    key: 'elisa', label: 'ELISA', icon: '🧫',
    fields: [
      { key: 'analyte', label: 'Analyte / Target', type: 'text' },
      { key: 'kit', label: 'Kit / Manufacturer', type: 'text' },
      { key: 'samples', label: 'Samples Tested', type: 'text' },
      { key: 'standard_curve', label: 'Standard Curve Range', type: 'text' },
      { key: 'plate_reader', label: 'Plate Reader / Wavelength', type: 'text' },
      { key: 'results', label: 'OD Values / Concentrations', type: 'textarea' },
      { key: 'interpretation', label: 'Interpretation', type: 'textarea' },
    ],
  },
  {
    key: 'cell_culture', label: 'Cell Culture', icon: '🦠',
    fields: [
      { key: 'cell_line', label: 'Cell Line / Passage', type: 'text' },
      { key: 'media', label: 'Culture Media', type: 'text' },
      { key: 'seeding_density', label: 'Seeding Density', type: 'text' },
      { key: 'treatment', label: 'Treatment / Drug', type: 'text' },
      { key: 'concentration', label: 'Concentration / Duration', type: 'text' },
      { key: 'incubator_conditions', label: 'Incubator Conditions', type: 'text' },
      { key: 'observations', label: 'Morphology / Observations', type: 'textarea' },
      { key: 'viability', label: 'Viability (%)', type: 'number' },
    ],
  },
  {
    key: 'flow_cytometry', label: 'Flow Cytometry', icon: '💧',
    fields: [
      { key: 'instrument', label: 'Cytometer / Instrument', type: 'text' },
      { key: 'markers', label: 'Markers / Panel', type: 'text' },
      { key: 'sample_prep', label: 'Sample Preparation', type: 'text' },
      { key: 'cells_acquired', label: 'Cells Acquired', type: 'number' },
      { key: 'gating', label: 'Gating Strategy', type: 'textarea' },
      { key: 'results', label: '% Positive / MFI Results', type: 'textarea' },
    ],
  },
  {
    key: 'sequencing', label: 'Sequencing', icon: '🧪',
    fields: [
      { key: 'platform', label: 'Platform (Illumina / PacBio / etc.)', type: 'text' },
      { key: 'library_type', label: 'Library Type', type: 'text' },
      { key: 'samples', label: 'Sample IDs', type: 'textarea' },
      { key: 'read_depth', label: 'Target Read Depth', type: 'text' },
      { key: 'run_id', label: 'Run / Flow Cell ID', type: 'text' },
      { key: 'qc_metrics', label: 'QC Metrics (Q30%, Yield)', type: 'textarea' },
      { key: 'analysis_pipeline', label: 'Analysis Pipeline', type: 'text' },
    ],
  },
  {
    key: 'custom', label: 'Custom Entry', icon: '📝',
    fields: [
      { key: 'objective', label: 'Objective', type: 'textarea' },
      { key: 'materials', label: 'Materials & Reagents', type: 'textarea' },
      { key: 'procedure', label: 'Procedure', type: 'textarea' },
      { key: 'results', label: 'Results', type: 'textarea' },
      { key: 'conclusions', label: 'Conclusions', type: 'textarea' },
    ],
  },
];

const STATUS_META: Record<EntryStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#9ca3af', bg: 'rgba(107,114,128,0.15)' },
  in_review: { label: 'In Review', color: '#fbbf24', bg: 'rgba(234,179,8,0.15)' },
  signed: { label: 'Signed', color: '#4ade80', bg: 'rgba(34,197,94,0.15)' },
  locked: { label: 'Locked', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
};

const FAIR_META: Record<FAIRTag, { label: string; color: string }> = {
  findable: { label: 'F', color: '#6366f1' },
  accessible: { label: 'A', color: '#22c55e' },
  interoperable: { label: 'I', color: '#f59e0b' },
  reusable: { label: 'R', color: '#ec4899' },
};

const MOCK_ENTRIES: ExperimentEntry[] = [
  {
    id: 1, title: 'KRAS G12D knockdown PCR validation', template: 'pcr',
    date: '2026-05-08', author: 'Dr. Chen', status: 'signed',
    tags: ['KRAS', 'colorectal', 'validation'], fairTags: ['findable', 'accessible', 'reusable'],
    protocol: 'Protocol v3.2 — KRAS knockdown',
    data: { gene_target: 'KRAS G12D', primer_forward: 'GAATATGATCCCACTATA', primer_reverse: 'CTATTGTTGGATCATATT', cycles: '40', annealing_temp: '58', extension_time: '30', results: 'Ct = 18.3 (treated), 24.1 (control). ~64-fold knockdown confirmed.' },
    notes: 'Samples from passage 12 cells. Ran in triplicate. High confidence.',
    results: [
      { label: 'Treated Rep1', value: 18.3, unit: 'Ct', series: 'Treated' },
      { label: 'Treated Rep2', value: 18.7, unit: 'Ct', series: 'Treated' },
      { label: 'Treated Rep3', value: 18.1, unit: 'Ct', series: 'Treated' },
      { label: 'Control Rep1', value: 24.1, unit: 'Ct', series: 'Control' },
      { label: 'Control Rep2', value: 24.4, unit: 'Ct', series: 'Control' },
      { label: 'Control Rep3', value: 23.8, unit: 'Ct', series: 'Control' },
    ],
    figures: [], version: 3, signedBy: 'Dr. Chen', signedAt: '2026-05-09T14:22:00',
  },
  {
    id: 2, title: 'Anti-PD-L1 expression Western Blot', template: 'western',
    date: '2026-05-10', author: 'Dr. Patel', status: 'in_review',
    tags: ['PD-L1', 'immunotherapy', 'western'], fairTags: ['findable', 'interoperable'],
    data: { antibody_primary: 'Anti-PD-L1 (ab205921)', antibody_secondary: 'HRP Goat anti-Rabbit', blocking: '5% BSA in TBST', dilution_primary: '1:1000', dilution_secondary: '1:5000', exposure_time: '30 sec', band_size: '33-35', results: 'Strong band at 33kDa in treated cells. Minimal in untreated control.' },
    notes: 'Repeat run — first blot had high background.',
    results: [
      { label: 'Untreated', value: 0.12, unit: 'AU', series: 'PD-L1 expression' },
      { label: 'IFN-γ 24h', value: 1.85, unit: 'AU', series: 'PD-L1 expression' },
      { label: 'IFN-γ 48h', value: 3.40, unit: 'AU', series: 'PD-L1 expression' },
      { label: 'Anti-PD-L1', value: 0.32, unit: 'AU', series: 'PD-L1 expression' },
    ],
    figures: [], version: 2,
  },
];

// ─── Input styles ────────────────────────────────────────────────────────────
const INP: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const TA: React.CSSProperties = { ...INP, resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.6 };

// ─── Component ───────────────────────────────────────────────────────────────
export default function ELNPage() {
  const [view, setView] = useState<'list' | 'compose' | 'detail'>('list');
  const [entries, setEntries] = useState<ExperimentEntry[]>(MOCK_ENTRIES);
  const [selected, setSelected] = useState<ExperimentEntry | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');

  // Compose state
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [newData, setNewData] = useState<Record<string, string>>({});
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newFair, setNewFair] = useState<FAIRTag[]>([]);
  const [newHandwriting, setNewHandwriting] = useState<NotebookCanvasValue | undefined>(undefined);
  const [aiLoading, setAiLoading] = useState(false);
  const [composeView, setComposeView] = useState<'text' | 'handwrite'>('text');
  const [detailView, setDetailView] = useState<'text' | 'handwrite'>('text');

  const tpl = TEMPLATES.find(t => t.key === newTemplate);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.title.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q));
    const matchS = filterStatus === 'all' || e.status === filterStatus;
    const matchT = filterTemplate === 'all' || e.template === filterTemplate;
    return matchQ && matchS && matchT;
  });

  const handleAIDraft = () => {
    if (!tpl) return;
    setAiLoading(true);
    setTimeout(() => {
      const drafts: Record<string, string> = {};
      if (newTemplate === 'pcr') {
        Object.assign(drafts, { gene_target: 'KRAS G12D', primer_forward: 'GAATATGATCCCACTATA', primer_reverse: 'CTATTGTTGGATCATATT', cycles: '40', annealing_temp: '58', extension_time: '30', results: 'Ct values to be filled after run completion.' });
      } else if (newTemplate === 'western') {
        Object.assign(drafts, { antibody_primary: 'Anti-target protein antibody', antibody_secondary: 'HRP-conjugated secondary', blocking: '5% non-fat milk in TBST, 1hr RT', dilution_primary: '1:1000', dilution_secondary: '1:5000', exposure_time: 'Titrate 10s–5min', band_size: 'Check datasheet', results: 'Expected band at [X] kDa' });
      } else {
        tpl.fields.forEach(f => { drafts[f.key] = `[AI suggested: describe ${f.label.toLowerCase()} here]`; });
      }
      setNewData(drafts);
      setNewNotes('AI-generated draft. Please review and update all fields with actual experimental data.');
      setAiLoading(false);
    }, 1800);
  };

  const handleSave = (status: EntryStatus = 'draft') => {
    if (!newTitle || !newTemplate) return;
    const entry: ExperimentEntry = {
      id: Date.now(), title: newTitle, template: newTemplate,
      date: new Date().toISOString().slice(0, 10), author: 'Dr. User',
      status, tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      fairTags: newFair, data: newData, notes: newNotes, handwriting: newHandwriting, figures: [], version: 1,
    };
    setEntries(prev => [entry, ...prev]);
    setView('list');
    setNewTitle(''); setNewTemplate(''); setNewData({}); setNewNotes(''); setNewTags(''); setNewFair([]);
  };

  const handleSign = (entry: ExperimentEntry) => {
    setEntries(prev => prev.map(e => e.id === entry.id
      ? { ...e, status: 'signed', signedBy: 'Dr. User', signedAt: new Date().toISOString() }
      : e));
    setSelected(prev => prev ? { ...prev, status: 'signed', signedBy: 'Dr. User', signedAt: new Date().toISOString() } : null);
  };

  const exportEntry = (entry: ExperimentEntry) => {
    const tplDef = TEMPLATES.find(t => t.key === entry.template);
    let txt = `ELECTRONIC LAB NOTEBOOK ENTRY\n${'='.repeat(60)}\n`;
    txt += `Title: ${entry.title}\nTemplate: ${tplDef?.label}\nDate: ${entry.date}\nAuthor: ${entry.author}\nStatus: ${STATUS_META[entry.status].label}\nVersion: ${entry.version}\n`;
    if (entry.signedBy) txt += `Signed by: ${entry.signedBy} at ${entry.signedAt}\n`;
    txt += `Tags: ${entry.tags.join(', ')}\nFAIR: ${entry.fairTags.join(', ')}\n\n`;
    txt += `DATA\n${'─'.repeat(40)}\n`;
    tplDef?.fields.forEach(f => { txt += `${f.label}: ${entry.data[f.key] || '—'}\n`; });
    txt += `\nNOTES\n${'─'.repeat(40)}\n${entry.notes}\n`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ELN-${entry.title.slice(0, 30).replace(/\s/g, '_')}-v${entry.version}.txt`; a.click();
  };

  // ── COMPOSE VIEW ──────────────────────────────────────────────────────────
  if (view === 'compose') {
    return (
      <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>New Experiment Entry</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Select a template and fill in your experimental data</p>
          </div>
          <button onClick={() => setView('list')} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        </div>

        {/* Template picker */}
        {!newTemplate && (
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Choose Template</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {TEMPLATES.map(t => (
                <div key={t.key} onClick={() => setNewTemplate(t.key)}
                  style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = ''; }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {newTemplate && tpl && (
          <>
            {/* Header */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{tpl.icon}</span>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{tpl.label}</div>
                <button onClick={() => { setNewTemplate(''); setNewData({}); }} style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Change</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Experiment Title *</label>
                  <input style={INP} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Descriptive title for this experiment..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Tags (comma-separated)</label>
                  <input style={INP} value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="KRAS, colorectal, western, ..." />
                </div>
              </div>
            </div>

            {/* Data Fields */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Experimental Data</h3>
                <button onClick={handleAIDraft} disabled={aiLoading} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: aiLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {aiLoading ? '⏳ Drafting...' : '✨ AI Draft'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tpl.fields.map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    {f.type === 'textarea'
                      ? <textarea style={TA} value={newData[f.key] || ''} onChange={e => setNewData(prev => ({ ...prev, [f.key]: e.target.value }))} />
                      : <input style={INP} type={f.type} value={newData[f.key] || ''} onChange={e => setNewData(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Notes + FAIR */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes & Observations</label>
                    <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8 }}>
                      <button type="button" onClick={() => setComposeView('text')}
                        style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          background: composeView === 'text' ? 'var(--primary)' : 'transparent',
                          color: composeView === 'text' ? '#fff' : 'var(--text)' }}>
                        📝 Text
                      </button>
                      <button type="button" onClick={() => setComposeView('handwrite')}
                        style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          background: composeView === 'handwrite' ? 'var(--primary)' : 'transparent',
                          color: composeView === 'handwrite' ? '#fff' : 'var(--text)' }}>
                        ✍️ Handwrite
                      </button>
                    </div>
                  </div>
                  {composeView === 'text' ? (
                    <Suspense fallback={<div style={{minHeight:200,border:'1px solid #e2e8f0',borderRadius:8,padding:16,color:'#94a3b8'}}>Loading editor…</div>}>
                      <RichELNEditor
                        initialContent={newNotes}
                        onChange={html => setNewNotes(html)}
                        placeholder="Observations, deviations from protocol, troubleshooting notes..."
                      />
                    </Suspense>
                  ) : (
                    <NotebookCanvas value={newHandwriting} onChange={setNewHandwriting} />
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>FAIR Data Tags</label>
                  {(['findable', 'accessible', 'interoperable', 'reusable'] as FAIRTag[]).map(tag => (
                    <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={newFair.includes(tag)} onChange={e => setNewFair(prev => e.target.checked ? [...prev, tag] : prev.filter(t => t !== tag))} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: FAIR_META[tag].color, color: '#fff', fontSize: 11, fontWeight: 700 }}>{FAIR_META[tag].label}</span>
                      <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setView('list')} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={() => handleSave('draft')} style={{ padding: '8px 18px', border: '1px solid var(--primary)', borderRadius: 8, background: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Save Draft</button>
              <button onClick={() => handleSave('in_review')} style={{ padding: '8px 22px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Submit for Review</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const tplDef = TEMPLATES.find(t => t.key === selected.template);
    const sm = STATUS_META[selected.status];
    return (
      <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selected.title}</h2>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sm.bg, color: sm.color }}>{sm.label}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tplDef?.icon} {tplDef?.label} · {selected.author} · {selected.date} · v{selected.version}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportEntry(selected)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>⬇ Export</button>
            {selected.status === 'in_review' && (
              <button onClick={() => handleSign(selected)} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✍ Sign Entry</button>
            )}
            <button onClick={() => setView('list')} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experimental Data</h3>
              {tplDef?.fields.map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.data[f.key] || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not recorded</span>}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</h3>
                <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8 }}>
                  <button type="button" onClick={() => setDetailView('text')}
                    style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: detailView === 'text' ? 'var(--primary)' : 'transparent',
                      color: detailView === 'text' ? '#fff' : 'var(--text)' }}>
                    📝 Text
                  </button>
                  <button type="button" onClick={() => setDetailView('handwrite')}
                    style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: detailView === 'handwrite' ? 'var(--primary)' : 'transparent',
                      color: detailView === 'handwrite' ? '#fff' : 'var(--text)' }}>
                    ✍️ Handwrite{selected.handwriting && selected.handwriting.pages?.some(p => p.strokes.length > 0) && <span style={{ marginLeft: 4, fontSize: 9 }}>●</span>}
                  </button>
                </div>
              </div>
              {detailView === 'text' ? (
                <Suspense fallback={<div style={{minHeight:200,border:'1px solid #e2e8f0',borderRadius:8,padding:16,color:'#94a3b8'}}>Loading editor…</div>}>
                  <RichELNEditor
                    initialContent={selected.notes ?? ''}
                    onChange={html => {
                      setSelected(prev => prev ? { ...prev, notes: html } : null);
                      setEntries(prev => prev.map(e => e.id === selected.id ? { ...e, notes: html } : e));
                    }}
                    readOnly={selected.status === 'locked' || selected.status === 'signed'}
                  />
                </Suspense>
              ) : (
                <NotebookCanvas
                  value={selected.handwriting}
                  onChange={hw => {
                    setSelected(prev => prev ? { ...prev, handwriting: hw } : null);
                    setEntries(prev => prev.map(e => e.id === selected.id ? { ...e, handwriting: hw } : e));
                  }}
                  readOnly={selected.status === 'locked' || selected.status === 'signed'}
                />
              )}
            </div>

            {/* Results chart */}
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quantitative Results</h3>
              <ExperimentResultsPanel
                results={selected.results ?? []}
                readOnly={selected.status === 'locked' || selected.status === 'signed'}
                onChange={pts => {
                  setSelected(prev => prev ? { ...prev, results: pts } : null);
                  setEntries(prev => prev.map(e => e.id === selected.id ? { ...e, results: pts } : e));
                }}
              />
            </div>

            {/* Signatures */}
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signatures</h3>
              <SignaturePanel
                entityType="notebook_entry"
                entityId={selected.id}
                entityTitle={selected.title}
                content={selected.notes}
              />
            </div>
          </div>
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Tags</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selected.tags.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{t}</span>)}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>FAIR Data Compliance</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['findable', 'accessible', 'interoperable', 'reusable'] as FAIRTag[]).map(tag => {
                  const active = selected.fairTags.includes(tag);
                  return (
                    <div key={tag} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: active ? 1 : 0.3 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: active ? FAIR_META[tag].color : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{FAIR_META[tag].label}</div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{tag}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {selected.signedBy && (
              <div className="card" style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 4 }}>✍ Digitally Signed</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>By {selected.signedBy}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.signedAt ? new Date(selected.signedAt).toLocaleString() : ''}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  const totalEntries = entries.length;
  const signed = entries.filter(e => e.status === 'signed').length;
  const inReview = entries.filter(e => e.status === 'in_review').length;

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Electronic Lab Notebook</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>FAIR-compliant, AI-assisted, digitally signed experiment records</p>
        </div>
        <button onClick={() => setView('compose')} className="btn btn-primary">+ New Entry</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Entries', value: totalEntries, color: 'var(--text)' },
          { label: 'Signed', value: signed, color: '#4ade80' },
          { label: 'In Review', value: inReview, color: '#fbbf24' },
          { label: 'Drafts', value: entries.filter(e => e.status === 'draft').length, color: '#9ca3af' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...INP, maxWidth: 280 }} placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...INP, maxWidth: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ ...INP, maxWidth: 180 }} value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)}>
          <option value="all">All Templates</option>
          {TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
      </div>

      {/* Entries list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No entries found. Create your first experiment entry.</div>}
        {filtered.map(entry => {
          const tplDef = TEMPLATES.find(t => t.key === entry.template);
          const sm = STATUS_META[entry.status];
          return (
            <div key={entry.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, cursor: 'pointer' }}
              onClick={() => { setSelected(entry); setView('detail'); }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{tplDef?.icon || '📝'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tplDef?.label} · {entry.author} · {entry.date} · v{entry.version}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {entry.tags.slice(0, 4).map(t => <span key={t} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{t}</span>)}
                    {entry.fairTags.map(ft => <span key={ft} style={{ width: 18, height: 18, borderRadius: 4, background: FAIR_META[ft].color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{FAIR_META[ft].label}</span>)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sm.bg, color: sm.color }}>{sm.label}</span>
                {entry.signedBy && <span title="Digitally signed" style={{ color: '#4ade80', fontSize: 16 }}>✍</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
