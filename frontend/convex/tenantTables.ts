/**
 * Which tables hold one lab's data. Every row in these carries `lab_id`, and the lab-scoped database in
 * tenant.ts only ever shows a caller the rows of their own lab. Users are scoped by `home_lab_id`.
 * Not listed on purpose: sessions, invites, organizations, sites, labs, lab_memberships (handled by their own code).
 */
export const LAB_TABLES = [
  "protocols", "protocol_versions", "instruments", "bookings", "inventory", "samples", "sample_events",
  "training", "incidents", "tasks", "calendar_events", "reminders", "sops", "maintenance", "costs", "templates",
  "notifications", "audit_logs", "compliance", "workspaces", "feedback", "attachments", "meetings", "suppliers",
  "purchase_orders", "lab_notebook", "iot_sensors", "iot_readings", "iot_alerts", "freezers", "freezer_shelves",
  "freezer_racks", "freezer_boxes", "freezer_slots", "report_configs", "label_events", "sample_labels",
  "grant_versions", "grant_submissions", "biosketches", "settings", "reagent_cart", "capa", "consent_records",
  "activity", "integrations", "procurement_rules", "procurement_budgets", "restricted_chemicals", "borrow_requests",
  "video_rooms", "video_chat_messages", "payment_methods", "payment_orders", "alt_prices", "sds_records",
  "recurrence_rules", "ai_chat_history", "hypothesis_ratings", "erasure_requests",
] as const;

export type LabTable = (typeof LAB_TABLES)[number];
const SET = new Set<string>(LAB_TABLES);
export const isLabTable = (t: string) => SET.has(t);
