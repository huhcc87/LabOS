import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import toast from 'react-hot-toast'
import { api } from '../../../../../convex/_generated/api'
import { clock, errorText, getToken, muted, smallBtn } from './huddleUi'

export interface AgendaLite { title: string; duration: number; presenter: string }

/** The meeting agenda with a timer for the current topic. The host moves everyone to the next topic. */
export default function AgendaPanel({ roomId, items, index, isHost }: { roomId: string; items: AgendaLite[]; index: number; isHost: boolean }) {
  const setAgenda = useMutation(api.huddleCall.setAgenda)
  const [elapsed, setElapsed] = useState(0)
  const since = useRef(Date.now())
  // Each person times the topic from when they saw it start, so clocks that disagree do not matter.
  useEffect(() => { since.current = Date.now(); setElapsed(0) }, [index])
  useEffect(() => { const t = setInterval(() => setElapsed(Math.floor((Date.now() - since.current) / 1000)), 1000); return () => clearInterval(t) }, [])

  const go = (i: number) => setAgenda({ token: getToken(), room_id: roomId, index: i }).catch((e) => toast.error(errorText(e, 'Could not change topic')))
  if (!items.length) return <p style={muted}>This meeting has no approved agenda items. Add them on the meeting, and they show here.</p>
  const cur = Math.min(index, items.length - 1)
  const over = elapsed > items[cur].duration * 60
  return (
    <div>
      <div style={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <div style={muted}>NOW · topic {cur + 1} of {items.length}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{items[cur].title}</div>
        <div style={muted}>{items[cur].presenter ? `${items[cur].presenter} · ` : ''}{items[cur].duration} min planned</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: over ? '#f87171' : '#4ade80', marginTop: 4 }}>{clock(elapsed)}{over ? ' over time' : ''}</div>
        {isHost
          ? <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button style={smallBtn} disabled={cur === 0} onClick={() => go(cur - 1)}>Back</button>
              <button style={{ ...smallBtn, background: '#2563eb' }} disabled={cur >= items.length - 1} onClick={() => go(cur + 1)}>Next topic</button>
            </div>
          : <div style={{ ...muted, marginTop: 6 }}>The host moves to the next topic.</div>}
      </div>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((a, i) => (
          <li key={i} style={{ padding: '4px 0', color: i === cur ? '#fff' : i < cur ? '#64748b' : '#cbd5e1', textDecoration: i < cur ? 'line-through' : 'none' }}>
            {a.title} <span style={muted}>({a.duration} min)</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
