import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Shared audit trail fields for the storage-hierarchy tables (ADR:
// docs/adr/ADR-freezer-storage-hierarchy.md). `version` backs optimistic
// concurrency checks on update; archived_* backs soft delete.
const auditFields = {
  created_at: v.number(),
  created_by: v.id("users"),
  updated_at: v.number(),
  updated_by: v.optional(v.id("users")),
  version: v.number(),
  archived_at: v.optional(v.number()),
  archived_by: v.optional(v.id("users")),
};

export default defineSchema({
  // ── Sessions (custom password auth) ──────────────────────────────────
  sessions: defineTable({
    user_id: v.id("users"),
    token: v.string(),
    expires_at: v.number(),
    created_at: v.number(),
  }).index("by_token", ["token"]),

  // ── Users ────────────────────────────────────────────────────────────
  users: defineTable({
    email: v.string(),
    hashed_password: v.string(),
    full_name: v.string(),
    role: v.union(
      v.literal("superadmin"), v.literal("admin"), v.literal("pi"),
      v.literal("manager"), v.literal("staff"), v.literal("trainee")
    ),
    is_active: v.boolean(),
    department: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    totp_secret: v.optional(v.string()),
    totp_enabled: v.boolean(),
    failed_login_attempts: v.number(),
    locked_until: v.optional(v.number()),
    data_classification_clearance: v.optional(v.string()),
    stripe_customer_id: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ── Protocols ────────────────────────────────────────────────────────
  protocols: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.string(),
    status: v.string(),
    content: v.optional(v.string()),
    steps: v.optional(v.string()),
    author_id: v.id("users"),
    tags: v.optional(v.string()),
    estimated_duration: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_author", ["author_id"])
    .index("by_status", ["status"])
    .searchIndex("search_title", { searchField: "title" }),

  protocol_versions: defineTable({
    protocol_id: v.id("protocols"),
    version: v.string(),
    content: v.optional(v.string()),
    change_summary: v.optional(v.string()),
    created_by: v.id("users"),
    created_at: v.number(),
  }).index("by_protocol", ["protocol_id"]),

  // ── Instruments ──────────────────────────────────────────────────────
  instruments: defineTable({
    name: v.string(),
    model: v.optional(v.string()),
    serial_number: v.optional(v.string()),
    location: v.optional(v.string()),
    status: v.string(),
    last_calibrated: v.optional(v.number()),
    next_calibration: v.optional(v.number()),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).searchIndex("search_name", { searchField: "name" }),

  bookings: defineTable({
    instrument_id: v.id("instruments"),
    user_id: v.id("users"),
    start_time: v.number(),
    end_time: v.number(),
    purpose: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_instrument", ["instrument_id"])
    .index("by_user", ["user_id"])
    .index("by_start", ["start_time"]),

  // ── Inventory ────────────────────────────────────────────────────────
  inventory: defineTable({
    name: v.string(),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    category: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    location: v.optional(v.string()),
    minimum_quantity: v.optional(v.number()),
    expiry_date: v.optional(v.number()),
    cost_per_unit: v.optional(v.number()),
    notes: v.optional(v.string()),
    barcode: v.optional(v.string()),
    sds_url: v.optional(v.string()),
    hazards: v.optional(v.string()),
    created_by: v.optional(v.id("users")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_category", ["category"])
    .searchIndex("search_name", { searchField: "name" }),

  // ── Samples ──────────────────────────────────────────────────────────
  samples: defineTable({
    sample_id: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
    status: v.string(),
    location: v.optional(v.string()),
    collected_at: v.optional(v.number()),
    collected_by: v.optional(v.id("users")),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    metadata: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    // ── Storage-hierarchy extension (Checkpoint B) — all optional so
    // existing rows stay valid without a backfill of this table itself.
    lab_id: v.optional(v.id("labs")),
    container_type: v.optional(v.string()),
    parent_sample_id: v.optional(v.id("samples")),
    volume: v.optional(v.number()),
    volume_unit: v.optional(v.string()),
    concentration: v.optional(v.number()),
    concentration_unit: v.optional(v.string()),
    passage_number: v.optional(v.number()),
    freeze_thaw_count: v.optional(v.number()),
    hazard_class: v.optional(v.string()),
    retention_date: v.optional(v.number()),
    owner_team: v.optional(v.string()),
    checked_out_by: v.optional(v.id("users")),
    checked_out_at: v.optional(v.number()),
    expected_return: v.optional(v.number()),
    disposed_at: v.optional(v.number()),
    disposal_reason: v.optional(v.string()),
    archived_at: v.optional(v.number()),
    version: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_sample_id", ["sample_id"])
    .index("by_lab", ["lab_id"])
    .index("by_checked_out_by", ["checked_out_by"])
    .searchIndex("search_name", { searchField: "name" }),

  sample_events: defineTable({
    sample_id: v.id("samples"),
    event_type: v.string(),
    description: v.optional(v.string()),
    performed_by: v.optional(v.id("users")),
    performed_at: v.number(),
    notes: v.optional(v.string()),
  }).index("by_sample", ["sample_id"]),

  // ── Training ─────────────────────────────────────────────────────────
  training: defineTable({
    user_id: v.id("users"),
    training_name: v.string(),
    category: v.optional(v.string()),
    status: v.string(),
    completed_at: v.optional(v.number()),
    expires_at: v.optional(v.number()),
    score: v.optional(v.number()),
    notes: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_status", ["status"]),

  // ── Incidents ────────────────────────────────────────────────────────
  incidents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    severity: v.string(),
    status: v.string(),
    reported_by: v.id("users"),
    assigned_to: v.optional(v.id("users")),
    occurred_at: v.optional(v.number()),
    resolved_at: v.optional(v.number()),
    root_cause: v.optional(v.string()),
    corrective_action: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_severity", ["severity"])
    .index("by_status", ["status"]),

  // ── Tasks ─────────────────────────────────────────────────────────────
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    priority: v.optional(v.string()),
    assigned_to: v.optional(v.id("users")),
    created_by: v.id("users"),
    due_date: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    tags: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_assigned", ["assigned_to"])
    .index("by_status", ["status"]),

  // ── Scheduling ───────────────────────────────────────────────────────
  calendar_events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    start_time: v.number(),
    end_time: v.number(),
    event_type: v.optional(v.string()),
    location: v.optional(v.string()),
    created_by: v.id("users"),
    attendees: v.optional(v.string()),
    recurrence: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_start", ["start_time"])
    .index("by_creator", ["created_by"]),

  reminders: defineTable({
    entity_type: v.string(),
    entity_id: v.string(),
    message: v.string(),
    due_at: v.number(),
    channel: v.string(),
    status: v.string(),
    user_id: v.id("users"),
    sent_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_status", ["status"])
    .index("by_due", ["due_at"]),

  // ── SOPs ─────────────────────────────────────────────────────────────
  sops: defineTable({
    title: v.string(),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.string(),
    status: v.string(),
    author_id: v.id("users"),
    approved_by: v.optional(v.id("users")),
    approved_at: v.optional(v.number()),
    review_date: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_status", ["status"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["status"] }),

  // ── Maintenance ──────────────────────────────────────────────────────
  maintenance: defineTable({
    instrument_id: v.optional(v.id("instruments")),
    maintenance_type: v.string(),
    status: v.string(),
    scheduled_date: v.optional(v.number()),
    completed_date: v.optional(v.number()),
    performed_by: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    cost: v.optional(v.number()),
    next_due: v.optional(v.number()),
    created_at: v.number(),
  }).index("by_instrument", ["instrument_id"]),

  // ── Costs ────────────────────────────────────────────────────────────
  costs: defineTable({
    title: v.string(),
    category: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    submitted_by: v.id("users"),
    approved_by: v.optional(v.id("users")),
    approved_at: v.optional(v.number()),
    description: v.optional(v.string()),
    receipt_url: v.optional(v.string()),
    grant_id: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_submitter", ["submitted_by"]),

  // ── Templates ────────────────────────────────────────────────────────
  templates: defineTable({
    name: v.string(),
    category: v.string(),
    content: v.string(),
    variables: v.optional(v.string()),
    created_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
  }).searchIndex("search_name", { searchField: "name" }),

  // ── Notifications ────────────────────────────────────────────────────
  notifications: defineTable({
    user_id: v.id("users"),
    title: v.string(),
    message: v.string(),
    channel: v.string(),
    is_read: v.boolean(),
    entity_type: v.optional(v.string()),
    entity_id: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_read", ["is_read"]),

  // ── Audit Logs ───────────────────────────────────────────────────────
  audit_logs: defineTable({
    user_id: v.optional(v.id("users")),
    action: v.string(),
    entity_type: v.string(),
    entity_id: v.optional(v.string()),
    details: v.optional(v.string()),
    ip_address: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_entity", ["entity_type"]),

  // ── Compliance ───────────────────────────────────────────────────────
  compliance: defineTable({
    title: v.string(),
    regulation: v.optional(v.string()),
    status: v.string(),
    due_date: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    assigned_to: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_status", ["status"]),

  // ── Workspaces ───────────────────────────────────────────────────────
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    capacity: v.optional(v.number()),
    location: v.optional(v.string()),
    status: v.string(),
    created_at: v.number(),
  }),

  // ── Feedback ─────────────────────────────────────────────────────────
  feedback: defineTable({
    user_id: v.optional(v.id("users")),
    category: v.optional(v.string()),
    message: v.string(),
    rating: v.optional(v.number()),
    created_at: v.number(),
  }),

  // ── Files / Attachments ──────────────────────────────────────────────
  attachments: defineTable({
    entity_type: v.string(),
    entity_id: v.string(),
    filename: v.string(),
    file_size: v.optional(v.number()),
    mime_type: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    uploaded_by: v.id("users"),
    created_at: v.number(),
  }).index("by_entity", ["entity_type", "entity_id"]),

  // ── Lab Meetings ─────────────────────────────────────────────────────
  meetings: defineTable({
    title: v.string(),
    meeting_type: v.string(),
    status: v.string(),
    scheduled_at: v.number(),
    duration_minutes: v.optional(v.number()),
    location: v.optional(v.string()),
    agenda: v.optional(v.string()),
    minutes: v.optional(v.string()),
    organizer_id: v.id("users"),
    attendees: v.optional(v.string()),
    recording_url: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_organizer", ["organizer_id"])
    .index("by_scheduled", ["scheduled_at"]),

  // ── Suppliers ────────────────────────────────────────────────────────
  suppliers: defineTable({
    name: v.string(),
    category: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    contact_phone: v.optional(v.string()),
    website: v.optional(v.string()),
    approval_status: v.string(),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).searchIndex("search_name", { searchField: "name" }),

  purchase_orders: defineTable({
    supplier_id: v.optional(v.id("suppliers")),
    status: v.string(),
    total_amount: v.optional(v.number()),
    currency: v.string(),
    ordered_by: v.id("users"),
    approved_by: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    items: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_status", ["status"]),

  // ── Lab Notebook ─────────────────────────────────────────────────────
  lab_notebook: defineTable({
    title: v.string(),
    content: v.optional(v.string()),
    author_id: v.id("users"),
    tags: v.optional(v.string()),
    signed_at: v.optional(v.number()),
    witnessed_by: v.optional(v.id("users")),
    witnessed_at: v.optional(v.number()),
    is_locked: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_author", ["author_id"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["author_id"] }),

  // ── IoT ──────────────────────────────────────────────────────────────
  iot_sensors: defineTable({
    name: v.string(),
    sensor_type: v.string(),
    location: v.optional(v.string()),
    unit: v.optional(v.string()),
    min_threshold: v.optional(v.number()),
    max_threshold: v.optional(v.number()),
    is_active: v.boolean(),
    api_key: v.optional(v.string()),
    last_reading: v.optional(v.number()),
    last_reading_at: v.optional(v.number()),
    created_at: v.number(),
  }),

  iot_readings: defineTable({
    sensor_id: v.id("iot_sensors"),
    value: v.number(),
    timestamp: v.number(),
    metadata: v.optional(v.string()),
  })
    .index("by_sensor", ["sensor_id"])
    .index("by_timestamp", ["timestamp"]),

  iot_alerts: defineTable({
    sensor_id: v.id("iot_sensors"),
    message: v.string(),
    severity: v.string(),
    value: v.optional(v.number()),
    is_acknowledged: v.boolean(),
    acknowledged_by: v.optional(v.id("users")),
    acknowledged_at: v.optional(v.number()),
    created_at: v.number(),
  }).index("by_sensor", ["sensor_id"]),

  // ── Org Hierarchy ────────────────────────────────────────────────────
  organizations: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    created_at: v.number(),
  }),

  sites: defineTable({
    organization_id: v.id("organizations"),
    name: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_org", ["organization_id"]),

  labs: defineTable({
    site_id: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    pi_user_id: v.optional(v.id("users")),
    department: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_site", ["site_id"]),

  // ── Lab Members ──────────────────────────────────────────────────────
  lab_memberships: defineTable({
    lab_id: v.id("labs"),
    user_id: v.id("users"),
    lab_role: v.string(),
    status: v.string(),
    invited_by: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    joined_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_lab", ["lab_id"])
    .index("by_user", ["user_id"]),

  // ── Freezer / Biobank ────────────────────────────────────────────────
  freezers: defineTable({
    name: v.string(),
    location: v.optional(v.string()),
    temperature: v.optional(v.number()),
    capacity_racks: v.optional(v.number()),
    capacity_boxes: v.optional(v.number()),
    notes: v.optional(v.string()),
    created_at: v.number(),
  }),

  freezer_slots: defineTable({
    freezer_id: v.id("freezers"),
    rack: v.number(),
    box: v.number(),
    row: v.number(),
    col: v.number(),
    sample_id: v.optional(v.string()),
    label: v.optional(v.string()),
    barcode: v.optional(v.string()),
    expiry_date: v.optional(v.number()),
    notes: v.optional(v.string()),
    updated_at: v.number(),
  })
    .index("by_freezer", ["freezer_id"])
    .index("by_freezer_pos", ["freezer_id", "rack", "box", "row", "col"]),

  // ── Storage hierarchy (Checkpoint B) ────────────────────────────────
  // docs/adr/ADR-freezer-storage-hierarchy.md · docs/plans/FREEZER_SAMPLE_STORAGE_IMPLEMENTATION_PLAN.md
  // `freezers` / `freezer_slots` above stay read-only legacy sources for
  // the backfill (migration plan step 5); these are the new write path.
  //
  // Tenancy boundary is `lab_id`, not `workspace_id`: `workspaces` has no
  // membership table (Gap Report H2), while `lab_memberships` already links
  // users to labs with a role. Decided 2026-09-20 (Plan §5 follow-up).
  storage_facilities: defineTable({
    lab_id: v.id("labs"),
    name: v.string(),
    building: v.optional(v.string()),
    room: v.optional(v.string()),
    ...auditFields,
  }).index("by_lab", ["lab_id"]),

  storage_units: defineTable({ // the freezer itself
    lab_id: v.id("labs"),
    facility_id: v.optional(v.id("storage_facilities")),
    name: v.string(),
    storage_type: v.string(), // -196|-150|-80|-20|4|rt|ln2|custom
    target_temp: v.optional(v.number()),
    temp_unit: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    serial_number: v.optional(v.string()),
    asset_number: v.optional(v.string()),
    owner_team: v.optional(v.string()),
    iot_sensor_id: v.optional(v.id("iot_sensors")),
    status: v.string(), // normal|warning|critical|offline|maintenance
    notes: v.optional(v.string()),
    legacy_freezer_id: v.optional(v.id("freezers")), // migration provenance
    ...auditFields,
  })
    .index("by_lab", ["lab_id"])
    .index("by_lab_status", ["lab_id", "status"])
    .index("by_legacy_freezer", ["legacy_freezer_id"])
    .searchIndex("search_name", { searchField: "name" }),

  storage_nodes: defineTable({ // shelf | rack | box
    lab_id: v.id("labs"),
    unit_id: v.id("storage_units"),
    parent_id: v.optional(v.id("storage_nodes")), // undefined => child of the unit
    path: v.array(v.id("storage_nodes")), // ancestors, root-first
    depth: v.number(),
    kind: v.union(v.literal("shelf"), v.literal("rack"), v.literal("box")),
    name: v.string(),
    ordinal: v.optional(v.number()),
    rows: v.optional(v.number()), // box only
    cols: v.optional(v.number()), // box only
    position_naming: v.optional(v.union(v.literal("alpha_row"), v.literal("numeric"))),
    capacity: v.optional(v.number()), // shelf/rack: max children
    ...auditFields,
  })
    .index("by_unit", ["unit_id"])
    .index("by_parent", ["parent_id"])
    .index("by_lab", ["lab_id"]),

  storage_positions: defineTable({ // SPARSE — only non-empty positions exist
    lab_id: v.id("labs"),
    box_id: v.id("storage_nodes"),
    row: v.number(),
    col: v.number(),
    label: v.string(), // "A1"
    state: v.union(
      v.literal("occupied"), v.literal("reserved"),
      v.literal("quarantined"), v.literal("unavailable"),
    ),
    sample_id: v.optional(v.id("samples")), // real reference; undefined for unresolved legacy slots
    reserved_by: v.optional(v.id("users")),
    reserved_until: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_box", ["box_id"])
    .index("by_box_pos", ["box_id", "row", "col"])
    .index("by_sample", ["sample_id"]),

  storage_moves: defineTable({ // append-only ledger
    lab_id: v.id("labs"),
    sample_id: v.id("samples"),
    from_box_id: v.optional(v.id("storage_nodes")),
    from_label: v.optional(v.string()),
    to_box_id: v.optional(v.id("storage_nodes")),
    to_label: v.optional(v.string()),
    reason: v.optional(v.string()),
    moved_by: v.id("users"),
    moved_at: v.number(),
    request_id: v.optional(v.string()), // idempotency
  })
    .index("by_sample", ["sample_id"])
    .index("by_request_id", ["request_id"]),

  // ── Grants ───────────────────────────────────────────────────────────
  grant_versions: defineTable({
    grant_id: v.string(),
    title: v.string(),
    section: v.string(),
    content: v.string(),
    version: v.number(),
    created_by: v.id("users"),
    created_at: v.number(),
  }).index("by_grant", ["grant_id"]),

  grant_submissions: defineTable({
    title: v.string(),
    agency: v.optional(v.string()),
    grant_type: v.optional(v.string()),
    status: v.string(),
    submission_date: v.optional(v.number()),
    amount_requested: v.optional(v.number()),
    outcome: v.optional(v.string()),
    notes: v.optional(v.string()),
    submitted_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_submitter", ["submitted_by"]),

  // ── Biosketch ────────────────────────────────────────────────────────
  biosketches: defineTable({
    user_id: v.id("users"),
    personal_statement: v.optional(v.string()),
    positions: v.optional(v.string()),
    contributions: v.optional(v.string()),
    research_support: v.optional(v.string()),
    publications: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_user", ["user_id"]),

  // ── Settings ─────────────────────────────────────────────────────────
  settings: defineTable({
    key: v.string(),
    value: v.optional(v.string()),
    category: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_key", ["key"]),

  // ── Reagent Cart ─────────────────────────────────────────────────────
  reagent_cart: defineTable({
    user_id: v.id("users"),
    name: v.string(),
    catalog_number: v.optional(v.string()),
    supplier: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    unit_price: v.optional(v.number()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.string(),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  // ── CAPA ─────────────────────────────────────────────────────────────
  capa: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    status: v.string(),
    priority: v.optional(v.string()),
    assigned_to: v.optional(v.id("users")),
    due_date: v.optional(v.number()),
    closed_at: v.optional(v.number()),
    created_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_status", ["status"]),

  // ── Privacy / GDPR ───────────────────────────────────────────────────
  consent_records: defineTable({
    user_id: v.id("users"),
    consent_type: v.string(),
    granted: v.boolean(),
    version: v.optional(v.string()),
    ip_address: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  // ── Activity ─────────────────────────────────────────────────────────
  activity: defineTable({
    user_id: v.optional(v.id("users")),
    action: v.string(),
    entity_type: v.optional(v.string()),
    entity_id: v.optional(v.string()),
    description: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_created", ["created_at"]),

  // ── Integrations ─────────────────────────────────────────────────────
  integrations: defineTable({
    name: v.string(),
    integration_type: v.string(),
    config: v.optional(v.string()),
    status: v.string(),
    last_sync: v.optional(v.number()),
    created_at: v.number(),
  }),

  // ── Procurement ─────────────────────────────────────────────────────
  procurement_rules: defineTable({
    name: v.string(),
    condition_field: v.string(),
    condition_op: v.string(),
    condition_value: v.string(),
    action: v.string(),
    created_by: v.id("users"),
    created_at: v.number(),
  }),

  procurement_budgets: defineTable({
    name: v.string(),
    amount: v.number(),
    spent: v.number(),
    period: v.string(),
    department: v.optional(v.string()),
    created_by: v.id("users"),
    created_at: v.number(),
  }),

  restricted_chemicals: defineTable({
    name: v.string(),
    cas_number: v.optional(v.string()),
    reason: v.optional(v.string()),
    added_by: v.id("users"),
    created_at: v.number(),
  }),

  borrow_requests: defineTable({
    item_name: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    requester_id: v.id("users"),
    lender_id: v.optional(v.id("users")),
    status: v.string(),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_status", ["status"])
    .index("by_requester", ["requester_id"]),

  // ── Video Rooms ─────────────────────────────────────────────────────
  video_rooms: defineTable({
    room_id: v.string(),
    meeting_id: v.optional(v.id("meetings")),
    status: v.string(),
    created_by: v.id("users"),
    created_at: v.number(),
    ended_at: v.optional(v.number()),
  }).index("by_room_id", ["room_id"])
    .index("by_meeting", ["meeting_id"]),

  video_chat_messages: defineTable({
    room_id: v.string(),
    user_id: v.id("users"),
    message: v.string(),
    created_at: v.number(),
  }).index("by_room", ["room_id"]),

  // ── Payments ────────────────────────────────────────────────────────
  payment_methods: defineTable({
    user_id: v.id("users"),
    method_type: v.string(),
    label: v.string(),
    last_four: v.optional(v.string()),
    is_default: v.boolean(),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  payment_orders: defineTable({
    user_id: v.id("users"),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    description: v.optional(v.string()),
    payment_method_id: v.optional(v.id("payment_methods")),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  // ── Procurement extras ──────────────────────────────────────────────
  alt_prices: defineTable({
    purchase_order_id: v.id("purchase_orders"),
    vendor: v.string(),
    price: v.number(),
    url: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_order", ["purchase_order_id"]),

  sds_records: defineTable({
    entity_id: v.string(),
    url: v.string(),
    hazards: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_entity", ["entity_id"]),

  recurrence_rules: defineTable({
    entity_id: v.string(),
    pattern: v.string(),
    auto_reorder: v.boolean(),
    created_at: v.number(),
  }).index("by_entity", ["entity_id"]),

  // ── AI Chat ─────────────────────────────────────────────────────────
  ai_chat_history: defineTable({
    user_id: v.id("users"),
    question: v.string(),
    answer: v.string(),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  // ── Research AI Swarm: hypothesis ratings (feedback / learning loop) ──
  hypothesis_ratings: defineTable({
    user_id: v.id("users"),
    topic: v.string(),
    disease: v.optional(v.string()),
    hypothesis: v.string(),
    rationale: v.optional(v.string()),
    rating: v.number(), // 1-5 stars
    novelty_score: v.optional(v.number()),
    unfunded: v.optional(v.boolean()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_topic", ["topic"]),
});
