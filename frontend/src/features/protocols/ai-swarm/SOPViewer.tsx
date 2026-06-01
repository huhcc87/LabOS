// ═══════════════════════════════════════════════════════════════════════════
// SOP VIEWER — Full generated SOP document viewer with sections
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import type { GeneratedSOP, SOPStep, SOPCheckpoint, SOPTroubleshooting, SOPRiskItem } from './swarmTypes'

interface Props {
  sop: GeneratedSOP
}

type SOPTab = 'procedure' | 'materials' | 'safety' | 'qc' | 'troubleshooting' | 'training'

export default function SOPViewer({ sop }: Props) {
  const [activeTab, setActiveTab] = useState<SOPTab>('procedure')

  const TABS: { id: SOPTab; label: string; icon: string }[] = [
    { id: 'procedure', label: 'Procedure', icon: '📋' },
    { id: 'materials', label: 'Materials & Reagents', icon: '🧪' },
    { id: 'safety', label: 'Safety & Risk', icon: '☣️' },
    { id: 'qc', label: 'QC Checkpoints', icon: '✅' },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔧' },
    { id: 'training', label: 'Training', icon: '🎓' },
  ]

  return (
    <div>
      {/* SOP Header */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Generated Standard Operating Procedure
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Purpose: {sop.purpose}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Scope: {sop.scope}
        </div>
        {sop.responsibilities.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sop.responsibilities.map((r, i) => (
              <span key={i} style={{
                padding: '3px 10px', background: 'var(--surface2)', borderRadius: 12,
                fontSize: 11, color: 'var(--text)',
              }}>{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* SOP Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 12px', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'procedure' && <ProcedureTab steps={sop.procedure} expectedResults={sop.expectedResults} />}
      {activeTab === 'materials' && <MaterialsTab sop={sop} />}
      {activeTab === 'safety' && <SafetyTab sop={sop} />}
      {activeTab === 'qc' && <QCTab checkpoints={sop.qcCheckpoints} />}
      {activeTab === 'troubleshooting' && <TroubleshootingTab items={sop.troubleshooting} />}
      {activeTab === 'training' && <TrainingTab sop={sop} />}
    </div>
  )
}

// ── Procedure Tab ────────────────────────────────────────────────────────
function ProcedureTab({ steps, expectedResults }: { steps: SOPStep[]; expectedResults: string }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set(steps.map(s => s.number)))
  const toggleStep = (n: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map(step => (
          <div key={step.number} style={{
            background: 'var(--surface)', border: `1px solid ${step.qcPoint ? '#f59e0b40' : 'var(--border)'}`,
            borderRadius: 10, overflow: 'hidden',
            borderLeft: step.qcPoint ? '3px solid #f59e0b' : '3px solid var(--accent)',
          }}>
            <button onClick={() => toggleStep(step.number)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '12px 16px', background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step.qcPoint ? '#f59e0b' : 'var(--accent)', color: '#fff',
                borderRadius: '50%', fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>{step.number}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{step.title}</span>
              {step.duration && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {step.duration}</span>}
              {step.qcPoint && <span style={{ fontSize: 10, background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>QC</span>}
            </button>

            {expandedSteps.has(step.number) && (
              <div style={{ padding: '0 16px 14px 54px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                  {step.instruction}
                </p>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                  {step.temperature && <span>🌡️ {step.temperature}</span>}
                  {step.duration && <span>⏱️ {step.duration}</span>}
                </div>

                {step.criticalParams && step.criticalParams.length > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: '#ef444410', borderRadius: 6, border: '1px solid #ef444420' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444' }}>Critical Parameters: </span>
                    <span style={{ fontSize: 11, color: 'var(--text)' }}>{step.criticalParams.join(', ')}</span>
                  </div>
                )}

                {step.safetyNote && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b', display: 'flex', gap: 4 }}>
                    <span>⚠️</span><span>{step.safetyNote}</span>
                  </div>
                )}

                {step.tip && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#10b981', display: 'flex', gap: 4 }}>
                    <span>💡</span><span>{step.tip}</span>
                  </div>
                )}

                {step.expectedOutput && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
                    <span>📊</span><span>Expected: {step.expectedOutput}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {expectedResults && (
        <div style={{ marginTop: 16, padding: 16, background: '#10b98110', border: '1px solid #10b98130', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>📊 Expected Results</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{expectedResults}</div>
        </div>
      )}
    </div>
  )
}

// ── Materials Tab ────────────────────────────────────────────────────────
function MaterialsTab({ sop }: { sop: GeneratedSOP }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Materials */}
      {sop.materials.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            📦 Materials
          </div>
          <div style={{ padding: 0 }}>
            {sop.materials.map((m, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12,
                padding: '10px 16px', borderBottom: i < sop.materials.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{m.name}</div>
                  {m.specification && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.specification}</div>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{m.quantity}</span>
                {m.supplier && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.supplier}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reagents */}
      {sop.reagents.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            🧪 Reagents
          </div>
          <div>
            {sop.reagents.map((r, i) => (
              <div key={i} style={{
                padding: '10px 16px', borderBottom: i < sop.reagents.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{r.name}</div>
                  {r.hazardClass && (
                    <span style={{ fontSize: 10, padding: '2px 8px', background: '#ef444415', color: '#ef4444', borderRadius: 10, fontWeight: 500 }}>
                      {r.hazardClass}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Conc: {r.concentration}</span>
                  <span>Vol: {r.volume}</span>
                  <span>Storage: {r.storage}</span>
                </div>
                {r.alternatives && r.alternatives.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--accent)' }}>
                    Alternatives: {r.alternatives.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment */}
      {sop.equipment.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            ⚙️ Equipment
          </div>
          <div>
            {sop.equipment.map((e, i) => (
              <div key={i} style={{
                padding: '10px 16px', borderBottom: i < sop.equipment.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{e.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.specification}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  {e.calibration && <span>📐 Calibration: {e.calibration}</span>}
                  {e.maintenance && <span>🔧 Maintenance: {e.maintenance}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Safety Tab ───────────────────────────────────────────────────────────
function SafetyTab({ sop }: { sop: GeneratedSOP }) {
  const riskColors: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Risk Assessment */}
      {sop.riskAssessment.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            ⚠️ Risk Assessment
          </div>
          <div>
            {sop.riskAssessment.map((r, i) => (
              <div key={i} style={{
                padding: '12px 16px', borderBottom: i < sop.riskAssessment.length - 1 ? '1px solid var(--border)' : 'none',
                borderLeft: `3px solid ${riskColors[r.risk] || '#6b7280'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{r.hazard}</div>
                  <span style={{
                    fontSize: 10, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
                    background: (riskColors[r.risk] || '#6b7280') + '15',
                    color: riskColors[r.risk] || '#6b7280',
                    textTransform: 'uppercase',
                  }}>{r.risk}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Control: {r.control}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {r.ppe.map((p, j) => (
                    <span key={j} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 8, color: 'var(--text)' }}>{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Notes */}
      {sop.safetyNotes.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>🛡️ Safety Notes</div>
          {sop.safetyNotes.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: '#ef4444' }}>•</span><span>{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Waste Disposal */}
      {sop.wasteDisposal.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>🗑️ Waste Disposal</div>
          {sop.wasteDisposal.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: '#f97316' }}>•</span><span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compliance */}
      {sop.complianceNotes.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>📜 Compliance Notes</div>
          {sop.complianceNotes.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--accent)' }}>•</span><span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── QC Tab ───────────────────────────────────────────────────────────────
function QCTab({ checkpoints }: { checkpoints: SOPCheckpoint[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {checkpoints.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
          No QC checkpoints defined.
        </div>
      ) : checkpoints.map((cp, i) => (
        <div key={i} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '14px 16px', borderLeft: '3px solid #f59e0b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f59e0b', color: '#fff', borderRadius: '50%', fontSize: 10, fontWeight: 700,
            }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Step {cp.step}: {cp.description}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, paddingLeft: 30 }}>
            <strong>Acceptance Criteria:</strong> {cp.acceptanceCriteria}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', paddingLeft: 30 }}>
            <strong>Action if Failed:</strong> {cp.action}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Troubleshooting Tab ──────────────────────────────────────────────────
function TroubleshootingTab({ items }: { items: SOPTroubleshooting[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const toggle = (i: number) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
        }}>
          <button onClick={() => toggle(i)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 16px', background: 'transparent', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 14 }}>🔧</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{item.problem}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{expanded.has(i) ? '▲' : '▼'}</span>
          </button>
          {expanded.has(i) && (
            <div style={{ padding: '0 16px 14px 40px' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f97316', marginBottom: 4 }}>Possible Causes:</div>
                {item.possibleCauses.map((c, j) => (
                  <div key={j} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0', paddingLeft: 12, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#f97316' }}>›</span>{c}
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>Solutions:</div>
                {item.solutions.map((s, j) => (
                  <div key={j} style={{ fontSize: 12, color: 'var(--text)', padding: '2px 0', paddingLeft: 12, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#10b981' }}>›</span>{s}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent)' }}>
                <strong>Prevention:</strong> {item.prevention}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Training Tab ─────────────────────────────────────────────────────────
function TrainingTab({ sop }: { sop: GeneratedSOP }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sop.trainingRequirements.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>🎓 Training Requirements</div>
          {sop.trainingRequirements.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: '#a855f7' }}>•</span><span>{t}</span>
            </div>
          ))}
        </div>
      )}

      {sop.approvalRequirements.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>✍️ Approval Requirements</div>
          {sop.approvalRequirements.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: '#6366f1' }}>•</span><span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {sop.references.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>📚 References</div>
          {sop.references.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: '#14b8a6' }}>[{i + 1}]</span><span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {sop.optimizationNotes.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>⚡ Optimization Notes</div>
          {sop.optimizationNotes.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: '#f97316' }}>•</span><span>{o}</span>
            </div>
          ))}
        </div>
      )}

      {/* Revision History */}
      {sop.revisionHistory.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            📝 Revision History
          </div>
          {sop.revisionHistory.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12,
              padding: '10px 16px', borderBottom: i < sop.revisionHistory.length - 1 ? '1px solid var(--border)' : 'none',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{r.version}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.changes}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.date} · {r.author}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
