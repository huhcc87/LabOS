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
import { GlobalSearch } from './GlobalSearch';

type Theme = 'dark' | 'light' | 'system';

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

interface NavSection {
  key: string;
  label: string;
  icon: string;
  minRole: UserRole;
  items: NavItem[];
}

// Rail-first navigation: 6 sections, max 5 items each. Everything else stays
// reachable via ⌘K search and the hub pages — it is not crammed into the rail.
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'home',
    label: 'Home',
    icon: '⌂',
    minRole: 'trainee',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '⌂', minRole: 'trainee' },
      { key: 'tasks', label: 'My tasks', icon: '✓', minRole: 'trainee' },
      { key: 'reports', label: 'Reports', icon: '📈', minRole: 'trainee' },
    ],
  },
  {
    key: 'notebook',
    label: 'Notebook',
    icon: '📓',
    minRole: 'trainee',
    items: [
      { key: 'eln', label: 'Notebooks', icon: '📓', minRole: 'trainee' },
      { key: 'protocols', label: 'Protocols', icon: '📋', minRole: 'trainee' },
      { key: 'experiments', label: 'Experiments', icon: '🧫', minRole: 'trainee' },
      { key: 'documents', label: 'Documents', icon: '📄', minRole: 'trainee' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: '🧊',
    minRole: 'trainee',
    items: [
      { key: 'freezer-biobank', label: 'Freezers', icon: '🧊', minRole: 'trainee' },
      { key: 'storage-browser', label: 'Storage Hierarchy', icon: '🗄️', minRole: 'trainee' },
      { key: 'inventory', label: 'Consumables', icon: '📦', minRole: 'trainee' },
      { key: 'samples', label: 'Samples', icon: '🧪', minRole: 'trainee' },
      { key: 'procurement-hub', label: 'Orders', icon: '🛒', minRole: 'trainee' },
      { key: 'iot-dashboard', label: 'Stock tracker', icon: '🌡️', minRole: 'trainee' },
    ],
  },
  {
    key: 'core',
    label: 'Core',
    icon: '🔬',
    minRole: 'trainee',
    items: [
      { key: 'calendar', label: 'Schedules', icon: '📅', minRole: 'trainee' },
      { key: 'equipment', label: 'Equipment', icon: '🔭', minRole: 'trainee' },
      { key: 'bookings', label: 'Reservations', icon: '🗓', minRole: 'trainee' },
    ],
  },
  {
    key: 'grants',
    label: 'Grants',
    icon: '📝',
    minRole: 'trainee',
    items: [
      { key: 'grants', label: 'Grants', icon: '📝', minRole: 'trainee' },
      { key: 'funding-opportunities', label: 'Funding', icon: '🔎', minRole: 'trainee' },
      { key: 'grant-budget', label: 'Budget', icon: '💰', minRole: 'trainee' },
      { key: 'grant-calendar', label: 'Deadlines', icon: '⏰', minRole: 'trainee' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: '⚙',
    minRole: 'trainee',
    items: [
      { key: 'incidents', label: 'Safety', icon: '⚠️', minRole: 'trainee' },
      { key: 'training-cert', label: 'Training', icon: '🎓', minRole: 'trainee' },
      { key: 'users', label: 'Members', icon: '👥', minRole: 'admin' },
      { key: 'audit', label: 'Audit trail', icon: '🔍', minRole: 'admin' },
      { key: 'email-settings', label: 'Settings', icon: '⚙️', minRole: 'admin' },
    ],
  },
];

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const { user, logout, hasRole } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('labos_theme') as Theme) || 'light');
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
  const notifRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // ── Convex: live summary for notifications ────────────────────────────
  const summary = useQuery(api.dashboard.summary);

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
      if (e.key === 'Escape') {
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

  const visibleSections = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(item => hasRole(item.minRole)),
  })).filter(sec => sec.items.length > 0);

  // The rail section that owns the current page (falls back to the first).
  const activeSection =
    visibleSections.find(sec => sec.items.some(i => i.key === activePage)) ?? visibleSections[0];

  // Which section's sub-nav is shown — follows the active page, but the user
  // can browse another section's items without navigating away first.
  const [openSectionKey, setOpenSectionKey] = useState<string>(activeSection?.key ?? 'home');
  useEffect(() => {
    const owner = NAV_SECTIONS.find(sec => sec.items.some(i => i.key === activePage));
    if (owner) setOpenSectionKey(owner.key);
  }, [activePage]);

  const openSection = visibleSections.find(sec => sec.key === openSectionKey) ?? activeSection;

  const pageTitle = NAV_SECTIONS.flatMap(s => s.items).find(i => i.key === activePage)?.label || 'Dashboard';
  const activeCategory = activeSection
    ? { category: activeSection.label, icon: activeSection.icon, color: 'var(--accent)' }
    : undefined;
  const canGoBack = activePage !== 'dashboard';

  const PAGE_PARENT: Record<string, string> = {
    'protocols': 'lab-hub', 'eln': 'lab-hub', 'experiments': 'lab-hub',
    'equipment': 'lab-hub', 'lab-meetings': 'lab-hub',
    'freezer-biobank': 'samples', 'label-printer': 'samples', 'storage-browser': 'inventory',
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
      <aside className={`sidebar rail-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Icon rail — one click to any area */}
        <nav className="nav-rail" aria-label="Main sections">
          <button
            type="button"
            className="rail-brand"
            onClick={() => { onNavigate('dashboard'); setSidebarOpen(false); }}
            title="LabOS home"
            aria-label="LabOS home"
          >
            L
          </button>
          {visibleSections.map(sec => (
            <button
              key={sec.key}
              className={`rail-item ${activeSection?.key === sec.key ? 'active' : ''}`}
              onClick={() => {
                setOpenSectionKey(sec.key);
                onNavigate(sec.items[0].key);
                setSidebarOpen(false);
              }}
              title={sec.label}
              aria-label={sec.label}
              aria-current={activeSection?.key === sec.key ? 'page' : undefined}
            >
              <span className="rail-icon" aria-hidden="true">{sec.icon}</span>
              <span className="rail-label">{sec.label}</span>
            </button>
          ))}
          <div className="rail-spacer" />
          {user && (
            <button
              className="rail-item rail-account"
              onClick={logout}
              title={`${user.full_name ?? user.email} — log out`}
              aria-label="Account"
            >
              <span className="rail-avatar" aria-hidden="true">
                {(user.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
              </span>
              <span className="rail-label">Account</span>
            </button>
          )}
        </nav>

        {/* Sub-nav for the open section */}
        <div className="nav-subnav">
          <div className="subnav-title">{openSection?.label}</div>
          <div className="subnav-items">
            {openSection?.items.map(item => (
              <button
                key={item.key}
                className={`subnav-item ${activePage === item.key ? 'active' : ''}`}
                onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                aria-current={activePage === item.key ? 'page' : undefined}
              >
                <span className="subnav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="subnav-footer">
            <div className="theme-row" role="group" aria-label="Theme">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={theme === opt.value}
                  className={`theme-btn ${theme === opt.value ? 'active' : ''}`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
            {user && <RoleBadge role={user.role} />}
          </div>
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
            <GlobalSearch onNavigate={onNavigate} />

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
              {visibleSections.map(cat => (
                <div key={cat.key}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '8px 20px 4px',
                  }}>
                    {cat.icon} {cat.label}
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
