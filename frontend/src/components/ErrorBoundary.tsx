import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught error:', error, info);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: 'var(--bg, #f8fafc)',
        }}>
          <div style={{
            maxWidth: 520, width: '100%', background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted, #64748b)', marginBottom: 20, lineHeight: 1.6 }}>
              The app hit an unexpected error. Your data is safe — try reloading the page, or click below to recover.
            </p>
            {import.meta.env.DEV && (
              <pre style={{
                fontSize: 11, background: 'var(--surface2, #f1f5f9)', padding: 12,
                borderRadius: 6, overflow: 'auto', maxHeight: 160, marginBottom: 16,
                color: '#dc2626',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={this.reset}
                style={{
                  padding: '10px 18px', background: 'var(--accent, #6366f1)', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 18px', background: 'var(--surface2, #f1f5f9)', color: 'var(--text, #0f172a)',
                  border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
