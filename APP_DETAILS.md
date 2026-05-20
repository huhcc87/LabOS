# LabOS v3 — Full Application Reference

> **Medical-grade laboratory management platform** covering everything from electronic lab notebooks to IoT sensor monitoring, grant writing, biobank management, clinical research tracking, procurement, and GDPR compliance.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Feature Modules](#4-feature-modules)
5. [Backend — Libraries & Stack](#5-backend--libraries--stack)
6. [Frontend — Libraries & Stack](#6-frontend--libraries--stack)
7. [Database Models](#7-database-models)
8. [API Endpoints](#8-api-endpoints)
9. [Authentication & Security](#9-authentication--security)
10. [PWA & Mobile](#10-pwa--mobile)
11. [Browser Extension](#11-browser-extension)
12. [IoT / Raspberry Pi Integration](#12-iot--raspberry-pi-integration)
13. [Running Locally](#13-running-locally)
14. [Environment Variables](#14-environment-variables)
15. [Demo Accounts](#15-demo-accounts)
16. [Deployment](#16-deployment)
17. [Testing](#17-testing)
18. [Known Limitations](#18-known-limitations)

---

## 1. Project Overview

LabOS v3 is a **full-stack, self-hosted lab management system** aimed at academic and commercial biomedical research labs. It replaces a scattered set of spreadsheets, paper SOPs, and disconnected tools with one unified application.

### Key Capabilities

| Domain | Features |
|---|---|
| Lab Operations | Protocols, SOPs, instrument booking, maintenance, workspaces |
| Electronic Lab Notebook | Rich text entries, attachments, version history, signatures |
| Sample & Biobank | Sample registry, chain-of-custody events, freezer map, biobank management |
| Grants | Hub for writing, budgeting, calendar, biosketch, version control, submissions |
| Clinical Research | IRB tracker, clinical research hub, subcontract manager |
| Equipment | Equipment hub, analytics, barcode/QR labels |
| Safety & Compliance | Incidents, CAPA, SOPs, training records, audit log |
| Procurement | Vendor intelligence, supplier directory, reagent cart, purchase orders |
| AI Integration | AI lab manager, ELN AI assistance, protocol generation via AI |
| IoT Monitoring | Real-time sensor readings, alerts, Raspberry Pi data collector |
| Administration | Role-based access, GDPR/privacy centre, security dashboard, org hierarchy |
| Meetings | Lab meetings with agenda builder, minutes editor, action items, analytics |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser / PWA / Capacitor Mobile App                        │
│  React 18 + TypeScript + Vite                                │
│  Port 5173 (dev)  ──  dist/ (production)                     │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP/JSON  (axios)
                           │ proxy: /api → :8000
┌──────────────────────────▼───────────────────────────────────┐
│  FastAPI (Python 3.12)                                        │
│  Uvicorn ASGI server   Port 8000                             │
│  JWT auth  |  Rate limiting  |  Security headers             │
└──────────────────────────┬───────────────────────────────────┘
                           │ SQLAlchemy ORM
                   ┌───────▼────────┐
                   │   SQLite (dev) │
                   │   PostgreSQL   │  ← for production
                   │   (Neon/fly.io)│
                   └────────────────┘
                                     ┌──────────────┐
                                     │ Cloudflare R2│  ← file uploads
                                     │ / AWS S3     │
                                     └──────────────┘
                                     ┌──────────────┐
                                     │ Resend / SMTP│  ← email
                                     └──────────────┘
                                     ┌──────────────┐
                                     │ Stripe       │  ← payments
                                     └──────────────┘
                                     ┌──────────────┐
                                     │ OpenAI API   │  ← AI features
                                     └──────────────┘
```

**Deployment targets**: Fly.io (backend), Vercel (frontend), or any Docker-capable VPS.

---

## 3. Directory Structure

```
lab_management_system_v2/
│
├── backend/                      FastAPI server
│   ├── app/
│   │   ├── api/                  Route handlers (one file per domain)
│   │   │   ├── auth.py
│   │   │   ├── samples.py
│   │   │   ├── grants.py
│   │   │   └── ... (50+ files)
│   │   ├── core/
│   │   │   ├── config.py         Pydantic Settings (reads .env)
│   │   │   ├── database.py       SQLAlchemy engine & session factory
│   │   │   ├── security.py       JWT tokens, bcrypt hashing
│   │   │   ├── security_middleware.py  Rate limiter, OWASP headers
│   │   │   ├── migrations.py     Auto-migration helper (adds columns)
│   │   │   └── scheduler.py      APScheduler — reminders, expiry jobs
│   │   ├── models/
│   │   │   └── models.py         All SQLAlchemy ORM models (90+ classes)
│   │   ├── schemas/
│   │   │   └── schemas.py        All Pydantic request/response schemas
│   │   └── main.py               FastAPI app factory, router registration
│   ├── tests/
│   │   ├── conftest.py           Test DB setup, rate-limit reset, fixtures
│   │   ├── test_auth.py
│   │   └── test_samples.py
│   ├── migrations/               Alembic migration scripts
│   ├── seed.py                   Seeds demo accounts and sample data
│   ├── seed_suppliers.py         Imports 150 biomedical suppliers from xlsx
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── fly.toml                  Fly.io deployment config
│   └── .env                      Local environment variables (git-ignored)
│
├── frontend/                     React SPA
│   ├── public/
│   │   ├── sw.js                 Service worker (offline-first PWA)
│   │   ├── manifest.json         PWA manifest
│   │   └── icon-*.png / icon.svg
│   ├── src/
│   │   ├── App.tsx               Root router (page-switch via state)
│   │   ├── main.tsx              React DOM mount + SW registration
│   │   ├── styles.css            Global CSS (dark theme tokens)
│   │   ├── components/           Shared UI components
│   │   │   ├── Layout.tsx        Sidebar + header shell
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── BarcodeScanner.tsx
│   │   │   ├── QRCodeGenerator.tsx
│   │   │   ├── RichELNEditor.tsx  TipTap-based rich editor
│   │   │   ├── NotebookCanvas.tsx
│   │   │   ├── ElectronicSignatureDialog.tsx
│   │   │   ├── OnboardingTour.tsx
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── BatchImport.tsx
│   │   │   ├── ExportMenu.tsx
│   │   │   ├── CookieConsent.tsx  GDPR cookie banner
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── PWAInstallPrompt.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx    JWT auth state (login/logout/me)
│   │   │   └── NavigationContext.tsx  App-wide page navigation
│   │   ├── hooks/
│   │   │   ├── useApi.ts          Generic REST hook with loading/error
│   │   │   └── usePermissions.ts  Role-based permission checks
│   │   ├── lib/
│   │   │   ├── api.ts             Axios instance with token injection
│   │   │   ├── types.ts           TypeScript interfaces matching backend
│   │   │   ├── permissions.ts     RBAC permission matrix
│   │   │   ├── export.ts          CSV/Excel export helpers
│   │   │   ├── exportDocx.ts      Word document export
│   │   │   ├── native.ts          Capacitor native bridge
│   │   │   └── utils.ts           Date formatting, colour helpers
│   │   ├── pages/                 70+ page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ELNPage.tsx
│   │   │   ├── GrantHubPage.tsx
│   │   │   ├── FreezerBiobankPage.tsx
│   │   │   ├── IoTDashboardPage.tsx
│   │   │   ├── AILabManagerPage.tsx
│   │   │   ├── PrivacyCenterPage.tsx
│   │   │   ├── SecurityDashboardPage.tsx
│   │   │   └── ... (60+ more)
│   │   ├── features/
│   │   │   ├── lab-meetings/      Full meetings feature (types, hooks, pages)
│   │   │   └── protocols/         Protocol management feature with AI generation
│   │   └── data/
│   │       └── biomedicalSuppliers.ts  Built-in supplier catalogue
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── capacitor.config.ts       Mobile app configuration
│   ├── vercel.json               Vercel SPA routing
│   └── package.json
│
├── extension/                    Browser extension (Chrome & Firefox)
│   ├── manifest.json             Chrome MV3 manifest
│   ├── manifest.firefox.json     Firefox MV2 manifest
│   ├── popup.html / popup.js     Extension popup UI
│   ├── background.js             Service worker (extension)
│   ├── options.html / options.js Settings page
│   └── content/                  Per-supplier content scripts
│       ├── thermofisher.js
│       ├── abcam.js
│       ├── cellsignal.js
│       └── generic.js
│
├── pi_sensor.py                  Raspberry Pi data collector (IoT)
├── biomedical_suppliers_master_150.xlsx  Supplier seed data
├── grant-writing-port/           Grant writing helper utilities
├── dist-extension/               Packaged extension ZIPs + store assets
├── APP_DETAILS.md                This file
├── README.md                     Quick-start README
├── DEPLOY.md                     Deployment playbook
└── SETUP-DEPLOY.md               Step-by-step deployment guide
```

---

## 4. Feature Modules

### 4.1 Dashboard
- Metrics: active samples, upcoming bookings, pending tasks, low-inventory alerts
- Recent activity feed
- Calendar summary widget
- Quick-action links to all hubs

### 4.2 Lab Hub (Protocols, Instruments, Bookings, SOPs, Maintenance)
- **Protocols**: Create, version, and execute step-by-step lab protocols; AI-assisted generation; import from protocols.io / PubMed / CrossRef / Europe PMC
- **Instruments**: Equipment registry with maintenance schedules and status tracking
- **Bookings**: Time-slot reservation for shared instruments with conflict detection
- **SOPs**: Standard Operating Procedures with status workflow (draft → review → approved → archived)
- **Maintenance Logs**: Preventive, corrective, calibration, and inspection entries

### 4.3 Electronic Lab Notebook (ELN)
- Rich-text editor powered by **TipTap v3** (bold, italic, highlights, tables, task lists, images, links)
- Notebook canvas (drag-and-resize block layout)
- Experiment results panel
- Electronic signatures (21 CFR Part 11–style)
- Version history and audit trail

### 4.4 Sample Hub
- Sample registry with status tracking (received → processing → stored → sequenced → archived → disposed)
- Chain-of-custody event log (freeze, thaw, split, transfer, dispose)
- Barcode / QR code generation and scanning
- Batch import via CSV
- Label printing page

### 4.5 Freezer & Biobank
- Visual freezer map (rack/box/slot layout)
- Biobank management with sample location tracking
- Freezer type classification (ULT −80°C, LN2, refrigerator, room temperature)

### 4.6 Inventory & Resources Hub
- Reagent and consumable inventory with low-stock alerts
- Cost tracking with budget categories and approval workflows
- Document templates library (protocols, reports, forms, checklists)

### 4.7 Reagent Cart & Procurement Hub
- Shopping cart for lab reagents with per-item approval rules
- Supplier directory (150+ pre-seeded biomedical suppliers)
- Vendor intelligence and performance scoring
- Purchase orders with status tracking
- Budget tiers and approval rules
- Borrow requests between labs

### 4.8 Grant Hub
- Unified grant management workspace
- Grant compose editor with section templates
- Budget calculator and NIH-style budget sheets
- Grant calendar with deadline tracking
- Funding opportunities browser
- Biosketch generator
- Reviewer feedback tracker
- Collaborator network management
- Reference manager (import from PubMed)
- Grant version control and submission tracker
- IRB tracker, subcontract manager, eRA Commons integration
- Progress reports and success analytics
- Support letters manager
- Writing resources library

### 4.9 Clinical Research Hub
- IRB protocol management
- Clinical trial site tracking
- Research subject management

### 4.10 AI Lab Manager
- AI-powered lab assistant (OpenAI backend)
- Protocol generation and optimisation suggestions
- AI chat panel embedded in ELN and protocol editor
- Research AI tab for literature discovery

### 4.11 IoT Dashboard
- Real-time sensor readings from lab instruments
- Alert management (critical/warning/info severity)
- Historical readings browser
- Raspberry Pi data collector (`pi_sensor.py`) posts over HTTP

### 4.12 Safety Hub (Incidents, Compliance, CAPA, Training)
- **Incidents**: Report, categorise, and track lab incidents by severity
- **CAPA**: Corrective and Preventive Action records with root-cause workflow
- **Compliance**: Compliance log with automated scoring
- **Training**: Training records and certification expiry tracking with alerts

### 4.13 Collaboration Hub
- Study/project workspaces with member management
- Activity feed (audit-level event stream)
- Feedback and suggestions board

### 4.14 Lab Meetings
- Meeting creation with type (weekly / journal club / one-on-one / retreat)
- Agenda builder with time-block items
- Attendance sheet tracking
- Minutes editor (rich-text)
- Action items panel with assignee and due-date tracking
- Progress report panel
- Meeting analytics (attendance trends, action-item completion rates)
- Video call room link integration
- Next-meeting banner for dashboard

### 4.15 Admin Hub
- User management (CRUD, role assignment, activation)
- Notifications and reminders configuration
- File manager (upload/download/delete)
- Integration settings (third-party API configuration)
- App settings (lab name, branding, defaults)
- Org hierarchy visualiser
- Security dashboard (session management, security events log)
- GDPR/Privacy centre (consent records, erasure requests, data export requests, policy versions)
- Audit log (immutable record of all create/update/delete actions)
- Cookie consent management

### 4.16 Reports & Analytics
- Custom report builder with drag-and-drop metric selection
- Equipment analytics (utilisation, downtime, booking trends)
- Lab success analytics
- Export to CSV, Excel, and Word

---

## 5. Backend — Libraries & Stack

### Core Framework

| Library | Version | Purpose |
|---|---|---|
| **FastAPI** | 0.111.0 | High-performance async REST API framework |
| **Uvicorn** | 0.29.0 | ASGI server (with `uvloop` for speed) |
| **Pydantic** | 2.x (via pydantic-settings 2.2.1) | Data validation and settings management |
| **SQLAlchemy** | 2.0.30 | ORM with both sync and async support |
| **Alembic** | 1.13.1 | Database migrations |
| **python-multipart** | 0.0.9 | Form and file upload parsing |

### Authentication & Security

| Library | Version | Purpose |
|---|---|---|
| **python-jose[cryptography]** | 3.3.0 | JWT token encoding/decoding (HS256) |
| **passlib[bcrypt]** | 1.7.4 | Password hashing with bcrypt |
| **pyotp** | 2.9.0 | TOTP-based two-factor authentication |
| **qrcode[pil]** | 7.4.2 | QR code generation for 2FA setup |

Custom middleware (`security_middleware.py`):
- **OWASP security headers** (CSP, HSTS, X-Frame-Options, Referrer-Policy, etc.)
- **In-memory rate limiter** (per-IP, per-route; no Redis dependency)

### Scheduling & Calendar

| Library | Version | Purpose |
|---|---|---|
| **APScheduler** | 3.10.4 | Background job scheduler for reminders and expiry checks |
| **icalendar** | 5.0.12 | iCal event generation for calendar export |

### Database

| Library | Version | Purpose |
|---|---|---|
| **SQLite** | (stdlib) | Development and single-server production |
| **psycopg[binary]** | 3.1.18 | PostgreSQL driver for production (Neon, Supabase, Cloud SQL) |

### Cloud & Integrations

| Library | Version | Purpose |
|---|---|---|
| **boto3** | 1.34.119 | AWS S3 / Cloudflare R2 for file storage |
| **stripe** | 9.7.0 | Payment processing (lab subscriptions/billing) |
| **resend** | 2.0.0 | Transactional email (free tier: 3,000 emails/month) |
| **httpx** | 0.27.0 | Async HTTP client for outbound API calls (OpenAI, etc.) |
| **email-validator** | 2.1.1 | Email address validation on registration |

### Testing

| Library | Version | Purpose |
|---|---|---|
| **pytest** | 8.2.0 | Test runner |
| **anyio** | (transitive) | Async test support |

---

## 6. Frontend — Libraries & Stack

### Core

| Library | Version | Purpose |
|---|---|---|
| **React** | 18.3.1 | UI component library |
| **React DOM** | 18.3.1 | DOM renderer |
| **TypeScript** | 5.4.5 | Static typing |
| **Vite** | 5.2.13 | Build tool and dev server (fast HMR) |

### Rich Editor

| Library | Version | Purpose |
|---|---|---|
| **@tiptap/react** | 3.23.4 | Headless rich-text editor framework |
| **@tiptap/starter-kit** | 3.23.4 | Basic marks and nodes (bold, italic, headings, lists, blockquote, code) |
| **@tiptap/extension-highlight** | 3.23.4 | Text highlighting |
| **@tiptap/extension-image** | 3.23.4 | Image embedding |
| **@tiptap/extension-link** | 3.23.4 | Hyperlinks |
| **@tiptap/extension-table** | 3.23.4 | Table support |
| **@tiptap/extension-table-cell** | 3.23.4 | Table cells |
| **@tiptap/extension-table-header** | 3.23.4 | Table headers |
| **@tiptap/extension-table-row** | 3.23.4 | Table rows |
| **@tiptap/extension-task-list** | 3.23.4 | Checklist / task lists |
| **@tiptap/extension-task-item** | 3.23.4 | Individual checklist items |
| **@tiptap/extension-typography** | 3.23.4 | Smart quotes, em-dashes, ellipsis |
| **@tiptap/extension-underline** | 3.23.4 | Underline formatting |
| **@tiptap/pm** | 3.23.4 | ProseMirror core (peer of TipTap) |

### Charts & Data Visualization

| Library | Version | Purpose |
|---|---|---|
| **recharts** | 2.12.7 | Responsive chart components (line, bar, pie, area, radar) |

### Calendar

| Library | Version | Purpose |
|---|---|---|
| **react-big-calendar** | 1.12.2 | Full-featured calendar views (month/week/day/agenda) |
| **moment** | 2.30.1 | Date/time localisation (required by react-big-calendar) |

### HTTP & Forms

| Library | Version | Purpose |
|---|---|---|
| **axios** | 1.7.2 | HTTP client with interceptor for JWT injection |
| **react-hook-form** | 7.52.0 | Performant form state management |

### File Handling & Export

| Library | Version | Purpose |
|---|---|---|
| **docx** | 9.6.1 | Generate `.docx` Word documents for lab reports |
| **file-saver** | 2.0.5 | Browser file-save (Save As dialog trigger) |
| **react-dropzone** | 14.2.3 | Drag-and-drop file upload zones |

### Barcodes & QR Codes

| Library | Version | Purpose |
|---|---|---|
| **bwip-js** | 4.9.0 | Barcode generation (Code 128, QR, DataMatrix, etc.) |
| **@zxing/browser** | 0.1.4 | Barcode scanning from camera (ZXing port) |

### Notifications

| Library | Version | Purpose |
|---|---|---|
| **react-hot-toast** | 2.4.1 | Non-intrusive toast notifications |

### Mobile (Capacitor)

| Library | Version | Purpose |
|---|---|---|
| **@capacitor/core** | 8.3.4 | Capacitor bridge (web-to-native) |
| **@capacitor/android** | 8.3.4 | Android target |
| **@capacitor/ios** | 8.3.4 | iOS target |
| **@capacitor/app** | 8.1.0 | App lifecycle events |
| **@capacitor/device** | 8.0.2 | Device info (model, OS, platform) |
| **@capacitor/filesystem** | 8.1.2 | File system access on device |
| **@capacitor/haptics** | 8.0.2 | Haptic feedback |
| **@capacitor/keyboard** | 8.0.3 | Keyboard management on mobile |
| **@capacitor/local-notifications** | 8.2.0 | Push-style local notifications |
| **@capacitor/network** | 8.0.1 | Network connectivity detection |
| **@capacitor/preferences** | 8.0.1 | Key-value persistent storage |
| **@capacitor/push-notifications** | 8.1.1 | Remote push notifications |
| **@capacitor/status-bar** | 8.0.2 | Status bar styling on mobile |

### Dev Tools

| Library | Version | Purpose |
|---|---|---|
| **@vitejs/plugin-react** | 4.3.1 | React Fast Refresh and JSX transform |
| **workbox-window** | 7.4.1 | Service worker registration helper |

---

## 7. Database Models

> All models live in `backend/app/models/models.py`. The DB auto-migrates at startup (new columns are added; no data loss on non-destructive changes).

### Users & Auth

| Model | Key Fields | Notes |
|---|---|---|
| `User` | id, email, full_name, hashed_password, role, is_active, mfa_enabled | Roles: superadmin, admin, pi, manager, staff, trainee |
| `UserSession` | token_hash, user_id, device_info, created_at, expires_at | Tracks active sessions for revocation |
| `SecurityEvent` | user_id, event_type, severity, ip_address, detail | Audit trail for security-related events |

### Lab Operations

| Model | Key Fields |
|---|---|
| `Protocol` | title, field, version, owner_id, steps (via WorkflowStep) |
| `ProtocolVersion` | protocol_id, version_number, content_json, created_by |
| `WorkflowStep` | protocol_id, step_order, title, instructions, estimated_minutes, requires_signoff |
| `Instrument` | name, category, location, maintenance_frequency_days, next_maintenance_date, status |
| `Booking` | instrument_id, user_id, start_time, end_time, status, purpose |
| `SOP` | title, category, status (draft→review→approved→archived), version, content |
| `MaintenanceLog` | instrument_id, type, status, scheduled_date, completed_date, technician |
| `LabNotebookEntry` | title, content, created_by, experiment_id, signed_at, signature_id |
| `ElectronicSignature` | user_id, reason, ip_address, signed_at, document_ref |

### Samples & Biobank

| Model | Key Fields |
|---|---|
| `SampleRecord` | barcode, name, sample_type, status, storage_location, collected_by |
| `SampleEvent` | sample_id, event_type (freeze/thaw/split/transfer/dispose), performed_by |
| `Freezer` | name, type (ULT/LN2/refrigerator/RT), location, capacity |
| `FreezerBox` | freezer_id, label, rows, columns |
| `FreezerSlot` | box_id, row, col, sample_id |

### Grants & Research

| Model | Key Fields |
|---|---|
| `LabUnit` | name, org_id, pi_id, type (grant/core/department) |
| `GrantVersion` | grant_id, version_number, content_json, created_by |
| `GrantSubmission` | title, agency, status (draft/submitted/under_review/funded/rejected), deadline |
| `BiosketchProfile` | user_id, biography, positions, education, contributions, publications |
| `Reference` | title, authors, journal, year, doi, pubmed_id, citation_key |

### Inventory & Procurement

| Model | Key Fields |
|---|---|
| `InventoryItem` | name, sku, quantity, unit, low_stock_threshold, location, supplier_id |
| `Supplier` | name, category, contact, website, approval_status |
| `SupplierReview` | supplier_id, reviewer_id, rating, comment |
| `PurchaseOrder` | item_name, quantity, unit_price, total, supplier_id, status, requester_id |
| `ReagentCartItem` | user_id, catalog_number, product_name, quantity, status, supplier |
| `CartItemMeta` | cart_item_id, key, value |
| `LabBudget` | name, total_amount, spent_amount, fiscal_year, category |
| `ApprovalRule` | lab_id, threshold_amount, requires_pi, requires_admin |
| `RestrictedChemical` | name, cas_number, hazard_class, max_quantity |
| `BorrowRequest` | item_id, requester_id, from_lab, to_lab, status |
| `CostEntry` | category, amount, description, date, approved_by |

### Safety & Compliance

| Model | Key Fields |
|---|---|
| `IncidentReport` | title, severity, description, reported_by, resolution |
| `CapaRecord` | title, severity, root_cause, corrective_action, preventive_action, status |
| `ComplianceLog` | category, result, checked_by, notes |
| `TrainingRecord` | user_id, title, completed_on, expires_on, status |
| `ReagentDisposalLog` | reagent_name, quantity, disposal_method, disposed_by |

### GDPR / Privacy

| Model | Key Fields |
|---|---|
| `ConsentRecord` | user_id, purpose, status, consented_at |
| `DataErasureRequest` | user_id, reason, status, requested_at, processed_at |
| `DataExportRequest` | user_id, status, download_url, expires_at |
| `PrivacyPolicyVersion` | version_number, content, effective_date |

### IoT

| Model | Key Fields |
|---|---|
| `IoTSensor` | name, sensor_type, unit, location, instrument_id |
| `IoTReading` | sensor_id, value, timestamp |
| `IoTAlert` | sensor_id, severity, message, acknowledged_at |

### Meetings & Collaboration

| Model | Key Fields |
|---|---|
| `LabMeeting` | title, meeting_type, scheduled_at, status, agenda_json, minutes, attendees_json |
| `StudyWorkspace` | name, description, members_json, status |
| `CalendarEvent` | title, start_time, end_time, event_type, created_by |

### Org Hierarchy

| Model | Key Fields |
|---|---|
| `Organization` | name, type, parent_id |
| `Site` | name, org_id, address |
| `LabUnit` | name, site_id, pi_id, type |
| `LabMembership` | user_id, lab_unit_id, role, status |

---

## 8. API Endpoints

The full interactive docs are at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc`.

### Auth (`/api/auth/`)
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Email + password → JWT access token |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/auth/users` | List users (admin) |
| POST | `/api/auth/users` | Create user (admin) |
| PUT | `/api/auth/users/{id}` | Update user |
| DELETE | `/api/auth/users/{id}` | Deactivate user |
| POST | `/api/auth/mfa/setup` | Generate TOTP QR code |
| POST | `/api/auth/mfa/verify` | Verify TOTP code |

### Core Modules
Each module follows a consistent CRUD pattern at `/api/<resource>/`:

| Router | Prefix | Resources |
|---|---|---|
| protocols | `/api/protocols` | Protocol CRUD, version history |
| instruments | `/api/instruments` | Equipment registry |
| scheduling | `/api/scheduling` | Bookings / calendar events |
| tasks | `/api/tasks` | Task management |
| training | `/api/training` | Training records |
| samples | `/api/samples` | Sample registry + events |
| inventory | `/api/inventory` | Inventory items |
| incidents | `/api/incidents` | Incident reports |
| sops | `/api/sops` | Standard Operating Procedures |
| maintenance | `/api/maintenance` | Maintenance logs |
| costs | `/api/costs` | Cost entries |
| grants | `/api/grants` | Grant management |
| lab_notebook | `/api/lab-notebook` | ELN entries |
| reagents | `/api/reagents` | Reagent management |
| reagent_cart | `/api/reagent-cart` | Shopping cart |
| suppliers | `/api/suppliers` | Supplier directory |
| freezer | `/api/freezer` | Freezer / biobank |
| meetings | `/api/meetings` | Lab meetings |
| iot | `/api/iot` | Sensor readings and alerts |
| capa | `/api/capa` | CAPA records |
| references | `/api/references` | Reference manager |
| biosketch | `/api/biosketch` | Biosketch profiles |
| grant_submissions | `/api/grant-submissions` | Submission tracker |
| grant_versions | `/api/grant-versions` | Version control |
| org_hierarchy | `/api/org-hierarchy` | Org/site/lab structure |
| payments | `/api/payments` | Stripe payment methods |
| lab_members | `/api/lab-members` | Lab membership |
| ai | `/api/ai` | AI completions (OpenAI proxy) |

### Privacy & Security
| Router | Prefix |
|---|---|
| consent | `/api/consent` |
| gdpr | `/api/gdpr` |
| security | `/api/security` |
| signatures | `/api/signatures` |
| audit | `/api/audit` |

---

## 9. Authentication & Security

### JWT Authentication
- Tokens are signed with **HS256** using a 48-character random `SECRET_KEY`
- Default expiry: **2 hours** (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Every request must include `Authorization: Bearer <token>`
- All active sessions are tracked in `user_sessions` table for revocation

### Role-Based Access Control (RBAC)

| Role | Hierarchy | Typical Permissions |
|---|---|---|
| `superadmin` | 6 | Full system access |
| `admin` | 5 | User management, all modules |
| `pi` | 4 | Lab management, grants, protocols |
| `manager` | 3 | Bookings, tasks, procurement |
| `staff` | 2 | Day-to-day lab operations |
| `trainee` | 1 | Read-only + own tasks |

### Security Middleware
- **OWASP headers**: CSP, HSTS, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **Rate limiting**: In-memory per-IP sliding window
  - Login: 10 req/min
  - User list/create: 30 req/min
  - GDPR: 5 req/min
  - Default: 120 req/min

### Two-Factor Authentication (2FA)
- TOTP-based (Google Authenticator, Authy compatible)
- Setup generates a QR code via `qrcode` library
- Verification via `pyotp`

---

## 10. PWA & Mobile

### Progressive Web App
- **Service worker** (`public/sw.js`) implements offline-first caching
  - Network-first for API calls (with offline fallback for key GET routes)
  - Cache-first for static assets (JS, CSS, fonts, images)
  - SPA shell served from cache when offline
- **Web App Manifest** (`public/manifest.json`) enables "Add to Home Screen"
- Background sync queues offline mutations for replay on reconnect
- Push notification support for lab alerts (IoT deadlines, expiry reminders)
- PWA shortcuts: Dashboard, ELN, IoT Monitor, Sample Hub, Grant Hub, Freezer Map

### Mobile App (Capacitor)
Build a native Android or iOS app from the same codebase:
```bash
cd frontend
npm run cap:android   # Build + sync + open Android Studio
npm run cap:ios       # Build + sync + open Xcode
```

---

## 11. Browser Extension

A Chrome/Firefox extension that adds a **"Send to LabOS Cart"** button on supplier websites.

**Supported suppliers** (content scripts):
- ThermoFisher Scientific
- Abcam
- Cell Signaling Technology
- Generic fallback (any product page)

**Extension files**:
- `manifest.json` — Chrome MV3 (Manifest Version 3)
- `manifest.firefox.json` — Firefox MV2
- `popup.html/js` — Configuration and status popup
- `options.html/js` — API server URL configuration
- `background.js` — Extension service worker

**Packaged zips** in `dist-extension/`:
- `labos-extension-1.0.0-chrome.zip`
- `labos-extension-1.0.0-firefox.zip`

---

## 12. IoT / Raspberry Pi Integration

`pi_sensor.py` runs on a Raspberry Pi to collect sensor data and POST it to the backend.

```python
# Example usage
python3 pi_sensor.py --sensor-id 1 --value 23.5 --backend http://your-labos-server/api
```

The backend `IoTSensor`, `IoTReading`, and `IoTAlert` models store the data. The frontend `IoTDashboardPage` visualises live readings with Recharts line charts and displays alerts.

---

## 13. Running Locally

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** / **npm 10+**

### Backend

```bash
cd backend

# Create and activate virtual environment
python3.12 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed the database with demo data
python seed.py                     # Creates admin/manager/staff accounts
python seed_suppliers.py           # Imports 150 biomedical suppliers

# Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend available at: `http://localhost:8000`
Swagger UI: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: `http://localhost:5173`

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:8000`.

### Running Tests

```bash
cd backend
venv/bin/python3 -m pytest tests/ -v
```

Expected result: **19 tests pass**.

---

## 14. Environment Variables

All variables are loaded from `backend/.env`. See `.env.example` for the full template.

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | *(required)* | JWT signing key — must be ≥32 random characters |
| `DATABASE_URL` | `sqlite:///./lab.db` | SQLAlchemy DB URL (use `postgresql+psycopg://...` for production) |
| `UPLOAD_DIR` | `./uploads` | Where uploaded files are stored locally |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed origins (JSON array or comma-separated) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `120` | JWT token lifetime in minutes |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `OPENAI_API_KEY` | *(optional)* | Enable AI features (protocol generation, AI chat) |
| `SMTP_HOST` | *(optional)* | SMTP server for email delivery |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | *(optional)* | SMTP username |
| `SMTP_PASSWORD` | *(optional)* | SMTP password |
| `SMTP_FROM` | `labos@lab.local` | From address for outgoing emails |
| `SMTP_TLS` | `true` | Use STARTTLS |
| `AWS_ACCESS_KEY_ID` | *(optional)* | S3/R2 access key for file storage |
| `AWS_SECRET_ACCESS_KEY` | *(optional)* | S3/R2 secret key |
| `AWS_S3_BUCKET` | *(optional)* | Bucket name |
| `AWS_S3_ENDPOINT_URL` | *(optional)* | Custom endpoint for Cloudflare R2 |
| `STRIPE_SECRET_KEY` | *(optional)* | Stripe API key for payments |
| `STRIPE_WEBHOOK_SECRET` | *(optional)* | Stripe webhook signing secret |

---

## 15. Demo Accounts

Seeded by `backend/seed.py`:

| Email | Password | Role |
|---|---|---|
| `admin@lab.local` | `Admin123!` | admin |
| `manager@lab.local` | `Manager123!` | manager |
| `staff@lab.local` | `Staff123!` | staff |

Test accounts used by the test suite:

| Email | Password | Role |
|---|---|---|
| `testadmin@lab.local` | `Admin123!` | admin |
| `teststaff@lab.local` | `Staff123!` | staff |

---

## 16. Deployment

### Backend on Fly.io
```bash
cd backend
fly launch          # first time only
fly secrets set SECRET_KEY=<your-key> DATABASE_URL=<postgres-url>
fly deploy
```

The `fly.toml` and `Dockerfile` are pre-configured.

### Frontend on Vercel
```bash
cd frontend
vercel --prod
```

Set the environment variable `VITE_API_URL` to your backend URL if deploying separately.

The `vercel.json` rewrites all routes to `index.html` for SPA routing.

### Docker (Backend)
```bash
cd backend
docker build -t labos-backend .
docker run -p 8000:8000 \
  -e SECRET_KEY=<key> \
  -e DATABASE_URL=<url> \
  labos-backend
```

See `DEPLOY.md` and `SETUP-DEPLOY.md` for full deployment playbooks.

---

## 17. Testing

```
backend/tests/
├── conftest.py          Test DB setup, rate-limit reset, session cleanup
├── test_auth.py         Authentication endpoints (login, me, user CRUD)
└── test_samples.py      Sample CRUD and event log
```

**Test isolation** is ensured by:
- Fresh SQLite test DB (dropped and recreated per session)
- In-memory rate-limit buckets cleared before each test
- User sessions flushed before each test to prevent token-hash collisions

Run: `venv/bin/python3 -m pytest tests/ -v`

---

## 18. Known Limitations

| Area | Limitation |
|---|---|
| Database | SQLite is single-writer; switch to PostgreSQL for multi-user production |
| File storage | Local `uploads/` folder in dev; configure S3/R2 for production |
| Email delivery | SMTP optional; without it, reminders are dashboard-only |
| AI features | Require a valid `OPENAI_API_KEY`; template-based fallback is used without it |
| Rate limiter | In-memory — resets on server restart; use Redis for multi-instance |
| Bundle size | Frontend main bundle is ~3.7 MB (gzip: ~960 KB) — consider code-splitting for slow connections |
| 2FA | TOTP setup UI exists but enforcement is optional per user |
| PWA push | Push notification server integration is not wired (infrastructure hook is ready) |
| Video calls | Video call room links are external (Zoom/Meet) — WebRTC is not built-in |
