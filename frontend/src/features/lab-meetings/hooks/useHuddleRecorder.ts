import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tile } from './useHuddleCall'

/**
 * Records the call on this computer only: a picture of everything on screen (all cameras and all shared screens)
 * plus everyone's sound mixed together. Nothing is uploaded; the file is saved by the person who recorded.
 */
const W = 1280
const H = 720
const FPS = 10

function grid(n: number, x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  if (n <= 0) return []
  const cols = Math.ceil(Math.sqrt(n * (w / h)))
  const c = Math.min(n, Math.max(1, cols))
  const rows = Math.ceil(n / c)
  const cw = w / c
  const ch = h / rows
  return Array.from({ length: n }, (_, i) => ({ x: x + (i % c) * cw, y: y + Math.floor(i / c) * ch, w: cw, h: ch }))
}

function paintTile(g: CanvasRenderingContext2D, v: HTMLVideoElement | undefined, label: string, r: { x: number; y: number; w: number; h: number }) {
  const pad = 4
  g.fillStyle = '#0f172a'; g.fillRect(r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2)
  if (v && v.videoWidth > 0) {
    const s = Math.min((r.w - pad * 2) / v.videoWidth, (r.h - pad * 2) / v.videoHeight)
    const dw = v.videoWidth * s
    const dh = v.videoHeight * s
    g.drawImage(v, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh)
  }
  g.font = '16px sans-serif'
  const tw = g.measureText(label).width + 12
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(r.x + pad, r.y + r.h - pad - 24, tw, 24)
  g.fillStyle = '#fff'; g.fillText(label, r.x + pad + 6, r.y + r.h - pad - 7)
}

export function useHuddleRecorder(getTiles: () => Tile[]) {
  const [recording, setRecording] = useState(false)
  const [file, setFile] = useState<Blob | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)
  const audio = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; src: Map<string, MediaStreamAudioSourceNode> } | null>(null)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const getTilesRef = useRef(getTiles)
  getTilesRef.current = getTiles

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current)
    audio.current?.ctx.close().catch(() => undefined)
    audio.current = null
    videos.current.forEach((v) => { v.srcObject = null })
    videos.current.clear()
  }, [])

  const start = useCallback(() => {
    if (rec.current || typeof MediaRecorder === 'undefined') return false
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const g = canvas.getContext('2d')!
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    audio.current = { ctx, dest, src: new Map() }

    const draw = () => {
      const tiles = getTilesRef.current()
      const a = audio.current
      for (const t of tiles) {
        if (!videos.current.has(t.id)) {
          const v = document.createElement('video')
          v.muted = true; v.playsInline = true; v.srcObject = t.stream
          v.play().catch(() => undefined)
          videos.current.set(t.id, v)
        }
        // Mix the sound of every stream (mine, everyone's, and shared-screen audio) into one track.
        if (a && !a.src.has(t.id) && t.stream.getAudioTracks().length) {
          try { const s = a.ctx.createMediaStreamSource(t.stream); s.connect(a.dest); a.src.set(t.id, s) } catch { /* no audio on this stream */ }
        }
      }
      g.fillStyle = '#020617'; g.fillRect(0, 0, W, H)
      const shares = tiles.filter((t) => t.kind === 'screen')
      const cams = tiles.filter((t) => t.kind === 'cam')
      if (shares.length) {
        const stripH = cams.length ? Math.round(H * 0.22) : 0
        grid(shares.length, 0, 0, W, H - stripH).forEach((r, i) => paintTile(g, videos.current.get(shares[i].id), shares[i].name, r))
        grid(cams.length, 0, H - stripH, W, stripH).forEach((r, i) => paintTile(g, videos.current.get(cams[i].id), cams[i].name, r))
      } else grid(cams.length, 0, 0, W, H).forEach((r, i) => paintTile(g, videos.current.get(cams[i].id), cams[i].name, r))
    }
    draw()
    timer.current = window.setInterval(draw, 1000 / FPS)

    const out = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()])
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
    const r = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 1_500_000 } : undefined)
    chunks.current = []
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
    r.start(2_000)
    rec.current = r
    setFile(null); setRecording(true)
    return true
  }, [])

  /** Stops recording and gives back the finished file (or null if nothing was recorded). */
  const stop = useCallback((): Promise<Blob | null> => new Promise((resolve) => {
    const r = rec.current
    if (!r) { resolve(null); return }
    r.onstop = () => {
      const blob = chunks.current.length ? new Blob(chunks.current, { type: 'video/webm' }) : null
      rec.current = null; cleanup(); setRecording(false); setFile(blob); resolve(blob)
    }
    if (r.state !== 'inactive') r.stop(); else r.onstop?.(new Event('stop'))
  }), [cleanup])

  useEffect(() => () => { if (rec.current && rec.current.state !== 'inactive') rec.current.stop(); cleanup() }, [cleanup])

  return { recording, file, supported: typeof MediaRecorder !== 'undefined', start, stop }
}
