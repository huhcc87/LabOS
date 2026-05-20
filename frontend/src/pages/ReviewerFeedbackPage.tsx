import { useState } from 'react';

interface ReviewerComment {
  id: number;
  reviewer: string;
  section: string;
  critique: string;
  severity: 'major' | 'minor' | 'strength';
  response: string;
  status: 'pending' | 'addressed' | 'rebutted';
}

interface GrantReview {
  id: number;
  grantTitle: string;
  grantId: string;
  submissionDate: string;
  reviewDate: string;
  overallScore: number;
  percentile: number | null;
  status: 'pending' | 'scored' | 'funded' | 'not_funded';
  criteriaScores: {
    significance: number;
    innovation: number;
    approach: number;
    investigators: number;
    environment: number;
  };
  summaryStatement: string;
  comments: ReviewerComment[];
}

// Empty initial state - user will import their own review feedback
const INITIAL_REVIEWS: GrantReview[] = [];

export default function ReviewerFeedbackPage() {
  const [reviews] = useState<GrantReview[]>(INITIAL_REVIEWS);
  const [selectedReview, setSelectedReview] = useState<GrantReview | null>(null);
  const [comments, setComments] = useState<ReviewerComment[]>([]);
  const [filter, setFilter] = useState<'all' | 'major' | 'minor' | 'strength'>('all');
  const [showResponseEditor, setShowResponseEditor] = useState<number | null>(null);

  const handleSelectReview = (review: GrantReview) => {
    setSelectedReview(review);
    setComments(review.comments);
  };

  const handleUpdateResponse = (commentId: number, response: string) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, response, status: response ? 'addressed' : 'pending' } : c
    ));
  };

  const handleMarkStatus = (commentId: number, status: ReviewerComment['status']) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, status } : c
    ));
  };

  const filteredComments = comments.filter(c =>
    filter === 'all' || c.severity === filter
  );

  const getScoreColor = (score: number) => {
    if (score <= 2) return '#22c55e';
    if (score <= 3) return '#f59e0b';
    return '#ef4444';
  };

  const progressStats = {
    total: comments.length,
    addressed: comments.filter(c => c.status === 'addressed').length,
    pending: comments.filter(c => c.status === 'pending').length,
    major: comments.filter(c => c.severity === 'major').length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reviewer Feedback & Resubmission</h1>
          <p className="page-subtitle">Track reviewer comments and prepare your response to reviewers</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import Summary Statement</button>
          <button className="btn btn-secondary">📤 Export Response</button>
          <button className="btn btn-primary">✨ AI Draft Responses</button>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Reviewer Feedback Yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Import your summary statement from NIH to track reviewer comments and prepare your response to reviewers for resubmission.
          </p>
          <button className="btn btn-primary">
            📥 Import Summary Statement
          </button>
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        {/* Left: Grant List */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
            Reviewed Grants
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(review => (
              <div
                key={review.id}
                onClick={() => handleSelectReview(review)}
                className="card"
                style={{
                  cursor: 'pointer',
                  border: selectedReview?.id === review.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    background: review.status === 'funded' ? 'rgba(34, 197, 94, 0.15)' :
                               review.status === 'scored' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                    color: review.status === 'funded' ? '#22c55e' :
                           review.status === 'scored' ? '#f59e0b' : '#9ca3af',
                  }}>
                    {review.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: getScoreColor(Math.floor(review.overallScore / 10)) }}>
                      {review.overallScore}
                    </div>
                    {review.percentile && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{review.percentile}%ile</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                  {review.grantTitle}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{review.grantId}</div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-soft)' }}>
                  {review.comments.filter(c => c.severity === 'major').length} major concerns
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Review Details */}
        {selectedReview && (
          <div>
            {/* Score Overview */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedReview.grantTitle}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {selectedReview.grantId} | Reviewed: {new Date(selectedReview.reviewDate).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--surface2)', borderRadius: 12 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: getScoreColor(Math.floor(selectedReview.overallScore / 10)) }}>
                    {selectedReview.overallScore}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overall Score</div>
                  {selectedReview.percentile && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginTop: 4 }}>
                      {selectedReview.percentile}th percentile
                    </div>
                  )}
                </div>
              </div>

              {/* Criteria Scores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {Object.entries(selectedReview.criteriaScores).map(([key, score]) => (
                  <div key={key} style={{ textAlign: 'center', padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: getScoreColor(score) }}>{score}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Statement */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📋 Summary Statement</h3>
              <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.7 }}>
                {selectedReview.summaryStatement}
              </p>
            </div>

            {/* Response Progress */}
            <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>📊 Response Progress</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{progressStats.total}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Comments</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{progressStats.addressed}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Addressed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{progressStats.pending}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{progressStats.major}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Major Concerns</div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4 }}>
                  <div style={{
                    height: '100%',
                    width: `${(progressStats.addressed / progressStats.total) * 100}%`,
                    background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            </div>

            {/* Comments Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Reviewer Comments</h3>
              <div className="view-toggle">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'major', label: 'Major' },
                  { key: 'minor', label: 'Minor' },
                  { key: 'strength', label: 'Strengths' },
                ].map(f => (
                  <button
                    key={f.key}
                    className={`view-toggle-btn ${filter === f.key ? 'active' : ''}`}
                    onClick={() => setFilter(f.key as any)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredComments.map(comment => (
                <div key={comment.id} className="card" style={{
                  borderLeft: `4px solid ${
                    comment.severity === 'major' ? '#ef4444' :
                    comment.severity === 'minor' ? '#f59e0b' : '#22c55e'
                  }`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: comment.severity === 'major' ? 'rgba(239, 68, 68, 0.15)' :
                                   comment.severity === 'minor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: comment.severity === 'major' ? '#ef4444' :
                               comment.severity === 'minor' ? '#f59e0b' : '#22c55e',
                        textTransform: 'uppercase',
                      }}>
                        {comment.severity}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{comment.reviewer}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {comment.section}</span>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      background: comment.status === 'addressed' ? 'rgba(34, 197, 94, 0.15)' :
                                 comment.status === 'rebutted' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                      color: comment.status === 'addressed' ? '#22c55e' :
                             comment.status === 'rebutted' ? '#60a5fa' : '#9ca3af',
                    }}>
                      {comment.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16, fontStyle: 'italic' }}>
                    "{comment.critique}"
                  </div>

                  {/* Response Section */}
                  {comment.response ? (
                    <div style={{ background: 'var(--surface2)', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>YOUR RESPONSE:</div>
                      <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, margin: 0 }}>
                        {comment.response}
                      </p>
                    </div>
                  ) : showResponseEditor === comment.id ? (
                    <div>
                      <textarea
                        className="form-textarea"
                        placeholder="Write your response to this comment..."
                        style={{ minHeight: 100, marginBottom: 12 }}
                        onChange={(e) => handleUpdateResponse(comment.id, e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => setShowResponseEditor(null)}>
                          💾 Save Response
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setShowResponseEditor(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-sm btn-secondary">
                          ✨ AI Suggest
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => setShowResponseEditor(comment.id)}>
                        ✍️ Write Response
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleMarkStatus(comment.id, 'addressed')}>
                        ✓ Mark Addressed
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleMarkStatus(comment.id, 'rebutted')}>
                        ↩️ Rebut
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
