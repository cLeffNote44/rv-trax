# RV Trax

Real-time asset tracking system for RV dealerships. Track every unit on your lot with LoRaWAN GPS trackers, manage inventory, automate staging, and monitor your fleet from a web dashboard or mobile app.

## What It Does

RV Trax solves a common problem for RV dealerships: knowing exactly where every unit is, at all times. Large lots with hundreds of RVs spread across multiple zones make it easy to lose track of inventory. Sales staff waste time searching for units, porters move vehicles without logging it, and managers have no visibility into lot utilization.

**Core capabilities:**
- **Real-time GPS tracking** via LoRaWAN trackers attached to each unit
- **Automated lot mapping** with zone/row/spot snapping and geo-fencing
- **Movement detection** with audit trails and alerts
- **Inventory management** with status workflows (arrival → PDI → lot ready → sold → delivered)
- **Staging optimization** for lot organization by type, make, or price range
- **Work order tracking** for PDI, service, and recall management
- **Multi-location support** with dealership groups and inter-lot transfers
- **Analytics & reporting** on inventory aging, lot utilization, and movement patterns

## Architecture

```
                        ┌─────────────────┐
                        │   ChirpStack    │
                        │  LoRaWAN Server │
                        └────────┬────────┘
                                 │ MQTT
                                 ▼
┌──────────┐  HTTP    ┌──────────────────┐  Redis Stream   ┌──────────────┐
│  Mobile  │◄────────►│    API Server    │◄───────────────►│  IoT Ingest  │
│  App     │  REST    │    (Fastify)     │                 │  (Pipeline)  │
└──────────┘          └────────┬─────────┘                 └──────┬───────┘
                       ▲       │ WebSocket                        │
┌──────────┐  HTTP    │       ▼                                   ▼
│   Web    │◄─────────┘  ┌──────────┐  ┌──────────┐    ┌──────────────┐
│Dashboard │             │PostgreSQL│  │  Redis   │    │ TimescaleDB  │
└──────────┘             │ + Drizzle│  │  Cache   │    │  (Locations) │
                         └──────────┘  └──────────┘    └──────────────┘
```

**Monorepo structure** (pnpm workspaces + Turborepo):

| Package | Description | Tech |
|---------|-------------|------|
| `apps/api` | REST API + WebSocket server | Fastify 5, Drizzle ORM, JWT |
| `apps/web` | Management dashboard | Next.js 15, React 19, Tailwind, Mapbox |
| `apps/mobile` | Field operations app | React Native 0.76, React Navigation 7 |
| `apps/iot-ingest` | Tracker telemetry pipeline | MQTT, Redis Streams, Kalman filter |
| `packages/shared` | Types, enums, validators, constants | TypeScript, Zod |
| `packages/db` | Database schema and migrations | Drizzle ORM, PostgreSQL |

## Quick Start

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Docker & Docker Compose

### 1. Start infrastructure

```bash
# PostgreSQL (TimescaleDB), Redis, Mosquitto MQTT broker
cd infrastructure/docker
docker compose up -d postgres redis mosquitto
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to a random string
```

### 3. Install and build

```bash
pnpm install
pnpm run db:generate   # Generate Drizzle migrations
pnpm run db:migrate    # Apply migrations
pnpm run db:seed       # Seed demo data (optional)
```

### 4. Run in development

```bash
pnpm run dev           # Starts all apps concurrently
```

Or run services individually:

| Service | Command | Port |
|---------|---------|------|
| API Server | `cd apps/api && pnpm dev` | 3000 |
| Web Dashboard | `cd apps/web && pnpm dev` | 3001 |
| IoT Ingest | `cd apps/iot-ingest && pnpm dev` | 3002 |
| Mobile (Metro) | `cd apps/mobile && pnpm start` | 8081 |

### 5. Verify

- API health: http://localhost:3000/health
- API docs (Swagger): http://localhost:3000/api/docs
- Web dashboard: http://localhost:3001
- ChirpStack UI: http://localhost:8080 (if running)

## Project Structure

```
rv-trax/
├── apps/
│   ├── api/                    # Fastify REST API (80+ endpoints)
│   │   └── src/
│   │       ├── routes/         # 24 route modules (auth, units, trackers, etc.)
│   │       ├── middleware/     # Auth, tenant isolation, rate limiting
│   │       ├── services/       # Business logic (WebSocket, alerts, etc.)
│   │       └── server.ts       # Entry point
│   ├── web/                    # Next.js dashboard
│   │   └── src/
│   │       ├── app/            # 15+ pages (dashboard, map, inventory, etc.)
│   │       ├── components/     # UI library, shared components
│   │       └── stores/         # Zustand state management
│   ├── mobile/                 # React Native app
│   │   └── src/
│   │       ├── screens/        # 16+ screens across 5 tabs
│   │       ├── navigation/     # Stack + tab navigators
│   │       ├── stores/         # Zustand stores (auth, units, map, etc.)
│   │       ├── services/       # API client, WebSocket, offline storage
│   │       └── hooks/          # Auth, location, offline, debounce
│   └── iot-ingest/             # IoT telemetry pipeline
│       └── src/
│           ├── mqtt/           # ChirpStack MQTT subscriber + parser
│           ├── pipeline/       # 11-stage processing (Kalman, geofence, etc.)
│           ├── routes/         # Webhook endpoints
│           └── worker.ts       # Redis Stream consumer
├── packages/
│   ├── shared/                 # 40+ types, 25+ enums, Zod validators
│   │   └── src/
│   │       ├── types/          # All TypeScript interfaces
│   │       ├── enums/          # Domain enums (UnitStatus, TrackerStatus, etc.)
│   │       ├── validators/     # Zod schemas for API request validation
│   │       └── constants/      # App-wide constants
│   └── db/                     # Database layer
│       └── src/
│           ├── schema/         # 22 Drizzle ORM table definitions
│           └── migrations/     # SQL migrations
├── infrastructure/
│   ├── docker/                 # docker-compose.yml (Postgres, Redis, MQTT, ChirpStack)
│   ├── chirpstack/             # ChirpStack configuration
│   └── scripts/                # DB init scripts
├── .github/workflows/          # CI pipeline (lint, typecheck, test)
├── scripts/dev.sh              # Local dev bootstrap
├── .env.example                # Environment variable template
├── turbo.json                  # Turborepo task config
└── tsconfig.base.json          # Shared TypeScript config (strict mode)
```

## API Overview

**80+ REST endpoints** organized in 11 phases:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Auth** | `POST /auth/login`, `/register`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` | JWT auth with 15min access + 7d refresh tokens |
| **Units** | `POST/GET/PATCH/DELETE /units` | RV inventory CRUD with filtering and search |
| **Trackers** | `POST/GET/PATCH /trackers`, `/assign`, `/unassign` | GPS tracker management and assignment |
| **Lots** | `POST/GET/PATCH /lots`, `/grid`, `/spots` | Lot setup with spot grids |
| **Locations** | `GET /units/:id/location-history`, `/lots/:id/live-positions` | Location history and live tracking |
| **Geo-fencing** | `POST/GET/PATCH/DELETE /geofences`, `/events` | Zone boundaries with enter/exit detection |
| **Alerts** | `POST/GET /alert-rules`, `GET /alerts`, `/acknowledge`, `/dismiss`, `/snooze` | Configurable alert rules and management |
| **Staging** | `POST/GET/PATCH /staging-plans`, `/activate`, `/move-list` | Lot organization optimization |
| **Work Orders** | `POST/GET/PATCH /work-orders`, `/complete` | Service tracking with PDI workflows |
| **Recalls** | `POST/GET/PATCH /recalls`, `/match`, `/assign-work-orders` | Recall management with unit matching |
| **Analytics** | `GET /analytics/inventory`, `/lot-utilization`, `/movement`, `/compliance` | Real-time business intelligence |
| **Reports** | `POST/GET /reports`, `/generate`, `/download` | Scheduled report generation (CSV, PDF, JSON) |
| **Billing** | `GET /billing`, `/invoices`, `POST /billing/webhook` | Stripe-integrated subscription billing |
| **Settings** | `PATCH /settings/dealership`, `POST/GET/PATCH/DELETE /settings/users` | Dealership config and user management |
| **API Keys** | `POST/GET/PATCH/DELETE /api-keys` | Third-party API access |
| **Webhooks** | `POST/GET/PATCH/DELETE /webhooks`, `/deliveries` | Event-driven webhook delivery |
| **DMS** | `POST/GET/PATCH /dms`, `/test`, `/sync`, `/logs` | Dealership management system integration |
| **Widget** | `GET/PATCH /widget` | Embeddable inventory widget config |
| **Public API** | `GET /public/v1/inventory`, `/units/:id` | Public inventory endpoints |
| **Groups** | `POST/GET /groups`, `/add-dealership`, `/remove-dealership` | Multi-dealership organization |
| **Transfers** | `POST/GET/PATCH /transfers`, `/depart`, `/arrive` | Inter-lot unit transfers |
| **WebSocket** | `ws://host/ws` | Real-time location updates, alerts, status changes |

All endpoints prefixed with `/api/v1/` unless noted. Full OpenAPI docs at `/api/docs`.

## Database

**22 tables** powered by PostgreSQL + TimescaleDB (via Drizzle ORM):

- **Business**: `dealership_groups`, `dealerships`, `users`, `refresh_tokens`
- **Inventory**: `units`, `lots`, `lot_spots`, `unit_photos`, `unit_notes`
- **Tracking**: `trackers`, `tracker_assignments`, `gateways`, `gateway_telemetry`
- **Location**: `location_history` (TimescaleDB hypertable), `movement_events`
- **Geo-fencing**: `geo_fences`, `geo_fence_events`
- **Alerts**: `alert_rules`, `alerts`
- **Operations**: `work_orders`, `recalls`, `staging_plans`, `staging_assignments`
- **Audit**: `audit_log`, `compliance_snapshots`
- **Integration**: `api_keys`, `webhook_endpoints`, `webhook_deliveries`, `dms_integrations`, `dms_sync_logs`
- **Billing**: `billing_events`, `scheduled_reports`, `feature_flags`, `widget_configs`
- **Multi-location**: `unit_transfers`

## IoT Pipeline

The ingest service processes LoRaWAN tracker telemetry through an **11-stage pipeline**:

```
MQTT/Webhook → Validate → Deduplicate → Redis Stream → Worker
                                                          │
    ┌─────────────────────────────────────────────────────┘
    ▼
 1. Lookup    (device → tracker → unit → dealership → lot)
 2. Battery   (update telemetry, alert if low)
 3. Position  (GPS → RSSI triangulation → last-known fallback)
 4. Kalman    (2D Kalman filter for position smoothing)
 5. Zone Snap (snap to nearest lot spot within 15m)
 6. Movement  (detect zone/row/spot changes > 5m)
 7. Geofence  (enter/exit detection, trigger alert rules)
 8. Store     (update Redis cache + units table)
 9. History   (throttled write to TimescaleDB hypertable)
10. Broadcast (Redis pub/sub → WebSocket to clients)
11. Log       (movement_events audit trail)
```

**Key design choices:**
- Kalman filter uses equirectangular projection (RVs are mostly stationary — low process noise)
- Zone snapping within 15m radius prevents GPS jitter from causing false movements
- History writes throttled to 5-minute intervals for stationary units
- Deduplication window of 60s + rate limiting of 1 event per 5s per device
- Horizontal scaling via Redis consumer groups

## Web Dashboard

Built with **Next.js 15 + React 19 + Tailwind CSS 4**:

- **Dashboard** — KPI cards, tracker health, alert summary, activity feed
- **Map** — Mapbox GL interactive lot visualization with unit markers and zones
- **Inventory** — Filterable data tables with CSV import/export
- **Trackers** — Battery monitoring dashboard
- **Alerts** — Severity-based alert management with bulk actions
- **Service** — Work orders and recall tracking
- **Staging** — Drag-and-drop lot organization planner
- **Analytics** — Recharts-powered inventory, utilization, and movement reports
- **Settings** — Dealership config, user management, lots, notifications, billing, API keys, webhooks, DMS

## Mobile App

Built with **React Native 0.76** for iOS and Android:

**5-tab navigation:**
1. **Map** — Native maps with unit markers, zone overlays, bottom sheet details
2. **Search** — Full-text unit search with offline cached results
3. **Scan** — Camera barcode scanner + BLE/NFC tracker pairing
4. **Tasks** — Work order queue for porters and service staff
5. **Account** — Profile, notification preferences, sign out

**Offline-first architecture:**
- SQLite (op-sqlite) for units cache and pending action queue
- MMKV for auth token persistence
- Automatic sync when connectivity restored
- Queued actions: status changes, notes, tracker assignments

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET` | Yes | — | Secret for JWT signing |
| `API_PORT` | No | `3000` | API server port |
| `MQTT_BROKER_URL` | No | `mqtt://localhost:1883` | ChirpStack MQTT |
| `CORS_ORIGINS` | No | `localhost:3001,8081` | Allowed origins |
| `STRIPE_SECRET_KEY` | No | — | Billing integration |
| `R2_ACCOUNT_ID` | No | — | Cloudflare R2 file storage |
| `SES_REGION` | No | — | AWS SES email |
| `TWILIO_ACCOUNT_SID` | No | — | SMS notifications |
| `FCM_PROJECT_ID` | No | — | Push notifications |
| `SENTRY_DSN` | No | — | Error tracking |

## Infrastructure

Docker Compose provides all backing services for local development:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL | `timescale/timescaledb-ha:pg16` | 5432 | Primary database with TimescaleDB extension |
| Redis | `redis:7-alpine` | 6379 | Cache, pub/sub, streaming |
| Mosquitto | `eclipse-mosquitto:2` | 1883, 9001 | MQTT broker |
| ChirpStack | `chirpstack/chirpstack:4` | 8080 | LoRaWAN network server |

```bash
# Start all infrastructure
cd infrastructure/docker && docker compose up -d

# Or just the essentials (no ChirpStack)
docker compose up -d postgres redis mosquitto
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):
- **Lint & Typecheck** — ESLint + `tsc --noEmit` across all packages
- **Test** — Vitest with PostgreSQL + Redis service containers

## Development Commands

```bash
pnpm run build        # Build all packages
pnpm run dev          # Start all apps in dev mode
pnpm run lint         # Lint all packages
pnpm run typecheck    # TypeScript check all packages
pnpm run test         # Run all tests
pnpm run db:generate  # Generate Drizzle migrations
pnpm run db:migrate   # Apply migrations
pnpm run db:seed      # Seed demo data
pnpm run db:studio    # Open Drizzle Studio (DB browser)
```

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.7 (strict mode) |
| Monorepo | pnpm workspaces + Turborepo |
| API | Fastify 5 + Drizzle ORM |
| Database | PostgreSQL 16 + TimescaleDB |
| Cache | Redis 7 |
| Auth | JWT (access + refresh tokens) + bcrypt |
| Web | Next.js 15, React 19, Tailwind CSS 4, Mapbox GL |
| Mobile | React Native 0.76, React Navigation 7, Zustand |
| IoT | MQTT (ChirpStack), Redis Streams, Kalman filter |
| Validation | Zod |
| Testing | Vitest, Jest, React Testing Library |
| CI/CD | GitHub Actions |
| Infra | Docker Compose (Postgres, Redis, Mosquitto, ChirpStack) |

## Codebase Stats

- **265 source files** across 6 packages
- **~50,700 lines** of TypeScript
- **80+ API endpoints** with OpenAPI documentation
- **22 database tables** with full referential integrity
- **11-stage IoT pipeline** with Kalman filtering
- **0 TypeScript errors** across all packages
