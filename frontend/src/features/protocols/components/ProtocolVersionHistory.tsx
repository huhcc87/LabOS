import React, { useState } from 'react'
import type { Protocol, ProtocolVersion } from '../types/protocol.types'

interface Props {
  protocol: Protocol
  versions: ProtocolVersion[]
  onRestoreVersion: (version: ProtocolVersion) => void
  onForkProtocol: (version: ProtocolVersion, newTitle: string) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getChangesSummary(current: Protocol, previous: Protocol): string[] {
  const changes: string[] = []

  if (current.title !== previous.title) changes.push('Title changed')
  if (current.abstract !== previous.abstract) changes.push('Abstract updated')
  if (current.steps.length !== previous.steps.length) {
    changes.push(`Steps: ${previous.steps.length} → ${current.steps.length}`)
  }
  if (current.reagents.length !== previous.reagents.length) {
    changes.push(`Reagents: ${previous.reagents.length} → ${current.reagents.length}`)
  }
  if (current.equipment.length !== previous.equipment.length) {
    changes.push(`Equipment: ${previous.equipment.length} → ${current.equipment.length}`)
  }
  if (current.safetyNotes.length !== previous.safetyNotes.length) {
    changes.push('Safety notes updated')
  }
  if (JSON.stringify(current.qcChecklist) !== JSON.stringify(previous.qcChecklist)) {
    changes.push('QC checklist updated')
  }

  return changes
}

export default function ProtocolVersionHistory({ protocol, versions, onRestoreVersion, onForkProtocol }: Props) {
  const [selectedVersions, setSelectedVersions] = useState<[string | null, string | null]>([null, null])
  const [showDiff, setShowDiff] = useState(false)
  const [forkModal, setForkModal] = useState<ProtocolVersion | null>(null)
  const [forkTitle, setForkTitle] = useState('')
  const [confirmRestore, setConfirmRestore] = useState<ProtocolVersion | null>(null)

  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev[0] === versionId) return [prev[1], null]
      if (prev[1] === versionId) return [prev[0], null]
      if (!prev[0]) return [versionId, prev[1]]
      if (!prev[1]) return [prev[0], versionId]
      return [versionId, null]
    })
  }

  const selectedVersion1 = versions.find(v => v.id === selectedVersions[0])
  const selectedVersion2 = versions.find(v => v.id === selectedVersions[1])

  const handleFork = () => {
    if (forkModal && forkTitle.trim()) {
      onForkProtocol(forkModal, forkTitle.trim())
      setForkModal(null)
      setForkTitle('')
    }
  }

  const handleRestore = () => {
    if (confirmRestore) {
      onRestoreVersion(confirmRestore)
      setConfirmRestore(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Version History
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Current version: {protocol.version} • {versions.length} version{versions.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        {selectedVersions[0] && selectedVersions[1] && (
          <button
            onClick={() => setShowDiff(true)}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 6,
              color: '#fff', padding: '8px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Compare Selected Versions
          </button>
        )}
      </div>

      {/* Selection Instructions */}
      {(selectedVersions[0] || selectedVersions[1]) && !(selectedVersions[0] && selectedVersions[1]) && (
        <div style={{
          background: 'var(--accent-light)', border: '1px solid var(--accent)',
          borderRadius: 8, padding: '10px 14px', color: 'var(--accent)', fontSize: 13,
        }}>
          Select another version to compare
        </div>
      )}

      {/* Version Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Current Version */}
        <div style={{
          display: 'flex', gap: 16, padding: '16px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: '#10b981', border: '3px solid #065f46',
            }} />
            {versions.length > 0 && (
              <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 8 }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{
                background: '#10b981', color: '#fff', fontSize: 11,
                padding: '2px 8px', borderRadius: 4, fontWeight: 600,
              }}>
                CURRENT
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                Version {protocol.version}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
              Last updated: {formatDate(protocol.updatedAt)} by {protocol.owner}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--surface)', color: 'var(--text-soft)', fontSize: 11, padding: '4px 8px', borderRadius: 4 }}>
                {protocol.steps.length} steps
              </span>
              <span style={{ background: 'var(--surface)', color: 'var(--text-soft)', fontSize: 11, padding: '4px 8px', borderRadius: 4 }}>
                {protocol.reagents.length} reagents
              </span>
              <span style={{ background: 'var(--surface)', color: 'var(--text-soft)', fontSize: 11, padding: '4px 8px', borderRadius: 4 }}>
                {protocol.equipment.length} equipment
              </span>
            </div>
          </div>
        </div>

        {/* Previous Versions */}
        {versions.map((version, index) => {
          const isSelected = selectedVersions.includes(version.id)
          const prevVersion = versions[index + 1]
          const changes = prevVersion ? getChangesSummary(version.snapshot, prevVersion.snapshot) : []

          return (
            <div
              key={version.id}
              style={{
                display: 'flex', gap: 16, padding: '16px 0',
                borderBottom: index < versions.length - 1 ? '1px solid var(--border)' : 'none',
                background: isSelected ? 'var(--accent-light)' : 'transparent',
                marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16,
                borderRadius: isSelected ? 8 : 0,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
                <button
                  onClick={() => toggleVersionSelection(version.id)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                    background: isSelected ? 'var(--accent)' : 'var(--surface)',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isSelected ? '#fff' : 'transparent', fontSize: 10,
                  }}
                >
                  {isSelected && '✓'}
                </button>
                {index < versions.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 8 }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                    Version {version.version}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setForkModal(version)}
                      title="Create fork from this version"
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 4, color: 'var(--accent)', padding: '4px 8px',
                        cursor: 'pointer', fontSize: 11,
                      }}
                    >
                      Fork
                    </button>
                    <button
                      onClick={() => setConfirmRestore(version)}
                      title="Restore this version"
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 4, color: '#f59e0b', padding: '4px 8px',
                        cursor: 'pointer', fontSize: 11,
                      }}
                    >
                      Restore
                    </button>
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
                  {formatDate(version.changedAt)} by {version.changedBy}
                </div>
                {version.changes && (
                  <div style={{ color: 'var(--text-soft)', fontSize: 13, marginBottom: 8, fontStyle: 'italic' }}>
                    "{version.changes}"
                  </div>
                )}
                {changes.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {changes.map((change, i) => (
                      <span key={i} style={{
                        background: '#3b82f622', color: '#60a5fa', fontSize: 11,
                        padding: '2px 8px', borderRadius: 4,
                      }}>
                        {change}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {versions.length === 0 && (
          <div style={{
            textAlign: 'center', padding: 40, color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 14 }}>No previous versions recorded</div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-soft)' }}>
              Version history will be tracked when changes are saved
            </div>
          </div>
        )}
      </div>

      {/* Diff Modal */}
      {showDiff && selectedVersion1 && selectedVersion2 && (
        <>
          <div
            onClick={() => setShowDiff(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            width: 'min(900px, 90vw)', maxHeight: '80vh', overflow: 'auto', zIndex: 301,
          }}>
            <div style={{
              position: 'sticky', top: 0, background: 'var(--surface)',
              borderBottom: '1px solid var(--border)', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>
                Compare Versions
              </h3>
              <button
                onClick={() => setShowDiff(false)}
                style={{
                  background: 'var(--surface-hover)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '6px 10px',
                  cursor: 'pointer', fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Version Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 13 }}>
                    Version {selectedVersion1.version} (Older)
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {formatDate(selectedVersion1.changedAt)}
                  </div>
                </div>
                <div style={{ background: '#10b98122', border: '1px solid #10b981', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                    Version {selectedVersion2.version} (Newer)
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {formatDate(selectedVersion2.changedAt)}
                  </div>
                </div>
              </div>

              {/* Diff Sections */}
              <DiffSection
                title="Title"
                old={selectedVersion1.snapshot.title}
                new={selectedVersion2.snapshot.title}
              />
              <DiffSection
                title="Abstract"
                old={selectedVersion1.snapshot.abstract}
                new={selectedVersion2.snapshot.abstract}
              />
              <DiffSection
                title="Steps"
                old={selectedVersion1.snapshot.steps.map(s => `${s.stepNumber}. ${s.title}`).join('\n')}
                new={selectedVersion2.snapshot.steps.map(s => `${s.stepNumber}. ${s.title}`).join('\n')}
              />
              <DiffSection
                title="Reagents"
                old={selectedVersion1.snapshot.reagents.join('\n')}
                new={selectedVersion2.snapshot.reagents.join('\n')}
              />
              <DiffSection
                title="Equipment"
                old={selectedVersion1.snapshot.equipment.join('\n')}
                new={selectedVersion2.snapshot.equipment.join('\n')}
              />
              <DiffSection
                title="Safety Notes"
                old={selectedVersion1.snapshot.safetyNotes.join('\n')}
                new={selectedVersion2.snapshot.safetyNotes.join('\n')}
              />
            </div>
          </div>
        </>
      )}

      {/* Fork Modal */}
      {forkModal && (
        <>
          <div
            onClick={() => setForkModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 24, width: 400, zIndex: 301,
          }}>
            <h3 style={{ color: 'var(--text)', margin: '0 0 16px', fontSize: 18 }}>
              Fork Protocol
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
              Create a new protocol based on version {forkModal.version}.
              The new protocol will be independent and can be modified separately.
            </p>
            <input
              type="text"
              value={forkTitle}
              onChange={e => setForkTitle(e.target.value)}
              placeholder="New protocol title..."
              style={{
                width: '100%', padding: '10px 12px', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 14, outline: 'none',
                marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setForkModal(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '10px 16px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleFork}
                disabled={!forkTitle.trim()}
                style={{
                  background: forkTitle.trim() ? 'var(--accent)' : 'var(--surface)',
                  border: 'none', borderRadius: 6, color: '#fff',
                  padding: '10px 20px', cursor: forkTitle.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 600, opacity: forkTitle.trim() ? 1 : 0.5,
                }}
              >
                Create Fork
              </button>
            </div>
          </div>
        </>
      )}

      {/* Restore Confirmation */}
      {confirmRestore && (
        <>
          <div
            onClick={() => setConfirmRestore(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 24, width: 400, zIndex: 301,
          }}>
            <h3 style={{ color: '#f59e0b', margin: '0 0 12px', fontSize: 18 }}>
              Restore Version {confirmRestore.version}?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px', lineHeight: 1.6 }}>
              This will replace the current protocol content with version {confirmRestore.version}.
              The current version will be saved to history before restoration.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setConfirmRestore(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '10px 16px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                style={{
                  background: '#f59e0b', border: 'none', borderRadius: 6,
                  color: '#fff', padding: '10px 20px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Restore Version
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Diff Section Component
function DiffSection({ title, old, new: newVal }: { title: string; old: string; new: string }) {
  const hasChanges = old !== newVal

  if (!hasChanges) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>
        {title}
        <span style={{
          marginLeft: 8, background: '#3b82f6', color: '#fff',
          fontSize: 10, padding: '2px 6px', borderRadius: 4,
        }}>
          CHANGED
        </span>
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          background: '#ef444411', border: '1px solid #ef444433',
          borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-soft)',
          whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto',
        }}>
          {old || '(empty)'}
        </div>
        <div style={{
          background: '#10b98111', border: '1px solid #10b98133',
          borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-soft)',
          whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto',
        }}>
          {newVal || '(empty)'}
        </div>
      </div>
    </div>
  )
}
