import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { field, getToken, muted, smallBtn } from './huddleUi'

export default function ChatPanel({ roomId, name }: { roomId: string; name: string }) {
  const messages = useQuery(api.huddleCall.chat, { token: getToken(), room_id: roomId }) ?? []
  const send = useMutation(api.huddleCall.sendChat)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  const submit = () => { const t = text.trim(); if (!t) return; setText(''); send({ token: getToken(), room_id: roomId, name, text: t }).catch(() => setText(t)) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 260 }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {messages.length === 0 && <p style={muted}>No messages yet. Links and quick questions go here.</p>}
        {messages.map((m) => (
          <p key={m.id} style={{ margin: '0 0 8px', overflowWrap: 'anywhere' }}>
            <strong>{m.name}</strong> <span style={{ color: '#64748b', fontSize: 11 }}>{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><br />
            {m.text.split(/(https?:\/\/\S+)/g).map((part, i) => /^https?:\/\//.test(part)
              ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>{part}</a>
              : part)}
          </p>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit() }} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input aria-label="Chat message" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" maxLength={2000} style={field} />
        <button type="submit" style={{ ...smallBtn, background: '#2563eb' }}>Send</button>
      </form>
    </div>
  )
}
