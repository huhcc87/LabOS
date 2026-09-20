import React, { useState, useEffect } from 'react'
import type { Meeting } from '../types/meeting.types'
import { formatMeetingDate } from '../utils/meetingUtils'

interface Props {
  meeting: Meeting
  isPiOrAdmin: boolean
  onSave: (text: string) => void
  onPublish: () => void
}

export default function MinutesEditor({ meeting, isPiOrAdmin, onSave, onPublish }: Props) {
  const [text, setText] = useState(meeting.minutes)
  const [isDirty, setIsDirty] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)

  useEffect(() => { setText(meeting.minutes) }, [meeting.minutes])

  function handleChange(v: string) { setText(v); setIsDirty(true) }
  function handleSave() { onSave(text); setIsDirty(false) }

  function generateTemplate() {
    const approved = meeting.agenda.filter(a => a.status === 'approved' || a.status === 'presented')
    const tmpl = `## Lab Meeting Minutes — ${meeting.title}\n\n**Date:** ${formatMeetingDate(meeting.scheduledAt)}\n**Organizer:** ${meeting.organizer}\n**Attendees:** ${meeting.attendees.map(a => `${a.name} (${a.role})`).join(', ')}\n\n---\n\n${approved.map(a => `### ${a.order}. ${a.title}\n\n*Presenter: ${a.presenter} — ${a.durationMinutes} min*\n\n${a.description || '(Notes here...)'}\n\n**Decision / Outcome:**\n\n**Action items:**\n- \n`).join('\n---\n\n')}\n\n---\n\n*Minutes recorded by . Published by ${meeting.organizer}.*`
    setText(tmpl)
    setIsDirty(true)
  }

  if (meeting.minutesPublished) {
    return (
      <div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ color: '#166534', fontWeight: 700, fontSize: 14 }}>Minutes Published</div>
            <div style={{ color: '#16a34a', fontSize: 12 }}>Published on {meeting.minutesPublishedAt ? new Date(meeting.minutesPublishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'} — visible to all lab members</div>
          </div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#1e293b', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            {meeting.minutes || 'No minutes recorded.'}
          </pre>
        </div>
        {isPiOrAdmin && (
          <div style={{ marginTop: 12 }}>
            <textarea value={text} onChange={e => handleChange(e.target.value)} rows={20}
              style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', padding: '12px 14px', fontSize: 13, resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <button onClick={handleSave} disabled={!isDirty} style={{ background: isDirty ? '#6366f1' : '#e2e8f0', border: 'none', borderRadius: 6, color: isDirty ? '#fff' : '#94a3b8', padding: '8px 18px', cursor: isDirty ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                Update Minutes
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {!isPiOrAdmin ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div>Minutes have not been published yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>They will appear here once the PI publishes them.</div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
            <button onClick={generateTemplate} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, color: '#475569', padding: '7px 14px', cursor: 'pointer', fontSize: 12 }}>
              📋 Generate Template from Agenda
            </button>
            <button onClick={handleSave} disabled={!isDirty} style={{ background: isDirty ? '#6366f1' : '#e2e8f0', border: 'none', borderRadius: 6, color: isDirty ? '#fff' : '#94a3b8', padding: '7px 14px', cursor: isDirty ? 'pointer' : 'not-allowed', fontSize: 12 }}>
              💾 Save Draft
            </button>
            <button onClick={() => setConfirmPublish(true)} style={{ background: '#16a34a', border: 'none', borderRadius: 6, color: '#fff', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              📢 Publish to Lab
            </button>
          </div>

          <textarea
            value={text} onChange={e => handleChange(e.target.value)} rows={24}
            placeholder="Write meeting minutes here (Markdown supported)&#10;&#10;Tip: Click 'Generate Template' to auto-populate from today's agenda."
            style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', padding: '14px 16px', fontSize: 13, resize: 'vertical', lineHeight: 1.8, boxSizing: 'border-box', fontFamily: 'ui-monospace, monospace' }}
          />

          {isDirty && <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>● Unsaved changes</div>}

          {confirmPublish && (
            <div style={{ position: 'fixed', inset: 0, background: '#00000055', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, width: 'min(400px, 90vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <h3 style={{ color: '#1e293b', margin: '0 0 8px', fontSize: 16 }}>Publish Meeting Minutes?</h3>
                <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
                  Once published, minutes will be visible to all lab members. You can still edit them afterward.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setConfirmPublish(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { if (isDirty) onSave(text); onPublish(); setConfirmPublish(false) }} style={{ background: '#16a34a', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>
                    Publish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
