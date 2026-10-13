import { useMemo } from 'react'
import toast from 'react-hot-toast'

interface Props {
  roomId: string
  meetingId?: string | number
  meetingTitle?: string
  userName: string
  userId: string | number
  onLeave: () => void
}

/**
 * Video calls run on Jitsi Meet: free, no account, camera/mic/screen-share/chat all built in.
 * Set VITE_JITSI_URL to use your own Jitsi server (recommended if calls may involve patient data).
 * The call opens in its own tab, because public Jitsi limits calls embedded inside other sites.
 */
const JITSI = ((import.meta.env.VITE_JITSI_URL as string | undefined) || 'https://meet.jit.si').replace(/\/$/, '')

export default function VideoCallRoom({ roomId, meetingTitle, userName, onLeave }: Props) {
  const callUrl = useMemo(() => {
    const room = `LabOS-${roomId.replace(/[^A-Za-z0-9]/g, '')}`
    const hash = `#userInfo.displayName="${encodeURIComponent(userName || 'Guest')}"&config.prejoinPageEnabled=true`
    return `${JITSI}/${room}${hash}`
  }, [roomId, userName])
  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`
  const usingPublicServer = JITSI === 'https://meet.jit.si'

  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Could not copy'))

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Video call" style={{ padding: 16 }}>
      <div className="modal-panel" style={{ width: '100%', maxWidth: 520, padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{meetingTitle || 'LabHuddle call'}</h2>
        <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 14 }}>Your call room is ready. It opens in a new tab with camera, microphone, screen sharing and chat.</p>

        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-primary" style={{ padding: '12px 16px', fontSize: 15 }}
            onClick={() => window.open(callUrl, '_blank', 'noopener,noreferrer')}>Join the call</button>
          <button className="btn btn-secondary" onClick={() => copy(`${JITSI}/LabOS-${roomId.replace(/[^A-Za-z0-9]/g, '')}`, 'Call link')}>Copy call link (share with anyone)</button>
          <button className="btn btn-secondary" onClick={() => copy(inviteUrl, 'LabOS invite link')}>Copy LabOS invite link (members only)</button>
        </div>

        <ul style={{ margin: '16px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <li>Allow camera and microphone when your browser asks.</li>
          <li>Anyone who has the call link can join, so only send it to the people you invite.</li>
          {usingPublicServer && <li>Calls use the public Jitsi service. Do not discuss patient data on it. To use your own server, set <code>VITE_JITSI_URL</code>.</li>}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn btn-secondary" onClick={onLeave}>Close</button>
        </div>
      </div>
    </div>
  )
}
