# Changelog

All notable changes to RV Trax will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
