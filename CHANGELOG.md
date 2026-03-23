# Changelog

All notable changes to RV Trax will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-23

### Added

- **Competitive Features**
  - Inventory aging dashboard with Recharts visualization and color-coded aging buckets
  - Photo gallery component per unit (upload, lightbox, reorder, delete)
  - Test drive tracking page with live timers, forms, and history
  - QR code generation per unit with print and copy-to-clipboard
  - Battery health prediction panel with voltage trends and alerts
  - Public inventory widget configurator with embed code generation
  - DMS sync status monitor with history and manual trigger

- **Service Integrations**
  - Sentry error tracking (API plugin + web client, optional via SENTRY_DSN)
  - Resend as alternative email provider (toggle via EMAIL_PROVIDER env)
  - PostHog analytics provider with pageview tracking
  - Vercel deployment configuration

- **DevOps & Quality**
  - Dependabot for automated weekly dependency updates
  - CodeQL security scanning workflow + dependency audit
  - Husky + lint-staged pre-commit hooks
  - Commitlint with Conventional Commits enforcement
  - Code coverage config (v8 provider with thresholds)
  - GitHub issue templates (bug report, feature request)
  - Pull request template with checklist
  - Code of Conduct (Contributor Covenant v2.1)
  - CODEOWNERS file for PR review assignment
  - Production multi-stage Dockerfile
  - Privacy Policy and Terms of Service

- **Code Quality**
  - Error pages (404, 500, global-error) with branded UI
  - Environment variable validation (Zod schemas, fail-fast on build)
  - SEO metadata, Open Graph tags, robots.txt, sitemap.xml
  - Marketing landing page with feature showcase and screenshots
  - Playwright E2E test scaffolding (auth + navigation specs)
  - Dashboard loading skeletons and Suspense boundaries
  - Health check endpoint (/api/health)
  - README badges (CI, CodeQL, license, version)
  - Architecture documentation (ARCHITECTURE.md)
  - Database guide (DATABASE.md)
  - .nvmrc, .npmrc, .editorconfig, .gitattributes for environment consistency

### Fixed

- Auth middleware redirect loop on protected routes
- Unused variable lint errors across 5 files
- ESLint disable comments for non-existent rules

### Changed

- Updated CONTRIBUTING.md with Conventional Commits, pre-commit hooks, and branch protection docs
- Updated README with badges, documentation table, and accurate page counts
- Updated SECURITY.md with v0.2.0 support status

## [0.1.0] - 2026-03-22

### Added

- **Core Platform**
  - Multi-tenant dealership management with role-based access control
  - JWT authentication with refresh token rotation and HttpOnly cookies
  - Real-time WebSocket updates for live inventory tracking

- **Inventory Management**
  - Full CRUD operations for RV units with VIN, stock number, and status tracking
  - Batch operations for bulk status updates
  - Unit transfer workflow between lots with audit trail

- **GPS & IoT Tracking**
  - LoRaWAN GPS tracker integration via ChirpStack
  - Real-time location tracking with TimescaleDB hypertables
  - Gateway health monitoring and telemetry
  - Kalman filter for GPS position smoothing

- **Lot Operations**
  - Interactive Mapbox GL lot map with real-time unit positions
  - Geofencing with zone-level boundary detection
  - Staging plan creation and lot optimization
  - Spot-level assignment and move tracking

- **Alerts & Monitoring**
  - Configurable alert rules (movement, battery, geofence violations)
  - Multi-channel notifications (email via SES, SMS via Twilio, push via FCM)
  - Alert acknowledgment, dismissal, and snoozing
  - Notification digest scheduling

- **Service & Compliance**
  - Work order management with priority and assignment
  - Recall tracking with affected unit matching
  - Compliance snapshot generation
  - Full audit logging for all operations

- **Analytics & Reporting**
  - Inventory aging analytics
  - Lot utilization metrics
  - Movement pattern analysis
  - Scheduled report generation (CSV, PDF, JSON)

- **Billing & Administration**
  - Stripe integration for subscription management
  - Tiered pricing (Starter, Professional, Enterprise)
  - Feature flags for progressive rollout
  - Multi-location dealership group support

- **Developer Platform**
  - Public REST API with API key authentication
  - Webhook endpoints with HMAC-SHA256 signature verification
  - DMS integration connectors
  - Comprehensive API documentation

- **Infrastructure**
  - Monorepo with pnpm workspaces and Turborepo
  - Docker Compose for local development (PostgreSQL, Redis, Mosquitto, ChirpStack)
  - GitHub Actions CI/CD (lint, typecheck, test across all apps)
  - 56 test files with ~9,000 lines of test coverage

- **Web Dashboard**
  - 29 pages covering all platform features
  - Dark/light mode support via CSS custom properties
  - Command palette (Cmd+K) for quick navigation
  - Responsive design with mobile sidebar
  - Error boundaries and loading skeletons
  - SEO metadata and Open Graph tags

- **Mobile App** (React Native)
  - Field operations interface with offline-first architecture
  - BLE and NFC device support
  - Push notification integration
  - Zustand state management with MMKV persistence
