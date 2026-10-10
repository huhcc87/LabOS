import type { ApprovalMode, ProtocolApproval } from '../lib/protocolApproval';

export interface ProtocolDetails {
  duration?: string;
  materials?: string;
  steps?: string;
  safety?: string;
  approval?: ProtocolApproval;
}

interface Props {
  value: ProtocolDetails;
  onChange: (patch: Partial<ProtocolDetails>) => void;
}

const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-soft)' };
const group: React.CSSProperties = { marginBottom: 16 };
const area: React.CSSProperties = { resize: 'vertical', fontFamily: 'inherit' };

/** Simple protocol detail fields + optional approval, shared by the create and edit forms. */
export function ProtocolFormFields({ value, onChange }: Props) {
  const approval = value.approval;

  const setMode = (mode: ApprovalMode | '') => {
    if (!mode) return onChange({ approval: undefined });
    // Changing who approves restarts the approval.
    onChange({ approval: { mode, approver: approval?.approver, state: 'pending' } });
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, ...group }}>
        <div>
          <label style={label}>Duration</label>
          <input className="form-input" placeholder="e.g. 2 hours" value={value.duration ?? ''} onChange={e => onChange({ duration: e.target.value })} />
        </div>
        <div>
          <label style={label}>Approval (optional)</label>
          <select className="form-select" value={approval?.mode ?? ''} onChange={e => setMode(e.target.value as ApprovalMode | '')}>
            <option value="">Not required</option>
            <option value="pi">Any PI approves</option>
            <option value="user">A specific PI approves</option>
          </select>
        </div>
      </div>

      {approval && (
        <div style={group}>
          <label style={label}>{approval.mode === 'user' ? 'PI name or email *' : 'PI name (optional)'}</label>
          <input
            className="form-input"
            placeholder={approval.mode === 'user' ? 'Which PI must approve?' : 'Any PI account can approve'}
            value={approval.approver ?? ''}
            onChange={e => onChange({ approval: { ...approval, approver: e.target.value, state: 'pending', decidedBy: undefined, decidedAt: undefined } })}
          />
        </div>
      )}

      <div style={group}>
        <label style={label}>Materials</label>
        <textarea className="form-input" rows={3} placeholder="One per line, e.g. PBS 10 mL" value={value.materials ?? ''} onChange={e => onChange({ materials: e.target.value })} style={area} />
      </div>
      <div style={group}>
        <label style={label}>Steps</label>
        <textarea className="form-input" rows={6} placeholder={'One step per line, e.g.\n1. Add buffer\n2. Incubate 30 min'} value={value.steps ?? ''} onChange={e => onChange({ steps: e.target.value })} style={area} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Times like "30 min" get an automatic timer when you run the protocol.</div>
      </div>
      <div style={group}>
        <label style={label}>Safety notes</label>
        <textarea className="form-input" rows={2} placeholder="PPE, hazards, waste disposal..." value={value.safety ?? ''} onChange={e => onChange({ safety: e.target.value })} style={area} />
      </div>
    </>
  );
}
