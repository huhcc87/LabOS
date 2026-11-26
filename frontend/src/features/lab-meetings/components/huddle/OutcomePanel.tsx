import { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import toast from 'react-hot-toast'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { btn, errorText, field, getToken, muted, smallBtn } from './huddleUi'

export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Chinese', 'Japanese', 'Arabic', 'Hindi']

interface Act { title: string; assignee: string; due: string; on: boolean }
interface Props {
  roomId: string; meetingId?: string | number; title: string
  lines: { name: string; text: string }[]; notes: string; people: string[]
  summary: { text: string; source: string } | null; summarising: boolean
  language: string; setLanguage: (l: string) => void; onWrite: () => void
  recordingFile: Blob | null; recordingName: string; userName: string
}

/** Summary, action items that become tasks, and recordings kept in LabOS. */
export default function OutcomePanel(p: Props) {
  const extract = useAction(api.huddleCall.extractActions)
  const saveOutcome = useMutation(api.huddleCall.saveOutcome)
  const uploadUrl = useMutation(api.huddleCall.uploadUrl)
  const saveRecording = useMutation(api.huddleCall.saveRecording)
  const removeRecording = useMutation(api.huddleCall.removeRecording)
  const recordings = useQuery(api.huddleCall.recordings, { token: getToken(), room_id: p.roomId }) ?? []
  const [acts, setActs] = useState<Act[] | null>(null)
  const [finding, setFinding] = useState(false)
  const [toTasks, setToTasks] = useState(true)
  const [toMeeting, setToMeeting] = useState(true)
  const [toKnowledge, setToKnowledge] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const find = async () => {
    setFinding(true)
    try {
      const r = await extract({ token: getToken(), lines: p.lines, notes: p.notes, people: p.people, today: new Date().toISOString() })
      setActs(r.actions.map((a) => ({ ...a, on: true })))
      if (!r.actions.length) toast('No action items found.')
    } catch (e) { toast.error(errorText(e, 'Could not read the action items')) } finally { setFinding(false) }
  }
  const edit = (i: number, patch: Partial<Act>) => setActs((a) => a && a.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const saveAll = async () => {
    setSaving(true)
    try {
      const chosen = (acts ?? []).filter((a) => a.on && a.title.trim()).map(({ title, assignee, due }) => ({ title, assignee, due }))
      const r = await saveOutcome({
        token: getToken(), room_id: p.roomId, ...(p.meetingId && toMeeting ? { meeting_id: String(p.meetingId) as Id<'meetings'> } : {}),
        title: p.title, summary: p.summary?.text ?? '', actions: chosen, make_tasks: toTasks, save_article: toKnowledge,
      })
      toast.success([r.minutes && 'minutes updated', r.actions && `${r.actions} action item${r.actions === 1 ? '' : 's'} on the meeting`, r.tasks && `${r.tasks} task${r.tasks === 1 ? '' : 's'} created`, r.article && 'saved to the knowledge base'].filter(Boolean).join(', ') || 'Nothing to save')
    } catch (e) { toast.error(errorText(e, 'Could not save')) } finally { setSaving(false) }
  }

  const upload = async () => {
    if (!p.recordingFile) return
    setUploading(true)
    try {
      const url = await uploadUrl({ token: getToken() })
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': p.recordingFile.type || 'video/webm' }, body: p.recordingFile })
      if (!res.ok) throw new Error('Upload failed')
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
      await saveRecording({ token: getToken(), room_id: p.roomId, ...(p.meetingId ? { meeting_id: String(p.meetingId) as Id<'meetings'> } : {}), storage_id: storageId, file_name: p.recordingName, size: p.recordingFile.size, by: p.userName })
      toast.success('Recording saved in LabOS')
    } catch (e) { toast.error(errorText(e, 'Could not save the recording')) } finally { setUploading(false) }
  }

  const hasSomething = (acts?.some((a) => a.on) ?? false) || !!p.summary
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <select aria-label="Summary language" style={{ ...field, width: 'auto' }} value={p.language} onChange={(e) => p.setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
        <button style={{ ...btn(), borderRadius: 8, background: '#2563eb', flex: 1 }} disabled={p.summarising} onClick={p.onWrite}>
          {p.summarising ? 'Writing…' : p.summary ? 'Write it again' : 'Write AI summary'}
        </button>
      </div>
      {p.summary
        ? <><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{p.summary.text}</pre>
            <p style={muted}>Written by: {p.summary.source === 'plain' ? 'plain list (no AI key set up)' : p.summary.source}. Check it before you share it.</p></>
        : <p style={muted}>Uses the transcript and the shared notes. Turn on the transcript or write notes first.</p>}

      <hr style={{ border: 0, borderTop: '1px solid #1e293b', margin: '12px 0' }} />
      <button style={{ ...btn(), borderRadius: 8, width: '100%' }} disabled={finding} onClick={find}>{finding ? 'Reading…' : 'Find action items'}</button>
      {acts && acts.map((a, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 6, marginTop: 8, background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: 8 }}>
          <input type="checkbox" aria-label="Include" checked={a.on} onChange={(e) => edit(i, { on: e.target.checked })} />
          <input aria-label="Task" style={field} value={a.title} onChange={(e) => edit(i, { title: e.target.value })} />
          <span />
          <div style={{ display: 'flex', gap: 6 }}>
            <input aria-label="Assigned to" list="huddle-people" style={field} value={a.assignee} onChange={(e) => edit(i, { assignee: e.target.value })} placeholder="Who" />
            <input aria-label="Due date" type="date" style={{ ...field, width: 150 }} value={a.due} onChange={(e) => edit(i, { due: e.target.value })} />
          </div>
        </div>
      ))}
      <datalist id="huddle-people">{p.people.map((n) => <option key={n} value={n} />)}</datalist>

      {hasSomething && (
        <div style={{ marginTop: 10, display: 'grid', gap: 4, fontSize: 13 }}>
          <label><input type="checkbox" checked={toTasks} onChange={(e) => setToTasks(e.target.checked)} /> Create tasks for the action items</label>
          {p.meetingId && <label><input type="checkbox" checked={toMeeting} onChange={(e) => setToMeeting(e.target.checked)} /> Add summary to the meeting minutes and action items</label>}
          <label><input type="checkbox" checked={toKnowledge} onChange={(e) => setToKnowledge(e.target.checked)} /> Save summary to the knowledge base</label>
          <button style={{ ...btn(), borderRadius: 8, background: '#16a34a', marginTop: 4 }} disabled={saving} onClick={saveAll}>{saving ? 'Saving…' : 'Save to LabOS'}</button>
        </div>
      )}

      <hr style={{ border: 0, borderTop: '1px solid #1e293b', margin: '12px 0' }} />
      <div style={{ ...muted, marginBottom: 6 }}>RECORDINGS KEPT IN LABOS</div>
      {p.recordingFile && <button style={{ ...btn(), borderRadius: 8, width: '100%', marginBottom: 8 }} disabled={uploading} onClick={upload}>{uploading ? 'Uploading…' : `Save my recording to LabOS (${(p.recordingFile.size / 1048576).toFixed(1)} MB)`}</button>}
      {recordings.length === 0 && <p style={muted}>None saved for this call.</p>}
      {recordings.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
          <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{r.file_name} <span style={muted}>· {r.by} · {(r.size / 1048576).toFixed(1)} MB</span></span>
          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ ...smallBtn, textDecoration: 'none' }}>Open</a>}
          <button style={{ ...smallBtn, background: '#7f1d1d' }} onClick={() => { if (window.confirm('Delete this recording for everyone?')) removeRecording({ token: getToken(), id: r.id as Id<'huddle_recordings'> }).catch((e) => toast.error(errorText(e, 'Could not delete'))) }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
