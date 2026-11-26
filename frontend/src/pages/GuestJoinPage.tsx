import { Component, useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../context/AuthContext'
import VideoCallRoom from '../features/lab-meetings/components/VideoCallRoom'
import { setGuestSession } from '../features/lab-meetings/components/huddle/huddleUi'

/**
 * Where a guest link (/?guest=<code>) lands. No LabOS account needed: the guest types a name, asks to join one call,
 * and waits until the host lets them in. A signed-in member who opens the link is simply sent into the call.
 */
interface Saved { guest: string; room_id: string; title: string; name: string }
const key = (code: string) => `labos.huddle.guest.${code}`
const read = (code: string): Saved | null => { try { return JSON.parse(sessionStorage.getItem(key(code)) ?? 'null') as Saved | null } catch { return null } }

/** If the call stops accepting this guest (removed, link cancelled, expired) the call's queries throw: show a plain message instead of a crash. */
class Lost extends Component<{ onBack: () => void; children: ReactNode }, { lost: boolean }> {
  state = { lost: false }
  static getDerivedStateFromError() { return { lost: true } }
  render() {
    if (!this.state.lost) return this.props.children
    return <Card><h2 style={{ margin: '0 0 8px' }}>You are no longer in this call</h2><p style={{ color: '#94a3b8' }}>The host may have removed you, or the guest link was cancelled or expired.</p><button style={primary} onClick={this.props.onBack}>Back</button></Card>
  }
}

const primary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }
const Card = ({ children }: { children: ReactNode }) => (
  <div style={{ minHeight: '100vh', background: '#0b1220', color: '#fff', display: 'grid', placeItems: 'center', padding: 16 }}>
    <div style={{ width: '100%', maxWidth: 420, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>{children}</div>
  </div>
)

export default function GuestJoinPage({ code }: { code: string }) {
  const { user } = useAuth()
  const info = useQuery(api.huddleGuest.linkInfo, { code })
  const join = useMutation(api.huddleGuest.guestJoin)
  const [saved, setSaved] = useState<Saved | null>(() => { const s = read(code); if (s) setGuestSession(s.guest); return s })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [left, setLeft] = useState(false)

  // A member does not need the guest door: go straight to the call.
  useEffect(() => { if (user && info?.valid) window.location.replace(`/?room=${encodeURIComponent(info.room_id)}`) }, [user, info])

  const reset = () => { sessionStorage.removeItem(key(code)); setGuestSession(undefined); setSaved(null); setLeft(false) }

  if (saved && !left) {
    return (
      <Lost onBack={reset}>
        <VideoCallRoom roomId={saved.room_id} meetingTitle={saved.title} userName={saved.name} userId={0} onLeave={() => { sessionStorage.removeItem(key(code)); setGuestSession(undefined); setLeft(true) }} />
      </Lost>
    )
  }
  if (left) return <Card><h2 style={{ margin: '0 0 8px' }}>You left the call</h2><p style={{ color: '#94a3b8' }}>Thanks for joining. You can close this tab, or ask the host for a new link to come back.</p></Card>
  if (info === undefined || user) return <Card><p style={{ margin: 0, color: '#94a3b8' }}>Opening the call…</p></Card>
  if (!info.valid) return <Card><h2 style={{ margin: '0 0 8px' }}>This guest link does not work</h2><p style={{ color: '#94a3b8' }}>It has expired or was cancelled. Ask the person who invited you for a new link.</p></Card>

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const r = await join({ code, name })
      const s: Saved = { guest: r.guest, room_id: r.room_id, title: r.title, name: `${name.replace(/\s+/g, ' ').trim().slice(0, 60)} (guest)` }
      sessionStorage.setItem(key(code), JSON.stringify(s))
      setGuestSession(s.guest)
      setSaved(s)
    } catch (e) {
      setError(String((e as { data?: string; message?: string })?.data ?? (e as Error).message ?? 'Could not join').replace(/^.*Uncaught ConvexError:\s*/, '').slice(0, 200))
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>{info.title}</h1>
      <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14 }}>You are invited as a guest. Type your name and ask to join: the host will let you in.</p>
      <form onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 13, color: '#94a3b8' }}>Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} placeholder="First and last name"
            style={{ display: 'block', width: '100%', marginTop: 4, background: '#020617', color: '#fff', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 16 }} />
        </label>
        {error && <p role="alert" style={{ margin: 0, background: '#78350f', padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>{error}</p>}
        <button type="submit" style={{ ...primary, opacity: busy || name.trim().length < 2 ? 0.6 : 1 }} disabled={busy || name.trim().length < 2}>{busy ? 'Asking…' : 'Ask to join'}</button>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Guests can see and hear the call, chat and use the whiteboard. They cannot see any lab data. Your camera and microphone are only used in this call.</p>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Have a LabOS account? <a href="/" style={{ color: '#60a5fa' }}>Sign in</a> and ask the host for the normal invite link.</p>
      </form>
    </Card>
  )
}
