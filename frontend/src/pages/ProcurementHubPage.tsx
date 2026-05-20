import { useState, useEffect, useCallback } from 'react';
import { procurementApi, reagentCartApi } from '../lib/api';
import { API_BASE_URL } from '../lib/api';

type Tab =
  | 'approvals' | 'budgets' | 'hazards' | 'group-buy'
  | 'rfq' | 'borrow' | 'receive' | 'ocr' | 'webhooks';

const TABS: Array<{ id: Tab; label: string; icon: string; feature: string }> = [
  { id: 'approvals',   label: 'Approvals',           icon: '✓', feature: 'F2' },
  { id: 'budgets',     label: 'Budgets',             icon: '💰', feature: 'F6' },
  { id: 'hazards',     label: 'Hazards / Restricted', icon: '☣️', feature: 'F5' },
  { id: 'group-buy',   label: 'Group buy',           icon: '🤝', feature: 'F10' },
  { id: 'rfq',         label: 'Quote requests',      icon: '📄', feature: 'F9' },
  { id: 'borrow',      label: 'Lab-to-lab borrow',   icon: '🔁', feature: 'F15' },
  { id: 'receive',     label: 'Receive (barcode)',   icon: '📦', feature: 'F7' },
  { id: 'ocr',         label: 'OCR invoices',        icon: '📸', feature: 'F12' },
  { id: 'webhooks',    label: 'Webhooks',            icon: '🔔', feature: 'F13' },
];

const INP: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
};

export default function ProcurementHubPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>🏛 Procurement Hub</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
          Approvals, budgets, hazards, RFQs, group-buy, lab-to-lab borrow, and barcode receive — all linked to the Reagent Cart.
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 4, padding: 4, background: 'var(--surface2)', borderRadius: 10,
        marginBottom: 20, overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
              background: tab === t.id ? 'var(--surface)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'approvals' && <ApprovalsTab />}
      {tab === 'budgets' && <BudgetsTab />}
      {tab === 'hazards' && <HazardsTab />}
      {tab === 'group-buy' && <GroupBuyTab />}
      {tab === 'rfq' && <RFQTab />}
      {tab === 'borrow' && <BorrowTab />}
      {tab === 'receive' && <ReceiveTab />}
      {tab === 'ocr' && <OCRTab />}
      {tab === 'webhooks' && <WebhooksTab />}
    </div>
  );
}

// ── F2: Approvals ───────────────────────────────────────────────────────────
function ApprovalsTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState({ name: '', over_amount: '', hazardous: false, role_required: 'staff' });

  const load = useCallback(async () => {
    try {
      const p = await procurementApi.listPendingApprovals();
      setPending(p.data || []);
      const r = await procurementApi.listRules();
      setRules(r.data || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const approveOne = async (id: number) => { await procurementApi.approve([id]); load(); };
  const rejectOne = async (id: number) => {
    const reason = prompt('Rejection reason (optional)') || '';
    await procurementApi.reject([id], reason);
    load();
  };
  const addRule = async () => {
    if (!newRule.name) return;
    await procurementApi.createRule({
      ...newRule,
      over_amount: newRule.over_amount ? Number(newRule.over_amount) : null,
    });
    setNewRule({ name: '', over_amount: '', hazardous: false, role_required: 'staff' });
    load();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div className="card">
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Pending approval ({pending.length})</h3>
        {pending.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No items currently waiting for approval.
          </div>
        ) : pending.map(p => (
          <div key={p.id} style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {p.vendor} · {p.catalog} · qty {p.quantity} · ${(p.unit_price || 0) * (p.quantity || 1)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => approveOne(p.id)} style={{ padding: '5px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓ Approve</button>
              <button onClick={() => rejectOne(p.id)} style={{ padding: '5px 10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✗ Reject</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Approval rules</h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          When triggered, items are queued in this dashboard for approval before they can be ordered.
        </p>
        {rules.map(r => (
          <div key={r.id} style={{ padding: 8, borderTop: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ color: 'var(--text-muted)' }}>
              {r.over_amount ? `over $${r.over_amount}` : ''}
              {r.hazardous ? ' · hazardous' : ''}
              {r.vendor_match ? ` · vendor=${r.vendor_match}` : ''}
              {' · '} requires {r.role_required}
              <button onClick={async () => { await procurementApi.deleteRule(r.id); load(); }}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>×</button>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rule name</label>
          <input style={{ ...INP, width: '100%', marginBottom: 6 }} value={newRule.name}
            onChange={e => setNewRule(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Require PI for orders over $500" />
          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trigger when cart over $</label>
          <input style={{ ...INP, width: '100%', marginBottom: 6 }} type="number" value={newRule.over_amount}
            onChange={e => setNewRule(s => ({ ...s, over_amount: e.target.value }))} placeholder="500" />
          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Approver role</label>
          <select style={{ ...INP, width: '100%', marginBottom: 6 }} value={newRule.role_required}
            onChange={e => setNewRule(s => ({ ...s, role_required: e.target.value }))}>
            <option>staff</option>
            <option>manager</option>
            <option>pi</option>
            <option>admin</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
            <input type="checkbox" checked={newRule.hazardous} onChange={e => setNewRule(s => ({ ...s, hazardous: e.target.checked }))} />
            Also trigger for hazardous chemicals
          </label>
          <button onClick={addRule} style={{ width: '100%', padding: '8px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Add rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── F6: Budgets ─────────────────────────────────────────────────────────────
function BudgetsTab() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', budget_code: '', total_amount: '', fiscal_year: '' });

  const load = useCallback(async () => {
    try { const r = await procurementApi.listBudgets(); setBudgets(r.data || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name || !form.budget_code || !form.total_amount) return;
    await procurementApi.createBudget({
      name: form.name, budget_code: form.budget_code,
      total_amount: Number(form.total_amount), fiscal_year: form.fiscal_year,
    });
    setForm({ name: '', budget_code: '', total_amount: '', fiscal_year: '' });
    load();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div>
        <div className="card">
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Active budgets ({budgets.length})</h3>
          {budgets.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No budgets configured. Add one on the right →
            </div>
          ) : budgets.map(b => {
            const pct = Math.min(100, b.percent_used || 0);
            const color = pct < 75 ? '#22c55e' : pct < 90 ? '#f59e0b' : '#ef4444';
            return (
              <div key={b.id} style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {b.budget_code}{b.fiscal_year ? ` · FY${b.fiscal_year}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>
                      ${b.spent_amount.toFixed(0)} / ${b.total_amount.toFixed(0)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ${b.remaining.toFixed(0)} remaining
                    </div>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                </div>
                <button onClick={async () => { await procurementApi.deleteBudget(b.id); load(); }}
                  style={{ marginTop: 8, padding: '4px 10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                  Delete budget
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Add a budget</h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          The reagent cart will warn you before checkout if a purchase would exceed remaining balance.
        </p>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Name</label>
        <input style={{ ...INP, width: '100%', marginBottom: 8 }} value={form.name}
          onChange={e => setForm(s => ({ ...s, name: e.target.value }))} placeholder="e.g. R01 supplies FY2026" />
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Budget code</label>
        <input style={{ ...INP, width: '100%', marginBottom: 8 }} value={form.budget_code}
          onChange={e => setForm(s => ({ ...s, budget_code: e.target.value }))} placeholder="e.g. R01-CA-001-SUPP" />
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total amount ($)</label>
        <input style={{ ...INP, width: '100%', marginBottom: 8 }} type="number" value={form.total_amount}
          onChange={e => setForm(s => ({ ...s, total_amount: e.target.value }))} placeholder="50000" />
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fiscal year</label>
        <input style={{ ...INP, width: '100%', marginBottom: 12 }} value={form.fiscal_year}
          onChange={e => setForm(s => ({ ...s, fiscal_year: e.target.value }))} placeholder="2026" />
        <button onClick={create} style={{ width: '100%', padding: 8, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          + Create budget
        </button>
      </div>
    </div>
  );
}

// ── F5: Hazards / Restricted chemicals ──────────────────────────────────────
function HazardsTab() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', cas: '', category: 'Restricted', severity: 'warn', notes: '' });
  const load = useCallback(async () => {
    try { const r = await procurementApi.listRestricted(); setList(r.data || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!form.name) return;
    await procurementApi.addRestricted(form);
    setForm({ name: '', cas: '', category: 'Restricted', severity: 'warn', notes: '' });
    load();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div className="card">
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Restricted / regulated chemicals ({list.length})</h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          The extension scans every captured item against this list and warns at purchase time.
        </p>
        {list.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No restricted chemicals configured. Add some on the right →
          </div>
        ) : list.map(r => (
          <div key={r.id} style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {r.cas ? `CAS ${r.cas} · ` : ''}{r.category}
              </div>
              {r.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.notes}</div>}
            </div>
            <span style={{
              padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
              background: r.severity === 'block' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: r.severity === 'block' ? '#ef4444' : '#f59e0b',
            }}>
              {r.severity.toUpperCase()}
            </span>
            <button onClick={async () => { await procurementApi.deleteRestricted(r.id); load(); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Add restricted chemical</h3>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Name</label>
        <input style={{ ...INP, width: '100%', marginBottom: 8 }} value={form.name}
          onChange={e => setForm(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Sodium azide" />
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>CAS number</label>
        <input style={{ ...INP, width: '100%', marginBottom: 8 }} value={form.cas}
          onChange={e => setForm(s => ({ ...s, cas: e.target.value }))} placeholder="26628-22-8" />
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Category</label>
        <select style={{ ...INP, width: '100%', marginBottom: 8 }} value={form.category}
          onChange={e => setForm(s => ({ ...s, category: e.target.value }))}>
          <option>Restricted</option>
          <option>DEA Schedule I</option>
          <option>DEA Schedule II</option>
          <option>Biohazard L3</option>
          <option>Radioactive</option>
          <option>Carcinogen</option>
        </select>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Severity</label>
        <select style={{ ...INP, width: '100%', marginBottom: 8 }} value={form.severity}
          onChange={e => setForm(s => ({ ...s, severity: e.target.value }))}>
          <option value="warn">Warn at purchase</option>
          <option value="block">Block purchase entirely</option>
        </select>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notes</label>
        <input style={{ ...INP, width: '100%', marginBottom: 12 }} value={form.notes}
          onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} placeholder="Why it's restricted" />
        <button onClick={add} style={{ width: '100%', padding: 8, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          + Add chemical
        </button>
      </div>
    </div>
  );
}

// ── F10: Group buy ──────────────────────────────────────────────────────────
function GroupBuyTab() {
  const [opps, setOpps] = useState<any[]>([]);
  const load = useCallback(async () => {
    try { const r = await procurementApi.groupBuy(); setOpps(r.data || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Group buy opportunities</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Items appearing in multiple users' carts in the past 14 days. Combine to claim volume discounts.
      </p>
      {opps.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No group-buy opportunities found yet. The more users capture, the more matches appear here.
        </div>
      ) : opps.map(o => (
        <div key={o.key} style={{
          padding: 14, marginBottom: 8, borderRadius: 10,
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.25)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 28 }}>🤝</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{o.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {o.vendor} · {o.catalog} · combined qty {o.total_quantity} across {o.lab_count} labs
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>~{o.potential_savings_pct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>potential savings</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── F9: RFQ ─────────────────────────────────────────────────────────────────
function RFQTab() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await reagentCartApi.list();
      setItems((r.data as any) || []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const highValue = items.filter(i => (i.unit_price || 0) * (i.quantity || 1) >= 500);

  const requestQuote = async (id: number) => {
    const res = await procurementApi.requestQuote(id);
    alert(`RFQ requested. Vendor sales email: ${(res.data as any).would_email || '(unknown)'}`);
    load();
  };

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>High-value items (≥ $500)</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        For big-ticket items, request a formal quote instead of paying list price. Vendors routinely give 10–25% off via RFQ.
      </p>
      {highValue.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No high-value items in cart yet.
        </div>
      ) : highValue.map(i => (
        <div key={i.id} style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{i.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {i.vendor} · qty {i.quantity} · ${((i.unit_price || 0) * (i.quantity || 1)).toFixed(2)}
            </div>
          </div>
          <button onClick={() => requestQuote(i.id)}
            style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
            📄 Request quote
          </button>
        </div>
      ))}
    </div>
  );
}

// ── F15: Lab-to-lab borrow ──────────────────────────────────────────────────
function BorrowTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const load = useCallback(async () => {
    try { const r = await procurementApi.listBorrow(); setRequests(r.data || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const respond = async (id: number, approve: boolean) => {
    await procurementApi.respondBorrow(id, approve);
    load();
  };

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Borrow requests</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Before buying a reagent, the extension can check whether another lab in your org already has it. Save money + shipping by borrowing first.
      </p>
      {requests.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No borrow requests yet.
        </div>
      ) : requests.map(r => (
        <div key={r.id} style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 22 }}>🔁</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {r.requested_quantity || 'Quantity TBD'} of inventory #{r.inventory_item_id ?? '?'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              From user #{r.requester_id} · {r.purpose}
            </div>
          </div>
          <span style={{
            padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
            background: r.status === 'approved' ? 'rgba(34,197,94,0.15)'
                       : r.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            color: r.status === 'approved' ? '#22c55e' : r.status === 'rejected' ? '#ef4444' : '#f59e0b',
          }}>{r.status}</span>
          {r.status === 'pending' && (
            <>
              <button onClick={() => respond(r.id, true)}
                style={{ padding: '4px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Lend</button>
              <button onClick={() => respond(r.id, false)}
                style={{ padding: '4px 10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Decline</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── F7: Receive (barcode) ───────────────────────────────────────────────────
function ReceiveTab() {
  const [barcode, setBarcode] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const submit = async () => {
    if (!barcode.trim()) return;
    const r = await procurementApi.receive(barcode.trim());
    setHistory(prev => [{ barcode: barcode.trim(), result: r.data, ts: new Date().toISOString() }, ...prev].slice(0, 10));
    setBarcode('');
  };

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📦 Receive on arrival</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Scan the catalog # / barcode on the delivery box. LabOS marks the matching ordered item as received and updates inventory.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={barcode} onChange={e => setBarcode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          autoFocus
          placeholder="Scan or type catalog # / barcode then press Enter"
          style={{ ...INP, flex: 1, fontFamily: 'ui-monospace, monospace' }} />
        <button onClick={submit} style={{ padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          ✓ Receive
        </button>
      </div>
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recent scans</h4>
          {history.map((h, i) => (
            <div key={i} style={{ padding: 10, borderTop: '1px solid var(--border)', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>{h.barcode}</code>
                {h.result.ok ? (
                  <span style={{ marginLeft: 10, color: '#22c55e' }}>✓ Received: {h.result.name}</span>
                ) : (
                  <span style={{ marginLeft: 10, color: '#ef4444' }}>✗ {h.result.error}</span>
                )}
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{new Date(h.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── F12: OCR invoice import ────────────────────────────────────────────────
function OCRTab() {
  const [status, setStatus] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    setStatus('Loading Tesseract OCR engine…');
    try {
      // Load Tesseract from CDN dynamically (keeps bundle size down)
      const Tesseract = (window as any).Tesseract || (await loadTesseract());
      setStatus('Running OCR on invoice…');
      const result = await Tesseract.recognize(file, 'eng');
      const text: string = result.data.text || '';
      // Heuristic line extraction: lines with a $ or quantity
      const out = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && (/\$\s*\d/.test(l) || /\d+\s*x/i.test(l)));
      setLines(out);
      setStatus(`Extracted ${out.length} line items. Review and import to cart manually.`);
    } catch (e: any) {
      setStatus('OCR failed: ' + e.message);
    }
    setLoading(false);
  };

  const loadTesseract = () => new Promise<any>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve((window as any).Tesseract);
    s.onerror = reject;
    document.head.appendChild(s);
  });

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📸 OCR invoice import</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Drop a PDF or photo of a vendor invoice or quote. LabOS will extract line items so you can review and add them to your cart.
      </p>
      <input type="file" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        style={{ ...INP, width: '100%', marginBottom: 12 }} />
      {loading && <div style={{ padding: 10, background: 'rgba(99,102,241,0.06)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{status}</div>}
      {!loading && status && <div style={{ padding: 10, background: 'rgba(34,197,94,0.06)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{status}</div>}
      {lines.length > 0 && (
        <div>
          <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Extracted line items</h4>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, padding: 10, background: 'var(--surface2)', borderRadius: 6 }}>
            {lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── F13: Webhooks (Slack / Teams) ───────────────────────────────────────────
function WebhooksTab() {
  const [slack, setSlack] = useState<string>(() => localStorage.getItem('labos_slack_webhook') || '');
  const [teams, setTeams] = useState<string>(() => localStorage.getItem('labos_teams_webhook') || '');
  const [triggers, setTriggers] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('labos_webhook_triggers') || '{}'); } catch { return {}; }
  });

  const save = () => {
    localStorage.setItem('labos_slack_webhook', slack);
    localStorage.setItem('labos_teams_webhook', teams);
    localStorage.setItem('labos_webhook_triggers', JSON.stringify(triggers));
    alert('Webhook settings saved.');
  };

  const test = async (url: string, kind: 'slack' | 'teams') => {
    if (!url) return alert('Set the URL first.');
    const payload = kind === 'slack'
      ? { text: ':test_tube: LabOS test message — webhook is working!' }
      : { text: 'LabOS test message — webhook is working!' };
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      alert('Sent. Check your channel.');
    } catch { alert('Failed to send.'); }
  };

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🔔 Slack / Teams notifications</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Send approvals, large orders, hazard alerts, and IoT critical events to your team's chat channel.
      </p>

      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Slack incoming-webhook URL</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={slack} onChange={e => setSlack(e.target.value)}
          placeholder="https://hooks.slack.com/services/T.../B.../..."
          style={{ ...INP, flex: 1 }} />
        <button onClick={() => test(slack, 'slack')} style={{ padding: '8px 14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Test</button>
      </div>

      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Microsoft Teams webhook URL</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={teams} onChange={e => setTeams(e.target.value)}
          placeholder="https://outlook.office.com/webhook/..."
          style={{ ...INP, flex: 1 }} />
        <button onClick={() => test(teams, 'teams')} style={{ padding: '8px 14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Test</button>
      </div>

      <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16 }}>Trigger on</h4>
      {[
        ['approval_requested', 'Approval requested'],
        ['order_placed',       'Order placed'],
        ['hazard_detected',    'Hazardous item captured'],
        ['budget_warning',     'Budget reaches 90%'],
        ['iot_critical',       'IoT sensor critical'],
        ['received',           'Order received on arrival'],
      ].map(([key, label]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6 }}>
          <input type="checkbox" checked={!!triggers[key]} onChange={e => setTriggers(prev => ({ ...prev, [key]: e.target.checked }))} />
          <span style={{ fontSize: 13 }}>{label}</span>
        </label>
      ))}

      <button onClick={save} style={{ marginTop: 12, padding: '10px 22px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
        Save webhook settings
      </button>

      <div style={{ marginTop: 16, padding: 12, background: 'rgba(99,102,241,0.06)', borderRadius: 8, fontSize: 12, lineHeight: 1.55 }}>
        <strong>How to get a webhook URL:</strong><br/>
        • <strong>Slack</strong> — App directory → <em>Incoming Webhooks</em> → Add to workspace → pick a channel → copy URL.<br/>
        • <strong>Teams</strong> — Channel ⋯ → Connectors → Incoming Webhook → Create → copy URL.<br/>
        URLs are stored only in your browser (localStorage). Future versions will store them server-side per workspace.
      </div>
    </div>
  );
}
