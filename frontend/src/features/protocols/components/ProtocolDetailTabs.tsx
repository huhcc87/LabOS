import React, { useState } from 'react'
import type { Protocol, ProtocolStep, ProtocolVersion, ExecutionSession } from '../types/protocol.types'
import { DifficultyBadge, BiosafetyBadge, OpenAccessBadge, AiGeneratedBadge } from './ProtocolBadges'
import ProtocolSourceLinkGroup from './ProtocolSourceLinkGroup'
import StepEditModal from './StepEditModal'
import ProtocolVersionHistory from './ProtocolVersionHistory'

const TABS = ['Overview', 'Steps', 'Reagents & Equipment', 'Literature', 'QC & Troubleshooting', 'History', 'AI Notes'] as const
type Tab = typeof TABS[number]

interface Props {
  protocol: Protocol
  onUpdateSteps?: (steps: ProtocolStep[]) => void
  onUpdateReagents?: (reagents: string[]) => void
  onUpdateEquipment?: (equipment: string[]) => void
  onUpdateQcChecklist?: (qcChecklist: string[]) => void
  onUpdateTroubleshooting?: (troubleshooting: { problem: string; solution: string }[]) => void
  onUpdateSafetyNotes?: (safetyNotes: string[]) => void
  onUpdatePrerequisites?: (prerequisites: string[]) => void
  editable?: boolean
  versions?: ProtocolVersion[]
  executionHistory?: ExecutionSession[]
  onRestoreVersion?: (version: ProtocolVersion) => void
  onForkProtocol?: (version: ProtocolVersion, newTitle: string) => void
}

export default function ProtocolDetailTabs({ protocol: p, onUpdateSteps, onUpdateReagents, onUpdateEquipment, onUpdateQcChecklist, onUpdateTroubleshooting, onUpdateSafetyNotes, onUpdatePrerequisites, editable = true, versions = [], executionHistory = [], onRestoreVersion, onForkProtocol }: Props) {
  const [tab, setTab] = useState<Tab>('Overview')
  const [editingStep, setEditingStep] = useState<{ step: ProtocolStep | null; index: number } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Reagents & Equipment editing states
  const [newReagent, setNewReagent] = useState('')
  const [newEquipment, setNewEquipment] = useState('')
  const [editingReagent, setEditingReagent] = useState<{ index: number; value: string } | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<{ index: number; value: string } | null>(null)

  // QC & Troubleshooting editing states
  const [newQcItem, setNewQcItem] = useState('')
  const [editingQc, setEditingQc] = useState<{ index: number; value: string } | null>(null)
  const [newTrouble, setNewTrouble] = useState({ problem: '', solution: '' })
  const [editingTrouble, setEditingTrouble] = useState<{ index: number; problem: string; solution: string } | null>(null)

  // Safety Notes & Prerequisites editing states
  const [newSafetyNote, setNewSafetyNote] = useState('')
  const [editingSafetyNote, setEditingSafetyNote] = useState<{ index: number; value: string } | null>(null)
  const [newPrerequisite, setNewPrerequisite] = useState('')
  const [editingPrerequisite, setEditingPrerequisite] = useState<{ index: number; value: string } | null>(null)

  const handleAddStep = () => {
    setEditingStep({ step: null, index: p.steps.length })
  }

  const handleEditStep = (index: number) => {
    setEditingStep({ step: p.steps[index], index })
  }

  const handleSaveStep = (step: ProtocolStep, index: number) => {
    if (!onUpdateSteps) return
    const newSteps = [...p.steps]
    if (index >= p.steps.length) {
      // Adding new step
      step.stepNumber = p.steps.length + 1
      newSteps.push(step)
    } else {
      // Editing existing step
      newSteps[index] = step
    }
    onUpdateSteps(newSteps)
    setEditingStep(null)
  }

  const handleDeleteStep = (index: number) => {
    if (!onUpdateSteps) return
    const newSteps = p.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 }))
    onUpdateSteps(newSteps)
    setDeleteConfirm(null)
  }

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!onUpdateSteps) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= p.steps.length) return
    const newSteps = [...p.steps]
    const temp = newSteps[index]
    newSteps[index] = newSteps[newIndex]
    newSteps[newIndex] = temp
    // Update step numbers
    newSteps.forEach((s, i) => { s.stepNumber = i + 1 })
    onUpdateSteps(newSteps)
  }

  return (
    <div>
      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #2a2d3e', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#6366f1' : 'transparent'}`,
            color: tab === t ? '#6366f1' : '#94a3b8', padding: '8px 14px', fontSize: 13, cursor: 'pointer',
            fontWeight: tab === t ? 600 : 400, whiteSpace: 'nowrap', transition: 'color 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: '#e2e8f0', lineHeight: 1.7, margin: 0 }}>{p.abstract}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              ['Organism', p.organism], ['Sample Type', p.sampleType],
              ['Est. Time', p.estimatedTime], ['Version', p.version],
              ['Owner', p.owner], ['Journal', p.journal],
              ['Year', p.publicationYear], ['Steps', p.steps.length],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={String(k)} style={{ background: '#242838', borderRadius: 8, padding: 10 }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{String(k)}</div>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{String(v)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.difficulty && <DifficultyBadge difficulty={p.difficulty} />}
            {p.biosafetyLevel && <BiosafetyBadge level={p.biosafetyLevel} />}
            {p.aiGenerated && <AiGeneratedBadge />}
            {p.references.some(r => r.openAccess) && <OpenAccessBadge />}
          </div>
          <ProtocolSourceLinkGroup doi={p.doi} pmid={p.pmid} pmcid={p.pmcid} sourceUrl={p.sourceUrl} sourceName={p.sourceName} />
          {/* Prerequisites Section */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Prerequisites ({p.prerequisites.length})</span>
            </div>
            {/* Add new prerequisite */}
            {editable && onUpdatePrerequisites && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={newPrerequisite}
                  onChange={e => setNewPrerequisite(e.target.value)}
                  placeholder="Add prerequisite..."
                  style={{
                    flex: 1, padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newPrerequisite.trim()) {
                      onUpdatePrerequisites([...p.prerequisites, newPrerequisite.trim()])
                      setNewPrerequisite('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newPrerequisite.trim()) {
                      onUpdatePrerequisites([...p.prerequisites, newPrerequisite.trim()])
                      setNewPrerequisite('')
                    }
                  }}
                  disabled={!newPrerequisite.trim()}
                  style={{
                    background: newPrerequisite.trim() ? 'var(--accent)' : 'var(--surface)',
                    border: 'none', borderRadius: 6, color: '#fff',
                    padding: '8px 12px', cursor: newPrerequisite.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600, opacity: newPrerequisite.trim() ? 1 : 0.5,
                  }}
                >
                  +
                </button>
              </div>
            )}
            {p.prerequisites.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>No prerequisites listed</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#e2e8f0', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.prerequisites.map((pr, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingPrerequisite?.index === i ? (
                      <input
                        type="text"
                        value={editingPrerequisite.value}
                        onChange={e => setEditingPrerequisite({ index: i, value: e.target.value })}
                        autoFocus
                        style={{
                          flex: 1, padding: '4px 8px', background: 'var(--bg)',
                          border: '1px solid var(--accent)', borderRadius: 4,
                          color: 'var(--text)', fontSize: 13, outline: 'none',
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editingPrerequisite.value.trim() && onUpdatePrerequisites) {
                            const updated = [...p.prerequisites]
                            updated[i] = editingPrerequisite.value.trim()
                            onUpdatePrerequisites(updated)
                            setEditingPrerequisite(null)
                          } else if (e.key === 'Escape') {
                            setEditingPrerequisite(null)
                          }
                        }}
                        onBlur={() => {
                          if (editingPrerequisite.value.trim() && onUpdatePrerequisites) {
                            const updated = [...p.prerequisites]
                            updated[i] = editingPrerequisite.value.trim()
                            onUpdatePrerequisites(updated)
                          }
                          setEditingPrerequisite(null)
                        }}
                      />
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{pr}</span>
                        {editable && onUpdatePrerequisites && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => setEditingPrerequisite({ index: i, value: pr })}
                              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 2, fontSize: 11 }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onUpdatePrerequisites(p.prerequisites.filter((_, idx) => idx !== i))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, fontSize: 11 }}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Safety Notes Section */}
          <div style={{ background: '#7f1d1d22', border: '1px solid #ef444466', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ Safety Notes ({p.safetyNotes.length})</span>
            </div>
            {/* Add new safety note */}
            {editable && onUpdateSafetyNotes && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={newSafetyNote}
                  onChange={e => setNewSafetyNote(e.target.value)}
                  placeholder="Add safety note..."
                  style={{
                    flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.2)',
                    border: '1px solid #ef444466', borderRadius: 6,
                    color: '#fca5a5', fontSize: 13, outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSafetyNote.trim()) {
                      onUpdateSafetyNotes([...p.safetyNotes, newSafetyNote.trim()])
                      setNewSafetyNote('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newSafetyNote.trim()) {
                      onUpdateSafetyNotes([...p.safetyNotes, newSafetyNote.trim()])
                      setNewSafetyNote('')
                    }
                  }}
                  disabled={!newSafetyNote.trim()}
                  style={{
                    background: newSafetyNote.trim() ? '#ef4444' : 'transparent',
                    border: '1px solid #ef4444', borderRadius: 6, color: '#fff',
                    padding: '8px 12px', cursor: newSafetyNote.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600, opacity: newSafetyNote.trim() ? 1 : 0.5,
                  }}
                >
                  +
                </button>
              </div>
            )}
            {p.safetyNotes.length === 0 ? (
              <div style={{ color: '#fca5a5', fontSize: 13, opacity: 0.7 }}>No safety notes</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#fca5a5', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.safetyNotes.map((n, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingSafetyNote?.index === i ? (
                      <input
                        type="text"
                        value={editingSafetyNote.value}
                        onChange={e => setEditingSafetyNote({ index: i, value: e.target.value })}
                        autoFocus
                        style={{
                          flex: 1, padding: '4px 8px', background: 'rgba(0,0,0,0.2)',
                          border: '1px solid #ef4444', borderRadius: 4,
                          color: '#fca5a5', fontSize: 13, outline: 'none',
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editingSafetyNote.value.trim() && onUpdateSafetyNotes) {
                            const updated = [...p.safetyNotes]
                            updated[i] = editingSafetyNote.value.trim()
                            onUpdateSafetyNotes(updated)
                            setEditingSafetyNote(null)
                          } else if (e.key === 'Escape') {
                            setEditingSafetyNote(null)
                          }
                        }}
                        onBlur={() => {
                          if (editingSafetyNote.value.trim() && onUpdateSafetyNotes) {
                            const updated = [...p.safetyNotes]
                            updated[i] = editingSafetyNote.value.trim()
                            onUpdateSafetyNotes(updated)
                          }
                          setEditingSafetyNote(null)
                        }}
                      />
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{n}</span>
                        {editable && onUpdateSafetyNotes && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => setEditingSafetyNote({ index: i, value: n })}
                              style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 2, fontSize: 11 }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onUpdateSafetyNotes(p.safetyNotes.filter((_, idx) => idx !== i))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, fontSize: 11 }}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {p.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.tags.map(t => (
                <span key={t} style={{ background: '#242838', color: '#6366f1', fontSize: 12, padding: '3px 8px', borderRadius: 4, border: '1px solid #6366f133' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Steps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Add Step Button at Top */}
          {editable && onUpdateSteps && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={handleAddStep}
                style={{
                  background: 'var(--accent)', border: 'none', borderRadius: 6,
                  color: '#fff', padding: '8px 16px', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                + Add Step
              </button>
            </div>
          )}

          {p.steps.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No steps defined yet</div>
              {editable && onUpdateSteps && (
                <button
                  onClick={handleAddStep}
                  style={{
                    background: 'var(--accent)', border: 'none', borderRadius: 6,
                    color: '#fff', padding: '10px 20px', cursor: 'pointer',
                    fontSize: 14, fontWeight: 600, marginTop: 8,
                  }}
                >
                  + Add First Step
                </button>
              )}
            </div>
          )}

          {p.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{s.stepNumber}</div>
                {i < p.steps.length - 1 && <div style={{ width: 2, flex: 1, background: '#2a2d3e', marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.title}
                    {s.qcPoint && <span style={{ background: '#065f46', color: '#6ee7b7', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>QC</span>}
                  </div>
                  {/* Step Action Buttons */}
                  {editable && onUpdateSteps && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {/* Move Up */}
                      <button
                        onClick={() => handleMoveStep(i, 'up')}
                        disabled={i === 0}
                        title="Move Up"
                        style={{
                          background: i === 0 ? 'transparent' : 'var(--surface-hover)',
                          border: '1px solid var(--border)', borderRadius: 4,
                          color: i === 0 ? 'var(--text-muted)' : 'var(--text)',
                          padding: '4px 8px', cursor: i === 0 ? 'not-allowed' : 'pointer',
                          fontSize: 12, opacity: i === 0 ? 0.4 : 1,
                        }}
                      >
                        ↑
                      </button>
                      {/* Move Down */}
                      <button
                        onClick={() => handleMoveStep(i, 'down')}
                        disabled={i === p.steps.length - 1}
                        title="Move Down"
                        style={{
                          background: i === p.steps.length - 1 ? 'transparent' : 'var(--surface-hover)',
                          border: '1px solid var(--border)', borderRadius: 4,
                          color: i === p.steps.length - 1 ? 'var(--text-muted)' : 'var(--text)',
                          padding: '4px 8px', cursor: i === p.steps.length - 1 ? 'not-allowed' : 'pointer',
                          fontSize: 12, opacity: i === p.steps.length - 1 ? 0.4 : 1,
                        }}
                      >
                        ↓
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => handleEditStep(i)}
                        title="Edit Step"
                        style={{
                          background: 'var(--surface-hover)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--accent)', padding: '4px 8px',
                          cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        ✏️
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setDeleteConfirm(i)}
                        title="Delete Step"
                        style={{
                          background: deleteConfirm === i ? '#7f1d1d' : 'var(--surface-hover)',
                          border: `1px solid ${deleteConfirm === i ? '#ef4444' : 'var(--border)'}`,
                          borderRadius: 4, color: deleteConfirm === i ? '#fff' : '#ef4444',
                          padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === i && (
                  <div style={{
                    background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 6,
                    padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12,
                  }}>
                    <span style={{ color: '#fca5a5', fontSize: 13 }}>Delete this step?</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text-muted)', padding: '4px 12px',
                          cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteStep(i)}
                        style={{
                          background: '#ef4444', border: 'none', borderRadius: 4,
                          color: '#fff', padding: '4px 12px', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, margin: '0 0 8px' }}>{s.instruction}</p>
                {(s.duration || s.temperature || s.rpm) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    {s.duration && <span style={{ background: '#242838', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>⏱ {s.duration}</span>}
                    {s.temperature && <span style={{ background: '#242838', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>🌡 {s.temperature}</span>}
                    {s.rpm && <span style={{ background: '#242838', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>🔄 {s.rpm}</span>}
                  </div>
                )}
                {s.caution && <div style={{ background: '#78350f22', border: '1px solid #d9770666', borderRadius: 6, padding: '8px 10px', color: '#fbbf24', fontSize: 12, marginBottom: 8 }}>⚠️ {s.caution}</div>}
                {s.notes && <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>📝 {s.notes}</div>}
                {s.expectedOutput && <div style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>✓ Expected: {s.expectedOutput}</div>}
                {s.troubleshootingTip && <div style={{ color: '#6366f1', fontSize: 12, marginTop: 4 }}>💡 {s.troubleshootingTip}</div>}
              </div>
            </div>
          ))}

          {/* Add Step Button at Bottom (if steps exist) */}
          {editable && onUpdateSteps && p.steps.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
              <button
                onClick={handleAddStep}
                style={{
                  background: 'transparent', border: '1px dashed var(--accent)',
                  borderRadius: 6, color: 'var(--accent)', padding: '10px 24px',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}
              >
                + Add Another Step
              </button>
            </div>
          )}

          {/* Step Edit Modal */}
          {editingStep && (
            <StepEditModal
              step={editingStep.step}
              stepIndex={editingStep.index}
              isOpen={true}
              onClose={() => setEditingStep(null)}
              onSave={handleSaveStep}
            />
          )}
        </div>
      )}

      {tab === 'Reagents & Equipment' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Reagents Column */}
          <div>
            <h4 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid #2a2d3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🧪 Reagents ({p.reagents.length})</span>
            </h4>
            {/* Add new reagent */}
            {editable && onUpdateReagents && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={newReagent}
                  onChange={e => setNewReagent(e.target.value)}
                  placeholder="Add new reagent..."
                  style={{
                    flex: 1, padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newReagent.trim()) {
                      onUpdateReagents([...p.reagents, newReagent.trim()])
                      setNewReagent('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newReagent.trim()) {
                      onUpdateReagents([...p.reagents, newReagent.trim()])
                      setNewReagent('')
                    }
                  }}
                  disabled={!newReagent.trim()}
                  style={{
                    background: newReagent.trim() ? 'var(--accent)' : 'var(--surface)',
                    border: 'none', borderRadius: 6, color: '#fff',
                    padding: '8px 12px', cursor: newReagent.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600, opacity: newReagent.trim() ? 1 : 0.5,
                  }}
                >
                  +
                </button>
              </div>
            )}
            {p.reagents.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No reagents listed
              </div>
            ) : (
              p.reagents.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #2a2d3e22' }}>
                  <input type="checkbox" style={{ accentColor: '#6366f1', flexShrink: 0 }} />
                  {editingReagent?.index === i ? (
                    <input
                      type="text"
                      value={editingReagent.value}
                      onChange={e => setEditingReagent({ index: i, value: e.target.value })}
                      autoFocus
                      style={{
                        flex: 1, padding: '4px 8px', background: 'var(--bg)',
                        border: '1px solid var(--accent)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 13, outline: 'none',
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editingReagent.value.trim() && onUpdateReagents) {
                          const updated = [...p.reagents]
                          updated[i] = editingReagent.value.trim()
                          onUpdateReagents(updated)
                          setEditingReagent(null)
                        } else if (e.key === 'Escape') {
                          setEditingReagent(null)
                        }
                      }}
                      onBlur={() => {
                        if (editingReagent.value.trim() && onUpdateReagents) {
                          const updated = [...p.reagents]
                          updated[i] = editingReagent.value.trim()
                          onUpdateReagents(updated)
                        }
                        setEditingReagent(null)
                      }}
                    />
                  ) : (
                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: 13 }}>{r}</span>
                  )}
                  {editable && onUpdateReagents && !editingReagent && (
                    <div style={{ display: 'flex', gap: 4, opacity: 0.6 }} className="hover-actions">
                      <button
                        onClick={() => setEditingReagent({ index: i, value: r })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4, fontSize: 12 }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onUpdateReagents(p.reagents.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, fontSize: 12 }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Equipment Column */}
          <div>
            <h4 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid #2a2d3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚙️ Equipment ({p.equipment.length})</span>
            </h4>
            {/* Add new equipment */}
            {editable && onUpdateEquipment && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={newEquipment}
                  onChange={e => setNewEquipment(e.target.value)}
                  placeholder="Add new equipment..."
                  style={{
                    flex: 1, padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newEquipment.trim()) {
                      onUpdateEquipment([...p.equipment, newEquipment.trim()])
                      setNewEquipment('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newEquipment.trim()) {
                      onUpdateEquipment([...p.equipment, newEquipment.trim()])
                      setNewEquipment('')
                    }
                  }}
                  disabled={!newEquipment.trim()}
                  style={{
                    background: newEquipment.trim() ? 'var(--accent)' : 'var(--surface)',
                    border: 'none', borderRadius: 6, color: '#fff',
                    padding: '8px 12px', cursor: newEquipment.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600, opacity: newEquipment.trim() ? 1 : 0.5,
                  }}
                >
                  +
                </button>
              </div>
            )}
            {p.equipment.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No equipment listed
              </div>
            ) : (
              p.equipment.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #2a2d3e22' }}>
                  <input type="checkbox" style={{ accentColor: '#6366f1', flexShrink: 0 }} />
                  {editingEquipment?.index === i ? (
                    <input
                      type="text"
                      value={editingEquipment.value}
                      onChange={ev => setEditingEquipment({ index: i, value: ev.target.value })}
                      autoFocus
                      style={{
                        flex: 1, padding: '4px 8px', background: 'var(--bg)',
                        border: '1px solid var(--accent)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 13, outline: 'none',
                      }}
                      onKeyDown={ev => {
                        if (ev.key === 'Enter' && editingEquipment.value.trim() && onUpdateEquipment) {
                          const updated = [...p.equipment]
                          updated[i] = editingEquipment.value.trim()
                          onUpdateEquipment(updated)
                          setEditingEquipment(null)
                        } else if (ev.key === 'Escape') {
                          setEditingEquipment(null)
                        }
                      }}
                      onBlur={() => {
                        if (editingEquipment.value.trim() && onUpdateEquipment) {
                          const updated = [...p.equipment]
                          updated[i] = editingEquipment.value.trim()
                          onUpdateEquipment(updated)
                        }
                        setEditingEquipment(null)
                      }}
                    />
                  ) : (
                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: 13 }}>{e}</span>
                  )}
                  {editable && onUpdateEquipment && !editingEquipment && (
                    <div style={{ display: 'flex', gap: 4, opacity: 0.6 }} className="hover-actions">
                      <button
                        onClick={() => setEditingEquipment({ index: i, value: e })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4, fontSize: 12 }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onUpdateEquipment(p.equipment.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, fontSize: 12 }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'Literature' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>All references are linked to their original source. Open-access articles are marked 🔓.</div>
          {p.references.map(ref => (
            <div key={ref.id} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 8, padding: 14 }}>
              <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{ref.title}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, fontStyle: 'italic' }}>{ref.citationText}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {ref.openAccess && <OpenAccessBadge />}
                {ref.doi && <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: 11, textDecoration: 'none' }}>DOI: {ref.doi}</a>}
                {ref.pmid && <a href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: 11, textDecoration: 'none' }}>PMID: {ref.pmid}</a>}
                {ref.url && <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>🔗 Source</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'QC & Troubleshooting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* QC Checklist Section */}
          <div>
            <h4 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ QC Checklist ({p.qcChecklist.length})</span>
            </h4>
            {/* Add new QC item */}
            {editable && onUpdateQcChecklist && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={newQcItem}
                  onChange={e => setNewQcItem(e.target.value)}
                  placeholder="Add new QC checklist item..."
                  style={{
                    flex: 1, padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newQcItem.trim()) {
                      onUpdateQcChecklist([...p.qcChecklist, newQcItem.trim()])
                      setNewQcItem('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newQcItem.trim()) {
                      onUpdateQcChecklist([...p.qcChecklist, newQcItem.trim()])
                      setNewQcItem('')
                    }
                  }}
                  disabled={!newQcItem.trim()}
                  style={{
                    background: newQcItem.trim() ? '#10b981' : 'var(--surface)',
                    border: 'none', borderRadius: 6, color: '#fff',
                    padding: '8px 12px', cursor: newQcItem.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600, opacity: newQcItem.trim() ? 1 : 0.5,
                  }}
                >
                  +
                </button>
              </div>
            )}
            {p.qcChecklist.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No QC checklist items
              </div>
            ) : (
              p.qcChecklist.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #2a2d3e22' }}>
                  <input type="checkbox" style={{ accentColor: '#10b981', flexShrink: 0 }} />
                  {editingQc?.index === i ? (
                    <input
                      type="text"
                      value={editingQc.value}
                      onChange={e => setEditingQc({ index: i, value: e.target.value })}
                      autoFocus
                      style={{
                        flex: 1, padding: '4px 8px', background: 'var(--bg)',
                        border: '1px solid var(--accent)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 13, outline: 'none',
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editingQc.value.trim() && onUpdateQcChecklist) {
                          const updated = [...p.qcChecklist]
                          updated[i] = editingQc.value.trim()
                          onUpdateQcChecklist(updated)
                          setEditingQc(null)
                        } else if (e.key === 'Escape') {
                          setEditingQc(null)
                        }
                      }}
                      onBlur={() => {
                        if (editingQc.value.trim() && onUpdateQcChecklist) {
                          const updated = [...p.qcChecklist]
                          updated[i] = editingQc.value.trim()
                          onUpdateQcChecklist(updated)
                        }
                        setEditingQc(null)
                      }}
                    />
                  ) : (
                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: 13 }}>{item}</span>
                  )}
                  {editable && onUpdateQcChecklist && !editingQc && (
                    <div style={{ display: 'flex', gap: 4, opacity: 0.6 }}>
                      <button
                        onClick={() => setEditingQc({ index: i, value: item })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4, fontSize: 12 }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onUpdateQcChecklist(p.qcChecklist.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, fontSize: 12 }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Troubleshooting Section */}
          <div>
            <h4 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔧 Troubleshooting ({p.troubleshooting.length})</span>
            </h4>
            {/* Add new troubleshooting */}
            {editable && onUpdateTroubleshooting && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={newTrouble.problem}
                    onChange={e => setNewTrouble({ ...newTrouble, problem: e.target.value })}
                    placeholder="Problem description..."
                    style={{
                      flex: 1, padding: '8px 10px', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: '#fbbf24', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newTrouble.solution}
                    onChange={e => setNewTrouble({ ...newTrouble, solution: e.target.value })}
                    placeholder="Solution..."
                    style={{
                      flex: 1, padding: '8px 10px', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text)', fontSize: 13, outline: 'none',
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTrouble.problem.trim() && newTrouble.solution.trim()) {
                        onUpdateTroubleshooting([...p.troubleshooting, { problem: newTrouble.problem.trim(), solution: newTrouble.solution.trim() }])
                        setNewTrouble({ problem: '', solution: '' })
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newTrouble.problem.trim() && newTrouble.solution.trim()) {
                        onUpdateTroubleshooting([...p.troubleshooting, { problem: newTrouble.problem.trim(), solution: newTrouble.solution.trim() }])
                        setNewTrouble({ problem: '', solution: '' })
                      }
                    }}
                    disabled={!newTrouble.problem.trim() || !newTrouble.solution.trim()}
                    style={{
                      background: newTrouble.problem.trim() && newTrouble.solution.trim() ? 'var(--accent)' : 'var(--surface)',
                      border: 'none', borderRadius: 6, color: '#fff',
                      padding: '8px 16px', cursor: newTrouble.problem.trim() && newTrouble.solution.trim() ? 'pointer' : 'not-allowed',
                      fontSize: 13, fontWeight: 600, opacity: newTrouble.problem.trim() && newTrouble.solution.trim() ? 1 : 0.5,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            {p.troubleshooting.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No troubleshooting items
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #2a2d3e', width: '35%' }}>PROBLEM</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #2a2d3e' }}>SOLUTION</th>
                    {editable && onUpdateTroubleshooting && (
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #2a2d3e', width: 80 }}>ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {p.troubleshooting.map((t, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#1a1d2766' : 'transparent' }}>
                      {editingTrouble?.index === i ? (
                        <>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #2a2d3e22', verticalAlign: 'top' }}>
                            <input
                              type="text"
                              value={editingTrouble.problem}
                              onChange={e => setEditingTrouble({ ...editingTrouble, problem: e.target.value })}
                              style={{
                                width: '100%', padding: '6px 8px', background: 'var(--bg)',
                                border: '1px solid var(--accent)', borderRadius: 4,
                                color: '#fbbf24', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #2a2d3e22' }}>
                            <input
                              type="text"
                              value={editingTrouble.solution}
                              onChange={e => setEditingTrouble({ ...editingTrouble, solution: e.target.value })}
                              style={{
                                width: '100%', padding: '6px 8px', background: 'var(--bg)',
                                border: '1px solid var(--accent)', borderRadius: 4,
                                color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && editingTrouble.problem.trim() && editingTrouble.solution.trim()) {
                                  const updated = [...p.troubleshooting]
                                  updated[i] = { problem: editingTrouble.problem.trim(), solution: editingTrouble.solution.trim() }
                                  onUpdateTroubleshooting(updated)
                                  setEditingTrouble(null)
                                } else if (e.key === 'Escape') {
                                  setEditingTrouble(null)
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #2a2d3e22', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                if (editingTrouble.problem.trim() && editingTrouble.solution.trim()) {
                                  const updated = [...p.troubleshooting]
                                  updated[i] = { problem: editingTrouble.problem.trim(), solution: editingTrouble.solution.trim() }
                                  onUpdateTroubleshooting(updated)
                                }
                                setEditingTrouble(null)
                              }}
                              style={{
                                background: '#10b981', border: 'none', borderRadius: 4,
                                color: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: 11, marginRight: 4,
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTrouble(null)}
                              style={{
                                background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                                color: 'var(--text-muted)', padding: '4px 8px', cursor: 'pointer', fontSize: 11,
                              }}
                            >
                              Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 12px', color: '#fbbf24', fontSize: 13, borderBottom: '1px solid #2a2d3e22', verticalAlign: 'top' }}>{t.problem}</td>
                          <td style={{ padding: '10px 12px', color: '#e2e8f0', fontSize: 13, borderBottom: '1px solid #2a2d3e22' }}>{t.solution}</td>
                          {editable && onUpdateTroubleshooting && (
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2d3e22', textAlign: 'right' }}>
                              <button
                                onClick={() => setEditingTrouble({ index: i, problem: t.problem, solution: t.solution })}
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4, fontSize: 12 }}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => onUpdateTroubleshooting(p.troubleshooting.filter((_, idx) => idx !== i))}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, fontSize: 12 }}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'History' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Execution History Section */}
          <div>
            <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>
              Recent Executions
            </h3>
            {executionHistory.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14 }}>No execution records yet</div>
                <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-soft)' }}>
                  Run the protocol to create execution records
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {executionHistory.slice(0, 5).map(exec => (
                  <div
                    key={exec.id}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: exec.status === 'completed' ? '#065f46' : exec.status === 'aborted' ? '#7f1d1d' : '#1e3a8a',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                    }}>
                      {exec.status === 'completed' ? '✓' : exec.status === 'aborted' ? '✕' : '⏳'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                        {new Date(exec.startedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                        <span style={{
                          marginLeft: 8, fontSize: 11, fontWeight: 500,
                          color: exec.status === 'completed' ? '#10b981' : exec.status === 'aborted' ? '#ef4444' : '#3b82f6',
                        }}>
                          {exec.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                        Executed by {exec.executedBy} • {exec.steps.filter(s => s.status === 'completed').length}/{exec.steps.length} steps completed
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-soft)', fontSize: 12 }}>
                      v{exec.protocolVersion}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version History Section */}
          <ProtocolVersionHistory
            protocol={p}
            versions={versions}
            onRestoreVersion={onRestoreVersion || (() => {})}
            onForkProtocol={onForkProtocol || (() => {})}
          />
        </div>
      )}

      {tab === 'AI Notes' && (
        <div>
          {p.aiGenerated ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#4c1d9522', border: '1px solid #8b5cf6', borderRadius: 8, padding: 14 }}>
                <div style={{ color: '#c4b5fd', fontWeight: 600, marginBottom: 4 }}>🤖 AI-Generated Protocol</div>
                <div style={{ color: '#a78bfa', fontSize: 13 }}>Model: {p.aiModel || 'Unknown'}</div>
                {p.confidenceScore && <div style={{ color: '#a78bfa', fontSize: 13 }}>Confidence: {Math.round(p.confidenceScore * 100)}%</div>}
              </div>
              <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 8, padding: 14 }}>
                <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 6 }}>⚠️ DISCLAIMER</div>
                <div style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.6 }}>This protocol is AI-generated and must be reviewed by a qualified scientist before laboratory use. Do not use this protocol without expert validation.</div>
              </div>
              {p.reviewNotes && <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.reviewNotes}</div>}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 40 }}>
              This is a published or internal protocol. No AI notes available.
              <br /><br />
              <button style={{ background: '#6366f133', border: '1px solid #6366f1', color: '#6366f1', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
                🤖 Generate AI Variant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
