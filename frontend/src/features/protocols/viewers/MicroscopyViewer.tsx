import React, { useState } from 'react'

const SAMPLE_SLIDES = [
  { id: 'slide-001', name: 'HER2 IHC — Breast Cancer FFPE', stain: 'IHC', magnification: '40×', condition: 'Positive' },
  { id: 'slide-002', name: 'H&E — Colon Adenocarcinoma', stain: 'H&E', magnification: '20×', condition: 'Tumour Infiltrate' },
  { id: 'slide-003', name: 'DAPI/FITC — Mitosis Panel', stain: 'IF', magnification: '60×', condition: 'Cell Cycle Analysis' },
  { id: 'slide-004', name: 'Ki67 IHC — Proliferation Index', stain: 'IHC', magnification: '20×', condition: 'High Ki67' },
]

const STAIN_COLORS: Record<string, string> = {
  'IHC': '#8b5cf6',
  'H&E': '#ec4899',
  'IF': '#06b6d4',
  'ICC': '#10b981',
}

export default function MicroscopyViewer() {
  const [selectedSlide, setSelectedSlide] = useState(SAMPLE_SLIDES[0])
  const [zoom, setZoom] = useState(1)
  const [channel, setChannel] = useState('All')

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          {[0.5, 1, 2, 4].map(z => (
            <button key={z} onClick={() => setZoom(z)}
              style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: zoom === z ? 'var(--accent)' : 'transparent', color: zoom === z ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              {z}×
            </button>
          ))}
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Channel:</label>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
            {['All', 'DAPI', 'FITC', 'Cy3', 'Cy5', 'BF'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
          🔁 Rotate
        </button>
        <button style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
          📐 Measure
        </button>
        <button style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
          📸 Screenshot
        </button>
      </div>

      {/* Main viewer */}
      <div style={{
        height: 360, border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative grid overlay */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.05 }} width="100%" height="100%">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--text)" strokeWidth="1"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div style={{ fontSize: 52 }}>🔭</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>OpenSeadragon Microscopy Viewer</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 420 }}>
          Zoomable whole-slide image viewer for pathology and fluorescence microscopy.
          Supports TIFF, SVS, NDPI, and CZI formats via DZI tile pyramids.
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ background: 'var(--surface2)', padding: '4px 10px', borderRadius: 5 }}>{selectedSlide.stain}</span>
          <span style={{ background: 'var(--surface2)', padding: '4px 10px', borderRadius: 5 }}>{selectedSlide.magnification}</span>
          <span style={{ background: 'var(--surface2)', padding: '4px 10px', borderRadius: 5 }}>Zoom {zoom}×</span>
          <span style={{ background: 'var(--surface2)', padding: '4px 10px', borderRadius: 5 }}>Ch: {channel}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Backend: <code>/api/slides/{'{slideId}'}/tiles/{'{level}'}/{'{x}_{y}.jpg'}</code>
        </div>
      </div>

      {/* Slide browser */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Slide Library</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SAMPLE_SLIDES.map(slide => (
            <div key={slide.id}
              onClick={() => setSelectedSlide(slide)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: selectedSlide.id === slide.id ? 'var(--surface2)' : 'var(--surface)',
                border: `1px solid ${selectedSlide.id === slide.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8, cursor: 'pointer',
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 6,
                background: STAIN_COLORS[slide.stain] || '#6366f1',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {slide.stain}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{slide.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slide.condition} · {slide.magnification}</div>
              </div>
              <button style={{ padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text)' }}>
                Open
              </button>
            </div>
          ))}
        </div>
        <button style={{ marginTop: 8, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>
          + Upload Slide
        </button>
      </div>
    </div>
  )
}
