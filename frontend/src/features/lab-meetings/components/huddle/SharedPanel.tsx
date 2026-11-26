import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import toast from 'react-hot-toast'
import { api } from '../../../../../convex/_generated/api'
import { errorText, field, getToken, huddleAuth, muted, smallBtn } from './huddleUi'

const ICON: Record<string, string> = { protocol: '📋', sample: '🧪', experiment: '🔬' }

/** Put a protocol, sample or experiment in front of everyone in the call. */
export default function SharedPanel({ roomId, name }: { roomId: string; name: string }) {
  const [q, setQ] = useState('')
  const found = useQuery(api.huddleCall.searchItems, { token: getToken(), q }) ?? []
  const shared = useQuery(api.huddleCall.sharedItems, { ...huddleAuth(), room_id: roomId }) ?? []
  const share = useMutation(api.huddleCall.shareItem)

  return (
    <div>
      <div style={{ ...muted, marginBottom: 6 }}>Shown to everyone in the call</div>
      {shared.length === 0 && <p style={muted}>Nothing shared yet.</p>}
      {shared.map((s) => (
        <div key={s.id} style={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div><span aria-hidden>{ICON[s.kind] ?? '📄'}</span> <strong>{s.title}</strong></div>
          <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2, overflowWrap: 'anywhere' }}>{s.detail}</div>
          <div style={{ ...muted, marginTop: 4 }}>shared by {s.name}</div>
        </div>
      ))}
      <hr style={{ border: 0, borderTop: '1px solid #1e293b', margin: '12px 0' }} />
      <input aria-label="Search lab items" style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search protocols, samples, experiments" />
      <div style={{ marginTop: 8 }}>
        {found.length === 0 && <p style={muted}>Nothing found.</p>}
        {found.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
            <span aria-hidden>{ICON[f.kind]}</span>
            <span style={{ flex: 1, fontSize: 13, overflowWrap: 'anywhere' }}>{f.title}</span>
            <button style={{ ...smallBtn, background: '#2563eb' }} onClick={() => share({ token: getToken(), room_id: roomId, name, ...f }).then(() => toast.success('Shared with the call')).catch((e) => toast.error(errorText(e, 'Could not share')))}>Share</button>
          </div>
        ))}
      </div>
    </div>
  )
}
