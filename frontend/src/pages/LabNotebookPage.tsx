import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { notebookApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { exportCSV, exportPDF } from '../lib/export';
import NotebookCanvas, { parseNotebookCanvas, serializeNotebookCanvas } from '../components/NotebookCanvas';
import type { NotebookCanvasValue } from '../components/NotebookCanvas';

// Handwriting is stored inside the same `content` field as an HTML-comment
// trailer so it round-trips through the backend with zero schema changes.
const HW_OPEN = '<!--LABOS_HANDWRITING_V1';
const HW_CLOSE = '-->';

function splitContent(content: string): { text: string; canvas: NotebookCanvasValue | null } {
  const i = content.indexOf(HW_OPEN);
  if (i === -1) return { text: content, canvas: null };
  const j = content.indexOf(HW_CLOSE, i);
  if (j === -1) return { text: content, canvas: null };
  const text = content.slice(0, i).replace(/\s+$/, '');
  const raw = content.slice(i + HW_OPEN.length, j).trim();
  return { text, canvas: parseNotebookCanvas(raw) };
}

function joinContent(text: string, canvas: NotebookCanvasValue | null): string {
  if (!canvas || canvas.pages.every(p => p.strokes.length === 0)) return text;
  return `${text}\n\n${HW_OPEN}\n${serializeNotebookCanvas(canvas)}\n${HW_CLOSE}\n`;
}

type Entry = {
  id: string | number; title: string; content: string; experiment_type: string; tags: string;
  author_id: number; author_name?: string; signed_at?: string;
  witnessed_by_id?: number; witnessed_at?: string; is_archived: boolean;
  linked_sample_id?: number; linked_protocol_id?: number;
  created_at: string; updated_at: string;
};

const EXPERIMENT_TYPES = [
  'General Experiment', 'Cell Culture', 'Western Blot', 'PCR / qPCR',
  'Immunofluorescence', 'Flow Cytometry', 'ELISA', 'Cloning', 'Protein Purification',
  'Animal Experiment', 'Sequencing', 'Microscopy', 'Drug Treatment', 'Other',
];

const TYPE_COLORS: Record<string, string> = {
  'Cell Culture': '#22c55e', 'Western Blot': '#6366f1', 'PCR / qPCR': '#f59e0b',
  'Immunofluorescence': '#ec4899', 'Flow Cytometry': '#06b6d4', 'ELISA': '#8b5cf6',
  'Cloning': '#10b981', 'Animal Experiment': '#ef4444', 'Sequencing': '#3b82f6',
  'Microscopy': '#f97316', 'Drug Treatment': '#a855f7',
};

function formatDate(s: string) {
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:12px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;margin:14px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;margin:16px 0 8px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0 2px 16px">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:2px 0 2px 16px"><b>$1.</b> $2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function LabNotebookPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [preview, setPreview] = useState(false);

  const [form, setForm] = useState({ title: '', content: '', experiment_type: 'General Experiment', tags: '' });
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<'text' | 'handwriting'>('text');

  // Derive text/canvas from the selected entry's content
  const split = selectedEntry ? splitContent(selectedEntry.content) : { text: '', canvas: null as NotebookCanvasValue | null };
  const updateText = (newText: string) => {
    if (!selectedEntry) return;
    setSelectedEntry({ ...selectedEntry, content: joinContent(newText, split.canvas) });
  };
  const updateCanvas = (canvas: NotebookCanvasValue) => {
    if (!selectedEntry) return;
    setSelectedEntry({ ...selectedEntry, content: joinContent(split.text, canvas) });
  };
  const hasHandwriting = !!split.canvas && split.canvas.pages.some(p => p.strokes.length > 0);

  async function loadEntries() {
    setLoading(true);
    try {
      const extra = filterType ? { experiment_type: filterType } : undefined;
      const res = await notebookApi.list(1, 50, search, extra);
      setEntries(res.data.items);
    } catch { toast.error('Failed to load notebook'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEntries(); }, [search, filterType]);

  async function handleCreate() {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await notebookApi.create(form);
      toast.success('Entry created');
      setEntries(prev => [res.data, ...prev]);
      setSelectedEntry(res.data);
      setShowNew(false);
      setForm({ title: '', content: '', experiment_type: 'General Experiment', tags: '' });
    } catch { toast.error('Failed to create entry'); }
    finally { setSaving(false); }
  }

  async function handleSave() {
    if (!selectedEntry) return;
    setSaving(true);
    try {
      const res = await notebookApi.update(selectedEntry.id, {
        title: selectedEntry.title,
        content: selectedEntry.content,
        experiment_type: selectedEntry.experiment_type,
        tags: selectedEntry.tags,
      });
      toast.success('Saved');
      setSelectedEntry(res.data);
      setEntries(prev => prev.map(e => e.id === res.data.id ? res.data : e));
      setEditMode(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleSign() {
    if (!selectedEntry) return;
    try {
      const res = await notebookApi.sign(selectedEntry.id);
      toast.success('Entry signed — it is now locked');
      const updated = res.data as Entry;
      if (updated.title) {
        setSelectedEntry(updated);
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      } else {
        loadEntries();
      }
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed to sign'); }
  }

  async function handleWitness() {
    if (!selectedEntry) return;
    try {
      const res = await notebookApi.witness(selectedEntry.id);
      toast.success('Entry witnessed');
      const updated = res.data as Entry;
      if (updated.title) {
        setSelectedEntry(updated);
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      } else {
        loadEntries();
      }
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed to witness'); }
  }

  async function handleDelete() {
    if (!selectedEntry || !confirm('Delete this entry?')) return;
    try {
      await notebookApi.delete(selectedEntry.id);
      toast.success('Deleted');
      setEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
      setSelectedEntry(null);
    } catch { toast.error('Failed to delete'); }
  }

  function insertMarkdown(prefix: string, suffix = '') {
    const ta = textareaRef.current;
    if (!ta || !selectedEntry) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const current = splitContent(selectedEntry.content);
    const selected = current.text.substring(start, end);
    const newText = current.text.substring(0, start) + prefix + selected + suffix + current.text.substring(end);
    setSelectedEntry({ ...selectedEntry, content: joinContent(newText, current.canvas) });
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, end + prefix.length); }, 10);
  }

  const isSigned = !!selectedEntry?.signed_at;
  const isWitnessed = !!selectedEntry?.witnessed_at;
  const isAuthor = selectedEntry?.author_id === user?.id;

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Electronic Lab Notebook</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Auto-timestamped experiment records with signing & witnessing for IP protection</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() =>
            exportCSV(entries.map(e => ({ Title: e.title, Type: e.experiment_type, Tags: e.tags, Signed: e.signed_at ? 'Yes' : 'No', Archived: e.is_archived ? 'Yes' : 'No', Created: e.created_at?.toString().slice(0,10) || '' })), 'lab_notebook')
          }>⬇ CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() =>
            exportPDF('Lab Notebook Export', ['Title','Type','Tags','Signed','Created'],
              entries.map(e => [e.title, e.experiment_type, e.tags, e.signed_at ? '✓' : '—', e.created_at?.toString().slice(0,10) || '']), 'lab_notebook')
          }>⬇ PDF</button>
          <button className="btn btn-primary" onClick={() => { setShowNew(true); setSelectedEntry(null); }}>
            + New Entry
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, flex: 1, overflow: 'hidden' }}>
        {/* LEFT: Entry List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <input
            className="form-input" placeholder="Search entries..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 13 }}
          />
          <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">All experiment types</option>
            {EXPERIMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>Loading...</div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📓</div>
                <div style={{ fontSize: 13 }}>No entries yet. Create your first experiment record!</div>
              </div>
            ) : entries.map(entry => (
              <div
                key={entry.id}
                onClick={() => { setSelectedEntry(entry); setEditMode(false); setShowNew(false); }}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: selectedEntry?.id === entry.id ? 'var(--accent)20' : 'var(--surface)',
                  border: `1px solid ${selectedEntry?.id === entry.id ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TYPE_COLORS[entry.experiment_type] || 'var(--text-muted)' }}>
                    {entry.experiment_type}
                  </div>
                  {entry.signed_at && <span style={{ fontSize: 10, background: '#22c55e20', color: '#22c55e', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>SIGNED</span>}
                  {entry.witnessed_at && <span style={{ fontSize: 10, background: '#6366f120', color: '#6366f1', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>WITNESSED</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{entry.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(entry.created_at)}</div>
                {entry.tags && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {entry.tags.split(',').slice(0, 3).map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} style={{ fontSize: 10, background: 'var(--surface2)', padding: '2px 6px', borderRadius: 8, color: 'var(--text-muted)' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Editor / Viewer */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {showNew ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Experiment Entry</h2>
                <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>
              <input className="form-input" placeholder="Experiment title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              <select className="form-select" value={form.experiment_type} onChange={e => setForm(p => ({ ...p, experiment_type: e.target.value }))}>
                {EXPERIMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="form-input" placeholder="Tags (comma-separated: pcr, cell-line, drug-x)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
              <textarea
                className="form-input" rows={10}
                placeholder="## Objective&#10;&#10;## Materials&#10;- Reagent 1&#10;- Reagent 2&#10;&#10;## Protocol&#10;&#10;## Observations&#10;&#10;## Results&#10;&#10;## Conclusion"
                value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Entry'}</button>
                <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </div>
          ) : selectedEntry ? (
            <>
              {/* Toolbar */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TYPE_COLORS[selectedEntry.experiment_type] || 'var(--text-muted)' }}>
                    {selectedEntry.experiment_type}
                  </span>
                  {isSigned && <span style={{ fontSize: 11, background: '#22c55e20', color: '#22c55e', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>✓ SIGNED</span>}
                  {isWitnessed && <span style={{ fontSize: 11, background: '#6366f120', color: '#6366f1', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>✓ WITNESSED</span>}
                </div>
                {editMode && !isSigned && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['B', '**', '**'], ['I', '*', '*'], ['H2', '## ', ''], ['`', '`', '`'], ['—', '\n---\n', '']].map(([label, pre, suf]) => (
                      <button key={label} onClick={() => insertMarkdown(pre, suf)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: label === 'B' ? 700 : label === 'I' ? undefined : 600, fontStyle: label === 'I' ? 'italic' : undefined }}>{label}</button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8 }}>
                  <button onClick={() => setView('text')}
                    style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: view === 'text' ? 'var(--accent)' : 'transparent',
                      color: view === 'text' ? '#fff' : 'var(--text)' }}>
                    📝 Text
                  </button>
                  <button onClick={() => setView('handwriting')}
                    style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: view === 'handwriting' ? 'var(--accent)' : 'transparent',
                      color: view === 'handwriting' ? '#fff' : 'var(--text)' }}>
                    ✍️ Handwrite{hasHandwriting && <span style={{ marginLeft: 4, fontSize: 9 }}>●</span>}
                  </button>
                </div>
                {view === 'text' && (
                  <button onClick={() => setPreview(p => !p)} style={{ background: preview ? 'var(--accent)' : 'var(--surface2)', color: preview ? '#fff' : 'var(--text)', border: `1px solid ${preview ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                    {preview ? 'Edit' : 'Preview'}
                  </button>
                )}
                {!isSigned && !editMode && <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>Edit</button>}
                {editMode && !isSigned && <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
                {editMode && <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel</button>}
                {!isSigned && isAuthor && !editMode && <button onClick={handleSign} style={{ background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Sign</button>}
                {isSigned && !isWitnessed && !isAuthor && <button onClick={handleWitness} style={{ background: '#6366f120', color: '#6366f1', border: '1px solid #6366f140', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Witness</button>}
                {!isSigned && <button onClick={handleDelete} style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>🗑</button>}
              </div>

              {/* Title */}
              <div style={{ padding: '16px 20px 0' }}>
                {editMode && !isSigned ? (
                  <input className="form-input" value={selectedEntry.title} onChange={e => setSelectedEntry({ ...selectedEntry, title: e.target.value })} style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }} />
                ) : (
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{selectedEntry.title}</h2>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, flexWrap: 'wrap' }}>
                  <span>By {selectedEntry.author_name}</span>
                  <span>Created: {formatDate(selectedEntry.created_at)}</span>
                  <span>Updated: {formatDate(selectedEntry.updated_at)}</span>
                  {isSigned && <span style={{ color: '#22c55e' }}>Signed: {formatDate(selectedEntry.signed_at!)}</span>}
                  {isWitnessed && <span style={{ color: '#6366f1' }}>Witnessed: {formatDate(selectedEntry.witnessed_at!)}</span>}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
                {view === 'handwriting' ? (
                  <NotebookCanvas
                    value={split.canvas || undefined}
                    onChange={updateCanvas}
                    readOnly={isSigned || !editMode}
                  />
                ) : preview || isSigned ? (
                  <div
                    style={{ lineHeight: 1.7, fontSize: 14, color: 'var(--text)' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(split.text) }}
                  />
                ) : editMode ? (
                  <textarea
                    ref={textareaRef}
                    value={split.text}
                    onChange={e => updateText(e.target.value)}
                    style={{ width: '100%', minHeight: 400, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, fontFamily: 'monospace', resize: 'vertical', padding: 0 }}
                    placeholder="Write your experiment notes in Markdown..."
                  />
                ) : (
                  <div
                    style={{ lineHeight: 1.7, fontSize: 14, color: 'var(--text)', cursor: 'text' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(split.text) || '<span style="color:var(--text-muted)">No content yet. Click Edit to start writing.</span>' }}
                    onClick={() => setEditMode(true)}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 56 }}>📓</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Select an entry or create a new one</div>
              <div style={{ fontSize: 13 }}>Auto-timestamped • Markdown editor • Sign & witness for IP protection</div>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Experiment Entry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
