import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { filesApi } from '../lib/api';
import type { Attachment } from '../lib/types';
import { formatDateTime, downloadBlob } from '../lib/utils';

const ENTITY_TYPES = ['sample', 'incident', 'protocol', 'inventory', 'instrument', 'training'];

const ENTITY_META: Record<string, { icon: string; color: string }> = {
  sample: { icon: '🧪', color: '#6366f1' },
  incident: { icon: '⚠', color: '#ef4444' },
  protocol: { icon: '📋', color: '#22c55e' },
  inventory: { icon: '📦', color: '#f59e0b' },
  instrument: { icon: '🔬', color: '#8b5cf6' },
  training: { icon: '🎓', color: '#06b6d4' },
};

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (['zip', 'tar', 'gz'].includes(ext)) return '🗜';
  if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
  return '📎';
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function FilesPage() {
  const [entityType, setEntityType] = useState('sample');
  const [entityId, setEntityId] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadAttachments() {
    if (!entityId) { toast.error('Enter an entity ID'); return; }
    setLoading(true);
    try {
      const resp = await filesApi.list(entityType, Number(entityId));
      setAttachments(resp.data);
      setHasLoaded(true);
    } catch { toast.error('Failed to load attachments'); }
    finally { setLoading(false); }
  }

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!entityId) { toast.error('Enter entity ID first'); return; }
    setUploading(true);
    for (const file of accepted) {
      try {
        await filesApi.upload(entityType, Number(entityId), file);
        toast.success(`Uploaded: ${file.name}`);
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
    loadAttachments();
  }, [entityType, entityId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  async function handleDownload(a: Attachment) {
    try {
      const resp = await filesApi.download(a.id);
      downloadBlob(resp.data as Blob, a.filename);
    } catch { toast.error('Download failed'); }
  }

  async function handleDelete(a: Attachment) {
    try {
      await filesApi.delete(a.id);
      toast.success('Deleted');
      setAttachments(prev => prev.filter(x => x.id !== a.id));
    } catch { toast.error('Delete failed'); }
  }

  const em = ENTITY_META[entityType] || { icon: '📎', color: '#94a3b8' };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>File Attachments</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Upload and manage files for any entity in the system</p>
          </div>
          {attachments.length > 0 && (
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['grid', 'list'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400 }}>
                  {m === 'grid' ? '⊞ Grid' : '☰ List'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Entity type picker */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {ENTITY_TYPES.map(et => {
            const m = ENTITY_META[et];
            const active = entityType === et;
            return (
              <button key={et} onClick={() => { setEntityType(et); setAttachments([]); setHasLoaded(false); }} style={{
                background: active ? m.color + '22' : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderRadius: 8, color: active ? m.color : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400, textTransform: 'capitalize',
              }}>{m.icon} {et}</button>
            );
          })}
        </div>

        {/* Lookup bar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            {em.icon} Browse {entityType.charAt(0).toUpperCase() + entityType.slice(1)} Attachments
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Entity ID</div>
              <input type="number" value={entityId} onChange={(e) => setEntityId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAttachments()}
                placeholder={`Enter ${entityType} ID`}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={loadAttachments} disabled={loading} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {loading ? 'Loading…' : 'Load Files'}
            </button>
          </div>
        </div>

        {/* Drop zone */}
        <div {...getRootProps()} style={{
          border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 20,
          background: isDragActive ? 'var(--accent)11' : 'var(--surface)', transition: 'all 0.15s',
        }}>
          <input {...getInputProps()} />
          <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? '⏳' : isDragActive ? '📥' : '📤'}</div>
          <div style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-soft)', fontWeight: 600, fontSize: 14 }}>
            {uploading ? 'Uploading files…' : isDragActive ? 'Drop files here!' : 'Drag & drop files here, or click to browse'}
          </div>
          {!uploading && !isDragActive && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Supports any file type · Files attached to {entityType} {entityId || '(set ID above)'}
            </div>
          )}
        </div>

        {/* Results */}
        {loading && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Loading attachments…</div>}

        {!loading && hasLoaded && attachments.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            No attachments found for {entityType} #{entityId}
          </div>
        )}

        {attachments.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>{attachments.length} file{attachments.length > 1 ? 's' : ''}</span>
            </div>

            {viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {attachments.map(a => (
                  <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 36, textAlign: 'center', padding: '8px 0' }}>{getFileIcon(a.filename)}</div>
                    <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600, wordBreak: 'break-word', textAlign: 'center' }}>{a.filename}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>{a.uploader_name || 'Unknown'}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleDownload(a)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 0', cursor: 'pointer', fontSize: 12 }}>⬇ Download</button>
                      <button onClick={() => handleDelete(a)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {attachments.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < attachments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 24 }}>{getFileIcon(a.filename)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{a.uploader_name || 'Unknown'} · {formatDateTime(a.uploaded_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => handleDownload(a)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>⬇ Download</button>
                      <button onClick={() => handleDelete(a)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
