import React, { useEffect, useRef, useState, useCallback } from 'react'
import { videoApi } from '../../../lib/api'
import toast from 'react-hot-toast'

interface Participant {
  socket_id: string
  display_name: string
  user_id: number | null
  is_muted: boolean
  is_video_off: boolean
  is_screen_sharing: boolean
  hand_raised?: boolean
}

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  message: string
  timestamp: string
}

interface Transcription {
  id: string
  speaker_id: string
  speaker_name: string
  text: string
  timestamp: string
  is_final: boolean
}

interface Props {
  roomId: string
  meetingId?: number
  meetingTitle?: string
  userName: string
  userId: number
  onLeave: () => void
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export default function VideoCallRoom({ roomId, meetingId, meetingTitle, userName, userId, onLeave }: Props) {
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [mySocketId, setMySocketId] = useState<string>('')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [chatInput, setChatInput] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showTranscription, setShowTranscription] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const [windowMode, setWindowMode] = useState<'normal' | 'minimized' | 'fullscreen'>('normal')
  const containerRef = useRef<HTMLDivElement>(null)

  const enterFullscreen = async () => {
    const el = containerRef.current as any
    if (!el) return
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      setWindowMode('fullscreen')
    } catch (_) { setWindowMode('fullscreen') }
  }
  const exitFullscreen = async () => {
    try {
      const d: any = document
      if (d.fullscreenElement) await d.exitFullscreen()
      else if (d.webkitFullscreenElement) await d.webkitExitFullscreen()
    } catch (_) {}
    setWindowMode('normal')
  }
  // Sync state when user presses Esc to exit fullscreen
  useEffect(() => {
    const handler = () => {
      const d: any = document
      if (!d.fullscreenElement && !d.webkitFullscreenElement && windowMode === 'fullscreen') {
        setWindowMode('normal')
      }
    }
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      document.removeEventListener('webkitfullscreenchange', handler)
    }
  }, [windowMode])

  const wsRef = useRef<WebSocket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const recognitionRef = useRef<any>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Initialize WebRTC and WebSocket connection
  useEffect(() => {
    initializeCall()
    return () => {
      cleanup()
    }
  }, [roomId])

  const initializeCall = async () => {
    let stream: MediaStream | null = null

    // Try to get media with different fallback options
    try {
      // First try video + audio
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      setCameraEnabled(true)
      setMicEnabled(true)
    } catch (err: any) {
      console.warn('Full media access denied, trying audio only:', err)

      // Try audio only
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        setCameraEnabled(false)
        setMicEnabled(true)
        setIsVideoOff(true)
        toast('Camera access denied - joining with audio only', { icon: '🎤' })
      } catch (audioErr) {
        console.warn('Audio access denied, joining without media:', audioErr)

        // Join without any media
        setCameraEnabled(false)
        setMicEnabled(false)
        setIsVideoOff(true)
        setIsMuted(true)
        setPermissionError('Camera and microphone access denied. You can still view and chat.')
        toast('Joining without camera/microphone - you can still view others and chat', { icon: '👁️' })
      }
    }

    if (stream) {
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    }

    // Connect to signaling server regardless of media access
    connectToSignalingServer()
  }

  const connectToSignalingServer = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/api/video/ws/${roomId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      // Send join message
      ws.send(JSON.stringify({
        type: 'join',
        display_name: userName,
        user_id: userId,
      }))
    }

    ws.onmessage = handleSignalingMessage
    ws.onclose = () => {
      setIsConnected(false)
      toast.error('Disconnected from video call')
    }
    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
      toast.error('Connection error - check if backend is running')
    }
  }

  const requestMediaPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setCameraEnabled(true)
      setMicEnabled(true)
      setIsVideoOff(false)
      setIsMuted(false)
      setPermissionError(null)
      toast.success('Camera and microphone enabled!')

      // Add tracks to existing peer connections
      stream.getTracks().forEach(track => {
        peerConnectionsRef.current.forEach(pc => {
          pc.addTrack(track, stream)
        })
      })
    } catch (err: any) {
      toast.error('Permission denied: ' + (err.message || 'Could not access camera/microphone'))
    }
  }

  const cleanup = () => {
    // Stop all tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current?.getTracks().forEach(t => t.stop())

    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close())
    peerConnectionsRef.current.clear()

    // Close WebSocket
    wsRef.current?.close()

    // Stop speech recognition
    recognitionRef.current?.stop()
  }

  const handleSignalingMessage = async (event: MessageEvent) => {
    const data = JSON.parse(event.data)

    switch (data.type) {
      case 'room_state':
        setMySocketId(data.socket_id)
        setParticipants(data.participants)
        setChatMessages(data.chat_messages || [])
        setIsRecording(data.is_recording)
        // Create peer connections for existing participants
        data.participants.forEach((p: Participant) => {
          if (p.socket_id !== data.socket_id) {
            createPeerConnection(p.socket_id, true)
          }
        })
        break

      case 'participant_joined':
        setParticipants(data.participants)
        toast.success(`${data.participant.display_name} joined`)
        break

      case 'participant_left':
        setParticipants(data.participants)
        closePeerConnection(data.socket_id)
        break

      case 'offer':
        await handleOffer(data.sender, data.offer)
        break

      case 'answer':
        await handleAnswer(data.sender, data.answer)
        break

      case 'ice_candidate':
        await handleIceCandidate(data.sender, data.candidate)
        break

      case 'chat_message':
        setChatMessages(prev => [...prev, data.message])
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
        }
        break

      case 'transcription':
        if (data.transcription.is_final) {
          setTranscriptions(prev => [...prev, data.transcription])
        }
        break

      case 'media_state_changed':
        setParticipants(prev => prev.map(p =>
          p.socket_id === data.socket_id
            ? { ...p, is_muted: data.is_muted, is_video_off: data.is_video_off, is_screen_sharing: data.is_screen_sharing }
            : p
        ))
        break

      case 'hand_raise_changed':
        setParticipants(prev => prev.map(p =>
          p.socket_id === data.socket_id ? { ...p, hand_raised: data.raised } : p
        ))
        if (data.raised) {
          const participant = participants.find(p => p.socket_id === data.socket_id)
          toast(`${participant?.display_name || 'Someone'} raised their hand`, { icon: '✋' })
        }
        break

      case 'reaction':
        showReaction(data.sender_name, data.emoji)
        break

      case 'recording_state_changed':
        setIsRecording(data.is_recording)
        toast(data.is_recording ? 'Recording started' : 'Recording stopped', { icon: data.is_recording ? '🔴' : '⏹️' })
        break

      case 'video_pinned':
        setPinnedParticipant(data.pinned_socket_id)
        break
    }
  }

  const createPeerConnection = async (targetSocketId: string, createOffer: boolean) => {
    if (peerConnectionsRef.current.has(targetSocketId)) return

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peerConnectionsRef.current.set(targetSocketId, pc)

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      remoteStreamsRef.current.set(targetSocketId, event.streams[0])
      // Force re-render
      setParticipants(prev => [...prev])
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: 'ice_candidate',
          target: targetSocketId,
          candidate: event.candidate,
        }))
      }
    }

    // Create and send offer if initiator
    if (createOffer) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      wsRef.current?.send(JSON.stringify({
        type: 'offer',
        target: targetSocketId,
        offer: offer,
      }))
    }
  }

  const handleOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
    let pc = peerConnectionsRef.current.get(senderId)
    if (!pc) {
      await createPeerConnection(senderId, false)
      pc = peerConnectionsRef.current.get(senderId)!
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    wsRef.current?.send(JSON.stringify({
      type: 'answer',
      target: senderId,
      answer: answer,
    }))
  }

  const handleAnswer = async (senderId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(senderId)
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }

  const handleIceCandidate = async (senderId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(senderId)
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  const closePeerConnection = (socketId: string) => {
    const pc = peerConnectionsRef.current.get(socketId)
    if (pc) {
      pc.close()
      peerConnectionsRef.current.delete(socketId)
    }
    remoteStreamsRef.current.delete(socketId)
  }

  // Control handlers
  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = isMuted
      setIsMuted(!isMuted)
      wsRef.current?.send(JSON.stringify({
        type: 'media_state',
        is_muted: !isMuted,
        is_video_off: isVideoOff,
        is_screen_sharing: isScreenSharing,
      }))
    } else if (!micEnabled) {
      toast.error('Microphone not available - click "Enable Camera & Mic" to request access')
    }
  }

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = isVideoOff
      setIsVideoOff(!isVideoOff)
      wsRef.current?.send(JSON.stringify({
        type: 'media_state',
        is_muted: isMuted,
        is_video_off: !isVideoOff,
        is_screen_sharing: isScreenSharing,
      }))
    } else if (!cameraEnabled) {
      toast.error('Camera not available - click "Enable Camera & Mic" to request access')
    }
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
      // Restore camera video
      const videoTrack = localStreamRef.current?.getVideoTracks()[0]
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender && videoTrack) sender.replaceTrack(videoTrack)
      })
      setIsScreenSharing(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = stream
        const screenTrack = stream.getVideoTracks()[0]

        // Replace video track in all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(screenTrack)
        })

        screenTrack.onended = () => toggleScreenShare()
        setIsScreenSharing(true)
      } catch (err) {
        console.error('Screen share failed:', err)
      }
    }
    wsRef.current?.send(JSON.stringify({
      type: 'media_state',
      is_muted: isMuted,
      is_video_off: isVideoOff,
      is_screen_sharing: !isScreenSharing,
    }))
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    wsRef.current?.send(JSON.stringify({
      type: 'chat_message',
      message: chatInput.trim(),
    }))
    setChatInput('')
  }

  const sendReaction = (emoji: string) => {
    wsRef.current?.send(JSON.stringify({
      type: 'reaction',
      emoji,
    }))
  }

  const toggleHandRaise = () => {
    const me = participants.find(p => p.socket_id === mySocketId)
    wsRef.current?.send(JSON.stringify({
      type: 'hand_raise',
      raised: !me?.hand_raised,
    }))
  }

  const showReaction = (name: string, emoji: string) => {
    toast(`${name}: ${emoji}`, { duration: 2000 })
  }

  // AI Transcription using Web Speech API
  const toggleTranscription = () => {
    if (isTranscribing) {
      recognitionRef.current?.stop()
      setIsTranscribing(false)
    } else {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          const result = event.results[event.results.length - 1]
          const text = result[0].transcript
          wsRef.current?.send(JSON.stringify({
            type: 'transcription',
            text,
            is_final: result.isFinal,
          }))
        }

        recognition.onerror = (err: any) => {
          console.error('Speech recognition error:', err)
          setIsTranscribing(false)
        }

        recognition.start()
        recognitionRef.current = recognition
        setIsTranscribing(true)
        toast.success('AI Transcription started')
      } else {
        toast.error('Speech recognition not supported in this browser')
      }
    }
  }

  const leaveCall = () => {
    cleanup()
    onLeave()
  }

  // Styles
  const videoGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: pinnedParticipant
      ? '1fr 280px'
      : participants.length <= 2
        ? 'repeat(auto-fit, minmax(400px, 1fr))'
        : 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
    flex: 1,
    padding: 16,
    overflow: 'auto',
  }

  const videoTileStyle: React.CSSProperties = {
    position: 'relative',
    background: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: '16/9',
    minHeight: 200,
  }

  return (
    <div
      ref={containerRef}
      className="video-call-active"
      style={
        windowMode === 'minimized'
          ? {
              position: 'fixed', bottom: 20, right: 20, width: 340, height: 240,
              background: '#0f172a', display: 'flex', flexDirection: 'column', zIndex: 2000,
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.4)',
              resize: 'both',
            }
          : { position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column', zIndex: 2000 }
      }
    >
      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: windowMode === 'minimized' ? '6px 10px' : '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {/* Back arrow — minimizes the call so user can navigate elsewhere */}
          <button
            onClick={() => setWindowMode(windowMode === 'minimized' ? 'normal' : 'minimized')}
            title={windowMode === 'minimized' ? 'Expand call to full window' : 'Back — shrink to corner and keep the call running'}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: '#cbd5e1',
              padding: 4, fontSize: 18, display: 'flex', alignItems: 'center', flexShrink: 0,
              borderRadius: 6,
            }}
          >
            {windowMode === 'minimized' ? '↗' : '←'}
          </button>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: isConnected ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
          <h2 style={{ color: '#fff', fontSize: windowMode === 'minimized' ? 12 : 16, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🎥 LabHuddle · <span style={{ fontWeight: 500, color: '#cbd5e1' }}>{meetingTitle || `Room ${roomId}`}</span>
          </h2>
          {isRecording && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
              REC
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(!cameraEnabled || !micEnabled) && (
            <button
              onClick={requestMediaPermission}
              style={{
                background: '#f59e0b', border: 'none', borderRadius: 6,
                color: '#fff', padding: '6px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🎥 Enable Camera/Mic
            </button>
          )}
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?page=lab-meetings&room=${encodeURIComponent(roomId)}`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => toast.success('LabHuddle link copied — paste anywhere to invite'));
              } else {
                prompt('Copy this join link:', url);
              }
            }}
            style={{
              background: '#6366f1', border: 'none', borderRadius: 6,
              color: '#fff', padding: '6px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}
            title="Copy a shareable link that others can open to join this room"
          >
            🔗 Copy join link
          </button>
          <button
            onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}?page=lab-meetings&room=${encodeURIComponent(roomId)}`;
              const text = `Join my LabHuddle: ${meetingTitle || roomId}\n\n${url}\n\nLabHuddle is the secure internal video/audio room inside LabOS.`;
              const nav: any = navigator;
              if (nav.share) {
                try { await nav.share({ title: 'LabHuddle invite', text, url }); } catch (_) {}
              } else {
                window.open(`mailto:?subject=${encodeURIComponent('Join my LabHuddle')}&body=${encodeURIComponent(text)}`);
              }
            }}
            style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
              color: '#cbd5e1', padding: '6px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
            title="Share via email, Slack, SMS, etc."
          >
            ✉️ Invite
          </button>
          {windowMode !== 'minimized' && (
            <>
              {/* Minimize (to corner) */}
              <button
                onClick={() => setWindowMode('minimized')}
                title="Minimize to corner — call keeps running while you use the rest of the app"
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                  color: '#cbd5e1', padding: '6px 10px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                ▭
              </button>
              {/* Maximize / restore */}
              <button
                onClick={() => windowMode === 'fullscreen' ? exitFullscreen() : enterFullscreen()}
                title={windowMode === 'fullscreen' ? 'Exit fullscreen (Esc)' : 'Enter fullscreen — hide browser chrome'}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                  color: '#cbd5e1', padding: '6px 10px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {windowMode === 'fullscreen' ? '⛶' : '⤢'}
              </button>
            </>
          )}
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{windowMode === 'minimized' ? '' : `${participants.length} participant${participants.length !== 1 ? 's' : ''}`}</span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Video grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={videoGridStyle}>
            {/* Local video */}
            <div style={{ ...videoTileStyle, border: '2px solid #6366f1' }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: isVideoOff ? 'none' : 'block' }}
              />
              {isVideoOff && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e293b', gap: 12 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff' }}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  {permissionError && (
                    <div style={{ textAlign: 'center', padding: '0 16px', maxWidth: 360 }}>
                      <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px' }}>{permissionError}</p>
                      <button
                        onClick={requestMediaPermission}
                        style={{
                          background: '#6366f1', border: 'none', borderRadius: 6,
                          color: '#fff', padding: '8px 16px', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        🎥 Enable Camera & Mic
                      </button>
                      <details style={{ marginTop: 12, textAlign: 'left' }}>
                        <summary style={{ color: '#cbd5e1', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          Still blocked? Click for how to unblock →
                        </summary>
                        <div style={{ marginTop: 8, padding: 10, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11, color: '#cbd5e1', lineHeight: 1.6 }}>
                          <strong style={{ color: '#fbbf24' }}>The browser blocked the request</strong> — not LabOS. To re-grant:
                          <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                            <li>
                              <strong>Chrome / Edge:</strong> click the 🔒/ⓘ icon in the address bar →
                              set <em>Camera</em> and <em>Microphone</em> to <em>Allow</em> → reload.
                            </li>
                            <li>
                              <strong>Safari:</strong> Safari menu → Settings for This Website →
                              Camera/Microphone → Allow → reload.
                            </li>
                            <li>
                              <strong>Firefox:</strong> click the camera icon in the address bar →
                              remove "Blocked Temporarily" → reload and click Allow.
                            </li>
                            <li>
                              <strong>macOS system-wide:</strong> System Settings → Privacy &amp; Security →
                              Camera / Microphone → check your browser.
                            </li>
                            <li>
                              <strong>Mobile:</strong> Settings → Apps → your browser → Permissions →
                              Camera + Microphone → Allow.
                            </li>
                          </ol>
                          <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
                            Camera/mic only work on <code>localhost</code> or <code>https://</code> origins —
                            plain <code>http://</code> over a network is blocked by the browser.
                          </p>
                        </div>
                      </details>
                      <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 10 }}>
                        You can still <strong>view</strong> the room and use <strong>chat</strong> without camera or mic.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#00000099', color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 4 }}>
                  {userName} (You)
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {isMuted && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Muted</span>}
                  {isScreenSharing && <span style={{ background: '#22c55e', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Sharing</span>}
                  {!cameraEnabled && <span style={{ background: '#f59e0b', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>No Camera</span>}
                </div>
              </div>
            </div>

            {/* Remote videos */}
            {participants.filter(p => p.socket_id !== mySocketId).map(participant => (
              <RemoteVideo
                key={participant.socket_id}
                participant={participant}
                stream={remoteStreamsRef.current.get(participant.socket_id)}
                isPinned={pinnedParticipant === participant.socket_id}
                onPin={() => setPinnedParticipant(pinnedParticipant === participant.socket_id ? null : participant.socket_id)}
              />
            ))}
          </div>

          {/* Controls — fixed bottom bar, hides global FAB, never clips the Leave button */}
          <style>{`
            /* Hide the app's floating + button and any other floating overlays while the call is open */
            body:has(.video-call-active) .floating-action-button { display: none !important; }
          `}</style>
          <div style={{
            background: '#1e293b', borderTop: '1px solid #334155',
            padding: windowMode === 'minimized' ? '6px 8px' : '14px 16px',
            display: 'flex', alignItems: 'center', gap: windowMode === 'minimized' ? 6 : 10,
            flexWrap: windowMode === 'minimized' ? 'nowrap' : 'wrap',
            justifyContent: 'center',
            position: 'relative', zIndex: 1100,
          }}>
            {windowMode === 'minimized' ? (
              <>
                <ControlButton icon={isMuted ? '🔇' : '🎤'} label="" onClick={toggleMute} active={!isMuted} />
                <ControlButton icon={isVideoOff ? '📷' : '🎥'} label="" onClick={toggleVideo} active={!isVideoOff} />
                <button
                  onClick={() => setWindowMode('normal')}
                  title="Expand"
                  style={{
                    background: '#334155', border: 'none', borderRadius: 8, color: '#fff',
                    padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  ↗ Expand
                </button>
                <button
                  onClick={leaveCall}
                  title="Leave call"
                  style={{
                    background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff',
                    padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  }}
                >
                  📞 Leave
                </button>
              </>
            ) : (<>
            {/* Primary group: mic/video/screen/hand */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <ControlButton icon={isMuted ? '🔇' : '🎤'} label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} active={!isMuted} />
              <ControlButton icon={isVideoOff ? '📷' : '🎥'} label={isVideoOff ? 'Start Video' : 'Stop Video'} onClick={toggleVideo} active={!isVideoOff} />
              <ControlButton icon="🖥️" label={isScreenSharing ? 'Stop Share' : 'Share'} onClick={toggleScreenShare} active={isScreenSharing} />
              <ControlButton icon="✋" label="Raise Hand" onClick={toggleHandRaise} active={participants.find(p => p.socket_id === mySocketId)?.hand_raised} />
            </div>

            {/* Secondary group: chat/participants/transcribe + reactions menu */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', borderLeft: '1px solid #334155', paddingLeft: 12, marginLeft: 4 }}>
              <ControlButton icon="💬" label="Chat" onClick={() => setShowChat(!showChat)} active={showChat} badge={chatMessages.length} />
              <ControlButton icon="👥" label="People" onClick={() => setShowParticipants(!showParticipants)} active={showParticipants} badge={participants.length} />
              <ControlButton icon="📝" label={isTranscribing ? 'Stop AI' : 'AI Notes'} onClick={toggleTranscription} active={isTranscribing} />
              <ControlButton icon="📜" label="Transcript" onClick={() => setShowTranscription(!showTranscription)} active={showTranscription} />

              {/* Reactions popover */}
              <details style={{ position: 'relative' }}>
                <summary style={{
                  listStyle: 'none', cursor: 'pointer', background: '#334155', border: 'none',
                  borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 60,
                }}>
                  <span style={{ fontSize: 18 }}>😊</span>
                  React
                </summary>
                <div style={{
                  position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                  background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
                  padding: 8, display: 'flex', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {['👍', '❤️', '😂', '👏', '🎉', '🤔', '🔥', '✅'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      style={{ background: 'transparent', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontSize: 20 }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </details>
            </div>

            {/* LEAVE — always visible, separated, red, prominent */}
            <button
              onClick={leaveCall}
              title="Leave the meeting (your camera and mic will stop)"
              style={{
                background: '#ef4444', border: 'none', borderRadius: 12, color: '#fff',
                padding: '12px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
                marginLeft: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📞</span>
              Leave call
            </button>
            </>)}
          </div>
        </div>

        {/* Side panel — hidden when minimized */}
        {windowMode !== 'minimized' && (showChat || showParticipants || showTranscription) && (
          <div style={{ width: 320, background: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
            {/* Panel tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
              {showChat && <PanelTab label="Chat" active onClick={() => {}} />}
              {showParticipants && <PanelTab label="Participants" active onClick={() => {}} />}
              {showTranscription && <PanelTab label="Transcript" active onClick={() => {}} />}
            </div>

            {/* Chat panel */}
            {showChat && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                  {chatMessages.map(msg => (
                    <div key={msg.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{msg.sender_name}</span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.4 }}>{msg.message}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 12, borderTop: '1px solid #334155', display: 'flex', gap: 8 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendChat()}
                    placeholder="Type a message..."
                    style={{ flex: 1, background: '#334155', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={sendChat} style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 14px', cursor: 'pointer' }}>
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Participants panel */}
            {showParticipants && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {participants.map(p => (
                  <div key={p.socket_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #334155' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      {p.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                        {p.display_name} {p.socket_id === mySocketId && '(You)'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        {p.is_muted && <span style={{ color: '#94a3b8', fontSize: 10 }}>🔇</span>}
                        {p.is_video_off && <span style={{ color: '#94a3b8', fontSize: 10 }}>📷</span>}
                        {p.is_screen_sharing && <span style={{ color: '#22c55e', fontSize: 10 }}>🖥️</span>}
                        {p.hand_raised && <span style={{ fontSize: 10 }}>✋</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transcription panel */}
            {showTranscription && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {isTranscribing && (
                  <div style={{ background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: '#22c55e', fontSize: 12 }}>
                    🎙️ AI Transcription active...
                  </div>
                )}
                {transcriptions.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>
                    No transcriptions yet. Click "AI Transcribe" to start.
                  </div>
                ) : (
                  transcriptions.map(t => (
                    <div key={t.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{t.speaker_name}</span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>{new Date(t.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.4 }}>{t.text}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Remote video component
function RemoteVideo({ participant, stream, isPinned, onPin }: { participant: Participant; stream?: MediaStream; isPinned: boolean; onPin: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div style={{
      position: 'relative',
      background: '#1e293b',
      borderRadius: 12,
      overflow: 'hidden',
      aspectRatio: '16/9',
      minHeight: 200,
      border: isPinned ? '2px solid #f59e0b' : '1px solid #334155',
      gridColumn: isPinned ? '1' : undefined,
      gridRow: isPinned ? '1' : undefined,
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {participant.is_video_off && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff' }}>
            {participant.display_name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ background: '#00000099', color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 4 }}>
          {participant.display_name}
          {participant.hand_raised && ' ✋'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {participant.is_muted && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Muted</span>}
          {participant.is_screen_sharing && <span style={{ background: '#22c55e', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Sharing</span>}
          <button onClick={onPin} style={{ background: isPinned ? '#f59e0b' : '#334155', border: 'none', borderRadius: 4, color: '#fff', padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Control button component
function ControlButton({ icon, label, onClick, active, badge }: { icon: string; label: string; onClick: () => void; active?: boolean; badge?: number }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: 'relative',
        background: active ? '#6366f1' : '#334155',
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        padding: '12px 16px',
        cursor: 'pointer',
        fontSize: 18,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 64,
        transition: 'background 0.15s',
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: 10, color: active ? '#fff' : '#94a3b8' }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>
          {badge}
        </span>
      )}
    </button>
  )
}

// Panel tab component
function PanelTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? '#334155' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
        color: active ? '#fff' : '#94a3b8',
        padding: '12px 16px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}
