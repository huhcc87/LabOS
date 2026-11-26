import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { useHuddleCall, type Tile } from '../../hooks/useHuddleCall'
import { useHuddleRecorder } from '../../hooks/useHuddleRecorder'
import { useHuddleCaptions } from '../../hooks/useHuddleCaptions'
import VideoTile from './VideoTile'
import ChatPanel from './ChatPanel'
import AgendaPanel, { type AgendaLite } from './AgendaPanel'
import PollsPanel from './PollsPanel'
import SharedPanel from './SharedPanel'
import BoardOverlay from './BoardOverlay'
import OutcomePanel from './OutcomePanel'
import BackgroundPicker, { saveBg } from './BackgroundPicker'
import type { JoinChoice } from './PreJoin'
import { btn, clock, errorText, field, getToken, huddleAuth, isGuestSession, muted, safeName, save, smallBtn } from './huddleUi'

export interface RoomProps { roomId: string; meetingId?: string | number; title: string; userName: string; agenda: AgendaLite[]; join: JoinChoice; onLeave: () => void }

type Tab = 'notes' | 'chat' | 'agenda' | 'polls' | 'shared' | 'transcript' | 'summary' | 'people'
const AUTO_KEY = 'labos.huddle.autoDownload'
const SUMMARY_WAIT_MS = 30_000
const REACTIONS = ['👍', '👏', '❤️', '😂', '🎉', '🤔']
const CAPTION_LANGS: [string, string][] = [['English', 'en-US'], ['Spanish', 'es-ES'], ['French', 'fr-FR'], ['German', 'de-DE'], ['Portuguese', 'pt-BR'], ['Italian', 'it-IT'], ['Chinese', 'zh-CN'], ['Japanese', 'ja-JP'], ['Arabic', 'ar-SA'], ['Hindi', 'hi-IN']]
const QUALITY_LABEL = { good: ['#22c55e', 'Connection good'], fair: ['#eab308', 'Connection fair'], poor: ['#ef4444', 'Connection poor'] } as const

function useNarrow(): boolean {
  const [n, setN] = useState(() => window.innerWidth < 900)
  useEffect(() => { const f = () => setN(window.innerWidth < 900); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return n
}

export default function CallRoom({ roomId, meetingId, title, userName, agenda, join, onLeave }: RoomProps) {
  const narrow = useNarrow()
  const guest = isGuestSession() // joined through a guest link: no account, so no host tools, summary, polls or lab items
  const createGuest = useMutation(api.huddleCall.createGuestLink)
  const revokeGuest = useMutation(api.huddleCall.revokeGuestLink)
  const finishRef = useRef<() => void>(() => undefined)
  const call = useHuddleCall(roomId, userName, {
    ...join,
    onKicked: () => { toast.error('The host removed you from the call.'); void finishRef.current() },
    onMuted: () => toast('The host muted you. Unmute when you want to speak.'),
    onBackgroundError: (m) => toast.error(m),
  })
  const tilesRef = useRef<Tile[]>([])
  tilesRef.current = call.tiles
  const recorder = useHuddleRecorder(() => tilesRef.current)

  const [tab, setTab] = useState<Tab>('notes')
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 900)
  const [boardOpen, setBoardOpen] = useState(false)
  const [pinned, setPinned] = useState<string | null>(null)
  const [captionsOn, setCaptionsOn] = useState(false)
  const [capLang, setCapLang] = useState('en-US')
  const [sumLang, setSumLang] = useState('English')
  const [autoDownload, setAutoDownload] = useState(() => localStorage.getItem(AUTO_KEY) !== '0')
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState<{ text: string; source: string } | null>(null)
  const [summarising, setSummarising] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showReact, setShowReact] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [floating, setFloating] = useState<{ id: string; emoji: string; name: string; x: number }[]>([])
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const startedAt = useRef(Date.now())
  const everHere = useRef(new Set<string>([userName || 'You']))
  call.people.forEach((p) => everHere.current.add(p.name))

  const captions = useHuddleCaptions(roomId, userName, captionsOn, capLang)
  const lines = useQuery(api.huddleCall.lines, call.admitted ? { ...huddleAuth(), room_id: roomId } : 'skip') ?? []
  const sharedNotes = useQuery(api.huddleCall.getNotes, call.admitted ? { ...huddleAuth(), room_id: roomId } : 'skip')
  const reactionList = useQuery(api.huddleCall.reactions, call.admitted ? { ...huddleAuth(), room_id: roomId } : 'skip')
  const setNotesRemote = useMutation(api.huddleCall.setNotes)
  const summarize = useAction(api.huddleCall.summarize)
  const hostAct = useMutation(api.huddleCall.hostAction)
  const setHand = useMutation(api.huddleCall.setHand)
  const react = useMutation(api.huddleCall.react)

  // Notes everyone edits together: save a moment after typing stops; take others' changes when I'm not typing.
  const [notes, setNotes] = useState('')
  const dirty = useRef(false)
  const lastSaved = useRef(0)
  useEffect(() => {
    if (sharedNotes && !dirty.current && sharedNotes.updated_at !== lastSaved.current) { setNotes(sharedNotes.text); lastSaved.current = sharedNotes.updated_at }
  }, [sharedNotes])
  useEffect(() => {
    if (guest || !dirty.current) return
    const t = setTimeout(() => {
      setNotesRemote({ token: getToken(), room_id: roomId, text: notes, by: userName || 'Guest' }).then(() => { dirty.current = false }).catch(() => toast.error('Could not save the notes'))
    }, 700)
    return () => clearTimeout(t)
  }, [notes, roomId, userName, setNotesRemote])

  useEffect(() => { const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { localStorage.setItem(AUTO_KEY, autoDownload ? '1' : '0') }, [autoDownload])

  // Reactions float up for a few seconds. The ones already there when I arrive are skipped.
  const seenReactions = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!reactionList) return
    if (!seenReactions.current) { seenReactions.current = new Set(reactionList.map((r) => r.id)); return }
    for (const r of reactionList) {
      if (seenReactions.current.has(r.id)) continue
      seenReactions.current.add(r.id)
      const item = { id: r.id, emoji: r.emoji, name: r.name, x: 10 + Math.random() * 80 }
      setFloating((f) => [...f, item])
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== r.id)), 3500)
    }
  }, [reactionList])

  useEffect(() => { if (showDevices) navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => undefined) }, [showDevices])

  const people = useMemo(() => call.people.map((p) => p.name), [call.people])
  const handOf = (peerId: string) => (peerId === call.me ? call.myHand : call.people.find((p) => p.id === peerId)?.hand ?? false)

  const notesFile = (sum: string | null) => [
    `# ${title}`, '',
    `- Date: ${new Date(startedAt.current).toLocaleString()}`, `- Length: ${clock(elapsed)}`, `- People: ${[...everHere.current].join(', ')}`, '',
    '## AI summary', sum?.trim() || '_No summary was made._', '',
    '## Notes', notes.trim() || '_No notes._', '',
    '## Transcript', lines.length ? lines.map((l) => `**${l.name}** (${new Date(l.at).toLocaleTimeString()}): ${l.text}`).join('\n\n') : '_Live transcript was off._',
  ].join('\n')

  const makeSummary = async (): Promise<string | null> => {
    setSummarising(true)
    try {
      const r = await summarize({ token: getToken(), title, lines: lines.map((l) => ({ name: l.name, text: l.text })), notes, language: sumLang === 'English' ? undefined : sumLang })
      setSummary({ text: r.summary, source: r.source })
      return r.summary
    } catch (e) { toast.error(errorText(e, 'Could not write the summary')); return null } finally { setSummarising(false) }
  }

  const downloadRecording = (blob: Blob | null) => { if (blob) save(`${safeName(title)}-recording.webm`, blob, 'video/webm') }

  const finish = async () => {
    if (finishing) return
    setFinishing(true)
    const blob = await recorder.stop()
    let sum = summary?.text ?? null
    if (autoDownload) {
      if (!guest && !sum && (lines.length || notes.trim())) sum = await Promise.race([makeSummary(), new Promise<null>((r) => setTimeout(() => r(null), SUMMARY_WAIT_MS))])
      save(`${safeName(title)}-notes.md`, notesFile(sum))
      if (blob) setTimeout(() => downloadRecording(blob), 400)
      toast.success('Meeting files saved to your downloads')
    } else if (blob) toast('Your recording is not saved. Turn on auto-download or save it to LabOS before leaving.')
    if (!guest && notes && dirty.current) await setNotesRemote({ token: getToken(), room_id: roomId, text: notes, by: userName || 'Guest' }).catch(() => undefined)
    await call.leave()
    onLeave()
  }
  finishRef.current = finish

  const host = (action: 'mute' | 'muteAll' | 'kick' | 'lock' | 'unlock' | 'admit' | 'admitAll', target?: string) =>
    hostAct({ token: getToken(), room_id: roomId, action, target }).catch((e) => toast.error(errorText(e, 'Could not do that')))
  const copyLink = () => navigator.clipboard.writeText(`${window.location.origin}/?room=${encodeURIComponent(roomId)}`).then(() => toast.success('Invite link copied'), () => toast.error('Could not copy'))

  const spot = pinned ? call.tiles.find((t) => t.id === pinned) : undefined
  const shares = call.tiles.filter((t) => t.kind === 'screen')
  const stage = spot ? call.tiles.filter((t) => t.id !== spot.id) : call.tiles
  const cols = call.tiles.length <= 1 ? 1 : call.tiles.length <= 4 ? 2 : 3
  const q = call.quality ? QUALITY_LABEL[call.quality] : null
  const ALL_TABS: [Tab, string][] = [['notes', 'Notes'], ['chat', 'Chat'], ['agenda', 'Agenda'], ['polls', 'Polls'], ['shared', 'Shared'], ['transcript', 'Transcript'], ['summary', 'Summary'], ['people', 'People']]
  // Guests get the call itself: notes (read only), chat, transcript and who is here.
  const TABS = guest ? ALL_TABS.filter(([k]) => ['notes', 'chat', 'transcript', 'people'].includes(k)) : ALL_TABS

  /** Make the call's guest link and copy it. Guests wait until the host lets them in. */
  const copyGuestLink = async () => {
    try {
      const r = await createGuest({ token: getToken(), room_id: roomId, title })
      await navigator.clipboard.writeText(`${window.location.origin}/?guest=${r.code}`)
      toast.success('Guest link copied. Guests wait until you let them in.')
    } catch (e) { toast.error(errorText(e, 'Could not make the guest link')) }
  }

  if (!call.admitted) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Waiting room" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#0b1220', color: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16 }}>
        <div><h2 style={{ margin: '0 0 8px' }}>{title}</h2><p style={{ color: '#94a3b8' }}>{guest ? 'Asking to join. ' : 'This call is locked. '}Waiting for {call.hostName || 'the host'} to let you in…</p>
          <button style={btn()} onClick={() => { void call.leave().then(onLeave) }}>Leave</button></div>
      </div>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Video call" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#0b1220', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #1e293b', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16, flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}{call.locked ? ' 🔒' : ''}</strong>
        {q && <span title={q[1]} style={{ fontSize: 12, color: q[0] }}>● {q[1]}</span>}
        {recorder.recording && <span style={{ color: '#f87171', fontSize: 13 }}>● Recording on this computer</span>}
        <span style={{ fontSize: 13, color: '#94a3b8' }}>{clock(elapsed)} · {call.people.length + 1} in call</span>
        {!guest && <button style={{ ...smallBtn, padding: '6px 12px', fontSize: 13 }} onClick={copyLink}>Copy invite link</button>}
        {!guest && <button style={{ ...smallBtn, padding: '6px 12px', fontSize: 13 }} title="For people without a LabOS account. You let them in." onClick={() => { void copyGuestLink() }}>Copy guest link</button>}
        <button style={{ ...smallBtn, padding: '6px 12px', fontSize: 13 }} onClick={() => setPanelOpen((o) => !o)}>{panelOpen ? 'Hide panel' : 'Panel'}</button>
      </header>

      {call.mediaError && <div style={{ background: '#78350f', padding: '6px 16px', fontSize: 13 }}>{call.mediaError}</div>}
      {call.isHost && call.waiting.length > 0 && (
        <div style={{ background: '#1e3a8a', padding: '6px 16px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Waiting to join:</span>
          {call.waiting.map((w) => <span key={w.id}>{w.name} <button style={smallBtn} onClick={() => host('admit', w.id)}>Let in</button></span>)}
          {call.waiting.length > 1 && <button style={smallBtn} onClick={() => host('admitAll')}>Let everyone in</button>}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <main style={{ flex: 1, padding: 12, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          {boardOpen && <BoardOverlay roomId={roomId} onClose={() => setBoardOpen(false)} />}
          {!call.mediaReady && <p style={{ color: '#94a3b8' }}>Starting your camera and microphone…</p>}
          {call.mediaReady && call.tiles.length <= 1 && <p style={{ color: '#94a3b8', margin: 0 }}>You are the only one here. Send the invite link to bring people in.</p>}
          {spot && <div style={{ flex: 1, minHeight: 0 }}><VideoTile tile={spot} big pinned hand={handOf(spot.peerId)} onPin={() => setPinned(null)} /></div>}
          <div style={{ display: 'grid', gap: 10, overflow: 'auto', alignContent: 'start', flex: spot ? undefined : 1,
            gridTemplateColumns: spot ? 'repeat(auto-fill, minmax(160px, 1fr))' : `repeat(${narrow ? Math.min(cols, 2) : cols}, minmax(0, 1fr))`, maxHeight: spot ? 150 : undefined }}>
            {stage.map((t) => <VideoTile key={t.id} tile={t} pinned={false} hand={t.kind === 'cam' && handOf(t.peerId)} onPin={() => setPinned(t.id)} />)}
          </div>
          {floating.map((f) => (
            <div key={f.id} aria-hidden style={{ position: 'absolute', bottom: 10, left: `${f.x}%`, fontSize: 36, animation: 'huddle-float 3.4s ease-out forwards', pointerEvents: 'none', textAlign: 'center' }}>
              {f.emoji}<div style={{ fontSize: 11, background: 'rgba(0,0,0,.6)', borderRadius: 4, padding: '0 4px' }}>{f.name}</div>
            </div>
          ))}
          <style>{'@keyframes huddle-float { from { transform: translateY(0); opacity: 1 } to { transform: translateY(-260px); opacity: 0 } }'}</style>
        </main>

        {panelOpen && (
          <aside style={{ width: narrow ? '100%' : 360, maxWidth: narrow ? undefined : '45vw', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', background: '#0f172a',
            ...(narrow ? { position: 'absolute', inset: 0, zIndex: 4 } : {}) }}>
            <nav style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #1e293b' }}>
              {TABS.map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} style={{ flex: '1 0 25%', padding: '9px 2px', background: tab === k ? '#1e293b' : 'transparent', color: '#fff', border: 0, cursor: 'pointer', fontSize: 12 }}>{label}</button>
              ))}
              {narrow && <button onClick={() => setPanelOpen(false)} style={{ flex: '1 0 25%', background: '#7f1d1d', color: '#fff', border: 0, fontSize: 12 }}>Close</button>}
            </nav>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, fontSize: 14 }}>
              {tab === 'notes' && (
                <>
                  <p style={{ margin: '0 0 6px', ...muted }}>{guest ? 'Shared notes (members edit these; you can read them).' : 'Shared notes: everyone in the call sees and edits this page.'}</p>
                  <textarea aria-label="Shared meeting notes" readOnly={guest} value={notes} onChange={(e) => { dirty.current = true; setNotes(e.target.value) }}
                    placeholder="Decisions, tasks, who does what…" style={{ ...field, height: 'calc(100% - 28px)', minHeight: 220, resize: 'none' }} />
                </>
              )}
              {tab === 'chat' && <ChatPanel roomId={roomId} name={userName || 'Guest'} />}
              {tab === 'agenda' && <AgendaPanel roomId={roomId} items={agenda} index={call.agendaIndex} isHost={call.isHost} />}
              {tab === 'polls' && <PollsPanel meetingId={meetingId} />}
              {tab === 'shared' && <SharedPanel roomId={roomId} name={userName || 'Guest'} />}
              {tab === 'transcript' && (
                <>
                  {captions.supported
                    ? <>
                        <select aria-label="Spoken language" style={{ ...field, marginBottom: 8 }} value={capLang} onChange={(e) => setCapLang(e.target.value)}>
                          {CAPTION_LANGS.map(([n, c]) => <option key={c} value={c}>I speak {n}</option>)}
                        </select>
                        <button style={{ ...btn(), marginBottom: 10, width: '100%', background: captionsOn ? '#166534' : '#334155' }} onClick={() => setCaptionsOn((o) => !o)}>
                          {captionsOn ? '● Transcribing what I say (tap to stop)' : 'Transcribe what I say'}
                        </button>
                      </>
                    : <p style={{ color: '#fbbf24' }}>Live transcript needs Chrome or Edge.</p>}
                  <p style={{ margin: '0 0 8px', ...muted }}>Each person turns this on for their own voice. Your browser may send your voice to its speech service to make the text. The AI summary is built from this and the notes.</p>
                  {captions.error && <p style={{ color: '#f87171' }}>{captions.error}</p>}
                  {lines.length === 0 ? <p style={{ color: '#64748b' }}>Nothing said yet.</p> : lines.map((l, i) => (
                    <p key={i} style={{ margin: '0 0 8px' }}><strong>{l.name}</strong> <span style={{ color: '#64748b', fontSize: 11 }}>{new Date(l.at).toLocaleTimeString()}</span><br />{l.text}</p>
                  ))}
                </>
              )}
              {tab === 'summary' && (
                <OutcomePanel roomId={roomId} meetingId={meetingId} title={title} lines={lines} notes={notes} people={[...everHere.current]} summary={summary} summarising={summarising}
                  language={sumLang} setLanguage={setSumLang} onWrite={() => { void makeSummary() }} recordingFile={recorder.file} recordingName={`${safeName(title)}-recording.webm`} userName={userName || 'Guest'} />
              )}
              {tab === 'people' && (
                <>
                  {call.isHost && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      <button style={smallBtn} onClick={() => host('muteAll')}>Mute everyone</button>
                      <button style={smallBtn} onClick={() => host(call.locked ? 'unlock' : 'lock')}>{call.locked ? 'Unlock the call' : 'Lock the call'}</button>
                    </div>
                  )}
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <li style={{ padding: '6px 0' }}>{userName || 'You'} (you){call.isHost ? ' · host' : ''}{call.myHand ? ' ✋' : ''}{call.sharing ? ' · sharing screen' : ''}</li>
                    {call.people.map((p) => (
                      <li key={p.id} style={{ padding: '6px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ flex: 1 }}>{p.name}{p.id === call.me ? '' : ''}{p.hand ? ' ✋' : ''}{p.sharing ? ' · sharing screen' : ''}</span>
                        {call.isHost && <><button style={smallBtn} onClick={() => host('mute', p.id)}>Mute</button><button style={{ ...smallBtn, background: '#7f1d1d' }} onClick={() => { if (window.confirm(`Remove ${p.name} from the call?`)) void host('kick', p.id) }}>Remove</button></>}
                      </li>
                    ))}
                  </ul>
                  {call.hostName && !call.isHost && <p style={muted}>Host: {call.hostName}</p>}
                  {!guest && (
                    <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1e293b' }}>
                      <div style={muted}>GUESTS (people without a LabOS account)</div>
                      <p style={{ ...muted, margin: '4px 0 8px' }}>They open the guest link, type a name, and wait. The host lets each one in; guests never get lab data.</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={{ ...smallBtn, background: '#2563eb' }} onClick={() => { void copyGuestLink() }}>Copy guest link</button>
                        <button style={{ ...smallBtn, background: '#7f1d1d' }} onClick={() => { if (window.confirm('Cancel the guest link and remove the guests who used it?')) revokeGuest({ token: getToken(), room_id: roomId }).then(() => toast.success('Guest link cancelled')).catch((e) => toast.error(errorText(e, 'Could not cancel'))) }}>Cancel guest link</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #1e293b', display: 'grid', gap: 8 }}>
              <button style={{ ...btn(), borderRadius: 8 }} onClick={() => save(`${safeName(title)}-notes.md`, notesFile(summary?.text ?? null))}>Download notes + summary + transcript</button>
              <button style={{ ...btn(), borderRadius: 8 }} disabled={!recorder.file} onClick={() => downloadRecording(recorder.file)}>{recorder.file ? 'Download recording' : 'Recording: stop it to download'}</button>
              <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={autoDownload} onChange={(e) => setAutoDownload(e.target.checked)} /> Auto-download my files when I leave
              </label>
            </div>
          </aside>
        )}
      </div>

      <footer style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 10, borderTop: '1px solid #1e293b', flexWrap: 'wrap', position: 'relative' }}>
        <button style={btn(call.micOn)} onClick={call.toggleMic} disabled={!call.localStream?.getAudioTracks().length}>{call.micOn ? 'Mute' : 'Unmute'}</button>
        <button style={btn(call.camOn)} onClick={call.toggleCam} disabled={!call.localStream?.getVideoTracks().length}>{call.camOn ? 'Camera off' : 'Camera on'}</button>
        <button style={{ ...btn(), background: call.sharing ? '#0369a1' : '#334155' }} onClick={call.sharing ? call.stopShare : call.startShare}>
          {call.sharing ? 'Stop my share' : shares.length ? 'Share my screen too' : 'Share screen'}
        </button>
        <button style={{ ...btn(), background: call.myHand ? '#a16207' : '#334155' }} onClick={() => setHand({ ...huddleAuth(), room_id: roomId, up: !call.myHand }).catch(() => undefined)}>{call.myHand ? 'Lower hand' : '✋ Raise hand'}</button>
        <span style={{ position: 'relative' }}>
          <button style={btn()} onClick={() => setShowReact((s) => !s)} aria-label="Reactions">😊</button>
          {showReact && (
            <span style={{ position: 'absolute', bottom: 50, left: 0, background: '#1e293b', borderRadius: 999, padding: '6px 10px', display: 'flex', gap: 6, zIndex: 6 }}>
              {REACTIONS.map((e) => <button key={e} aria-label={`React ${e}`} style={{ background: 'none', border: 0, fontSize: 24, cursor: 'pointer' }} onClick={() => { setShowReact(false); react({ ...huddleAuth(), room_id: roomId, name: userName || 'Guest', emoji: e }).catch(() => undefined) }}>{e}</button>)}
            </span>
          )}
        </span>
        <button style={{ ...btn(), background: boardOpen ? '#0369a1' : '#334155' }} onClick={() => setBoardOpen((b) => !b)}>Whiteboard</button>
        <span style={{ position: 'relative' }}>
          <button style={btn()} onClick={() => setShowDevices((s) => !s)} aria-label="Camera and microphone settings">⚙</button>
          {showDevices && (
            <div style={{ position: 'absolute', bottom: 50, left: 0, background: '#1e293b', borderRadius: 10, padding: 10, width: 'min(340px, 92vw)', display: 'grid', gap: 6, zIndex: 6, textAlign: 'left' }}>
              <label style={muted}>Camera<select style={field} defaultValue="" onChange={(e) => { if (e.target.value) void call.switchDevice('video', e.target.value) }}><option value="">Change camera…</option>{devices.filter((d) => d.kind === 'videoinput').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select></label>
              <label style={muted}>Microphone<select style={field} defaultValue="" onChange={(e) => { if (e.target.value) void call.switchDevice('audio', e.target.value) }}><option value="">Change microphone…</option>{devices.filter((d) => d.kind === 'audioinput').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}</select></label>
              <div style={muted}>Background</div>
              <BackgroundPicker value={call.background} busy={call.bgBusy} onChange={async (m) => { const err = await call.setBackground(m); if (!err) saveBg(m); return err }} />
            </div>
          )}
        </span>
        {recorder.supported && (
          <button style={{ ...btn(), background: recorder.recording ? '#991b1b' : '#334155' }}
            onClick={() => { if (recorder.recording) { void recorder.stop().then((b) => { if (b) toast.success('Recording ready: use Download recording or Save to LabOS (Summary tab)') }) } else if (recorder.start()) toast('Recording on this computer only. Tell the others you are recording.') }}>
            {recorder.recording ? 'Stop recording' : 'Record'}
          </button>
        )}
        <button style={btn(true, true)} onClick={() => { void finish() }} disabled={finishing}>{finishing ? 'Saving…' : 'Leave'}</button>
      </footer>

      {finishing && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(2,6,23,.85)', display: 'grid', placeItems: 'center', fontSize: 16 }}>
          {summarising ? 'Writing the summary and saving your meeting files…' : 'Saving your meeting files…'}
        </div>
      )}
    </div>
  )
}
