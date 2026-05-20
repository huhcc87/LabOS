import { useState } from 'react';
import { useNavigate } from '../context/NavigationContext';

const STEPS = [
  {
    icon: '🎉',
    title: 'Welcome to LabOS v2',
    subtitle: 'The all-in-one research lab management system built for scientists',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { icon: '📋', label: 'Protocols & ELN', desc: 'Manage, execute, and log every experiment' },
          { icon: '🧪', label: 'Sample Biorepository', desc: 'Full chain-of-custody sample tracking' },
          { icon: '📦', label: 'Smart Inventory', desc: 'AI-powered reorder predictions' },
          { icon: '📝', label: 'AI Grant Writing', desc: 'Draft NIH/NSF sections in seconds' },
          { icon: '🛡️', label: 'Safety & Compliance', desc: '21 CFR Part 11, GLP, ISO 17025 built-in' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10 }}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
    cta: "Let's get started →",
  },
  {
    icon: '📦',
    title: 'Set up your Inventory',
    subtitle: 'Add your reagents, chemicals, and antibodies to track stock levels',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1', marginBottom: 6 }}>💡 Pro tip</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>You can bulk import your existing Excel/CSV inventory from the Resources Hub. Or add items one by one using the "+" button.</div>
        </div>
        {[
          { step: '1', text: 'Go to Resources Hub → Inventory tab' },
          { step: '2', text: 'Click "+ Add Item" to add reagents, chemicals, antibodies' },
          { step: '3', text: 'Set reorder thresholds to get low-stock alerts automatically' },
          { step: '4', text: 'Add storage locations to use the visual Storage Map' },
        ].map(s => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{s.step}</div>
            <div style={{ fontSize: 14, paddingTop: 4, color: 'var(--text)' }}>{s.text}</div>
          </div>
        ))}
      </div>
    ),
    cta: 'Next →',
    page: 'inventory',
    pageLabel: 'Open Inventory Now',
  },
  {
    icon: '🧪',
    title: 'Register your Samples',
    subtitle: 'Track samples from collection to analysis with full chain-of-custody',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#22c55e', marginBottom: 6 }}>🧬 Biorepository ready</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>LabOS generates unique barcodes for every sample. Each sample has a full audit trail — who created it, stored it, processed it.</div>
        </div>
        {['Register samples in Sample Hub', 'Assign storage locations and barcodes', 'Log processing events (aliquot, freeze, ship)', 'Search and filter by type, status, or date'].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 14 }}>{s}</span>
          </div>
        ))}
      </div>
    ),
    cta: 'Next →',
    page: 'samples',
    pageLabel: 'Open Sample Hub',
  },
  {
    icon: '👥',
    title: 'Invite your Team',
    subtitle: 'Add team members and assign roles to control what they can see and do',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { role: 'PI', desc: 'Full read access, approve protocols', color: '#8b5cf6' },
            { role: 'Manager', desc: 'Manage inventory, tasks, and reminders', color: '#6366f1' },
            { role: 'Staff', desc: 'Create samples, run protocols', color: '#22c55e' },
            { role: 'Trainee', desc: 'View protocols and log training', color: '#06b6d4' },
          ].map(r => (
            <div key={r.role} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${r.color}` }}>
              <div style={{ fontWeight: 700, color: r.color, marginBottom: 4 }}>{r.role}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Go to Admin Hub → Users to create team accounts</div>
      </div>
    ),
    cta: 'Next →',
    page: 'users',
    pageLabel: 'Open User Management',
  },
  {
    icon: '🚀',
    title: "You're all set!",
    subtitle: 'LabOS is ready to supercharge your research. Here are your next steps:',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: '📓', text: 'Open Lab Notebook and log your first experiment', page: 'lab-notebook' },
          { icon: '📋', text: 'Create a protocol and try execution mode', page: 'protocols' },
          { icon: '📝', text: 'Draft a grant section with AI assistance', page: 'grants' },
          { icon: '🏪', text: 'Browse 70+ biomedical suppliers in the directory', page: 'suppliers' },
          { icon: '🗺️', text: 'Map your lab storage in the Storage Map', page: 'storage-map' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10 }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{item.text}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
          </div>
        ))}
      </div>
    ),
    cta: "Let's go! 🎉",
  },
];

export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleCta() {
    if (isLast) { onClose(); } else { setStep(s => s + 1); }
  }

  function handleDismiss() {
    localStorage.setItem('labos_onboarding_done', '1');
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        {/* Progress */}
        <div style={{ height: 3, background: 'var(--surface2)' }}>
          <div style={{ height: '100%', background: 'var(--accent)', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.3s ease' }} />
        </div>

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? 'var(--accent)' : i < step ? '#22c55e' : 'var(--surface2)', transition: 'all 0.3s' }} />
              ))}
            </div>
            <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              Skip setup
            </button>
          </div>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{current.icon}</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{current.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{current.subtitle}</p>
          </div>

          {/* Content */}
          <div style={{ marginBottom: 24 }}>{current.content}</div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <button onClick={handleCta} style={{ width: '100%', background: isLast ? '#22c55e' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {current.cta}
            </button>
            {(current as any).page && (
              <button onClick={() => { navigate((current as any).page); handleDismiss(); }}
                style={{ width: '100%', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {(current as any).pageLabel}
              </button>
            )}
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>← Back</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
