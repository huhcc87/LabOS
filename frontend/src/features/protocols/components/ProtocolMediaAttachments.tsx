import React, { useState, useRef } from 'react'

interface MediaAttachment {
  id: string
  type: 'image' | 'video' | 'document'
  url: string
  thumbnailUrl?: string
  name: string
  size: number
  uploadedBy: string
  uploadedAt: string
  stepIndex?: number
  annotations?: { x: number; y: number; text: string }[]
}

interface Props {
  protocolId: string
  attachments: MediaAttachment[]
  onUpload: (file: File, stepIndex?: number) => void
  onDelete: (attachmentId: string) => void
  onAddAnnotation: (attachmentId: string, annotation: { x: number; y: number; text: string }) => void
  editable?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProtocolMediaAttachments({
  protocolId, attachments, onUpload, onDelete, onAddAnnotation, editable = true
}: Props) {
  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment | null>(null)
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [newAnnotation, setNewAnnotation] = useState<{ x: number; y: number } | null>(null)
  const [annotationText, setAnnotationText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type === 'application/pdf') {
        onUpload(file)
      }
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => onUpload(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isAnnotating || !selectedMedia) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setNewAnnotation({ x, y })
  }

  const handleSaveAnnotation = () => {
    if (!selectedMedia || !newAnnotation || !annotationText.trim()) return
    onAddAnnotation(selectedMedia.id, { ...newAnnotation, text: annotationText.trim() })
    setNewAnnotation(null)
    setAnnotationText('')
  }

  const imageAttachments = attachments.filter(a => a.type === 'image')
  const videoAttachments = attachments.filter(a => a.type === 'video')
  const documentAttachments = attachments.filter(a => a.type === 'document')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Upload Area */}
      {editable && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer',
            background: dragOver ? 'var(--accent-light)' : 'var(--surface)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📎</div>
          <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>
            Drop files here or click to upload
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Supports images, videos, and PDFs up to 50MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Images Section */}
      {imageAttachments.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
            Images ({imageAttachments.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {imageAttachments.map(img => (
              <div
                key={img.id}
                onClick={() => setSelectedMedia(img)}
                style={{
                  position: 'relative', paddingTop: '75%', borderRadius: 8,
                  overflow: 'hidden', cursor: 'pointer', background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <img
                  src={img.thumbnailUrl || img.url}
                  alt={img.name}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {img.stepIndex !== undefined && (
                  <span style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  }}>
                    Step {img.stepIndex + 1}
                  </span>
                )}
                {img.annotations && img.annotations.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 8, right: 8,
                    background: '#f59e0b', color: '#fff',
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  }}>
                    {img.annotations.length} annotations
                  </span>
                )}
                {editable && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(img.id) }}
                    style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: '#ef4444', border: 'none', borderRadius: 4,
                      color: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {videoAttachments.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
            Videos ({videoAttachments.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {videoAttachments.map(vid => (
              <div
                key={vid.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, overflow: 'hidden',
                }}
              >
                <video
                  src={vid.url}
                  controls
                  style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
                />
                <div style={{ padding: 10 }}>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    {vid.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{formatFileSize(vid.size)}</span>
                    {editable && (
                      <button
                        onClick={() => onDelete(vid.id)}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', fontSize: 11, padding: 0,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Section */}
      {documentAttachments.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
            Documents ({documentAttachments.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documentAttachments.map(doc => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 24 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>
                    {doc.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    {formatFileSize(doc.size)} • Uploaded by {doc.uploadedBy}
                  </div>
                </div>
                {editable && (
                  <button
                    onClick={e => { e.preventDefault(); onDelete(doc.id) }}
                    style={{
                      background: 'var(--surface-hover)', border: '1px solid var(--border)',
                      borderRadius: 4, color: '#ef4444', padding: '6px 10px',
                      cursor: 'pointer', fontSize: 11,
                    }}
                  >
                    Delete
                  </button>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {attachments.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 14 }}>No attachments yet</div>
          <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-soft)' }}>
            Add images, videos, or documents to this protocol
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedMedia && selectedMedia.type === 'image' && (
        <>
          <div
            onClick={() => { setSelectedMedia(null); setIsAnnotating(false); setNewAnnotation(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            maxWidth: '90vw', maxHeight: '90vh', zIndex: 301,
          }}>
            <div style={{ position: 'relative' }}>
              <img
                src={selectedMedia.url}
                alt={selectedMedia.name}
                onClick={handleImageClick}
                style={{
                  maxWidth: '100%', maxHeight: '80vh', borderRadius: 8,
                  cursor: isAnnotating ? 'crosshair' : 'default',
                }}
              />

              {/* Existing Annotations */}
              {selectedMedia.annotations?.map((ann, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#f59e0b', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: 8, minWidth: 150, fontSize: 12,
                    color: 'var(--text)', whiteSpace: 'nowrap',
                  }}>
                    {ann.text}
                  </div>
                </div>
              ))}

              {/* New Annotation Input */}
              {newAnnotation && (
                <div style={{
                  position: 'absolute', left: `${newAnnotation.x}%`, top: `${newAnnotation.y}%`,
                  transform: 'translate(-50%, -100%)', marginTop: -10,
                }}>
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--accent)',
                    borderRadius: 8, padding: 12, width: 200,
                  }}>
                    <textarea
                      value={annotationText}
                      onChange={e => setAnnotationText(e.target.value)}
                      placeholder="Add annotation..."
                      autoFocus
                      style={{
                        width: '100%', padding: 8, background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 12, resize: 'none',
                        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                      }}
                      rows={2}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={handleSaveAnnotation}
                        style={{
                          flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 4,
                          color: '#fff', padding: '6px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setNewAnnotation(null); setAnnotationText('') }}
                        style={{
                          flex: 1, background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text-muted)', padding: '6px',
                          cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16,
            }}>
              {editable && (
                <button
                  onClick={() => setIsAnnotating(!isAnnotating)}
                  style={{
                    background: isAnnotating ? '#f59e0b' : 'var(--surface)',
                    border: `1px solid ${isAnnotating ? '#f59e0b' : 'var(--border)'}`,
                    borderRadius: 6, color: isAnnotating ? '#fff' : 'var(--text)',
                    padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {isAnnotating ? 'Click image to annotate' : 'Add Annotation'}
                </button>
              )}
              <button
                onClick={() => { setSelectedMedia(null); setIsAnnotating(false) }}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', padding: '8px 16px',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
