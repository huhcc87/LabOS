import React, { useState } from 'react'
import type { ProtocolTraining } from '../types/protocol.types'

interface Props {
  protocolId: string
  protocolTitle: string
  trainingRecords: ProtocolTraining[]
  teamMembers: { id: string; name: string; role: string; avatar?: string }[]
  currentUser: { id: string; name: string; role: string; isAdmin: boolean }
  onStartTraining: (userId: string) => void
  onCompleteTraining: (userId: string, score: number) => void
  onCertify: (userId: string, expiresAt?: string) => void
  onRevokeCertification: (userId: string) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function isExpiringSoon(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return date > now && date.getTime() - now.getTime() < thirtyDays
}

export default function ProtocolTrainingTracker({
  protocolId, protocolTitle, trainingRecords, teamMembers, currentUser,
  onStartTraining, onCompleteTraining, onCertify, onRevokeCertification
}: Props) {
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showCertifyModal, setShowCertifyModal] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [certifyExpiry, setCertifyExpiry] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'certified' | 'in_progress' | 'not_started'>('all')

  const trainedUsers = trainingRecords.map(r => r.userId)
  const untrainedUsers = teamMembers.filter(m => !trainedUsers.includes(m.id))

  const certifiedCount = trainingRecords.filter(r => r.status === 'completed' && (!r.expiresAt || !isExpired(r.expiresAt))).length
  const inProgressCount = trainingRecords.filter(r => r.status === 'in_progress').length
  const expiredCount = trainingRecords.filter(r => r.expiresAt && isExpired(r.expiresAt)).length

  const filteredRecords = trainingRecords.filter(r => {
    if (activeTab === 'certified') return r.status === 'completed' && (!r.expiresAt || !isExpired(r.expiresAt))
    if (activeTab === 'in_progress') return r.status === 'in_progress'
    if (activeTab === 'not_started') return r.status === 'not_started'
    return true
  })

  const handleAssign = () => {
    selectedUsers.forEach(userId => onStartTraining(userId))
    setSelectedUsers([])
    setShowAssignModal(false)
  }

  const handleCertify = (userId: string) => {
    onCertify(userId, certifyExpiry || undefined)
    setShowCertifyModal(null)
    setCertifyExpiry('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
            {teamMembers.length}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Team Members
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>
            {certifiedCount}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Certified
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>
            {inProgressCount}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            In Training
          </div>
        </div>
        <div style={{
          background: expiredCount > 0 ? '#7f1d1d22' : 'var(--surface)',
          border: `1px solid ${expiredCount > 0 ? '#ef4444' : 'var(--border)'}`,
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: expiredCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
            {expiredCount}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Expired
          </div>
        </div>
      </div>

      {/* Tabs and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 4 }}>
          {(['all', 'certified', 'in_progress', 'not_started'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'var(--accent)' : 'transparent',
                border: 'none', borderRadius: 6, color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              {tab === 'all' ? 'All' : tab === 'certified' ? 'Certified' : tab === 'in_progress' ? 'In Progress' : 'Not Started'}
            </button>
          ))}
        </div>
        {currentUser.isAdmin && (
          <button
            onClick={() => setShowAssignModal(true)}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              color: '#fff', padding: '10px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            + Assign Training
          </button>
        )}
      </div>

      {/* Training Records List */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 14 }}>No training records found</div>
          </div>
        ) : (
          filteredRecords.map((record, index) => {
            const member = teamMembers.find(m => m.id === record.userId)
            const expired = record.expiresAt && isExpired(record.expiresAt)
            const expiringSoon = record.expiresAt && isExpiringSoon(record.expiresAt)

            return (
              <div
                key={record.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderBottom: index < filteredRecords.length - 1 ? '1px solid var(--border)' : 'none',
                  background: expired ? '#7f1d1d11' : expiringSoon ? '#78350f11' : 'transparent',
                }}
              >
                {/* Status Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: record.status === 'completed' && !expired ? '#065f46' : record.status === 'in_progress' ? '#1e3a8a' : expired ? '#7f1d1d' : 'var(--surface-hover)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {record.status === 'completed' && !expired ? '✓' : record.status === 'in_progress' ? '📖' : expired ? '⚠️' : '○'}
                </div>

                {/* User Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                    {record.userName}
                    {member && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{member.role}</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, display: 'flex', gap: 16 }}>
                    {record.completedAt && <span>Completed: {formatDate(record.completedAt)}</span>}
                    {record.expiresAt && <span>Expires: {formatDate(record.expiresAt)}</span>}
                    {record.score !== undefined && <span>Score: {record.score}%</span>}
                    {record.certifiedBy && <span>Certified by: {record.certifiedBy}</span>}
                  </div>
                </div>

                {/* Status Badge */}
                <span style={{
                  fontSize: 11, padding: '6px 12px', borderRadius: 6, fontWeight: 600,
                  background: expired ? '#7f1d1d' : expiringSoon ? '#78350f' : record.status === 'completed' ? '#065f46' : record.status === 'in_progress' ? '#1e3a8a' : 'var(--surface-hover)',
                  color: expired ? '#fca5a5' : expiringSoon ? '#fcd34d' : record.status === 'completed' ? '#6ee7b7' : record.status === 'in_progress' ? '#93c5fd' : 'var(--text-muted)',
                }}>
                  {expired ? 'EXPIRED' : expiringSoon ? 'EXPIRING SOON' : record.status.replace('_', ' ').toUpperCase()}
                </span>

                {/* Actions */}
                {currentUser.isAdmin && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {record.status === 'in_progress' && (
                      <button
                        onClick={() => onCompleteTraining(record.userId, 100)}
                        style={{
                          background: '#10b981', border: 'none', borderRadius: 6,
                          color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Mark Complete
                      </button>
                    )}
                    {record.status === 'completed' && !record.certifiedBy && (
                      <button
                        onClick={() => setShowCertifyModal(record.userId)}
                        style={{
                          background: '#8b5cf6', border: 'none', borderRadius: 6,
                          color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Certify
                      </button>
                    )}
                    {record.status === 'completed' && record.certifiedBy && (
                      <button
                        onClick={() => onRevokeCertification(record.userId)}
                        style={{
                          background: 'transparent', border: '1px solid #ef4444',
                          borderRadius: 6, color: '#ef4444', padding: '6px 12px',
                          cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Untrained Users Section */}
      {untrainedUsers.length > 0 && (
        <div style={{
          background: '#3b82f622', border: '1px solid #3b82f6',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            {untrainedUsers.length} team member{untrainedUsers.length !== 1 ? 's' : ''} not yet trained
          </div>
          <div style={{ color: '#93c5fd', fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {untrainedUsers.slice(0, 5).map(user => (
              <span key={user.id} style={{ background: '#1e3a8a', padding: '4px 10px', borderRadius: 4 }}>
                {user.name}
              </span>
            ))}
            {untrainedUsers.length > 5 && (
              <span style={{ color: '#60a5fa' }}>+{untrainedUsers.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Assign Training Modal */}
      {showAssignModal && (
        <>
          <div
            onClick={() => setShowAssignModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            width: 450, maxHeight: '70vh', overflow: 'auto', zIndex: 301,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Assign Training</h3>
            </div>
            <div style={{ padding: 16, maxHeight: 300, overflow: 'auto' }}>
              {untrainedUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                  All team members have been assigned training
                </div>
              ) : (
                untrainedUsers.map(user => (
                  <label
                    key={user.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                      background: selectedUsers.includes(user.id) ? 'var(--accent-light)' : 'var(--bg)',
                      border: `1px solid ${selectedUsers.includes(user.id) ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 8, cursor: 'pointer', marginBottom: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedUsers(prev => [...prev, user.id])
                        else setSelectedUsers(prev => prev.filter(id => id !== user.id))
                      }}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{user.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{user.role}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div style={{
              padding: '16px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={selectedUsers.length === 0}
                style={{
                  background: selectedUsers.length > 0 ? 'var(--accent)' : 'var(--surface)',
                  border: 'none', borderRadius: 6, color: '#fff',
                  padding: '10px 24px', cursor: selectedUsers.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 600, opacity: selectedUsers.length > 0 ? 1 : 0.5,
                }}
              >
                Assign Training
              </button>
            </div>
          </div>
        </>
      )}

      {/* Certify Modal */}
      {showCertifyModal && (
        <>
          <div
            onClick={() => setShowCertifyModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 24, width: 400, zIndex: 301,
          }}>
            <h3 style={{ margin: '0 0 16px', color: '#8b5cf6', fontSize: 18 }}>
              Certify User
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
              Issue certification for {trainingRecords.find(r => r.userId === showCertifyModal)?.userName}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Certification Expiry (Optional)
              </label>
              <input
                type="date"
                value={certifyExpiry}
                onChange={e => setCertifyExpiry(e.target.value)}
                style={{
                  width: '100%', padding: 10, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowCertifyModal(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleCertify(showCertifyModal)}
                style={{
                  background: '#8b5cf6', border: 'none', borderRadius: 6,
                  color: '#fff', padding: '10px 24px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Issue Certification
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
