# Data Handling & Privacy

This document describes how RV Trax collects, stores, processes, and protects data.

## Data Categories

### User Data (PII)

| Field      | Storage                | Purpose                       | Retention        |
| ---------- | ---------------------- | ----------------------------- | ---------------- |
| Email      | `users.email`          | Authentication, notifications | Account lifetime |
| Name       | `users.name`           | Display, audit trails         | Account lifetime |
| Role       | `users.role`           | Access control (RBAC)         | Account lifetime |
| Password   | `users.password_hash`  | Auth (bcrypt, 12 rounds)      | Account lifetime |
| IP Address | `audit_log.ip_address` | Security audit trail          | 1 year           |
| Phone      | Redis cache only       | SMS notifications             | Session-based    |

**No SSN, financial data, or government IDs are stored.**

### Operational Data

| Category          | Tables                               | Purpose                   | Retention              |
| ----------------- | ------------------------------------ | ------------------------- | ---------------------- |
| Inventory         | `units`, `unit_photos`, `unit_notes` | RV inventory management   | Until archived/deleted |
| GPS Positions     | `location_history` (hypertable)      | Unit tracking             | 90 days (configurable) |
| Movement Events   | `movement_events`                    | Zone change audit trail   | 1 year                 |
| Tracker Telemetry | `gateway_telemetry`                  | Device health monitoring  | 30 days                |
| Audit Log         | `audit_log`                          | Compliance, security      | 2 years                |
| Alerts            | `alerts`                             | Operational notifications | 90 days                |

### Business Data

| Category          | Tables                                    | Purpose               | Retention            |
| ----------------- | ----------------------------------------- | --------------------- | -------------------- |
| Dealership Config | `dealerships`, `lots`, `lot_spots`        | Multi-tenant setup    | Account lifetime     |
| Billing           | `billing_events`                          | Stripe webhook events | 7 years (tax)        |
| API Keys          | `api_keys` (SHA-256 hashed)               | Third-party access    | Until revoked        |
| Webhooks          | `webhook_endpoints`, `webhook_deliveries` | Event delivery        | 30 days (deliveries) |

## Data Isolation

Every table with dealer-specific data includes a `dealership_id` column with a foreign key constraint. The API middleware (`enforceTenant`) injects `dealershipId` from the authenticated JWT into every database query. There is no application-level path to access another dealership's data.

```typescript
// Enforced on every authenticated request
const conditions = [eq(table.dealershipId, request.dealershipId)];
```

## Third-Party Data Sharing

| Service              | Data Sent                           | Purpose             | Data Processing        |
| -------------------- | ----------------------------------- | ------------------- | ---------------------- |
| **Stripe**           | Dealership ID, subscription tier    | Billing             | Payment processing     |
| **AWS SES / Resend** | Recipient email, alert content      | Email notifications | Transient (not stored) |
| **Twilio**           | Phone number, SMS message           | SMS notifications   | Transient              |
| **Firebase (FCM)**   | Device token, notification payload  | Push notifications  | Transient              |
| **Sentry**           | Error stack traces, request context | Crash reporting     | 90-day retention       |
| **PostHog**          | Anonymous page views, feature usage | Product analytics   | Configurable           |

**No customer PII is shared with analytics or advertising services.**

## Data Deletion

### User Deletion

- Remove user record from `users` table
- Anonymize `user_id` references in `audit_log` (replace with "deleted-user")
- Remove device tokens from `device_tokens`
- Clear Redis session and preference keys

### Dealership Offboarding

- Cascade delete all dealer-specific data across all tables
- Remove Stripe subscription
- Clear Redis cache keys prefixed with dealership ID
- Retain anonymized audit logs for compliance (2 years)

### Right to Erasure (GDPR Article 17)

Users can request deletion of their personal data by contacting support. Processing time: 30 days maximum.

## Backup & Recovery

| Component         | Strategy                | Frequency                  | Retention |
| ----------------- | ----------------------- | -------------------------- | --------- |
| PostgreSQL        | WAL archiving + pg_dump | Continuous WAL, daily full | 30 days   |
| Redis             | RDB snapshots           | Every 15 minutes           | 7 days    |
| File Storage (R2) | Versioned buckets       | Automatic                  | 30 days   |

### Recovery Procedures

1. **Point-in-time recovery** — Restore PostgreSQL to any second within the WAL retention window
2. **Full restore** — Restore from latest pg_dump + replay WAL to target time
3. **Redis recovery** — Restore from latest RDB snapshot (cache data is reconstructable)
4. **Disaster recovery RTO** — Target: 4 hours for full platform recovery

## Encryption

| Layer           | Method                      | Notes                        |
| --------------- | --------------------------- | ---------------------------- |
| In Transit      | TLS 1.2+ (HTTPS)            | Enforced in production       |
| Passwords       | bcrypt (12 rounds)          | One-way hash, not reversible |
| API Keys        | SHA-256                     | One-way hash, not reversible |
| Webhook Secrets | HMAC-SHA256                 | Signature verification       |
| At Rest         | Provider-managed (AWS/Neon) | Database-level encryption    |

## CCPA / GDPR Considerations

- **Data minimization**: Only collect data necessary for lot management operations
- **Purpose limitation**: GPS data is used only for inventory tracking, not personal surveillance
- **Access requests**: Users can request a copy of their data via support
- **Deletion requests**: Processed within 30 days
- **Data portability**: Export available in CSV/JSON via the reporting system
- **Consent**: Users consent to data collection via Terms of Service at registration
- **Breach notification**: Within 72 hours of discovery (per GDPR Article 33)
