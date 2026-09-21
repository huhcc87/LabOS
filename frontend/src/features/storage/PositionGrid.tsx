import { useRef } from 'react';

export type PositionState = 'empty' | 'occupied' | 'reserved' | 'quarantined' | 'unavailable';

export interface GridPosition {
  row: number;
  col: number;
  label: string;
  state: PositionState;
  sample_id?: string;
}

interface PositionGridProps {
  rows: number;
  cols: number;
  positions: Array<{ row: number; col: number; label: string; state: Exclude<PositionState, 'empty'>; sample_id?: string }>;
  onCellClick?: (cell: GridPosition) => void;
}

// Non-colour affordance per state: a symbol AND a text label, never colour alone.
const STATE_META: Record<PositionState, { symbol: string; text: string }> = {
  empty: { symbol: '·', text: 'Empty' },
  occupied: { symbol: '●', text: 'Occupied' },
  reserved: { symbol: '◐', text: 'Reserved' },
  quarantined: { symbol: '▲', text: 'Quarantined' },
  unavailable: { symbol: '✕', text: 'Unavailable' },
};

const rowLetter = (row: number) => String.fromCharCode(65 + row);

export function PositionGrid({ rows, cols, positions, onCellClick }: PositionGridProps) {
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const byPos = new Map<string, (typeof positions)[number]>();
  for (const p of positions) byPos.set(`${p.row}:${p.col}`, p);

  const focusCell = (row: number, col: number) => {
    cellRefs.current.get(`${row}:${col}`)?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [row - 1, col], ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1], ArrowRight: [row, col + 1],
    };
    const move = moves[e.key];
    if (!move) return;
    const [nr, nc] = move;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
    e.preventDefault();
    focusCell(nr, nc);
  };

  return (
    <div
      role="grid"
      aria-label={`Storage box grid, ${rows} rows by ${cols} columns`}
      style={{ display: 'inline-block', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
    >
      <div role="row" style={{ display: 'flex' }}>
        <div style={headerCellStyle} />
        {Array.from({ length: cols }, (_, c) => (
          <div key={c} role="columnheader" style={headerCellStyle}>{c + 1}</div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} role="row" style={{ display: 'flex' }}>
          <div role="rowheader" style={headerCellStyle}>{rowLetter(r)}</div>
          {Array.from({ length: cols }, (_, c) => {
            const found = byPos.get(`${r}:${c}`);
            const state: PositionState = found?.state ?? 'empty';
            const label = found?.label ?? `${rowLetter(r)}${c + 1}`;
            const meta = STATE_META[state];
            return (
              <button
                key={c}
                type="button"
                role="gridcell"
                ref={(el) => { if (el) cellRefs.current.set(`${r}:${c}`, el); }}
                tabIndex={r === 0 && c === 0 ? 0 : -1}
                aria-label={`${label}: ${meta.text}`}
                title={`${label}: ${meta.text}`}
                onClick={() => onCellClick?.({ row: r, col: c, label, state, sample_id: found?.sample_id })}
                onKeyDown={(e) => handleKeyDown(e, r, c)}
                style={cellStyle(state)}
              >
                <span aria-hidden="true">{meta.symbol}</span>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                  {meta.text}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const headerCellStyle: React.CSSProperties = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface2)',
};

function cellStyle(state: PositionState): React.CSSProperties {
  const backgrounds: Record<PositionState, string> = {
    empty: 'var(--surface)',
    occupied: 'rgba(74,222,128,0.18)',
    reserved: 'rgba(250,204,21,0.18)',
    quarantined: 'rgba(249,115,22,0.18)',
    unavailable: 'rgba(239,68,68,0.18)',
  };
  return {
    width: 28, height: 28, border: '1px solid var(--border)', background: backgrounds[state],
    color: 'var(--text)', fontSize: 12, cursor: 'pointer', padding: 0, position: 'relative',
  };
}
