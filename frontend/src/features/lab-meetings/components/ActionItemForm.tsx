import React, { useState } from 'react'
import type { ActionItem, ActionItemPriority } from '../types/meeting.types'

interface Props {
  /** Meetings the item can belong to (ignored when editing). */
  meetings: Array<{ id: string; title: string }>
  /** Names offered as suggestions for who it is assigned to. */
  people: string[]
  currentUserName: string
  editItem?: ActionItem | null
  onSubmit: (data: Omit<ActionItem, 'id' | 'createdAt' | 'status'> & { status?: ActionItem['status'] }) => void
  onCancel: () => void
}

const PRIORITIES: ActionItemPriority[] = ['low', 'medium', 'high', 'urgent']
const dayInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))

export default function ActionItemForm({ meetings, people, currentUserName, editItem, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    title: editItem?.title ?? '',
    description: editItem?.description ?? '',
    assignee: editItem?.assignedToName ?? '',
    due: dayInput(editItem?.dueDate),
    priority: (editItem?.priority ?? 'medium') as ActionItemPriority,
    notes: editItem?.notes ?? '',
    meetingId: editItem?.meetingId ?? meetings[0]?.id ?? '',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  function save() {
    if (!form.title.trim()) return setError('Title is required')
    if (!form.assignee.trim()) return setError('Say who it is assigned to')
    if (!form.due) return setError('Pick a due date')
    if (!editItem && !form.meetingId) return setError('Pick the meeting it came from')
    const meeting = meetings.find(m => m.id === form.meetingId)
    onSubmit({
      meetingId: editItem?.meetingId ?? form.meetingId,
      meetingTitle: editItem?.meetingTitle ?? meeting?.title ?? '',
      title: form.title.trim(),
      description: form.description.trim(),
      assignedTo: form.assignee.trim(),
      assignedToName: form.assignee.trim(),
      assignedToRole: editItem?.assignedToRole ?? 'member',
      assignedBy: editItem?.assignedBy ?? currentUserName,
      dueDate: new Date(`${form.due}T17:00:00`).toISOString(),
      priority: form.priority,
      notes: form.notes.trim() || undefined,
    })
  }

  const inp: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#1e293b', padding: '7px 9px', fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { color: '#475569', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 }

  return (
    <div style={{ background: '#fff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 14, marginBottom: 14, display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{editItem ? 'Edit action item' : 'New action item'}</div>
      <div><label style={lbl} htmlFor="ai-title">Title *</label><input id="ai-title" style={inp} value={form.title} onChange={e => set('title', e.target.value)} autoFocus /></div>
      <div><label style={lbl} htmlFor="ai-desc">Details</label><textarea id="ai-desc" style={{ ...inp, resize: 'vertical' }} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <div>
          <label style={lbl} htmlFor="ai-who">Assigned to *</label>
          <input id="ai-who" style={inp} list="ai-people" value={form.assignee} onChange={e => set('assignee', e.target.value)} placeholder="Name" />
          <datalist id="ai-people">{people.map(p => <option key={p} value={p} />)}</datalist>
        </div>
        <div><label style={lbl} htmlFor="ai-due">Due *</label><input id="ai-due" type="date" style={inp} value={form.due} onChange={e => set('due', e.target.value)} /></div>
        <div>
          <label style={lbl} htmlFor="ai-pri">Priority</label>
          <select id="ai-pri" style={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
        </div>
        {!editItem && (
          <div>
            <label style={lbl} htmlFor="ai-mtg">Meeting *</label>
            <select id="ai-mtg" style={inp} value={form.meetingId} onChange={e => set('meetingId', e.target.value)} disabled={meetings.length <= 1}>
              {meetings.length === 0 && <option value="">No meetings yet</option>}
              {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}
      </div>
      <div><label style={lbl} htmlFor="ai-notes">Notes</label><input id="ai-notes" style={inp} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button type="button" onClick={save} style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{editItem ? 'Save changes' : 'Add action item'}</button>
      </div>
    </div>
  )
}
