import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import toast from 'react-hot-toast'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { errorText, field, getToken, muted, smallBtn } from './huddleUi'

/** Quick polls inside the call: start one, everyone votes, results update live. */
export default function PollsPanel({ meetingId }: { meetingId?: string | number }) {
  const polls = useQuery(api.huddle.listPolls, { token: getToken() }) ?? []
  const create = useMutation(api.huddle.createPoll)
  const vote = useMutation(api.huddle.vote)
  const setStatus = useMutation(api.huddle.setPollStatus)
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState(['', ''])

  const open = polls.filter((p) => p.status === 'open')
  const submit = async () => {
    try {
      await create({ token: getToken(), question: q, options: opts, ...(meetingId ? { meeting_id: String(meetingId) as Id<'meetings'> } : {}) })
      setQ(''); setOpts(['', ''])
    } catch (e) { toast.error(errorText(e, 'Could not start the poll')) }
  }
  return (
    <div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
        <input aria-label="Poll question" style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the room a question" maxLength={300} />
        {opts.map((o, i) => <input key={i} aria-label={`Answer ${i + 1}`} style={field} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Answer ${i + 1}`} maxLength={120} />)}
        <div style={{ display: 'flex', gap: 6 }}>
          {opts.length < 6 && <button style={smallBtn} onClick={() => setOpts([...opts, ''])}>+ Answer</button>}
          <button style={{ ...smallBtn, background: '#2563eb' }} onClick={submit}>Start poll</button>
        </div>
      </div>
      {open.length === 0 && <p style={muted}>No open polls.</p>}
      {open.map((p) => (
        <div key={p._id} style={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <strong>{p.question}</strong> <span style={muted}>by {p.created_by_name ?? 'someone'}</span>
          {p.options.map((o: string, i: number) => {
            const pct = p.total ? Math.round((p.counts[i] / p.total) * 100) : 0
            return (
              <button key={i} onClick={() => vote({ token: getToken(), poll_id: p._id, option_index: i }).catch((e) => toast.error(errorText(e, 'Could not vote')))}
                style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 13,
                  border: p.my_vote === i ? '1px solid #60a5fa' : '1px solid #334155', background: `linear-gradient(90deg, rgba(37,99,235,.45) ${pct}%, transparent ${pct}%)` }}>
                {o} <span style={{ float: 'right' }}>{p.counts[i]} · {pct}%</span>
              </button>
            )
          })}
          <div style={{ ...muted, marginTop: 6 }}>{p.total} vote{p.total === 1 ? '' : 's'}{p.can_manage && <button style={{ ...smallBtn, marginLeft: 8 }} onClick={() => setStatus({ token: getToken(), poll_id: p._id, status: 'closed' })}>Close poll</button>}</div>
        </div>
      ))}
    </div>
  )
}
