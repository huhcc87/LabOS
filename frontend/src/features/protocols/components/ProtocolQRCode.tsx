import React, { useState } from 'react'
import QRCode from 'react-qr-code'
import type { Protocol } from '../types/protocol.types'

interface Props {
  protocol: Protocol
  size?: number
}

export default function ProtocolQRCode({ protocol, size = 140 }: Props) {
  const [show, setShow] = useState(false)
  const value = `${window.location.origin}/protocols/${protocol.id}`

  const downloadQR = () => {
    const svg = document.getElementById(`qr-${protocol.id}`)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = size * 2
    canvas.height = size * 2
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const a = document.createElement('a')
      a.download = `protocol-qr-${protocol.id}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 7, color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        {show ? '✕ Hide QR' : '⊞ QR Code'}
      </button>

      {show && (
        <div style={{
          marginTop: 12, padding: 16, background: '#fff', borderRadius: 10,
          border: '1px solid var(--border)', display: 'inline-block',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <QRCode id={`qr-${protocol.id}`} value={value} size={size} />
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6, wordBreak: 'break-all', maxWidth: size }}>
              {protocol.id}
            </div>
            <button
              onClick={downloadQR}
              style={{
                fontSize: 11, padding: '4px 10px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 5, cursor: 'pointer',
              }}
            >
              Download PNG
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
