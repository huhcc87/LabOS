import React, { useState } from 'react'
import type { ProgressReport } from '../types/meeting.types'

interface Props {
  reports: ProgressReport[]
  isPiOrAdmin: boolean
  currentUserName: string
  meetingTitle: string
  onSubmit: (report: Omit<ProgressReport, 'id' | 'meetingId' | 'submittedAt' | 'status'>) => void
  onAcknowledge: (reportId: string, comment: string) => void
}

export default function ProgressReportPanel({ reports, isPiOrAdmin, currentUserName, meetingTitle, onSubmit, onAcknowledge }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [ackTarget, setAckTarget] = useState<string | null>(null)
  const [ackComment, setAckComment] = useState('')

  const myReport = reports.find(r => r.submitterName === currentUserName)

  // Form state
  const [summary, setSummary] = useState('')
  const [accomplishments, setAccomplishments] = useState(['', '', ''])
  const [challenges, setChallenges] = useState(['', ''])
  const [nextSteps, setNextSteps] = useState(['', '', ''])
  const [papersRead, setPapersRead] = useState([''])

  function handleSubmit() {
    onSubmit({
      submittedBy: currentUserName, submitterName: currentUserName, submitterRole: 'staff',
      summary, accomplishments: accomplishments.filter(Boolean), challenges: challenges.filter(Boolean),
      nextSteps: nextSteps.filter(Boolean), papersRead: papersRead.filter(Boolean),
    })
    setShowForm(false)
  }

  const listInp: React.CSSProperties = {
    flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    color: '#1e293b', padding: '6px 10px', fontSize: 13, outline: 'none',
  }

  function ListField({ label, items, setItems, placeholder, color }: { label: string; items: string[]; setItems: (v: string[]) => void; placeholder: string; color: string }) {
    return (
      <div>
        <label style={{ color: '#475569', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <span style={{ color, fontSize: 14, marginTop: 6 }}>•</span>
            <input style={listInp} value={item} onChange={e => { const n = [...items]; n[i] = e.target.value; setItems(n) }} placeholder={`${placeholder} ${i + 1}`} />
            {items.length > 1 && <button onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>}
          </div>
        ))}
        <button onClick={() => setItems([...items, ''])} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, padding: '2px 0' }}>+ Add</button>
      </div>
    )
  }

  return (
    <div>
      {/* Student: submit own report */}
      {!isPiOrAdmin && (
        <div style={{ marginBottom: 20 }}>
          {myReport ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>✓ Your progress report is submitted</div>
              {myReport.status === 'acknowledged' && myReport.piComment && (
                <div style={{ color: '#166534', fontSize: 13, marginTop: 8, padding: '8px 12px', background: '#dcfce7', borderRadius: 6 }}>
                  💬 PI feedback: <em>{myReport.piComment}</em>
                </div>
              )}
            </div>
          ) : showForm ? null : (
            <button onClick={() => setShowForm(true)} style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              📊 Submit Progress Report for {meetingTitle}
            </button>
          )}
        </div>
      )}

      {/* Progress report form */}
      {!isPiOrAdmin && showForm && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: '#1e293b', fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>Progress Report — {meetingTitle}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ color: '#475569', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Summary *</label>
              <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} placeholder="One-sentence summary of your progress this week..."
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#1e293b', padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <ListField label="✅ Accomplishments" items={accomplishments} setItems={setAccomplishments} placeholder="Accomplishment" color="#16a34a" />
            <ListField label="⚠ Challenges / Blockers" items={challenges} setItems={setChallenges} placeholder="Challenge" color="#dc2626" />
            <ListField label="➡ Next Steps" items={nextSteps} setItems={setNextSteps} placeholder="Next step" color="#6366f1" />
            <ListField label="📖 Papers Read (optional)" items={papersRead} setItems={setPapersRead} placeholder="Author et al. Year — Title" color="#8b5cf6" />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={!summary.trim()} style={{ background: !summary.trim() ? '#e2e8f0' : '#6366f1', border: 'none', borderRadius: 6, color: !summary.trim() ? '#94a3b8' : '#fff', padding: '8px 20px', cursor: !summary.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All reports (PI sees all, student sees own) */}
      <div>
        <div style={{ color: '#475569', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          {isPiOrAdmin ? `ALL REPORTS (${reports.length})` : 'YOUR REPORT'}
        </div>
        {reports.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: 8 }}>No progress reports submitted yet</div>}
        {(isPiOrAdmin ? reports : reports.filter(r => r.submitterName === currentUserName)).map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{r.submitterName.charAt(0)}</div>
                  <div>
                    <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 700 }}>{r.submitterName}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>{r.submitterRole} · {new Date(r.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
              <span style={{ background: r.status === 'acknowledged' ? '#dcfce7' : '#fef9c3', color: r.status === 'acknowledged' ? '#16a34a' : '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                {r.status === 'acknowledged' ? '✓ Acknowledged' : '📬 Submitted'}
              </span>
            </div>

            <p style={{ color: '#1e293b', fontSize: 13, fontWeight: 500, margin: '0 0 10px', fontStyle: 'italic' }}>{r.summary}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {r.accomplishments.length > 0 && (
                <div>
                  <div style={{ color: '#16a34a', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>✅ ACCOMPLISHMENTS</div>
                  {r.accomplishments.map((a, i) => <div key={i} style={{ color: '#1e293b', fontSize: 12, marginBottom: 2 }}>• {a}</div>)}
                </div>
              )}
              {r.challenges.length > 0 && (
                <div>
                  <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>⚠ CHALLENGES</div>
                  {r.challenges.map((c, i) => <div key={i} style={{ color: '#1e293b', fontSize: 12, marginBottom: 2 }}>• {c}</div>)}
                </div>
              )}
            </div>
            {r.nextSteps.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#6366f1', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>➡ NEXT STEPS</div>
                {r.nextSteps.map((n, i) => <div key={i} style={{ color: '#1e293b', fontSize: 12, marginBottom: 2 }}>• {n}</div>)}
              </div>
            )}
            {r.papersRead && r.papersRead.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#8b5cf6', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>📖 PAPERS READ</div>
                {r.papersRead.map((p, i) => <div key={i} style={{ color: '#475569', fontSize: 12, marginBottom: 2 }}>• {p}</div>)}
              </div>
            )}
            {r.piComment && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6 }}>
                <span style={{ color: '#1e40af', fontSize: 12 }}>💬 PI: <em>{r.piComment}</em></span>
              </div>
            )}
            {isPiOrAdmin && r.status === 'submitted' && (
              ackTarget === r.id ? (
                <div style={{ marginTop: 10 }}>
                  <textarea value={ackComment} onChange={e => setAckComment(e.target.value)} placeholder="Optional feedback..." rows={2}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#1e293b', padding: '6px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setAckTarget(null); setAckComment('') }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                    <button onClick={() => { onAcknowledge(r.id, ackComment); setAckTarget(null); setAckComment('') }} style={{ background: '#16a34a', border: 'none', borderRadius: 6, color: '#fff', padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Acknowledge</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAckTarget(r.id)} style={{ marginTop: 10, background: '#eff6ff', border: 'none', borderRadius: 6, color: '#6366f1', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  ✓ Acknowledge + Feedback
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
