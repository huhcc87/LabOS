import { useState } from 'react';
import LabNotebookPage from './LabNotebookPage';
import ELNPage from './ELNPage';

/** One notebook: signed entries (saved for the lab) and the experiment-record tools, in two tabs. */
export default function NotebookHubPage() {
  const [tab, setTab] = useState<'entries' | 'records'>('entries');
  return (
    <div>
      <div role="tablist" aria-label="Lab notebook" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['entries', 'Entries & signatures'], ['records', 'Experiment records']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', background: 'none', border: 0, cursor: 'pointer', fontSize: 14, marginBottom: -1,
            borderBottom: `2px solid ${tab === k ? 'var(--accent)' : 'transparent'}`,
            color: tab === k ? 'var(--accent)' : 'var(--text-muted)', fontWeight: tab === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>
      {tab === 'entries' ? <LabNotebookPage /> : <ELNPage />}
    </div>
  );
}
