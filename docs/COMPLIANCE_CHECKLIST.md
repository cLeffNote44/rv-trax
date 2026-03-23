# SOC 2 Compliance Checklist

This checklist tracks RV Trax readiness against the SOC 2 Type II Trust Services Criteria. Items marked with `[x]` are implemented; items marked with `[ ]` are identified gaps requiring remediation.

**Last reviewed:** 2026-03-23
**Document owner:** Engineering Lead
**Review cadence:** Quarterly
**Reference:** See `docs/SECURITY_CONTROLS.md` for detailed control descriptions.

---

## CC1 -- Control Environment

The control environment sets the tone for the organization's commitment to security.

- [ ] Security policies documented and formally approved by leadership
- [x] Code of Conduct published (`CODE_OF_CONDUCT.md`)
- [x] Roles and responsibilities defined (RBAC with 6 roles: owner, manager, sales, service, porter, viewer)
- [ ] Employee security training program established with annual refresher
- [ ] Background checks required for employees with production system access
- [x] Separation of duties enforced (non-superuser database role for application, admin routes require separate token)
- [ ] Security policy acknowledgment required for all new employees
- [x] Incident response contact defined (security email in `SECURITY.md`)

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| Formal security policies | Engineering Lead | Q2 2026 | Draft information security policy, acceptable use policy |
| Security training program | Engineering Lead | Q2 2026 | Annual training with phishing simulation |
| Background checks | HR | Q2 2026 | For employees with production access |

---

## CC2 -- Communication and Information

Controls ensure that security-relevant information is communicated effectively.

- [x] Security policy published (`SECURITY.md`)
- [x] Vulnerability reporting process documented (email-based, 48-hour acknowledgment SLA)
- [x] API documentation available (Swagger UI via `@fastify/swagger`)
- [x] Architecture documentation maintained (`docs/ARCHITECTURE.md`)
- [x] Database schema documented (`docs/DATABASE.md`)
- [x] API endpoint catalog maintained (`docs/api-endpoint-catalog.md`)
- [ ] Customer-facing security documentation (trust center / security FAQ)
- [ ] Internal security wiki or knowledge base
- [x] Conventional commit messages for change traceability

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| Customer-facing security docs | Product | Q3 2026 | Public trust center page |
| Internal security wiki | Engineering Lead | Q3 2026 | Runbooks, procedures, escalation paths |

---

## CC3 -- Risk Assessment

Controls for identifying, analyzing, and managing risks.

- [ ] Annual risk assessment conducted and documented
- [x] Dependency vulnerability scanning automated (Dependabot)
- [x] Static analysis for security vulnerabilities (CodeQL on every PR and push to `main`)
- [ ] Penetration testing scheduled (annual cadence)
- [ ] Third-party vendor risk assessment process
- [ ] Risk register maintained and reviewed quarterly
- [x] Security-focused ESLint rules enforced in CI
- [ ] Threat modeling performed for critical features

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| Annual risk assessment | Engineering Lead | Q2 2026 | Use NIST CSF or ISO 27005 framework |
| Penetration testing | Engineering Lead | Q2 2026 | Engage third-party firm; annual cadence |
| Vendor risk assessment | Engineering Lead | Q3 2026 | Assess Stripe, Twilio, AWS/hosting, Sentry |
| Risk register | Engineering Lead | Q2 2026 | Track risks, owners, mitigations |
| Threat modeling | Engineering Lead | Q3 2026 | STRIDE methodology for auth, IoT pipeline, webhooks |

---

## CC4 -- Monitoring Activities

Controls for detecting anomalies, errors, and security events.

- [x] Error tracking with Sentry (API, web, mobile)
- [x] Audit logging for all CRUD and authentication events (`audit_log` table)
- [x] Health check endpoints (`/health` for liveness, `/ready` for readiness)
- [x] Structured logging via Pino (JSON format with request IDs)
- [x] Gateway monitoring with offline detection and alerting
- [x] Webhook delivery tracking with retry counts and status codes
- [ ] Intrusion detection system (IDS)
- [ ] Centralized log aggregation and alerting (ELK, Datadog, or equivalent)
- [ ] Security event correlation and SIEM
- [ ] Uptime monitoring with external synthetic checks
- [x] PII scrubbing in Sentry error reports

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| Log aggregation | DevOps | Q3 2026 | Evaluate Datadog, ELK, or Grafana Loki |
| IDS | DevOps | Q4 2026 | Host-based or network-based IDS |
| SIEM | DevOps | Q4 2026 | May combine with log aggregation solution |
| Uptime monitoring | DevOps | Q2 2026 | External health check polling |

---

## CC5 -- Control Activities

Technical controls that protect against threats.

- [x] Input validation on all API endpoints (Zod schemas in `packages/shared/src/validators/`)
- [x] SQL injection prevention (Drizzle ORM parameterized queries; no raw SQL concatenation)
- [x] Rate limiting per endpoint and per API key (`@fastify/rate-limit` with Redis backing)
- [x] Multi-tenant data isolation (`dealershipId` enforced on every query)
- [x] CSRF protection (`@fastify/csrf-protection` with `SameSite=Strict` cookies)
- [x] Security headers (Helmet.js: CSP, HSTS, X-Content-Type-Options, X-Frame-Options)
- [x] XSS prevention (React auto-escaping, JSON-only API responses)
- [x] Webhook payload signing (HMAC-SHA256)
- [x] Timing-safe comparisons for token and secret verification
- [ ] Web Application Firewall (WAF)
- [ ] Content Security Policy (CSP) with strict nonce-based policy
- [x] HTTPS enforcement in production

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| WAF | DevOps | Q3 2026 | AWS WAF, Cloudflare, or equivalent |
| Strict CSP with nonces | Frontend | Q3 2026 | Replace hash-based CSP with nonce-based |

---

## CC6 -- Logical and Physical Access Controls

Controls governing who can access systems and data.

### Logical Access

- [x] Authentication via JWT with short-lived access tokens (15 min)
- [x] Refresh token rotation (7-day expiry, single-use, stored as SHA-256 hash)
- [x] Authorization via RBAC with 6 roles
- [x] API key management with scoped permissions and per-key rate limits
- [x] Password hashing with bcrypt (12 rounds)
- [x] Session invalidation on logout (all refresh tokens revoked)
- [x] Session invalidation on password change
- [x] Redis-backed token revocation for sub-millisecond checks
- [ ] Multi-factor authentication (MFA)
- [ ] SSO integration (SAML/OIDC)
- [ ] Automated account lockout after failed login attempts
- [x] Rate limiting on authentication endpoints (5 attempts/min per IP)

### Physical Access

- [ ] Physical access controls documented (dependent on hosting provider)
- [ ] Data center certifications verified (SOC 2, ISO 27001 for hosting provider)

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| MFA | Engineering | Q3 2026 | TOTP-based; critical for owner/manager roles |
| SSO | Engineering | Q3 2026 | SAML 2.0 and/or OIDC for enterprise customers |
| Account lockout | Engineering | Q2 2026 | Progressive lockout after 5 failed attempts |
| Hosting certifications | DevOps | Q2 2026 | Obtain SOC 2 report from hosting provider |

---

## CC7 -- System Operations

Controls for operating systems securely.

- [x] CI/CD pipeline (GitHub Actions: lint, type check, test, security scan)
- [x] Pre-commit hooks (Husky + lint-staged for linting and formatting)
- [x] Conventional commit enforcement (commitlint)
- [x] Docker containerization with non-root users
- [x] Environment variables for all secrets (never hardcoded)
- [x] `.env` files excluded from version control (`.gitignore`)
- [ ] Blue/green or canary deployment strategy
- [ ] Automated database backup and restore testing
- [ ] Disaster recovery runbook with RTO/RPO targets
- [ ] Incident response playbook
- [ ] On-call rotation and escalation procedures
- [x] Health check endpoints for container orchestration

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| Blue/green deployments | DevOps | Q4 2026 | Zero-downtime deployment strategy |
| Backup automation | DevOps | Q2 2026 | Automated daily backups with monthly restore tests |
| DR runbook | Engineering Lead | Q2 2026 | Define RTO < 4h, RPO < 1h |
| Incident response playbook | Engineering Lead | Q2 2026 | Severity levels, communication templates, escalation paths |
| On-call rotation | Engineering Lead | Q3 2026 | PagerDuty or equivalent |

---

## CC8 -- Change Management

Controls governing how changes are introduced to production systems.

- [x] Version control (Git + GitHub)
- [x] Branch protection on `main` (PR required, approvals required)
- [x] Code review enforced via CODEOWNERS (`.github/CODEOWNERS`)
- [x] Automated testing gate (Vitest unit/integration tests + Playwright E2E tests)
- [x] Conventional commit enforcement for change categorization
- [x] CodeQL static analysis on all changes
- [x] Dependabot for automated dependency updates
- [x] Lock file committed (`pnpm-lock.yaml`) for reproducible builds
- [ ] Change advisory board (CAB) process for high-risk changes
- [ ] Formal change request and approval workflow
- [ ] Post-deployment verification checklist
- [ ] Rollback procedures documented and tested

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| CAB process | Engineering Lead | Q3 2026 | Required for database migrations and infrastructure changes |
| Formal change requests | Engineering Lead | Q3 2026 | Template in GitHub issue/PR templates |
| Rollback procedures | DevOps | Q2 2026 | Document per-service rollback steps |

---

## CC9 -- Risk Mitigation

Controls that reduce the impact of identified risks.

- [x] Webhook signature verification (HMAC-SHA256)
- [x] API key rotation support with configurable grace periods
- [x] Token refresh rotation (previous token invalidated on use)
- [x] Audit trail for all operations (append-only `audit_log` table)
- [x] Multi-tenant isolation prevents blast radius from spanning tenants
- [x] Feature flags for controlled rollout (`feature_flags` table)
- [ ] Data encryption at rest (AES-256 for database volumes)
- [ ] Key management service (AWS KMS, HashiCorp Vault, or equivalent)
- [ ] Data Loss Prevention (DLP) policies
- [ ] Business continuity plan (BCP)
- [x] Point-in-time recovery via PostgreSQL WAL archives

**Gap remediation:**
| Gap | Owner | Target Date | Notes |
|---|---|---|---|
| Encryption at rest | DevOps | Q4 2026 | Enable volume encryption on database hosting |
| KMS | DevOps | Q4 2026 | Centralized key management for secrets rotation |
| BCP | Engineering Lead | Q3 2026 | Document continuity procedures for extended outages |

---

## Summary

### Compliance Score

| Category                             | Implemented | Total  | Percentage |
| ------------------------------------ | ----------- | ------ | ---------- |
| CC1 -- Control Environment           | 4           | 8      | 50%        |
| CC2 -- Communication and Information | 7           | 9      | 78%        |
| CC3 -- Risk Assessment               | 3           | 8      | 38%        |
| CC4 -- Monitoring                    | 7           | 11     | 64%        |
| CC5 -- Control Activities            | 11          | 13     | 85%        |
| CC6 -- Access Control                | 10          | 14     | 71%        |
| CC7 -- System Operations             | 7           | 12     | 58%        |
| CC8 -- Change Management             | 8           | 12     | 67%        |
| CC9 -- Risk Mitigation               | 6           | 11     | 55%        |
| **Total**                            | **63**      | **98** | **64%**    |

### Priority Remediation (Q2 2026)

These items should be addressed first to reach audit readiness:

1. Annual risk assessment and risk register
2. Penetration testing engagement
3. Disaster recovery runbook with RTO/RPO targets
4. Automated database backup with restore testing
5. Incident response playbook
6. Employee security training program
7. Rollback procedures documentation
8. Account lockout on failed login attempts
9. Hosting provider SOC 2 certification verification
10. Uptime monitoring with external synthetic checks

### Next Review

Scheduled for Q3 2026. The compliance score target is 80% by end of Q3 2026.
