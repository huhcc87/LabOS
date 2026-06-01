// ═══════════════════════════════════════════════════════════════════════════
// SWARM CONSENSUS VIEW — Visualizes multi-agent agreement & scoring
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { SwarmConsensus } from './swarmTypes'

interface Props {
  consensus: SwarmConsensus
}

export default function SwarmConsensusView({ consensus }: Props) {
  const riskColors: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: '#10b98115', text: '#10b981', border: '#10b98140' },
    medium: { bg: '#f59e0b15', text: '#f59e0b', border: '#f59e0b40' },
    high: { bg: '#f9731615', text: '#f97316', border: '#f9731640' },
    critical: { bg: '#ef444415', text: '#ef4444', border: '#ef444440' },
  }
  const risk = riskColors[consensus.riskLevel] || riskColors.medium

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overall Score Card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor(consensus.overallScore), marginBottom: 4 }}>
          {consensus.overallScore}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>Overall Protocol Score</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Based on consensus from 10 specialized agents
        </div>

        {/* Risk Badge */}
        <div style={{
          display: 'inline-block', marginTop: 12, padding: '6px 16px',
          background: risk.bg, border: `1px solid ${risk.border}`,
          borderRadius: 20, fontSize: 12, fontWeight: 600, color: risk.text,
          textTransform: 'uppercase',
        }}>
          Risk Level: {consensus.riskLevel}
        </div>
      </div>

      {/* Dimension Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { label: 'Scientific Validity', value: consensus.scientificValidity, icon: '🔬' },
          { label: 'Safety Compliance', value: consensus.safetyCompliance, icon: '☣️' },
          { label: 'Reproducibility', value: consensus.reproducibility, icon: '🔄' },
          { label: 'Optimization Potential', value: consensus.optimizationPotential, icon: '⚡' },
          { label: 'Confidence Score', value: consensus.confidenceScore, icon: '🎯' },
          { label: 'Agent Agreement', value: consensus.agentAgreement, icon: '🤝' },
        ].map(dim => (
          <div key={dim.label} style={{
            padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{dim.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{dim.label}</span>
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                width: `${dim.value}%`, height: '100%',
                background: scoreColor(dim.value), borderRadius: 3,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(dim.value) }}>{dim.value}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/100</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top Recommendations */}
      {consensus.topRecommendations.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            💡 Top Recommendations (Consensus)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {consensus.topRecommendations.map((rec, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--surface2)',
                borderRadius: 8, alignItems: 'flex-start',
              }}>
                <span style={{
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent)', color: '#fff', borderRadius: '50%',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {consensus.conflicts.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid #f59e0b40', borderRadius: 12, padding: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>
            ⚠️ Agent Conflicts & Resolutions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {consensus.conflicts.map((conflict, i) => (
              <div key={i} style={{ padding: '12px 14px', background: '#f59e0b08', borderRadius: 8, border: '1px solid #f59e0b20' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Agents: {conflict.agents.join(', ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <strong>Issue:</strong> {conflict.issue}
                </div>
                <div style={{ fontSize: 12, color: '#10b981' }}>
                  <strong>Resolution:</strong> {conflict.resolution}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function scoreColor(value: number): string {
  if (value >= 85) return '#10b981'
  if (value >= 70) return '#f59e0b'
  if (value >= 50) return '#f97316'
  return '#ef4444'
}
