import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'

/**
 * Turns what THIS person says into text lines that everyone in the room can read and that feed the AI summary.
 * Uses the browser's built-in speech recognition (Chrome and Edge; the browser may send the sound to its speech service).
 */
interface Rec { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null; start(): void; stop(): void }
const Ctor = (typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined) as (new () => Rec) | undefined
const TOKEN_KEY = 'labos_auth_token'

export function useHuddleCaptions(roomId: string, name: string, enabled: boolean, lang = '') {
  const addLine = useMutation(api.huddleCall.addLine)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !Ctor) return
    const token = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? undefined
    const r = new Ctor()
    let stopped = false
    r.continuous = true; r.interimResults = false; r.lang = lang || navigator.language || 'en-US'
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) addLine({ token, room_id: roomId, name: name || 'Guest', text: String(e.results[i][0].transcript) }).catch(() => undefined)
      }
    }
    r.onerror = (e: any) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setError('Speech recognition is blocked in this browser.'); stopped = true } }
    r.onend = () => { if (!stopped) { try { r.start() } catch { /* already running */ } } } // the browser stops after silence: keep going
    try { r.start() } catch { /* already running */ }
    return () => { stopped = true; r.onend = null; try { r.stop() } catch { /* not running */ } }
  }, [enabled, roomId, name, lang, addLine])

  return { supported: !!Ctor, error }
}
