# LabOS — Vendor Security Questionnaire (Pre-filled)

**Purpose:** Ready-to-send responses for university IT/procurement security questionnaires  
**Version:** 1.0 · Last Updated: 2026-01-01

Complete this form and attach `SECURITY.md` and `DATA_PRIVACY.md` when submitting to university IT departments.

---

## Section A: Company & Product Information

**Q1. Company legal name:**  
LabOS

**Q2. Product name and version:**  
LabOS v3 — Laboratory Operations System

**Q3. Product description:**  
On-premise laboratory management system for research institutions. Manages samples, reagents, protocols, experiments, equipment, safety, and compliance workflows.

**Q4. Deployment model:**  
☑ On-premise (installed on institution's own servers)  
☐ SaaS / Cloud  
☐ Hybrid  

**Q5. Is source code available for review?**  
Available under NDA for institutional customers. Contact sales@labos.app.

---

## Section B: Data Handling

**Q6. What data does the software collect or process?**  
Only data explicitly entered by your institution's users: laboratory records, user accounts, protocol documents, safety reports, and audit logs. All data is stored exclusively on your institution's own servers.

**Q7. Does the vendor have access to institutional data?**  
**No.** The software is fully on-premise. The vendor has zero access to any data at any time.

**Q8. Is any data transmitted to vendor servers or third parties?**  
**No.** LabOS makes no outbound connections to vendor servers. No data is ever transmitted outside your institution's network.

**Q9. Does the software collect telemetry, analytics, or usage data?**  
**No.** Zero telemetry is collected or transmitted. No page views, feature analytics, crash reports, or performance data are sent anywhere.

**Q10. Does the software require internet access to function?**  
**No.** LabOS operates entirely offline within your network. Internet access is not required for any core functionality.

**Q11. Does the software connect to any third-party services?**  
Optional integrations only: SMTP email (your mail server) and MQTT IoT sensors (your broker). These are institution-configured and connect only to servers within your own network. Both are disabled by default.

**Q12. Where is data stored?**  
Exclusively on the institution's own servers in a SQLite or PostgreSQL database and local filesystem.

**Q13. Is a Data Processing Agreement (DPA) required?**  
No. The vendor never processes institutional data, so no DPA is required under GDPR.

---

## Section C: Authentication & Access Control

**Q14. What authentication methods are supported?**  
Username/email and password. LDAP/Active Directory SSO available in enterprise tier.

**Q15. How are passwords stored?**  
bcrypt hash with cost factor 12. Passwords are never stored in plaintext or reversible form.

**Q16. Is multi-factor authentication (MFA) supported?**  
Available in enterprise tier. Base version uses strong password policy with account lockout.

**Q17. What is the account lockout policy?**  
Account locked after 5 failed login attempts. 15-minute automatic unlock. Lockout events logged to audit trail.

**Q18. What is the session timeout policy?**  
Sessions expire after 2 hours of inactivity. Configurable by administrator.

**Q19. Is role-based access control implemented?**  
Yes. Six roles: Superadmin, Admin, Principal Investigator, Manager, Staff, Trainee. Each role has specific, least-privilege access permissions.

---

## Section D: Encryption

**Q20. Is data encrypted in transit?**  
Yes. All communication uses HTTPS/TLS 1.2+ enforced by the nginx reverse proxy. HTTP requests are redirected to HTTPS.

**Q21. Is data encrypted at rest?**  
Transit encryption is handled by LabOS. At-rest encryption of the database and filesystem is the responsibility of the institution's IT team (OS-level encryption such as LUKS, BitLocker, or database TDE is recommended).

**Q22. What encryption standards are used?**  
TLS 1.2+ for transit. bcrypt (cost 12) for passwords. AES-256 for at-rest encryption when configured at OS level.

---

## Section E: Audit & Logging

**Q23. Does the software maintain an audit trail?**  
Yes. Comprehensive audit log of all user actions including: login/logout, data creation/modification/deletion, protocol approvals, electronic signatures, permission changes, and failed authentication attempts.

**Q24. What information is captured in audit logs?**  
Timestamp, user ID, user email, IP address, action type, affected record ID, and before/after values for data changes.

**Q25. Are audit logs protected from tampering?**  
Audit logs are append-only in the database. Administrator access controls prevent modification.

**Q26. How long are audit logs retained?**  
Indefinitely by default. Configurable by institution. Never deleted automatically.

---

## Section F: Vulnerabilities & Patching

**Q27. How are security vulnerabilities disclosed and patched?**  
Report to security@labos.app. Response within 48 business hours. Critical patches released within 14 days of verified report.

**Q28. Are software components reviewed for known vulnerabilities?**  
Yes. Dependencies are reviewed for CVEs prior to each release.

**Q29. When was the last security review of the software?**  
Available on request. Contact security@labos.app.

**Q30. Does the institution need to patch/update the software?**  
Updates are optional and institution-controlled. The institution decides when to apply updates. Critical security patches are announced via email.

---

## Section G: Incident Response

**Q31. What is the vendor's incident response process?**  
The vendor is not involved in incidents at the institution level since the vendor has no access to systems. The institution's own incident response plan applies. See SECURITY.md Section 8 for recommended steps.

**Q32. Is there a data breach notification process?**  
Because the vendor has no access to institutional data, breaches of institutional data are handled entirely by the institution under their own policies. If a vulnerability in LabOS software contributed to a breach, the vendor will provide technical support and root cause analysis.

---

## Section H: Business Continuity

**Q33. What happens to our data if the vendor ceases operations?**  
Because LabOS is on-premise, your data is entirely in your control. If the vendor ceases operations, you retain full access to your data indefinitely. The software will continue to operate without vendor involvement.

**Q34. Is source code escrowed?**  
Source code escrow arrangements available for enterprise customers. Contact sales@labos.app.

---

## Section I: Compliance

**Q35. Is the software HIPAA compliant?**  
LabOS provides features designed to support HIPAA-compliant deployments (audit trails, access controls, encryption in transit). HIPAA compliance is the responsibility of the institution as the covered entity. The vendor is not a Business Associate and no BAA is required.

**Q36. Does the software support 21 CFR Part 11?**  
LabOS provides features that support 21 CFR Part 11 requirements: electronic records, audit trails, electronic signatures, access controls, and system validation documentation. Formal 21 CFR Part 11 validation (IQ/OQ/PQ) is the institution's responsibility.

**Q37. Is the software GLP compliant?**  
LabOS is designed to support GLP workflows including sample traceability, audit trails, protocol management, and instrument calibration tracking. GLP compliance is achieved through institutional practices; the software provides the tools to support them.

**Q38. Does the vendor hold any certifications (SOC 2, ISO 27001, etc.)?**  
The vendor does not currently hold SOC 2 or ISO 27001 certifications. These certifications audit vendor-hosted systems; as an on-premise product where the vendor never handles customer data, these certifications are not applicable to the data security of your installation. Your institution's own IT security controls govern the security of your LabOS deployment.

---

## Attachments

Please also review:
- `SECURITY.md` — Full security architecture and controls documentation
- `DATA_PRIVACY.md` — Data flow and privacy documentation
- `EULA.md` — End User License Agreement

---

*For additional questions: sales@labos.app | security@labos.app | privacy@labos.app*
