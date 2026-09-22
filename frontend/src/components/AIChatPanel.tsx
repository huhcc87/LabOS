import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { aiApi } from '../lib/api';

type ProposalStatus = 'pending' | 'running' | 'confirmed' | 'cancelled' | 'error';

type ProposedAction = {
  id: string;
  actionType: string;
  summary: string;
  destructive: boolean;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  error?: string;
};

type SearchHit = { id: string; type: string; title: string; subtitle: string; icon: string; page: string };

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  suggestions?: string[];
  source?: string;
  proposedActions?: ProposedAction[];
  searchResults?: SearchHit[];
};

const STARTER_QUESTIONS = [
  'What items are low on stock?',
  'How many samples do I have?',
  'Show me overdue tasks',
  'What can you help me with?',
];

function renderMarkdownInline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:11px">$1</code>')
    .replace(/\n/g, '<br/>');
}

export function AIChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: "Hi! I'm your LabOS AI Assistant. I have real-time access to your lab data — inventory, tasks, samples, reminders, and more.\n\nWhat can I help you with?",
      suggestions: STARTER_QUESTIONS,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await aiApi.chat(q);
      const proposedActions: ProposedAction[] = (res.data.proposedActions ?? []).map((p: any) => ({
        ...p,
        status: 'pending' as const,
      }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: res.data.answer,
        suggestions: res.data.suggestions,
        source: res.data.source,
        proposedActions,
        searchResults: res.data.searchResults ?? [],
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I couldn't reach the server. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function setProposalStatus(msgIndex: number, proposalId: string, status: ProposalStatus, error?: string) {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex || !m.proposedActions) return m;
      return {
        ...m,
        proposedActions: m.proposedActions.map(p => p.id === proposalId ? { ...p, status, error } : p),
      };
    }));
  }

  async function confirmProposal(msgIndex: number, proposal: ProposedAction) {
    setProposalStatus(msgIndex, proposal.id, 'running');
    try {
      await aiApi.confirmAction(proposal.actionType, proposal.payload);
      setProposalStatus(msgIndex, proposal.id, 'confirmed');
      toast.success('Done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setProposalStatus(msgIndex, proposal.id, 'error', message);
      toast.error(message);
    }
  }

  function cancelProposal(msgIndex: number, proposalId: string) {
    setProposalStatus(msgIndex, proposalId, 'cancelled');
  }

  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 28, zIndex: 1500,
      width: 380, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      maxHeight: 580,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, #1a2a4a 0%, #1e3a5f 100%)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>LabOS AI Assistant</div>
          <div style={{ fontSize: 11, color: '#8fa3b8' }}>Real-time lab data access</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8fa3b8', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
            <div style={{
              maxWidth: '88%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: 13, lineHeight: 1.6,
            }}>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdownInline(msg.text)) }} />
              {msg.source && (
                <div style={{ marginTop: 6, fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                  via {msg.source === 'openai' ? 'OpenAI GPT-4o' : 'local intelligence'}
                </div>
              )}
            </div>
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '88%' }}>
                {msg.suggestions.map(s => (
                  <button key={s} onClick={() => send(s)}
                    style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msg.proposedActions && msg.proposedActions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '92%' }}>
                {msg.proposedActions.map(p => (
                  <div key={p.id} style={{
                    border: `1px solid ${p.destructive ? '#dc2626' : 'var(--accent)'}`,
                    borderRadius: 10, padding: '10px 12px', background: 'var(--surface2)',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.4 }}>
                      {p.destructive ? '⚠️ ' : ''}{p.summary}
                    </div>
                    {(p.status === 'pending') && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => confirmProposal(i, p)}
                          style={{
                            fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                            background: p.destructive ? '#dc2626' : 'var(--accent)', border: 'none', color: '#fff',
                          }}>
                          Confirm
                        </button>
                        <button onClick={() => cancelProposal(i, p.id)}
                          style={{
                            fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
                          }}>
                          Cancel
                        </button>
                      </div>
                    )}
                    {p.status === 'running' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Working…</div>
                    )}
                    {p.status === 'confirmed' && (
                      <div style={{ fontSize: 11, color: '#16a34a', marginTop: 8 }}>✓ Done</div>
                    )}
                    {p.status === 'cancelled' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Cancelled</div>
                    )}
                    {p.status === 'error' && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 8 }}>Failed: {p.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {msg.searchResults && msg.searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '92%' }}>
                {msg.searchResults.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                    background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12,
                  }}>
                    <span>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.type} — {r.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--surface2)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', fontSize: 18 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>●</span>
              <span style={{ animation: 'pulse 1s 0.2s infinite', opacity: 0.7 }}>●</span>
              <span style={{ animation: 'pulse 1s 0.4s infinite', opacity: 0.4 }}>●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your lab..."
          style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          style={{
            width: 38, height: 38, borderRadius: 10, background: 'var(--accent)',
            border: 'none', color: '#fff', fontSize: 16, cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
            opacity: !input.trim() || loading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ↑
        </button>
      </div>
    </div>
  );
}
