import { useState, useEffect } from 'react';

interface Personnel {
  id: number;
  name: string;
  role: string;
  salary: number;
  effort: number;
  months: number;
  fringeBenefit: number;
}

interface BudgetConfig {
  directCostLimit: number;
  indirectCostRate: number;
  fringeRates: {
    faculty: number;
    postdoc: number;
    gradStudent: number;
    staff: number;
  };
  modularBudget: boolean;
}

const DEFAULT_CONFIG: BudgetConfig = {
  directCostLimit: 250000,
  indirectCostRate: 55.5,
  fringeRates: {
    faculty: 32.5,
    postdoc: 28.0,
    gradStudent: 12.0,
    staff: 35.0,
  },
  modularBudget: true,
};

const INITIAL_PERSONNEL: Personnel[] = [];

export default function BudgetCalculatorPage() {
  const [config, setConfig] = useState<BudgetConfig>(DEFAULT_CONFIG);
  const [personnel, setPersonnel] = useState<Personnel[]>(INITIAL_PERSONNEL);
  const [supplies, setSupplies] = useState(35000);
  const [equipment, setEquipment] = useState(0);
  const [travel, setTravel] = useState(8000);
  const [other, setOther] = useState(5000);
  const [consortium, setConsortium] = useState(0);
  const [years, setYears] = useState(5);

  const calculatePersonnelCost = (p: Personnel) => {
    const baseSalary = (p.salary * p.effort / 100) * (p.months / 12);
    const fringe = baseSalary * (p.fringeBenefit / 100);
    return { salary: baseSalary, fringe, total: baseSalary + fringe };
  };

  const totalPersonnel = personnel.reduce((sum, p) => sum + calculatePersonnelCost(p).total, 0);
  const totalSalary = personnel.reduce((sum, p) => sum + calculatePersonnelCost(p).salary, 0);
  const totalFringe = personnel.reduce((sum, p) => sum + calculatePersonnelCost(p).fringe, 0);
  const directCosts = totalPersonnel + supplies + equipment + travel + other;
  const mtdc = directCosts - equipment - (consortium * 0.5); // Modified Total Direct Costs
  const indirectCosts = mtdc * (config.indirectCostRate / 100);
  const totalCosts = directCosts + indirectCosts + consortium;

  const modularAmount = Math.ceil(directCosts / 25000) * 25000;
  const isOverLimit = directCosts > config.directCostLimit;

  const addPersonnel = () => {
    setPersonnel([...personnel, {
      id: Date.now(),
      name: 'New Position',
      role: 'staff',
      salary: 50000,
      effort: 100,
      months: 12,
      fringeBenefit: config.fringeRates.staff,
    }]);
  };

  const updatePersonnel = (id: number, updates: Partial<Personnel>) => {
    setPersonnel(personnel.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePersonnel = (id: number) => {
    setPersonnel(personnel.filter(p => p.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget Calculator</h1>
          <p className="page-subtitle">Calculate grant budgets with salary, fringe, and F&A rates</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Import Template</button>
          <button className="btn btn-secondary">📊 Export to Excel</button>
          <button className="btn btn-primary">💾 Save Budget</button>
        </div>
      </div>

      {/* Budget Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ borderLeftColor: isOverLimit ? '#ef4444' : '#22c55e' }}>
          <span className="metric-label">Direct Costs (Year 1)</span>
          <div className="metric-value" style={{ color: isOverLimit ? '#ef4444' : '#22c55e' }}>
            ${directCosts.toLocaleString()}
          </div>
          <div className="metric-sub">
            {isOverLimit ? `Over limit by $${(directCosts - config.directCostLimit).toLocaleString()}` : 'Within limit'}
          </div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">F&A ({config.indirectCostRate}%)</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>${Math.round(indirectCosts).toLocaleString()}</div>
          <div className="metric-sub">Indirect costs</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Total Year 1</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>${Math.round(totalCosts).toLocaleString()}</div>
          <div className="metric-sub">All costs</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Project Total ({years} years)</span>
          <div className="metric-value">${(Math.round(totalCosts) * years).toLocaleString()}</div>
          <div className="metric-sub">Estimated total</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Main Budget Form */}
        <div>
          {/* Configuration */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>⚙️ Budget Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Direct Cost Limit</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.directCostLimit}
                  onChange={(e) => setConfig({ ...config, directCostLimit: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>F&A Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.indirectCostRate}
                  onChange={(e) => setConfig({ ...config, indirectCostRate: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Project Years</label>
                <input
                  type="number"
                  className="form-input"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Budget Type</label>
                <select
                  className="form-select"
                  value={config.modularBudget ? 'modular' : 'detailed'}
                  onChange={(e) => setConfig({ ...config, modularBudget: e.target.value === 'modular' })}
                >
                  <option value="modular">Modular ($25K increments)</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Personnel */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>👥 Personnel</h3>
              <button className="btn btn-sm btn-primary" onClick={addPersonnel}>+ Add Person</button>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name/Position</th>
                    <th>Role</th>
                    <th>Annual Salary</th>
                    <th>% Effort</th>
                    <th>Months</th>
                    <th>Fringe %</th>
                    <th>Cost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {personnel.map(p => {
                    const cost = calculatePersonnelCost(p);
                    return (
                      <tr key={p.id}>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            value={p.name}
                            onChange={(e) => updatePersonnel(p.id, { name: e.target.value })}
                            style={{ minWidth: 150 }}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={p.role}
                            onChange={(e) => updatePersonnel(p.id, { role: e.target.value, fringeBenefit: config.fringeRates[e.target.value as keyof typeof config.fringeRates] })}
                            style={{ width: 100 }}
                          >
                            <option value="faculty">Faculty</option>
                            <option value="postdoc">Postdoc</option>
                            <option value="gradStudent">Grad Student</option>
                            <option value="staff">Staff</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={p.salary}
                            onChange={(e) => updatePersonnel(p.id, { salary: Number(e.target.value) })}
                            style={{ width: 100 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={p.effort}
                            onChange={(e) => updatePersonnel(p.id, { effort: Number(e.target.value) })}
                            style={{ width: 60 }}
                            min={0}
                            max={100}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={p.months}
                            onChange={(e) => updatePersonnel(p.id, { months: Number(e.target.value) })}
                            style={{ width: 50 }}
                            min={1}
                            max={12}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={p.fringeBenefit}
                            onChange={(e) => updatePersonnel(p.id, { fringeBenefit: Number(e.target.value) })}
                            style={{ width: 60 }}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          ${Math.round(cost.total).toLocaleString()}
                        </td>
                        <td>
                          <button className="btn-icon" onClick={() => removePersonnel(p.id)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <td colSpan={6} style={{ fontWeight: 600 }}>Total Personnel</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>${Math.round(totalPersonnel).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Other Costs */}
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📦 Other Direct Costs</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Supplies & Materials</label>
                <input
                  type="number"
                  className="form-input"
                  value={supplies}
                  onChange={(e) => setSupplies(Number(e.target.value))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reagents, consumables, etc.</span>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Equipment (&gt;$5,000)</label>
                <input
                  type="number"
                  className="form-input"
                  value={equipment}
                  onChange={(e) => setEquipment(Number(e.target.value))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Excluded from F&A calculation</span>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Travel</label>
                <input
                  type="number"
                  className="form-input"
                  value={travel}
                  onChange={(e) => setTravel(Number(e.target.value))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Domestic & international</span>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Other Direct Costs</label>
                <input
                  type="number"
                  className="form-input"
                  value={other}
                  onChange={(e) => setOther(Number(e.target.value))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Publication, service fees, etc.</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Consortium/Subcontract Costs</label>
                <input
                  type="number"
                  className="form-input"
                  value={consortium}
                  onChange={(e) => setConsortium(Number(e.target.value))}
                  style={{ maxWidth: 300 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>First $25K subject to F&A</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>📊 Budget Summary</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Salaries</span>
                <span style={{ fontWeight: 600 }}>${Math.round(totalSalary).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Fringe Benefits</span>
                <span style={{ fontWeight: 600 }}>${Math.round(totalFringe).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Supplies</span>
                <span style={{ fontWeight: 600 }}>${supplies.toLocaleString()}</span>
              </div>
              {equipment > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Equipment</span>
                  <span style={{ fontWeight: 600 }}>${equipment.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Travel</span>
                <span style={{ fontWeight: 600 }}>${travel.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Other</span>
                <span style={{ fontWeight: 600 }}>${other.toLocaleString()}</span>
              </div>
              {consortium > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Consortium</span>
                  <span style={{ fontWeight: 600 }}>${consortium.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                <span>Total Direct Costs</span>
                <span style={{ color: isOverLimit ? '#ef4444' : 'var(--accent)' }}>${Math.round(directCosts).toLocaleString()}</span>
              </div>
              {config.modularBudget && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Modular: ${modularAmount.toLocaleString()} ({modularAmount / 25000} modules)
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span>MTDC</span>
              <span>${Math.round(mtdc).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
              <span>F&A ({config.indirectCostRate}%)</span>
              <span>${Math.round(indirectCosts).toLocaleString()}</span>
            </div>

            <div style={{ background: 'var(--accent-light)', padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                <span>Total Year 1</span>
                <span style={{ color: 'var(--accent)' }}>${Math.round(totalCosts).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Multi-Year Projection</div>
              {Array.from({ length: years }).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>Year {i + 1}</span>
                  <span>${Math.round(totalCosts * (1 + i * 0.03)).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Project Total</span>
                <span>${Math.round(totalCosts * years * 1.06).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
