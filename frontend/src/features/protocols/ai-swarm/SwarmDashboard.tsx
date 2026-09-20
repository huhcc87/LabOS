// ═══════════════════════════════════════════════════════════════════════════
// AI SWARM DASHBOARD — Main orchestration UI for the 10-agent swarm
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import type { UseSwarmReturn } from './useSwarm'
import { AGENT_DEFINITIONS } from './swarmTypes'
import type { AgentId, AgentOutput } from './swarmTypes'
import SOPGeneratorForm from './SOPGeneratorForm'
import AgentPanel from './AgentPanel'
import SwarmConsensusView from './SwarmConsensusView'
import SwarmChat from './SwarmChat'
import SOPViewer from './SOPViewer'

interface Props {
  swarm: UseSwarmReturn
}

export default function SwarmDashboard({ swarm }: Props) {
  const [resultTab, setResultTab] = useState<'agents' | 'consensus' | 'sop' | 'chat'>('agents')

  // ── IDLE STATE ────────────────────────────────────────────────────────
  if (swarm.phase === 'idle') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
        <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          AI Swarm Protocol Intelligence
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 540, margin: '0 auto 24px' }}>
          10 specialized AI agents collaborate to create, validate, optimize, and enhance
          biomedical protocols with comprehensive quality control and safety analysis.
        </p>

        {/* Agent Grid Preview */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12, maxWidth: 800, margin: '0 auto 32px',
        }}>
          {AGENT_DEFINITIONS.map(agent => (
            <div key={agent.id} style={{
              padding: '14px 12px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 10,
              borderLeft: `3px solid ${agent.color}`,
            }}>
              <span style={{ fontSize: 20 }}>{agent.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{agent.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{agent.role.slice(0, 40)}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={swarm.startNewSession} style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', borderRadius: 10, color: '#fff', padding: '14px 32px',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
        }}>
          🚀 Launch AI Swarm Analysis
        </button>

        {/* Previous Sessions */}
        {swarm.sessions.length > 0 && (
          <div style={{ marginTop: 40, maxWidth: 600, margin: '40px auto 0' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, textAlign: 'left' }}>
              Previous Sessions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {swarm.sessions.slice(0, 5).map(s => (
                <button key={s.id} onClick={() => swarm.loadSession(s)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{s.protocolTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.protocolCategory} · Score: {s.consensus.overallScore}/100
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(s.startedAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── INPUT STATE ───────────────────────────────────────────────────────
  if (swarm.phase === 'input') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={swarm.resetSwarm} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13,
          }}>← Back</button>
          <h2 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, margin: 0 }}>
            🧬 Configure Protocol Analysis
          </h2>
        </div>
        <SOPGeneratorForm onSubmit={swarm.runAnalysis} isRunning={swarm.isRunning} />
      </div>
    )
  }

  // ── RUNNING STATE ─────────────────────────────────────────────────────
  if (swarm.phase === 'running') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>🧬</div>
        <h2 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
          AI Swarm Analysis in Progress
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
          10 agents are collaboratively analyzing your protocol...
        </p>

        {/* Progress Bar */}
        <div style={{
          width: '100%', height: 8, background: 'var(--surface2)',
          borderRadius: 4, overflow: 'hidden', marginBottom: 12,
        }}>
          <div style={{
            width: `${swarm.progress}%`, height: '100%',
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            borderRadius: 4, transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          {swarm.progress}% — {swarm.currentAgent || 'Initializing...'}
        </div>

        {/* Agent Status Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10, textAlign: 'left',
        }}>
          {AGENT_DEFINITIONS.map((agent, idx) => {
            const output = swarm.agentOutputs.find(o => o.agentId === agent.id)
            const isActive = swarm.currentAgent === agent.name
            return (
              <div key={agent.id} style={{
                padding: '10px 12px', background: 'var(--surface)',
                border: `1px solid ${isActive ? agent.color : output ? '#10b981' : 'var(--border)'}`,
                borderRadius: 8, opacity: output ? 1 : isActive ? 1 : 0.5,
                transition: 'all 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{agent.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{agent.name}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  {output ? '✓ Complete' : isActive ? '⚡ Analyzing...' : 'Pending'}
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={swarm.cancelAnalysis} style={{
          marginTop: 32, background: 'none', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-muted)', padding: '10px 24px',
          cursor: 'pointer', fontSize: 13,
        }}>
          Cancel
        </button>
      </div>
    )
  }

  // ── COMPLETE / CHAT / SOP VIEW STATE ──────────────────────────────────
  const RESULT_TABS: { id: typeof resultTab; label: string; icon: string }[] = [
    { id: 'agents', label: 'Agent Results', icon: '🤖' },
    { id: 'consensus', label: 'Consensus', icon: '📊' },
    { id: 'sop', label: 'Generated SOP', icon: '📋' },
    { id: 'chat', label: 'Protocol Chat', icon: '💬' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={swarm.resetSwarm} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13,
          }}>← Back</button>
          <div>
            <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, margin: 0 }}>
              {swarm.session?.protocolTitle || 'Swarm Analysis Results'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>
              {swarm.session?.protocolCategory} · {swarm.agentOutputs.length} agents · Score: {swarm.consensus?.overallScore || 0}/100
            </p>
          </div>
        </div>
        <button onClick={swarm.startNewSession} style={{
          background: 'var(--accent)', border: 'none', borderRadius: 8,
          color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>
          + New Analysis
        </button>
      </div>

      {/* Score Summary Row */}
      {swarm.consensus && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Overall', value: swarm.consensus.overallScore, color: '#6366f1' },
            { label: 'Scientific', value: swarm.consensus.scientificValidity, color: '#10b981' },
            { label: 'Safety', value: swarm.consensus.safetyCompliance, color: '#ef4444' },
            { label: 'Reproducibility', value: swarm.consensus.reproducibility, color: '#f59e0b' },
            { label: 'Agreement', value: swarm.consensus.agentAgreement, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {RESULT_TABS.map(tab => (
          <button key={tab.id} onClick={() => setResultTab(tab.id)} style={{
            padding: '9px 14px', border: 'none',
            borderBottom: resultTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', color: resultTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 12, fontWeight: resultTab === tab.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {resultTab === 'agents' && (
        <AgentResults
          outputs={swarm.agentOutputs}
          activeAgentId={swarm.activeAgentId}
          onSelectAgent={swarm.setActiveAgent}
        />
      )}
      {resultTab === 'consensus' && swarm.consensus && (
        <SwarmConsensusView consensus={swarm.consensus} />
      )}
      {resultTab === 'sop' && swarm.generatedSOP && (
        <SOPViewer sop={swarm.generatedSOP} />
      )}
      {resultTab === 'chat' && (
        <SwarmChat
          messages={swarm.chatMessages}
          onSend={swarm.sendChatMessage}
          isRunning={swarm.isRunning}
        />
      )}
    </div>
  )
}

// ── Agent Results Sub-component ──────────────────────────────────────────
function AgentResults({
  outputs,
  activeAgentId,
  onSelectAgent,
}: {
  outputs: AgentOutput[]
  activeAgentId: AgentId | null
  onSelectAgent: (id: AgentId | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Agent List */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {outputs.map(output => {
          const isActive = output.agentId === activeAgentId
          return (
            <button key={output.agentId} onClick={() => onSelectAgent(isActive ? null : output.agentId)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: isActive ? 'var(--accent-light)' : 'var(--surface)',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
              borderLeft: `3px solid ${output.color}`,
            }}>
              <span style={{ fontSize: 18 }}>{output.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {output.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {output.scores[0] ? `${output.scores[0].label}: ${output.scores[0].value}` : 'Complete'}
                </div>
              </div>
              {output.warnings.length > 0 && (
                <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠️</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail Panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeAgentId ? (
          <AgentPanel output={outputs.find(o => o.agentId === activeAgentId)!} />
        ) : (
          <div style={{
            padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👈</div>
            <div style={{ fontSize: 13 }}>Select an agent to view detailed analysis</div>
          </div>
        )}
      </div>
    </div>
  )
}
