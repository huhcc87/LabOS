import React, { useState } from 'react'

const SAMPLE_TRACKS = [
  { name: 'RNA-seq: Control (BAM)', type: 'BAM', status: 'ready', size: '1.2 GB' },
  { name: 'RNA-seq: Treatment (BAM)', type: 'BAM', status: 'ready', size: '980 MB' },
  { name: 'Variants (VCF)', type: 'VCF', status: 'ready', size: '24 MB' },
  { name: 'Peaks (BED)', type: 'BED', status: 'ready', size: '2.1 MB' },
]

export default function GenomicsViewer() {
  const [locus, setLocus] = useState('chr17:7,670,000-7,670,600')
  const [genome, setGenome] = useState('hg38')
  const [tracks, setTracks] = useState(SAMPLE_TRACKS.map((t, i) => ({ ...t, visible: i < 2 })))

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GENOME</label>
            <select value={genome} onChange={e => setGenome(e.target.value)}
              style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
              {['hg38', 'hg19', 'mm10', 'mm39', 'GRCh38', 'GRCm39'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>LOCUS / GENE</label>
            <input value={locus} onChange={e => setLocus(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
              placeholder="e.g. TP53 or chr17:7,670,000-7,670,600" />
          </div>
          <button style={{ marginTop: 18, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Go
          </button>
        </div>
      </div>

      {/* Viewer placeholder */}
      <div style={{
        height: 320, border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 48 }}>🧬</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>IGV.js Genomics Viewer</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 420 }}>
          Interactive genome browser for BAM, VCF, BED, and RNA-seq tracks.
          IGV.js will render here once backend file hosting is configured.
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--surface2)', padding: '6px 12px', borderRadius: 6 }}>
          {genome} · {locus}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Backend integration point: <code>/api/genomics/tracks/:sampleId</code>
        </div>
      </div>

      {/* Track list */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Tracks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tracks.map((track, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <input type="checkbox" checked={track.visible} onChange={() => setTracks(ts => ts.map((t, j) => j === i ? { ...t, visible: !t.visible } : t))} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{track.name}</span>
              <span style={{ fontSize: 11, padding: '3px 7px', background: 'var(--surface2)', borderRadius: 4, color: 'var(--text-muted)' }}>{track.type}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{track.size}</span>
            </div>
          ))}
        </div>
        <button style={{ marginTop: 8, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>
          + Load Track File
        </button>
      </div>
    </div>
  )
}
