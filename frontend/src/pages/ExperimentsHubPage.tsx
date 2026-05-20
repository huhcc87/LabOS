import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ExportMenu } from '../components/ExportMenu';

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

const INITIAL_EXPERIMENTS: Experiment[] = [
  {
    id: 'EXP-001',
    title: 'CRISPR Gene Editing - Target A',
    description: 'Gene knockout experiment using CRISPR-Cas9 system targeting gene A in HEK293 cells',
    protocol: 'PROT-CRISPR-001',
    status: 'active',
    priority: 'high',
    startDate: '2024-01-15',
    leadResearcher: 'Dr. Sarah Chen',
    team: [
      { id: '1', name: 'Dr. Sarah Chen', role: 'Lead' },
      { id: '2', name: 'John Smith', role: 'Researcher' },
      { id: '3', name: 'Emily Davis', role: 'Technician' },
    ],
    steps: [
      { id: 's1', name: 'Cell Culture Preparation', description: 'Prepare HEK293 cells', status: 'completed', startedAt: '2024-01-15', completedAt: '2024-01-16' },
      { id: 's2', name: 'gRNA Design & Synthesis', description: 'Design and order guide RNAs', status: 'completed', startedAt: '2024-01-16', completedAt: '2024-01-18' },
      { id: 's3', name: 'Transfection', description: 'Transfect cells with CRISPR complex', status: 'in-progress', startedAt: '2024-01-20' },
      { id: 's4', name: 'Selection', description: 'Select transfected cells', status: 'pending' },
      { id: 's5', name: 'Validation', description: 'Validate knockout by sequencing', status: 'pending' },
    ],
    samples: ['SMP-001', 'SMP-002', 'SMP-003'],
    tags: ['CRISPR', 'Gene Editing', 'HEK293'],
    createdAt: '2024-01-14',
    updatedAt: '2024-01-20',
  },
  {
    id: 'EXP-002',
    title: 'Protein Expression Analysis',
    description: 'Western blot analysis of protein expression levels after treatment',
    protocol: 'PROT-WB-003',
    status: 'completed',
    priority: 'medium',
    startDate: '2024-01-10',
    endDate: '2024-01-18',
    leadResearcher: 'Dr. Michael Brown',
    team: [
      { id: '4', name: 'Dr. Michael Brown', role: 'Lead' },
      { id: '5', name: 'Lisa Wang', role: 'Researcher' },
    ],
    steps: [
      { id: 's1', name: 'Sample Preparation', description: 'Lyse cells and extract proteins', status: 'completed', startedAt: '2024-01-10', completedAt: '2024-01-11' },
      { id: 's2', name: 'Gel Electrophoresis', description: 'Run SDS-PAGE', status: 'completed', startedAt: '2024-01-12', completedAt: '2024-01-12' },
      { id: 's3', name: 'Transfer & Blotting', description: 'Transfer to membrane and probe', status: 'completed', startedAt: '2024-01-13', completedAt: '2024-01-15' },
      { id: 's4', name: 'Imaging & Analysis', description: 'Image and quantify bands', status: 'completed', startedAt: '2024-01-16', completedAt: '2024-01-18' },
    ],
    samples: ['SMP-010', 'SMP-011'],
    tags: ['Western Blot', 'Protein', 'Analysis'],
    createdAt: '2024-01-09',
    updatedAt: '2024-01-18',
  },
  {
    id: 'EXP-003',
    title: 'Drug Screening - Compound Library',
    description: 'High-throughput screening of 500 compounds for cytotoxicity',
    protocol: 'PROT-HTS-002',
    status: 'draft',
    priority: 'critical',
    startDate: '2024-02-01',
    leadResearcher: 'Dr. Amanda Lee',
    team: [
      { id: '6', name: 'Dr. Amanda Lee', role: 'Lead' },
    ],
    steps: [
      { id: 's1', name: 'Plate Preparation', description: 'Prepare compound plates', status: 'pending' },
      { id: 's2', name: 'Cell Seeding', description: 'Seed cells in 384-well plates', status: 'pending' },
      { id: 's3', name: 'Treatment', description: 'Add compounds to cells', status: 'pending' },
      { id: 's4', name: 'Viability Assay', description: 'Measure cell viability', status: 'pending' },
      { id: 's5', name: 'Data Analysis', description: 'Analyze screening results', status: 'pending' },
    ],
    samples: [],
    tags: ['HTS', 'Drug Screening', 'Cytotoxicity'],
    createdAt: '2024-01-22',
    updatedAt: '2024-01-22',
  },
];

const INITIAL_RESULTS: Result[] = [
  {
    id: 'RES-001',
    experimentId: 'EXP-001',
    experimentTitle: 'CRISPR Gene Editing - Target A',
    title: 'Transfection Efficiency',
    type: 'measurement',
    value: '78',
    unit: '%',
    notes: 'GFP-positive cells counted by flow cytometry. Good efficiency achieved.',
    attachments: ['flow_data.fcs', 'analysis_report.pdf'],
    recordedBy: 'John Smith',
    recordedAt: '2024-01-21',
  },
  {
    id: 'RES-002',
    experimentId: 'EXP-002',
    experimentTitle: 'Protein Expression Analysis',
    title: 'Target Protein Knockdown',
    type: 'analysis',
    value: '85% reduction',
    notes: 'Significant knockdown observed compared to control. Band intensity normalized to actin.',
    attachments: ['western_image.tif'],
    recordedBy: 'Dr. Michael Brown',
    recordedAt: '2024-01-18',
  },
  {
    id: 'RES-003',
    experimentId: 'EXP-002',
    experimentTitle: 'Protein Expression Analysis',
    title: 'Final Conclusion',
    type: 'conclusion',
    value: 'Treatment effective',
    notes: 'The treatment successfully reduced target protein levels by 85%. Recommend proceeding to in vivo studies.',
    attachments: ['final_report.pdf'],
    recordedBy: 'Dr. Michael Brown',
    recordedAt: '2024-01-18',
  },
];

const INITIAL_TIMELINE: TimelineEvent[] = [
  { id: 't1', experimentId: 'EXP-001', experimentTitle: 'CRISPR Gene Editing', type: 'created', description: 'Experiment created', user: 'Dr. Sarah Chen', timestamp: '2024-01-14 09:00' },
  { id: 't2', experimentId: 'EXP-001', experimentTitle: 'CRISPR Gene Editing', type: 'started', description: 'Experiment started', user: 'Dr. Sarah Chen', timestamp: '2024-01-15 10:30' },
  { id: 't3', experimentId: 'EXP-001', experimentTitle: 'CRISPR Gene Editing', type: 'step_completed', description: 'Step "Cell Culture Preparation" completed', user: 'Emily Davis', timestamp: '2024-01-16 16:00' },
  { id: 't4', experimentId: 'EXP-002', experimentTitle: 'Protein Expression', type: 'completed', description: 'Experiment completed successfully', user: 'Dr. Michael Brown', timestamp: '2024-01-18 17:30' },
  { id: 't5', experimentId: 'EXP-001', experimentTitle: 'CRISPR Gene Editing', type: 'result_added', description: 'New result recorded: Transfection Efficiency', user: 'John Smith', timestamp: '2024-01-21 14:15' },
];

const INITIAL_FILES: ExperimentFile[] = [
  { id: 'f1', experimentId: 'EXP-001', experimentTitle: 'CRISPR Gene Editing', name: 'CRISPR_Protocol_v2.pdf', type: 'pdf', size: '2.4 MB', category: 'protocol', uploadedBy: 'Dr. Sarah Chen', uploadedAt: '2024-01-14' },
  { id: 'f2', experimentId: 'EXP-001', experimentTitle: 'CRISPR Gene Editing', name: 'gRNA_sequences.xlsx', type: 'xlsx', size: '156 KB', category: 'data', uploadedBy: 'John Smith', uploadedAt: '2024-01-16' },
  { id: 'f3', experimentId: 'EXP-002', experimentTitle: 'Protein Expression', name: 'western_blot_raw.tif', type: 'tif', size: '8.7 MB', category: 'image', uploadedBy: 'Lisa Wang', uploadedAt: '2024-01-15' },
  { id: 'f4', experimentId: 'EXP-002', experimentTitle: 'Protein Expression', name: 'Final_Report.pdf', type: 'pdf', size: '1.2 MB', category: 'report', uploadedBy: 'Dr. Michael Brown', uploadedAt: '2024-01-18' },
];

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
  const [activeTab, setActiveTab] = useState<TabType>('experiments');
  const [experiments, setExperiments] = useState<Experiment[]>(INITIAL_EXPERIMENTS);
  const [results, setResults] = useState<Result[]>(INITIAL_RESULTS);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(INITIAL_TIMELINE);
  const [files, setFiles] = useState<ExperimentFile[]>(INITIAL_FILES);

  // Modals
  const [showExpModal, setShowExpModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editingExp, setEditingExp] = useState<Experiment | null>(null);
  const [editingResult, setEditingResult] = useState<Result | null>(null);
  const [viewingExp, setViewingExp] = useState<Experiment | null>(null);

  // Filters
  const [expStatusFilter, setExpStatusFilter] = useState('');
  const [expPriorityFilter, setExpPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [expForm, setExpForm] = useState({
    title: '', description: '', protocol: '', status: 'draft' as Experiment['status'],
    priority: 'medium' as Experiment['priority'], startDate: '', leadResearcher: '', tags: ''
  });
  const [resultForm, setResultForm] = useState({
    experimentId: '', title: '', type: 'measurement' as Result['type'], value: '', unit: '', notes: ''
  });
  const [fileForm, setFileForm] = useState({
    experimentId: '', name: '', type: '', size: '', category: 'data' as ExperimentFile['category']
  });

  const addTimelineEvent = (experimentId: string, experimentTitle: string, type: TimelineEvent['type'], description: string) => {
    const event: TimelineEvent = {
      id: `t${Date.now()}`,
      experimentId,
      experimentTitle,
      type,
      description,
      user: 'Current User',
      timestamp: new Date().toLocaleString(),
    };
    setTimeline(prev => [event, ...prev]);
  };

  // Experiment CRUD
  const handleSaveExp = () => {
    if (!expForm.title || !expForm.startDate || !expForm.leadResearcher) {
      toast.error('Please fill in required fields');
      return;
    }

    if (editingExp) {
      setExperiments(prev => prev.map(e => e.id === editingExp.id ? {
        ...e,
        ...expForm,
        tags: expForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        updatedAt: new Date().toISOString().split('T')[0],
      } : e));
      addTimelineEvent(editingExp.id, expForm.title, 'note_added', 'Experiment updated');
      toast.success('Experiment updated');
    } else {
      const newExp: Experiment = {
        id: `EXP-${String(experiments.length + 1).padStart(3, '0')}`,
        ...expForm,
        endDate: undefined,
        team: [{ id: '1', name: expForm.leadResearcher, role: 'Lead' }],
        steps: [],
        samples: [],
        tags: expForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      setExperiments(prev => [...prev, newExp]);
      addTimelineEvent(newExp.id, newExp.title, 'created', 'Experiment created');
      toast.success('Experiment created');
    }
    resetExpForm();
  };

  const resetExpForm = () => {
    setExpForm({ title: '', description: '', protocol: '', status: 'draft', priority: 'medium', startDate: '', leadResearcher: '', tags: '' });
    setEditingExp(null);
    setShowExpModal(false);
  };

  const handleEditExp = (exp: Experiment) => {
    setExpForm({
      title: exp.title,
      description: exp.description,
      protocol: exp.protocol,
      status: exp.status,
      priority: exp.priority,
      startDate: exp.startDate,
      leadResearcher: exp.leadResearcher,
      tags: exp.tags.join(', '),
    });
    setEditingExp(exp);
    setShowExpModal(true);
  };

  const handleDeleteExp = (id: string) => {
    if (confirm('Delete this experiment? All associated data will be removed.')) {
      const exp = experiments.find(e => e.id === id);
      setExperiments(prev => prev.filter(e => e.id !== id));
      setResults(prev => prev.filter(r => r.experimentId !== id));
      setFiles(prev => prev.filter(f => f.experimentId !== id));
      if (exp) addTimelineEvent(id, exp.title, 'note_added', 'Experiment deleted');
      toast.success('Experiment deleted');
    }
  };

  const handleStartExp = (exp: Experiment) => {
    setExperiments(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'active', updatedAt: new Date().toISOString().split('T')[0] } : e));
    addTimelineEvent(exp.id, exp.title, 'started', 'Experiment started');
    toast.success('Experiment started');
  };

  const handleCompleteExp = (exp: Experiment) => {
    setExperiments(prev => prev.map(e => e.id === exp.id ? {
      ...e,
      status: 'completed',
      endDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    } : e));
    addTimelineEvent(exp.id, exp.title, 'completed', 'Experiment completed');
    toast.success('Experiment marked as completed');
  };

  // Steps management
  const handleUpdateStep = (expId: string, stepId: string, newStatus: ExperimentStep['status']) => {
    setExperiments(prev => prev.map(e => {
      if (e.id !== expId) return e;
      const updatedSteps = e.steps.map(s => {
        if (s.id !== stepId) return s;
        return {
          ...s,
          status: newStatus,
          startedAt: newStatus === 'in-progress' ? new Date().toISOString().split('T')[0] : s.startedAt,
          completedAt: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : s.completedAt,
        };
      });
      return { ...e, steps: updatedSteps, updatedAt: new Date().toISOString().split('T')[0] };
    }));
    const exp = experiments.find(e => e.id === expId);
    const step = exp?.steps.find(s => s.id === stepId);
    if (exp && step) {
      addTimelineEvent(expId, exp.title, 'step_completed', `Step "${step.name}" status changed to ${newStatus}`);
    }
    toast.success('Step updated');
  };

  const handleAddStep = (expId: string, stepName: string, stepDesc: string) => {
    if (!stepName) return;
    setExperiments(prev => prev.map(e => {
      if (e.id !== expId) return e;
      const newStep: ExperimentStep = {
        id: `s${Date.now()}`,
        name: stepName,
        description: stepDesc,
        status: 'pending',
      };
      return { ...e, steps: [...e.steps, newStep], updatedAt: new Date().toISOString().split('T')[0] };
    }));
    toast.success('Step added');
  };

  // Result CRUD
  const handleSaveResult = () => {
    if (!resultForm.experimentId || !resultForm.title || !resultForm.value) {
      toast.error('Please fill in required fields');
      return;
    }

    const exp = experiments.find(e => e.id === resultForm.experimentId);
    if (!exp) return;

    if (editingResult) {
      setResults(prev => prev.map(r => r.id === editingResult.id ? {
        ...r,
        ...resultForm,
        experimentTitle: exp.title,
      } : r));
      toast.success('Result updated');
    } else {
      const newResult: Result = {
        id: `RES-${String(results.length + 1).padStart(3, '0')}`,
        ...resultForm,
        experimentTitle: exp.title,
        attachments: [],
        recordedBy: 'Current User',
        recordedAt: new Date().toISOString().split('T')[0],
      };
      setResults(prev => [...prev, newResult]);
      addTimelineEvent(exp.id, exp.title, 'result_added', `New result recorded: ${resultForm.title}`);
      toast.success('Result recorded');
    }
    resetResultForm();
  };

  const resetResultForm = () => {
    setResultForm({ experimentId: '', title: '', type: 'measurement', value: '', unit: '', notes: '' });
    setEditingResult(null);
    setShowResultModal(false);
  };

  const handleEditResult = (result: Result) => {
    setResultForm({
      experimentId: result.experimentId,
      title: result.title,
      type: result.type,
      value: result.value,
      unit: result.unit || '',
      notes: result.notes,
    });
    setEditingResult(result);
    setShowResultModal(true);
  };

  const handleDeleteResult = (id: string) => {
    if (confirm('Delete this result?')) {
      setResults(prev => prev.filter(r => r.id !== id));
      toast.success('Result deleted');
    }
  };

  // File CRUD
  const handleSaveFile = () => {
    if (!fileForm.experimentId || !fileForm.name) {
      toast.error('Please fill in required fields');
      return;
    }

    const exp = experiments.find(e => e.id === fileForm.experimentId);
    if (!exp) return;

    const newFile: ExperimentFile = {
      id: `f${Date.now()}`,
      experimentId: fileForm.experimentId,
      experimentTitle: exp.title,
      name: fileForm.name,
      type: fileForm.name.split('.').pop() || 'unknown',
      size: fileForm.size || 'Unknown',
      category: fileForm.category,
      uploadedBy: 'Current User',
      uploadedAt: new Date().toISOString().split('T')[0],
    };
    setFiles(prev => [...prev, newFile]);
    toast.success('File added');
    setFileForm({ experimentId: '', name: '', type: '', size: '', category: 'data' });
    setShowFileModal(false);
  };

  const handleDeleteFile = (id: string) => {
    if (confirm('Delete this file?')) {
      setFiles(prev => prev.filter(f => f.id !== id));
      toast.success('File deleted');
    }
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
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: 12 }}>Download</button>
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
              <button onClick={handleSaveExp} className="btn btn-primary" style={{ padding: '10px 20px' }}>{editingExp ? 'Update' : 'Create'}</button>
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>File Name *</label>
                <input type="text" value={fileForm.name} onChange={e => setFileForm({ ...fileForm, name: e.target.value })} placeholder="filename.pdf" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Size</label>
                  <input type="text" value={fileForm.size} onChange={e => setFileForm({ ...fileForm, size: e.target.value })} placeholder="e.g., 2.5 MB" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
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
              <button onClick={() => { setFileForm({ experimentId: '', name: '', type: '', size: '', category: 'data' }); setShowFileModal(false); }} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={handleSaveFile} className="btn btn-primary" style={{ padding: '10px 20px' }}>Upload</button>
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
