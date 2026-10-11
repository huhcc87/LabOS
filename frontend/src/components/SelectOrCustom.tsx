import { useState } from 'react';

const CUSTOM = '__custom__';

/** A dropdown with a "+ Custom…" choice that switches to a text box. */
export function SelectOrCustom({ value, options, onChange, noneLabel, id, label, style }: {
  value: string; options: string[]; onChange: (v: string) => void; noneLabel?: string;
  id?: string; label?: string; style?: React.CSSProperties;
}) {
  const [typing, setTyping] = useState(() => !!value && !options.includes(value));
  if (typing) {
    return (
      <div style={{ display: 'flex', gap: 6, ...style }}>
        <input id={id} aria-label={label} className="form-input" autoFocus placeholder="Type your own…" value={value}
          onChange={e => onChange(e.target.value)} style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm btn-secondary" title="Back to the list"
          onClick={() => { setTyping(false); onChange(noneLabel !== undefined ? '' : options[0] ?? ''); }}>↩ List</button>
      </div>
    );
  }
  return (
    <select id={id} aria-label={label} className="form-select" style={{ width: '100%', ...style }} value={value}
      onChange={e => { if (e.target.value === CUSTOM) { setTyping(true); onChange(''); } else onChange(e.target.value); }}>
      {noneLabel !== undefined && <option value="">{noneLabel}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={CUSTOM}>+ Custom…</option>
    </select>
  );
}
