import React from 'react'
import { PROTOCOL_CATEGORIES } from '../data/categories'
import type { useProtocolGeneration } from '../hooks/useProtocolGeneration'

type GenHook = ReturnType<typeof useProtocolGeneration>
interface Props { hook: GenHook }

const fld = (label: string, node: React.ReactNode) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ color: '#94a3b8', fontSize: 12 }}>{label}</label>
    {node}
  </div>
)

const inp = (value: string, onChange: (v: string) => void, placeholder = '') => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, outline: 'none' }} />
)

const sel = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[], placeholder = '') => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, color: value ? '#e2e8f0' : '#64748b', padding: '7px 10px', fontSize: 13, outline: 'none' }}>
    <option value="">{placeholder || 'Select...'}</option>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)

export default function ProtocolGenerateModal({ hook: h }: Props) {
  if (!h.isOpen) return null

  const activeCat = PROTOCOL_CATEGORIES.find(c => c.id === h.params.category)

  return (
    <>
      <div onClick={() => { h.setIsOpen(false); h.reset() }} style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 12, width: 'min(680px, 95vw)',
        maxHeight: '90vh', overflowY: 'auto', zIndex: 201, boxShadow: '0 24px 64px #00000099',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2d3e', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 17 }}>🤖 Generate AI Protocol Draft</h2>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>AI drafts must be reviewed by a qualified scientist before lab use</p>
          </div>
          <button onClick={() => { h.setIsOpen(false); h.reset() }} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 6, color: '#94a3b8', padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {!h.generated ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#4c1d9522', border: '1px solid #8b5cf6', borderRadius: 8, padding: '10px 14px', color: '#c4b5fd', fontSize: 12 }}>
                ⚠️ AI-generated protocols are drafts only. Never use in a laboratory without expert review and validation.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fld('Protocol Title / Topic *', inp(h.params.title, v => h.setParam('title', v), 'e.g. PBMC isolation from whole blood'))}
                {fld('Category *', sel(h.params.category, v => h.setParam('category', v), PROTOCOL_CATEGORIES.map(c => ({ value: c.id, label: c.name })), 'Select category'))}
                {fld('Subcategory', sel(h.params.subcategory, v => h.setParam('subcategory', v), activeCat?.subcategories.map(s => ({ value: s.id, label: s.name })) || []))}
                {fld('Organism / Model', inp(h.params.organism, v => h.setParam('organism', v), 'e.g. Human, Mouse, E. coli'))}
                {fld('Sample Type', inp(h.params.sampleType, v => h.setParam('sampleType', v), 'e.g. Whole blood, FFPE tissue'))}
                {fld('Platform / Instrument', inp(h.params.platform, v => h.setParam('platform', v), 'e.g. Illumina MiSeq, BD FACSCalibur'))}
                {fld('Difficulty', sel(h.params.difficulty, v => h.setParam('difficulty', v as any), [
                  { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' }, { value: 'expert', label: 'Expert' },
                ]))}
                {fld('Biosafety Level', sel(h.params.safetyLevel, v => h.setParam('safetyLevel', v), [
                  { value: 'BSL-1', label: 'BSL-1' }, { value: 'BSL-2', label: 'BSL-2' }, { value: 'BSL-3', label: 'BSL-3' },
                ]))}
              </div>
              {fld('Experiment Goal / Objective', (
                <textarea value={h.params.goal} onChange={e => h.setParam('goal', e.target.value)} rows={3} placeholder="Describe what this protocol aims to achieve..."
                  style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, resize: 'vertical', outline: 'none' }} />
              ))}
              {fld('Additional Notes / Constraints', (
                <textarea value={h.params.notes} onChange={e => h.setParam('notes', e.target.value)} rows={2} placeholder="Any specific requirements, reagent preferences, or constraints..."
                  style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, resize: 'vertical', outline: 'none' }} />
              ))}
              {h.error && <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444', padding: '8px 12px', fontSize: 13 }}>{h.error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => { h.setIsOpen(false); h.reset() }} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 6, color: '#94a3b8', padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={h.generate} disabled={h.isGenerating}
                  style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: h.isGenerating ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: h.isGenerating ? 0.7 : 1 }}>
                  {h.isGenerating ? '⏳ Generating...' : '🤖 Generate Protocol'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>⚠️ AI DRAFT — NOT VALIDATED</div>
                <div style={{ color: '#fca5a5', fontSize: 12 }}>This protocol is AI-generated and must be reviewed by a qualified scientist before laboratory use. Confidence score: {Math.round((h.generated.confidenceScore || 0) * 100)}%</div>
              </div>
              <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, padding: 16 }}>
                <h3 style={{ color: '#e2e8f0', margin: '0 0 8px', fontSize: 15 }}>{h.generated.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px' }}>{h.generated.summary}</p>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Steps ({h.generated.steps.length})</div>
                  {h.generated.steps.map(s => (
                    <div key={s.stepNumber} style={{ padding: '6px 0', borderBottom: '1px solid #2a2d3e22', color: '#e2e8f0', fontSize: 13 }}>
                      <strong style={{ color: '#6366f1' }}>Step {s.stepNumber}:</strong> {s.title} — <span style={{ color: '#94a3b8' }}>{s.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={h.reset} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 6, color: '#94a3b8', padding: '8px 16px', cursor: 'pointer' }}>← Edit Params</button>
                <button onClick={h.saveDraft} style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>
                  💾 Save as Draft
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
