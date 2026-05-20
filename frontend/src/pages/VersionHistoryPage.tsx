import { useState, useEffect, useCallback } from 'react';
import { grantVersionsApi } from '../lib/api';

interface Version {
  id: number;
  grantId: string;
  grantNumber: string;
  grantTitle: string;
  versionNumber: string;
  versionLabel: string;
  createdBy: string;
  createdAt: string;
  changes: Change[];
  notes: string;
  size: string;
  sections: SectionVersion[];
}

interface Change {
  section: string;
  type: 'added' | 'modified' | 'deleted';
  summary: string;
}

interface SectionVersion {
  name: string;
  wordCount: number;
  lastModified: string;
  changeType?: 'added' | 'modified' | 'unchanged';
}

const INP: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13,
};

function apiToVersion(v: any, index: number): Version {
  const changes: Change[] = (v.changes || []).map((c: any) => ({
    section: c.section || '',
    type: c.type || 'modified',
    summary: c.summary || '',
  }));
  const contentStr = JSON.stringify(v.content || {}, null, 2);
  const sections: SectionVersion[] = Object.keys(v.content || {}).map((k) => ({
    name: k,
    wordCount: String(v.content[k]).split(/\s+/).length,
    lastModified: v.created_at || '',
    changeType: 'unchanged' as const,
  }));
  return {
    id: v.id,
    grantId: v.grant_id,
    grantNumber: v.grant_id,
    grantTitle: v.grant_title || v.grant_id,
    versionNumber: String(index + 1),
    versionLabel: v.version_label || `Snapshot ${index + 1}`,
    createdBy: v.created_by || '',
    createdAt: v.created_at || '',
    changes,
    notes: v.notes || '',
    size: `${(contentStr.length / 1024).toFixed(1)} KB`,
    sections,
  };
}

const EMPTY_FORM = {
  grant_id: '',
  grant_title: '',
  version_label: '',
  notes: '',
  content: '{}',
  changes: '[]',
};

export default function VersionHistoryPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{ v1: Version | null; v2: Version | null }>({ v1: null, v2: null });
  const [showComparison, setShowComparison] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await grantVersionsApi.listAll();
      const raw: any[] = (res.data as any) || [];
      const mapped = raw.map((v, i) => apiToVersion(v, i));
      setVersions(mapped);
      if (mapped.length > 0 && !selectedGrant) {
        setSelectedGrant(mapped[0].grantNumber);
      }
    } catch (_) {}
  }, [selectedGrant]);

  useEffect(() => { load(); }, [load]);

  const grantVersions = versions.filter(v => v.grantNumber === selectedGrant);
  const grants = [...new Set(versions.map(v => v.grantNumber))];

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'added': return '#22c55e';
      case 'modified': return '#f59e0b';
      case 'deleted': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleVersionSelect = (version: Version) => {
    if (compareMode) {
      if (!compareVersions.v1) {
        setCompareVersions({ v1: version, v2: null });
      } else if (!compareVersions.v2 && version.id !== compareVersions.v1.id) {
        setCompareVersions({ ...compareVersions, v2: version });
      }
    } else {
      setSelectedVersion(version);
    }
  };

  const handleStartCompare = () => {
    if (compareVersions.v1 && compareVersions.v2) {
      setShowComparison(true);
    }
  };

  const resetCompare = () => {
    setCompareMode(false);
    setCompareVersions({ v1: null, v2: null });
    setShowComparison(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this version snapshot?')) return;
    await grantVersionsApi.delete(id);
    await load();
    if (selectedVersion?.id === id) setSelectedVersion(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      let changes: any[] = [];
      let content: Record<string, any> = {};
      try { changes = JSON.parse(form.changes); } catch (_) {}
      try { content = JSON.parse(form.content); } catch (_) {}
      await grantVersionsApi.create({
        grant_id: form.grant_id,
        grant_title: form.grant_title,
        version_label: form.version_label,
        notes: form.notes,
        content,
        changes,
      });
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const diffAdditions = compareVersions.v2
    ? (compareVersions.v2.changes.filter(c => c.type === 'added').length)
    : 0;
  const diffDeletions = compareVersions.v2
    ? (compareVersions.v2.changes.filter(c => c.type === 'deleted').length)
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Version History & Compare</h1>
          <p className="page-subtitle">Track changes across all versions of your grant applications</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {compareMode ? (
            <>
              <button className="btn btn-secondary" onClick={resetCompare}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleStartCompare}
                disabled={!compareVersions.v1 || !compareVersions.v2}
              >
                Compare Selected
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setCompareMode(true)}>Compare Versions</button>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Create Snapshot</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Versions</span>
          <div className="metric-value">{grantVersions.length}</div>
          <div className="metric-sub">For selected grant</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Latest Version</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{grantVersions[0]?.versionNumber || '-'}</div>
          <div className="metric-sub">{grantVersions[0]?.versionLabel || ''}</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Last Modified</span>
          <div className="metric-value" style={{ color: '#f59e0b', fontSize: 18 }}>
            {grantVersions[0] ? new Date(grantVersions[0].createdAt).toLocaleDateString() : '-'}
          </div>
          <div className="metric-sub">Most recent change</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Total Grants</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{grants.length}</div>
          <div className="metric-sub">With version history</div>
        </div>
      </div>

      {/* Compare Mode Instructions */}
      {compareMode && !showComparison && (
        <div className="card" style={{ background: 'var(--accent-light)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>📊</span>
            <div>
              <div style={{ fontWeight: 600 }}>Compare Mode Active</div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                Select two versions to compare.
                {compareVersions.v1 && !compareVersions.v2 && ` Selected: v${compareVersions.v1.versionNumber}. Now select another version.`}
                {compareVersions.v1 && compareVersions.v2 && ` Comparing v${compareVersions.v1.versionNumber} with v${compareVersions.v2.versionNumber}.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grant Selector */}
      {grants.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <select
            className="form-select"
            value={selectedGrant}
            onChange={(e) => { setSelectedGrant(e.target.value); setSelectedVersion(null); resetCompare(); }}
            style={{ width: 400 }}
          >
            {grants.map(grant => {
              const grantData = versions.find(v => v.grantNumber === grant);
              return (
                <option key={grant} value={grant}>
                  {grant}{grantData?.grantTitle && grantData.grantTitle !== grant ? ` - ${grantData.grantTitle}` : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Empty State */}
      {versions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No version snapshots yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Create your first snapshot to start tracking grant changes over time.
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Create First Snapshot</button>
        </div>
      )}

      {/* Comparison View */}
      {showComparison && compareVersions.v1 && compareVersions.v2 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>
              Comparing v{compareVersions.v1.versionNumber} → v{compareVersions.v2.versionNumber}
            </h3>
            <button onClick={resetCompare} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={{ padding: '8px 16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8 }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>+{diffAdditions}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>additions</span>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>-{diffDeletions}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>deletions</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{
                padding: '8px 12px', background: 'var(--surface2)',
                borderRadius: '8px 8px 0 0', fontWeight: 600, fontSize: 12,
              }}>
                v{compareVersions.v1.versionNumber} - {compareVersions.v1.versionLabel}
              </div>
              <div style={{
                padding: 16, background: 'var(--surface)', border: '1px solid var(--border)',
                borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 400, overflow: 'auto',
              }}>
                <pre style={{ fontFamily: 'inherit', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {compareVersions.v1.notes || JSON.stringify(
                    (versions.find(v => v.id === compareVersions.v1!.id) as any)?.content || {},
                    null, 2
                  )}
                </pre>
              </div>
            </div>
            <div>
              <div style={{
                padding: '8px 12px', background: 'var(--accent)',
                borderRadius: '8px 8px 0 0', fontWeight: 600, fontSize: 12, color: 'white',
              }}>
                v{compareVersions.v2.versionNumber} - {compareVersions.v2.versionLabel}
              </div>
              <div style={{
                padding: 16, background: 'var(--surface)', border: '1px solid var(--accent)',
                borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 400, overflow: 'auto',
              }}>
                <pre style={{ fontFamily: 'inherit', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {compareVersions.v2.notes || JSON.stringify(
                    (versions.find(v => v.id === compareVersions.v2!.id) as any)?.content || {},
                    null, 2
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!showComparison && versions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedVersion ? '1fr 400px' : '1fr', gap: 24 }}>
          {/* Version Timeline */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Version Timeline</div>
            <div style={{ position: 'relative', paddingLeft: 30 }}>
              <div style={{
                position: 'absolute', left: 10, top: 20, bottom: 20,
                width: 2, background: 'var(--border)',
              }} />

              {grantVersions.map((version, index) => {
                const isSelected = compareMode
                  ? version.id === compareVersions.v1?.id || version.id === compareVersions.v2?.id
                  : selectedVersion?.id === version.id;

                return (
                  <div
                    key={version.id}
                    onClick={() => handleVersionSelect(version)}
                    className="card"
                    style={{
                      position: 'relative', marginBottom: 16, marginLeft: 16,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      padding: 16,
                    }}
                  >
                    <div style={{
                      position: 'absolute', left: -30, top: 20,
                      width: 16, height: 16, borderRadius: '50%',
                      background: index === 0 ? 'var(--accent)' : 'var(--surface2)',
                      border: `2px solid ${index === 0 ? 'var(--accent)' : 'var(--border)'}`,
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>v{version.versionNumber}</span>
                          <span style={{
                            padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: index === 0 ? 'var(--accent-light)' : 'var(--surface2)',
                            color: index === 0 ? 'var(--accent)' : 'var(--text-muted)',
                          }}>
                            {version.versionLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {formatDate(version.createdAt)} • {version.createdBy}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{version.size}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(version.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '2px 4px' }}
                        >×</button>
                      </div>
                    </div>

                    {version.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12, fontStyle: 'italic' }}>
                        "{version.notes}"
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {version.changes.map((change, i) => (
                        <span key={i} style={{
                          padding: '3px 8px', borderRadius: 4, fontSize: 10,
                          background: `${getChangeTypeColor(change.type)}15`,
                          color: getChangeTypeColor(change.type),
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <span>{change.type === 'added' ? '+' : change.type === 'deleted' ? '-' : '~'}</span>
                          {change.section}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {grantVersions.length === 0 && selectedGrant && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>
                  No versions for this grant yet.
                </div>
              )}
            </div>
          </div>

          {/* Version Details */}
          {selectedVersion && !compareMode && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>v{selectedVersion.versionNumber}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{selectedVersion.versionLabel}</div>
                </div>
                <button onClick={() => setSelectedVersion(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Created By</div>
                  <div style={{ fontSize: 13 }}>{selectedVersion.createdBy}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Created At</div>
                  <div style={{ fontSize: 13 }}>{formatDate(selectedVersion.createdAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>File Size</div>
                  <div style={{ fontSize: 13 }}>{selectedVersion.size}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Sections</div>
                  <div style={{ fontSize: 13 }}>{selectedVersion.sections.length}</div>
                </div>
              </div>

              {selectedVersion.changes.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Changes in this Version</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedVersion.changes.map((change, i) => (
                      <div key={i} style={{
                        padding: 10, background: 'var(--surface2)', borderRadius: 6,
                        borderLeft: `3px solid ${getChangeTypeColor(change.type)}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                            background: `${getChangeTypeColor(change.type)}20`,
                            color: getChangeTypeColor(change.type), textTransform: 'uppercase',
                          }}>
                            {change.type}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{change.section}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{change.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedVersion.sections.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Section Details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedVersion.sections.map(section => (
                      <div key={section.name} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px',
                        background: section.changeType === 'modified' ? 'rgba(245, 158, 11, 0.1)' : 'var(--surface2)',
                        borderRadius: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12 }}>{section.name}</span>
                          {section.changeType === 'modified' && (
                            <span style={{ fontSize: 9, color: '#f59e0b' }}>MODIFIED</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{section.wordCount} words</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => handleDelete(selectedVersion.id)}
                >Delete</button>
                <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => setSelectedVersion(null)}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Create Version Snapshot</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Grant ID / Number *</label>
                <input style={INP} value={form.grant_id} onChange={e => setForm(f => ({ ...f, grant_id: e.target.value }))} placeholder="e.g. R01-CA234567" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Grant Title</label>
                <input style={INP} value={form.grant_title} onChange={e => setForm(f => ({ ...f, grant_title: e.target.value }))} placeholder="e.g. Novel CAR-T Approaches..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Version Label</label>
                <input style={INP} value={form.version_label} onChange={e => setForm(f => ({ ...f, version_label: e.target.value }))} placeholder="e.g. Final Submission, Rev A" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea style={{ ...INP, minHeight: 72, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What changed in this version..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Content (JSON)</label>
                <textarea style={{ ...INP, minHeight: 80, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder='{"specific_aims": "...", "background": "..."}' />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Changes (JSON array)</label>
                <textarea style={{ ...INP, minHeight: 64, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} value={form.changes} onChange={e => setForm(f => ({ ...f, changes: e.target.value }))} placeholder='[{"section":"Aims","type":"modified","summary":"Revised aim 2"}]' />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={saving || !form.grant_id.trim()}
              >
                {saving ? 'Saving...' : 'Create Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
