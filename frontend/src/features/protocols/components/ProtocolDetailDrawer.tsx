import React, { useEffect, useState } from 'react'
import type { Protocol, ProtocolStep, ExecutionSession } from '../types/protocol.types'
import { ApprovalBadge, SourceBadge, ProtocolTypeBadge } from './ProtocolBadges'
import ProtocolDetailTabs from './ProtocolDetailTabs'
import ProtocolExecutionMode from './ProtocolExecutionMode'
import { getCategoryColor } from '../utils/protocolStatus'

interface Props {
  protocol: Protocol | null
  onClose: () => void
  onUpdateProtocol?: (protocol: Protocol) => void
  onSaveExecution?: (session: ExecutionSession) => void
}

function generatePrintHTML(p: Protocol): string {
  const stepsHtml = p.steps.map((s, i) => `
    <div class="step">
      <div class="step-header">
        <span class="step-number">${s.stepNumber}</span>
        <strong>${s.title}</strong>
        ${s.qcPoint ? '<span class="qc-badge">QC</span>' : ''}
      </div>
      <div class="step-content">
        <p>${s.instruction}</p>
        ${s.duration || s.temperature || s.rpm ? `
          <div class="step-params">
            ${s.duration ? `<span>Time: ${s.duration}</span>` : ''}
            ${s.temperature ? `<span>Temp: ${s.temperature}</span>` : ''}
            ${s.rpm ? `<span>RPM: ${s.rpm}</span>` : ''}
          </div>
        ` : ''}
        ${s.caution ? `<div class="caution">Caution: ${s.caution}</div>` : ''}
        ${s.notes ? `<div class="notes">Note: ${s.notes}</div>` : ''}
      </div>
      <div class="step-signoff">
        <span>Initials: _______</span>
        <span>Date: _______</span>
        <span>Time: _______</span>
      </div>
    </div>
  `).join('')

  const reagentsHtml = p.reagents.map(r => `<li>${r}</li>`).join('')
  const equipmentHtml = p.equipment.map(e => `<li>${e}</li>`).join('')
  const safetyHtml = p.safetyNotes.map(n => `<li>${n}</li>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>${p.title} - Protocol</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    .header { border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 8px; font-size: 22px; }
    .header .meta { color: #666; font-size: 12px; display: flex; gap: 16px; flex-wrap: wrap; }
    .category { color: #6366f1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .abstract { background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 20px; line-height: 1.6; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin: 0 0 12px; }
    .columns { display: flex; gap: 32px; }
    .columns > div { flex: 1; }
    .columns ul { margin: 0; padding-left: 20px; }
    .columns li { margin-bottom: 6px; font-size: 13px; }
    .safety { background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 4px; }
    .safety h3 { color: #dc2626; margin: 0 0 8px; font-size: 14px; }
    .safety ul { margin: 0; padding-left: 20px; color: #991b1b; }
    .steps { }
    .step { border: 1px solid #ddd; padding: 12px; margin-bottom: 12px; border-radius: 4px; break-inside: avoid; }
    .step-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .step-number { width: 28px; height: 28px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; }
    .step-content { margin-bottom: 12px; }
    .step-content p { margin: 0 0 8px; line-height: 1.6; font-size: 13px; }
    .step-params { display: flex; gap: 16px; font-size: 12px; color: #666; }
    .step-params span { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
    .caution { background: #fef3c7; border: 1px solid #fcd34d; padding: 8px; border-radius: 4px; font-size: 12px; color: #92400e; margin-top: 8px; }
    .notes { font-size: 12px; color: #666; font-style: italic; margin-top: 8px; }
    .step-signoff { display: flex; gap: 24px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 8px; }
    .qc-badge { background: #d1fae5; color: #065f46; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #333; font-size: 11px; color: #666; }
    @media print {
      body { padding: 0; }
      .step { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="category">${p.category.replace(/-/g, ' ')} > ${p.subcategory.replace(/-/g, ' ')}</div>
    <h1>${p.title}</h1>
    <div class="meta">
      <span><strong>Version:</strong> ${p.version || '1.0'}</span>
      <span><strong>Organism:</strong> ${p.organism || 'N/A'}</span>
      <span><strong>Est. Time:</strong> ${p.estimatedTime || 'N/A'}</span>
      <span><strong>Owner:</strong> ${p.owner || 'N/A'}</span>
    </div>
  </div>

  <div class="abstract">${p.abstract}</div>

  ${p.safetyNotes.length > 0 ? `
  <div class="safety">
    <h3>Safety Notes</h3>
    <ul>${safetyHtml}</ul>
  </div>
  ` : ''}

  <div class="section">
    <h2>Materials</h2>
    <div class="columns">
      <div>
        <h4>Reagents</h4>
        <ul>${reagentsHtml}</ul>
      </div>
      <div>
        <h4>Equipment</h4>
        <ul>${equipmentHtml}</ul>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Procedure</h2>
    <div class="steps">
      ${stepsHtml}
    </div>
  </div>

  <div class="footer">
    <p>Printed from LabOS v3 | ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`
}

function handlePrint(p: Protocol) {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(generatePrintHTML(p))
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 250)
  }
}

export default function ProtocolDetailDrawer({ protocol: p, onClose, onUpdateProtocol, onSaveExecution }: Props) {
  const [showExecutionMode, setShowExecutionMode] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showExecutionMode) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, showExecutionMode])

  const handleUpdateSteps = (steps: ProtocolStep[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, steps })
    }
  }

  const handleExecutionComplete = (session: ExecutionSession) => {
    setShowExecutionMode(false)
    if (onSaveExecution) {
      onSaveExecution(session)
    }
    // Show toast or notification
  }

  const handleUpdateReagents = (reagents: string[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, reagents })
    }
  }

  const handleUpdateEquipment = (equipment: string[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, equipment })
    }
  }

  const handleUpdateQcChecklist = (qcChecklist: string[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, qcChecklist })
    }
  }

  const handleUpdateTroubleshooting = (troubleshooting: { problem: string; solution: string }[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, troubleshooting })
    }
  }

  const handleUpdateSafetyNotes = (safetyNotes: string[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, safetyNotes })
    }
  }

  const handleUpdatePrerequisites = (prerequisites: string[]) => {
    if (p && onUpdateProtocol) {
      onUpdateProtocol({ ...p, prerequisites })
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: '#00000088', zIndex: 100,
        opacity: p ? 1 : 0, pointerEvents: p ? 'auto' : 'none', transition: 'opacity 0.3s',
      }} />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(700px, 95vw)',
        background: '#0f1117', borderLeft: '1px solid #2a2d3e', zIndex: 101, overflowY: 'auto',
        transform: p ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-8px 0 32px #00000066',
      }}>
        {p && (
          <>
            {/* Header */}
            <div style={{ position: 'sticky', top: 0, background: '#0f1117', borderBottom: '1px solid #2a2d3e', padding: '16px 20px', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: getCategoryColor(p.category), fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    {p.category.replace(/-/g, ' ')} › {p.subcategory.replace(/-/g, ' ')}
                  </div>
                  <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>{p.title}</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <ApprovalBadge status={p.approvalStatus} />
                    <SourceBadge sourceType={p.sourceType} />
                    <ProtocolTypeBadge type={p.protocolType} />
                    {p.journal && <span style={{ background: '#242838', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{p.journal} {p.publicationYear}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setShowExecutionMode(true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none', borderRadius: 6, color: '#fff',
                    padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  ▶ Run Protocol
                </button>
                <button onClick={() => handlePrint(p)} style={{ background: '#1e3a8a', border: '1px solid #3b82f6', borderRadius: 6, color: '#e2e8f0', padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>🖨️ Print</button>
                <button onClick={onClose} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 6, color: '#94a3b8', padding: '6px 10px', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: 20 }}>
              <ProtocolDetailTabs
                protocol={p}
                onUpdateSteps={onUpdateProtocol ? handleUpdateSteps : undefined}
                onUpdateReagents={onUpdateProtocol ? handleUpdateReagents : undefined}
                onUpdateEquipment={onUpdateProtocol ? handleUpdateEquipment : undefined}
                onUpdateQcChecklist={onUpdateProtocol ? handleUpdateQcChecklist : undefined}
                onUpdateTroubleshooting={onUpdateProtocol ? handleUpdateTroubleshooting : undefined}
                onUpdateSafetyNotes={onUpdateProtocol ? handleUpdateSafetyNotes : undefined}
                onUpdatePrerequisites={onUpdateProtocol ? handleUpdatePrerequisites : undefined}
                editable={!!onUpdateProtocol}
              />
            </div>
          </>
        )}
      </div>

      {/* Execution Mode */}
      {p && showExecutionMode && (
        <ProtocolExecutionMode
          protocol={p}
          onClose={() => setShowExecutionMode(false)}
          onComplete={handleExecutionComplete}
        />
      )}
    </>
  )
}
