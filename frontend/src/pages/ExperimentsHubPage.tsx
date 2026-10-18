import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ExportMenu } from '../components/ExportMenu';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { errText } from '../lib/errors';

type TabType = 'experiments' | 'results' | 'timeline' | 'files';

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface ExperimentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

interface Experiment {
  id: string;
  title: string;
  description: string;
  protocol: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: string;
  endDate?: string;
  leadResearcher: string;
  team: TeamMember[];
  steps: ExperimentStep[];
  samples: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Result {
  id: string;
  experimentId: string;
  experimentTitle: string;
  title: string;
  type: 'observation' | 'measurement' | 'analysis' | 'conclusion';
  value: string;
  unit?: string;
  notes: string;
  attachments: string[];
  recordedBy: string;
  recordedAt: string;
}

interface TimelineEvent {
  id: string;
  experimentId: string;
  experimentTitle: string;
  type: 'created' | 'started' | 'step_completed' | 'result_added' | 'paused' | 'resumed' | 'completed' | 'note_added';
  description: string;
  user: string;
  timestamp: string;
}

interface ExperimentFile {
  id: string;
  experimentId: string;
  experimentTitle: string;
  name: string;
  type: string;
  size: string;
  category: 'protocol' | 'data' | 'image' | 'report' | 'other';
  uploadedBy: string;
  uploadedAt: string;
}

const INITIAL_EXPERIMENTS: Experiment[] = [];
const INITIAL_RESULTS: Result[] = [];
const INITIAL_TIMELINE: TimelineEvent[] = [];
const INITIAL_FILES: ExperimentFile[] = [];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#374151', text: '#9ca3af' },
  active: { bg: '#166534', text: '#86efac' },
  paused: { bg: '#92400e', text: '#fcd34d' },
  completed: { bg: '#1e40af', text: '#93c5fd' },
  archived: { bg: '#4b5563', text: '#d1d5db' },
  pending: { bg: '#374151', text: '#9ca3af' },
  'in-progress': { bg: '#1e40af', text: '#93c5fd' },
  failed: { bg: '#991b1b', text: '#fca5a5' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#374151', text: '#9ca3af' },
  medium: { bg: '#1e40af', text: '#93c5fd' },
  high: { bg: '#92400e', text: '#fcd34d' },
  critical: { bg: '#991b1b', text: '#fca5a5' },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  observation: { bg: '#166534', text: '#86efac' },
  measurement: { bg: '#1e40af', text: '#93c5fd' },
  analysis: { bg: '#7c2d92', text: '#e9d5ff' },
  conclusion: { bg: '#0e7490', text: '#67e8f9' },
};

const EVENT_ICONS: Record<string, string> = {
  created: '+',
  started: '|>',
  step_completed: '::',
  result_added: '=',
  paused: '||',
  resumed: '|>',
  completed: '**',
  note_added: '#',
};

export default function ExperimentsHubPage() {
  const { token } = useAuth();
  const data = useQuery(api.experiments.overview, token ? { token } : 'skip');
  const saveExpM = useMutation(api.experiments.save);
  const removeExpM = useMutation(api.experiments.remove);
  const setStatusM = useMutation(api.experiments.setStatus);
  const addStepM = useMutation(api.experiments.addStep);
  const setStepStatusM = useMutation(api.experiments.setStepStatus);
  const saveResultM = useMutation(api.experiments.saveResult);
  const removeResultM = useMutation(api.experiments.removeResult);
  const makeUploadUrl = useMutation(api.experiments.generateUploadUrl);
  const addFileM = useMutation(api.experiments.addFile);
  const removeFileM = useMutation(api.experiments.removeFile);

  const [activeTab, setActiveTab] = useState<TabType>('experiments');

  // Saved data, shaped for the screens below. `id` is the visible code (EXP-001); `docId` is the database id.
  const experiments: (Experiment & { docId: Id<'experiments'> })[] = (data?.experiments ?? []).map(e => ({
    id: e.code, docId: e._id, title: e.title, description: e.description, protocol: e.protocol,
    status: e.status as Experiment['status'], priority: e.priority as Experiment['priority'],
    startDate: e.start_date, endDate: e.end_date, leadResearcher: e.lead_researcher, team: e.team,
    steps: e.steps as ExperimentStep[], samples: e.samples, tags: e.tags,
    createdAt: new Date(e.created_at).toISOString().split('T')[0], updatedAt: new Date(e.updated_at).toISOString().split('T')[0],
  }));
  const expByCode = (code: string) => experiments.find(e => e.id === code);
  const results: (Result & { docId: Id<'experiment_results'> })[] = (data?.results ?? []).map(r => ({
    id: r.code, docId: r._id, experimentId: experiments.find(e => e.docId === r.experiment_id)?.id ?? '', experimentTitle: r.experiment_title,
    title: r.title, type: r.type as Result['type'], value: r.value, unit: r.unit, notes: r.notes, attachments: [],
    recordedBy: r.recorded_by, recordedAt: new Date(r.recorded_at).toISOString().split('T')[0],
  }));
  const files: (ExperimentFile & { docId: Id<'experiment_files'>; url: string | null })[] = (data?.files ?? []).map(f => ({
    id: f._id, docId: f._id, url: f.url, experimentId: experiments.find(e => e.docId === f.experiment_id)?.id ?? '', experimentTitle: f.experiment_title,
    name: f.name, type: f.type, size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
    category: f.category as ExperimentFile['category'], uploadedBy: f.uploaded_by, uploadedAt: new Date(f.uploaded_at).toISOString().split('T')[0],
  }));
  const timeline: TimelineEvent[] = (data?.events ?? []).map(ev => ({
    id: ev._id, experimentId: ev.experiment_id ?? '', experimentTitle: ev.experiment_title, type: ev.type as TimelineEvent['type'],
    description: ev.description, user: ev.user, timestamp: new Date(ev.at).toLocaleString(),
  }));

  // Modals
  const [showExpModal, setShowExpModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editingExp, setEditingExp] = useState<Experiment | null>(null);
  const [editingResult, setEditingResult] = useState<Result | null>(null);
  const [viewingSnap, setViewingExp] = useState<Experiment | null>(null);
  const viewingExp = viewingSnap ? experiments.find(e => e.id === viewingSnap.id) ?? viewingSnap : null; // always the saved copy

  // Filters
  const [expStatusFilter, setExpStatusFilter] = useState('');
  const [expPriorityFilter, setExpPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const emptyExp = () => ({ title: '', description: '', protocol: '', status: 'draft' as Experiment['status'], priority: 'medium' as Experiment['priority'], startDate: today(), leadResearcher: '', tags: '' });
  const [expForm, setExpForm] = useState(emptyExp);
  const [resultForm, setResultForm] = useState({
    experimentId: '', title: '', type: 'measurement' as Result['type'], value: '', unit: '', notes: ''
  });
  const [fileForm, setFileForm] = useState<{ experimentId: string; category: ExperimentFile['category']; file: File | null }>({ experimentId: '', category: 'data', file: null });
  const [busy, setBusy] = useState(false);

  /** Run a saved-data action and show its error in plain words. */
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); return true; } catch (e) { toast.error(errText(e)); return false; }
  };

  // Experiment CRUD
  const handleSaveExp = async () => {
    if (!token) return;
    const missing = [!expForm.title.trim() && 'title', !expForm.leadResearcher.trim() && 'lead researcher', !expForm.startDate && 'start date'].filter(Boolean);
    if (missing.length) { toast.error(`Please fill in: ${missing.join(', ')}`); return; }
    setBusy(true);
    const exp = editingExp ? experiments.find(e => e.id === editingExp.id) : undefined;
    const ok = await run(() => saveExpM({
      token, id: exp?.docId, title: expForm.title, description: expForm.description, protocol: expForm.protocol, status: expForm.status,
      priority: expForm.priority, start_date: expForm.startDate, lead_researcher: expForm.leadResearcher,
      tags: expForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    }), editingExp ? 'Experiment updated' : 'Experiment created');
    setBusy(false);
    if (ok) resetExpForm();
  };

  const resetExpForm = () => {
    setExpForm(emptyExp());
    setEditingExp(null);
    setShowExpModal(false);
  };

  const handleEditExp = (exp: Experiment) => {
    setExpForm({
      title: exp.title, description: exp.description, protocol: exp.protocol, status: exp.status, priority: exp.priority,
      startDate: exp.startDate, leadResearcher: exp.leadResearcher, tags: exp.tags.join(', '),
    });
    setEditingExp(exp);
    setShowExpModal(true);
  };

  const handleDeleteExp = (code: string) => {
    const exp = expByCode(code);
    if (!exp || !token) return;
    if (confirm('Delete this experiment? All its results and files will be removed.')) run(() => removeExpM({ token, id: exp.docId }), 'Experiment deleted');
  };

  const handleStartExp = (exp: Experiment) => {
    const e = expByCode(exp.id);
    if (e && token) run(() => setStatusM({ token, id: e.docId, status: 'active' }), 'Experiment started');
  };

  const handleCompleteExp = (exp: Experiment) => {
    const e = expByCode(exp.id);
    if (e && token) run(() => setStatusM({ token, id: e.docId, status: 'completed' }), 'Experiment marked as completed');
  };

  // Steps management
  const handleUpdateStep = (expCode: string, stepId: string, newStatus: ExperimentStep['status']) => {
    const e = expByCode(expCode);
    if (e && token) run(() => setStepStatusM({ token, id: e.docId, step_id: stepId, status: newStatus }), 'Step updated');
  };

  const handleAddStep = (expCode: string, stepName: string, stepDesc: string) => {
    const e = expByCode(expCode);
    if (!stepName || !e || !token) return;
    run(() => addStepM({ token, id: e.docId, name: stepName, description: stepDesc }), 'Step added');
  };

  // Result CRUD
  const handleSaveResult = async () => {
    if (!token) return;
    const exp = expByCode(resultForm.experimentId);
    if (!exp || !resultForm.title.trim() || !resultForm.value.trim()) { toast.error('Please fill in: experiment, title and value'); return; }
    const existing = editingResult ? results.find(r => r.id === editingResult.id) : undefined;
    const ok = await run(() => saveResultM({
      token, id: existing?.docId, experiment_id: exp.docId, title: resultForm.title, type: resultForm.type,
      value: resultForm.value, unit: resultForm.unit || undefined, notes: resultForm.notes,
    }), editingResult ? 'Result updated' : 'Result recorded');
    if (ok) resetResultForm();
  };

  const resetResultForm = () => {
    setResultForm({ experimentId: '', title: '', type: 'measurement', value: '', unit: '', notes: '' });
    setEditingResult(null);
    setShowResultModal(false);
  };

  const handleEditResult = (result: Result) => {
    setResultForm({
      experimentId: result.experimentId, title: result.title, type: result.type, value: result.value,
      unit: result.unit || '', notes: result.notes,
    });
    setEditingResult(result);
    setShowResultModal(true);
  };

  const handleDeleteResult = (code: string) => {
    const r = results.find(x => x.id === code);
    if (r && token && confirm('Delete this result?')) run(() => removeResultM({ token, id: r.docId }), 'Result deleted');
  };

  // File CRUD: the file itself is uploaded and kept
  const handleSaveFile = async () => {
    if (!token) return;
    const exp = expByCode(fileForm.experimentId);
    if (!exp || !fileForm.file) { toast.error('Choose the experiment and a file'); return; }
    setBusy(true);
    const ok = await run(async () => {
      const url = await makeUploadUrl({ token });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': fileForm.file!.type || 'application/octet-stream' }, body: fileForm.file });
      if (!res.ok) throw new Error('Upload failed. Try again.');
      const { storageId } = await res.json();
      await addFileM({ token, experiment_id: exp.docId, name: fileForm.file!.name, category: fileForm.category, storage_id: storageId });
    }, 'File uploaded');
    setBusy(false);
    if (ok) { setFileForm({ experimentId: '', category: 'data', file: null }); setShowFileModal(false); }
  };

  const handleDeleteFile = (id: string) => {
    const f = files.find(x => x.id === id);
    if (f && token && confirm('Delete this file?')) run(() => removeFileM({ token, id: f.docId }), 'File deleted');
  };


  // Filtering
  const filteredExperiments = experiments.filter(e => {
    if (expStatusFilter && e.status !== expStatusFilter) return false;
    if (expPriorityFilter && e.priority !== expPriorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
    }
    return true;
  });

  const getProgressPercent = (exp: Experiment) => {
    if (exp.steps.length === 0) return 0;
    const completed = exp.steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / exp.steps.length) * 100);
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'experiments', label: 'Experiments', icon: ':::' },
    { key: 'results', label: 'Results', icon: '=' },
    { key: 'timeline', label: 'Timeline', icon: '|' },
    { key: 'files', label: 'Files', icon: '#' },
  ];

  return (
    <div className="page experiments-hub">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Experiments Hub</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Manage experiments, track progress, and document results</p>
        </div>
        <button onClick={() => setShowHelp(true)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
          ? Help
        </button>
      </div>

      {/* Tabs */}
      <div className="hub-tabs" style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: 'monospace' }}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* EXPERIMENTS TAB */}
      {activeTab === 'experiments' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search experiments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', flex: 1, minWidth: 200 }}
            />
            <select value={expStatusFilter} onChange={e => setExpStatusFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <select value={expPriorityFilter} onChange={e => setExpPriorityFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            {(expStatusFilter || expPriorityFilter || searchQuery) && (
              <button onClick={() => { setExpStatusFilter(''); setExpPriorityFilter(''); setSearchQuery(''); }} className="btn btn-secondary" style={{ padding: '10px 14px' }}>
                Clear Filters
              </button>
            )}
            <ExportMenu
              data={filteredExperiments.map(e => ({
                ID: e.id,
                Title: e.title,
                Status: e.status,
                Priority: e.priority,
                'Lead Researcher': e.leadResearcher,
                Protocol: e.protocol,
                'Start Date': e.startDate,
                'End Date': e.endDate || '-',
                'Team Size': e.team.length,
                'Steps Completed': `${e.steps.filter(s => s.status === 'completed').length}/${e.steps.length}`,
                Tags: e.tags.join(', '),
              }))}
              filename="experiments"
              title="Experiments Report"
              columns={['ID', 'Title', 'Status', 'Priority', 'Lead Researcher', 'Protocol', 'Start Date', 'End Date', 'Team Size', 'Steps Completed', 'Tags']}
            />
            <button onClick={() => setShowExpModal(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
              + New Experiment
            </button>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {filteredExperiments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>:::</div>
                <p>No experiments found</p>
                <button onClick={() => setShowExpModal(true)} className="btn btn-primary" style={{ marginTop: 12 }}>Create First Experiment</button>
              </div>
            ) : (
              filteredExperiments.map(exp => (
                <div key={exp.id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{exp.id}</span>
                          <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[exp.status].bg, color: STATUS_COLORS[exp.status].text }}>
                            {exp.status.toUpperCase()}
                          </span>
                          <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: PRIORITY_COLORS[exp.priority].bg, color: PRIORITY_COLORS[exp.priority].text }}>
                            {exp.priority.toUpperCase()}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 6 }}>{exp.title}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>{exp.description}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setViewingExp(exp)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>View</button>
                        <button onClick={() => handleEditExp(exp)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Edit</button>
                        <button onClick={() => handleDeleteExp(exp.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>Delete</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, flexWrap: 'wrap' }}>
                      <span>Lead: <strong style={{ color: 'var(--text)' }}>{exp.leadResearcher}</strong></span>
                      <span>Protocol: <strong style={{ color: 'var(--text)' }}>{exp.protocol || 'None'}</strong></span>
                      <span>Started: <strong style={{ color: 'var(--text)' }}>{exp.startDate}</strong></span>
                      {exp.endDate && <span>Ended: <strong style={{ color: 'var(--text)' }}>{exp.endDate}</strong></span>}
                      <span>Team: <strong style={{ color: 'var(--text)' }}>{exp.team.length} members</strong></span>
                      <span>Samples: <strong style={{ color: 'var(--text)' }}>{exp.samples.length}</strong></span>
                    </div>

                    {/* Progress Bar */}
                    {exp.steps.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Progress ({exp.steps.filter(s => s.status === 'completed').length}/{exp.steps.length} steps)</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{getProgressPercent(exp)}%</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${getProgressPercent(exp)}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {exp.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        {exp.tags.map((tag, i) => (
                          <span key={i} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {exp.status === 'draft' && (
                        <button onClick={() => handleStartExp(exp)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                          Start Experiment
                        </button>
                      )}
                      {exp.status === 'active' && (
                        <>
                          <button onClick={() => { setViewingExp(exp); setShowStepsModal(true); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
                            Manage Steps
                          </button>
                          <button onClick={() => handleCompleteExp(exp)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                            Mark Complete
                          </button>
                        </>
                      )}
                      <button onClick={() => { setResultForm({ ...resultForm, experimentId: exp.id }); setShowResultModal(true); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
                        + Add Result
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* RESULTS TAB */}
      {activeTab === 'results' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Experiment Results</h2>
            <button onClick={() => setShowResultModal(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
              + Record Result
            </button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>=</div>
                <p>No results recorded yet</p>
                <button onClick={() => setShowResultModal(true)} className="btn btn-primary" style={{ marginTop: 12 }}>Record First Result</button>
              </div>
            ) : (
              results.map(result => (
                <div key={result.id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{result.id}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: TYPE_COLORS[result.type].bg, color: TYPE_COLORS[result.type].text }}>
                          {result.type.toUpperCase()}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 4 }}>{result.title}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, marginBottom: 12 }}>
                        Experiment: {result.experimentTitle}
                      </p>
                      <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                          {result.value}{result.unit && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{result.unit}</span>}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{result.notes}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>Recorded by: <strong>{result.recordedBy}</strong></span>
                        <span>Date: <strong>{result.recordedAt}</strong></span>
                        {result.attachments.length > 0 && <span>Attachments: <strong>{result.attachments.length}</strong></span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEditResult(result)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Edit</button>
                      <button onClick={() => handleDeleteResult(result.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TIMELINE TAB */}
      {activeTab === 'timeline' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 20 }}>Activity Timeline</h2>

          <div style={{ position: 'relative', paddingLeft: 32 }}>
            <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
            {timeline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <p>No activity yet</p>
              </div>
            ) : (
              timeline.map(event => (
                <div key={event.id} style={{ position: 'relative', marginBottom: 24 }}>
                  <div style={{
                    position: 'absolute',
                    left: -32,
                    top: 2,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--surface)',
                    border: '2px solid var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'var(--accent)',
                  }}>
                    {EVENT_ICONS[event.type] || '*'}
                  </div>
                  <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{event.description}</span>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
                          Experiment: {event.experimentTitle}
                        </p>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{event.timestamp}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      By: <strong>{event.user}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FILES TAB */}
      {activeTab === 'files' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Experiment Files</h2>
            <button onClick={() => setShowFileModal(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
              + Upload File
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>#</div>
                <p>No files uploaded yet</p>
                <button onClick={() => setShowFileModal(true)} className="btn btn-primary" style={{ marginTop: 12 }}>Upload First File</button>
              </div>
            ) : (
              files.map(file => (
                <div key={file.id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontFamily: 'monospace',
                      color: 'var(--accent)',
                    }}>
                      {file.type === 'pdf' ? 'PDF' : file.type === 'xlsx' ? 'XLS' : file.type === 'tif' ? 'IMG' : file.type.toUpperCase().slice(0, 3)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{file.experimentTitle}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{file.size}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{file.category}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: 12 }} onClick={() => file.url && window.open(file.url, '_blank', 'noopener')} disabled={!file.url}>Download</button>
                    <button onClick={() => handleDeleteFile(file.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* EXPERIMENT MODAL */}
      {showExpModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>
              {editingExp ? 'Edit Experiment' : 'New Experiment'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Title *</label>
                <input type="text" value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })} placeholder="Experiment title" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
                <textarea value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} placeholder="Describe the experiment..." rows={3} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Protocol</label>
                  <input type="text" value={expForm.protocol} onChange={e => setExpForm({ ...expForm, protocol: e.target.value })} placeholder="Protocol ID" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Lead Researcher *</label>
                  <input type="text" value={expForm.leadResearcher} onChange={e => setExpForm({ ...expForm, leadResearcher: e.target.value })} placeholder="Researcher name" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Status</label>
                  <select value={expForm.status} onChange={e => setExpForm({ ...expForm, status: e.target.value as Experiment['status'] })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Priority</label>
                  <select value={expForm.priority} onChange={e => setExpForm({ ...expForm, priority: e.target.value as Experiment['priority'] })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Start Date *</label>
                  <input type="date" value={expForm.startDate} onChange={e => setExpForm({ ...expForm, startDate: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Tags (comma-separated)</label>
                <input type="text" value={expForm.tags} onChange={e => setExpForm({ ...expForm, tags: e.target.value })} placeholder="e.g., CRISPR, Gene Editing, HEK293" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={resetExpForm} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={handleSaveExp} disabled={busy} className="btn btn-primary" style={{ padding: '10px 20px' }}>{editingExp ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT MODAL */}
      {showResultModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>
              {editingResult ? 'Edit Result' : 'Record Result'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Experiment *</label>
                <select value={resultForm.experimentId} onChange={e => setResultForm({ ...resultForm, experimentId: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                  <option value="">Select experiment...</option>
                  {experiments.map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.id} - {exp.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Result Title *</label>
                <input type="text" value={resultForm.title} onChange={e => setResultForm({ ...resultForm, title: e.target.value })} placeholder="e.g., Transfection Efficiency" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Type</label>
                <select value={resultForm.type} onChange={e => setResultForm({ ...resultForm, type: e.target.value as Result['type'] })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                  <option value="observation">Observation</option>
                  <option value="measurement">Measurement</option>
                  <option value="analysis">Analysis</option>
                  <option value="conclusion">Conclusion</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Value *</label>
                  <input type="text" value={resultForm.value} onChange={e => setResultForm({ ...resultForm, value: e.target.value })} placeholder="Result value" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Unit</label>
                  <input type="text" value={resultForm.unit} onChange={e => setResultForm({ ...resultForm, unit: e.target.value })} placeholder="%, mg/mL" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</label>
                <textarea value={resultForm.notes} onChange={e => setResultForm({ ...resultForm, notes: e.target.value })} placeholder="Additional observations..." rows={3} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={resetResultForm} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={handleSaveResult} className="btn btn-primary" style={{ padding: '10px 20px' }}>{editingResult ? 'Update' : 'Record'}</button>
            </div>
          </div>
        </div>
      )}

      {/* FILE UPLOAD MODAL */}
      {showFileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 450, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>Upload File</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Experiment *</label>
                <select value={fileForm.experimentId} onChange={e => setFileForm({ ...fileForm, experimentId: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                  <option value="">Select experiment...</option>
                  {experiments.map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.id} - {exp.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>File *</label>
                <input type="file" aria-label="Experiment file" onChange={e => setFileForm({ ...fileForm, file: e.target.files?.[0] ?? null })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Any file up to 50 MB.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Category</label>
                  <select value={fileForm.category} onChange={e => setFileForm({ ...fileForm, category: e.target.value as ExperimentFile['category'] })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="protocol">Protocol</option>
                    <option value="data">Data</option>
                    <option value="image">Image</option>
                    <option value="report">Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setFileForm({ experimentId: '', category: 'data', file: null }); setShowFileModal(false); }} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={handleSaveFile} disabled={busy} className="btn btn-primary" style={{ padding: '10px 20px' }}>{busy ? 'Uploading…' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW EXPERIMENT MODAL */}
      {viewingExp && !showStepsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--text-muted)' }}>{viewingExp.id}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[viewingExp.status].bg, color: STATUS_COLORS[viewingExp.status].text }}>
                    {viewingExp.status.toUpperCase()}
                  </span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{viewingExp.title}</h2>
              </div>
              <button onClick={() => setViewingExp(null)} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--text-muted)', cursor: 'pointer' }}>x</button>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{viewingExp.description}</p>

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Lead Researcher</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{viewingExp.leadResearcher}</div>
              </div>
              <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Protocol</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{viewingExp.protocol || 'None'}</div>
              </div>
              <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Priority</div>
                <div style={{ fontWeight: 600, color: PRIORITY_COLORS[viewingExp.priority].text }}>{viewingExp.priority.toUpperCase()}</div>
              </div>
            </div>

            {/* Team */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Team Members ({viewingExp.team.length})</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {viewingExp.team.map(member => (
                  <div key={member.id} style={{ background: 'var(--surface2)', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{member.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Workflow Steps ({viewingExp.steps.length})</h3>
              {viewingExp.steps.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No steps defined yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewingExp.steps.map((step, i) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', padding: 12, borderRadius: 8 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: STATUS_COLORS[step.status].bg,
                        color: STATUS_COLORS[step.status].text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {step.status === 'completed' ? '**' : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{step.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{step.description}</div>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[step.status].bg, color: STATUS_COLORS[step.status].text }}>
                        {step.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Samples */}
            {viewingExp.samples.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Linked Samples</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {viewingExp.samples.map(sample => (
                    <span key={sample} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'monospace', fontSize: 13 }}>
                      {sample}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setViewingExp(null)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Close</button>
              <button onClick={() => { handleEditExp(viewingExp); setViewingExp(null); }} className="btn btn-primary" style={{ padding: '10px 20px' }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* STEPS MANAGEMENT MODAL */}
      {showStepsModal && viewingExp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 8 }}>Manage Steps</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{viewingExp.title}</p>

            {/* Add Step Form */}
            <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 10, marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Add New Step</h4>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const name = (form.elements.namedItem('stepName') as HTMLInputElement).value;
                const desc = (form.elements.namedItem('stepDesc') as HTMLInputElement).value;
                handleAddStep(viewingExp.id, name, desc);
                form.reset();
              }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input name="stepName" type="text" placeholder="Step name" style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                  <input name="stepDesc" type="text" placeholder="Description (optional)" style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>Add</button>
                </div>
              </form>
            </div>

            {/* Steps List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {experiments.find(e => e.id === viewingExp.id)?.steps.map((step, i) => (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', padding: 16, borderRadius: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: STATUS_COLORS[step.status].bg,
                    color: STATUS_COLORS[step.status].text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{step.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{step.description}</div>
                  </div>
                  <select
                    value={step.status}
                    onChange={(e) => handleUpdateStep(viewingExp.id, step.id, e.target.value as ExperimentStep['status'])}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowStepsModal(false); setViewingExp(null); }} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>How to Use Experiments Hub</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>::: Experiments</h3>
                <ul style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                  <li>Create new experiments with title, description, protocol, and team</li>
                  <li>Track experiment status: Draft - Active - Paused - Completed - Archived</li>
                  <li>Set priority levels for better organization</li>
                  <li>Add tags for categorization and filtering</li>
                  <li>Define workflow steps and track progress</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>= Results</h3>
                <ul style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                  <li>Record observations, measurements, analyses, and conclusions</li>
                  <li>Link results to specific experiments</li>
                  <li>Add values with units for quantitative data</li>
                  <li>Include detailed notes for context</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>| Timeline</h3>
                <ul style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                  <li>View chronological history of all experiment activities</li>
                  <li>Track who did what and when</li>
                  <li>Automatic logging of major events</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}># Files</h3>
                <ul style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                  <li>Upload and organize experiment files</li>
                  <li>Categorize as Protocol, Data, Image, Report, or Other</li>
                  <li>Link files to specific experiments</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowHelp(false)} className="btn btn-primary" style={{ padding: '10px 20px' }}>Got it!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
