import { useState, lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationContext } from './context/NavigationContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsent } from './components/CookieConsent';
import { setupSkipToContent } from './lib/a11y';
import { trackPageView } from './lib/analytics';

// Always-eager: login + dashboard shown immediately on load
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// All other pages — lazy loaded on first navigation (splits main bundle)
const LabHubPage             = lazy(() => import('./pages/LabHubPage'));
const SampleHubPage          = lazy(() => import('./pages/SampleHubPage'));
const ResourcesHubPage       = lazy(() => import('./pages/ResourcesHubPage'));
const GrantHubPage           = lazy(() => import('./pages/GrantHubPage'));
const SafetyHubPage          = lazy(() => import('./pages/SafetyHubPage'));
const CollaborationHubPage   = lazy(() => import('./pages/CollaborationHubPage'));
const AdminHubPage           = lazy(() => import('./pages/AdminHubPage'));
const EquipmentHubPage       = lazy(() => import('./pages/EquipmentHubPage'));
const ExperimentsHubPage     = lazy(() => import('./pages/ExperimentsHubPage'));
const ProcurementHubPage     = lazy(() => import('./pages/ProcurementHubPage'));
const ClinicalResearchHubPage= lazy(() => import('./pages/ClinicalResearchHubPage'));
const ReagentHubPage         = lazy(() => import('./pages/ReagentHubPage'));

const ProtocolsPage          = lazy(() => import('./pages/ProtocolsPage'));
const TasksPage              = lazy(() => import('./pages/TasksPage'));
const CalendarPage           = lazy(() => import('./pages/CalendarPage'));
const AuditPage              = lazy(() => import('./pages/AuditPage'));
const LabMeetingsPage        = lazy(() => import('./pages/LabMeetingsPage'));
const ReportsPage            = lazy(() => import('./pages/ReportsPage'));
const DocumentsPage          = lazy(() => import('./pages/DocumentsPage'));
const SuppliersPage          = lazy(() => import('./pages/SuppliersPage'));
const ELNPage                = lazy(() => import('./pages/ELNPage'));
const IoTDashboardPage       = lazy(() => import('./pages/IoTDashboardPage'));
const LabelPrinterPage       = lazy(() => import('./pages/LabelPrinterPage'));
const AILabManagerPage       = lazy(() => import('./pages/AILabManagerPage'));
const ReagentCartPage        = lazy(() => import('./pages/ReagentCartPage'));
const PaymentMethodsPage     = lazy(() => import('./pages/PaymentMethodsPage'));
const LabMembersPage         = lazy(() => import('./pages/LabMembersPage'));
const FreezerBiobankPage     = lazy(() => import('./pages/FreezerBiobankPage'));
const VendorIntelligencePage = lazy(() => import('./pages/VendorIntelligencePage'));
const TrainingCertPage       = lazy(() => import('./pages/TrainingCertPage'));
const PrivacyCenterPage      = lazy(() => import('./pages/PrivacyCenterPage'));
const SecurityDashboardPage  = lazy(() => import('./pages/SecurityDashboardPage'));
const CapaPage               = lazy(() => import('./pages/CapaPage'));
const EmailSettingsPage      = lazy(() => import('./pages/EmailSettingsPage'));
const CustomReportBuilderPage= lazy(() => import('./pages/CustomReportBuilderPage'));
const EquipmentAnalyticsPage = lazy(() => import('./pages/EquipmentAnalyticsPage'));
const OrgHierarchyPage       = lazy(() => import('./pages/OrgHierarchyPage'));
const GrantComposePage       = lazy(() => import('./pages/GrantComposePage'));
const GrantBudgetPage        = lazy(() => import('./pages/GrantBudgetPage'));
const FundingOpportunitiesPage   = lazy(() => import('./pages/FundingOpportunitiesPage'));
const ReviewerFeedbackPage       = lazy(() => import('./pages/ReviewerFeedbackPage'));
const CollaboratorNetworkPage    = lazy(() => import('./pages/CollaboratorNetworkPage'));
const ReferenceManagerPage       = lazy(() => import('./pages/ReferenceManagerPage'));
const BiosketchGeneratorPage     = lazy(() => import('./pages/BiosketchGeneratorPage'));
const GrantCalendarPage          = lazy(() => import('./pages/GrantCalendarPage'));
const BudgetCalculatorPage       = lazy(() => import('./pages/BudgetCalculatorPage'));
const ProgressReportsPage        = lazy(() => import('./pages/ProgressReportsPage'));
const SupportLettersPage         = lazy(() => import('./pages/SupportLettersPage'));
const SuccessAnalyticsPage       = lazy(() => import('./pages/SuccessAnalyticsPage'));
const IRBTrackerPage             = lazy(() => import('./pages/IRBTrackerPage'));
const SubcontractManagerPage     = lazy(() => import('./pages/SubcontractManagerPage'));
const ERACommonsPage             = lazy(() => import('./pages/ERACommonsPage'));
const WritingResourcesPage       = lazy(() => import('./pages/WritingResourcesPage'));
const VersionHistoryPage         = lazy(() => import('./pages/VersionHistoryPage'));
const LabNotebookPage            = lazy(() => import('./pages/LabNotebookPage'));
const StorageMapPage             = lazy(() => import('./pages/StorageMapPage'));
const SupplierDirectoryPage      = lazy(() => import('./pages/SupplierDirectoryPage'));

// Page-level loading fallback
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', flexDirection: 'column', gap: 12,
      color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 36, height: 36, border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

  // A11y: skip-to-content link
  useEffect(() => { setupSkipToContent(); }, []);

  // Analytics: track page views
  useEffect(() => { trackPageView(page); }, [page]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0d1b2a 0%, #13293d 100%)',
        color: '#e8eef4',
        fontSize: 16,
        gap: 16
      }}>
        <div style={{
          width: 64,
          height: 64,
          background: 'linear-gradient(135deg, #112e51 0%, #1a4480 50%, #205493 100%)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>⬡</div>
        <div style={{ fontWeight: 600, letterSpacing: '-0.3px' }}>Loading LabOS v3...</div>
        <div style={{ fontSize: 12, color: '#8fa3b8' }}>Laboratory Operations System</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'protocols': return <ProtocolsPage />;
      case 'lab-hub': return <LabHubPage />;
      case 'instruments': return <LabHubPage />;
      case 'bookings': return <LabHubPage />;
      case 'tasks': return <TasksPage />;
      case 'calendar': return <CalendarPage />;
      // Sample Hub
      case 'samples': return <SampleHubPage />;
      case 'sample-events': return <SampleHubPage />;
      case 'print-labels': return <SampleHubPage />;
      case 'batch-import': return <SampleHubPage />;
      // Resources Hub
      case 'inventory': return <ResourcesHubPage />;
      case 'templates': return <ResourcesHubPage />;
      case 'cost-tracking': return <ResourcesHubPage />;
      // Suppliers & Procurement
      case 'suppliers': return <SuppliersPage />;
      // Safety Hub
      case 'incidents': return <SafetyHubPage />;
      case 'compliance': return <SafetyHubPage />;
      case 'training': return <SafetyHubPage />;
      // Collaboration Hub
      case 'workspaces': return <CollaborationHubPage />;
      case 'lab-meetings': return <LabMeetingsPage />;
      case 'video-call': return <LabMeetingsPage />;
      case 'feedback': return <CollaborationHubPage />;
      case 'activity': return <CollaborationHubPage />;
      // Admin Hub
      case 'users': return <AdminHubPage />;
      case 'reminders': return <AdminHubPage />;
      case 'notifications': return <AdminHubPage />;
      case 'files': return <AdminHubPage />;
      case 'audit': return <AuditPage />;
      case 'integrations': return <AdminHubPage />;
      case 'settings': return <AdminHubPage />;
      // Lab Hub
      case 'sops': return <LabHubPage />;
      case 'maintenance': return <LabHubPage />;
      // Equipment Hub
      case 'equipment': return <EquipmentHubPage />;
      // Experiments Hub
      case 'experiments': return <ExperimentsHubPage />;
      // Reports & Analytics
      case 'reports': return <ReportsPage />;
      // Document Management
      case 'documents': return <DocumentsPage />;
      // Grant Hub - Unified Grant Module
      case 'grants': return <GrantHubPage />;
      case 'grant-hub': return <GrantHubPage />;
      case 'grant-budget': return <GrantBudgetPage />;
      // Grant Module - Additional Features
      case 'funding-opportunities': return <FundingOpportunitiesPage />;
      case 'reviewer-feedback': return <ReviewerFeedbackPage />;
      case 'collaborator-network': return <CollaboratorNetworkPage />;
      case 'reference-manager': return <ReferenceManagerPage />;
      case 'biosketch-generator': return <BiosketchGeneratorPage />;
      case 'grant-calendar': return <GrantCalendarPage />;
      case 'budget-calculator': return <BudgetCalculatorPage />;
      case 'progress-reports': return <ProgressReportsPage />;
      case 'support-letters': return <SupportLettersPage />;
      case 'success-analytics': return <SuccessAnalyticsPage />;
      case 'irb-tracker': return <IRBTrackerPage />;
      case 'subcontract-manager': return <SubcontractManagerPage />;
      case 'era-commons': return <ERACommonsPage />;
      case 'writing-resources': return <WritingResourcesPage />;
      case 'version-history': return <VersionHistoryPage />;
      // New v2 pages
      case 'lab-notebook': return <LabNotebookPage />;
      case 'storage-map': return <StorageMapPage />;
      case 'supplier-directory': return <SupplierDirectoryPage />;
      // Tier 1 — AI Research Intelligence
      case 'eln': return <ELNPage />;
      case 'iot-dashboard': return <IoTDashboardPage />;
      case 'label-printer': return <LabelPrinterPage />;
      case 'ai-manager': return <AILabManagerPage />;
      case 'reagent-cart': return <ReagentCartPage />;
      case 'payment-methods': return <PaymentMethodsPage />;
      case 'procurement-hub': return <ProcurementHubPage />;
      case 'lab-members': return <LabMembersPage />;
      // Tier 2 — Clinical & Translational Research
      case 'clinical-research': return <ClinicalResearchHubPage />;
      // Tier 4 — Operational Excellence
      case 'freezer-biobank': return <FreezerBiobankPage />;
      case 'vendor-intelligence': return <VendorIntelligencePage />;
      case 'training-cert': return <TrainingCertPage />;
      case 'privacy-center': return <PrivacyCenterPage />;
      case 'security-dashboard': return <SecurityDashboardPage />;
      case 'reagent-hub': return <ReagentHubPage />;
      case 'capa': return <CapaPage />;
      case 'email-settings': return <EmailSettingsPage />;
      case 'report-builder': return <CustomReportBuilderPage />;
      case 'equipment-analytics': return <EquipmentAnalyticsPage />;
      case 'org-hierarchy': return <OrgHierarchyPage />;
      case 'grant-compose': return <GrantComposePage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <NavigationContext.Provider value={setPage}>
      <Layout activePage={page} onNavigate={setPage}>
        <ErrorBoundary key={page}>
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </ErrorBoundary>
      </Layout>
      <CookieConsent />
    </NavigationContext.Provider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#13293d',
            color: '#e8eef4',
            border: '1px solid #2a4a67',
            borderRadius: 10,
            fontSize: 14,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          },
          success: { iconTheme: { primary: '#2eb872', secondary: '#13293d' } },
          error: { iconTheme: { primary: '#e35d5d', secondary: '#13293d' } },
        }}
      />
      <AppInner />
    </AuthProvider>
    </ErrorBoundary>
  );
}
