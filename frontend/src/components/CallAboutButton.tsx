/** Opens a LabHuddle call about one thing (an incident, an experiment…). Everyone who opens the same link lands in the same room. */
export default function CallAboutButton({ kind, id, label = 'Call about this' }: { kind: string; id: string | number; label?: string }) {
  const room = `ctx_${kind}_${String(id).replace(/[^A-Za-z0-9_-]/g, '')}`
  const link = `${window.location.origin}/?room=${encodeURIComponent(room)}`
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <a href={link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 12, textDecoration: 'none' }}>🎥 {label}</a>
      <button type="button" aria-label="Copy call link" title="Copy call link to send to someone"
        onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(link) }}
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>🔗</button>
    </span>
  )
}
