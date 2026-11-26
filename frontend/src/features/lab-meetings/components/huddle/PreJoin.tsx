import { useEffect, useRef, useState } from 'react'
import { btn, field, muted } from './huddleUi'
import BackgroundPicker, { loadBg, saveBg } from './BackgroundPicker'
import { BackgroundProcessor, type BgMode } from '../../hooks/backgroundEffect'

export interface JoinChoice { audioId?: string; videoId?: string; startMic: boolean; startCam: boolean; background: BgMode }

/** The screen before the call: see yourself, pick the camera and microphone, check the sound, then join. */
export default function PreJoin({ title, userName, onJoin, onCancel }: { title: string; userName: string; onJoin: (c: JoinChoice) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [cams, setCams] = useState<MediaDeviceInfo[]>([])
  const [audioId, setAudioId] = useState('')
  const [videoId, setVideoId] = useState('')
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const [bg, setBg] = useState<BgMode>(loadBg)
  const [bgError, setBgError] = useState('')
  const [bgBusy, setBgBusy] = useState(false)
  const [ver, setVer] = useState(0) // bumps whenever the preview camera is (re)opened

  // Show the background effect on the preview, so you see it before you join.
  useEffect(() => {
    const raw = streamRef.current?.getVideoTracks()[0]
    const v = videoRef.current
    if (!raw || !v) return
    if (bg.kind === 'none') { v.srcObject = streamRef.current; return }
    let dead = false
    setBgBusy(true); setBgError('')
    const p = new BackgroundProcessor(raw, bg)
    p.start()
      .then((track) => { if (dead) { track.stop(); return } v.srcObject = new MediaStream([track]) })
      .catch((e) => { if (!dead) { setBgError(e instanceof Error ? e.message : 'The background effect could not start.'); setBg({ kind: 'none' }); saveBg({ kind: 'none' }) } })
      .finally(() => { if (!dead) setBgBusy(false) })
    return () => { dead = true; p.stop() }
  }, [bg, ver])

  // Open the chosen devices for the preview, and meter the microphone.
  useEffect(() => {
    let dead = false
    let stopMeter = () => undefined as void
    ;(async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const md = navigator.mediaDevices
      if (!md?.getUserMedia) { setError('This browser cannot use the camera. Use Chrome, Edge, Firefox or Safari.'); return }
      let s: MediaStream | null = null
      try {
        s = await md.getUserMedia({ video: videoId ? { deviceId: { exact: videoId } } : true, audio: audioId ? { deviceId: { exact: audioId } } : true })
        setError('')
      } catch {
        try { s = await md.getUserMedia({ audio: true }); setError('No camera available. You can still join with sound.'); setCam(false) }
        catch { setError('Camera and microphone are blocked. Allow them in the browser address bar and reload, or join to watch only.') }
      }
      if (dead) { s?.getTracks().forEach((t) => t.stop()); return }
      streamRef.current = s
      if (videoRef.current) videoRef.current.srcObject = s
      setVer((n) => n + 1)
      const list = await md.enumerateDevices().catch(() => [] as MediaDeviceInfo[])
      if (dead) return
      setMics(list.filter((d) => d.kind === 'audioinput' && d.deviceId))
      setCams(list.filter((d) => d.kind === 'videoinput' && d.deviceId))
      if (s?.getAudioTracks().length) {
        const ctx = new AudioContext()
        const an = ctx.createAnalyser()
        an.fftSize = 256
        ctx.createMediaStreamSource(s).connect(an)
        const buf = new Uint8Array(an.frequencyBinCount)
        const t = setInterval(() => { an.getByteFrequencyData(buf); setLevel(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 60)) }, 120)
        stopMeter = () => { clearInterval(t); ctx.close().catch(() => undefined) }
      }
    })()
    return () => { dead = true; stopMeter() }
  }, [audioId, videoId])

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])
  useEffect(() => { streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = cam }) }, [cam])
  useEffect(() => { streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = mic }) }, [mic])

  const join = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); onJoin({ audioId: audioId || undefined, videoId: videoId || undefined, startMic: mic, startCam: cam, background: bg }) }

  return (
    <div role="dialog" aria-modal="true" aria-label="Join the call" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#0b1220', color: '#fff', display: 'grid', placeItems: 'center', padding: 16, overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div>
          <div style={{ position: 'relative', background: '#0f172a', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 9' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: cam ? 'block' : 'none' }} />
            {!cam && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 48, color: '#64748b' }}>{userName.trim().charAt(0).toUpperCase() || '?'}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <button style={btn(mic)} onClick={() => setMic((m) => !m)}>{mic ? 'Mic on' : 'Mic off'}</button>
            <button style={btn(cam)} onClick={() => setCam((c) => !c)}>{cam ? 'Camera on' : 'Camera off'}</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Joining as <strong>{userName || 'Guest'}</strong>. Check how you look and sound first.</p>
          {error && <p style={{ margin: 0, background: '#78350f', padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>{error}</p>}
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Camera
            <select style={field} value={videoId} onChange={(e) => setVideoId(e.target.value)}>
              <option value="">Default camera</option>
              {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Microphone
            <select style={field} value={audioId} onChange={(e) => setAudioId(e.target.value)}>
              <option value="">Default microphone</option>
              {mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
            </select>
          </label>
          <div aria-label="Microphone level" style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(level * 100)}%`, height: '100%', background: '#22c55e', transition: 'width .1s' }} />
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>Say something: the bar should move.</span>
          <div>
            <div style={{ ...muted, marginBottom: 4 }}>BACKGROUND</div>
            <BackgroundPicker value={bg} busy={bgBusy} onChange={(m) => { setBgError(''); setBg(m); saveBg(m) }} />
            {bgError && <p role="alert" style={{ margin: '6px 0 0', background: '#78350f', padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>{bgError}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={{ ...btn(), background: '#2563eb', flex: 1 }} onClick={join}>Join now</button>
            <button style={btn()} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
