import type { CSSProperties } from 'react'

const TOKEN_KEY = 'labos_auth_token'
export const getToken = (): string | undefined => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? undefined

export const clock = (s: number): string => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
export const safeName = (s: string): string => s.replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'LabHuddle'

/** Save text or a file to the person's downloads. */
export function save(filename: string, data: Blob | string, type = 'text/markdown'): void {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type: `${type};charset=utf-8` }) : data)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const btn = (on = true, danger = false): CSSProperties => ({
  border: 0, borderRadius: 999, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  background: danger ? '#dc2626' : on ? '#334155' : '#7f1d1d', color: '#fff',
})

export const smallBtn: CSSProperties = { border: 0, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#334155', color: '#fff' }
export const field: CSSProperties = { width: '100%', background: '#020617', color: '#fff', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', fontSize: 14 }
export const muted: CSSProperties = { color: '#94a3b8', fontSize: 12 }

export const errorText = (e: unknown, fallback: string): string => {
  const msg = (e as { data?: string; message?: string })?.data ?? (e as Error)?.message ?? fallback
  return String(msg).replace(/^.*Uncaught ConvexError:\s*/, '').slice(0, 160)
}

// ── Guests: someone who joined through a guest link (no LabOS account) holds a secret for one call ──
let guestSecret: string | undefined
export const setGuestSession = (secret: string | undefined): void => { guestSecret = secret }
export const isGuestSession = (): boolean => !!guestSecret
/** The sign-in to send with call requests: the guest's secret, or the member's session token. */
export const huddleAuth = (): { token?: string; guest?: string } => (guestSecret ? { guest: guestSecret } : { token: getToken() })
