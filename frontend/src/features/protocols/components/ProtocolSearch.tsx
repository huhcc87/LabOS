import React, { useState, useCallback } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  resultCount: number
}

export default function ProtocolSearch({ value, onChange, resultCount }: Props) {
  const [focused, setFocused] = useState(false)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }, [onChange])

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search title, tags, DOI, PMID, authors, keywords..."
        style={{
          width: '100%', padding: '12px 40px 12px 42px', background: 'var(--surface)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8,
          color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box',
          transition: 'all 0.2s ease', boxShadow: focused ? '0 0 0 3px var(--accent-light)' : 'none',
        }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0,
        }}>✕</button>
      )}
      {value && (
        <div style={{ position: 'absolute', right: value ? 36 : 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>
          {resultCount}
        </div>
      )}
    </div>
  )
}
