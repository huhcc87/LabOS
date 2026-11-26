import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { BackgroundProcessor, type BgMode } from './backgroundEffect'

/**
 * Live LabHuddle call: every person connects straight to every other person (WebRTC mesh), Convex only carries the
 * hand-shake. Camera and each screen share use their own connection, so any number of people can share at the same
 * time and nobody's share depends on anybody else's.
 *
 * Signal channels: "cam" (both ways), "screen" (sharer to viewer: offer + ice), "screen-r" (viewer to sharer: answer + ice).
 * No TURN server is configured: people behind very strict firewalls may not connect (set one in ICE below if needed).
 */
// A TURN relay lets people behind strict firewalls connect. Set VITE_TURN_URL (e.g. turn:turn.example.org:3478), VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL.
const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined
const ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
    ...(TURN_URL ? [{ urls: TURN_URL.split(','), username: import.meta.env.VITE_TURN_USERNAME as string, credential: import.meta.env.VITE_TURN_CREDENTIAL as string }] : []),
  ],
}
const TOKEN_KEY = 'labos_auth_token'
const BEAT_MS = 5_000
const STALE_MS = 30_000

const getToken = (): string | undefined => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? undefined

export interface Tile { id: string; peerId: string; name: string; stream: MediaStream; kind: 'cam' | 'screen'; local: boolean }
export interface Person { id: string; name: string; sharing: boolean; hand: boolean; joined_at: number }
export interface CallOpts { audioId?: string; videoId?: string; startMic?: boolean; startCam?: boolean; background?: BgMode; onBackgroundError?: (message: string) => void; onKicked: () => void; onMuted: () => void }
export type Quality = '' | 'good' | 'fair' | 'poor'

interface Conn { pc: RTCPeerConnection; joined: number }

export function useHuddleCall(roomId: string, myName: string, opts: CallOpts) {
  const token = getToken()
  const roster = useQuery(api.huddleCall.peers, { token, room_id: roomId })
  const inbox = useQuery(api.huddleCall.inbox, { token, room_id: roomId })
  const controlList = useQuery(api.huddleCall.controls, { token, room_id: roomId })
  const optsRef = useRef(opts)
  optsRef.current = opts
  const heartbeat = useMutation(api.huddleCall.heartbeat)
  const sendSignal = useMutation(api.huddleCall.sendSignal)
  const ack = useMutation(api.huddleCall.ackSignals)
  const leaveRoom = useMutation(api.huddleCall.leave)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [myShare, setMyShare] = useState<MediaStream | null>(null)
  const [remoteCams, setRemoteCams] = useState<Record<string, MediaStream>>({})
  const [remoteShares, setRemoteShares] = useState<Record<string, MediaStream>>({})
  const [now, setNow] = useState(Date.now())

  const conns = useRef(new Map<string, Conn>())
  const seen = useRef(new Set<string>())
  const chain = useRef<Promise<void>>(Promise.resolve())
  const lastBeat = useRef(new Map<string, { last: number; at: number }>())
  const localRef = useRef<MediaStream | null>(null)
  const shareRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Person[]>([])

  const me = roster?.me ?? ''
  const [quality, setQuality] = useState<Quality>('')
  const startedAt = useRef(Date.now())

  // Who is really here: a person whose heartbeat has not changed for a while has gone.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5_000); return () => clearInterval(t) }, [])
  const people: Person[] = []
  const waiting: Person[] = []
  let admitted = true
  let myHand = false
  if (roster) {
    for (const p of roster.peers) {
      if (p.id === me) { admitted = p.admitted; myHand = p.hand; continue }
      const prev = lastBeat.current.get(p.id)
      if (!prev || prev.last !== p.last_seen) lastBeat.current.set(p.id, { last: p.last_seen, at: now })
      if (now - (lastBeat.current.get(p.id)?.at ?? now) >= STALE_MS) continue
      const person = { id: p.id, name: p.name, sharing: p.sharing, hand: p.hand, joined_at: p.joined_at }
      if (p.admitted) people.push(person); else waiting.push(person)
    }
  }
  const isHost = !!me && roster?.host_id === me
  const hostName = roster?.peers.find((p) => p.id === roster.host_id)?.name ?? ''
  peersRef.current = people
  const peerKey = people.map((p) => `${p.id}:${p.joined_at}:${p.sharing}`).join('|')

  const sig = useCallback((to: string, channel: string, kind: string, data: unknown) => {
    sendSignal({ token, room_id: roomId, to, channel, kind, data: JSON.stringify(data) }).catch(() => undefined)
  }, [sendSignal, token, roomId])

  // ── My camera and microphone ──
  useEffect(() => {
    let dead = false
    ;(async () => {
      const md = navigator.mediaDevices
      if (!md?.getUserMedia) { setMediaError('This browser cannot use the camera. Use Chrome, Edge, Firefox or Safari over https.'); setMediaReady(true); return }
      let s: MediaStream | null = null
      const { audioId, videoId } = optsRef.current
      try {
        s = await md.getUserMedia({
          video: { width: 1280, height: 720, ...(videoId ? { deviceId: { exact: videoId } } : {}) },
          audio: { echoCancellation: true, noiseSuppression: true, ...(audioId ? { deviceId: { exact: audioId } } : {}) },
        })
      } catch {
        try { s = await md.getUserMedia({ audio: true }); setMediaError('No camera found or allowed. You joined with sound only.'); setCamOn(false) }
        catch { setMediaError('Camera and microphone are blocked. You can watch the call but the others cannot see or hear you. Allow them in the browser address bar, then rejoin.') }
      }
      if (dead) { s?.getTracks().forEach((t) => t.stop()); return }
      // Carry over the choices made on the join screen.
      s?.getAudioTracks().forEach((t) => { t.enabled = optsRef.current.startMic !== false })
      s?.getVideoTracks().forEach((t) => { t.enabled = optsRef.current.startCam !== false })
      if (optsRef.current.startMic === false) setMicOn(false)
      if (optsRef.current.startCam === false) setCamOn(false)
      rawVideo.current = s?.getVideoTracks()[0] ?? null
      localRef.current = s; setLocalStream(s); setMediaReady(true)
    })()
    return () => { dead = true; effect.current?.stop(); rawVideo.current?.stop(); localRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const closeConn = useCallback((key: string) => {
    const c = conns.current.get(key)
    if (c) { c.pc.onicecandidate = null; c.pc.ontrack = null; c.pc.close(); conns.current.delete(key) }
  }, [])

  const dropPeerStreams = useCallback((id: string, what: 'cam' | 'screen' | 'both') => {
    if (what !== 'screen') setRemoteCams((m) => { if (!(id in m)) return m; const n = { ...m }; delete n[id]; return n })
    if (what !== 'cam') setRemoteShares((m) => { if (!(id in m)) return m; const n = { ...m }; delete n[id]; return n })
  }, [])

  const newPc = useCallback((key: string, peerId: string, joined: number, sendChannel: string, onStream: (s: MediaStream) => void) => {
    closeConn(key)
    const pc = new RTCPeerConnection(ICE)
    pc.onicecandidate = (e) => { if (e.candidate) sig(peerId, sendChannel, 'ice', e.candidate.toJSON()) }
    pc.ontrack = (e) => { if (e.streams[0]) onStream(e.streams[0]) }
    conns.current.set(key, { pc, joined })
    return pc
  }, [closeConn, sig])

  const joinedOf = (id: string) => peersRef.current.find((p) => p.id === id)?.joined_at ?? 0

  // ── Start connections: camera (the lower id calls) and my screen share (the sharer calls everyone) ──
  useEffect(() => {
    if (!mediaReady || !me || !admitted) return
    const ids = new Set(people.map((p) => p.id))
    for (const key of [...conns.current.keys()]) {
      const [kind, id] = key.split('|')
      const person = people.find((p) => p.id === id)
      const conn = conns.current.get(key)!
      if (person && !conn.joined) conn.joined = person.joined_at // an offer can arrive before the room list does
      const stale = !person || conn.joined !== person.joined_at
      if (stale && (kind === 'cam' || kind === 'sout' || kind === 'sin')) {
        closeConn(key)
        if (!ids.has(id)) dropPeerStreams(id, 'both')
      }
      if (kind === 'sin' && person && !person.sharing) { closeConn(key); dropPeerStreams(id, 'screen') }
    }
    for (const p of people) {
      if (me < p.id && !conns.current.has(`cam|${p.id}`)) {
        const pc = newPc(`cam|${p.id}`, p.id, p.joined_at, 'cam', (s) => setRemoteCams((m) => ({ ...m, [p.id]: s })))
        localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!))
        if (!localRef.current) { pc.addTransceiver('video', { direction: 'recvonly' }); pc.addTransceiver('audio', { direction: 'recvonly' }) }
        pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => sig(p.id, 'cam', 'offer', pc.localDescription)).catch(() => undefined)
      }
      const share = shareRef.current
      if (share && !conns.current.has(`sout|${p.id}`)) {
        const pc = newPc(`sout|${p.id}`, p.id, p.joined_at, 'screen', () => undefined)
        share.getTracks().forEach((t) => pc.addTrack(t, share))
        pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => sig(p.id, 'screen', 'offer', pc.localDescription)).catch(() => undefined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady, me, admitted, peerKey, myShare])

  // ── Host actions aimed at me (mute, remove) ──
  const doneControls = useRef(new Set<string>())
  useEffect(() => {
    for (const c of controlList ?? []) {
      if (doneControls.current.has(c.id) || c.at < startedAt.current) continue
      doneControls.current.add(c.id)
      if (c.kind === 'kick') optsRef.current.onKicked()
      else {
        const t = localRef.current?.getAudioTracks()[0]
        if (t) { t.enabled = false; setMicOn(false) }
        optsRef.current.onMuted()
      }
    }
  }, [controlList])

  // ── Call quality: the worst of round-trip time and lost packets across my connections ──
  useEffect(() => {
    const t = setInterval(async () => {
      let worst: Quality = ''
      const rank = { '': 0, good: 1, fair: 2, poor: 3 } as const
      for (const [key, c] of conns.current) {
        if (!key.startsWith('cam|') || c.pc.connectionState !== 'connected') continue
        let rtt = 0
        let lost = 0
        let got = 0
        ;(await c.pc.getStats()).forEach((r) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) rtt = Math.max(rtt, (r.currentRoundTripTime ?? 0) * 1000)
          if (r.type === 'inbound-rtp' && r.kind === 'video') { lost += r.packetsLost ?? 0; got += r.packetsReceived ?? 0 }
        })
        const loss = got + lost > 0 ? lost / (got + lost) : 0
        const q: Quality = rtt > 400 || loss > 0.08 ? 'poor' : rtt > 200 || loss > 0.03 ? 'fair' : 'good'
        if (rank[q] > rank[worst]) worst = q
      }
      setQuality(worst)
    }, 4_000)
    return () => clearInterval(t)
  }, [])

  /** Put a track in my outgoing stream and on every camera connection, replacing the one of the same kind. */
  const swapTrack = useCallback(async (next: MediaStreamTrack) => {
    const stream = localRef.current ?? new MediaStream()
    const old = next.kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0]
    next.enabled = next.kind === 'audio' ? micOn : camOn
    if (old && old !== next) { stream.removeTrack(old); if (old !== rawVideo.current) old.stop() }
    stream.addTrack(next)
    for (const [key, c] of conns.current) {
      if (!key.startsWith('cam|')) continue
      const sender = c.pc.getSenders().find((x) => x.track?.kind === next.kind) ?? c.pc.getSenders().find((x) => !x.track)
      if (sender) await sender.replaceTrack(next)
    }
    localRef.current = stream
    setLocalStream(new MediaStream(stream.getTracks())) // a new object so the picture updates
  }, [micOn, camOn])

  // ── Background blur / picture ──
  const rawVideo = useRef<MediaStreamTrack | null>(null)
  const effect = useRef<BackgroundProcessor | null>(null)
  const [background, setBackgroundState] = useState<BgMode>({ kind: 'none' })
  const [bgBusy, setBgBusy] = useState(false)

  /** Turn a background effect on, change it, or switch it off. Returns an error message when it cannot start. */
  const setBackground = useCallback(async (mode: BgMode): Promise<string> => {
    const raw = rawVideo.current
    if (!raw) return 'There is no camera to apply a background to.'
    effect.current?.stop(); effect.current = null
    if (mode.kind === 'none') { setBackgroundState(mode); await swapTrack(raw); return '' }
    setBgBusy(true)
    try {
      const p = new BackgroundProcessor(raw, mode)
      const track = await p.start()
      effect.current = p
      setBackgroundState(mode)
      await swapTrack(track)
      return ''
    } catch (e) {
      setBackgroundState({ kind: 'none' }); await swapTrack(raw)
      return e instanceof Error ? e.message : 'The background effect could not start.'
    } finally { setBgBusy(false) }
  }, [swapTrack])

  /** Change microphone or camera while in the call. */
  const switchDevice = useCallback(async (kind: 'audio' | 'video', deviceId: string) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } } : { video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } })
      const next = s.getTracks()[0]
      if (kind === 'audio') { await swapTrack(next); return }
      const prevRaw = rawVideo.current
      rawVideo.current = next
      if (background.kind === 'none') await swapTrack(next)
      else await setBackground(background) // restart the effect on the new camera
      if (prevRaw && prevRaw !== next) prevRaw.stop()
    } catch { /* keep the old device */ }
  }, [swapTrack, setBackground, background])

  // Start with the effect chosen on the join screen.
  const startBg = useRef(false)
  useEffect(() => {
    if (!mediaReady || startBg.current) return
    startBg.current = true
    const want = optsRef.current.background
    if (want && want.kind !== 'none') void setBackground(want).then((err) => err && optsRef.current.onBackgroundError?.(err))
  }, [mediaReady, setBackground])

  // ── Hand-shake messages from other people ──
  const handle = useCallback(async (s: { from: string; channel: string; kind: string; data: string }) => {
    const data = JSON.parse(s.data)
    const joined = joinedOf(s.from)
    const addIce = async (key: string) => { const c = conns.current.get(key); if (c) await c.pc.addIceCandidate(data).catch(() => undefined) }
    if (s.channel === 'cam') {
      if (s.kind === 'offer') {
        const pc = newPc(`cam|${s.from}`, s.from, joined, 'cam', (st) => setRemoteCams((m) => ({ ...m, [s.from]: st })))
        await pc.setRemoteDescription(data)
        localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!))
        await pc.setLocalDescription(await pc.createAnswer())
        sig(s.from, 'cam', 'answer', pc.localDescription)
      } else if (s.kind === 'answer') await conns.current.get(`cam|${s.from}`)?.pc.setRemoteDescription(data).catch(() => undefined)
      else if (s.kind === 'ice') await addIce(`cam|${s.from}`)
    } else if (s.channel === 'screen') {
      if (s.kind === 'offer') {
        const pc = newPc(`sin|${s.from}`, s.from, joined, 'screen-r', (st) => setRemoteShares((m) => ({ ...m, [s.from]: st })))
        await pc.setRemoteDescription(data)
        await pc.setLocalDescription(await pc.createAnswer())
        sig(s.from, 'screen-r', 'answer', pc.localDescription)
      } else if (s.kind === 'ice') await addIce(`sin|${s.from}`)
      else if (s.kind === 'stop') { closeConn(`sin|${s.from}`); dropPeerStreams(s.from, 'screen') }
    } else if (s.channel === 'screen-r') {
      if (s.kind === 'answer') await conns.current.get(`sout|${s.from}`)?.pc.setRemoteDescription(data).catch(() => undefined)
      else if (s.kind === 'ice') await addIce(`sout|${s.from}`)
    }
  }, [newPc, sig, closeConn, dropPeerStreams])

  useEffect(() => {
    if (!inbox || !mediaReady) return
    const fresh = inbox.filter((s) => !seen.current.has(s.id))
    if (!fresh.length) return
    fresh.forEach((s) => seen.current.add(s.id))
    chain.current = chain.current.then(async () => {
      for (const s of fresh) { try { await handle(s) } catch { /* a bad message must not stop the call */ } }
      ack({ token, ids: fresh.map((s) => s.id as never) }).catch(() => undefined)
    })
  }, [inbox, mediaReady, handle, ack, token])

  // ── Presence ──
  const sharing = !!myShare
  useEffect(() => {
    if (!mediaReady) return
    const beat = () => heartbeat({ token, room_id: roomId, name: myName || 'Guest', sharing }).catch(() => undefined)
    beat()
    const t = setInterval(beat, BEAT_MS)
    return () => clearInterval(t)
  }, [mediaReady, heartbeat, token, roomId, myName, sharing])

  const stopShare = useCallback(() => {
    shareRef.current?.getTracks().forEach((t) => { t.onended = null; t.stop() })
    shareRef.current = null; setMyShare(null)
    for (const key of [...conns.current.keys()]) {
      if (key.startsWith('sout|')) { sig(key.split('|')[1], 'screen', 'stop', {}); closeConn(key) }
    }
  }, [sig, closeConn])

  const startShare = useCallback(async () => {
    if (shareRef.current) return
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      shareRef.current = s; setMyShare(s)
      s.getVideoTracks()[0].onended = () => stopShare()
    } catch { /* the person closed the picker */ }
  }, [stopShare])

  const toggleMic = () => { const t = localRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled) } }
  const toggleCam = () => { const t = localRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled) } }

  // ── Leaving ──
  const leave = useCallback(async () => {
    stopShare()
    for (const key of [...conns.current.keys()]) closeConn(key)
    effect.current?.stop(); rawVideo.current?.stop()
    localRef.current?.getTracks().forEach((t) => t.stop())
    await leaveRoom({ token, room_id: roomId }).catch(() => undefined)
  }, [stopShare, closeConn, leaveRoom, token, roomId])

  useEffect(() => {
    const bye = () => { leaveRoom({ token, room_id: roomId }).catch(() => undefined) }
    window.addEventListener('pagehide', bye)
    return () => { window.removeEventListener('pagehide', bye); for (const key of [...conns.current.keys()]) closeConn(key) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tiles: Tile[] = []
  if (me) {
    if (localStream) tiles.push({ id: 'me-cam', peerId: me, name: `${myName || 'You'} (you)`, stream: localStream, kind: 'cam', local: true })
    if (myShare) tiles.push({ id: 'me-screen', peerId: me, name: 'Your screen', stream: myShare, kind: 'screen', local: true })
    for (const p of people) {
      if (remoteCams[p.id]) tiles.push({ id: `${p.id}-cam`, peerId: p.id, name: p.name, stream: remoteCams[p.id], kind: 'cam', local: false })
      if (p.sharing && remoteShares[p.id]) tiles.push({ id: `${p.id}-screen`, peerId: p.id, name: `${p.name}'s screen`, stream: remoteShares[p.id], kind: 'screen', local: false })
    }
  }

  return {
    me, people, waiting, admitted, isHost, hostName, myHand, quality, tiles, localStream, mediaReady, mediaError, micOn, camOn, sharing,
    locked: !!roster?.locked, agendaIndex: roster?.agenda_index ?? 0, agendaStartedAt: roster?.agenda_started_at ?? 0,
    background, bgBusy, setBackground,
    toggleMic, toggleCam, startShare, stopShare, switchDevice, leave,
  }
}
