import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { huddleApi } from '../../../lib/api'

interface PollRow {
  id: string; question: string; options: string[]; status: 'open' | 'closed'; counts: number[]; total: number
  my_vote: number | null; can_manage: boolean; created_by_name?: string; created_at: number
}

const errText = (e: unknown) => (e as { data?: string; message?: string })?.data ?? (e as Error)?.message ?? 'Something went wrong.'
const field: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, width: '100%', boxSizing: 'border-box' }

/** Lab polls: quick group decisions. One vote each, changeable until the poll is closed. Shared by the whole lab. */
export default function PollsTab() {
  const [polls, setPolls] = useState<PollRow[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setPolls(((await huddleApi.listPolls()).data as unknown as PollRow[])) } catch (e) { toast.error(errText(e)); setPolls([]) }
  }, [])
  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); await load() } catch (e) { toast.error(errText(e)) }
  }

  const create = async () => {
    setBusy(true)
    try {
      await huddleApi.createPoll(question, options)
      toast.success('Poll created')
      setCreating(false); setQuestion(''); setOptions(['', '']); await load()
    } catch (e) { toast.error(errText(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Lab polls</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Quick group decisions. One vote each; you can change yours until the poll is closed.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}>{creating ? 'Cancel' : '+ Create poll'}</button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 8 }} role="region" aria-label="New poll">
          <label htmlFor="poll-q" style={{ fontSize: 12, fontWeight: 600 }}>Question</label>
          <input id="poll-q" style={field} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Which day suits the journal club?" maxLength={300} />
          <div style={{ fontSize: 12, fontWeight: 600 }}>Answers</div>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input style={field} aria-label={`Answer ${i + 1}`} value={o} placeholder={`Answer ${i + 1}`} maxLength={120}
                onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
              {options.length > 2 && <button className="btn btn-secondary" aria-label={`Remove answer ${i + 1}`} onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            {options.length < 10 && <button className="btn btn-secondary" onClick={() => setOptions((p) => [...p, ''])}>+ Add answer</button>}
            <button className="btn btn-primary" disabled={busy || !question.trim() || options.filter((o) => o.trim()).length < 2} onClick={() => void create()}>Create poll</button>
          </div>
        </div>
      )}

      {polls === null && <p style={{ color: 'var(--text-muted)' }}>Loading polls…</p>}
      {polls?.length === 0 && !creating && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No polls yet. Create one to gather the lab's opinion.</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {polls?.map((p) => (
          <div key={p.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.question}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {p.status === 'open' ? 'Open' : 'Closed'} · {p.total} vote{p.total === 1 ? '' : 's'}{p.created_by_name ? ` · by ${p.created_by_name}` : ''}
                </div>
              </div>
              {p.can_manage && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" onClick={() => void run(() => huddleApi.setPollStatus(p.id, p.status === 'open' ? 'closed' : 'open'))}>{p.status === 'open' ? 'Close' : 'Reopen'}</button>
                  <button className="btn btn-secondary" onClick={() => { if (window.confirm('Delete this poll and its votes?')) void run(() => huddleApi.deletePoll(p.id), 'Poll deleted') }}>Delete</button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {p.options.map((text, i) => {
                const pct = p.total ? Math.round((p.counts[i] / p.total) * 100) : 0
                const mine = p.my_vote === i
                return (
                  <button key={i} disabled={p.status !== 'open'} onClick={() => void run(() => huddleApi.vote(p.id, i))} aria-pressed={mine}
                    style={{ position: 'relative', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1px solid ${mine ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)', cursor: p.status === 'open' ? 'pointer' : 'default', overflow: 'hidden' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--accent)', opacity: 0.14 }} />
                    <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{mine ? '✓ ' : ''}{text}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.counts[i]} · {pct}%</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
