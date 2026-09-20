export type UserRole = 'superadmin' | 'admin' | 'pi' | 'manager' | 'staff' | 'trainee';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type BookingStatus = 'reserved' | 'active' | 'completed' | 'cancelled';
export type SampleStatus = 'received' | 'processing' | 'stored' | 'sequenced' | 'archived' | 'disposed';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TrainingStatus = 'active' | 'expired' | 'pending';
export type NotificationChannel = 'dashboard' | 'email' | 'sms';
export type ReminderStatus = 'pending' | 'sent' | 'failed';
export type AuditAction = 'create' | 'update' | 'delete';

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Protocol {
  id: number;
  title: string;
  field: string;
  version: string;
  description: string;
  owner_id: number | null;
  owner_name: string | null;
  reminder_days_before: number;
  created_at: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id?: number;
  step_order: number;
  title: string;
  instructions: string;
  estimated_minutes: number;
  requires_signoff: boolean;
}

export interface Instrument {
  id: number;
  name: string;
  category: string;
  location: string;
  maintenance_frequency_days: number;
  next_maintenance_date: string;
  status: string;
  notes: string;
}

export interface Booking {
  id: number;
  instrument_id: number;
  instrument_name: string | null;
  user_id: number;
  user_name: string | null;
  purpose: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  status: TaskStatus;
  assigned_to: number | null;
  assignee_name: string | null;
  reminder_type: string;
  related_protocol_id: number | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  subtasks?: string;
  comments?: string;
}

export interface TrainingRecord {
  id: number;
  user_id: number;
  user_name: string | null;
  title: string;
  instrument_id: number | null;
  instrument_name: string | null;
  protocol_id: number | null;
  completed_on: string;
  expires_on: string;
  status: TrainingStatus;
  notes: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  lot_number: string;
  quantity: number;
  unit: string;
  reorder_threshold: number;
  storage_location: string;
  barcode: string;
  expires_on: string | null;
  notes: string;
  // New fields for supplier integration
  supplier_id: number | null;
  catalog_number: string;
  unit_price: number;
  last_ordered: string | null;
  lead_time_days: number;
  hazard_class: string;
  storage_temp: string;
  msds_available: boolean;
}

export interface IncidentReport {
  id: number;
  title: string;
  area: string;
  severity: IncidentSeverity;
  description: string;
  corrective_action: string;
  status: string;
  reported_by: number | null;
  reporter_name: string | null;
  created_at: string;
}

export interface StudyWorkspace {
  id: number;
  name: string;
  field: string;
  lead_id: number | null;
  lead_name: string | null;
  milestone: string;
  status: string;
  description: string;
}

export interface NotificationRule {
  id: number;
  title: string;
  trigger_event: string;
  channel: NotificationChannel;
  recipient_role: string;
  lead_time_hours: number;
  is_active: boolean;
}

export interface SampleRecord {
  id: number;
  sample_id: string;
  barcode: string;
  sample_type: string;
  source: string;
  project_id: number | null;
  project_name: string | null;
  protocol_id: number | null;
  protocol_name: string | null;
  storage_location: string;
  status: SampleStatus;
  received_on: string;
  owner_id: number | null;
  owner_name: string | null;
  notes: string;
}

export interface SampleEvent {
  id: number;
  sample_record_id: number;
  event_type: string;
  location: string;
  status: string;
  performed_by: number | null;
  performer_name: string | null;
  timestamp: string;
  notes: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  location: string;
  related_instrument_id: number | null;
  related_task_id: number | null;
  related_protocol_id: number | null;
  owner_id: number | null;
  owner_name: string | null;
  description: string;
}

export interface ReminderQueue {
  id: number;
  entity_type: string;
  entity_id: number;
  title: string;
  due_at: string;
  channel: NotificationChannel;
  recipient_user_id: number | null;
  recipient_role: string;
  status: ReminderStatus;
  last_attempt_at: string | null;
  message: string;
}

export interface ComplianceLog {
  id: number;
  title: string;
  category: string;
  details: string;
  logged_by: number | null;
  logger_name: string | null;
  created_at: string;
}

export interface Feedback {
  id: number;
  subject: string;
  message: string;
  module: string;
  submitted_by: number | null;
  submitter_name: string | null;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: AuditAction;
  entity_type: string;
  entity_id: number | null;
  user_id: number | null;
  user_email: string;
  changes_json: string;
  timestamp: string;
}

export interface Attachment {
  id: number;
  entity_type: string;
  entity_id: number;
  filename: string;
  filepath: string;
  uploaded_by: number | null;
  uploader_name: string | null;
  uploaded_at: string;
}

export interface WeekCount {
  week: string;
  count: number;
}

export interface DashboardSummary {
  protocols: number;
  instruments: number;
  bookings: number;
  tasks_open: number;
  compliance_logs: number;
  feedback_open: number;
  upcoming_maintenance: number;
  overdue_tasks: number;
  training_records: number;
  inventory_items: number;
  incident_reports: number;
  workspaces: number;
  notification_rules: number;
  samples: number;
  sample_events: number;
  calendar_events: number;
  reminders_pending: number;
  low_stock_items: number;
  samples_by_status: Record<string, number>;
  tasks_by_status: Record<string, number>;
  incidents_by_severity: Record<string, number>;
  sample_intake_by_week: WeekCount[];
  audit_recent: AuditLog[];
}
