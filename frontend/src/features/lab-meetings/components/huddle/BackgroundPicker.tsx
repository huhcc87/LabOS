import { useMemo, useRef, useState } from 'react'
import type { BgMode } from '../../hooks/backgroundEffect'
import { muted, smallBtn } from './huddleUi'

const BG_KEY = 'labos.huddle.bg'
const CUSTOM_KEY = 'labos.huddle.customBg'
const W = 1280
const H = 720

export function loadBg(): BgMode {
  try { const v = JSON.parse(localStorage.getItem(BG_KEY) ?? 'null') as BgMode | null; if (v && (v.kind === 'blur' || v.kind === 'image')) return v } catch { /* ignore a bad value */ }
  return { kind: 'none' }
}
export function saveBg(m: BgMode): void {
  try { localStorage.setItem(BG_KEY, JSON.stringify(m)) } catch { localStorage.removeItem(BG_KEY) } // too big to keep: fine, just not remembered
}

/** A few ready-made pictures, drawn here so no files are needed. */
function presets(): { name: string; src: string }[] {
  const make = (stops: [number, string][], dots = false) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, W, H)
    stops.forEach(([o, col]) => grad.addColorStop(o, col))
    g.fillStyle = grad; g.fillRect(0, 0, W, H)
    if (dots) { g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 46, 0, 7); g.fill() } }
    return c.toDataURL('image/jpeg', 0.85)
  }
  return [
    { name: 'Ocean', src: make([[0, '#0f4c81'], [1, '#38bdf8']], true) },
    { name: 'Forest', src: make([[0, '#14532d'], [1, '#84cc16']], true) },
    { name: 'Dusk', src: make([[0, '#4c1d95'], [1, '#fb7185']], true) },
    { name: 'Slate', src: make([[0, '#0f172a'], [1, '#475569']]) },
    { name: 'Clean white', src: make([[0, '#f8fafc'], [1, '#cbd5e1']]) },
  ]
}

/** Read any picture the browser can open, shrink it to the call size, and keep it as a JPEG. */
async function fromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('This browser cannot open that kind of image. Try a JPG, PNG, WebP or GIF (HEIC photos need converting first).')); i.src = url })
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')!
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight)
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
    g.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
    return c.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}

/** Choose the camera background: none, blur, a ready-made picture, or your own image. */
export default function BackgroundPicker({ value, busy, onChange }: { value: BgMode; busy?: boolean; onChange: (m: BgMode) => Promise<string> | void }) {
  const ready = useMemo(presets, [])
  const [custom, setCustom] = useState<string | null>(() => localStorage.getItem(CUSTOM_KEY))
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const pick = async (m: BgMode) => { setError(''); const err = await onChange(m); if (err) setError(err) }
  const on = (m: BgMode) => value.kind === m.kind && (m.kind === 'none' || (m.kind === 'blur' && value.kind === 'blur' && value.amount === m.amount) || (m.kind === 'image' && value.kind === 'image' && value.src === m.src))
  const chip = (active: boolean): React.CSSProperties => ({ border: active ? '2px solid #60a5fa' : '1px solid #475569', borderRadius: 8, padding: 0, cursor: busy ? 'wait' : 'pointer', background: '#0f172a', color: '#fff', fontSize: 11, overflow: 'hidden', width: 74, height: 48, textAlign: 'center' })

  const upload = async (f?: File) => {
    if (!f) return
    try {
      const src = await fromFile(f)
      try { localStorage.setItem(CUSTOM_KEY, src) } catch { /* not remembered */ }
      setCustom(src)
      await pick({ kind: 'image', src })
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not use that image.') }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-busy={busy}>
        <button type="button" disabled={busy} style={chip(on({ kind: 'none' }))} onClick={() => pick({ kind: 'none' })}>None</button>
        <button type="button" disabled={busy} style={chip(on({ kind: 'blur', amount: 8 }))} onClick={() => pick({ kind: 'blur', amount: 8 })}>Light blur</button>
        <button type="button" disabled={busy} style={chip(on({ kind: 'blur', amount: 18 }))} onClick={() => pick({ kind: 'blur', amount: 18 })}>Strong blur</button>
        {ready.map((p) => (
          <button type="button" key={p.name} disabled={busy} title={p.name} aria-label={`Background ${p.name}`} style={chip(on({ kind: 'image', src: p.src }))} onClick={() => pick({ kind: 'image', src: p.src })}>
            <img src={p.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
        {custom && (
          <button type="button" disabled={busy} title="Your image" aria-label="Background: your image" style={chip(on({ kind: 'image', src: custom }))} onClick={() => pick({ kind: 'image', src: custom })}>
            <img src={custom} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        )}
        <button type="button" disabled={busy} style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => file.current?.click()}>＋ Upload image</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {busy && <p style={{ ...muted, margin: '6px 0 0' }}>Starting the background effect…</p>}
      {error && <p role="alert" style={{ ...smallBtn, background: '#78350f', display: 'block', margin: '6px 0 0', whiteSpace: 'normal', fontWeight: 400 }}>{error}</p>}
      <p style={{ ...muted, margin: '6px 0 0' }}>Works on your computer only. Needs a reasonably recent computer and Chrome, Edge or Safari.</p>
    </div>
  )
}
