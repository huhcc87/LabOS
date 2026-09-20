import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination } from '../components/Table';
import { templatesApi } from '../lib/api';

interface Template {
  id: number;
  name: string;
  category: 'protocol' | 'report' | 'form' | 'checklist';
  description: string;
  content: string;
  variables: string[];
  created_by_id: number | null;
  created_by_name: string | null;
  created_at: string;
  usage_count: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  protocol: { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', icon: '📋' },
  report: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', icon: '📄' },
  form: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', icon: '📝' },
  checklist: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', icon: '✅' },
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [useTemplate, setUseTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm<any>();

  const watchContent = watch('content', '');

  async function fetchTemplates() {
    setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (categoryFilter) extra.category = categoryFilter;
      const res = await templatesApi.list(page, perPage, search, extra);
      setTemplates(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, [page, perPage, search, categoryFilter]);

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  const stats = useMemo(() => ({
    total: total,
    protocols: templates.filter(t => t.category === 'protocol').length,
    reports: templates.filter(t => t.category === 'report').length,
    forms: templates.filter(t => t.category === 'form').length,
    checklists: templates.filter(t => t.category === 'checklist').length,
  }), [templates, total]);

  function openCreate() {
    setEditing(null);
    reset({ name: '', category: 'protocol', description: '', content: '' });
    setModalOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    reset({
      name: t.name,
      category: t.category,
      description: t.description,
      content: t.content,
    });
    setModalOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const variables = extractVariables(data.content);
      const payload = { ...data, variables };
      if (editing) {
        await templatesApi.update(editing.id, payload);
        toast.success('Template updated');
      } else {
        await templatesApi.create(payload);
        toast.success('Template created');
      }
      setModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await templatesApi.delete(deleting.id);
      toast.success('Template deleted');
      setDeleting(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete template');
    } finally {
      setSaving(false);
    }
  }

  async function handleUseTemplate(filledContent: string, templateId: number) {
    navigator.clipboard.writeText(filledContent);
    toast.success('Copied to clipboard');
    // Increment usage count via render endpoint (optional)
    try {
      await templatesApi.render(templateId, {});
    } catch {
      // Ignore - just a usage tracker
    }
    setUseTemplate(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Document Templates</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Reusable templates for protocols, reports, and forms</p>
        </div>
        <button
          style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          onClick={openCreate}
        >
          + New Template
        </button>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {Object.entries(CATEGORY_COLORS).map(([cat, style]) => (
            <div key={cat} style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ fontSize: 24 }}>{style.icon}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: style.color }}>{stats[cat + 's' as keyof typeof stats]}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{cat}s</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <input
            style={{
              flex: 1,
              maxWidth: 300,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
            placeholder="Search templates..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setCategoryFilter(''); setPage(1); }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: categoryFilter === '' ? 'var(--accent)' : 'var(--surface)',
                color: categoryFilter === '' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              All
            </button>
            {Object.keys(CATEGORY_COLORS).map(cat => (
              <button
                key={cat}
                onClick={() => { setCategoryFilter(cat); setPage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: categoryFilter === cat ? 'var(--accent)' : 'var(--surface)',
                  color: categoryFilter === cat ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 13,
                  textTransform: 'capitalize',
                }}
              >
                {cat}s
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            Loading templates...
          </div>
        )}

        {/* Templates Grid */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {templates.map(t => (
              <div key={t.id} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    ...CATEGORY_COLORS[t.category],
                  }}>
                    {CATEGORY_COLORS[t.category]?.icon} {t.category}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Used {t.usage_count}x</span>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{t.name}</h3>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{t.description}</p>
                {t.variables && t.variables.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 12 }}>
                    Variables: {t.variables.map(v => `{{${v}}}`).join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setUseTemplate(t)} style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}>
                    Use Template
                  </button>
                  <button onClick={() => setPreviewTemplate(t)} style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}>
                    Preview
                  </button>
                  <button onClick={() => openEdit(t)} style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleting(t)} style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <p>No templates found</p>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <Pagination
              page={page}
              pages={totalPages}
              total={total}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Template' : 'New Template'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" {...register('name', { required: true })} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" {...register('category')}>
                <option value="protocol">Protocol</option>
                <option value="report">Report</option>
                <option value="form">Form</option>
                <option value="checklist">Checklist</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" {...register('description')} />
          </div>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea
              className="form-textarea"
              rows={10}
              {...register('content')}
              placeholder="Use {{variable_name}} for dynamic content..."
            />
            {watchContent && extractVariables(watchContent).length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Detected variables: {extractVariables(watchContent).map(v => `{{${v}}}`).join(', ')}
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={!!previewTemplate} onClose={() => setPreviewTemplate(null)} title={previewTemplate?.name || ''} size="lg">
        {previewTemplate && (
          <div style={{ padding: 16 }}>
            <div style={{ background: 'var(--surface2)', padding: 20, borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
              {previewTemplate.content}
            </div>
          </div>
        )}
      </Modal>

      {/* Use Template Modal */}
      <Modal isOpen={!!useTemplate} onClose={() => setUseTemplate(null)} title={`Use: ${useTemplate?.name || ''}`} size="lg">
        {useTemplate && <UseTemplateForm template={useTemplate} onSubmit={(c) => handleUseTemplate(c, useTemplate.id)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete template "${deleting?.name}"?`}
      />
    </div>
  );
}

function UseTemplateForm({ template, onSubmit }: { template: Template; onSubmit: (content: string) => void }) {
  const { register, handleSubmit, watch } = useForm<Record<string, string>>();
  const values = watch();

  const filledContent = template.content.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || `{{${key}}}`);

  function handleFormSubmit(data: Record<string, string>) {
    const filled = template.content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
    onSubmit(filled);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} style={{ padding: 16 }}>
      {template.variables && template.variables.length > 0 ? (
        <>
          <div style={{ marginBottom: 20 }}>
            {template.variables.map(v => (
              <div key={v} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {v.replace(/_/g, ' ')}
                </label>
                <input
                  {...register(v)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-muted)' }}>Preview</label>
            <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 200, overflowY: 'auto' }}>
              {filledContent}
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, marginBottom: 20 }}>
          {template.content}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="submit" style={{
          padding: '10px 20px',
          borderRadius: 8,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
        }}>
          Copy to Clipboard
        </button>
      </div>
    </form>
  );
}
