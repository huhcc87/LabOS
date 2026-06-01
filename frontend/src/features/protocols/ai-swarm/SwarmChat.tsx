// ═══════════════════════════════════════════════════════════════════════════
// SWARM CHAT — Multi-agent protocol Q&A interface
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import type { SwarmChatMessage } from './swarmTypes'
import { AGENT_DEFINITIONS } from './swarmTypes'

interface Props {
  messages: SwarmChatMessage[]
  onSend: (content: string) => Promise<void>
  isRunning: boolean
}

const SUGGESTIONS = [
  'What are the critical steps I should pay most attention to?',
  'What safety precautions are most important for this protocol?',
  'How can I optimize this protocol for better reproducibility?',
  'What are common failure points and how to prevent them?',
  'What alternative reagents can I use if supplies are limited?',
  'What equipment calibration is required before starting?',
  'How should I train new lab members on this protocol?',
  'What QC checkpoints should I add?',
]

export default function SwarmChat({ messages, onSend, isRunning }: Props) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || isSending) return
    setInput('')
    setIsSending(true)
    try {
      await onSend(content)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 520, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>💬 Protocol Intelligence Chat</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Ask questions about your protocol — the swarm agents will respond with specialized expertise
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Ask anything about your protocol. The AI swarm will route your question to the most relevant agent(s).
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {SUGGESTIONS.slice(0, 4).map(s => (
                <button key={s} onClick={() => { setInput(s) }} style={{
                  padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 16, cursor: 'pointer', fontSize: 11, color: 'var(--text)',
                  maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {isSending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agents are thinking...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your protocol..."
            rows={1}
            style={{
              flex: 1, padding: '10px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text)', fontSize: 13, resize: 'none', outline: 'none',
              minHeight: 40, maxHeight: 100,
            }}
          />
          <button onClick={handleSend} disabled={!input.trim() || isSending} style={{
            padding: '10px 18px', background: input.trim() ? 'var(--accent)' : 'var(--surface)',
            border: `1px solid ${input.trim() ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8, color: input.trim() ? '#fff' : 'var(--text-muted)',
            cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
          }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Chat Bubble ─────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: SwarmChatMessage }) {
  const isUser = message.role === 'user'
  const agent = message.agentId ? AGENT_DEFINITIONS.find(a => a.id === message.agentId) : null

  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: isUser ? 'var(--accent)' : (agent?.color || '#6366f1') + '20',
        border: `1px solid ${isUser ? 'var(--accent)' : (agent?.color || 'var(--border)')}`,
        fontSize: 14,
      }}>
        {isUser ? '👤' : (agent?.icon || '🧬')}
      </div>

      {/* Message */}
      <div style={{
        maxWidth: '75%', padding: '10px 14px',
        background: isUser ? 'var(--accent)' : 'var(--surface2)',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {!isUser && agent && (
          <div style={{ fontSize: 10, fontWeight: 600, color: agent.color, marginBottom: 4 }}>
            {agent.name}
          </div>
        )}
        <div style={{
          fontSize: 13, color: isUser ? '#fff' : 'var(--text)', lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {message.content}
        </div>
        <div style={{ fontSize: 10, color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginTop: 4 }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
