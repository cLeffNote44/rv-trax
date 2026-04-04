# Security Controls

This document describes the technical security controls implemented in RV Trax. It is intended for internal engineering review and external SOC 2 audit preparation.

**Last reviewed:** 2026-03-23
**Document owner:** Engineering Lead
**Review cadence:** Quarterly

---

## 1. Authentication and Access Control

### 1.1 User Authentication

RV Trax uses a stateless JWT-based authentication system with short-lived access tokens and rotating refresh tokens.

| Control                | Implementation                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Access tokens          | JWT, 15-minute expiry, signed with HS256                                                                          |
| Refresh tokens         | Opaque token, 7-day expiry, stored as SHA-256 hash in `refresh_tokens` table                                      |
| Token rotation         | Each refresh grants a new access + refresh pair; the previous refresh token is invalidated                        |
| Token revocation       | Redis-backed revocation list checked on every authenticated request; logout invalidates all sessions for the user |
| Cookie security        | Refresh tokens sent via `HttpOnly`, `Secure`, `SameSite=Strict` cookies                                           |
| Password hashing       | bcrypt with cost factor 12 (adaptive; increased from 10 in v0.2.0)                                                |
| Timing-safe comparison | All token and secret comparisons use constant-time functions to prevent timing attacks                            |

### 1.2 Role-Based Access Control (RBAC)

Authorization is enforced at the route level via Fastify preHandler hooks. Six roles are defined, each with progressively broader permissions:

| Role      | Scope                                       | Example Permissions                                                     |
| --------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `viewer`  | Read-only access to inventory and dashboard | View units, view analytics                                              |
| `porter`  | Field operations on mobile app              | Move units, update locations, scan trackers                             |
| `service` | Service department operations               | Manage work orders, service bays, recalls                               |
| `sales`   | Sales floor operations                      | Update unit status, manage test drives, customer notes                  |
| `manager` | Full dealership operations                  | All of the above + user management, alert rules, reports                |
| `owner`   | Administrative control                      | All of the above + billing, API keys, integrations, dealership settings |

Role checks are enforced by the `requireRole()` middleware, which accepts one or more allowed roles and returns 403 Forbidden if the authenticated user's role is insufficient.

### 1.3 API Key Authentication

Third-party integrations authenticate via API keys rather than JWTs.

| Control            | Implementation                                                                  |
| ------------------ | ------------------------------------------------------------------------------- |
| Key format         | 64-character cryptographically random string, prefixed with `rvt_`              |
| Storage            | SHA-256 hash stored in `api_keys` table; plaintext shown once at creation       |
| Scoped permissions | Each key has a `scopes` array (e.g., `["units:read", "inventory:write"]`)       |
| Rate limiting      | Per-key rate limits configurable in `api_keys.rate_limit` column                |
| Rotation           | New key can be generated; old key remains valid for a configurable grace period |
| Revocation         | Immediate revocation by deleting the key record                                 |

### 1.4 Rate Limiting

Rate limiting is enforced at three levels:

| Level            | Configuration                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Per-endpoint     | Default: 500 requests/minute via `@fastify/rate-limit`                                            |
| Per-API-key      | Configurable per key; default 1,000 requests/hour                                                 |
| Auth endpoints   | Stricter limits: 5 login attempts/minute per IP, 3 password reset requests/hour per email         |
| WebSocket        | 50 connections per dealership; 60 messages per minute per client (sliding window)                  |
| Response headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` included on all responses       |
| Backing store    | Redis for distributed HTTP rate limit counters; in-memory for WebSocket (per-process)             |

### 1.5 CSRF Protection

Cross-Site Request Forgery protection is implemented via the `@fastify/csrf-protection` plugin:

- CSRF tokens are generated per session and validated on all state-changing requests (POST, PUT, PATCH, DELETE)
- `SameSite=Strict` cookie attribute provides defense-in-depth
- API key-authenticated requests are exempt (no browser session context)

### 1.6 Session Management

- No server-side sessions for the web application; state is maintained via JWT access tokens
- Refresh tokens are tracked in the `refresh_tokens` database table with `user_id`, `token_hash`, `expires_at`, and `revoked_at` columns
- Logout invalidates all refresh tokens for the user
- Password change invalidates all existing refresh tokens
- Redis-backed token revocation list provides sub-millisecond revocation checks

---

## 2. Data Protection

### 2.1 Multi-Tenant Data Isolation

RV Trax is a multi-tenant application. Data isolation is the highest-priority security control.

| Layer        | Control                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| JWT claims   | `dealershipId` is embedded in every JWT and cannot be overridden by the client                                        |
| Middleware   | `tenantGuard` middleware injects `dealershipId` into the request context before any route handler executes            |
| Query layer  | All Drizzle ORM queries include `WHERE dealership_id = $dealershipId`; this is enforced by convention and code review |
| Admin bypass | Administrative routes use a separate authentication mechanism (admin token) and are not accessible via standard JWTs  |
| Testing      | Integration tests verify that cross-tenant data access is impossible                                                  |

### 2.2 Input Validation

All API inputs are validated using Zod schemas defined in `packages/shared/src/validators/`.

| Control          | Implementation                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Request body     | Validated via Fastify schema validation with Zod                                         |
| Path parameters  | UUID format validation on all entity IDs                                                 |
| Query parameters | Type coercion and range validation                                                       |
| File uploads     | MIME type validation, file size limits                                                   |
| Rejection        | Invalid inputs return 400 Bad Request with structured error details (field-level errors) |

### 2.3 SQL Injection Prevention

- All database queries are constructed via Drizzle ORM, which uses parameterized queries exclusively
- No raw SQL string concatenation exists in the codebase
- CodeQL static analysis scans for SQL injection patterns on every pull request

### 2.4 Cross-Site Scripting (XSS) Prevention

| Control          | Implementation                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Security headers | Helmet.js sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0` (in favor of CSP) |
| Output encoding  | React (web) and React Native (mobile) auto-escape rendered content                                                                            |
| API responses    | JSON-only responses; no HTML rendering on the API server                                                                                      |

### 2.5 Transport Security

- HTTPS enforced in production via reverse proxy (TLS termination at load balancer)
- `Strict-Transport-Security` header set via Helmet.js (max-age=31536000, includeSubDomains)
- Internal service communication (API to Redis, API to PostgreSQL) uses encrypted connections where supported by the hosting provider

### 2.6 Webhook Security

Outgoing webhook payloads are signed to allow receivers to verify authenticity.

| Control           | Implementation                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Signing algorithm | HMAC-SHA256                                                                                 |
| Signature header  | `X-RVTrax-Signature-256`                                                                    |
| Secret storage    | Webhook secrets stored as SHA-256 hashes in `webhook_endpoints.secret_hash`                 |
| Replay prevention | Payloads include a `timestamp` field; receivers should reject payloads older than 5 minutes |
| Delivery tracking | All deliveries logged in `webhook_deliveries` with status code and retry count              |

### 2.7 Sensitive Data Handling

| Data Type       | Storage Method                                                                                |
| --------------- | --------------------------------------------------------------------------------------------- |
| User passwords  | bcrypt hash (cost 12); plaintext never stored or logged                                       |
| API keys        | SHA-256 hash; plaintext shown once at creation, then discarded                                |
| Webhook secrets | SHA-256 hash; plaintext shown once at creation                                                |
| Refresh tokens  | SHA-256 hash in database                                                                      |
| DMS credentials | Encrypted at the application layer before storage in `dms_integrations.credentials`           |
| Stripe events   | Raw Stripe event data stored in `billing_events`; no credit card numbers (Stripe handles PCI) |

---

## 3. Infrastructure Security

### 3.1 Database Security

| Control            | Implementation                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Engine             | PostgreSQL 16 with TimescaleDB extension                                                                          |
| Authentication     | Password authentication; connection string via `DATABASE_URL` environment variable                                |
| Privileges         | Application connects with a non-superuser role that has SELECT, INSERT, UPDATE, DELETE on application tables only |
| Migrations         | Schema changes applied via Drizzle ORM migrations; reviewed in pull requests before deployment                    |
| Backups            | PostgreSQL WAL (Write-Ahead Log) archiving for point-in-time recovery                                             |
| Connection pooling | Connection pool size limited to prevent resource exhaustion                                                       |

### 3.2 Redis Security

| Control        | Implementation                                                                               |
| -------------- | -------------------------------------------------------------------------------------------- |
| Authentication | `AUTH` password required in production (`REDIS_URL` includes credentials)                    |
| Network        | Redis is not exposed to the public internet; accessible only within the private network      |
| Data           | Redis stores ephemeral data (rate limit counters, cache, pub/sub); no sensitive data at rest |
| TLS            | TLS-encrypted connections used when supported by the hosting provider                        |

### 3.3 Container Security

| Control              | Implementation                                              |
| -------------------- | ----------------------------------------------------------- |
| Base images          | Official Node.js Alpine images; pinned to specific versions |
| Non-root execution   | Docker containers run as non-root users                     |
| No secrets in images | All secrets injected via environment variables at runtime   |
| Image scanning       | Dependabot monitors Docker base image vulnerabilities       |

### 3.4 Secret Management

| Control       | Implementation                                                              |
| ------------- | --------------------------------------------------------------------------- |
| Storage       | All secrets stored in environment variables; never hardcoded in source code |
| `.env` files  | Listed in `.gitignore`; never committed to version control                  |
| CI/CD         | GitHub Actions secrets used for deployment credentials                      |
| Rotation      | API keys and webhook secrets support rotation with grace periods            |
| Validation    | Startup rejects placeholder JWT_SECRET values and enforces minimum 32-char length |
| Documentation | `.env.example` documents required variables; `docs/SECRETS_MANAGEMENT.md` provides rotation procedures |

### 3.5 Dependency Management

| Control    | Implementation                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Dependabot | Configured in `.github/dependabot.yml` for automated dependency update PRs                              |
| Auto-merge | Patch updates and dev-dependency minor updates auto-merged via `.github/workflows/dependabot-auto-merge.yml` |
| CodeQL     | Static analysis runs on every push to `main` and on every pull request (`.github/workflows/codeql.yml`) |
| Lock files | `pnpm-lock.yaml` committed to ensure reproducible builds                                                |
| Audit      | `pnpm audit` can be run manually to check for known vulnerabilities                                     |

---

## 4. Monitoring and Incident Response

### 4.1 Error Tracking

| Control       | Implementation                                                                    |
| ------------- | --------------------------------------------------------------------------------- |
| Service       | Sentry (optional; activated when `SENTRY_DSN` environment variable is set)        |
| Coverage      | API server, web dashboard, and mobile app each have dedicated Sentry projects     |
| PII scrubbing | Sentry SDK configured to strip passwords, tokens, and API keys from error reports |
| Alerting      | Sentry alerts configured for new error types and error rate spikes                |

### 4.2 Audit Logging

All significant operations are recorded in the `audit_log` table.

| Field           | Description                                                          |
| --------------- | -------------------------------------------------------------------- |
| `action`        | Operation type (e.g., `unit.create`, `user.login`, `api_key.revoke`) |
| `entity_type`   | The type of entity affected (e.g., `unit`, `user`, `tracker`)        |
| `entity_id`     | The UUID of the affected entity                                      |
| `user_id`       | The UUID of the user who performed the action                        |
| `dealership_id` | Tenant scope                                                         |
| `changes`       | JSONB diff of before/after state (for update operations)             |
| `ip_address`    | Client IP address                                                    |
| `user_agent`    | Client user agent string                                             |
| `created_at`    | Timestamp with timezone                                              |

Audit log entries are append-only. The application database role does not have DELETE permission on the `audit_log` table.

### 4.3 Health Monitoring

| Endpoint       | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `GET /health`  | Basic liveness check (returns 200 if the process is running) |
| `GET /healthz` | Kubernetes-style alias for `/health`                         |
| `GET /ready`   | Readiness check (verifies database and Redis connectivity)   |
| `GET /readyz`  | Kubernetes-style alias for `/ready`                          |
| `GET /metrics` | Prometheus-format metrics (HTTP requests, latency, WebSocket stats, uptime) |

Health and readiness endpoints are available on both the API server (port 3000) and IoT Ingest service (port 3002). The IoT Ingest `/metrics` endpoint also includes pipeline lag monitoring data.

### 4.4 Structured Logging

| Control          | Implementation                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| Library          | Pino (JSON-structured logging)                                                        |
| Format           | JSON with `level`, `timestamp`, `msg`, `requestId`, `dealershipId` fields             |
| Correlation IDs  | IoT pipeline uses `correlationId` per MQTT message for end-to-end tracing             |
| Sensitive data   | Passwords, tokens, and API keys are redacted from log output via Pino redaction paths |
| Log levels       | `error`, `warn`, `info`, `debug`; production runs at `info` level                     |
| Request logging  | Every HTTP request logged with method, URL, status code, and response time            |

### 4.5 Observability Stack

Prometheus + Grafana configuration is provided in `infrastructure/monitoring/`:

| Component | Config Location | Description |
| --------- | --------------- | ----------- |
| Prometheus | `infrastructure/monitoring/prometheus/prometheus.yml` | Scrapes `/metrics` from API and IoT Ingest |
| Alert rules | `infrastructure/monitoring/prometheus/rules/rv-trax-alerts.yml` | 10 alerting rules (see below) |
| Grafana dashboard | `infrastructure/monitoring/grafana/dashboards/rv-trax-overview.json` | Overview dashboard with 8 panels |
| Grafana provisioning | `infrastructure/monitoring/grafana/provisioning/` | Auto-configures datasource and dashboards |

**Alerting rules:**

| Alert | Condition | Severity |
| ----- | --------- | -------- |
| HighErrorRate | HTTP 5xx rate > 5% for 5m | Critical |
| HighLatency | P99 latency > 5s for 5m | Warning |
| APIDown | API unreachable for 1m | Critical |
| NoWebSocketConnections | 0 connections for 30m | Warning |
| IoTPipelineLag | Lag > 60s for 5m | Warning |
| IoTPipelineCriticalLag | Lag > 300s for 2m | Critical |
| IoTIngestDown | Ingest unreachable for 1m | Critical |
| TrackerOffline | Trackers offline > 30m | Warning |
| DatabaseConnectionPoolExhaustion | Pool > 90% utilized for 5m | Critical |
| RedisHighMemory | Memory > 85% for 10m | Warning |

### 4.6 IoT Pipeline Lag Monitoring

The IoT Ingest service includes a dedicated lag monitor (`apps/iot-ingest/src/monitoring/lag-monitor.ts`) that checks the Redis stream every 30 seconds:

| Threshold | Level | Action |
| --------- | ----- | ------ |
| > 60 seconds | Warning | Logs warning with queue depth and lag |
| > 300 seconds | Critical | Logs critical alert; triggers Prometheus alert rule |

The lag snapshot is exposed via the `/metrics` endpoint under `pipeline_lag`.

### 4.7 Gateway Monitoring

LoRaWAN gateway health is actively monitored:

- `gateway_telemetry` records RSSI, SNR, and uptime metrics
- Alert rules can trigger notifications when a gateway goes offline or degrades
- Dashboard displays real-time gateway status

---

## 5. Development Security Practices

### 5.1 Code Review

| Control           | Implementation                                                   |
| ----------------- | ---------------------------------------------------------------- |
| Branch protection | `main` branch requires pull request with at least one approval   |
| CODEOWNERS        | `.github/CODEOWNERS` defines required reviewers per directory    |
| CI checks         | All PRs must pass linting, type checking, and tests before merge |

### 5.2 CI/CD Pipeline

The CI pipeline (`.github/workflows/ci.yml`) enforces:

1. Linting (ESLint with security-focused rules)
2. Type checking (TypeScript strict mode)
3. Unit and integration tests (Vitest)
4. End-to-end tests (Playwright)
5. CodeQL security analysis

### 5.3 Commit Standards

- Conventional Commits enforced via commit-lint
- Pre-commit hooks run linting and formatting (via Husky + lint-staged)
- Commit messages must reference issue numbers for traceability

---

## 6. Control Gaps and Remediation Roadmap

The following controls are identified as gaps and are planned for future implementation:

| Gap                                                 | Priority | Target  |
| --------------------------------------------------- | -------- | ------- |
| Multi-factor authentication (MFA)                   | High     | Q3 2026 |
| SSO integration (SAML/OIDC)                         | High     | Q3 2026 |
| Data encryption at rest (AES-256)                   | Medium   | Q4 2026 |
| Key management service (AWS KMS or HashiCorp Vault) | Medium   | Q4 2026 |
| Web Application Firewall (WAF)                      | Medium   | Q3 2026 |
| Intrusion detection system (IDS)                    | Medium   | Q4 2026 |
| ~~Log aggregation and alerting~~ *(Resolved: Prometheus + Grafana with 10 alert rules)* | ~~Medium~~ | ~~Q3 2026~~ |
| Penetration testing (annual)                        | High     | Q2 2026 |
| Blue/green deployment strategy                      | Low      | Q4 2026 |
| Disaster recovery runbook                           | High     | Q2 2026 |
| Database backup automation and testing              | High     | Q2 2026 |
| Employee security training program                  | High     | Q2 2026 |

---

## Appendix A: Security Architecture Diagram

```
                     Internet
                        │
                   ┌────▼────┐
                   │  HTTPS  │
                   │  (TLS)  │
                   └────┬────┘
                        │
               ┌────────▼────────┐
               │  Load Balancer  │
               │  (TLS termination)
               └────────┬────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │  API (1)  │ │  API (2)  │ │  API (n)  │
   │  Fastify  │ │  Fastify  │ │  Fastify  │
   │ non-root  │ │ non-root  │ │ non-root  │
   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
         │              │              │
         └──────┬───────┴──────┬───────┘
                │              │
         ┌──────▼──────┐ ┌────▼──────┐
         │ PostgreSQL  │ │   Redis   │
         │ (non-super  │ │  (AUTH    │
         │  app role)  │ │  enabled) │
         └─────────────┘ └───────────┘
              Private Network Only
```

## Appendix B: Relevant File Locations

| File / Directory                  | Purpose                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `SECURITY.md`                     | Public-facing security policy and vulnerability reporting |
| `docs/SECURITY_CONTROLS.md`       | This document                                             |
| `docs/COMPLIANCE_CHECKLIST.md`    | SOC 2 readiness checklist                                 |
| `docs/DATA_HANDLING.md`           | Data handling and privacy documentation                   |
| `docs/ARCHITECTURE.md`            | System architecture overview                              |
| `docs/SECRETS_MANAGEMENT.md`      | Secret rotation procedures and management guide           |
| `docs/DATABASE.md`                | Database schema and migration guide                       |
| `.github/workflows/ci.yml`        | CI/CD pipeline definition                                 |
| `.github/workflows/codeql.yml`    | CodeQL security analysis workflow                         |
| `.github/dependabot.yml`          | Dependency update automation                              |
| `.github/CODEOWNERS`              | Code review ownership                                     |
| `packages/shared/src/validators/` | Zod validation schemas                                    |
| `packages/db/src/schema/`         | Database schema definitions                               |
