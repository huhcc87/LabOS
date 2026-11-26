import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { getToken, smallBtn } from './huddleUi'

type Pt = [number, number]
const COLORS = ['#f8fafc', '#f87171', '#facc15', '#4ade80', '#38bdf8', '#c084fc']

/** A whiteboard everyone draws on at once. Points are saved as 0 to 1 so every screen size shows the same picture. */
export default function BoardOverlay({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const strokes = useQuery(api.huddleCall.strokes, { token: getToken(), room_id: roomId }) ?? []
  const addStroke = useMutation(api.huddleCall.addStroke)
  const clear = useMutation(api.huddleCall.clearBoard)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Pt[] | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(3)

  const paint = useCallback(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')!
    g.clearRect(0, 0, c.width, c.height)
    g.lineCap = 'round'; g.lineJoin = 'round'
    const line = (pts: Pt[], col: string, w: number) => {
      if (!pts.length) return
      g.strokeStyle = col; g.lineWidth = w; g.beginPath()
      pts.forEach(([x, y], i) => (i ? g.lineTo(x * c.width, y * c.height) : g.moveTo(x * c.width, y * c.height)))
      if (pts.length === 1) g.lineTo(pts[0][0] * c.width + 0.1, pts[0][1] * c.height)
      g.stroke()
    }
    for (const s of strokes) { try { line(JSON.parse(s.points) as Pt[], s.color, s.width) } catch { /* skip a bad stroke */ } }
    if (drawing.current) line(drawing.current, color, width)
  }, [strokes, color, width])
  useEffect(paint, [paint])

  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const end = () => {
    const pts = drawing.current
    drawing.current = null
    if (pts?.length) addStroke({ token: getToken(), room_id: roomId, color, width, points: JSON.stringify(pts.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4])) }).catch(() => undefined)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: '#0b1220', display: 'flex', flexDirection: 'column', padding: 10, gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Whiteboard</strong>
        {COLORS.map((c) => <button key={c} aria-label={`Pen colour ${c}`} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: 12, background: c, border: color === c ? '3px solid #60a5fa' : '1px solid #475569', cursor: 'pointer' }} />)}
        <label style={{ fontSize: 12 }}>Pen <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
        <button style={smallBtn} onClick={() => clear({ token: getToken(), room_id: roomId })}>Clear for everyone</button>
        <button style={{ ...smallBtn, marginLeft: 'auto' }} onClick={onClose}>Close board</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
        <canvas ref={canvas} width={1280} height={720} aria-label="Shared whiteboard"
          style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: '16 / 9', background: '#020617', border: '1px solid #334155', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = [at(e)]; paint() }}
          onPointerMove={(e) => { if (drawing.current) { drawing.current.push(at(e)); paint() } }}
          onPointerUp={end} onPointerCancel={end} />
      </div>
    </div>
  )
}
