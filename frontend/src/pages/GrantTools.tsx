import { useState, useRef } from 'react';
import { grantsApi } from '../lib/api';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={style}>{children}</div>;
}

function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
      </div>
      <button onClick={onBack} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
        ← Back to Tools
      </button>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE, resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.6,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. BUDGET CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface PersonnelRow {
  id: string; name: string; role: string; salary: number; effort: number; fringe: number;
}

const ROLE_DEFAULTS: Record<string, { fringe: number; salary: number }> = {
  'PI': { salary: 185000, fringe: 28 },
  'Co-Investigator': { salary: 160000, fringe: 28 },
  'Postdoctoral Fellow': { salary: 58000, fringe: 22 },
  'Graduate Student': { salary: 32000, fringe: 8 },
  'Research Scientist': { salary: 75000, fringe: 28 },
  'Lab Technician': { salary: 48000, fringe: 28 },
  'Research Coordinator': { salary: 52000, fringe: 28 },
  'Biostatistician': { salary: 90000, fringe: 28 },
  'Other': { salary: 60000, fringe: 28 },
};

const FA_RATES = [
  { label: 'R&D On-Campus (NIH default)', rate: 52 },
  { label: 'R&D Off-Campus', rate: 26 },
  { label: 'Clinical Research', rate: 30 },
  { label: 'Training Grants', rate: 8 },
  { label: 'Custom rate', rate: 0 },
];

export function BudgetCalculator({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'modular' | 'detailed'>('detailed');
  const [years, setYears] = useState(5);
  const [faRateKey, setFaRateKey] = useState(0);
  const [customFA, setCustomFA] = useState(52);
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([
    { id: '1', name: 'Dr. Principal Investigator', role: 'PI', salary: 185000, effort: 10, fringe: 28 },
    { id: '2', name: 'Postdoctoral Fellow', role: 'Postdoctoral Fellow', salary: 58000, effort: 100, fringe: 22 },
    { id: '3', name: 'Graduate Student', role: 'Graduate Student', salary: 32000, effort: 50, fringe: 8 },
  ]);
  const [supplies, setSupplies] = useState(40000);
  const [equipment, setEquipment] = useState(15000);
  const [travel, setTravel] = useState(5000);
  const [other, setOther] = useState(10000);
  const [subcontracts, setSubcontracts] = useState(0);
  const [escalation, setEscalation] = useState(3);

  const faRate = faRateKey < FA_RATES.length - 1 ? FA_RATES[faRateKey].rate : customFA;

  const calcYear = (yr: number) => {
    const esc = Math.pow(1 + escalation / 100, yr - 1);
    const personnelCost = personnel.reduce((s, p) => s + p.salary * (p.effort / 100) * (1 + p.fringe / 100) * esc, 0);
    const directOther = (supplies + equipment + travel + other + subcontracts) * esc;
    const totalDirect = personnelCost + directOther;
    const fa = (totalDirect - subcontracts * esc) * (faRate / 100);
    const totalCosts = totalDirect + fa;
    return { personnelCost, directOther, totalDirect, fa, totalCosts, esc };
  };

  const yearData = Array.from({ length: years }, (_, i) => calcYear(i + 1));
  const totalAll = yearData.reduce((s, y) => s + y.totalCosts, 0);

  const addPersonnel = () => setPersonnel(p => [...p, {
    id: String(Date.now()), name: 'New Person', role: 'Other', salary: 60000, effort: 50, fringe: 28,
  }]);

  const updatePersonnel = (id: string, field: keyof PersonnelRow, value: string | number) => {
    setPersonnel(p => p.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'role') {
        const def = ROLE_DEFAULTS[value as string] || ROLE_DEFAULTS['Other'];
        updated.salary = def.salary; updated.fringe = def.fringe;
      }
      return updated;
    }));
  };

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

  const exportTxt = () => {
    let txt = `NIH GRANT BUDGET\n${'='.repeat(60)}\n\nMode: ${mode === 'modular' ? 'Modular' : 'Detailed'} Budget\nYears: ${years}\nF&A Rate: ${faRate}%\n\n`;
    txt += `PERSONNEL\n${'-'.repeat(40)}\n`;
    personnel.forEach(p => {
      const yr1 = p.salary * (p.effort / 100) * (1 + p.fringe / 100);
      txt += `${p.name} (${p.role}) — ${p.effort}% effort — ${fmt(yr1)}/yr\n`;
    });
    txt += `\nYEAR-BY-YEAR TOTALS\n${'-'.repeat(40)}\n`;
    yearData.forEach((y, i) => {
      txt += `Year ${i + 1}: Personnel ${fmt(y.personnelCost)} | Direct ${fmt(y.totalDirect)} | F&A ${fmt(y.fa)} | TOTAL ${fmt(y.totalCosts)}\n`;
    });
    txt += `\nGRAND TOTAL (${years}-year): ${fmt(totalAll)}\n`;
    downloadTxt(txt, `grant_budget_${new Date().toISOString().slice(0, 10)}.txt`);
  };

  return (
    <div>
      <SectionHeader title="🧮 Budget Calculator" subtitle="NIH-compliant grant budget with personnel, direct, and F&A costs" onBack={onBack} />

      {/* Controls row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <FieldRow label="Budget Mode">
            <select value={mode} onChange={e => setMode(e.target.value as 'modular' | 'detailed')} style={INPUT_STYLE}>
              <option value="detailed">Detailed Budget</option>
              <option value="modular">Modular ($250K units)</option>
            </select>
          </FieldRow>
        </Card>
        <Card>
          <FieldRow label="Project Years">
            <select value={years} onChange={e => setYears(Number(e.target.value))} style={INPUT_STYLE}>
              {[1,2,3,4,5].map(y => <option key={y} value={y}>{y} Year{y>1?'s':''}</option>)}
            </select>
          </FieldRow>
        </Card>
        <Card>
          <FieldRow label="F&A Rate">
            <select value={faRateKey} onChange={e => setFaRateKey(Number(e.target.value))} style={INPUT_STYLE}>
              {FA_RATES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
            </select>
          </FieldRow>
          {faRateKey === FA_RATES.length - 1 && (
            <input type="number" value={customFA} onChange={e => setCustomFA(Number(e.target.value))} style={{ ...INPUT_STYLE, marginTop: 6 }} placeholder="Custom % rate" />
          )}
        </Card>
        <Card>
          <FieldRow label="Annual Escalation">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={escalation} min={0} max={10} step={0.5} onChange={e => setEscalation(Number(e.target.value))} style={{ ...INPUT_STYLE, width: 70 }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>% per year</span>
            </div>
          </FieldRow>
        </Card>
      </div>

      {/* Personnel */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>👥 Personnel</h3>
          <button onClick={addPersonnel} style={{ padding: '5px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>+ Add Person</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name / Title', 'Role', 'Salary ($/yr)', 'Effort %', 'Fringe %', 'Yr 1 Cost', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personnel.map(p => {
                const yr1 = p.salary * (p.effort / 100) * (1 + p.fringe / 100);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px' }}>
                      <input value={p.name} onChange={e => updatePersonnel(p.id, 'name', e.target.value)} style={{ ...INPUT_STYLE, padding: '4px 8px' }} />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <select value={p.role} onChange={e => updatePersonnel(p.id, 'role', e.target.value)} style={{ ...INPUT_STYLE, padding: '4px 8px' }}>
                        {Object.keys(ROLE_DEFAULTS).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input type="number" value={p.salary} onChange={e => updatePersonnel(p.id, 'salary', Number(e.target.value))} style={{ ...INPUT_STYLE, padding: '4px 8px', width: 110 }} />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input type="number" value={p.effort} min={1} max={100} onChange={e => updatePersonnel(p.id, 'effort', Number(e.target.value))} style={{ ...INPUT_STYLE, padding: '4px 8px', width: 70 }} />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input type="number" value={p.fringe} min={0} max={50} onChange={e => updatePersonnel(p.id, 'fringe', Number(e.target.value))} style={{ ...INPUT_STYLE, padding: '4px 8px', width: 70 }} />
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{fmt(yr1)}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <button onClick={() => setPersonnel(p2 => p2.filter(r => r.id !== p.id))} style={{ padding: '2px 8px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Direct non-personnel costs */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>📦 Direct Costs (Year 1 base)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {[
            ['Supplies & Reagents', supplies, setSupplies],
            ['Equipment', equipment, setEquipment],
            ['Travel', travel, setTravel],
            ['Subcontracts', subcontracts, setSubcontracts],
            ['Other Direct Costs', other, setOther],
          ].map(([label, val, setter]) => (
            <FieldRow key={label as string} label={label as string}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>$</span>
                <input type="number" value={val as number} onChange={e => (setter as Function)(Number(e.target.value))} style={{ ...INPUT_STYLE }} />
              </div>
            </FieldRow>
          ))}
        </div>
      </Card>

      {/* Year-by-year summary */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>📊 Year-by-Year Budget Summary</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Category', ...Array.from({ length: years }, (_, i) => `Year ${i + 1}`), 'Total'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: 12, borderBottom: '2px solid var(--border)' }}>{h === 'Category' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Personnel & Fringe', key: 'personnelCost' as const },
                { label: 'Other Direct Costs', key: 'directOther' as const },
                { label: 'Total Direct Costs', key: 'totalDirect' as const, bold: true },
                { label: `F&A / Indirect (${faRate}%)`, key: 'fa' as const },
                { label: 'Total Project Costs', key: 'totalCosts' as const, bold: true, accent: true },
              ].map(row => (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--border)', background: row.accent ? 'rgba(0,113,188,0.06)' : undefined }}>
                  <td style={{ padding: '10px 14px', fontWeight: row.bold ? 700 : 400, color: row.accent ? 'var(--accent)' : 'var(--text)' }}>{row.label}</td>
                  {yearData.map((y, i) => (
                    <td key={i} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: row.bold ? 700 : 400, color: row.accent ? 'var(--accent)' : 'var(--text)' }}>{fmt(y[row.key])}</td>
                  ))}
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: row.accent ? 'var(--accent)' : 'var(--text)' }}>{fmt(yearData.reduce((s, y) => s + y[row.key], 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mode === 'modular' && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(251,191,36,0.1)', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', fontSize: 13, color: '#fbbf24' }}>
            ⚠️ Modular budget: Direct costs rounded to nearest $25,000 module.
            Year 1 modular units: {Math.ceil(yearData[0].totalDirect / 25000)} × $25K = {fmt(Math.ceil(yearData[0].totalDirect / 25000) * 25000)}
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <div style={{ padding: '8px 20px', background: 'rgba(0,113,188,0.1)', border: '1px solid rgba(0,113,188,0.3)', borderRadius: 8, fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>
          {years}-Year Total: {fmt(totalAll)}
        </div>
        <button onClick={exportTxt} style={{ padding: '8px 18px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇ Export .txt</button>
        <button onClick={async () => {
          const { exportGrantDocx } = await import('../lib/exportDocx');
          let txt = `NIH GRANT BUDGET\n\nMode: ${mode === 'modular' ? 'Modular' : 'Detailed'}\nYears: ${years} | F&A Rate: ${faRate}%\n\nPERSONNEL\n`;
          personnel.forEach(p => { txt += `${p.name} (${p.role}): ${p.effort}% effort, $${Math.round(p.salary*(p.effort/100)*(1+p.fringe/100)).toLocaleString()}/yr\n`; });
          txt += `\nYEAR-BY-YEAR TOTALS\n`;
          yearData.forEach((y, i) => { txt += `Year ${i+1}: Direct ${fmt(y.totalDirect)} | F&A ${fmt(y.fa)} | Total ${fmt(y.totalCosts)}\n`; });
          txt += `\nGRAND TOTAL: ${fmt(totalAll)}`;
          await exportGrantDocx({ title: 'NIH Grant Budget', grantType: mode === 'modular' ? 'Modular' : 'Detailed', disease: '', sections: { 'Budget Summary': txt }, sectionDefs: [{ key: 'Budget Summary', label: 'Budget Summary', icon: '💰' }] });
        }} style={{ padding: '8px 18px', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: '#818cf8', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇ Word (.docx)</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BIOSKETCH GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface ContribToScience { title: string; narrative: string; citations: string; }

export function BiosketschGenerator({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [eraprofile, setEraProfile] = useState('');
  const [position, setPosition] = useState('');
  const [institution, setInstitution] = useState('');
  const [personalStatement, setPersonalStatement] = useState('');
  const [positions, setPositions] = useState('');
  const [honors, setHonors] = useState('');
  const [contributions, setContributions] = useState<ContribToScience[]>([
    { title: '', narrative: '', citations: '' },
  ]);
  const [researchSupport, setResearchSupport] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [disease, setDisease] = useState('');
  const [expertise, setExpertise] = useState('');

  const aiDraft = async (section: string) => {
    if (!name.trim()) { alert('Enter your name first'); return; }
    setAiLoading(section);
    try {
      const res = await grantsApi.aiDraft({
        grant_type: 'NIH Biosketch',
        disease: disease || 'cancer biology',
        title: `Biosketch for ${name}`,
        section,
        context: `Researcher: ${name}, Position: ${position}, Institution: ${institution}, Expertise: ${expertise}`,
      });
      const content = res.data.content;
      if (section === 'personal_statement') setPersonalStatement(content);
      else if (section === 'positions') setPositions(content);
      else if (section === 'contributions') setContributions([{ title: 'AI-Generated Contribution', narrative: content, citations: '' }]);
      else if (section === 'research_support') setResearchSupport(content);
    } catch { alert('AI generation failed'); }
    finally { setAiLoading(null); }
  };

  const exportTxt = () => {
    let txt = `NIH BIOSKETCH\n${'='.repeat(60)}\n`;
    txt += `NAME: ${name}\neRA COMMONS USERNAME: ${eraprofile}\nPOSITION/TITLE: ${position}\nINSTITUTION: ${institution}\n\n`;
    txt += `A. PERSONAL STATEMENT\n${'-'.repeat(40)}\n${personalStatement}\n\n`;
    txt += `B. POSITIONS, SCIENTIFIC APPOINTMENTS, AND HONORS\n${'-'.repeat(40)}\nPositions:\n${positions}\nHonors:\n${honors}\n\n`;
    txt += `C. CONTRIBUTIONS TO SCIENCE\n${'-'.repeat(40)}\n`;
    contributions.forEach((c, i) => { txt += `${i + 1}. ${c.title}\n${c.narrative}\n\nKey Citations:\n${c.citations}\n\n`; });
    txt += `D. RESEARCH SUPPORT\n${'-'.repeat(40)}\n${researchSupport}\n`;
    downloadTxt(txt, `biosketch_${name.replace(/\s+/g, '_') || 'biosketch'}_${new Date().toISOString().slice(0, 10)}.txt`);
  };

  const AIBtn = ({ section, label }: { section: string; label?: string }) => (
    <button onClick={() => aiDraft(section)} disabled={aiLoading !== null} style={{ padding: '4px 10px', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {aiLoading === section ? '⏳ Generating…' : `✨ ${label || 'AI Draft'}`}
    </button>
  );

  return (
    <div>
      <SectionHeader title="👤 Biosketch Generator" subtitle="NIH-format biographical sketch (required for all NIH applications)" onBack={onBack} />

      {/* Basic info */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Personal Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <FieldRow label="Full Name"><input value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="Last, First MI" /></FieldRow>
          <FieldRow label="eRA Commons Username"><input value={eraprofile} onChange={e => setEraProfile(e.target.value)} style={INPUT_STYLE} placeholder="eRA Commons ID" /></FieldRow>
          <FieldRow label="Position / Title"><input value={position} onChange={e => setPosition(e.target.value)} style={INPUT_STYLE} placeholder="e.g. Associate Professor" /></FieldRow>
          <FieldRow label="Institution"><input value={institution} onChange={e => setInstitution(e.target.value)} style={INPUT_STYLE} placeholder="University / Hospital" /></FieldRow>
          <FieldRow label="Research Area / Disease"><input value={disease} onChange={e => setDisease(e.target.value)} style={INPUT_STYLE} placeholder="e.g. Glioblastoma" /></FieldRow>
          <FieldRow label="Expertise Keywords"><input value={expertise} onChange={e => setExpertise(e.target.value)} style={INPUT_STYLE} placeholder="e.g. CRISPR, immunotherapy" /></FieldRow>
        </div>
      </Card>

      {/* Section A */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>A. Personal Statement</h3>
          <AIBtn section="personal_statement" />
        </div>
        <textarea value={personalStatement} onChange={e => setPersonalStatement(e.target.value)} style={{ ...TEXTAREA_STYLE, minHeight: 120 }} placeholder="Briefly describe why you are well-suited for this role…" />
      </Card>

      {/* Section B */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>B. Positions, Appointments & Honors</h3>
          <AIBtn section="positions" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FieldRow label="Positions & Appointments">
            <textarea value={positions} onChange={e => setPositions(e.target.value)} style={TEXTAREA_STYLE} placeholder="2018-Present  Associate Professor, Harvard Medical School&#10;2014-2018    Assistant Professor, MIT" />
          </FieldRow>
          <FieldRow label="Honors & Awards">
            <textarea value={honors} onChange={e => setHonors(e.target.value)} style={TEXTAREA_STYLE} placeholder="2023  NIH Director's Pioneer Award&#10;2021  ACS Research Scholar Grant" />
          </FieldRow>
        </div>
      </Card>

      {/* Section C */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>C. Contributions to Science</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <AIBtn section="contributions" label="AI Draft All" />
            <button onClick={() => setContributions(c => [...c, { title: '', narrative: '', citations: '' }])} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>+ Add</button>
          </div>
        </div>
        {contributions.map((c, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Contribution {i + 1}</span>
              {contributions.length > 1 && <button onClick={() => setContributions(cs => cs.filter((_, j) => j !== i))} style={{ padding: '2px 8px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>Remove</button>}
            </div>
            <FieldRow label="Title"><input value={c.title} onChange={e => setContributions(cs => cs.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} style={{ ...INPUT_STYLE, marginBottom: 10 }} placeholder="e.g. Development of immunotherapy biomarkers" /></FieldRow>
            <FieldRow label="Narrative (describe significance)"><textarea value={c.narrative} onChange={e => setContributions(cs => cs.map((x, j) => j === i ? { ...x, narrative: e.target.value } : x))} style={{ ...TEXTAREA_STYLE, minHeight: 80, marginBottom: 10 }} /></FieldRow>
            <FieldRow label="Key Publications (up to 4)"><textarea value={c.citations} onChange={e => setContributions(cs => cs.map((x, j) => j === i ? { ...x, citations: e.target.value } : x))} style={{ ...TEXTAREA_STYLE, minHeight: 60 }} placeholder="a. Author et al. Title. Journal. Year; Vol:Pages. PMID: XXXXXXXX" /></FieldRow>
          </div>
        ))}
      </Card>

      {/* Section D */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>D. Research Support</h3>
          <AIBtn section="research_support" />
        </div>
        <textarea value={researchSupport} onChange={e => setResearchSupport(e.target.value)} style={{ ...TEXTAREA_STYLE, minHeight: 100 }} placeholder="List active and recently completed research support. Include grant number, PI, dates, and brief description." />
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={exportTxt} style={{ padding: '8px 18px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇ Export .txt</button>
        <button onClick={async () => {
          const { exportGrantDocx } = await import('../lib/exportDocx');
          await exportGrantDocx({
            title: `NIH Biosketch — ${name}`,
            grantType: 'NIH Biosketch',
            disease,
            sections: {
              'A — Personal Statement': personalStatement,
              'B — Positions & Honors': `POSITIONS:\n${positions}\n\nHONORS:\n${honors}`,
              'C — Contributions to Science': contributions.map((c, i) => `${i+1}. ${c.title}\n${c.narrative}\n\nCitations:\n${c.citations}`).join('\n\n'),
              'D — Research Support': researchSupport,
            },
            sectionDefs: [
              { key: 'A — Personal Statement', label: 'A — Personal Statement', icon: '📋' },
              { key: 'B — Positions & Honors', label: 'B — Positions & Honors', icon: '🏅' },
              { key: 'C — Contributions to Science', label: 'C — Contributions to Science', icon: '🔬' },
              { key: 'D — Research Support', label: 'D — Research Support', icon: '💼' },
            ],
          });
        }} style={{ padding: '8px 18px', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: '#818cf8', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇ Word (.docx)</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SUPPORT LETTERS
// ═══════════════════════════════════════════════════════════════════════════════

interface SupportLetter {
  id: string; name: string; title: string; institution: string; email: string;
  type: 'support' | 'collaboration' | 'institutional'; status: 'pending' | 'requested' | 'received' | 'uploaded';
  requestedDate: string; receivedDate: string; notes: string;
}

const LETTER_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  requested: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  received: { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
  uploaded: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
};

export function SupportLetters({ onBack }: { onBack: () => void }) {
  const [letters, setLetters] = useState<SupportLetter[]>([
    { id: '1', name: 'Dr. Jane Smith', title: 'Professor', institution: 'Mayo Clinic', email: 'j.smith@mayo.edu', type: 'collaboration', status: 'received', requestedDate: '2026-03-01', receivedDate: '2026-03-15', notes: 'Collaboration on Aim 2 patient samples' },
    { id: '2', name: 'Dr. Robert Chen', title: 'Chief, Oncology Division', institution: 'MD Anderson', email: 'r.chen@mdanderson.org', type: 'support', status: 'requested', requestedDate: '2026-04-10', receivedDate: '', notes: 'Letter of support for clinical component' },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [template, setTemplate] = useState<SupportLetter | null>(null);
  const [form, setForm] = useState<Partial<SupportLetter>>({ type: 'support', status: 'pending', requestedDate: new Date().toISOString().slice(0, 10), receivedDate: '' });
  const [grantTitle, setGrantTitle] = useState('');

  const save = () => {
    if (!form.name?.trim()) return;
    setLetters(ls => [...ls, { id: String(Date.now()), name: form.name || '', title: form.title || '', institution: form.institution || '', email: form.email || '', type: form.type || 'support', status: form.status || 'pending', requestedDate: form.requestedDate || '', receivedDate: form.receivedDate || '', notes: form.notes || '' }]);
    setForm({ type: 'support', status: 'pending', requestedDate: new Date().toISOString().slice(0, 10), receivedDate: '' });
    setShowAdd(false);
  };

  const genTemplate = (l: SupportLetter) => `[Date]

${l.title ? l.title + ' ' : ''}${l.name}
${l.institution}

Dear ${l.name.split(' ')[0] || 'Dr.'},

I am writing to formally ${l.type === 'collaboration' ? 'confirm my collaboration on' : 'express my strong support for'} the grant application titled "${grantTitle || '[GRANT TITLE]'}" submitted by [PI Name] to [Funding Agency].

${l.type === 'collaboration'
      ? `As a collaborator on this project, I will contribute [specific role, e.g., patient samples, clinical expertise, analytical methodology]. My laboratory has extensive experience in [relevant expertise], and I am committed to dedicating the necessary resources and personnel to ensure the success of this collaboration.`
      : `I have known [PI Name] for [X] years and can attest to their exceptional scientific rigor, creativity, and productivity. The proposed research addresses critical gaps in our understanding of [research area] and has strong potential for significant impact.`}

The proposed research is highly significant because [specific scientific reasons].

I fully endorse this application and am confident that [PI Name] will execute this project with excellence.

Sincerely,

${l.name}
${l.title}
${l.institution}
${l.email}`;

  const stats = { total: letters.length, received: letters.filter(l => l.status === 'received' || l.status === 'uploaded').length, pending: letters.filter(l => l.status === 'pending' || l.status === 'requested').length };

  return (
    <div>
      <SectionHeader title="✉️ Support Letters" subtitle="Track and generate support and collaboration letters for grant applications" onBack={onBack} />

      {template ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>Letter Template — {template.name}</h3>
            <button onClick={() => setTemplate(null)} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>← Back</button>
          </div>
          <Card style={{ marginBottom: 16 }}>
            <FieldRow label="Grant Title (for template)"><input value={grantTitle} onChange={e => setGrantTitle(e.target.value)} style={INPUT_STYLE} placeholder="Enter grant title" /></FieldRow>
          </Card>
          <Card>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>{genTemplate(template)}</pre>
          </Card>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => navigator.clipboard.writeText(genTemplate(template))} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>📋 Copy</button>
            <button onClick={() => downloadTxt(genTemplate(template), `support_letter_${template.name.replace(/\s/g, '_')}.txt`)} style={{ padding: '8px 16px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇ Download</button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['Total Letters', stats.total, 'var(--text)'], ['Received', stats.received, '#4ade80'], ['Pending', stats.pending, '#fbbf24']].map(([l, v, c]) => (
              <Card key={l as string} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: c as string }}>{v as number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{l as string}</div>
              </Card>
            ))}
          </div>

          {/* Add form */}
          {showAdd && (
            <Card style={{ marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Add Letter Request</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <FieldRow label="Contact Name"><input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT_STYLE} placeholder="Dr. Jane Smith" /></FieldRow>
                <FieldRow label="Title / Position"><input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={INPUT_STYLE} placeholder="Professor" /></FieldRow>
                <FieldRow label="Institution"><input value={form.institution || ''} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} style={INPUT_STYLE} placeholder="University / Hospital" /></FieldRow>
                <FieldRow label="Email"><input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={INPUT_STYLE} placeholder="email@institution.edu" /></FieldRow>
                <FieldRow label="Letter Type">
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} style={INPUT_STYLE}>
                    <option value="support">Letter of Support</option>
                    <option value="collaboration">Collaboration Letter</option>
                    <option value="institutional">Institutional Letter</option>
                  </select>
                </FieldRow>
                <FieldRow label="Status">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} style={INPUT_STYLE}>
                    <option value="pending">Pending</option>
                    <option value="requested">Requested</option>
                    <option value="received">Received</option>
                    <option value="uploaded">Uploaded</option>
                  </select>
                </FieldRow>
                <FieldRow label="Date Requested"><input type="date" value={form.requestedDate || ''} onChange={e => setForm(f => ({ ...f, requestedDate: e.target.value }))} style={INPUT_STYLE} /></FieldRow>
                <FieldRow label="Date Received"><input type="date" value={form.receivedDate || ''} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} style={INPUT_STYLE} /></FieldRow>
              </div>
              <FieldRow label="Notes"><textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...TEXTAREA_STYLE, minHeight: 60, marginTop: 12 }} /></FieldRow>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={save} style={{ padding: '8px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Save</button>
                <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </Card>
          )}

          {/* Letters list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>Letter Requests</h3>
            <button onClick={() => setShowAdd(true)} style={{ padding: '7px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add Letter</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {letters.map(l => (
              <Card key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{l.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.title} · {l.institution}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: LETTER_STATUS_COLORS[l.status].bg, color: LETTER_STATUS_COLORS[l.status].color }}>
                      {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>{l.type}</span>
                  </div>
                  {l.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{l.notes}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Requested: {l.requestedDate || '—'}{l.receivedDate ? `  ·  Received: ${l.receivedDate}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <select value={l.status} onChange={e => setLetters(ls => ls.map(x => x.id === l.id ? { ...x, status: e.target.value as any } : x))} style={{ ...INPUT_STYLE, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
                    <option value="pending">Pending</option>
                    <option value="requested">Requested</option>
                    <option value="received">Received</option>
                    <option value="uploaded">Uploaded</option>
                  </select>
                  <button onClick={() => setTemplate(l)} style={{ padding: '5px 10px', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>📝 Template</button>
                  <button onClick={() => setLetters(ls => ls.filter(x => x.id !== l.id))} style={{ padding: '5px 8px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TEMPLATES LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATES_LIBRARY = [
  {
    id: 'r01-aims', grantType: 'NIH R01', section: 'Specific Aims', disease: 'Cancer',
    label: 'R01 Specific Aims — Cancer Biology',
    preview: 'Standard 3-aim structure for cancer mechanism grants',
    content: `Specific Aim 1: Elucidate the molecular mechanisms by which [TARGET] drives [DISEASE] progression.
Working hypothesis: [TARGET] promotes [PATHWAY] activation through direct interaction with [EFFECTOR], leading to enhanced tumor cell [PHENOTYPE].
Approach: We will employ CRISPR-Cas9 genome editing, co-immunoprecipitation, proximity ligation assays, and live-cell imaging in ≥3 validated [DISEASE] model systems.

Specific Aim 2: Evaluate the therapeutic potential of [TARGET] inhibition in preclinical models.
Working hypothesis: Pharmacological inhibition of [TARGET] will reduce tumor burden by ≥50% in orthotopic mouse models without dose-limiting toxicity.
Approach: We will test lead compounds (IND-ready) and genetic inhibition (siRNA, shRNA) in patient-derived xenograft (PDX) and syngeneic models. Endpoints: tumor volume, survival, biomarker pharmacodynamics.

Specific Aim 3: Identify and validate a predictive biomarker panel enabling precision therapeutic targeting.
Working hypothesis: A 5-gene expression signature, identified through cross-cohort transcriptomic analysis, will predict response to [TARGET] inhibition with AUC ≥0.85.
Approach: Retrospective analysis of TCGA + institutional cohorts (n>500), prospective validation in a 100-patient biomarker trial, and development of a CLIA-certified clinical assay.`,
  },
  {
    id: 'r01-significance', grantType: 'NIH R01', section: 'Significance', disease: 'Cancer',
    label: 'R01 Significance — General Cancer',
    preview: 'High-impact significance section with disease burden and knowledge gaps',
    content: `SIGNIFICANCE

Disease Burden and Unmet Need
[DISEASE] affects approximately [INCIDENCE] patients annually in the United States, with a 5-year survival rate of [RATE]%, representing one of oncology's most pressing clinical challenges. Despite [EXISTING_TREATMENT] having improved outcomes, [RESISTANCE/LIMITATION] remains a critical barrier, with [X]% of patients developing [RESISTANCE/RECURRENCE] within [TIMEFRAME].

Critical Knowledge Gap
Extensive research has implicated [PATHWAY/TARGET] in [DISEASE] pathogenesis; however, the precise molecular mechanisms governing [SPECIFIC_PROCESS] remain poorly defined. Key questions remain unanswered: (1) How does [TARGET] regulate [DOWNSTREAM_EFFECT] in the context of the [DISEASE] tumor microenvironment? (2) What molecular determinants predict response to [TARGET]-directed therapy? (3) Can combinatorial targeting overcome [RESISTANCE_MECHANISM]?

Scientific Premise and Innovation
Convergent evidence from our preliminary studies and the published literature strongly supports [TARGET] as a high-priority therapeutic vulnerability in [DISEASE]. Critically, no prior study has examined [SPECIFIC_NOVEL_ANGLE], representing a fundamental gap that this proposal directly addresses.

Impact
Successful completion of this project will (1) establish the mechanistic basis for [TARGET]-directed therapy in [DISEASE], (2) provide immediately actionable clinical tools including a validated biomarker panel, and (3) generate a comprehensive mechanistic framework that will catalyze the field.`,
  },
  {
    id: 'r21-aims', grantType: 'NIH R21', section: 'Specific Aims', disease: 'General',
    label: 'R21 Specific Aims — Exploratory Research',
    preview: '2-aim exploratory/developmental structure',
    content: `SPECIFIC AIMS

Despite significant progress in understanding [RESEARCH AREA], critical mechanistic questions remain unresolved. [TARGET/PATHWAY] has emerged as a promising but insufficiently characterized determinant of [OUTCOME]. We have generated compelling preliminary evidence demonstrating [KEY FINDING], leading us to propose the following central hypothesis: [CENTRAL HYPOTHESIS].

Specific Aim 1: Establish the mechanistic link between [VARIABLE A] and [OUTCOME] using [MODEL SYSTEM].
This aim will test the hypothesis that [SPECIFIC HYPOTHESIS 1]. Using [EXPERIMENTAL APPROACH], we will [SPECIFIC EXPERIMENTS]. Expected outcome: [MEASURABLE RESULT].

Specific Aim 2: Determine whether [INTERVENTION] modulates [OUTCOME] in a [DISEASE-RELEVANT MODEL].
Building on Aim 1, we will test whether [SPECIFIC HYPOTHESIS 2]. We will [EXPERIMENTAL APPROACH] and measure [ENDPOINTS]. Expected outcome: [MEASURABLE RESULT, quantified].

Completion of these aims will establish the feasibility of [LARGER PROJECT], generate critical preliminary data for an R01 application, and provide mechanistic insights that advance [FIELD].`,
  },
  {
    id: 'k99-career', grantType: 'NIH K99/R00', section: 'Career Development',
    label: 'K99/R00 Career Development Plan',
    preview: 'Pathway to Independence mentored training plan',
    content: `CAREER DEVELOPMENT PLAN

Overview
The K99 phase (Years 1-2) will provide intensive mentored training in [SKILLS TO ACQUIRE] under the guidance of [MENTOR NAME] at [INSTITUTION], equipping me with the expertise and independence required to establish a successful research program at [TARGET INSTITUTION TYPE].

Training Objectives (K99 Phase)
1. Technical Training: Achieve mastery of [SPECIFIC TECHNIQUES] through direct hands-on training, formal coursework, and supervised independent implementation. Target: Independent execution of [TECHNIQUE] within 6 months.
2. Conceptual/Intellectual Development: Expand expertise from [CURRENT EXPERTISE] to [TARGET EXPERTISE] through seminars, journal clubs, and focused reading programs.
3. Grantsmanship: Develop grant writing skills through preparation of this application, an R01 outline, and participation in [MENTOR'S] weekly grant preparation sessions.
4. Leadership and Mentorship: Mentor [1-2] junior lab members and develop formal training materials.

R00 Phase (Years 3-5)
Upon appointment as an independent PI, I will establish a research program focused on [RESEARCH PROGRAM]. Year 3 priorities: Recruit 1 graduate student and 1 postdoc; establish core assays; submit first independent R01. Years 4-5: Complete Aims 1-2; submit 3 primary manuscripts; compete for R01 funding.`,
  },
  {
    id: 'nsf-broader', grantType: 'NSF CAREER', section: 'Broader Impacts', disease: '',
    label: 'NSF CAREER Broader Impacts',
    preview: 'Education and outreach plan for NSF CAREER award',
    content: `BROADER IMPACTS

This NSF CAREER project integrates research and education through four complementary initiatives designed to broaden participation in [SCIENCE FIELD] and advance STEM education at multiple levels.

1. Undergraduate Research Integration
We will host [N] undergraduate researchers annually through [INSTITUTION]'s REU program, with targeted recruitment from [MINORITY-SERVING INSTITUTIONS]. Students will contribute meaningfully to Aims 1 and 2 and receive training in scientific communication. Anticipated outcomes: ≥[N] undergraduate co-authored publications over the award period.

2. K-12 STEM Outreach
In partnership with [PARTNER SCHOOL/ORGANIZATION], we will develop [CURRICULUM MODULE] aligned with NGSS standards and deliver it to [N] students/year in [TARGET POPULATION, e.g., underserved urban schools]. Materials will be made freely available via [REPOSITORY].

3. Community College Bridge Program
An annual two-week immersive research experience for [N] community college students will provide authentic research training and facilitate transfer to four-year STEM programs.

4. Public Engagement and Data Dissemination
All data, protocols, and computational tools generated will be deposited in [PUBLIC REPOSITORY]. Annual public lectures and science café events will communicate research outcomes to non-specialist audiences.`,
  },
  {
    id: 'dod-aims', grantType: 'DOD CDMRP', section: 'Specific Aims', disease: 'Cancer',
    label: 'DOD CDMRP Research Aims',
    preview: 'Department of Defense cancer research program structure',
    content: `RESEARCH AIMS

The proposed research directly addresses the [PROGRAM NAME] FY[YEAR] Program Announcement priority area of [PRIORITY AREA].

Research Aim 1: [TITLE]
Rationale: [WHY THIS AIM IS PRIORITIZED AND CLINICALLY RELEVANT]
Approach: [METHODS]
Milestone: [MEASURABLE DELIVERABLE] by Month [X]
Deliverable: [TANGIBLE OUTPUT — dataset, tool, validated target, etc.]

Research Aim 2: [TITLE]
Rationale: [BUILD ON AIM 1, CLINICAL TRANSLATION RATIONALE]
Approach: [METHODS, INCLUDE PATIENT-RELEVANT MODELS]
Milestone: [MEASURABLE DELIVERABLE] by Month [X]
Deliverable: [TANGIBLE OUTPUT]

Research Aim 3 (Clinical Translation): [TITLE]
Rationale: [PATH TO CLINICAL IMPACT]
Approach: [TRANSLATIONAL STUDIES, PATIENT COHORT, OR CLINICAL CORRELATION]
Milestone: [IND APPLICATION / CLINICAL TRIAL DESIGN / VALIDATED BIOMARKER]
Deliverable: [TANGIBLE OUTPUT]

Impact Statement: Completion of these aims will produce [SPECIFIC DELIVERABLES] that directly address the unmet clinical need in [DISEASE] and establish a clear path toward [CLINICAL ENDPOINT].`,
  },
];

export function TemplatesLibrary({ onBack, onLoadToComposer }: { onBack: () => void; onLoadToComposer?: (section: string, content: string) => void }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [preview, setPreview] = useState<typeof TEMPLATES_LIBRARY[0] | null>(null);

  const types = ['All', ...Array.from(new Set(TEMPLATES_LIBRARY.map(t => t.grantType)))];
  const filtered = TEMPLATES_LIBRARY.filter(t =>
    (filterType === 'All' || t.grantType === filterType) &&
    (t.label.toLowerCase().includes(search.toLowerCase()) || t.preview.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <SectionHeader title="📄 Templates Library" subtitle="Pre-built grant section templates — click to load into composer" onBack={onBack} />

      {preview ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>{preview.label}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{preview.grantType} · {preview.section}</p>
            </div>
            <button onClick={() => setPreview(null)} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>← Back</button>
          </div>
          <Card style={{ marginBottom: 16 }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>{preview.content}</pre>
          </Card>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => navigator.clipboard.writeText(preview.content)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>📋 Copy</button>
            <button onClick={() => downloadTxt(preview.content, `template_${preview.id}.txt`)} style={{ padding: '8px 16px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>⬇ .txt</button>
            {onLoadToComposer && (
              <button onClick={() => { onLoadToComposer(preview.section, preview.content); onBack(); }} style={{ padding: '8px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                📝 Load into Composer
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: 280 }} placeholder="🔍 Search templates…" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...INPUT_STYLE, width: 'auto' }}>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{filtered.length} template{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(t => (
              <div key={t.id} className="card" style={{ cursor: 'pointer', border: '1px solid var(--border)', transition: 'border-color 0.15s' }} onClick={() => setPreview(t)}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ padding: '4px 10px', background: 'rgba(0,113,188,0.1)', borderRadius: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.grantType}</div>
                  <div style={{ padding: '4px 10px', background: 'rgba(107,114,128,0.12)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.section}</div>
                </div>
                <h4 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: '12px 0 6px' }}>{t.label}</h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t.preview}</p>
                <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); setPreview(t); }} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>Preview</button>
                  {onLoadToComposer && <button onClick={e => { e.stopPropagation(); onLoadToComposer(t.section, t.content); onBack(); }} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Load →</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. COLLABORATORS
// ═══════════════════════════════════════════════════════════════════════════════

interface Collaborator {
  id: string; name: string; title: string; institution: string; email: string; phone: string;
  role: 'Co-Investigator' | 'Collaborator' | 'Consultant' | 'Subcontract PI' | 'MPI' | 'Advisor';
  department: string; expertise: string; contribution: string; budget: number; status: 'active' | 'inactive' | 'pending';
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  'Co-Investigator': { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
  'MPI': { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  'Collaborator': { bg: 'rgba(0,113,188,0.15)', color: '#60a5fa' },
  'Consultant': { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  'Subcontract PI': { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  'Advisor': { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
};

export function CollaboratorsManager({ onBack }: { onBack: () => void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    { id: '1', name: 'Dr. Lisa Zhang', title: 'Professor', institution: 'Stanford University', email: 'l.zhang@stanford.edu', phone: '', role: 'Co-Investigator', department: 'Genetics', expertise: 'CRISPR, functional genomics', contribution: 'Leads Aim 2 CRISPR screens', budget: 75000, status: 'active' },
    { id: '2', name: 'Dr. James Okafor', title: 'Associate Professor', institution: 'Weill Cornell Medicine', email: 'j.okafor@weill.cornell.edu', phone: '', role: 'Collaborator', department: 'Biostatistics', expertise: 'Clinical trial design, biomarker analysis', contribution: 'Statistical analysis and trial design for Aim 3', budget: 30000, status: 'active' },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Collaborator>>({ role: 'Collaborator', status: 'active', budget: 0 });
  const [letterTarget, setLetterTarget] = useState<Collaborator | null>(null);
  const [grantTitle, setGrantTitle] = useState('');
  const [search, setSearch] = useState('');

  const save = () => {
    if (!form.name?.trim()) return;
    setCollaborators(c => [...c, { id: String(Date.now()), name: form.name || '', title: form.title || '', institution: form.institution || '', email: form.email || '', phone: form.phone || '', role: form.role || 'Collaborator', department: form.department || '', expertise: form.expertise || '', contribution: form.contribution || '', budget: form.budget || 0, status: form.status || 'active' }]);
    setForm({ role: 'Collaborator', status: 'active', budget: 0 });
    setShowAdd(false);
  };

  const collabLetter = (c: Collaborator) => `[Date]

${c.title} ${c.name}
${c.department ? c.department + '\n' : ''}${c.institution}
Email: ${c.email}

Dear Dr. ${c.name.split(' ').pop() || 'Colleague'},

I am writing to formally document my collaboration on the grant application titled "${grantTitle || '[GRANT TITLE]'}" submitted by [PI Name] to [FUNDING AGENCY].

As a ${c.role} on this project, I will contribute the following specific expertise and resources: ${c.contribution || '[describe your specific contribution, resources, and unique expertise]'}.

My laboratory at ${c.institution} has extensive experience in ${c.expertise || '[your relevant expertise]'}, which is essential for the successful completion of the proposed research aims.

I am committed to the following specific contributions:
• Scientific: [specific scientific responsibilities]
• Resources: [specific resources, equipment, or data access you will provide]
• Personnel: [any personnel from your lab who will contribute]
• Timeline: [approximate time commitment, e.g., monthly calls, quarterly site visits]

I am fully committed to this collaboration and agree to the terms outlined in the collaboration agreement. I have reviewed the proposed research and am confident that [PI Name]'s team has the expertise and resources to execute this work successfully.

Sincerely,

${c.name}
${c.title}
${c.department ? c.department + '\n' : ''}${c.institution}
${c.email}`;

  const filtered = collaborators.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.institution.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase()));
  const totalBudget = collaborators.filter(c => c.status === 'active').reduce((s, c) => s + c.budget, 0);

  return (
    <div>
      <SectionHeader title="🤝 Collaborators" subtitle="Manage your collaborator network, roles, and generate collaboration letters" onBack={onBack} />

      {letterTarget ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>Collaboration Letter — {letterTarget.name}</h3>
            <button onClick={() => setLetterTarget(null)} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>← Back</button>
          </div>
          <Card style={{ marginBottom: 14 }}>
            <FieldRow label="Grant Title (for letter)"><input value={grantTitle} onChange={e => setGrantTitle(e.target.value)} style={INPUT_STYLE} placeholder="Enter full grant title" /></FieldRow>
          </Card>
          <Card>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>{collabLetter(letterTarget)}</pre>
          </Card>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={() => navigator.clipboard.writeText(collabLetter(letterTarget))} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>📋 Copy</button>
            <button onClick={() => downloadTxt(collabLetter(letterTarget), `collab_letter_${letterTarget.name.replace(/\s/g, '_')}.txt`)} style={{ padding: '8px 16px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>⬇ Download</button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[['Total', collaborators.length, 'var(--text)'], ['Active', collaborators.filter(c => c.status === 'active').length, '#4ade80'], ['Pending', collaborators.filter(c => c.status === 'pending').length, '#fbbf24'], ['Budget', '$' + totalBudget.toLocaleString(), '#818cf8']].map(([l, v, c]) => (
              <Card key={l as string} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{l as string}</div>
              </Card>
            ))}
          </div>

          {/* Add form */}
          {showAdd && (
            <Card style={{ marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Add Collaborator</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <FieldRow label="Full Name"><input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT_STYLE} placeholder="Dr. First Last" /></FieldRow>
                <FieldRow label="Title"><input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={INPUT_STYLE} placeholder="Professor" /></FieldRow>
                <FieldRow label="Institution"><input value={form.institution || ''} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} style={INPUT_STYLE} /></FieldRow>
                <FieldRow label="Department"><input value={form.department || ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={INPUT_STYLE} /></FieldRow>
                <FieldRow label="Email"><input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={INPUT_STYLE} /></FieldRow>
                <FieldRow label="Role">
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))} style={INPUT_STYLE}>
                    {Object.keys(ROLE_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Status">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} style={INPUT_STYLE}>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FieldRow>
                <FieldRow label="Budget ($)"><input type="number" value={form.budget || 0} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} style={INPUT_STYLE} /></FieldRow>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FieldRow label="Expertise"><input value={form.expertise || ''} onChange={e => setForm(f => ({ ...f, expertise: e.target.value }))} style={INPUT_STYLE} placeholder="e.g. CRISPR, biostatistics" /></FieldRow>
                <FieldRow label="Contribution to Grant"><input value={form.contribution || ''} onChange={e => setForm(f => ({ ...f, contribution: e.target.value }))} style={INPUT_STYLE} placeholder="Brief description of role" /></FieldRow>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={save} style={{ padding: '8px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Save</button>
                <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </Card>
          )}

          {/* List */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: 260 }} placeholder="🔍 Search collaborators…" />
            <button onClick={() => setShowAdd(true)} style={{ padding: '7px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add Collaborator</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filtered.map(c => (
              <Card key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.title} · {c.institution}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: ROLE_COLORS[c.role]?.bg, color: ROLE_COLORS[c.role]?.color, whiteSpace: 'nowrap' }}>{c.role}</span>
                </div>
                {c.expertise && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🔬 {c.expertise}</div>}
                {c.contribution && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>📋 {c.contribution}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.budget > 0 && <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>💰 ${c.budget.toLocaleString()}</span>}
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: c.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: c.status === 'active' ? '#4ade80' : '#9ca3af' }}>{c.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => setLetterTarget(c)} style={{ padding: '4px 9px', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, background: 'rgba(99,102,241,0.08)', color: '#818cf8', cursor: 'pointer', fontSize: 11 }}>📝 Letter</button>
                    {c.email && <a href={`mailto:${c.email}`} style={{ padding: '4px 9px', border: '1px solid var(--border)', borderRadius: 5, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, textDecoration: 'none' }}>✉️</a>}
                    <button onClick={() => setCollaborators(cs => cs.filter(x => x.id !== c.id))} style={{ padding: '4px 8px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {collaborators.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => {
                let txt = `COLLABORATORS NETWORK\n${'='.repeat(60)}\n\n`;
                collaborators.forEach(c => { txt += `${c.name} (${c.role})\n${c.title} | ${c.institution}\nEmail: ${c.email}\nExpertise: ${c.expertise}\nContribution: ${c.contribution}\nBudget: $${c.budget.toLocaleString()}\n\n`; });
                txt += `Total Active Budget: $${totalBudget.toLocaleString()}`;
                downloadTxt(txt, 'collaborators.txt');
              }} style={{ padding: '8px 18px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇ Export All</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
