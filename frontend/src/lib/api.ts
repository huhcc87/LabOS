/**
 * API layer — now backed by Convex instead of REST/axios.
 * All named exports match the old REST API signatures so pages work without changes.
 */
export {
  authApi,
  tasksApi,
  incidentsApi,
  sopsApi,
  suppliersApi,
  schedulingApi,
  notebookApi,
  meetingsApi,
  reagentCartApi,
  iotApi,
  auditApi,
  grantsApi,
  grantVersionsApi,
  grantSubmissionsApi,
  dashboardApi,
  protocolsApi,
  inventoryApi,
  samplesApi,
  maintenanceApi,
  instrumentsApi,
  freezerApi,
  settingsApi,
  costsApi,
  labMembersApi,
  usersAdminApi,
  trainingApi,
  complianceApi,
  workspacesApi,
  feedbackApi,
  notificationsApi,
  integrationsApi,
  templatesApi,
  activityApi,
  filesApi,
  aiApi,
  biosketchApi,
  videoApi,
  paymentsApi,
  procurementApi,
  protocolsPrintApi,
  orgApi,
} from './convexClient';

export type { PaginatedResponse } from './types';

export function buildParams(page: number, perPage: number, search: string, extra?: Record<string, string>) {
  const p: Record<string, string> = { page: String(page), per_page: String(perPage), search };
  if (extra) Object.assign(p, extra);
  return new URLSearchParams(p).toString();
}

const fakeClient = {
  get: async <T = any>(_url: string, _opts?: any): Promise<{ data: T | null }> => ({ data: null }),
  post: async <T = any>(_url: string, _data?: any, _opts?: any): Promise<{ data: T | null }> => ({ data: null }),
  put: async <T = any>(_url: string, _data?: any): Promise<{ data: T | null }> => ({ data: null }),
  patch: async <T = any>(_url: string, _data?: any): Promise<{ data: T | null }> => ({ data: null }),
  delete: async <T = any>(_url: string): Promise<{ data: T | null }> => ({ data: null }),
};

export default fakeClient;
export const API_BASE_URL = '';
