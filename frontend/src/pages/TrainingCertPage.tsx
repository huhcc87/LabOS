import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
type CertStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'expiring_soon';

interface TrainingModule {
  id: string;
  title: string;
  category: string;
  icon: string;
  duration: string;
  description: string;
  requiredFor: string[];
  questions: { q: string; options: string[]; answer: number }[];
  validityMonths: number;
}

interface MyCert {
  moduleId: string;
  status: CertStatus;
  completedDate?: string;
  expiryDate?: string;
  score?: number;
  attempts: number;
}

interface TeamMember {
  name: string;
  role: string;
  certs: Record<string, CertStatus>;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MODULES: TrainingModule[] = [
  {
    id: 'biosafety', title: 'Biosafety Level 2 Training', category: 'Safety', icon: '🦠', duration: '45 min',
    description: 'Proper BSL-2 laboratory practices, personal protective equipment, waste disposal, and emergency procedures for handling biological agents.',
    requiredFor: ['All lab personnel', 'Equipment access: Biosafety Cabinets'],
    validityMonths: 12,
    questions: [
      { q: 'What level of PPE is required for BSL-2 work?', options: ['No PPE required', 'Gloves and lab coat', 'Full face shield and respirator', 'Level A suit'], answer: 1 },
      { q: 'How often should biosafety cabinets be certified?', options: ['Every 5 years', 'Every 2 years', 'Annually', 'Never'], answer: 2 },
      { q: 'Liquid biological waste should be:', options: ['Poured down the drain', 'Autoclaved before disposal', 'Frozen', 'Incinerated immediately'], answer: 1 },
    ],
  },
  {
    id: 'radiation', title: 'Radiation Safety Training', category: 'Safety', icon: '☢️', duration: '60 min',
    description: 'Safe handling of radioactive materials, exposure monitoring, spill response, and regulatory compliance for laboratory use.',
    requiredFor: ['Radioactive material users', 'Equipment access: Geiger counters'],
    validityMonths: 24,
    questions: [
      { q: 'The ALARA principle stands for:', options: ['Always Limit And Reduce Accidents', 'As Low As Reasonably Achievable', 'All Labs Are Radiation Aware', 'Avoid Losing Any Radioactive Amounts'], answer: 1 },
      { q: 'Personal dosimeters should be worn:', options: ['Only when working with high-energy emitters', 'Whenever handling any radioactive materials', 'Only in hot labs', 'Only during experiments'], answer: 1 },
    ],
  },
  {
    id: 'iacuc', title: 'IACUC Animal Research Ethics', category: 'Compliance', icon: '🐭', duration: '90 min',
    description: 'Institutional Animal Care and Use Committee training covering the 3Rs (Replace, Reduce, Refine), animal welfare regulations, and proper handling procedures.',
    requiredFor: ['Animal researchers', 'Equipment access: Animal facility'],
    validityMonths: 36,
    questions: [
      { q: 'The "3Rs" in animal research refers to:', options: ['Research, Reports, Records', 'Replace, Reduce, Refine', 'Rights, Rules, Regulations', 'Rapid, Reliable, Reproducible'], answer: 1 },
      { q: 'IACUC protocol approval must be obtained:', options: ['After animal use begins', 'Before any animal use', 'Only for new species', 'Only for painful procedures'], answer: 1 },
      { q: 'Signs of pain in mice include:', options: ['Increased grooming only', 'Rapid weight gain', 'Orbital tightening, reduced mobility, hunched posture', 'Increased food intake'], answer: 2 },
    ],
  },
  {
    id: 'chemical', title: 'Chemical Safety & GHS', category: 'Safety', icon: '⚗️', duration: '30 min',
    description: 'Globally Harmonized System of Classification and Labelling of Chemicals, SDS sheets, proper storage, and chemical spill response.',
    requiredFor: ['All lab personnel'],
    validityMonths: 12,
    questions: [
      { q: 'A flammable liquid is defined as having a flash point of:', options: ['Above 60°C', 'Below 60°C', 'Exactly 100°C', 'Any temperature'], answer: 1 },
      { q: 'SDS Section 8 covers:', options: ['Physical properties', 'Exposure controls / PPE', 'First aid measures', 'Regulatory information'], answer: 1 },
    ],
  },
  {
    id: 'hipaa', title: 'HIPAA & Research Data Privacy', category: 'Compliance', icon: '🔒', duration: '40 min',
    description: 'Health Insurance Portability and Accountability Act requirements for handling protected health information in a research context.',
    requiredFor: ['Clinical researchers', 'Anyone accessing patient data'],
    validityMonths: 12,
    questions: [
      { q: 'Which of the following is NOT a HIPAA Safe Harbor de-identification method?', options: ['Expert determination', 'Statistical aggregation', 'Removing all 18 identifiers', 'Using coded data'], answer: 1 },
      { q: 'A data breach must be reported within:', options: ['7 days', '30 days', '60 days', 'No requirement'], answer: 2 },
    ],
  },
  {
    id: 'equipment_cryostat', title: 'Cryostat Operation & Safety', category: 'Equipment', icon: '🔬', duration: '20 min',
    description: 'Safe operation of the cryostat for tissue sectioning, blade handling, anti-contamination procedures, and maintenance.',
    requiredFor: ['Equipment access: Cryostat'],
    validityMonths: 24,
    questions: [
      { q: 'What temperature is a typical cryostat operated at?', options: ['0°C', '-10°C to -30°C', '-80°C', '-196°C'], answer: 1 },
    ],
  },
];

const MY_CERTS: MyCert[] = [
  { moduleId: 'biosafety', status: 'completed', completedDate: '2025-08-15', expiryDate: '2026-08-15', score: 92, attempts: 1 },
  { moduleId: 'chemical', status: 'expiring_soon', completedDate: '2025-06-01', expiryDate: '2026-06-01', score: 88, attempts: 1 },
  { moduleId: 'iacuc', status: 'completed', completedDate: '2024-03-10', expiryDate: '2027-03-10', score: 95, attempts: 1 },
  { moduleId: 'radiation', status: 'not_started', attempts: 0 },
  { moduleId: 'hipaa', status: 'in_progress', attempts: 1 },
  { moduleId: 'equipment_cryostat', status: 'expired', completedDate: '2023-11-01', expiryDate: '2025-11-01', score: 90, attempts: 1 },
];

const TEAM: TeamMember[] = [
  { name: 'Dr. Chen', role: 'PI', certs: { biosafety: 'completed', chemical: 'completed', iacuc: 'completed', radiation: 'completed', hipaa: 'completed', equipment_cryostat: 'completed' } },
  { name: 'Dr. Patel', role: 'Postdoc', certs: { biosafety: 'completed', chemical: 'expiring_soon', iacuc: 'completed', radiation: 'not_started', hipaa: 'in_progress', equipment_cryostat: 'completed' } },
  { name: 'Jamie K.', role: 'Grad Student', certs: { biosafety: 'completed', chemical: 'completed', iacuc: 'in_progress', radiation: 'not_started', hipaa: 'not_started', equipment_cryostat: 'expired' } },
  { name: 'Sam L.', role: 'Lab Technician', certs: { biosafety: 'expiring_soon', chemical: 'completed', iacuc: 'not_started', radiation: 'not_started', hipaa: 'not_started', equipment_cryostat: 'not_started' } },
];

const STATUS_META: Record<CertStatus, { label: string; color: string; bg: string; icon: string }> = {
  not_started:    { label: 'Not Started',    color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', icon: '○' },
  in_progress:    { label: 'In Progress',    color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  icon: '◑' },
  completed:      { label: 'Certified',      color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   icon: '✓' },
  expiring_soon:  { label: 'Expiring Soon',  color: '#fbbf24', bg: 'rgba(234,179,8,0.12)',   icon: '⚠' },
  expired:        { label: 'Expired',        color: '#f87171', bg: 'rgba(239,68,68,0.15)',   icon: '✗' },
};

type Tab = 'my' | 'team' | 'modules';
type QuizState = { moduleId: string; answers: (number | null)[]; submitted: boolean; score: number } | null;

export default function TrainingCertPage() {
  const [tab, setTab] = useState<Tab>('my');
  const [certs, setCerts] = useState<MyCert[]>(MY_CERTS);
  const [quiz, setQuiz] = useState<QuizState>(null);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);

  const startQuiz = (module: TrainingModule) => {
    setQuiz({ moduleId: module.id, answers: Array(module.questions.length).fill(null), submitted: false, score: 0 });
    setSelectedModule(module);
  };

  const submitQuiz = () => {
    if (!quiz || !selectedModule) return;
    const correct = selectedModule.questions.filter((q, i) => quiz.answers[i] === q.answer).length;
    const score = Math.round((correct / selectedModule.questions.length) * 100);
    const passed = score >= 70;
    setQuiz(prev => prev ? { ...prev, submitted: true, score } : null);
    if (passed) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + selectedModule.validityMonths);
      setCerts(prev => prev.map(c => c.moduleId === selectedModule.id
        ? { ...c, status: 'completed', completedDate: new Date().toISOString().slice(0, 10), expiryDate: expiry.toISOString().slice(0, 10), score, attempts: c.attempts + 1 }
        : c));
    }
  };

  const getCert = (moduleId: string) => certs.find(c => c.moduleId === moduleId) || { moduleId, status: 'not_started' as CertStatus, attempts: 0 };
  const myCompleted = certs.filter(c => c.status === 'completed').length;
  const myExpiring = certs.filter(c => c.status === 'expiring_soon').length;
  const myExpired = certs.filter(c => c.status === 'expired').length;

  const teamCompliance = TEAM.map(member => {
    const completed = Object.values(member.certs).filter(s => s === 'completed').length;
    const total = Object.values(member.certs).length;
    return { ...member, rate: Math.round((completed / total) * 100) };
  });

  // ── Quiz modal ────────────────────────────────────────────────────────────
  if (quiz && selectedModule) {
    const passed = quiz.submitted && quiz.score >= 70;
    return (
      <div className="page" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedModule.icon} {selectedModule.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Knowledge Assessment · {selectedModule.questions.length} questions</p>
          </div>
          {!quiz.submitted && <button onClick={() => { setQuiz(null); setSelectedModule(null); }} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>}
        </div>

        {quiz.submitted ? (
          <div className="card" style={{ textAlign: 'center', padding: 48, borderColor: passed ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)', background: passed ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🏆' : '📚'}</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: passed ? '#4ade80' : '#f87171', marginBottom: 8 }}>{passed ? 'Certified!' : 'Not Passed'}</h2>
            <p style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 16 }}>Score: {quiz.score}% (70% required)</p>
            {passed ? <p style={{ color: '#4ade80', fontSize: 14, marginBottom: 24 }}>Your certification has been recorded and is valid for {selectedModule.validityMonths} months.</p>
              : <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Review the training material and try again. Minimum passing score is 70%.</p>}
            <button onClick={() => { setQuiz(null); setSelectedModule(null); setTab('my'); }} style={{ padding: '10px 24px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
              {passed ? 'View My Certifications' : 'Back to Training'}
            </button>
          </div>
        ) : (
          <div>
            {selectedModule.questions.map((q, qi) => (
              <div key={qi} className="card" style={{ marginBottom: 14 }}>
                <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Q{qi + 1}. {q.q}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {q.options.map((opt, oi) => (
                    <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${quiz.answers[qi] === oi ? 'var(--primary)' : 'var(--border)'}`, background: quiz.answers[qi] === oi ? 'rgba(99,102,241,0.08)' : 'none', cursor: 'pointer', transition: 'all 0.1s' }}>
                      <input type="radio" name={`q${qi}`} checked={quiz.answers[qi] === oi} onChange={() => setQuiz(prev => prev ? { ...prev, answers: prev.answers.map((a, i) => i === qi ? oi : a) } : null)} style={{ accentColor: 'var(--primary)' }} />
                      <span style={{ fontSize: 14 }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={submitQuiz} disabled={quiz.answers.some(a => a === null)} style={{ padding: '10px 24px', border: 'none', borderRadius: 10, background: quiz.answers.some(a => a === null) ? 'var(--surface2)' : 'var(--primary)', color: quiz.answers.some(a => a === null) ? 'var(--text-muted)' : '#fff', cursor: quiz.answers.some(a => a === null) ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600 }}>
                Submit Assessment
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Training & Certifications</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>Safety · Compliance · Equipment access gating · Team certification tracking</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Certified', value: myCompleted, color: '#4ade80', icon: '✅' },
          { label: 'Expiring Soon', value: myExpiring, color: '#fbbf24', icon: '⏰' },
          { label: 'Expired', value: myExpired, color: '#f87171', icon: '⚠️' },
          { label: 'Not Started', value: certs.filter(c => c.status === 'not_started').length, color: '#9ca3af', icon: '○' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'my' as Tab, label: '🎓 My Certifications' }, { key: 'modules' as Tab, label: '📚 Training Catalog' }, { key: 'team' as Tab, label: '👥 Team Compliance' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: tab === t.key ? 600 : 400, border: 'none', background: 'none', cursor: 'pointer', color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── My Certifications ── */}
      {tab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MODULES.map(module => {
            const cert = getCert(module.id);
            const sm = STATUS_META[cert.status];
            const isBlocked = cert.status === 'not_started' || cert.status === 'expired' || cert.status === 'expiring_soon';
            return (
              <div key={module.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: cert.status === 'expired' ? 'rgba(239,68,68,0.3)' : cert.status === 'expiring_soon' ? 'rgba(234,179,8,0.3)' : undefined }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: 30, flexShrink: 0 }}>{module.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{module.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{module.category} · {module.duration} · Valid {module.validityMonths} months</div>
                    {cert.completedDate && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completed: {cert.completedDate} · Expires: {cert.expiryDate} {cert.score && `· Score: ${cert.score}%`}</div>}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {module.requiredFor.map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{r}</span>)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sm.bg, color: sm.color }}>{sm.icon} {sm.label}</span>
                  <button onClick={() => startQuiz(module)} style={{ padding: '6px 16px', border: 'none', borderRadius: 8, background: cert.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'var(--primary)', color: cert.status === 'completed' ? '#4ade80' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {cert.status === 'completed' ? '↩ Retake' : cert.status === 'in_progress' ? 'Continue' : 'Start'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Training Catalog ── */}
      {tab === 'modules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {MODULES.map(module => (
            <div key={module.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 36 }}>{module.icon}</span>
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{module.category}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{module.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{module.description}</p>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                <span>⏱ {module.duration}</span>
                <span>📝 {module.questions.length} questions</span>
                <span>✅ {module.validityMonths}mo valid</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Required For</div>
                {module.requiredFor.map(r => <div key={r} style={{ fontSize: 12, color: 'var(--text-muted)' }}>• {r}</div>)}
              </div>
              <button onClick={() => { setTab('my'); startQuiz(module); }} style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Take Training
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Team Compliance ── */}
      {tab === 'team' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team Certification Matrix</h3>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Team Member</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)' }}>COMPLIANCE</th>
                  {MODULES.map(m => (
                    <th key={m.id} style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', maxWidth: 80 }} title={m.title}>
                      {m.icon}<br />{m.title.split(' ').slice(0, 2).join(' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamCompliance.map(member => (
                  <tr key={member.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.role}</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: member.rate >= 80 ? '#4ade80' : member.rate >= 60 ? '#fbbf24' : '#f87171' }}>{member.rate}%</div>
                    </td>
                    {MODULES.map(m => {
                      const status = member.certs[m.id] || 'not_started';
                      const sm = STATUS_META[status as CertStatus];
                      return (
                        <td key={m.id} style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span title={sm.label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: sm.bg, color: sm.color, fontWeight: 700, fontSize: 14 }}>
                            {sm.icon}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_META).map(([key, sm]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: 5, background: sm.bg, color: sm.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{sm.icon}</span>
                <span style={{ color: 'var(--text-muted)' }}>{sm.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
