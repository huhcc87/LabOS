import { useState } from 'react';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  icon: string;
}

interface Transaction {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  grant: string;
  vendor: string;
  status: 'pending' | 'approved' | 'reimbursed';
}

const INITIAL_BUDGETS: BudgetCategory[] = [];

const INITIAL_TRANSACTIONS: Transaction[] = [];

const INITIAL_GRANTS: any[] = [];

export default function GrantBudgetPage() {
  const [activeGrant, setActiveGrant] = useState('');
  const [transactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [budgets] = useState<BudgetCategory[]>(INITIAL_BUDGETS);

  const filteredTransactions = transactions.filter(t => t.grant === activeGrant);
  const totalAllocated = budgets.reduce((sum, b) => sum + b.allocated, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grant Budget Tracker</h1>
          <p className="page-subtitle">Track spending across grants, projects, and funding sources</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📊 Export Report</button>
          <button className="btn btn-primary">+ Log Expense</button>
        </div>
      </div>

      {/* Grant Selector */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
        {INITIAL_GRANTS.map(grant => (
          <button
            key={grant.id}
            onClick={() => setActiveGrant(grant.id)}
            className="card"
            style={{
              minWidth: 280,
              cursor: 'pointer',
              border: activeGrant === grant.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: activeGrant === grant.id ? 'var(--accent-light)' : 'var(--surface)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>{grant.id}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{grant.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Remaining</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>${grant.remaining.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, marginTop: 8 }}>
              <div style={{
                height: '100%',
                width: `${((grant.total - grant.remaining) / grant.total) * 100}%`,
                background: 'var(--accent)',
                borderRadius: 2,
              }} />
            </div>
          </button>
        ))}
      </div>

      {/* Budget Overview */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Budget Overview - {activeGrant}</h3>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Allocated</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${totalAllocated.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Spent</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>${totalSpent.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remaining</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>${(totalAllocated - totalSpent).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {budgets.map(budget => {
            const percent = (budget.spent / budget.allocated) * 100;
            const isOverBudget = percent > 90;
            return (
              <div key={budget.id} style={{ padding: 16, background: 'var(--surface2)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{budget.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{budget.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ${budget.spent.toLocaleString()} / ${budget.allocated.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(percent, 100)}%`,
                    background: isOverBudget ? 'var(--warning)' : 'var(--accent)',
                    borderRadius: 4,
                  }} />
                </div>
                <div style={{ fontSize: 11, color: isOverBudget ? 'var(--warning)' : 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
                  {percent.toFixed(0)}% used {isOverBudget && '⚠️'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Recent Transactions</h3>
          <input
            type="text"
            className="search-input"
            placeholder="Search transactions..."
            style={{ maxWidth: 250 }}
          />
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>{new Date(tx.date).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 500 }}>{tx.description}</td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>{tx.category}</span>
                  </td>
                  <td>{tx.vendor}</td>
                  <td style={{ fontWeight: 600 }}>${tx.amount.toLocaleString()}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: tx.status === 'approved' ? 'rgba(34, 197, 94, 0.15)' :
                                  tx.status === 'pending' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: tx.status === 'approved' ? '#4ade80' :
                             tx.status === 'pending' ? '#fbbf24' : '#60a5fa',
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-icon" title="View">👁️</button>
                      <button className="btn-icon" title="Edit">✏️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Budget Alerts</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: 13 }}>Travel Budget Nearly Exhausted</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Travel category is at 92% utilization. Consider reallocating funds.</div>
            </div>
          </div>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <div>
              <div style={{ fontWeight: 600, color: '#60a5fa', fontSize: 13 }}>Q2 Report Due</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Quarterly financial report for R01-CA123456 due in 15 days.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
