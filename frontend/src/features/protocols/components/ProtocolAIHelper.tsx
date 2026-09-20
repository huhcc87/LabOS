import React, { useState } from 'react'
import type { Protocol } from '../types/protocol.types'

interface AIAction {
  id: string
  label: string
  icon: string
  description: string
  placeholder: string
}

const AI_ACTIONS: AIAction[] = [
  { id: 'generate', label: 'Generate Protocol', icon: '✨', description: 'Create a full SOP from a title and objective', placeholder: 'e.g. "RNA isolation from FFPE tissue for RNA-seq"' },
  { id: 'improve', label: 'Improve Protocol', icon: '⬆️', description: 'Refine existing protocol steps and add missing details', placeholder: 'Paste protocol text or describe what to improve...' },
  { id: 'convert', label: 'Convert Notes → SOP', icon: '📄', description: 'Convert rough bench notes into a formal SOP format', placeholder: 'Paste your rough notes here...' },
  { id: 'troubleshoot', label: 'Generate Troubleshooting', icon: '🔧', description: 'Generate a troubleshooting table for common issues', placeholder: 'Describe the protocol and common problems...' },
  { id: 'reagents', label: 'Reagent Table', icon: '🧪', description: 'Generate a complete reagent/materials table', placeholder: 'Protocol title or objective...' },
  { id: 'safety', label: 'Safety Checklist', icon: '⚠️', description: 'Generate PPE requirements and biosafety checklist', placeholder: 'Describe the hazardous materials and procedure...' },
  { id: 'summarize', label: 'Summarize', icon: '📝', description: 'Generate a concise abstract/summary', placeholder: 'Paste the full protocol text...' },
  { id: 'compare', label: 'Compare Versions', icon: '🔄', description: 'Highlight differences between two protocol versions', placeholder: 'Paste the two versions separated by "---"...' },
  { id: 'controls', label: 'Suggest Controls', icon: '✓', description: 'Recommend positive, negative, and internal controls', placeholder: 'Describe the assay type and detection method...' },
]

const MOCK_RESPONSES: Record<string, string> = {
  generate: '✨ AI Protocol generated successfully. The protocol has been pre-filled with:\n• Objective and scientific principle\n• Biosafety level and PPE requirements\n• Reagents and equipment lists\n• Step-by-step procedure with timing\n• QC checkpoints and expected results\n• Troubleshooting table\n\n⚙️ Connect OpenAI API key in Settings → Integrations to enable live generation.',
  improve: '⬆️ Protocol improvements identified:\n• Added 3 missing QC checkpoints at critical steps\n• Clarified centrifugation parameters (speed + temperature)\n• Added pause points for safe stopping positions\n• Updated reagent concentrations to current best practice\n\n⚙️ Connect OpenAI API key to apply real improvements.',
  convert: '📄 SOP conversion complete. Rough notes reformatted into:\n• Standard SOP header with ID, version, author fields\n• Numbered step-by-step procedure\n• Reagent and equipment tables\n• Safety notes section\n• QC acceptance criteria\n\n⚙️ Live conversion requires OpenAI API key.',
  troubleshoot: '🔧 Troubleshooting table generated with 8 common issues:\n• No amplification → Check primer design, Mg²⁺ concentration\n• Multiple bands → Optimize annealing temperature\n• Contamination → Check negative controls, clean workspace\n\n⚙️ Connect AI to generate protocol-specific troubleshooting.',
  reagents: '🧪 Reagent table generated with:\n• Catalog numbers from major suppliers (Sigma, Thermo, NEB)\n• Storage conditions and hazard classification\n• Working concentrations and preparation notes\n\n⚙️ Real-time catalog lookup requires API key.',
  safety: '⚠️ Safety checklist generated:\n• PPE: Gloves, lab coat, eye protection required\n• BSL-2 precautions for human-derived samples\n• Chemical hazards identified and waste disposal instructions\n\n⚙️ Connect AI to generate sample-specific safety documentation.',
  summarize: '📝 Abstract generated (250 words):\nThis protocol describes a validated procedure for... [AI summary will appear here]\n\n⚙️ Connect OpenAI API key for live summarization.',
  compare: '🔄 Version comparison:\n• 5 additions in v2.1 vs v2.0\n• 2 modifications to step parameters\n• 1 step removed (now redundant with updated kit)\n\n⚙️ Detailed diff analysis requires API integration.',
  controls: '✓ Recommended controls:\n• Positive control: Known-positive sample at 100 copies/µL\n• No-template control (NTC): Water blank\n• Internal reference: GAPDH/ACTB for normalization\n• Interplate calibrator: Same sample across all plates\n\n⚙️ Connect AI for assay-specific control design.',
}

interface Props {
  protocol?: Protocol
  onInsert?: (text: string) => void
}

export default function ProtocolAIHelper({ protocol, onInsert }: Props) {
  const [selectedAction, setSelectedAction] = useState<AIAction>(AI_ACTIONS[0])
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!input.trim() && selectedAction.id !== 'improve') return
    setLoading(true)
    setResult('')
    // Simulate API call delay
    await new Promise(r => setTimeout(r, 1200))
    setResult(MOCK_RESPONSES[selectedAction.id] || '⚙️ AI response will appear here once the OpenAI API key is configured in Settings → Integrations.')
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Action selector */}
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Select Action
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {AI_ACTIONS.map(action => (
            <button
              key={action.id}
              onClick={() => { setSelectedAction(action); setResult('') }}
              style={{
                padding: '10px 8px', borderRadius: 8, border: `1px solid ${selectedAction.id === action.id ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedAction.id === action.id ? 'var(--accent-light, rgba(37,99,235,0.12))' : 'var(--surface)',
                color: selectedAction.id === action.id ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer', textAlign: 'left', fontSize: 12,
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 2 }}>{action.icon}</div>
              <div style={{ fontWeight: 600 }}>{action.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
        <div style={{ color: 'var(--text)', fontSize: 13 }}>{selectedAction.description}</div>
      </div>

      {/* Input */}
      <div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={selectedAction.placeholder}
          rows={4}
          style={{
            width: '100%', padding: 12, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          padding: '11px 20px', background: loading ? 'var(--surface2)' : '#6d28d9',
          color: loading ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 8,
          cursor: loading ? 'default' : 'pointer', fontSize: 14, fontWeight: 600,
        }}
      >
        {loading ? '🤖 Generating...' : `🤖 Run: ${selectedAction.label}`}
      </button>

      {/* Result */}
      {result && (
        <div style={{ flex: 1 }}>
          <div style={{
            padding: 14, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-line', lineHeight: 1.6,
          }}>
            {result}
          </div>
          {onInsert && (
            <button
              onClick={() => onInsert(result)}
              style={{
                marginTop: 8, padding: '8px 14px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              Insert into Editor
            </button>
          )}
        </div>
      )}

      {/* API key notice */}
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span>ℹ️</span>
        <span>Live AI features require an OpenAI API key. Configure in <strong>Settings → Integrations → AI Settings</strong>. All protocol data stays within your lab instance.</span>
      </div>
    </div>
  )
}
