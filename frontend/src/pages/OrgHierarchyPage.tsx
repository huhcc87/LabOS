import { useState, useEffect } from 'react';
import { API_BASE_URL as API } from '../lib/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

interface LabNode { id: number; name: string; code: string; lab_type: string; pi_user_id: number | null; capacity_persons: number; }
interface SiteNode { id: number; name: string; code: string; site_type: string; city: string; timezone: string; labs: LabNode[]; }
interface OrgNode { id: number; name: string; short_code: string; country: string; city: string; sites: SiteNode[]; }

const SITE_TYPES = ['lab', 'core-facility', 'field', 'clinic', 'manufacturing', 'other'];
const LAB_TYPES = ['research', 'BSL2', 'BSL3', 'core', 'tissue-culture', 'imaging', 'computational'];
const TYPE_ICONS: Record<string, string> = {
  lab: '🔬', 'core-facility': '🏢', field: '🌿', clinic: '🏥', manufacturing: '🏭', other: '📍',
  research: '🔬', BSL2: '⚗️', BSL3: '☣️', core: '🏢', 'tissue-culture': '🧫', imaging: '🔭', computational: '💻',
};

const emptyOrg = { name: '', short_code: '', description: '', country: '', city: '', contact_email: '', website: '' };
const emptySite = { organization_id: 0, name: '', code: '', site_type: 'lab', country: '', city: '', timezone: 'UTC', contact_name: '', contact_email: '' };
const emptyLab = { site_id: 0, name: '', code: '', lab_type: 'research', capacity_persons: 0, notes: '' };

export default function OrgHierarchyPage() {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | 'org' | 'site' | 'lab'>(null);
  const [orgForm, setOrgForm] = useState({ ...emptyOrg });
  const [siteForm, setSiteForm] = useState({ ...emptySite });
  const [labForm, setLabForm] = useState({ ...emptyLab });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${API}/org/tree`, { headers: authHeaders() });
    if (r.ok) setTree((await r.json()).organizations ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (key: string) => setExpanded(e => { const n = new Set(e); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const createOrg = async () => {
    setSaving(true);
    const r = await fetch(`${API}/org/organizations`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(orgForm) });
    if (r.ok) { setModal(null); setOrgForm({ ...emptyOrg }); load(); }
    setSaving(false);
  };

  const createSite = async () => {
    setSaving(true);
    const r = await fetch(`${API}/org/sites`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(siteForm) });
    if (r.ok) { setModal(null); setSiteForm({ ...emptySite }); load(); }
    setSaving(false);
  };

  const createLab = async () => {
    setSaving(true);
    const r = await fetch(`${API}/org/labs`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(labForm) });
    if (r.ok) { setModal(null); setLabForm({ ...emptyLab }); load(); }
    setSaving(false);
  };

  const deleteOrg = async (id: number) => {
    if (!confirm('Delete this organization? All sites and labs will also be deleted.')) return;
    await fetch(`${API}/org/organizations/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };
  const deleteSite = async (id: number) => {
    if (!confirm('Delete this site?')) return;
    await fetch(`${API}/org/sites/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };
  const deleteLab = async (id: number) => {
    if (!confirm('Delete this lab unit?')) return;
    await fetch(`${API}/org/labs/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  const totalSites = tree.reduce((s, o) => s + o.sites.length, 0);
  const totalLabs = tree.reduce((s, o) => s + o.sites.reduce((ss, site) => ss + site.labs.length, 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Organization & Site Hierarchy</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Multi-site lab structure: {tree.length} org{tree.length !== 1 ? 's' : ''} · {totalSites} site{totalSites !== 1 ? 's' : ''} · {totalLabs} lab unit{totalLabs !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setLabForm({ ...emptyLab }); setModal('lab'); }}
            style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
            + Lab Unit
          </button>
          <button onClick={() => { setSiteForm({ ...emptySite }); setModal('site'); }}
            style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
            + Site
          </button>
          <button onClick={() => { setOrgForm({ ...emptyOrg }); setModal('org'); }}
            style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + Organization
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : tree.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No organizations yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Create your first organization to start building your multi-site hierarchy.
          </div>
          <button onClick={() => setModal('org')}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Create Organization
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tree.map(org => (
            <div key={org.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Org header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: expanded.has(`org-${org.id}`) ? '1px solid var(--border)' : 'none' }}
                onClick={() => toggle(`org-${org.id}`)}>
                <span style={{ fontSize: 20 }}>🏢</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{org.name}</span>
                  {org.short_code && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>{org.short_code}</span>}
                  {(org.city || org.country) && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{[org.city, org.country].filter(Boolean).join(', ')}</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{org.sites.length} site{org.sites.length !== 1 ? 's' : ''}</span>
                <button onClick={e => { e.stopPropagation(); deleteOrg(org.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '2px 6px' }}>🗑</button>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{expanded.has(`org-${org.id}`) ? '▾' : '▸'}</span>
              </div>

              {/* Sites */}
              {expanded.has(`org-${org.id}`) && (
                <div style={{ padding: '8px 20px 16px' }}>
                  {org.sites.length === 0 ? (
                    <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                      No sites yet. <button onClick={() => { setSiteForm({ ...emptySite, organization_id: org.id }); setModal('site'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', textDecoration: 'underline', fontSize: 13, padding: 0 }}>Add a site</button>
                    </div>
                  ) : (
                    org.sites.map(site => (
                      <div key={site.id} style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface, rgba(0,0,0,.04))', cursor: 'pointer' }}
                          onClick={() => toggle(`site-${site.id}`)}>
                          <span>{TYPE_ICONS[site.site_type] ?? '📍'}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>{site.name}</span>
                            {site.code && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>[{site.code}]</span>}
                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{site.site_type}</span>
                            {site.city && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{site.city}</span>}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{site.labs.length} lab{site.labs.length !== 1 ? 's' : ''}</span>
                          <button onClick={e => { e.stopPropagation(); deleteSite(site.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>🗑</button>
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{expanded.has(`site-${site.id}`) ? '▾' : '▸'}</span>
                        </div>

                        {expanded.has(`site-${site.id}`) && (
                          <div style={{ padding: '8px 14px 4px 42px' }}>
                            {site.labs.length === 0 ? (
                              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
                                No lab units yet. <button onClick={() => { setLabForm({ ...emptyLab, site_id: site.id }); setModal('lab'); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', textDecoration: 'underline', fontSize: 13, padding: 0 }}>Add lab unit</button>
                              </div>
                            ) : (
                              site.labs.map(lab => (
                                <div key={lab.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, marginBottom: 4, background: 'var(--bg-card)' }}>
                                  <span style={{ fontSize: 14 }}>{TYPE_ICONS[lab.lab_type] ?? '🔬'}</span>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 500, fontSize: 13 }}>{lab.name}</span>
                                    {lab.code && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>[{lab.code}]</span>}
                                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{lab.lab_type}</span>
                                    {lab.capacity_persons > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>· {lab.capacity_persons} persons</span>}
                                  </div>
                                  <button onClick={() => deleteLab(lab.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>🗑</button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModal(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.4)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>
              {modal === 'org' ? '+ New Organization' : modal === 'site' ? '+ New Site' : '+ New Lab Unit'}
            </h3>

            {modal === 'org' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ k: 'name', l: 'Organization Name *' }, { k: 'short_code', l: 'Short Code' }, { k: 'country', l: 'Country' }, { k: 'city', l: 'City' }, { k: 'contact_email', l: 'Contact Email' }, { k: 'website', l: 'Website' }].map(({ k, l }) => (
                  <div key={k} style={{ gridColumn: k === 'name' || k === 'description' ? '1 / -1' : undefined }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                    <input value={(orgForm as any)[k]} onChange={e => setOrgForm(f => ({ ...f, [k]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
                  </div>
                ))}
              </div>
            )}

            {modal === 'site' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Organization *</label>
                  <select value={siteForm.organization_id} onChange={e => setSiteForm(f => ({ ...f, organization_id: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}>
                    <option value={0}>— select —</option>
                    {tree.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                {[{ k: 'name', l: 'Site Name *' }, { k: 'code', l: 'Code' }, { k: 'country', l: 'Country' }, { k: 'city', l: 'City' }, { k: 'timezone', l: 'Timezone' }, { k: 'contact_email', l: 'Contact Email' }].map(({ k, l }) => (
                  <div key={k}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                    <input value={(siteForm as any)[k]} onChange={e => setSiteForm(f => ({ ...f, [k]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Site Type</label>
                  <select value={siteForm.site_type} onChange={e => setSiteForm(f => ({ ...f, site_type: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}>
                    {SITE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            {modal === 'lab' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Site *</label>
                  <select value={labForm.site_id} onChange={e => setLabForm(f => ({ ...f, site_id: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}>
                    <option value={0}>— select —</option>
                    {tree.flatMap(o => o.sites.map(s => <option key={s.id} value={s.id}>{o.name} → {s.name}</option>))}
                  </select>
                </div>
                {[{ k: 'name', l: 'Lab Name *' }, { k: 'code', l: 'Code' }, { k: 'capacity_persons', l: 'Capacity (persons)', type: 'number' }].map(({ k, l, type }) => (
                  <div key={k}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                    <input type={type ?? 'text'} value={(labForm as any)[k]} onChange={e => setLabForm(f => ({ ...f, [k]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Lab Type</label>
                  <select value={labForm.lab_type} onChange={e => setLabForm(f => ({ ...f, lab_type: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}>
                    {LAB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes</label>
                  <textarea value={labForm.notes} onChange={e => setLabForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', resize: 'vertical' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(null)}
                style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={modal === 'org' ? createOrg : modal === 'site' ? createSite : createLab} disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
