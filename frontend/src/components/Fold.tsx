import { useState, type ReactNode } from 'react';

/** A card with a title bar that opens and closes (a pop-down). Optional buttons sit on the right of the bar. */
export default function Fold({ title, actions, defaultOpen = false, children }: {
  title: ReactNode; actions?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: open ? 12 : 0 }}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <span aria-hidden style={{ display: 'inline-block', transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
          <span>{title}</span>
        </button>
        {open && actions}
      </div>
      {open && children}
    </div>
  );
}
