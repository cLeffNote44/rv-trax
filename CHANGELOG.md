# Changelog

All notable changes to RV Trax will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-23

### Added

- **v0.3.1 — Quality & Notifications**
  - Customer status change notifications (email + in-app on unit transitions)
  - Status notification settings UI in dealership preferences
  - 4 new Playwright E2E test files (36 tests total: landing page, error pages,
    auth guards, SEO/meta tags)

- **v0.4.0 — Competitive Features**
  - Automated pricing suggestions engine (aging, market comps, seasonality)
  - Pricing analytics dashboard with discount recommendations
  - Multi-language support framework (EN + ES translations, useTranslation hook,
    LanguageSwitcher component)
  - MapLibre GL fallback for self-hosters (auto-detect Mapbox token, free CARTO
    tiles, MapView abstraction, provider badge)
  - API v2 namespace with standardized envelope, offset pagination, expanded
    responses with embedded relations

- **v1.0.0 — Production Launch**
  - Mobile app crash reporting (Sentry integration)
  - Deep linking configuration (rvtrax:// scheme + universal links)
  - App store metadata and production build config
  - k6 load testing suite (smoke, load, stress, spike, WebSocket tests)
  - SOC 2 compliance documentation (security controls, compliance checklist,
    data handling policies)
  - API versioning strategy documentation

### Changed

- All package versions bumped to 1.0.0
- API PKG_VERSION updated to 1.0.0
- README version badge updated to 1.0.0
- SECURITY.md updated with 1.0.x support

### Improved

- Staging route file split: 691 → 414 lines (moves + compliance extracted)
- Status change notifications hook into existing notification infrastructure
- IDS-Astra DMS connector verified complete (testConnection, pullUnits, pushStatusChange)

## [0.3.0] - 2026-03-23

### Added

- **Staff Activity Log**
  - Timeline feed tracking all staff actions across the dealership
  - Per-user efficiency stats and action breakdown charts
  - Filter by staff member, action type, entity type
  - Top performers leaderboard (7-day rolling window)

- **Floor Plan Audits**
  - Monthly inventory verification workflow for floor plan lenders
  - Start audit to snapshot all active units into a checklist
  - Per-unit verify / missing / mislocated actions with zone tracking
  - Progress bar, completion percentage, and audit history table
  - Detail page with filter tabs (All, Pending, Verified, Missing)

- **Service Bay Workflow**
  - Kanban-style board tracking units through service stages
  - 5-stage pipeline: Checked In → Diagnosis → In Repair → QC → Ready
  - Bay management with check-in/check-out and stage advancement
  - Auto-updating time-elapsed timers per assignment
  - Utilization metrics: avg time-in-bay, throughput, occupancy %

- **Customizable Dashboard**
  - Widget registry with 7 widget types
  - Add/remove widgets with Customize mode toggle
  - Per-user layout persistence via dashboard_configs table
  - Reset to default layout functionality
  - Widgets: inventory summary, tracker health, alerts, aging chart,
    lot map, recent activity, status breakdown, quick actions

- **Infrastructure**
  - 4 new DB schemas (6 tables) with proper indexes
  - 4 new API route files with auth + tenant middleware
  - 7 new shared enums (StaffAction, FloorPlanAuditStatus, etc.)
  - ~200 lines of new API client functions in web app
  - 2 new sidebar navigation items (Audits, Activity)

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
