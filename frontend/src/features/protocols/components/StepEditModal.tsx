import React, { useState, useEffect } from 'react'
import type { ProtocolStep } from '../types/protocol.types'

interface Props {
  step: ProtocolStep | null
  stepIndex: number
  isOpen: boolean
  onClose: () => void
  onSave: (step: ProtocolStep, index: number) => void
}

const emptyStep: ProtocolStep = {
  stepNumber: 1,
  title: '',
  instruction: '',
  duration: '',
  temperature: '',
  rpm: '',
  notes: '',
  caution: '',
  expectedOutput: '',
  troubleshootingTip: '',
  qcPoint: false,
}

export default function StepEditModal({ step, stepIndex, isOpen, onClose, onSave }: Props) {
  const [formData, setFormData] = useState<ProtocolStep>(emptyStep)
  const isNew = step === null

  useEffect(() => {
    if (isOpen) {
      setFormData(step || { ...emptyStep, stepNumber: stepIndex + 1 })
    }
  }, [step, stepIndex, isOpen])

  const handleChange = (field: keyof ProtocolStep, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.instruction.trim()) return
    onSave(formData, stepIndex)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', zIndex: 200,
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(600px, 90vw)', maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)', zIndex: 201,
      }}>
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>
            {isNew ? 'Add New Step' : `Edit Step ${formData.stepNumber}`}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-muted)', padding: '6px 10px',
              cursor: 'pointer', fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Step Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="e.g., Add Buffer Solution"
                required
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Instruction */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Instruction *
              </label>
              <textarea
                value={formData.instruction}
                onChange={e => handleChange('instruction', e.target.value)}
                placeholder="Detailed instruction for this step..."
                required
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                  fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Duration, Temperature, RPM */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration || ''}
                  onChange={e => handleChange('duration', e.target.value)}
                  placeholder="e.g., 30 min"
                  style={{
                    width: '100%', padding: '10px 12px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Temperature
                </label>
                <input
                  type="text"
                  value={formData.temperature || ''}
                  onChange={e => handleChange('temperature', e.target.value)}
                  placeholder="e.g., 37°C"
                  style={{
                    width: '100%', padding: '10px 12px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  RPM
                </label>
                <input
                  type="text"
                  value={formData.rpm || ''}
                  onChange={e => handleChange('rpm', e.target.value)}
                  placeholder="e.g., 3000 rpm"
                  style={{
                    width: '100%', padding: '10px 12px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Caution */}
            <div>
              <label style={{ display: 'block', color: '#fbbf24', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Caution / Warning
              </label>
              <textarea
                value={formData.caution || ''}
                onChange={e => handleChange('caution', e.target.value)}
                placeholder="Any safety warnings for this step..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px', background: '#78350f22',
                  border: '1px solid #d9770666', borderRadius: 6, color: '#fbbf24',
                  fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Additional notes for this step..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                  fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Expected Output */}
            <div>
              <label style={{ display: 'block', color: '#10b981', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Expected Output
              </label>
              <input
                type="text"
                value={formData.expectedOutput || ''}
                onChange={e => handleChange('expectedOutput', e.target.value)}
                placeholder="What should be observed after this step..."
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Troubleshooting Tip */}
            <div>
              <label style={{ display: 'block', color: '#6366f1', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Troubleshooting Tip
              </label>
              <textarea
                value={formData.troubleshootingTip || ''}
                onChange={e => handleChange('troubleshootingTip', e.target.value)}
                placeholder="What to do if this step doesn't work..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
                  fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* QC Point Checkbox */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: formData.qcPoint ? '#065f4622' : 'transparent',
              border: `1px solid ${formData.qcPoint ? '#065f46' : 'var(--border)'}`,
              borderRadius: 8, padding: '12px 14px',
            }}>
              <input
                type="checkbox"
                checked={formData.qcPoint || false}
                onChange={e => handleChange('qcPoint', e.target.checked)}
                style={{ accentColor: '#10b981', width: 18, height: 18 }}
              />
              <div>
                <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>
                  Mark as QC Checkpoint
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                  This step requires quality control verification
                </div>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-muted)', padding: '10px 20px',
                cursor: 'pointer', fontSize: 14, fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 6,
                color: '#fff', padding: '10px 24px', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}
            >
              {isNew ? 'Add Step' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
