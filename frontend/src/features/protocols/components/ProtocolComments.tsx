import React, { useState, useRef } from 'react'
import type { ProtocolComment } from '../types/protocol.types'

interface Props {
  protocolId: string
  comments: ProtocolComment[]
  currentUser: { id: string; name: string; avatar?: string }
  teamMembers: { id: string; name: string; avatar?: string }[]
  onAddComment: (content: string, mentions: string[], stepIndex?: number) => void
  onEditComment: (commentId: string, content: string) => void
  onDeleteComment: (commentId: string) => void
  onReplyToComment: (parentId: string, content: string, mentions: string[]) => void
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, avatar, size = 36 }: { name: string; avatar?: string; size?: number }) {
  return avatar ? (
    <img
      src={avatar}
      alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600,
    }}>
      {getInitials(name)}
    </div>
  )
}

export default function ProtocolComments({
  protocolId, comments, currentUser, teamMembers,
  onAddComment, onEditComment, onDeleteComment, onReplyToComment
}: Props) {
  const [newComment, setNewComment] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [selectedMentions, setSelectedMentions] = useState<string[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const filteredMembers = teamMembers.filter(m =>
    m.name.toLowerCase().includes(mentionQuery.toLowerCase()) &&
    !selectedMentions.includes(m.id)
  )

  const handleInputChange = (value: string, isReply = false) => {
    if (isReply) {
      setReplyContent(value)
    } else {
      setNewComment(value)
    }

    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1)
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt)
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
  }

  const insertMention = (member: { id: string; name: string }, isReply = false) => {
    const currentValue = isReply ? replyContent : newComment
    const lastAtIndex = currentValue.lastIndexOf('@')
    const newValue = currentValue.slice(0, lastAtIndex) + `@${member.name} `

    if (isReply) {
      setReplyContent(newValue)
    } else {
      setNewComment(newValue)
    }
    setSelectedMentions(prev => [...prev, member.id])
    setShowMentions(false)
  }

  const handleSubmit = () => {
    if (!newComment.trim()) return
    // Extract mentions from content
    const mentionRegex = /@(\w+\s\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const member = teamMembers.find(m => m.name === match[1])
      if (member) mentions.push(member.id)
    }
    onAddComment(newComment.trim(), mentions)
    setNewComment('')
    setSelectedMentions([])
  }

  const handleReply = (parentId: string) => {
    if (!replyContent.trim()) return
    const mentionRegex = /@(\w+\s\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(replyContent)) !== null) {
      const member = teamMembers.find(m => m.name === match[1])
      if (member) mentions.push(member.id)
    }
    onReplyToComment(parentId, replyContent.trim(), mentions)
    setReplyContent('')
    setReplyingTo(null)
  }

  const handleEdit = (commentId: string) => {
    onEditComment(commentId, editContent)
    setEditingComment(null)
    setEditContent('')
  }

  const renderComment = (comment: ProtocolComment, isReply = false) => {
    const isEditing = editingComment === comment.id
    const isReplying = replyingTo === comment.id
    const isCurrentUser = comment.userId === currentUser.id

    return (
      <div
        key={comment.id}
        style={{
          display: 'flex', gap: 12,
          marginLeft: isReply ? 48 : 0,
          marginTop: isReply ? 12 : 0,
        }}
      >
        <Avatar name={comment.userName} avatar={comment.userAvatar} size={isReply ? 28 : 36} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
              {comment.userName}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {formatTimeAgo(comment.createdAt)}
            </span>
            {comment.stepIndex !== undefined && (
              <span style={{
                background: 'var(--accent-light)', color: 'var(--accent)',
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
              }}>
                Step {comment.stepIndex + 1}
              </span>
            )}
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <span style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>
                (edited)
              </span>
            )}
          </div>

          {isEditing ? (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  width: '100%', padding: 10, background: 'var(--bg)',
                  border: '1px solid var(--accent)', borderRadius: 6,
                  color: 'var(--text)', fontSize: 14, resize: 'none',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
                rows={3}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => handleEdit(comment.id)}
                  style={{
                    background: 'var(--accent)', border: 'none', borderRadius: 4,
                    color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditingComment(null); setEditContent('') }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                    color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6, marginTop: 4,
              whiteSpace: 'pre-wrap',
            }}>
              {comment.content.split(/(@\w+\s\w+)/g).map((part, i) => {
                if (part.startsWith('@')) {
                  return (
                    <span key={i} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                      {part}
                    </span>
                  )
                }
                return part
              })}
            </div>
          )}

          {!isEditing && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {!isReply && (
                <button
                  onClick={() => { setReplyingTo(comment.id); setReplyContent(`@${comment.userName} `) }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 12, padding: 0,
                  }}
                >
                  Reply
                </button>
              )}
              {isCurrentUser && (
                <>
                  <button
                    onClick={() => { setEditingComment(comment.id); setEditContent(comment.content) }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 12, padding: 0,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    style={{
                      background: 'none', border: 'none', color: '#ef4444',
                      cursor: 'pointer', fontSize: 12, padding: 0,
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reply Input */}
          {isReplying && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <textarea
                value={replyContent}
                onChange={e => handleInputChange(e.target.value, true)}
                placeholder="Write a reply..."
                style={{
                  flex: 1, padding: 10, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', fontSize: 13, resize: 'none',
                  fontFamily: 'inherit', outline: 'none',
                }}
                rows={2}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={!replyContent.trim()}
                  style={{
                    background: replyContent.trim() ? 'var(--accent)' : 'var(--surface)',
                    border: 'none', borderRadius: 4, color: '#fff',
                    padding: '6px 12px', cursor: replyContent.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 600, opacity: replyContent.trim() ? 1 : 0.5,
                  }}
                >
                  Reply
                </button>
                <button
                  onClick={() => { setReplyingTo(null); setReplyContent('') }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                    color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0 }}>
          Discussion ({comments.length})
        </h3>
      </div>

      {/* New Comment Input */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Avatar name={currentUser.name} avatar={currentUser.avatar} />
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Add a comment... Use @ to mention team members"
              style={{
                width: '100%', padding: 12, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontSize: 14, resize: 'none',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                minHeight: 80,
              }}
              onFocus={() => {
                if (newComment.includes('@') && !newComment.endsWith(' ')) {
                  setShowMentions(true)
                }
              }}
            />

            {/* Mentions Dropdown */}
            {showMentions && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10,
              }}>
                {filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => insertMention(member)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: 'transparent', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Avatar name={member.name} avatar={member.avatar} size={28} />
                    <span style={{ color: 'var(--text)', fontSize: 14 }}>{member.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Tip: Use @ to mention team members
          </div>
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim()}
            style={{
              background: newComment.trim() ? 'var(--accent)' : 'var(--surface)',
              border: 'none', borderRadius: 6, color: '#fff',
              padding: '8px 20px', cursor: newComment.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, opacity: newComment.trim() ? 1 : 0.5,
            }}
          >
            Post Comment
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {comments.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 40, color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 14 }}>No comments yet</div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-soft)' }}>
              Start a discussion about this protocol
            </div>
          </div>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>
    </div>
  )
}
