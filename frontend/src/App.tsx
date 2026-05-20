import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationContext } from './context/NavigationContext';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProtocolsPage from './pages/ProtocolsPage';
import InstrumentsPage from './pages/InstrumentsPage';
import BookingsPage from './pages/BookingsPage';
import TasksPage from './pages/TasksPage';
import TrainingPage from './pages/TrainingPage';
import InventoryPage from './pages/InventoryPage';
import SamplesPage from './pages/SamplesPage';
import SampleEventsPage from './pages/SampleEventsPage';
import CalendarPage from './pages/CalendarPage';
import IncidentsPage from './pages/IncidentsPage';
import WorkspacesPage from './pages/WorkspacesPage';
import CompliancePage from './pages/CompliancePage';
import FeedbackPage from './pages/FeedbackPage';
import RemindersPage from './pages/RemindersPage';
import NotificationsPage from './pages/NotificationsPage';
import FilesPage from './pages/FilesPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';
import LabMeetingsPage from './pages/LabMeetingsPage';
// New pages
import SOPsPage from './pages/SOPsPage';
import MaintenancePage from './pages/MaintenancePage';
import PrintLabelsPage from './pages/PrintLabelsPage';
import BatchImportPage from './pages/BatchImportPage';
import TemplatesPage from './pages/TemplatesPage';
import CostTrackingPage from './pages/CostTrackingPage';
import ActivityPage from './pages/ActivityPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
// Grant Hub - Unified Grant Module
import GrantHubPage from './pages/GrantHubPage';
// Lab Hub - Unified Lab Operations
import LabHubPage from './pages/LabHubPage';
// Sample Hub - Unified Sample Management
import SampleHubPage from './pages/SampleHubPage';
// Resources Hub - Unified Resources
import ResourcesHubPage from './pages/ResourcesHubPage';
// Suppliers & Procurement
import SuppliersPage from './pages/SuppliersPage';
// Safety Hub - Quality & Safety
import SafetyHubPage from './pages/SafetyHubPage';
// Collaboration Hub - Team Collaboration
import CollaborationHubPage from './pages/CollaborationHubPage';
// Admin Hub - Administration
import AdminHubPage from './pages/AdminHubPage';
// Equipment Hub - Equipment Management
import EquipmentHubPage from './pages/EquipmentHubPage';
// Experiments Hub - Experiment Management
import ExperimentsHubPage from './pages/ExperimentsHubPage';
// Reports & Analytics
import ReportsPage from './pages/ReportsPage';
// Document Management
import DocumentsPage from './pages/DocumentsPage';
import GrantBudgetPage from './pages/GrantBudgetPage';
// Grant Module - Additional Features
import FundingOpportunitiesPage from './pages/FundingOpportunitiesPage';
import ReviewerFeedbackPage from './pages/ReviewerFeedbackPage';
import CollaboratorNetworkPage from './pages/CollaboratorNetworkPage';
import ReferenceManagerPage from './pages/ReferenceManagerPage';
import BiosketchGeneratorPage from './pages/BiosketchGeneratorPage';
import GrantCalendarPage from './pages/GrantCalendarPage';
import BudgetCalculatorPage from './pages/BudgetCalculatorPage';
import ProgressReportsPage from './pages/ProgressReportsPage';
import SupportLettersPage from './pages/SupportLettersPage';
import SuccessAnalyticsPage from './pages/SuccessAnalyticsPage';
import IRBTrackerPage from './pages/IRBTrackerPage';
import SubcontractManagerPage from './pages/SubcontractManagerPage';
import ERACommonsPage from './pages/ERACommonsPage';
import WritingResourcesPage from './pages/WritingResourcesPage';
import VersionHistoryPage from './pages/VersionHistoryPage';
import LabNotebookPage from './pages/LabNotebookPage';
import StorageMapPage from './pages/StorageMapPage';
import SupplierDirectoryPage from './pages/SupplierDirectoryPage';
// Tier 1 — AI Research Intelligence
import ELNPage from './pages/ELNPage';
import IoTDashboardPage from './pages/IoTDashboardPage';
import LabelPrinterPage from './pages/LabelPrinterPage';
import AILabManagerPage from './pages/AILabManagerPage';
import ReagentCartPage from './pages/ReagentCartPage';
import PaymentMethodsPage from './pages/PaymentMethodsPage';
import ProcurementHubPage from './pages/ProcurementHubPage';
import LabMembersPage from './pages/LabMembersPage';
// Tier 2 — Clinical & Translational Research
import ClinicalResearchHubPage from './pages/ClinicalResearchHubPage';
// Tier 4 — Operational Excellence
import FreezerBiobankPage from './pages/FreezerBiobankPage';
import VendorIntelligencePage from './pages/VendorIntelligencePage';
import TrainingCertPage from './pages/TrainingCertPage';
import PrivacyCenterPage from './pages/PrivacyCenterPage';
import SecurityDashboardPage from './pages/SecurityDashboardPage';
import ReagentHubPage from './pages/ReagentHubPage';
import CapaPage from './pages/CapaPage';
import EmailSettingsPage from './pages/EmailSettingsPage';
import CustomReportBuilderPage from './pages/CustomReportBuilderPage';
import EquipmentAnalyticsPage from './pages/EquipmentAnalyticsPage';
import OrgHierarchyPage from './pages/OrgHierarchyPage';
import { CookieConsent } from './components/CookieConsent';

function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

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
      case 'protocols': return <LabHubPage />;
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
      default: return <DashboardPage />;
    }
  };

  return (
    <NavigationContext.Provider value={setPage}>
      <Layout activePage={page} onNavigate={setPage}>
        {renderPage()}
      </Layout>
      <CookieConsent />
    </NavigationContext.Provider>
  );
}

export default function App() {
  return (
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
  );
}
