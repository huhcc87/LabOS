import toast from 'react-hot-toast'
import type { Meeting } from '../types/meeting.types'
import { meetingJoinLink } from '../utils/meetingUtils'

/**
 * The call link for a scheduled meeting. It exists as soon as the meeting does, so it can be sent at once:
 * copy it, email it, or send it by WhatsApp or any app the device offers. Anyone with a LabOS account in the lab can join from anywhere.
 */
export default function MeetingShare({ meeting: m }: { meeting: Meeting }) {
  const link = meetingJoinLink(m.id)
  const when = new Date(m.scheduledAt)
  const local = when.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const message = `You are invited to "${m.title}"\n\nWhen: ${local}\n(${when.toUTCString()})\n\nJoin the video call: ${link}\n\nSign in to LabOS with your lab account, then you will land in the call. Allow your camera and microphone when the browser asks.`

  const copy = () => navigator.clipboard.writeText(link).then(() => toast.success('Call link copied'), () => toast.error('Could not copy'))
  const email = () => { window.location.href = `mailto:?subject=${encodeURIComponent(`Invitation: ${m.title}`)}&body=${encodeURIComponent(message)}` }
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  const share = () => navigator.share({ title: m.title, text: message }).catch(() => undefined)

  // Calendar entry with the call link in it: works with Outlook, Apple Calendar and Google Calendar.
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const ics = () => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LabOS//LabHuddle//EN', 'BEGIN:VEVENT', `UID:${m.id}@labos`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(m.scheduledAt)}`, `DTEND:${stamp(m.endTime)}`, `SUMMARY:${esc(m.title)}`, `DESCRIPTION:${esc(`Join the video call: ${link}`)}`, `LOCATION:${esc(link)}`, `URL:${link}`, 'END:VEVENT', 'END:VCALENDAR']
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${m.title.replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'meeting'}.ics`; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  const google = () => window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title)}&dates=${stamp(m.scheduledAt)}/${stamp(m.endTime)}&details=${encodeURIComponent(`Join the video call: ${link}`)}&location=${encodeURIComponent(link)}`, '_blank', 'noopener,noreferrer')

  const b: React.CSSProperties = { background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
  return (
    <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>VIDEO CALL LINK (works from anywhere)</div>
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Video call link"
        style={{ width: '100%', fontSize: 12, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#334155' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <button type="button" style={b} onClick={copy}>Copy link</button>
        <button type="button" style={b} onClick={email}>Email invite</button>
        <button type="button" style={b} onClick={whatsapp}>WhatsApp</button>
        {typeof navigator.share === 'function' && <button type="button" style={b} onClick={share}>Share…</button>}
        <button type="button" style={b} onClick={ics}>Add to calendar (.ics)</button>
        <button type="button" style={b} onClick={google}>Google Calendar</button>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>People in your lab also get the usual reminders. People outside need a LabOS account in your lab to join.</div>
    </div>
  )
}
