# Privacy Policy

**Last Updated:** March 22, 2026

RV Trax ("we", "our", "us") operates the RV Trax platform — a real-time GPS lot management system for RV dealerships. This Privacy Policy describes how we collect, use, and protect your information.

## 1. Information We Collect

### Account Information

- Name, email address, phone number
- Dealership name, address, and business details
- Role and access permissions within your organization

### Inventory Data

- Vehicle information (VIN, stock number, make, model, year, pricing)
- Unit status, photos, and service history
- Lot location assignments and transfer records

### GPS & Location Data

- Real-time GPS coordinates from LoRaWAN trackers attached to units
- Location history and movement events
- Geofence boundary definitions and zone configurations
- Gateway device locations and telemetry

### Usage Data

- Dashboard interactions and feature usage (via PostHog analytics)
- API request logs and error reports (via Sentry)
- Session information and authentication events

### Device Information

- Mobile app device identifiers for push notifications
- Browser type and operating system for the web dashboard

## 2. How We Use Your Information

We use collected information to:

- Provide real-time GPS tracking and lot management services
- Send alerts and notifications (movement, battery, geofence events)
- Generate inventory analytics and reports
- Process billing and subscription management
- Improve our platform through usage analytics
- Provide customer support
- Comply with legal obligations

## 3. Data Sharing

We do **not** sell your personal information. We share data only with:

- **Service providers** who help operate our platform (cloud hosting, email delivery, payment processing)
- **DMS integrations** when you explicitly configure a connector
- **Law enforcement** when required by valid legal process
- **Your organization** — all data is scoped to your dealership account

### Third-Party Services

| Service          | Purpose            | Data Shared                           |
| ---------------- | ------------------ | ------------------------------------- |
| Stripe           | Payment processing | Billing info, subscription status     |
| AWS SES / Resend | Email delivery     | Email addresses, notification content |
| Twilio           | SMS notifications  | Phone numbers, alert messages         |
| Sentry           | Error tracking     | Error logs, stack traces (no PII)     |
| PostHog          | Product analytics  | Anonymized usage events               |
| Mapbox           | Map rendering      | Map tile requests (no PII)            |
| Cloudflare R2    | File storage       | Unit photos                           |

## 4. Data Security

We implement industry-standard security measures:

- **Encryption in transit** — All connections use TLS 1.2+
- **Password hashing** — bcrypt with 12 rounds
- **API key storage** — SHA-256 hashed, never stored in plaintext
- **JWT tokens** — Short-lived (15 min) with rotating refresh tokens
- **Multi-tenant isolation** — Application-level dealership data separation
- **Rate limiting** — Per-endpoint and per-API-key limits
- **Input validation** — All inputs validated with Zod schemas
- **Webhook signatures** — HMAC-SHA256 signed payloads

## 5. Data Retention

- **Account data** — Retained while your account is active; deleted within 90 days of account closure
- **Location history** — Retained for 12 months, then aggregated into summary statistics
- **Audit logs** — Retained for 24 months for compliance purposes
- **Analytics data** — Anonymized and retained indefinitely for product improvement

## 6. Your Rights

You have the right to:

- **Access** your personal data
- **Correct** inaccurate information
- **Delete** your account and associated data
- **Export** your data in machine-readable format (CSV, JSON)
- **Opt out** of analytics tracking
- **Restrict** processing of your data

To exercise these rights, contact us at privacy@rvtrax.com.

## 7. Cookies & Tracking

The web dashboard uses:

- **Session cookies** — Required for authentication (HttpOnly, Secure, SameSite)
- **Analytics** — PostHog for anonymized usage tracking (can be disabled)
- We do **not** use third-party advertising cookies

## 8. Children's Privacy

RV Trax is a B2B platform for dealership operations. We do not knowingly collect information from individuals under 18.

## 9. Changes to This Policy

We will notify you of material changes via email or in-app notification at least 30 days before they take effect.

## 10. Contact

For privacy inquiries:

- **Email:** privacy@rvtrax.com
- **Address:** [Your Business Address]

For security vulnerabilities, see [SECURITY.md](SECURITY.md).
