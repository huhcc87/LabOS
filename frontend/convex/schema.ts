import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ── Users ────────────────────────────────────────────────────────────
  users: defineTable({
    email: v.string(),
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
  })
    .index("by_status", ["status"])
    .index("by_sample_id", ["sample_id"])
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
    .searchIndex("search_title", { searchField: "title" }),

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
    .searchIndex("search_title", { searchField: "title" }),

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
});
