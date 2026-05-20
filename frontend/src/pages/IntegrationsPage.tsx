import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { integrationsApi } from '../lib/api';

interface Integration {
  id: number;
  name: string;
  description: string;
  integration_type: 'lims' | 'storage' | 'communication' | 'analytics' | 'instruments';
  status: 'active' | 'inactive' | 'error';
  config: Record<string, string>;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  lims: '🧬',
  storage: '☁️',
  communication: '💬',
  analytics: '📊',
  instruments: '🧫',
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  lims: { label: 'LIMS', color: '#6366f1' },
  storage: { label: 'Storage', color: '#22c55e' },
  communication: { label: 'Communication', color: '#f59e0b' },
  analytics: { label: 'Analytics', color: '#38bdf8' },
  instruments: { label: 'Instruments', color: '#ec4899' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Connected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  inactive: { label: 'Not Connected', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
  error: { label: 'Error', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [configuring, setConfiguring] = useState<Integration | null>(null);
  const [deleting, setDeleting] = useState<Integration | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  async function fetchIntegrations() {
    setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (categoryFilter) extra.integration_type = categoryFilter;
      const res = await integrationsApi.list(1, 100, '', extra);
      setIntegrations(res.data.items);
    } catch (err) {
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchIntegrations();
  }, [categoryFilter]);

  const filteredIntegrations = integrations;
  const connectedCount = integrations.filter(i => i.status === 'active').length;

  function openCreate() {
    setConfiguring(null);
    reset({
      name: '',
      description: '',
      integration_type: 'lims',
      status: 'inactive',
      config: '{}',
    });
    setModalOpen(true);
  }

  function openEdit(integration: Integration) {
    setConfiguring(integration);
    reset({
      name: integration.name,
      description: integration.description,
      integration_type: integration.integration_type,
      status: integration.status,
      config: JSON.stringify(integration.config || {}, null, 2),
    });
    setModalOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      let config = {};
      try {
        config = JSON.parse(data.config || '{}');
      } catch {
        toast.error('Invalid JSON in config');
        setSaving(false);
        return;
      }
      const payload = { ...data, config };
      if (configuring) {
        await integrationsApi.update(configuring.id, payload);
        toast.success('Integration updated');
      } else {
        await integrationsApi.create(payload);
        toast.success('Integration created');
      }
      setModalOpen(false);
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await integrationsApi.delete(deleting.id);
      toast.success('Integration deleted');
      setDeleting(null);
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete integration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(integration: Integration) {
    try {
      await integrationsApi.test(integration.id);
      toast.success(`Connection to ${integration.name} successful`);
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Failed to test ${integration.name}`);
    }
  }

  async function handleSync(integration: Integration) {
    try {
      await integrationsApi.sync(integration.id);
      toast.success(`Synced with ${integration.name}`);
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Failed to sync with ${integration.name}`);
    }
  }

  async function toggleStatus(integration: Integration) {
    try {
      const newStatus = integration.status === 'active' ? 'inactive' : 'active';
      await integrationsApi.update(integration.id, { status: newStatus });
      toast.success(newStatus === 'active' ? `Connected to ${integration.name}` : `Disconnected from ${integration.name}`);
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    }
  }

  function formatLastSync(timestamp: string | null) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Integrations</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {connectedCount} of {integrations.length} integrations connected
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setApiKeyModalOpen(true)} style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}>
            API Keys
          </button>
          <button onClick={openCreate} style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}>
            + Add Integration
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Category Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setCategoryFilter('')}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: categoryFilter === '' ? 'var(--accent)' : 'var(--surface)',
              color: categoryFilter === '' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            All
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: categoryFilter === key ? 'var(--accent)' : 'var(--surface)',
                color: categoryFilter === key ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {config.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            Loading integrations...
          </div>
        )}

        {/* Integrations Grid */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
            {filteredIntegrations.map(integration => (
              <div key={integration.id} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}>
                      {TYPE_ICONS[integration.integration_type] || '🔗'}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{integration.name}</h3>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: CATEGORY_CONFIG[integration.integration_type]?.color || '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {CATEGORY_CONFIG[integration.integration_type]?.label || integration.integration_type}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    ...STATUS_CONFIG[integration.status],
                  }}>
                    {STATUS_CONFIG[integration.status]?.label || integration.status}
                  </span>
                </div>

                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                  {integration.description || 'No description'}
                </p>

                {integration.status === 'active' && (
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 16 }}>
                    Last sync: {formatLastSync(integration.last_sync)}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {integration.status === 'active' ? (
                    <>
                      <button onClick={() => handleSync(integration)} style={{
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
                        Sync Now
                      </button>
                      <button onClick={() => openEdit(integration)} style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}>
                        Configure
                      </button>
                      <button onClick={() => toggleStatus(integration)} style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleTest(integration)} style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}>
                        Test Connection
                      </button>
                      <button onClick={() => toggleStatus(integration)} style={{
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
                        Connect
                      </button>
                      <button onClick={() => setDeleting(integration)} style={{
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && integrations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
            <p>No integrations configured</p>
            <button onClick={openCreate} style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}>
              Add Your First Integration
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={configuring ? 'Edit Integration' : 'Add Integration'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" {...register('name', { required: true })} placeholder="e.g., Slack Notifications" />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-input" {...register('integration_type', { required: true })}>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" {...register('description')} placeholder="Brief description of this integration" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" {...register('status')}>
              <option value="inactive">Inactive</option>
              <option value="active">Active</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Configuration (JSON)</label>
            <textarea
              className="form-textarea"
              rows={6}
              {...register('config')}
              placeholder='{"api_key": "your-key", "endpoint": "https://..."}'
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : configuring ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* API Keys Modal */}
      <Modal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} title="API Keys">
        <div style={{ padding: 16 }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            Use these API keys to integrate external services with LabOS.
          </p>
          <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Primary API Key</span>
              <button onClick={() => { navigator.clipboard.writeText('labos_pk_xxxxx'); toast.success('Copied!'); }} style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
              }}>
                Copy
              </button>
            </div>
            <code style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-soft)' }}>labos_pk_****</code>
          </div>
          <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Webhook Secret</span>
              <button onClick={() => { navigator.clipboard.writeText('whsec_xxxxx'); toast.success('Copied!'); }} style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
              }}>
                Copy
              </button>
            </div>
            <code style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-soft)' }}>whsec_****</code>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete integration "${deleting?.name}"?`}
      />
    </div>
  );
}
