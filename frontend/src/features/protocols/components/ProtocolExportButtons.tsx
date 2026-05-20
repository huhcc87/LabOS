import React, { useState } from 'react'
import type { Protocol } from '../types/protocol.types'
import { exportProtocolPDF, exportProtocolDOCX, exportProtocolXLSX, exportProtocolCSV } from '../lib/protocolExport'

interface Props {
  protocol: Protocol
  compact?: boolean
}

export default function ProtocolExportButtons({ protocol, compact }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  const handle = async (key: string, fn: () => Promise<void> | void) => {
    setLoading(key)
    try { await fn() } catch (e) { console.error(e) } finally { setLoading(null) }
  }

  const btn = (label: string, key: string, color: string, fn: () => any) => (
    <button
      key={key}
      onClick={() => handle(key, fn)}
      disabled={loading !== null}
      style={{
        padding: compact ? '6px 10px' : '8px 14px',
        background: loading === key ? 'var(--surface2)' : color,
        color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer',
        fontSize: compact ? 12 : 13, fontWeight: 600, opacity: loading && loading !== key ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {loading === key ? '...' : label}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {btn('📄 PDF', 'pdf', '#dc2626', () => exportProtocolPDF(protocol))}
      {btn('📝 DOCX', 'docx', '#2563eb', () => exportProtocolDOCX(protocol))}
      {btn('📊 XLSX', 'xlsx', '#16a34a', () => exportProtocolXLSX(protocol))}
      {btn('📋 CSV', 'csv', '#7c3aed', () => exportProtocolCSV(protocol))}
    </div>
  )
}
