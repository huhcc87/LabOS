# LabOS — Security Documentation

**Version:** 1.0  
**Last Updated:** 2026-01-01  
**Classification:** Public — Share freely with IT departments and procurement teams

---

## 1. Architecture Overview

LabOS is a **fully on-premise application**. There is no cloud component, no central server, and no vendor-controlled infrastructure.

```
Institution Network
┌─────────────────────────────────────────────┐
│                                             │
│  ┌──────────────┐     ┌──────────────────┐  │
│  │   Browser    │────▶│  LabOS Frontend  │  │
│  │  (any device)│     │  (Nginx / Static)│  │
│  └──────────────┘     └────────┬─────────┘  │
│                                │             │
│                       ┌────────▼─────────┐  │
│                       │  LabOS Backend   │  │
│                       │  (FastAPI/Python)│  │
│                       └────────┬─────────┘  │
│                                │             │
│                       ┌────────▼─────────┐  │
│                       │    Database      │  │
│                       │ (SQLite / Postgres│  │
│                       └──────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
         ▲ No outbound connections to vendor
```

**Key principle:** LabOS never initiates outbound connections to vendor servers. All data stays within your institution's network boundary.

---

## 2. Data Storage

| Data Type | Storage Location | Controlled By |
|---|---|---|
| User accounts & passwords | Your database (bcrypt hashed) | Institution |
| Sample, reagent, experiment records | Your database | Institution |
| Uploaded files (SOPs, images) | Your local filesystem | Institution |
| Audit logs | Your database | Institution |
| Session tokens | Your server memory / JWT | Institution |
| Telemetry / usage data | **None collected** | N/A |

**LabOS collects zero telemetry.** No usage statistics, error reports, feature analytics, or any other data is sent to the vendor.

---

## 3. Authentication & Access Control

### Password Security
- Passwords hashed with **bcrypt** (cost factor 12) — never stored in plaintext
- Minimum requirements: 8 characters, uppercase, lowercase, number, special character
- Account lockout after **5 failed attempts** (15-minute lockout)
- Session expiry after **2 hours of inactivity**

### Role-Based Access Control (RBAC)
| Role | Access Level |
|---|---|
| Superadmin | Full system access including user management |
| Admin | Lab management, reports, user management |
| PI (Principal Investigator) | Full lab data access, protocol approval |
| Manager | Lab operations, team oversight |
| Staff | Own data + assigned experiments |
| Trainee | Read-only access to assigned materials |

### Session Management
- JWT tokens with configurable expiry
- Tokens stored in browser localStorage (not cookies, no CSRF risk)
- All authentication events logged to audit trail

---

## 4. Data Encryption

### In Transit
- All communication uses **HTTPS/TLS 1.2+** (enforced by your web server)
- HTTP requests are rejected or redirected to HTTPS
- WebSocket connections for IoT sensors use **WSS** (encrypted)

### At Rest
- **SQLite deployment:** Data stored in plaintext SQLite file — recommend enabling filesystem-level encryption (e.g., LUKS on Linux, BitLocker on Windows) at the OS level
- **PostgreSQL deployment:** Supports transparent data encryption (TDE) — configure at database level
- Uploaded files: Stored on your filesystem — apply OS-level encryption

### Passwords
- bcrypt hash with salt — industry standard for password storage
- Cannot be reversed or decrypted

---

## 5. Audit Trail

LabOS maintains a comprehensive, tamper-evident audit log of:

- All user login and logout events
- All data create, update, and delete operations
- Protocol approvals and electronic signatures
- User permission changes
- Failed authentication attempts
- Data export requests

Audit logs are append-only and include: timestamp, user ID, IP address, action type, affected record, and before/after values for changes.

**21 CFR Part 11 note:** Audit logs support electronic records requirements. Consult your compliance team for validation documentation.

---

## 6. Network Security Recommendations

The following are **your institution's responsibility** but LabOS is designed to support these configurations:

| Control | Recommendation |
|---|---|
| Network isolation | Deploy LabOS on a dedicated VLAN or subnet |
| Firewall | Allow inbound 443 (HTTPS) only; block all other inbound ports |
| VPN | Require VPN for remote access to LabOS |
| Reverse proxy | Use nginx or Apache as reverse proxy (included in deployment) |
| Port exposure | Never expose the backend port (8000) directly to the internet |
| Database | Never expose database port externally; bind to localhost only |

---

## 7. Vulnerability Management

**Your responsibilities:**
- Apply OS security patches monthly (critical patches within 7 days)
- Keep Python and Node.js runtimes updated
- Run regular vulnerability scans on the server hosting LabOS
- Conduct annual penetration testing per your institution's policy

**Our commitment:**
- We review dependencies for known CVEs in each release
- Security issues can be reported to security@labos.app
- We follow responsible disclosure — critical patches released within 14 days of verified report

**Dependency security:**
- Frontend: React 18, Vite — actively maintained
- Backend: FastAPI, SQLAlchemy, Pydantic — actively maintained
- No abandoned or unmaintained core dependencies

---

## 8. Incident Response

**Your institution is responsible** for incident response. Recommended steps:

1. **Detect:** Monitor server logs and LabOS audit trail for anomalies
2. **Contain:** Isolate the server from the network if compromise is suspected
3. **Assess:** Review audit logs to determine scope of any breach
4. **Notify:** Follow your institution's breach notification policy
5. **Recover:** Restore from backup; rotate all credentials; review access logs
6. **Review:** Document lessons learned; update security controls

**If you believe you have found a security vulnerability in LabOS:**  
Email: security@labos.app  
Expected response time: 48 business hours

---

## 9. Backup & Recovery

**LabOS does not perform backups.** You are responsible for:

- Daily automated backups of the database file or PostgreSQL database
- Regular backups of the uploads directory
- Testing restore procedures at least quarterly
- Off-site or encrypted cloud backup of backup archives
- Documented Recovery Time Objective (RTO) and Recovery Point Objective (RPO)

**Recommended backup schedule:**
- Database: Daily automated backup, 30-day retention
- Uploads: Weekly incremental, monthly full, 90-day retention

---

## 10. Open Source Licenses

LabOS uses open source components. Major dependencies:

| Package | License | Use |
|---|---|---|
| React | MIT | Frontend framework |
| FastAPI | MIT | Backend API framework |
| SQLAlchemy | MIT | Database ORM |
| Pydantic | MIT | Data validation |
| Nginx | BSD | Web server |
| Python | PSF | Runtime |

All dependencies use permissive licenses (MIT, BSD, Apache 2.0). No GPL-licensed components are included in the distributed application.

Full dependency list available via:
```bash
cd frontend && npx license-checker --summary
cd backend && pip-licenses
```

---

## 11. Vendor Security Questionnaire (Pre-filled)

Common questions from university IT departments:

**Q: Does the software make outbound internet connections?**  
A: No. LabOS makes no outbound connections. Optional features (SMTP email, MQTT IoT sensors) only connect to servers you configure within your network.

**Q: Does the vendor have access to our data?**  
A: No. The software is fully on-premise. The vendor has zero access to your data at any time.

**Q: Is data encrypted in transit?**  
A: Yes, via HTTPS/TLS 1.2+ enforced by the nginx reverse proxy included in deployment.

**Q: Does the software collect telemetry or usage data?**  
A: No. Zero telemetry is collected or transmitted.

**Q: Does the software require internet access to function?**  
A: No. LabOS operates entirely offline within your network.

**Q: What authentication methods are supported?**  
A: Username/password with bcrypt hashing. LDAP/SSO integration available in enterprise tier.

**Q: Are passwords stored securely?**  
A: Yes. bcrypt with cost factor 12. Passwords are never stored in plaintext.

**Q: Does the software have an audit trail?**  
A: Yes. Comprehensive audit trail covering all user actions, data changes, and authentication events.

**Q: What is the software's vulnerability disclosure process?**  
A: Email security@labos.app. Response within 48 business hours. Critical patches released within 14 days.

**Q: Is source code available for review?**  
A: Available for review under NDA for enterprise customers. Contact sales@labos.app.
