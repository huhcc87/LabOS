import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResultPoint {
  label: string;
  value: number;
  unit?: string;
  series?: string;
}

interface Props {
  results: ResultPoint[];
  onChange?: (results: ResultPoint[]) => void;
  readOnly?: boolean;
}

type ChartType = 'bar' | 'line';

const SERIES_PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

// ─── Inline SVG chart ─────────────────────────────────────────────────────────

function ResultsChart({ results, chartType }: { results: ResultPoint[]; chartType: ChartType }) {
  if (results.length === 0) return null;

  const W = 480, H = 160, PAD_L = 48, PAD_B = 32, PAD_T = 12, PAD_R = 16;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allSeries = [...new Set(results.map(r => r.series || 'Value'))];
  const labels = [...new Set(results.map(r => r.label))];
  const maxVal = Math.max(...results.map(r => r.value), 1);
  const unit = results[0]?.unit || '';

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    v: (maxVal * f).toPrecision(3),
    y: PAD_T + plotH * (1 - f),
  }));

  const barGroupW = plotW / labels.length;
  const barW = Math.min(barGroupW / (allSeries.length + 0.5), 36);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="var(--border, #e2e8f0)" strokeDasharray="3 3" />
          <text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted, #94a3b8)">{t.v}{unit ? ` ${unit}` : ''}</text>
        </g>
      ))}

      {/* Bars or line */}
      {labels.map((label, li) => {
        const groupCx = PAD_L + barGroupW * li + barGroupW / 2;
        return (
          <g key={label}>
            {/* X-axis label */}
            <text x={groupCx} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-muted, #94a3b8)"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label.length > 10 ? label.slice(0, 9) + '…' : label}
            </text>
            {allSeries.map((series, si) => {
              const pt = results.find(r => r.label === label && (r.series || 'Value') === series);
              if (!pt) return null;
              const ratio = pt.value / maxVal;
              const bh = Math.max(ratio * plotH, 2);
              const bx = groupCx - (allSeries.length * barW) / 2 + si * barW;
              const by = PAD_T + plotH - bh;
              const color = SERIES_PALETTE[si % SERIES_PALETTE.length];
              if (chartType === 'bar') {
                return (
                  <g key={series}>
                    <rect x={bx} y={by} width={barW - 2} height={bh} fill={color} rx={2} opacity={0.85} />
                    <title>{label}: {pt.value}{unit ? ` ${unit}` : ''}</title>
                  </g>
                );
              } else {
                // Line chart — only draw the line after all points are known; use path built later
                return null;
              }
            })}
          </g>
        );
      })}

      {/* Line chart paths */}
      {chartType === 'line' && allSeries.map((series, si) => {
        const color = SERIES_PALETTE[si % SERIES_PALETTE.length];
        const pts = labels.map((label, li) => {
          const pt = results.find(r => r.label === label && (r.series || 'Value') === series);
          const x = PAD_L + barGroupW * li + barGroupW / 2;
          const y = pt ? PAD_T + plotH * (1 - pt.value / maxVal) : null;
          return y !== null ? `${x},${y}` : null;
        }).filter(Boolean);
        if (pts.length < 2) {
          // Single point — draw a dot
          const pt0 = results.find(r => (r.series || 'Value') === series);
          if (!pt0) return null;
          const li = labels.indexOf(pt0.label);
          const x = PAD_L + barGroupW * li + barGroupW / 2;
          const y = PAD_T + plotH * (1 - pt0.value / maxVal);
          return <circle key={series} cx={x} cy={y} r={4} fill={color} />;
        }
        return (
          <g key={series}>
            <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            {pts.map((p, i) => {
              const [px, py] = (p as string).split(',').map(Number);
              return <circle key={i} cx={px} cy={py} r={3} fill={color} />;
            })}
          </g>
        );
      })}

      {/* Legend */}
      {allSeries.length > 1 && (
        <g>
          {allSeries.map((s, i) => (
            <g key={s} transform={`translate(${PAD_L + i * 100}, ${PAD_T - 2})`}>
              <rect width={10} height={10} fill={SERIES_PALETTE[i % SERIES_PALETTE.length]} rx={2} />
              <text x={14} y={9} fontSize={9} fill="var(--text-muted, #94a3b8)">{s}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExperimentResultsPanel({ results, onChange, readOnly = false }: Props) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [editRow, setEditRow] = useState<Partial<ResultPoint>>({});
  const [addingRow, setAddingRow] = useState(false);

  const allSeries = [...new Set(results.map(r => r.series || 'Value'))];
  const unit = results[0]?.unit || '';

  const addRow = () => {
    if (!editRow.label || editRow.value === undefined) return;
    onChange?.([...results, {
      label: editRow.label,
      value: Number(editRow.value),
      unit: editRow.unit || unit || undefined,
      series: editRow.series || undefined,
    }]);
    setEditRow({});
    setAddingRow(false);
  };

  return (
    <div style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface-raised, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>📊 Quantitative Data</span>
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['bar', 'line'] as ChartType[]).map(ct => (
              <button key={ct} onClick={() => setChartType(ct)} style={{
                padding: '3px 10px', fontSize: 12, fontWeight: 600,
                border: `1px solid ${chartType === ct ? '#6366f1' : 'var(--border, #e2e8f0)'}`,
                borderRadius: 6,
                background: chartType === ct ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: chartType === ct ? '#6366f1' : 'var(--text-muted, #64748b)', cursor: 'pointer',
              }}>
                {ct === 'bar' ? '▇ bar' : '〜 line'}
              </button>
            ))}
          </div>
        )}
        {!readOnly && !addingRow && (
          <button onClick={() => setAddingRow(true)} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #6366f1', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#6366f1', cursor: 'pointer' }}>
            + Add Row
          </button>
        )}
      </div>

      {/* SVG Chart */}
      {results.length > 0 && (
        <div style={{ padding: '12px 12px 0', background: 'var(--bg, #fff)' }}>
          <ResultsChart results={results} chartType={chartType} />
        </div>
      )}

      {/* Table */}
      {results.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                <th style={TH}>Label</th>
                <th style={TH}>Value</th>
                <th style={TH}>Unit</th>
                {allSeries.length > 1 && <th style={TH}>Series</th>}
                {!readOnly && <th style={TH} />}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                  <td style={TD}>{r.label}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.value}</td>
                  <td style={{ ...TD, color: 'var(--text-muted, #64748b)' }}>{r.unit || '—'}</td>
                  {allSeries.length > 1 && <td style={{ ...TD, color: 'var(--text-muted, #64748b)' }}>{r.series || '—'}</td>}
                  {!readOnly && (
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <button onClick={() => onChange?.(results.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && !addingRow && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>
          No results recorded yet.{!readOnly && ' Click "+ Add Row" to add measurements.'}
        </div>
      )}

      {/* Add row form */}
      {!readOnly && addingRow && (
        <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.04)', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {([
            { key: 'label', label: 'Label *', placeholder: 'e.g. Sample A', type: 'text', flex: '2 1 120px' },
            { key: 'value', label: 'Value *', placeholder: '0.00', type: 'number', flex: '1 1 80px' },
            { key: 'unit', label: 'Unit', placeholder: 'nM', type: 'text', flex: '1 1 60px' },
            { key: 'series', label: 'Series', placeholder: 'Control', type: 'text', flex: '1 1 80px' },
          ] as const).map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: f.flex }}>
              <label style={LBL}>{f.label}</label>
              <input style={FINP} type={f.type} placeholder={f.placeholder}
                value={(editRow as any)[f.key] ?? ''}
                onChange={e => setEditRow(p => ({ ...p, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
          <button onClick={addRow} disabled={!editRow.label || editRow.value === undefined} style={{ ...ADDBTN, opacity: !editRow.label || editRow.value === undefined ? 0.5 : 1 }}>Add</button>
          <button onClick={() => { setAddingRow(false); setEditRow({}); }} style={CANCELBTN}>Cancel</button>
        </div>
      )}
    </div>
  );
}

const TH: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 12px', color: 'var(--text, #1e293b)' };
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' };
const FINP: React.CSSProperties = { padding: '6px 10px', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, fontSize: 13, background: 'var(--bg, #fff)', color: 'var(--text, #1e293b)', width: '100%', boxSizing: 'border-box' };
const ADDBTN: React.CSSProperties = { padding: '7px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const CANCELBTN: React.CSSProperties = { padding: '7px 12px', background: 'none', color: 'var(--text-muted, #64748b)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 7, fontSize: 13, cursor: 'pointer' };

export default ExperimentResultsPanel;
