import React, { useState } from 'react'
import type { AgendaCategory } from '../types/meeting.types'

interface FormData {
  title: string
  description: string
  presenter: string
  durationMinutes: number
  category: AgendaCategory
  slideLink: string
}

interface Props {
  meetingTitle: string
  currentUserName: string
  currentUserRole: string
  onSubmit: (data: FormData) => void
  onCancel: () => void
}

const CATEGORIES: { value: AgendaCategory; label: string; icon: string }[] = [
  { value: 'research_update', label: 'Research Update', icon: '🔬' },
  { value: 'journal_club', label: 'Journal Club', icon: '📖' },
  { value: 'lab_business', label: 'Lab Business', icon: '📋' },
  { value: 'training', label: 'Training', icon: '🎓' },
  { value: 'guest_speaker', label: 'Guest Speaker', icon: '🎤' },
  { value: 'other', label: 'Other', icon: '💡' },
]

export default function AgendaItemForm({ meetingTitle, currentUserName, currentUserRole, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<FormData>({
    title: '', description: '', presenter: currentUserName,
    durationMinutes: 15, category: 'research_update', slideLink: '',
  })
  const [error, setError] = useState('')

  function set(key: keyof FormData, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSubmit() {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.presenter.trim()) { setError('Presenter name is required'); return }
    onSubmit(form)
  }

  const inp: React.CSSProperties = {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    color: '#1e293b', padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { color: '#475569', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', color: '#1e40af', fontSize: 12 }}>
        📋 Submitting agenda topic for: <strong>{meetingTitle}</strong>
        <br />Your topic will be visible to the PI for approval before it appears on the agenda.
      </div>

      <div>
        <label style={lbl}>Topic Title *</label>
        <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. RNA-seq pipeline progress update" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Category *</label>
          <select style={{ ...inp }} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Duration (minutes) *</label>
          <select style={{ ...inp }} value={form.durationMinutes} onChange={e => set('durationMinutes', Number(e.target.value))}>
            {[5, 10, 15, 20, 25, 30, 45, 60].map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={lbl}>Presenter *</label>
        <input style={inp} value={form.presenter} onChange={e => set('presenter', e.target.value)} placeholder="Who will present?" />
      </div>

      <div>
        <label style={lbl}>Description / Context</label>
        <textarea style={{ ...inp, resize: 'vertical' as const }} value={form.description} onChange={e => set('description', e.target.value)}
          rows={3} placeholder="What will be covered? Why is this important for the lab to know?" />
      </div>

      <div>
        <label style={lbl}>Slides Link (optional)</label>
        <input style={inp} value={form.slideLink} onChange={e => set('slideLink', e.target.value)} placeholder="Google Slides, OneDrive, or Figma URL..." />
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleSubmit} style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Submit Topic for Approval
        </button>
      </div>
    </div>
  )
}
