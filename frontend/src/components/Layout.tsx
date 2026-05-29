import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../lib/types';
import { RoleBadge } from './RoleBadge';
import { AIChatPanel } from './AIChatPanel';
import { OnboardingWizard } from './OnboardingWizard';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { ErrorBoundary } from './ErrorBoundary';

type Theme = 'dark' | 'light' | 'system';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  page: string;
}

interface AppNotification {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  detail: string;
  action: string;
  page: string;
  ts: number;
}


interface NavItem {
  key: string;
  label: string;
  icon: string;
  minRole: UserRole;
}

interface NavCategory {
  category: string;
  icon: string;
  color: string;
  description: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    category: 'Home',
    icon: '⬡',
    color: '#0071bc',
    description: 'Dashboard & overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '⬡', minRole: 'trainee' },
      { key: 'ai-manager', label: 'AI Lab Manager', icon: '🤖', minRole: 'trainee' },
      { key: 'tasks', label: 'My Tasks', icon: '✓', minRole: 'trainee' },
      { key: 'reports', label: 'Reports & Analytics', icon: '📈', minRole: 'trainee' },
    ]
  },
  {
    category: 'Lab Hub',
    icon: '🔬',
    color: '#2563eb',
    description: 'Protocols, instruments & scheduling',
    items: [
      { key: 'lab-hub', label: 'Lab Hub Overview', icon: '🔬', minRole: 'trainee' },
      { key: 'protocols', label: 'Protocols / SOPs', icon: '📋', minRole: 'trainee' },
      { key: 'eln', label: 'Lab Notebook', icon: '📓', minRole: 'trainee' },
      { key: 'experiments', label: 'Experiments', icon: '🧫', minRole: 'trainee' },
      { key: 'equipment', label: 'Equipment', icon: '🔭', minRole: 'trainee' },
      { key: 'lab-meetings', label: 'LabHuddle (Video)', icon: '🎥', minRole: 'trainee' },
    ]
  },
  {
    category: 'Sample Hub',
    icon: '🧪',
    color: '#16a34a',
    description: 'Full sample lifecycle & storage',
    items: [
      { key: 'samples', label: 'Samples', icon: '🧪', minRole: 'trainee' },
      { key: 'freezer-biobank', label: 'Freezer / Biobank', icon: '🧊', minRole: 'trainee' },
      { key: 'label-printer', label: 'Label Printer', icon: '🏷️', minRole: 'trainee' },
    ]
  },
  {
    category: 'Grant Hub',
    icon: '📝',
    color: '#7c3aed',
    description: 'NIH & NSF grant management',
    items: [
      { key: 'grants', label: 'Grants Overview', icon: '📝', minRole: 'trainee' },
    ]
  },
  {
    category: 'Safety & Quality',
    icon: '🛡️',
    color: '#dc2626',
    description: 'GLP, compliance & training',
    items: [
      { key: 'incidents', label: 'Incidents', icon: '⚠️', minRole: 'trainee' },
      { key: 'reagent-hub', label: 'Reagents', icon: '⚗️', minRole: 'trainee' },
      { key: 'capa', label: 'CAPA', icon: '🔧', minRole: 'staff' },
      { key: 'training-cert', label: 'Training & Certs', icon: '🎓', minRole: 'trainee' },
    ]
  },
  {
    category: 'Resources',
    icon: '📦',
    color: '#d97706',
    description: 'Inventory, procurement & IoT sensors',
    items: [
      { key: 'inventory', label: 'Inventory', icon: '📦', minRole: 'trainee' },
      { key: 'iot-dashboard', label: 'Sensors (IoT)', icon: '🌡️', minRole: 'trainee' },
      { key: 'reagent-cart', label: 'Reagent Cart', icon: '🛒', minRole: 'trainee' },
      { key: 'procurement-hub', label: 'Procurement', icon: '🏛', minRole: 'staff' },
      { key: 'payment-methods', label: 'Payment Methods', icon: '💳', minRole: 'staff' },
    ]
  },
  {
    category: 'Admin',
    icon: '⚙️',
    color: '#64748b',
    description: 'Users, audit & settings',
    items: [
      { key: 'users', label: 'Users', icon: '👥', minRole: 'admin' },
      { key: 'lab-members', label: 'Lab Members (PI)', icon: '🔑', minRole: 'staff' },
      { key: 'org-hierarchy', label: 'Org & Sites', icon: '🏢', minRole: 'admin' },
      { key: 'audit', label: 'Audit Trail', icon: '🔍', minRole: 'admin' },
      { key: 'email-settings', label: 'Settings', icon: '⚙️', minRole: 'admin' },
    ]
  },
];

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const { user, logout, hasRole } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('labos_theme') as Theme) || 'dark');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('labos_dismissed_notifs') || '[]')); }
    catch { return new Set(); }
  });
  const [fabOpen, setFabOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('labos_onboarding_done'));
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // ── Convex: live summary for notifications ────────────────────────────
  const summary = useQuery(api.dashboard.summary);

  // ── Convex: search (debounced) ────────────────────────────────────────
  const searchResults = useQuery(
    api.search.globalSearch,
    debouncedQ.length >= 2 ? { q: debouncedQ } : 'skip'
  ) ?? [];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Derive notifications from live summary ─────────────────────────────
  const notifications = useMemo<AppNotification[]>(() => {
    if (!summary) return [];
    const built: AppNotification[] = [];
    const now = Date.now();
    const overdue = (summary as any).overdue_reminders ?? 0;
    const pending = (summary as any).reminders_pending ?? 0;
    const quarantine = (summary as any).quarantine_samples ?? 0;
    const lowStock = (summary as any).low_stock_items ?? 0;

    if (overdue > 0) built.push({ id: 'reminders-overdue', type: 'danger', icon: '⏰', title: `${overdue} overdue reminder${overdue > 1 ? 's' : ''}`, detail: 'Past due — action needed', action: 'View Reminders →', page: 'reminders', ts: now });
    if (pending > overdue) built.push({ id: 'reminders-pending', type: 'warning', icon: '🔔', title: `${pending - overdue} pending reminder${pending - overdue > 1 ? 's' : ''}`, detail: 'Scheduled — review soon', action: 'View Reminders →', page: 'reminders', ts: now });
    if (summary.overdue_tasks > 0) built.push({ id: 'tasks-overdue', type: 'danger', icon: '📋', title: `${summary.overdue_tasks} overdue task${summary.overdue_tasks > 1 ? 's' : ''}`, detail: 'Past due — action needed', action: 'Go to Tasks →', page: 'tasks', ts: now });
    if (quarantine > 0) built.push({ id: 'samples-quarantine', type: 'danger', icon: '🧪', title: `${quarantine} sample${quarantine > 1 ? 's' : ''} in quarantine`, detail: 'Requires immediate review', action: 'View Samples →', page: 'samples', ts: now });
    if (lowStock > 0) built.push({ id: 'inventory-low', type: 'warning', icon: '📦', title: `${lowStock} item${lowStock > 1 ? 's' : ''} low on stock`, detail: 'Reorder recommended', action: 'View Resources →', page: 'inventory', ts: now });

    const grantDeadlines: any[] = (summary as any).grant_deadlines ?? [];
    if (grantDeadlines.length > 0) {
      const soonest = grantDeadlines[0];
      const daysLeft = soonest.deadline_date ? Math.ceil((new Date(soonest.deadline_date).getTime() - now) / 86400000) : 99;
      built.push({ id: 'grants-deadline', type: daysLeft <= 7 ? 'danger' : 'warning', icon: '📝', title: `Grant deadline in ${daysLeft}d: ${soonest.title?.slice(0, 30) || 'Untitled'}`, detail: `${grantDeadlines.length} grant${grantDeadlines.length > 1 ? 's' : ''} due within 30 days`, action: 'Grant Hub →', page: 'grants', ts: now });
    }

    if (built.length === 0) built.push({ id: 'all-clear', type: 'success', icon: '✅', title: 'All clear', detail: 'No pending issues', action: '', page: '', ts: now });
    return built;
  }, [summary]);

  const FAB_ACTIONS = [
    { icon: '🧪', label: 'New Sample', page: 'samples', color: '#6366f1' },
    { icon: '✓', label: 'Create Task', page: 'tasks', color: '#22c55e' },
    { icon: '📋', label: 'New Protocol', page: 'protocols', color: '#f59e0b' },
    { icon: '⚠', label: 'Report Incident', page: 'incidents', color: '#ef4444' },
  ];


  const unreadCount = notifications.filter(n => n.id !== 'all-clear' && !dismissedIds.has(n.id)).length;
  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('labos_dismissed_notifs', JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('labos_theme', theme);
  }, [theme]);

  const THEME_OPTIONS: { value: Theme; icon: string; label: string }[] = [
    { value: 'dark', icon: '🌙', label: 'Dark' },
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'system', icon: '💻', label: 'System' },
  ];

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('labos_collapsed_categories');
    if (saved) return new Set(JSON.parse(saved));
    return new Set(NAV_CATEGORIES.map(c => c.category));
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      localStorage.setItem('labos_collapsed_categories', JSON.stringify([...next]));
      return next;
    });
  };

  const visibleCategories = NAV_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(item => hasRole(item.minRole))
  })).filter(cat => cat.items.length > 0);

  const pageTitle = NAV_CATEGORIES.flatMap(c => c.items).find(i => i.key === activePage)?.label || 'Dashboard';
  const activeCategory = NAV_CATEGORIES.find(c => c.items.some(i => i.key === activePage));
  const canGoBack = activePage !== 'dashboard';

  const PAGE_PARENT: Record<string, string> = {
    'protocols': 'lab-hub', 'eln': 'lab-hub', 'experiments': 'lab-hub',
    'equipment': 'lab-hub', 'lab-meetings': 'lab-hub',
    'freezer-biobank': 'samples', 'label-printer': 'samples',
    'incidents': 'dashboard', 'reagent-hub': 'incidents', 'capa': 'incidents', 'training-cert': 'incidents',
    'iot-dashboard': 'inventory', 'reagent-cart': 'inventory', 'procurement-hub': 'inventory', 'payment-methods': 'inventory',
    'audit': 'users', 'org-hierarchy': 'users', 'email-settings': 'users', 'lab-members': 'users',
  };

  const handleBack = () => {
    const parent = PAGE_PARENT[activePage];
    onNavigate(parent ?? 'dashboard');
  };

  return (
    <div className="app-shell">
      <ErrorBoundary fallback={() => null}><PWAInstallPrompt /></ErrorBoundary>
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="sidebar-brand sidebar-brand-button"
          onClick={() => { onNavigate('dashboard'); setSidebarOpen(false); }}
          title="Go to Dashboard"
          aria-label="Go to Dashboard"
        >
          <span className="brand-icon">⬡</span>
          <span className="brand-name">LabOS <span className="brand-version">v3</span></span>
          <span className="brand-home-hint" aria-hidden="true">🏠</span>
        </button>
        <nav className="sidebar-nav">
          {visibleCategories.map((cat) => {
            const isHubActive = cat.items.some(item => item.key === activePage);
            const isCollapsed = collapsedCategories.has(cat.category);
            return (
              <div
                key={cat.category}
                className={`nav-category ${isHubActive ? 'hub-active' : ''}`}
                style={{ '--hub-color': cat.color } as React.CSSProperties}
              >
                <button
                  className={`nav-category-header ${isHubActive ? 'hub-header-active' : ''}`}
                  onClick={() => toggleCategory(cat.category)}
                >
                  <div className="hub-icon-box" style={{ background: `${cat.color}22`, color: cat.color }}>
                    {cat.icon}
                  </div>
                  <div className="hub-header-text">
                    <span className="hub-name">{cat.category}</span>
                    <span className="hub-desc">{cat.description}</span>
                  </div>
                  <span className={`nav-category-chevron ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
                </button>
                {!isCollapsed && (
                  <div className="nav-category-items">
                    {cat.items.map((item) => (
                      <button
                        key={item.key}
                        className={`nav-item ${activePage === item.key ? 'active' : ''}`}
                        onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {/* Theme toggle */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Theme</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {THEME_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setTheme(opt.value)} title={opt.label} style={{
                  flex: 1, background: theme === opt.value ? 'var(--accent)' : 'var(--surface2)',
                  border: `1px solid ${theme === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 6, color: theme === opt.value ? '#fff' : 'var(--text-muted)',
                  padding: '5px 4px', cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
                }}>
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>

          {user && (
            <div className="user-info">
              <div className="user-avatar">{(user.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <div className="user-name">{user.full_name ?? user.email}</div>
                <RoleBadge role={user.role} />
              </div>
            </div>
          )}
          <button className="btn btn-secondary btn-sm logout-btn" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        {/* Global Header with Search and Notifications */}
        <header className="global-header">
          {/* Hamburger Menu Button */}
          <button
            className="hamburger-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {/* Back Arrow and Page Title */}
          <div className="header-title">
            {canGoBack && (
              <button className="back-arrow" onClick={handleBack} aria-label="Go back" title="Go back">
                ←
              </button>
            )}
            <div className="header-title-stack">
              {activeCategory && activePage !== 'dashboard' && (
                <span className="header-breadcrumb" style={{ color: activeCategory.color }}>
                  {activeCategory.icon} {activeCategory.category}
                </span>
              )}
              <h1>{pageTitle}</h1>
            </div>
          </div>

          {/* Header Actions */}
          <div className="header-actions">
            {/* Global Search */}
            <div ref={searchRef} className="global-search-wrapper">
              <div
                className="global-search-trigger"
                onClick={() => setSearchOpen(true)}
              >
                <span className="search-icon">🔍</span>
                <span className="search-placeholder">Search... <kbd>⌘K</kbd></span>
              </div>

              {searchOpen && (
                <div className="global-search-modal">
                  <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search samples, protocols, instruments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searchQuery && (
                      <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
                    )}
                  </div>
                  {searchQuery.length >= 2 && (
                    <div className="search-results">
                      {searchResults === undefined ? (
                        <div className="search-no-results">Searching...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="search-no-results">No results found for "{searchQuery}"</div>
                      ) : (
                        searchResults.map(result => (
                          <div
                            key={result.id}
                            className="search-result-item"
                            onClick={() => { onNavigate(result.page); setSearchOpen(false); setSearchQuery(''); }}
                          >
                            <span className="result-icon">{result.icon}</span>
                            <div className="result-content">
                              <div className="result-title">{result.title}</div>
                              <div className="result-subtitle">{result.type} • {result.subtitle}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Chat Toggle */}
            <button
              onClick={() => setAiChatOpen(v => !v)}
              title="AI Lab Assistant"
              style={{
                background: aiChatOpen ? 'var(--accent)' : 'var(--surface2)',
                border: `1px solid ${aiChatOpen ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, width: 38, height: 38, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'all 0.15s',
                color: aiChatOpen ? '#fff' : 'var(--text)',
              }}
            >🤖</button>

            {/* Notifications */}
            <div ref={notifRef} className="notifications-wrapper">
              <button
                className="notifications-trigger"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <span>🔔</span>
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>

              {notificationsOpen && (
                <div className="notifications-dropdown notifications-panel">
                  <div className="notifications-header">
                    <span className="notifications-title">
                      Notifications
                      {unreadCount > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{unreadCount}</span>}
                    </span>
                    <button className="mark-all-read" onClick={() => {
                      notifications.forEach(n => { if (n.id !== 'all-clear') dismissNotification(n.id); });
                    }}>Dismiss all</button>
                  </div>
                  <div className="notifications-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {visibleNotifications.map(notif => (
                      <div key={notif.id} className={`notification-item ${notif.id === 'all-clear' ? 'read' : 'unread'}`}
                        style={{ position: 'relative', paddingRight: 28 }}>
                        <div className={`notification-dot ${notif.type === 'danger' ? 'danger' : notif.type === 'warning' ? 'warning' : notif.type === 'success' ? 'success' : ''}`} />
                        <div className="notification-content" style={{ flex: 1 }}>
                          <div className="notification-message">
                            <span style={{ marginRight: 6 }}>{notif.icon}</span>
                            {notif.title}
                          </div>
                          <div className="notification-time">{notif.detail}</div>
                          {notif.action && notif.page && (
                            <button
                              onClick={() => { onNavigate(notif.page); setNotificationsOpen(false); }}
                              style={{
                                marginTop: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                                border: 'none', borderRadius: 6, cursor: 'pointer',
                                background: notif.type === 'danger' ? 'rgba(239,68,68,0.15)' : notif.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                                color: notif.type === 'danger' ? '#f87171' : notif.type === 'warning' ? '#fbbf24' : '#818cf8',
                              }}
                            >
                              {notif.action}
                            </button>
                          )}
                        </div>
                        {notif.id !== 'all-clear' && (
                          <button
                            onClick={() => dismissNotification(notif.id)}
                            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                            title="Dismiss"
                          >×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="notifications-footer">
                    <button onClick={() => { setDismissedIds(new Set()); localStorage.removeItem('labos_dismissed_notifs'); }}>↻ Refresh</button>
                    <button onClick={() => { onNavigate('reminders'); setNotificationsOpen(false); }}>All reminders →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-container">
          {children}
        </div>

        {/* Floating Quick-Add Button */}
        <div ref={fabRef} className="floating-action-button" style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1000 }}>
          {fabOpen && (
            <div style={{
              position: 'absolute', bottom: 64, right: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
              alignItems: 'flex-end',
            }}>
              {FAB_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => { onNavigate(action.page); setFabOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--surface)',
                    border: `1px solid ${action.color}50`,
                    borderRadius: 10,
                    padding: '9px 14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(-4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${action.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setFabOpen(v => !v)}
            style={{
              width: 52, height: 52,
              borderRadius: '50%',
              background: fabOpen ? '#ef4444' : 'var(--accent)',
              border: 'none',
              color: '#fff',
              fontSize: fabOpen ? 22 : 28,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s, transform 0.2s',
              transform: fabOpen ? 'rotate(45deg)' : 'none',
            }}
            title="Quick actions"
            aria-label="Quick actions"
          >
            {fabOpen ? '×' : '+'}
          </button>
        </div>

        {/* AI Chat Panel */}
        {aiChatOpen && <AIChatPanel onClose={() => setAiChatOpen(false)} />}

        {/* Onboarding Wizard */}
        {showOnboarding && (
          <OnboardingWizard onClose={() => {
            localStorage.setItem('labos_onboarding_done', '1');
            setShowOnboarding(false);
          }} />
        )}

        {/* Professional NIH-Style Footer */}
        <footer className="app-footer">
          <div className="footer-accent-stripe" />
          <div className="footer-main">
            {/* Brand column */}
            <div className="footer-column footer-brand-col">
              <div className="footer-logo-area">
                <div className="footer-logo">⬡</div>
                <div>
                  <h3 className="footer-product-name">LabOS <span>v3</span></h3>
                  <p className="footer-tagline">Laboratory Operations System</p>
                </div>
              </div>
              <p className="footer-description">
                Professional lab management platform for research institutions — protocols, samples, compliance, and operations in one system.
              </p>
              <div className="footer-status">
                <span className="footer-status-dot" />
                All systems operational
              </div>
            </div>

            {/* Navigation column */}
            <div className="footer-column">
              <h4 className="footer-col-title">Navigation</h4>
              <div className="footer-links">
                <span className="footer-link" onClick={() => onNavigate('dashboard')}>Dashboard</span>
                <span className="footer-link" onClick={() => onNavigate('protocols')}>Lab Hub</span>
                <span className="footer-link" onClick={() => onNavigate('samples')}>Sample Hub</span>
                <span className="footer-link" onClick={() => onNavigate('grants')}>Grant Hub</span>
                <span className="footer-link" onClick={() => onNavigate('reports')}>Reports & Analytics</span>
              </div>
            </div>

            {/* Compliance column */}
            <div className="footer-column">
              <h4 className="footer-col-title">Compliance</h4>
              <div className="footer-links">
                <span className="footer-link" onClick={() => onNavigate('incidents')}>Safety Hub</span>
                <span className="footer-link" onClick={() => onNavigate('compliance')}>Compliance</span>
                <span className="footer-link" onClick={() => onNavigate('audit')}>Audit Trail</span>
                <span className="footer-link" onClick={() => onNavigate('training')}>Training Records</span>
                <span className="footer-link" onClick={() => onNavigate('feedback')}>Support</span>
              </div>
            </div>

            {/* Standards column */}
            <div className="footer-column">
              <h4 className="footer-col-title">Standards Supported</h4>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                Designed to support these workflows — compliance achieved through your institutional practices.
              </div>
              <div className="footer-badges-grid">
                <span className="footer-badge">GLP Workflows</span>
                <span className="footer-badge">21 CFR Part 11</span>
                <span className="footer-badge">HIPAA-Ready</span>
                <span className="footer-badge">GDPR Tools</span>
                <span className="footer-badge">Audit Trail</span>
                <span className="footer-badge">On-Premise</span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="footer-bottom">
            <span className="footer-copyright">© {new Date().getFullYear()} LabOS. All rights reserved. v3.0.0</span>
            <span className="footer-divider">|</span>
            <span className="footer-legal" style={{ cursor: 'pointer' }} onClick={() => onNavigate('privacy-center')}>Privacy Center</span>
            <span className="footer-divider">|</span>
            <span className="footer-legal" style={{ cursor: 'pointer' }} onClick={() => onNavigate('privacy-center')}>Terms of Use</span>
            <span className="footer-divider">|</span>
            <span className="footer-legal" style={{ cursor: 'pointer' }} onClick={() => onNavigate('privacy-center')}>Security</span>
          </div>
        </footer>
      </main>

      {/* Mobile bottom navigation */}
      {moreDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 1099,
            }}
            onClick={() => setMoreDrawerOpen(false)}
          />
          {/* Slide-up drawer */}
          <div
            style={{
              position: 'fixed', bottom: 60, left: 0, right: 0,
              background: 'var(--surface)',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.25)',
              zIndex: 1100,
              maxHeight: '70vh',
              overflowY: 'auto',
              padding: '12px 0 8px',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <div style={{ paddingBottom: 8 }}>
              {visibleCategories.map(cat => (
                <div key={cat.category}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '8px 20px 4px',
                  }}>
                    {cat.icon} {cat.category}
                  </div>
                  {cat.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => { onNavigate(item.key); setMoreDrawerOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 20px',
                        background: activePage === item.key ? 'rgba(99,102,241,0.12)' : 'transparent',
                        color: activePage === item.key ? '#6366f1' : 'var(--text)',
                        border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: activePage === item.key ? 700 : 400,
                      }}
                    >
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{item.icon}</span>
                      <span>{item.label}</span>
                      {activePage === item.key && (
                        <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="mobile-nav">
        {[
          { key: 'dashboard', icon: '⬡',  label: 'Home' },
          { key: 'tasks',     icon: '✓',  label: 'Tasks' },
          { key: 'samples',   icon: '🧪', label: 'Samples' },
          { key: 'incidents', icon: '⚠️', label: 'Safety' },
        ].map(item => (
          <button
            key={item.key}
            className={`mobile-nav-item ${activePage === item.key ? 'active' : ''}`}
            onClick={() => { onNavigate(item.key); setMoreDrawerOpen(false); }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          className={`mobile-nav-item ${moreDrawerOpen ? 'active' : ''}`}
          onClick={() => setMoreDrawerOpen(v => !v)}
        >
          <span className="nav-icon">☰</span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
