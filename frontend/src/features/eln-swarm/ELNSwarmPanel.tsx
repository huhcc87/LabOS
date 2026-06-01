// ═══════════════════════════════════════════════════════════════════════════
// ELN SWARM PANEL — AI Review panel for experiment entries
// Displays inside the experiment detail view
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import type { UseELNSwarmReturn, ELNSwarmTab } from './useELNSwarm'
import type { EntryContext } from './elnSwarmEngine'
import type { ELNAgentOutput, ELNConsensus, ManuscriptSection, GrantSection, ELNSwarmMessage, ExperimentGeneratorInput } from './elnSwarmTypes'
import { ELN_AGENT_DEFINITIONS } from './elnSwarmTypes'

interface Props {
  swarm: UseELNSwarmReturn
  entry: EntryContext
}

export default function ELNSwarmPanel({ swarm, entry }: Props) {
  const TABS: { id: ELNSwarmTab; label: string; icon: string }[] = [
    { id: 'review', label: 'AI Review', icon: '🧬' },
    { id: 'suggestions', label: 'Smart Tips', icon: '💡' },
    { id: 'manuscript', label: 'Manuscript', icon: '📄' },
    { id: 'grant', label: 'Grant', icon: '💰' },
    { id: 'generator', label: 'Generate', icon: '✨' },
    { id: 'chat', label: 'Chat', icon: '💬' },
  ]

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧬</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>AI Swarm Intelligence</span>
        </div>
        {!swarm.review && !swarm.isReviewing && (
          <button onClick={() => swarm.runReview(entry)} style={{
            padding: '6px 14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            🚀 Run AI Review
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', padding: '0 8px', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => swarm.setSwarmTab(tab.id)} style={{
            padding: '8px 10px', border: 'none',
            borderBottom: swarm.swarmTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', color: swarm.swarmTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 11, fontWeight: swarm.swarmTab === tab.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          }}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {swarm.swarmTab === 'review' && <ReviewTab swarm={swarm} entry={entry} />}
        {swarm.swarmTab === 'suggestions' && <SuggestionsTab swarm={swarm} entry={entry} />}
        {swarm.swarmTab === 'manuscript' && <ManuscriptTab swarm={swarm} entry={entry} />}
        {swarm.swarmTab === 'grant' && <GrantTab swarm={swarm} entry={entry} />}
        {swarm.swarmTab === 'generator' && <GeneratorTab swarm={swarm} />}
        {swarm.swarmTab === 'chat' && <ChatTab swarm={swarm} entry={entry} />}
      </div>
    </div>
  )
}

// ── Review Tab ───────────────────────────────────────────────────────────
function ReviewTab({ swarm, entry }: { swarm: UseELNSwarmReturn; entry: EntryContext }) {
  const [activeAgent, setActiveAgent] = useState<string | null>(null)

  // Running state
  if (swarm.isReviewing) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🧬</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>AI Swarm Review in Progress</div>
        <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${swarm.progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{swarm.progress}% — {swarm.currentAgent || 'Initializing...'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 12 }}>
          {ELN_AGENT_DEFINITIONS.map(a => {
            const done = swarm.review?.agents.some(o => o.agentId === a.id)
            const active = swarm.currentAgent === a.name
            return (
              <div key={a.id} style={{ padding: '6px 4px', borderRadius: 6, border: `1px solid ${active ? a.color : done ? '#10b981' : 'var(--border)'}`, opacity: done || active ? 1 : 0.4, textAlign: 'center' }}>
                <div style={{ fontSize: 14 }}>{a.icon}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{done ? '✓' : active ? '⚡' : '...'}</div>
              </div>
            )
          })}
        </div>
        <button onClick={swarm.cancelReview} style={{ marginTop: 12, padding: '6px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
      </div>
    )
  }

  // No review yet
  if (!swarm.review) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🧬</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>8 specialized AI agents will analyze your experiment for scientific rigor, compliance, safety, statistics, literature support, reproducibility, optimization, and historical context.</div>
        <button onClick={() => swarm.runReview(entry)} style={{
          padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          🚀 Launch 8-Agent Review
        </button>
      </div>
    )
  }

  // Review complete
  const c = swarm.review.consensus
  const activeOutput = activeAgent ? swarm.review.agents.find(a => a.agentId === activeAgent) : null

  return (
    <div style={{ padding: 12 }}>
      {/* Score cards */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { label: 'Overall', value: c.overallScore, color: '#6366f1' },
          { label: 'Scientific', value: c.scientificScore, color: '#10b981' },
          { label: 'Compliance', value: c.complianceScore, color: '#f59e0b' },
          { label: 'Safety', value: c.safetyScore, color: '#ef4444' },
          { label: 'Reproducibility', value: c.reproducibilityScore, color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} style={{ flex: '1 1 60px', textAlign: 'center', padding: '8px 4px', background: 'var(--surface2)', borderRadius: 8, minWidth: 60 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.value >= 80 ? '#10b981' : s.value >= 60 ? '#f59e0b' : '#ef4444' }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Risk badge */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{
          padding: '4px 12px', borderRadius: 12, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          background: c.riskLevel === 'low' ? '#10b98115' : c.riskLevel === 'medium' ? '#f59e0b15' : '#ef444415',
          color: c.riskLevel === 'low' ? '#10b981' : c.riskLevel === 'medium' ? '#f59e0b' : '#ef4444',
        }}>
          Risk: {c.riskLevel}
        </span>
      </div>

      {/* Agent list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {swarm.review.agents.map(output => (
          <button key={output.agentId} onClick={() => setActiveAgent(activeAgent === output.agentId ? null : output.agentId)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', width: '100%',
            background: activeAgent === output.agentId ? 'var(--accent-light, rgba(99,102,241,0.1))' : 'transparent',
            border: `1px solid ${activeAgent === output.agentId ? output.color : 'var(--border)'}`,
            borderRadius: 8, cursor: 'pointer', textAlign: 'left', borderLeft: `3px solid ${output.color}`,
          }}>
            <span style={{ fontSize: 14 }}>{output.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{output.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{output.summary}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: output.scores[0]?.value >= 80 ? '#10b981' : output.scores[0]?.value >= 60 ? '#f59e0b' : '#ef4444' }}>
              {output.scores[0]?.value || '—'}
            </div>
          </button>
        ))}
      </div>

      {/* Agent detail */}
      {activeOutput && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${activeOutput.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>{activeOutput.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{activeOutput.title}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 8 }}>{activeOutput.summary}</p>

          {activeOutput.warnings.length > 0 && (
            <div style={{ padding: '6px 10px', background: '#f59e0b10', borderRadius: 6, marginBottom: 8 }}>
              {activeOutput.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11, color: '#f59e0b', display: 'flex', gap: 4 }}>
                  <span>⚠️</span><span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {activeOutput.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{s.heading}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.content}</div>
              {s.items && s.items.map((item, j) => (
                <div key={j} style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 12, position: 'relative', marginTop: 2 }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>›</span>{item}
                </div>
              ))}
            </div>
          ))}

          {activeOutput.recommendations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>💡 Recommendations</div>
              {activeOutput.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text)', paddingLeft: 12, marginTop: 2 }}>
                  {i + 1}. {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top findings */}
      {c.topFindings.length > 0 && !activeAgent && (
        <div style={{ marginTop: 12, padding: 10, background: 'var(--surface2)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>💡 Key Findings</div>
          {c.topFindings.slice(0, 4).map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text)', marginTop: 3 }}>{i + 1}. {f}</div>
          ))}
        </div>
      )}

      {/* Re-run */}
      <button onClick={() => swarm.runReview(entry)} style={{
        marginTop: 12, width: '100%', padding: '8px', background: 'var(--surface2)',
        border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)',
        cursor: 'pointer', fontSize: 11, fontWeight: 500,
      }}>
        🔄 Re-run Analysis
      </button>
    </div>
  )
}

// ── Suggestions Tab ──────────────────────────────────────────────────────
function SuggestionsTab({ swarm, entry }: { swarm: UseELNSwarmReturn; entry: EntryContext }) {
  useEffect(() => {
    if (entry.template) swarm.loadSuggestions(entry.template)
  }, [entry.template])

  if (!swarm.suggestions || swarm.suggestions.suggestions.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        No smart suggestions available for this template.
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>💡 Smart Suggestions for {entry.template.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
      {swarm.suggestions.suggestions.map((sg, i) => (
        <div key={i} style={{ marginBottom: 12, padding: 10, background: 'var(--surface2)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>{sg.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{sg.category}</span>
          </div>
          {sg.items.map((item, j) => (
            <div key={j} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: j < sg.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', minWidth: 120 }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.detail}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Manuscript Tab ───────────────────────────────────────────────────────
function ManuscriptTab({ swarm, entry }: { swarm: UseELNSwarmReturn; entry: EntryContext }) {
  const [generating, setGenerating] = useState(false)

  const sections: { type: ManuscriptSection['type']; label: string; icon: string }[] = [
    { type: 'methods', label: 'Methods Section', icon: '🔬' },
    { type: 'results', label: 'Results Section', icon: '📊' },
    { type: 'figure-legend', label: 'Figure Legend', icon: '🖼️' },
    { type: 'supplementary', label: 'Supplementary Methods', icon: '📎' },
    { type: 'materials', label: 'Materials List', icon: '🧪' },
  ]

  const handleGenerate = async (type: ManuscriptSection['type']) => {
    setGenerating(true)
    try { await swarm.genManuscript(entry, type) } finally { setGenerating(false) }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>📄 Generate Manuscript Sections</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {sections.map(s => (
          <button key={s.type} onClick={() => handleGenerate(s.type)} disabled={generating} style={{
            padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: generating ? 'wait' : 'pointer', fontSize: 11, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      {swarm.manuscriptSection && (
        <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>{swarm.manuscriptSection.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{swarm.manuscriptSection.content}</div>
          <button onClick={() => navigator.clipboard.writeText(swarm.manuscriptSection?.content || '')} style={{
            marginTop: 8, padding: '4px 10px', background: 'var(--accent)', border: 'none',
            borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600,
          }}>
            📋 Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  )
}

// ── Grant Tab ────────────────────────────────────────────────────────────
function GrantTab({ swarm, entry }: { swarm: UseELNSwarmReturn; entry: EntryContext }) {
  const [generating, setGenerating] = useState(false)

  const sections: { type: GrantSection['type']; label: string; icon: string }[] = [
    { type: 'preliminary-data', label: 'Preliminary Data', icon: '📊' },
    { type: 'significance', label: 'Significance', icon: '🎯' },
    { type: 'innovation', label: 'Innovation', icon: '💡' },
    { type: 'strategy', label: 'Research Strategy', icon: '🗺️' },
    { type: 'progress', label: 'Progress Report', icon: '📈' },
  ]

  const handleGenerate = async (type: GrantSection['type']) => {
    setGenerating(true)
    try { await swarm.genGrant(entry, type) } finally { setGenerating(false) }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>💰 Generate Grant Sections</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {sections.map(s => (
          <button key={s.type} onClick={() => handleGenerate(s.type)} disabled={generating} style={{
            padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: generating ? 'wait' : 'pointer', fontSize: 11, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      {swarm.grantSection && (
        <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>{swarm.grantSection.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{swarm.grantSection.content}</div>
          <button onClick={() => navigator.clipboard.writeText(swarm.grantSection?.content || '')} style={{
            marginTop: 8, padding: '4px 10px', background: 'var(--accent)', border: 'none',
            borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600,
          }}>
            📋 Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  )
}

// ── Generator Tab ────────────────────────────────────────────────────────
function GeneratorTab({ swarm }: { swarm: UseELNSwarmReturn }) {
  const [form, setForm] = useState<ExperimentGeneratorInput>({
    researchQuestion: '', gene: '', pathway: '', cellLine: '', disease: '', technique: 'PCR / qPCR',
  })

  const TECHNIQUES = ['PCR / qPCR', 'Western Blot', 'ELISA', 'Cell Culture', 'Flow Cytometry', 'Sequencing', 'CRISPR', 'Microscopy']

  const handleGenerate = () => {
    if (form.researchQuestion.trim()) swarm.generateExp(form)
  }

  if (swarm.generatedExperiment) {
    const exp = swarm.generatedExperiment
    return (
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>✨ Generated Experiment</div>
          <button onClick={() => { swarm.resetSwarm() }} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>New</button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>{exp.title}</div>

        {[
          { label: 'Hypothesis', content: exp.hypothesis, icon: '🎯' },
          { label: 'Experimental Design', content: exp.experimentalDesign, icon: '🔬' },
          { label: 'Replicates', content: exp.replicates, icon: '🔢' },
          { label: 'Expected Results', content: exp.expectedResults, icon: '📊' },
          { label: 'Statistical Plan', content: exp.statisticalPlan, icon: '📈' },
          { label: 'Estimated Time', content: exp.estimatedTime, icon: '⏱️' },
          { label: 'Biosafety', content: exp.biosafetyConsiderations, icon: '☣️' },
        ].map((s, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span>{s.icon}</span>{s.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 2 }}>{s.content}</div>
          </div>
        ))}

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>🧬 Controls</div>
          <div style={{ fontSize: 11, color: '#10b981' }}>Positive: {exp.controls.positive.join('; ')}</div>
          <div style={{ fontSize: 11, color: '#ef4444' }}>Negative: {exp.controls.negative.join('; ')}</div>
          <div style={{ fontSize: 11, color: '#6366f1' }}>Internal: {exp.controls.internal.join('; ')}</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>⚠️ Potential Pitfalls</div>
          {exp.potentialPitfalls.map((p, i) => (
            <div key={i} style={{ fontSize: 11, color: '#f59e0b', paddingLeft: 12, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0 }}>•</span>{p}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>✨ AI Experiment Generator</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input placeholder="Research question *" value={form.researchQuestion} onChange={e => setForm(p => ({ ...p, researchQuestion: e.target.value }))} style={inp} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input placeholder="Gene (e.g. KRAS)" value={form.gene} onChange={e => setForm(p => ({ ...p, gene: e.target.value }))} style={inp} />
          <input placeholder="Pathway" value={form.pathway} onChange={e => setForm(p => ({ ...p, pathway: e.target.value }))} style={inp} />
          <input placeholder="Cell line" value={form.cellLine} onChange={e => setForm(p => ({ ...p, cellLine: e.target.value }))} style={inp} />
          <input placeholder="Disease" value={form.disease} onChange={e => setForm(p => ({ ...p, disease: e.target.value }))} style={inp} />
        </div>
        <select value={form.technique} onChange={e => setForm(p => ({ ...p, technique: e.target.value }))} style={inp}>
          {TECHNIQUES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={handleGenerate} disabled={!form.researchQuestion.trim() || swarm.isGenerating} style={{
          padding: '10px', background: form.researchQuestion.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--surface2)',
          border: 'none', borderRadius: 8, color: form.researchQuestion.trim() ? '#fff' : 'var(--text-muted)',
          cursor: form.researchQuestion.trim() ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600,
        }}>
          {swarm.isGenerating ? '⏳ Generating...' : '✨ Generate Experiment'}
        </button>
      </div>
    </div>
  )
}

// ── Chat Tab ─────────────────────────────────────────────────────────────
function ChatTab({ swarm, entry }: { swarm: UseELNSwarmReturn; entry: EntryContext }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [swarm.chatMessages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    try { await swarm.sendChat(content, { entryTitle: entry.title, template: entry.template }) }
    finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {swarm.chatMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 11 }}>
            Ask the AI swarm about your experiment — controls, statistics, safety, troubleshooting, literature, or manuscript writing.
          </div>
        )}
        {swarm.chatMessages.map(msg => {
          const isUser = msg.role === 'user'
          const agent = msg.agentId ? ELN_AGENT_DEFINITIONS.find(a => a.id === msg.agentId) : null
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isUser ? 'var(--accent)' : (agent?.color || '#6366f1') + '20', fontSize: 12, flexShrink: 0 }}>
                {isUser ? '👤' : agent?.icon || '🧬'}
              </div>
              <div style={{ maxWidth: '80%', padding: '8px 12px', background: isUser ? 'var(--accent)' : 'var(--surface2)', borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px', border: isUser ? 'none' : '1px solid var(--border)' }}>
                {!isUser && agent && <div style={{ fontSize: 9, fontWeight: 600, color: agent.color, marginBottom: 2 }}>{agent.name}</div>}
                <div style={{ fontSize: 11, color: isUser ? '#fff' : 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          )
        })}
        {sending && <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px' }}>Agents thinking...</div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask about your experiment..." style={{ ...inp, flex: 1 }} />
        <button onClick={handleSend} disabled={!input.trim() || sending} style={{
          padding: '6px 14px', background: input.trim() ? 'var(--accent)' : 'var(--surface2)',
          border: 'none', borderRadius: 6, color: input.trim() ? '#fff' : 'var(--text-muted)',
          cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 600,
        }}>Send</button>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text)', fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
