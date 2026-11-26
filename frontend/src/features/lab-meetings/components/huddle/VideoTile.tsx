import { useEffect, useRef, useState } from 'react'
import type { Tile } from '../../hooks/useHuddleCall'

// One audio context for every tile (browsers only allow a handful).
let sharedCtx: AudioContext | null = null
const audioCtx = (): AudioContext => (sharedCtx ??= new AudioContext())

/** True while the stream's sound is loud enough to be someone talking. */
function useSpeaking(stream: MediaStream): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (!stream.getAudioTracks().length) return
    const ctx = audioCtx()
    let src: MediaStreamAudioSourceNode
    try { src = ctx.createMediaStreamSource(stream) } catch { return }
    const an = ctx.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    const buf = new Uint8Array(an.frequencyBinCount)
    const t = setInterval(() => {
      an.getByteFrequencyData(buf)
      setSpeaking(buf.reduce((a, b) => a + b, 0) / buf.length > 18)
    }, 250)
    return () => { clearInterval(t); src.disconnect(); setSpeaking(false) }
  }, [stream])
  return speaking
}

export default function VideoTile({ tile, big, onPin, pinned, hand }: { tile: Tile; big?: boolean; onPin: () => void; pinned: boolean; hand?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current && ref.current.srcObject !== tile.stream) ref.current.srcObject = tile.stream }, [tile.stream])
  const speaking = useSpeaking(tile.stream) && tile.kind === 'cam'
  const hasVideo = tile.stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')
  return (
    <div onClick={onPin} title={pinned ? 'Click to unpin' : 'Click to enlarge'}
      style={{ position: 'relative', background: '#0f172a', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', minHeight: big ? 0 : 160, aspectRatio: big ? undefined : '16 / 9',
        border: tile.kind === 'screen' ? '2px solid #38bdf8' : speaking ? '2px solid #22c55e' : '1px solid #1e293b', height: big ? '100%' : undefined,
        boxShadow: speaking ? '0 0 0 3px rgba(34,197,94,.35)' : undefined, transition: 'box-shadow .15s' }}>
      <video ref={ref} autoPlay playsInline muted={tile.local}
        style={{ width: '100%', height: '100%', objectFit: tile.kind === 'screen' ? 'contain' : 'cover', transform: tile.local && tile.kind === 'cam' ? 'scaleX(-1)' : undefined, display: hasVideo ? 'block' : 'none' }} />
      {!hasVideo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 700, color: '#64748b' }}>{tile.name.trim().charAt(0).toUpperCase()}</div>}
      <span style={{ position: 'absolute', left: 8, bottom: 8, background: 'rgba(0,0,0,.65)', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>
        {tile.kind === 'screen' ? '🖥 ' : ''}{tile.name}
      </span>
      {hand && <span title="Hand raised" style={{ position: 'absolute', right: 8, top: 8, fontSize: 22 }}>✋</span>}
    </div>
  )
}
