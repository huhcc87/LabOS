interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 24px',
      color: 'var(--text-muted, #64748b)',
      background: 'var(--surface, #fff)',
      borderRadius: 12,
      border: '1px dashed var(--border, #e2e8f0)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text, #0f172a)', marginBottom: 8 }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 20px' }}>
          {description}
        </p>
      )}
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
