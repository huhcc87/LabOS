import React, { useState, useCallback } from 'react'

// Lightweight built-in workflow builder (avoids reactflow bundle weight issues)
// Each node is a protocol step; edges connect them sequentially or with branching

interface WFNode {
  id: string
  label: string
  type: 'start' | 'step' | 'decision' | 'end'
  x: number
  y: number
  color?: string
}

interface WFEdge {
  from: string
  to: string
  label?: string
}

interface Workflow {
  id: string
  name: string
  nodes: WFNode[]
  edges: WFEdge[]
}

const WORKFLOW_TEMPLATES: Workflow[] = [
  {
    id: 'dna-extraction',
    name: 'DNA Extraction → NGS',
    nodes: [
      { id: 'n1', label: 'Sample Collection', type: 'start', x: 100, y: 50, color: '#10b981' },
      { id: 'n2', label: 'QC Check\n(Sufficient material?)', type: 'decision', x: 100, y: 150, color: '#f59e0b' },
      { id: 'n3', label: 'Tissue Homogenisation', type: 'step', x: 100, y: 260, color: '#6366f1' },
      { id: 'n4', label: 'Lysis & Digestion', type: 'step', x: 100, y: 350, color: '#6366f1' },
      { id: 'n5', label: 'Column Purification', type: 'step', x: 100, y: 440, color: '#6366f1' },
      { id: 'n6', label: 'Quantification\n(Qubit/NanoDrop)', type: 'step', x: 100, y: 530, color: '#8b5cf6' },
      { id: 'n7', label: 'Library Prep', type: 'step', x: 100, y: 620, color: '#6366f1' },
      { id: 'n8', label: 'Sequencing', type: 'end', x: 100, y: 710, color: '#2563eb' },
      { id: 'n9', label: 'Request More\nMaterial', type: 'end', x: 280, y: 260, color: '#dc2626' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3', label: 'Yes' },
      { from: 'n2', to: 'n9', label: 'No' },
      { from: 'n3', to: 'n4' },
      { from: 'n4', to: 'n5' },
      { from: 'n5', to: 'n6' },
      { from: 'n6', to: 'n7' },
      { from: 'n7', to: 'n8' },
    ],
  },
  {
    id: 'rnaseq',
    name: 'RNA-seq Sample Prep',
    nodes: [
      { id: 'n1', label: 'Cell Culture\nor Tissue', type: 'start', x: 100, y: 50, color: '#10b981' },
      { id: 'n2', label: 'RNA Extraction\n(TRIzol/RNeasy)', type: 'step', x: 100, y: 150, color: '#6366f1' },
      { id: 'n3', label: 'RNA QC\n(RIN ≥ 7?)', type: 'decision', x: 100, y: 250, color: '#f59e0b' },
      { id: 'n4', label: 'DNase Treatment', type: 'step', x: 100, y: 350, color: '#6366f1' },
      { id: 'n5', label: 'rRNA Depletion\nor Poly-A Selection', type: 'step', x: 100, y: 440, color: '#6366f1' },
      { id: 'n6', label: 'cDNA Synthesis\n& Fragmentation', type: 'step', x: 100, y: 530, color: '#6366f1' },
      { id: 'n7', label: 'Adapter Ligation\n& Indexing', type: 'step', x: 100, y: 620, color: '#8b5cf6' },
      { id: 'n8', label: 'Library QC\n(Bioanalyzer)', type: 'step', x: 100, y: 710, color: '#8b5cf6' },
      { id: 'n9', label: 'Sequencing', type: 'end', x: 100, y: 800, color: '#2563eb' },
      { id: 'n10', label: 'Discard /\nRe-extract', type: 'end', x: 290, y: 350, color: '#dc2626' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4', label: 'Pass' },
      { from: 'n3', to: 'n10', label: 'Fail' },
      { from: 'n4', to: 'n5' },
      { from: 'n5', to: 'n6' },
      { from: 'n6', to: 'n7' },
      { from: 'n7', to: 'n8' },
      { from: 'n8', to: 'n9' },
    ],
  },
  {
    id: 'crispr',
    name: 'CRISPR Knock-in Workflow',
    nodes: [
      { id: 'n1', label: 'Design gRNA\n(Benchling/CRISPOR)', type: 'start', x: 100, y: 50, color: '#10b981' },
      { id: 'n2', label: 'Clone into\nExpression Vector', type: 'step', x: 100, y: 150, color: '#6366f1' },
      { id: 'n3', label: 'Validate by\nSanger Sequencing', type: 'step', x: 100, y: 240, color: '#6366f1' },
      { id: 'n4', label: 'Transfect Cells\n(Lipofect. / RNP)', type: 'step', x: 100, y: 330, color: '#6366f1' },
      { id: 'n5', label: 'Puromycin\nSelection', type: 'step', x: 100, y: 420, color: '#6366f1' },
      { id: 'n6', label: 'Single Cell\nCloning', type: 'step', x: 100, y: 510, color: '#6366f1' },
      { id: 'n7', label: 'PCR / ICE\nAnalysis', type: 'step', x: 100, y: 600, color: '#8b5cf6' },
      { id: 'n8', label: 'Editing\nEfficiency ≥ 50%?', type: 'decision', x: 100, y: 690, color: '#f59e0b' },
      { id: 'n9', label: 'Expand &\nCryopreserve', type: 'end', x: 100, y: 790, color: '#2563eb' },
      { id: 'n10', label: 'Repeat\nTransfection', type: 'end', x: 290, y: 690, color: '#dc2626' },
    ],
    edges: [
      { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n4' },
      { from: 'n4', to: 'n5' }, { from: 'n5', to: 'n6' }, { from: 'n6', to: 'n7' },
      { from: 'n7', to: 'n8' }, { from: 'n8', to: 'n9', label: 'Yes' },
      { from: 'n8', to: 'n10', label: 'No' },
    ],
  },
]

const NODE_W = 170
const NODE_H = 52

function WorkflowCanvas({ workflow }: { workflow: Workflow }) {
  const maxY = Math.max(...workflow.nodes.map(n => n.y)) + NODE_H + 60
  const maxX = Math.max(...workflow.nodes.map(n => n.x)) + NODE_W + 60

  const nodeById = Object.fromEntries(workflow.nodes.map(n => [n.id, n]))

  const nodeCenter = (n: WFNode) => ({
    x: n.x + NODE_W / 2,
    y: n.y + NODE_H / 2,
  })

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 500, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
      <svg width={Math.max(maxX, 420)} height={maxY} style={{ display: 'block' }}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="var(--text-muted, #94a3b8)" />
          </marker>
        </defs>

        {/* Edges */}
        {workflow.edges.map((edge, i) => {
          const from = nodeById[edge.from]
          const to = nodeById[edge.to]
          if (!from || !to) return null
          const fc = nodeCenter(from)
          const tc = nodeCenter(to)
          const midX = (fc.x + tc.x) / 2
          const midY = (fc.y + tc.y) / 2
          return (
            <g key={i}>
              <line
                x1={fc.x} y1={fc.y + NODE_H / 2 - 4}
                x2={tc.x} y2={tc.y - NODE_H / 2 + 4}
                stroke="var(--border)" strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              {edge.label && (
                <text x={midX} y={midY} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {workflow.nodes.map(node => {
          const isDecision = node.type === 'decision'
          const lines = node.label.split('\n')
          return (
            <g key={node.id}>
              {isDecision ? (
                <polygon
                  points={`${node.x + NODE_W / 2},${node.y} ${node.x + NODE_W},${node.y + NODE_H / 2} ${node.x + NODE_W / 2},${node.y + NODE_H} ${node.x},${node.y + NODE_H / 2}`}
                  fill={node.color || '#6366f1'}
                  opacity={0.15}
                  stroke={node.color || '#6366f1'}
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={node.x} y={node.y} width={NODE_W} height={NODE_H}
                  rx={node.type === 'start' || node.type === 'end' ? 26 : 8}
                  fill={node.color || '#6366f1'}
                  opacity={node.type === 'start' || node.type === 'end' ? 0.9 : 0.15}
                  stroke={node.color || '#6366f1'}
                  strokeWidth={1.5}
                />
              )}
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={node.x + NODE_W / 2}
                  y={node.y + NODE_H / 2 + (li - (lines.length - 1) / 2) * 15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={node.type === 'start' || node.type === 'end' ? '#fff' : 'var(--text)'}
                  fontSize={11}
                  fontWeight={node.type === 'start' || node.type === 'end' ? 600 : 400}
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function ProtocolWorkflowBuilder() {
  const [selected, setSelected] = useState(WORKFLOW_TEMPLATES[0])

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Workflow:</span>
        {WORKFLOW_TEMPLATES.map(wf => (
          <button
            key={wf.id}
            onClick={() => setSelected(wf)}
            style={{
              padding: '7px 14px', borderRadius: 7, border: `1px solid ${selected.id === wf.id ? 'var(--accent)' : 'var(--border)'}`,
              background: selected.id === wf.id ? 'var(--accent)' : 'var(--surface)',
              color: selected.id === wf.id ? '#fff' : 'var(--text)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}
          >
            {wf.name}
          </button>
        ))}
      </div>

      <WorkflowCanvas workflow={selected} />

      <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#10b981', label: 'Start / Input' },
          { color: '#6366f1', label: 'Protocol Step' },
          { color: '#f59e0b', label: 'Decision / QC Gate' },
          { color: '#2563eb', label: 'End / Output' },
          { color: '#dc2626', label: 'Failure / Repeat' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}
