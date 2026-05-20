import { useState } from 'react';

// ─── Shared ──────────────────────────────────────────────────────────────────
const INP: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const TA: React.CSSProperties = { ...INP, resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.6 };

// ─── Types ───────────────────────────────────────────────────────────────────
type IRBStatus = 'drafting' | 'submitted' | 'approved' | 'amended' | 'closed';
type TrialPhase = 'I' | 'II' | 'III' | 'IV' | 'N/A';
type EnrollStatus = 'screening' | 'enrolled' | 'completed' | 'withdrawn' | 'excluded';
type AESeverity = 'mild' | 'moderate' | 'severe' | 'serious';

interface IRBProtocol {
  id: number;
  title: string;
  pi: string;
  status: IRBStatus;
  irbNumber: string;
  submittedDate: string;
  approvedDate?: string;
  expiryDate?: string;
  amendments: number;
  riskLevel: 'minimal' | 'greater_than_minimal';
  description: string;
}

interface Cohort {
  id: number;
  name: string;
  disease: string;
  n: number;
  enrolled: number;
  irbRef: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  biobank: boolean;
  consentRate: number;
}

interface ClinicalTrial {
  id: number;
  title: string;
  nctId: string;
  phase: TrialPhase;
  status: string;
  pi: string;
  targetEnrollment: number;
  enrolled: number;
  sites: number;
  startDate: string;
  primaryCompletion: string;
}

interface AdverseEvent {
  id: number;
  patientId: string;
  trialId: number;
  event: string;
  severity: AESeverity;
  date: string;
  reported: boolean;
  resolved: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_IRB: IRBProtocol[] = [
  { id: 1, title: 'KRAS G12D Targeting in Colorectal Cancer — Phase I/II Clinical Study', pi: 'Dr. Chen', status: 'approved', irbNumber: 'IRB-2024-0342', submittedDate: '2024-01-15', approvedDate: '2024-03-01', expiryDate: '2025-03-01', amendments: 2, riskLevel: 'greater_than_minimal', description: 'First-in-human study of KRAS G12D inhibitor in locally advanced CRC patients.' },
  { id: 2, title: 'Biomarker Discovery in Triple-Negative Breast Cancer', pi: 'Dr. Patel', status: 'submitted', irbNumber: 'IRB-2026-0041', submittedDate: '2026-04-20', amendments: 0, riskLevel: 'minimal', description: 'Observational biomarker study using archival TNBC tissue samples.' },
  { id: 3, title: 'PD-L1 Expression Correlation with Immunotherapy Response', pi: 'Dr. Kim', status: 'drafting', irbNumber: 'DRAFT-2026-05', submittedDate: '—', amendments: 0, riskLevel: 'minimal', description: 'Retrospective chart review and tissue analysis study.' },
];

const MOCK_COHORTS: Cohort[] = [
  { id: 1, name: 'CRC KRAS Cohort', disease: 'Colorectal Cancer', n: 120, enrolled: 87, irbRef: 'IRB-2024-0342', inclusionCriteria: 'Stage III/IV CRC; KRAS G12D confirmed; Age ≥18; ECOG 0-2', exclusionCriteria: 'Prior KRAS inhibitor therapy; Active autoimmune disease; Pregnancy', biobank: true, consentRate: 94 },
  { id: 2, name: 'TNBC Biomarker Cohort', disease: 'Triple-Negative Breast Cancer', n: 200, enrolled: 142, irbRef: 'IRB-2026-0041', inclusionCriteria: 'Confirmed TNBC diagnosis; Available archival tissue; Stage II-IV', exclusionCriteria: 'Insufficient tissue; Missing clinical data', biobank: true, consentRate: 89 },
  { id: 3, name: 'Healthy Volunteer Controls', disease: 'None (Control)', n: 50, enrolled: 50, irbRef: 'IRB-2024-0342', inclusionCriteria: 'Healthy adults; Age 18-65; No active malignancy', exclusionCriteria: 'Chronic illness; Immunosuppression; Pregnancy', biobank: false, consentRate: 100 },
];

const MOCK_TRIALS: ClinicalTrial[] = [
  { id: 1, title: 'KRAS G12D Inhibitor — Phase I Dose Escalation', nctId: 'NCT05123456', phase: 'I', status: 'Recruiting', pi: 'Dr. Chen', targetEnrollment: 48, enrolled: 18, sites: 3, startDate: '2024-06', primaryCompletion: '2026-12' },
  { id: 2, title: 'Anti-PD-L1 + Chemotherapy in TNBC', nctId: 'NCT04987654', phase: 'II', status: 'Active, not recruiting', pi: 'Dr. Patel', targetEnrollment: 120, enrolled: 120, sites: 5, startDate: '2023-09', primaryCompletion: '2026-06' },
];

const MOCK_AE: AdverseEvent[] = [
  { id: 1, patientId: 'PT-001', trialId: 1, event: 'Grade 2 Nausea', severity: 'moderate', date: '2026-04-15', reported: true, resolved: true },
  { id: 2, patientId: 'PT-003', trialId: 1, event: 'Grade 3 Hepatotoxicity', severity: 'serious', date: '2026-05-02', reported: true, resolved: false },
  { id: 3, patientId: 'PT-007', trialId: 1, event: 'Grade 1 Fatigue', severity: 'mild', date: '2026-05-08', reported: false, resolved: false },
];

const IRB_STATUS_META: Record<IRBStatus, { label: string; color: string; bg: string }> = {
  drafting:  { label: 'Drafting',   color: '#9ca3af', bg: 'rgba(107,114,128,0.15)' },
  submitted: { label: 'Submitted',  color: '#fbbf24', bg: 'rgba(234,179,8,0.15)' },
  approved:  { label: 'Approved',   color: '#4ade80', bg: 'rgba(34,197,94,0.15)' },
  amended:   { label: 'Amended',    color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  closed:    { label: 'Closed',     color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const AE_META: Record<AESeverity, { color: string; bg: string }> = {
  mild:     { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)' },
  moderate: { color: '#fbbf24', bg: 'rgba(234,179,8,0.12)' },
  severe:   { color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  serious:  { color: '#ef4444', bg: 'rgba(239,68,68,0.2)' },
};

type Tab = 'irb' | 'cohorts' | 'trials' | 'ae';

export default function ClinicalResearchHubPage() {
  const [tab, setTab] = useState<Tab>('irb');
  const [protocols, setProtocols] = useState<IRBProtocol[]>(MOCK_IRB);
  const [cohorts] = useState<Cohort[]>(MOCK_COHORTS);
  const [trials] = useState<ClinicalTrial[]>(MOCK_TRIALS);
  const [events, setEvents] = useState<AdverseEvent[]>(MOCK_AE);
  const [selectedIRB, setSelectedIRB] = useState<IRBProtocol | null>(null);
  const [showNewIRB, setShowNewIRB] = useState(false);
  const [showNewAE, setShowNewAE] = useState(false);

  // New IRB form
  const [newIRB, setNewIRB] = useState({ title: '', pi: '', description: '', riskLevel: 'minimal' as 'minimal' | 'greater_than_minimal' });

  const submitIRB = () => {
    if (!newIRB.title) return;
    const p: IRBProtocol = {
      id: Date.now(), title: newIRB.title, pi: newIRB.pi || 'Unknown', status: 'drafting',
      irbNumber: `DRAFT-${new Date().getFullYear()}-${String(protocols.length + 1).padStart(2, '0')}`,
      submittedDate: '—', amendments: 0, riskLevel: newIRB.riskLevel, description: newIRB.description,
    };
    setProtocols(prev => [p, ...prev]);
    setNewIRB({ title: '', pi: '', description: '', riskLevel: 'minimal' });
    setShowNewIRB(false);
  };

  // New AE form
  const [newAE, setNewAE] = useState({ patientId: '', event: '', severity: 'moderate' as AESeverity });

  const submitAE = () => {
    if (!newAE.patientId || !newAE.event) return;
    const ae: AdverseEvent = { id: Date.now(), patientId: newAE.patientId, trialId: trials[0]?.id || 1, event: newAE.event, severity: newAE.severity, date: new Date().toISOString().slice(0, 10), reported: false, resolved: false };
    setEvents(prev => [ae, ...prev]);
    setNewAE({ patientId: '', event: '', severity: 'moderate' });
    setShowNewAE(false);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'irb', label: 'IRB Protocols', icon: '📋' },
    { key: 'cohorts', label: 'Patient Cohorts', icon: '👥' },
    { key: 'trials', label: 'Clinical Trials', icon: '🏥' },
    { key: 'ae', label: 'Adverse Events', icon: '⚠️' },
  ];

  return (
    <div className="page" style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Clinical Research Hub</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>IRB management · Patient cohorts · Clinical trial tracking · Adverse events</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'IRB Protocols', value: protocols.length, icon: '📋', color: 'var(--text)' },
          { label: 'Active Trials', value: trials.filter(t => t.status.includes('Recruiting') || t.status.includes('Active')).length, icon: '🏥', color: '#60a5fa' },
          { label: 'Total Enrolled', value: cohorts.reduce((a, c) => a + c.enrolled, 0), icon: '👥', color: '#4ade80' },
          { label: 'Unresolved AEs', value: events.filter(e => !e.resolved).length, icon: '⚠️', color: events.filter(e => !e.resolved).length > 0 ? '#f87171' : '#9ca3af' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: tab === t.key ? 600 : 400, border: 'none', background: 'none', cursor: 'pointer', color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`, transition: 'all 0.15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── IRB Protocols ── */}
      {tab === 'irb' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>IRB Protocol Registry</h3>
            <button onClick={() => setShowNewIRB(true)} className="btn btn-primary">+ New Protocol</button>
          </div>

          {showNewIRB && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 14 }}>New IRB Protocol</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input style={INP} placeholder="Protocol title *" value={newIRB.title} onChange={e => setNewIRB(p => ({ ...p, title: e.target.value }))} />
                <input style={INP} placeholder="Principal Investigator" value={newIRB.pi} onChange={e => setNewIRB(p => ({ ...p, pi: e.target.value }))} />
                <textarea style={TA} placeholder="Study description and scientific rationale..." value={newIRB.description} onChange={e => setNewIRB(p => ({ ...p, description: e.target.value }))} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <label style={{ fontSize: 13 }}>Risk Level:</label>
                  <select style={{ ...INP, width: 200 }} value={newIRB.riskLevel} onChange={e => setNewIRB(p => ({ ...p, riskLevel: e.target.value as 'minimal' | 'greater_than_minimal' }))}>
                    <option value="minimal">Minimal Risk</option>
                    <option value="greater_than_minimal">Greater Than Minimal Risk</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowNewIRB(false)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitIRB} className="btn btn-primary">Create Protocol</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {protocols.map(p => {
              const sm = IRB_STATUS_META[p.status];
              const isSelected = selectedIRB?.id === p.id;
              return (
                <div key={p.id}>
                  <div className="card" style={{ cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : undefined }} onClick={() => setSelectedIRB(isSelected ? null : p)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</span>
                          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sm.bg, color: sm.color, flexShrink: 0 }}>{sm.label}</span>
                          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: p.riskLevel === 'minimal' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: p.riskLevel === 'minimal' ? '#4ade80' : '#f87171', flexShrink: 0 }}>{p.riskLevel === 'minimal' ? 'Minimal Risk' : 'Greater Risk'}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {p.irbNumber} · PI: {p.pi} · Submitted: {p.submittedDate}
                          {p.approvedDate && ` · Approved: ${p.approvedDate}`}
                          {p.expiryDate && ` · Expires: ${p.expiryDate}`}
                          {p.amendments > 0 && ` · ${p.amendments} amendment(s)`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); }} style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>+ Amendment</button>
                        <button onClick={e => { e.stopPropagation(); }} style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>⬇ Export</button>
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{p.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Patient Cohorts ── */}
      {tab === 'cohorts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Patient Cohorts (De-identified)</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>🔒 HIPAA Protected</span>
              <button className="btn btn-primary">+ New Cohort</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cohorts.map(c => {
              const enrollPct = Math.round((c.enrolled / c.n) * 100);
              return (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {c.disease} · IRB: {c.irbRef}
                        {c.biobank && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 11 }}>🧊 Biobank Linked</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa' }}>{c.enrolled}</div><div style={{ color: 'var(--text-muted)' }}>Enrolled</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700 }}>{c.n}</div><div style={{ color: 'var(--text-muted)' }}>Target</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80' }}>{c.consentRate}%</div><div style={{ color: 'var(--text-muted)' }}>Consent Rate</div></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Enrollment Progress</span><span>{enrollPct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${enrollPct}%`, background: enrollPct >= 80 ? '#4ade80' : enrollPct >= 50 ? '#60a5fa' : '#fbbf24', borderRadius: 4 }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Inclusion Criteria</div>
                      <div style={{ fontSize: 12, lineHeight: 1.6 }}>{c.inclusionCriteria}</div>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Exclusion Criteria</div>
                      <div style={{ fontSize: 12, lineHeight: 1.6 }}>{c.exclusionCriteria}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>View Participants</button>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Biobank Inventory</button>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Export De-identified</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Clinical Trials ── */}
      {tab === 'trials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Clinical Trial Tracker</h3>
            <button className="btn btn-primary">+ Register Trial</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {trials.map(trial => {
              const pct = Math.round((trial.enrolled / trial.targetEnrollment) * 100);
              return (
                <div key={trial.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{trial.title}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Phase {trial.phase}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: trial.status.includes('Recruiting') ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: trial.status.includes('Recruiting') ? '#4ade80' : '#60a5fa' }}>{trial.status}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        <a href={`https://clinicaltrials.gov/study/${trial.nctId}`} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{trial.nctId}</a>
                        {' '}· PI: {trial.pi} · {trial.sites} site{trial.sites > 1 ? 's' : ''} · Started {trial.startDate}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa' }}>{trial.enrolled}</div><div style={{ color: 'var(--text-muted)' }}>Enrolled</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700 }}>{trial.targetEnrollment}</div><div style={{ color: 'var(--text-muted)' }}>Target</div></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Enrollment</span><span>{pct}% · Primary completion: {trial.primaryCompletion}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#4ade80', borderRadius: 4 }} />
                    </div>
                  </div>

                  {/* CONSORT-style enrollment funnel */}
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Enrollment Funnel (CONSORT)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', gap: 8 }}>
                      {[
                        { label: 'Screened', n: Math.round(trial.enrolled * 2.8), color: '#60a5fa' },
                        { label: 'Eligible', n: Math.round(trial.enrolled * 1.4), color: '#818cf8' },
                        { label: 'Enrolled', n: trial.enrolled, color: '#4ade80' },
                        { label: 'Completed', n: Math.round(trial.enrolled * 0.7), color: '#4ade80' },
                        { label: 'Withdrawn', n: Math.round(trial.enrolled * 0.08), color: '#f87171' },
                      ].map(step => (
                        <div key={step.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 16, color: step.color }}>{step.n}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{step.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Participant List</button>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Protocol Documents</button>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Safety Report</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Adverse Events ── */}
      {tab === 'ae' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Adverse Event Log</h3>
            <button onClick={() => setShowNewAE(true)} className="btn btn-primary">+ Report AE</button>
          </div>

          {showNewAE && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 14 }}>Report Adverse Event</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input style={INP} placeholder="Patient ID (de-identified) *" value={newAE.patientId} onChange={e => setNewAE(p => ({ ...p, patientId: e.target.value }))} />
                <input style={INP} placeholder="Adverse event description *" value={newAE.event} onChange={e => setNewAE(p => ({ ...p, event: e.target.value }))} />
                <select style={INP} value={newAE.severity} onChange={e => setNewAE(p => ({ ...p, severity: e.target.value as AESeverity }))}>
                  <option value="mild">Grade 1 — Mild</option>
                  <option value="moderate">Grade 2 — Moderate</option>
                  <option value="severe">Grade 3 — Severe</option>
                  <option value="serious">Grade 4/5 — Serious</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNewAE(false)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitAE} className="btn btn-primary">Submit AE Report</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map(ae => {
              const meta = AE_META[ae.severity];
              return (
                <div key={ae.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: ae.severity === 'serious' ? 'rgba(239,68,68,0.3)' : undefined }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color, flexShrink: 0, textTransform: 'capitalize' }}>{ae.severity}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ae.event}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patient: {ae.patientId} · Trial: NCT{ae.trialId === 1 ? '05123456' : '04987654'} · {ae.date}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {ae.reported && <span style={{ fontSize: 11, color: '#60a5fa' }}>✓ Reported</span>}
                    {ae.resolved ? <span style={{ fontSize: 11, color: '#4ade80' }}>✓ Resolved</span> : <span style={{ fontSize: 11, color: '#fbbf24' }}>Unresolved</span>}
                    {!ae.reported && <button onClick={() => setEvents(p => p.map(e => e.id === ae.id ? { ...e, reported: true } : e))} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #60a5fa', borderRadius: 6, background: 'none', cursor: 'pointer', color: '#60a5fa' }}>Mark Reported</button>}
                    {!ae.resolved && <button onClick={() => setEvents(p => p.map(e => e.id === ae.id ? { ...e, resolved: true } : e))} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #4ade80', borderRadius: 6, background: 'none', cursor: 'pointer', color: '#4ade80' }}>Mark Resolved</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
