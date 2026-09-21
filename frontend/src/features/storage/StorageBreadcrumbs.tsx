export interface Crumb {
  id: string | null; // null = the storage unit itself
  name: string;
}

interface StorageBreadcrumbsProps {
  crumbs: Crumb[];
  onNavigate: (id: string | null) => void;
}

export function StorageBreadcrumbs({ crumbs, onNavigate }: StorageBreadcrumbsProps) {
  return (
    <nav aria-label="Storage location breadcrumb" style={{ fontSize: 13, marginBottom: 12 }}>
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.id ?? 'root'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>/</span>}
              {isLast ? (
                <span style={{ fontWeight: 600 }} aria-current="location">{crumb.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontSize: 13 }}
                >
                  {crumb.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
