import React, { useState } from 'react'
import type { Meeting, MeetingType } from '../types/meeting.types'
import { getMeetingTypeIcon, getMeetingTypeLabel } from '../utils/meetingUtils'

interface Props {
  currentUserName: string
  onSave: (data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'agenda' | 'attendees' | 'actionItems' | 'progressReports' | 'minutes' | 'minutesPublished'>) => void
  onClose: () => void
  editMeeting?: Meeting | null
}

const TYPES: MeetingType[] = ['weekly', 'journal_club', 'lab_retreat', 'one_on_one', 'progress_report', 'special']
const MEMBERS = ['Dr. Sarah Chen', 'Dr. James Wright', 'Alex Kim', 'Priya Patel', 'Marcus Lee']

export default function CreateMeetingModal({ currentUserName, onSave, onClose, editMeeting }: Props) {
  const isEditMode = !!editMeeting
  const now = new Date()
  const localDate = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  const defaultStart = new Date(now.getTime() + 24 * 3600000)
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 3600000)

  const [form, setForm] = useState({
    title: editMeeting?.title || '',
    type: (editMeeting?.type || 'weekly') as MeetingType,
    location: editMeeting?.location || '',
    zoomLink: editMeeting?.zoomLink || '',
    scheduledAt: editMeeting ? localDate(editMeeting.scheduledAt) : localDate(defaultStart),
    endTime: editMeeting ? localDate(editMeeting.endTime) : localDate(defaultEnd),
    description: editMeeting?.description || '',
    isRecurring: editMeeting?.isRecurring || false,
    recurringPattern: (editMeeting?.recurringPattern || 'weekly') as 'weekly' | 'biweekly' | 'monthly',
    selectedAttendees: editMeeting?.attendees?.map(a => a.name) || [...MEMBERS],
    tags: editMeeting?.tags?.join(', ') || '',
  })
  const [error, setError] = useState('')

  function set(key: string, value: unknown) { setForm(f => ({ ...f, [key]: value })) }

  function toggleAttendee(name: string) {
    setForm(f => ({
      ...f,
      selectedAttendees: f.selectedAttendees.includes(name) ? f.selectedAttendees.filter(n => n !== name) : [...f.selectedAttendees, name],
    }))
  }

  function handleSave() {
    if (!form.title.trim()) { setError('Meeting title is required'); return }
    if (!form.location.trim()) { setError('Location is required'); return }
    if (!form.scheduledAt || !form.endTime) { setError('Start and end time required'); return }
    if (new Date(form.scheduledAt) >= new Date(form.endTime)) { setError('End time must be after start time'); return }

    onSave({
      title: form.title.trim(),
      type: form.type,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      location: form.location.trim(),
      zoomLink: form.zoomLink.trim() || undefined,
      status: 'scheduled',
      organizer: currentUserName,
      organizerRole: 'pi',
      description: form.description.trim(),
      isRecurring: form.isRecurring,
      recurringPattern: form.isRecurring ? form.recurringPattern : undefined,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  const inp: React.CSSProperties = {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    color: '#1e293b', padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { color: '#475569', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, width: 'min(660px, 95vw)',
        maxHeight: '90vh', overflowY: 'auto', zIndex: 201, boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#1e293b', fontSize: 17, fontWeight: 800, margin: 0 }}>
            {isEditMode ? '✏️ Edit Meeting' : '📅 Schedule New Meeting'}
          </h2>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Meeting type */}
          <div>
            <label style={lbl}>Meeting Type *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button key={t} onClick={() => set('type', t)} style={{
                  background: form.type === t ? '#6366f1' : '#f1f5f9', border: 'none', borderRadius: 8,
                  color: form.type === t ? '#fff' : '#64748b', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: form.type === t ? 700 : 400,
                }}>
                  {getMeetingTypeIcon(t)} {getMeetingTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Meeting Title *</label>
            <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Weekly Lab Meeting — Week 15" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Start Date & Time *</label>
              <input type="datetime-local" style={inp} value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>End Date & Time *</label>
              <input type="datetime-local" style={inp} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Location *</label>
              <input style={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Conference Room B / Zoom" />
            </div>
            <div>
              <label style={lbl}>Zoom Link (optional)</label>
              <input style={inp} value={form.zoomLink} onChange={e => set('zoomLink', e.target.value)} placeholder="https://zoom.us/j/..." />
            </div>
          </div>

          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, resize: 'vertical' as const }} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of this meeting's purpose..." />
          </div>

          {/* Recurring */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isRecurring} onChange={e => set('isRecurring', e.target.checked)} style={{ accentColor: '#6366f1', width: 16, height: 16 }} />
              <span style={{ color: '#1e293b', fontSize: 13, fontWeight: 600 }}>🔁 Recurring meeting</span>
            </label>
            {form.isRecurring && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                {(['weekly', 'biweekly', 'monthly'] as const).map(p => (
                  <button key={p} onClick={() => set('recurringPattern', p)} style={{
                    background: form.recurringPattern === p ? '#6366f1' : '#fff', border: `1px solid ${form.recurringPattern === p ? '#6366f1' : '#e2e8f0'}`,
                    borderRadius: 6, color: form.recurringPattern === p ? '#fff' : '#64748b', padding: '5px 12px', cursor: 'pointer', fontSize: 12,
                  }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                ))}
              </div>
            )}
          </div>

          {/* Attendees */}
          <div>
            <label style={lbl}>Attendees</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MEMBERS.map(m => (
                <button key={m} onClick={() => toggleAttendee(m)} style={{
                  background: form.selectedAttendees.includes(m) ? '#e0e7ff' : '#f8fafc',
                  border: `1px solid ${form.selectedAttendees.includes(m) ? '#6366f1' : '#e2e8f0'}`,
                  borderRadius: 20, color: form.selectedAttendees.includes(m) ? '#6366f1' : '#64748b',
                  padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                }}>
                  {form.selectedAttendees.includes(m) ? '✓ ' : ''}{m.split(' ').pop()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Tags (comma-separated)</label>
            <input style={inp} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="weekly, immunology, RNA-seq..." />
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '9px 18px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={handleSave} style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '9px 22px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {isEditMode ? '💾 Save Changes' : '📅 Schedule Meeting'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
