import React, { useState } from 'react'

const EXAMPLE_STRUCTURES = [
  { pdbId: '1TUP', name: 'TP53 (Tumour Suppressor)', organism: 'Human' },
  { pdbId: '4HHB', name: 'Haemoglobin', organism: 'Human' },
  { pdbId: '6VXX', name: 'SARS-CoV-2 Spike Protein', organism: 'Virus' },
  { pdbId: '1MBN', name: 'Myoglobin', organism: 'Sperm whale' },
]

export default function ProteinStructureViewer() {
  const [pdbId, setPdbId] = useState('1TUP')
  const [renderStyle, setRenderStyle] = useState<'cartoon' | 'surface' | 'sphere' | 'stick'>('cartoon')
  const [colorScheme, setColorScheme] = useState<'chain' | 'secondary' | 'bfactor' | 'hydrophobicity'>('secondary')

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PDB ID</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={pdbId} onChange={e => setPdbId(e.target.value.toUpperCase())}
              style={{ width: 90, padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', textTransform: 'uppercase' }} />
            <button style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Load</button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>RENDER STYLE</label>
          <select value={renderStyle} onChange={e => setRenderStyle(e.target.value as any)}
            style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
            <option value="cartoon">Cartoon</option>
            <option value="surface">Surface</option>
            <option value="sphere">Sphere</option>
            <option value="stick">Stick</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>COLOUR BY</label>
          <select value={colorScheme} onChange={e => setColorScheme(e.target.value as any)}
            style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
            <option value="secondary">Secondary Structure</option>
            <option value="chain">Chain</option>
            <option value="bfactor">B-Factor</option>
            <option value="hydrophobicity">Hydrophobicity</option>
          </select>
        </div>
      </div>

      {/* Viewer placeholder */}
      <div style={{
        height: 340, border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 52 }}>🔬</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Mol* Protein Structure Viewer</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 420 }}>
          3D protein structure viewer powered by Mol* (molstar). Supports PDB, mmCIF, SDF, and MOL2 formats.
          WebGL rendering will initialise here once the viewer is fully loaded.
        </div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--surface2)', padding: '6px 14px', borderRadius: 6, color: 'var(--accent)' }}>
          PDB: {pdbId} · Style: {renderStyle} · Color: {colorScheme}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Backend integration: <code>/api/structures/{'{pdbId}'}/file</code>
        </div>
      </div>

      {/* Quick load examples */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Example Structures</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EXAMPLE_STRUCTURES.map(s => (
            <button key={s.pdbId} onClick={() => setPdbId(s.pdbId)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: `1px solid ${pdbId === s.pdbId ? 'var(--accent)' : 'var(--border)'}`,
                background: pdbId === s.pdbId ? 'var(--accent)' : 'var(--surface)', color: pdbId === s.pdbId ? '#fff' : 'var(--text)',
                cursor: 'pointer', fontSize: 12, textAlign: 'left',
              }}>
              <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.pdbId}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{s.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
