# LabOS — Data Privacy & Flow Documentation

**Version:** 1.0  
**Last Updated:** 2026-01-01  
**Purpose:** For university IT, legal, and procurement teams evaluating LabOS

---

## Summary Statement

> **All data entered into LabOS remains exclusively on the institution's own hardware and infrastructure. The vendor (LabOS) has zero access to any institutional data at any time. No data is transmitted to external servers. No telemetry, analytics, or usage data is collected.**

---

## 1. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  INSTITUTION BOUNDARY                    │
│                                                         │
│  User Browser ──HTTPS──▶ LabOS Server ──▶ Database      │
│                              │                           │
│                              └──▶ File Storage           │
│                                                         │
│  ✗ No data ever leaves this boundary to vendor          │
└─────────────────────────────────────────────────────────┘

        LabOS Vendor: ZERO data access
```

---

## 2. What Data LabOS Stores

All data is stored **on your servers only**.

### User Data
| Field | Purpose | Stored Where |
|---|---|---|
| Name, email address | Account identification | Your database |
| Password (bcrypt hash) | Authentication | Your database |
| Role, department | Access control | Your database |
| Last login timestamp | Security auditing | Your database |
| Profile preferences | UX settings | Your database |

### Laboratory Data
| Data Type | Examples | Stored Where |
|---|---|---|
| Samples | IDs, types, storage locations, metadata | Your database |
| Reagents | Names, lots, concentrations, expiry | Your database |
| Experiments | Protocols, results, notes, attachments | Your database |
| Protocols/SOPs | Text, versions, approval records | Your database |
| Equipment | Inventory, maintenance logs | Your database |
| Safety incidents | Reports, corrective actions | Your database |
| Audit trail | All user actions with timestamps | Your database |

### Files and Attachments
| Type | Stored Where |
|---|---|
| Protocol documents, PDFs | Your server filesystem (`/backend/uploads/`) |
| Images and attachments | Your server filesystem |
| Exported reports | Generated on-demand, downloaded to user |

---

## 3. What Data LabOS Does NOT Collect

| Data Type | Collected? | Notes |
|---|---|---|
| Usage analytics | ❌ No | No page views, click tracking, or feature analytics |
| Error / crash reports | ❌ No | Errors logged locally only |
| Performance telemetry | ❌ No | No APM or monitoring data sent to vendor |
| User behaviour | ❌ No | No tracking of how users interact with the software |
| IP addresses | ❌ No | Not sent to vendor (stored in your own audit log) |
| Search queries | ❌ No | All searches performed locally |
| Exported data | ❌ No | Exports go directly to the user's browser |

---

## 4. Third-Party Services (Optional, Institution-Configured)

The following integrations are **entirely optional** and connect only to **your institution's own services**:

| Service | Purpose | Who Configures It | Data Sent To |
|---|---|---|---|
| SMTP email server | Notifications | You (your own mail server) | Your mail server only |
| MQTT broker | IoT sensor data | You (your own broker) | Your broker only |
| PostgreSQL database | Production database | You (your own DB server) | Your DB server only |

**LabOS never connects to any third-party analytics, tracking, or cloud services.**

---

## 5. Data Retention

Data is retained for as long as you choose. LabOS provides:

- **Manual deletion:** Admins can delete records directly
- **GDPR erasure requests:** Users can request account deletion via Privacy Center
- **Data export:** Users can export their personal data (GDPR Art. 20)
- **Audit log retention:** Configurable — default indefinite (your decision)

There is no automatic deletion. All retention decisions are made by your institution.

---

## 6. Data Subject Rights (GDPR)

LabOS provides built-in tools for GDPR compliance:

| Right | How Supported |
|---|---|
| Right of Access (Art. 15) | Self-service data export in Privacy Center |
| Right to Rectification (Art. 16) | Admin can edit any user record |
| Right to Erasure (Art. 17) | Erasure request workflow in Privacy Center |
| Right to Portability (Art. 20) | JSON data export in Privacy Center |
| Consent Management | Granular consent controls in Privacy Center |
| Audit Trail | All data access and changes logged |

**Note:** As the data controller, your institution is responsible for responding to data subject requests. LabOS provides the tools; compliance is your responsibility.

---

## 7. Roles and Responsibilities

| Party | Role | Responsibilities |
|---|---|---|
| **Your Institution** | Data Controller | Decide purposes for processing; respond to data subject rights; ensure legal basis for processing; maintain security of infrastructure |
| **LabOS Vendor** | Software Provider | Provide software with privacy-by-design features; maintain software security; provide documentation |
| **LabOS Vendor** | NOT a Data Processor | Vendor never processes your data — no Data Processing Agreement (DPA) is required |

Because LabOS is on-premise and the vendor never accesses your data, **no Data Processing Agreement (DPA) or Business Associate Agreement (BAA) with the vendor is required**.

If you use LabOS to process personal health information, your institution handles HIPAA compliance as the covered entity.

---

## 8. Security Controls Summary

| Control | Implementation |
|---|---|
| Authentication | bcrypt password hashing, account lockout, session expiry |
| Authorisation | Role-based access control (6 roles) |
| Encryption in transit | HTTPS/TLS 1.2+ via nginx |
| Encryption at rest | Filesystem-level (your responsibility) |
| Audit logging | All actions logged with user, timestamp, IP |
| Input validation | Server-side validation on all API endpoints |
| SQL injection prevention | ORM-based queries (SQLAlchemy) |
| XSS prevention | React DOM rendering, CSP headers |

---

## 9. Privacy by Design Principles

LabOS is built with the following privacy principles:

1. **Data Minimisation:** Only the data necessary for laboratory operations is collected
2. **Purpose Limitation:** Data is used only for the purpose it was entered
3. **Storage Limitation:** No automatic replication to external systems
4. **Integrity & Confidentiality:** Role-based access, audit trail, encrypted transmission
5. **Transparency:** This document describes all data practices
6. **Accountability:** Audit trail enables accountability for all data access

---

## 10. Contact

For privacy questions regarding LabOS software:  
**Email:** privacy@labos.app  
**Response time:** 5 business days

For questions about your institution's data practices:  
Contact your institution's Data Protection Officer (DPO).
