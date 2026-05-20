import React, { useState } from 'react'
import type { ApprovalRequest, ApprovalReviewer } from '../types/protocol.types'

interface Props {
  protocolId: string
  protocolTitle: string
  currentStatus: 'draft' | 'under_review' | 'approved' | 'archived'
  approvalRequest: ApprovalRequest | null
  availableReviewers: { id: string; name: string; role: string; avatar?: string }[]
  currentUser: { id: string; name: string; role: string }
  onSubmitForReview: (reviewerIds: string[], dueDate?: string, comments?: string) => void
  onApprove: (comments: string, signature?: string) => void
  onReject: (comments: string) => void
  onRequestRevision: (comments: string) => void
  onWithdraw: () => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function getStatusColor(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'approved': return { bg: '#065f46', text: '#6ee7b7', border: '#10b981' }
    case 'rejected': return { bg: '#7f1d1d', text: '#fca5a5', border: '#ef4444' }
    case 'revision_requested': return { bg: '#78350f', text: '#fcd34d', border: '#f59e0b' }
    case 'pending': return { bg: '#1e3a8a', text: '#93c5fd', border: '#3b82f6' }
    default: return { bg: 'var(--surface)', text: 'var(--text)', border: 'var(--border)' }
  }
}

export default function ProtocolApprovalWorkflow({
  protocolId, protocolTitle, currentStatus, approvalRequest,
  availableReviewers, currentUser,
  onSubmitForReview, onApprove, onReject, onRequestRevision, onWithdraw
}: Props) {
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState<'approve' | 'reject' | 'revision' | null>(null)
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [submitComments, setSubmitComments] = useState('')
  const [reviewComments, setReviewComments] = useState('')
  const [signature, setSignature] = useState('')

  const isReviewer = approvalRequest?.reviewers.some(r => r.userId === currentUser.id)
  const myReview = approvalRequest?.reviewers.find(r => r.userId === currentUser.id)
  const canReview = isReviewer && myReview?.status === 'pending'
  const isOwner = true // Would check against protocol owner
  const allApproved = approvalRequest?.reviewers.every(r => r.status === 'approved')
  const anyRejected = approvalRequest?.reviewers.some(r => r.status === 'rejected')

  const handleSubmitForReview = () => {
    if (selectedReviewers.length === 0) return
    onSubmitForReview(selectedReviewers, dueDate || undefined, submitComments || undefined)
    setShowSubmitModal(false)
    setSelectedReviewers([])
    setDueDate('')
    setSubmitComments('')
  }

  const handleReview = (action: 'approve' | 'reject' | 'revision') => {
    if (!reviewComments.trim() && action !== 'approve') return
    if (action === 'approve') onApprove(reviewComments, signature || undefined)
    else if (action === 'reject') onReject(reviewComments)
    else onRequestRevision(reviewComments)
    setShowReviewModal(null)
    setReviewComments('')
    setSignature('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current Status Banner */}
      <div style={{
        background: getStatusColor(currentStatus).bg,
        border: `1px solid ${getStatusColor(currentStatus).border}`,
        borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: getStatusColor(currentStatus).text, fontWeight: 600, fontSize: 14, textTransform: 'uppercase' }}>
            {currentStatus.replace('_', ' ')}
          </div>
          <div style={{ color: getStatusColor(currentStatus).text, fontSize: 13, marginTop: 4, opacity: 0.8 }}>
            {currentStatus === 'draft' && 'This protocol has not been submitted for review'}
            {currentStatus === 'under_review' && `Submitted for review on ${approvalRequest ? formatDate(approvalRequest.requestedAt) : 'N/A'}`}
            {currentStatus === 'approved' && 'This protocol has been approved for use'}
            {currentStatus === 'archived' && 'This protocol has been archived'}
          </div>
        </div>
        {currentStatus === 'draft' && isOwner && (
          <button
            onClick={() => setShowSubmitModal(true)}
            style={{
              background: '#10b981', border: 'none', borderRadius: 8,
              color: '#fff', padding: '10px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Submit for Review
          </button>
        )}
        {currentStatus === 'under_review' && isOwner && (
          <button
            onClick={onWithdraw}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8, color: '#fff', padding: '10px 20px',
              cursor: 'pointer', fontSize: 14,
            }}
          >
            Withdraw Request
          </button>
        )}
      </div>

      {/* Approval Request Details */}
      {approvalRequest && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
              Review Progress
            </div>
            {approvalRequest.dueDate && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Due: {formatDate(approvalRequest.dueDate)}
              </div>
            )}
          </div>

          {/* Reviewers */}
          <div style={{ padding: 16 }}>
            {approvalRequest.reviewers.map((reviewer, index) => {
              const colors = getStatusColor(reviewer.status)
              return (
                <div
                  key={reviewer.userId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 0',
                    borderBottom: index < approvalRequest.reviewers.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Status Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: colors.bg, border: `2px solid ${colors.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colors.text, fontSize: 14,
                  }}>
                    {reviewer.status === 'approved' ? '✓' : reviewer.status === 'rejected' ? '✕' : reviewer.status === 'revision_requested' ? '↻' : '⏳'}
                  </div>

                  {/* Reviewer Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>
                      {reviewer.userName}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                        {reviewer.role}
                      </span>
                    </div>
                    {reviewer.reviewedAt && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                        Reviewed on {formatDate(reviewer.reviewedAt)}
                      </div>
                    )}
                    {reviewer.comments && (
                      <div style={{
                        color: 'var(--text-soft)', fontSize: 13, marginTop: 8,
                        background: 'var(--bg)', padding: '8px 12px', borderRadius: 6,
                        fontStyle: 'italic',
                      }}>
                        "{reviewer.comments}"
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                    fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 600,
                    textTransform: 'uppercase',
                  }}>
                    {reviewer.status.replace('_', ' ')}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Review Actions */}
          {canReview && (
            <div style={{
              padding: 16, borderTop: '1px solid var(--border)',
              background: 'var(--bg)', display: 'flex', gap: 12, justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setShowReviewModal('revision')}
                style={{
                  background: 'transparent', border: '1px solid #f59e0b',
                  borderRadius: 8, color: '#f59e0b', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                Request Revision
              </button>
              <button
                onClick={() => setShowReviewModal('reject')}
                style={{
                  background: 'transparent', border: '1px solid #ef4444',
                  borderRadius: 8, color: '#ef4444', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                Reject
              </button>
              <button
                onClick={() => setShowReviewModal('approve')}
                style={{
                  background: '#10b981', border: 'none', borderRadius: 8,
                  color: '#fff', padding: '10px 24px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Approve
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit Comments */}
      {approvalRequest?.comments && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            Submission Notes
          </div>
          <div style={{ color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6 }}>
            {approvalRequest.comments}
          </div>
        </div>
      )}

      {/* Approval History Timeline */}
      {!approvalRequest && currentStatus === 'approved' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            Approval History
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Protocol was approved. Full history available in audit log.
          </div>
        </div>
      )}

      {/* Submit for Review Modal */}
      {showSubmitModal && (
        <>
          <div
            onClick={() => setShowSubmitModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            width: 500, maxHeight: '80vh', overflow: 'auto', zIndex: 301,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Submit for Review</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Select reviewers to approve this protocol
              </p>
            </div>
            <div style={{ padding: 20 }}>
              {/* Reviewer Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Select Reviewers *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {availableReviewers.map(reviewer => (
                    <label
                      key={reviewer.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                        background: selectedReviewers.includes(reviewer.id) ? 'var(--accent-light)' : 'var(--bg)',
                        border: `1px solid ${selectedReviewers.includes(reviewer.id) ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 8, cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedReviewers.includes(reviewer.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedReviewers(prev => [...prev, reviewer.id])
                          } else {
                            setSelectedReviewers(prev => prev.filter(id => id !== reviewer.id))
                          }
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>
                          {reviewer.name}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {reviewer.role}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Comments */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Notes for Reviewers (Optional)
                </label>
                <textarea
                  value={submitComments}
                  onChange={e => setSubmitComments(e.target.value)}
                  placeholder="Add any notes or context for the reviewers..."
                  rows={3}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14, resize: 'vertical',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{
              padding: '16px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForReview}
                disabled={selectedReviewers.length === 0}
                style={{
                  background: selectedReviewers.length > 0 ? '#10b981' : 'var(--surface)',
                  border: 'none', borderRadius: 6, color: '#fff',
                  padding: '10px 24px', cursor: selectedReviewers.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 600, opacity: selectedReviewers.length > 0 ? 1 : 0.5,
                }}
              >
                Submit for Review
              </button>
            </div>
          </div>
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <>
          <div
            onClick={() => setShowReviewModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 24, width: 450, zIndex: 301,
          }}>
            <h3 style={{
              margin: '0 0 16px',
              color: showReviewModal === 'approve' ? '#10b981' : showReviewModal === 'reject' ? '#ef4444' : '#f59e0b',
              fontSize: 18,
            }}>
              {showReviewModal === 'approve' ? 'Approve Protocol' : showReviewModal === 'reject' ? 'Reject Protocol' : 'Request Revision'}
            </h3>

            <textarea
              value={reviewComments}
              onChange={e => setReviewComments(e.target.value)}
              placeholder={showReviewModal === 'approve' ? 'Add optional comments...' : 'Provide feedback (required)...'}
              rows={4}
              style={{
                width: '100%', padding: 12, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                marginBottom: 16,
              }}
            />

            {showReviewModal === 'approve' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Electronic Signature (21 CFR Part 11)
                </label>
                <input
                  type="text"
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder="Type your full name to sign"
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'cursive',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowReviewModal(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview(showReviewModal)}
                disabled={showReviewModal !== 'approve' && !reviewComments.trim()}
                style={{
                  background: showReviewModal === 'approve' ? '#10b981' : showReviewModal === 'reject' ? '#ef4444' : '#f59e0b',
                  border: 'none', borderRadius: 6, color: '#fff',
                  padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                {showReviewModal === 'approve' ? 'Approve' : showReviewModal === 'reject' ? 'Reject' : 'Request Revision'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
