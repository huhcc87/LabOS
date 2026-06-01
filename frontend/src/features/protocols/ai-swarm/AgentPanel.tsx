// ═══════════════════════════════════════════════════════════════════════════
// AGENT PANEL — Detailed view of a single agent's analysis output
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import type { AgentOutput, AgentSection } from './swarmTypes'

interface Props {
  output: AgentOutput
}

export default function AgentPanel({ output }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1]))

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        background: `linear-gradient(135deg, ${output.color}11, transparent)`,
        borderLeft: `4px solid ${output.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>{output.icon}</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{output.title}</h3>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{output.summary}</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Duration: {output.durationMs}ms</span>
          <span>·</span>
          <span>{output.sections.length} sections</span>
          {output.warnings.length > 0 && (
            <>
              <span>·</span>
              <span style={{ color: '#f59e0b' }}>⚠️ {output.warnings.length} warning{output.warnings.length > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* Scores */}
      {output.scores.length > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {output.scores.map((score, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 36, height: 36 }}>
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={scoreColor(score.value)} strokeWidth="3"
                    strokeDasharray={`${(score.value / 100) * 88} 88`}
                    strokeLinecap="round" transform="rotate(-90 18 18)" />
                </svg>
                <span style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  fontSize: 9, fontWeight: 700, color: 'var(--text)',
                }}>{score.value}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{score.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{score.details}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {output.warnings.length > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: '#fef3c710' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>⚠️ Warnings</div>
          {output.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '4px 0', display: 'flex', gap: 6 }}>
              <span style={{ color: '#f59e0b' }}>•</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      <div>
        {output.sections.map((section, idx) => (
          <SectionBlock
            key={idx}
            section={section}
            isExpanded={expandedSections.has(idx)}
            onToggle={() => toggleSection(idx)}
          />
        ))}
      </div>

      {/* Recommendations */}
      {output.recommendations.length > 0 && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>💡 Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {output.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text)', display: 'flex', gap: 8, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{i + 1}.</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Block ────────────────────────────────────────────────────────
function SectionBlock({ section, isExpanded, onToggle }: { section: AgentSection; isExpanded: boolean; onToggle: () => void }) {
  const severityColor = section.severity === 'critical' ? '#ef4444' : section.severity === 'warning' ? '#f59e0b' : 'var(--text-muted)'

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', width: '100%', padding: '12px 20px',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 8, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{section.heading}</span>
        {section.severity && section.severity !== 'info' && (
          <span style={{ fontSize: 10, color: severityColor, fontWeight: 500, textTransform: 'uppercase' }}>
            {section.severity}
          </span>
        )}
      </button>
      {isExpanded && (
        <div style={{ padding: '0 20px 14px 38px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
            {section.content}
          </p>
          {section.items && section.items.length > 0 && (
            <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
              {section.items.map((item, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '3px 0', position: 'relative', paddingLeft: 12 }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>›</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function scoreColor(value: number): string {
  if (value >= 85) return '#10b981'
  if (value >= 70) return '#f59e0b'
  return '#ef4444'
}
