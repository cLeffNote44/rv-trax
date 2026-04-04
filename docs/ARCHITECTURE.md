# Architecture

This document describes the high-level architecture, design decisions, and extension points for RV Trax.

## System Overview

RV Trax is a real-time GPS lot management platform for RV dealerships. It processes LoRaWAN tracker telemetry, provides a web dashboard and mobile app for lot operations, and exposes a REST API for integrations.

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

## Design Principles

1. **Multi-tenant by default** — Every database query filters by `dealershipId`. There is no way to access another dealership's data.
2. **Offline-first mobile** — The mobile app queues operations locally (SQLite) and syncs when connectivity resumes.
3. **IoT-grade ingestion** — The telemetry pipeline is designed for high-throughput, low-latency processing with deduplication, rate limiting, and Kalman filtering.
4. **Progressive feature adoption** — Feature flags control which capabilities are available per subscription tier.
5. **API-first** — Every operation is available via REST API. The web dashboard and mobile app are API consumers.

## Monorepo Structure

```
rv-trax/
├── apps/
│   ├── api/           # Fastify REST API + WebSocket server
│   ├── web/           # Next.js 15 dashboard
│   ├── mobile/        # React Native 0.76 field app
│   └── iot-ingest/    # MQTT → Redis Stream → Processing pipeline
├── packages/
│   ├── shared/        # Types, enums, Zod validators, constants
│   └── db/            # Drizzle ORM schema, migrations, seed
└── infrastructure/
    ├── docker/        # Docker Compose for local dev
    ├── monitoring/    # Prometheus + Grafana dashboards and alerting rules
    ├── chirpstack/    # LoRaWAN server config
    └── scripts/       # Database init scripts
```

**Build order** (enforced by Turborepo):

```
packages/shared → packages/db → apps/api, apps/web, apps/mobile, apps/iot-ingest
```

## API Server (apps/api)

**Framework:** Fastify 5 with TypeScript

### Plugin Architecture

Fastify plugins are registered in order:

1. **Security** — CORS, Helmet, CSRF protection
2. **Rate limiting** — Per-endpoint limits, tiered by subscription
3. **Authentication** — JWT verification via `@fastify/jwt`
4. **Database** — Drizzle ORM connection pool (decorated as `app.db`)
5. **Redis** — ioredis client (decorated as `app.redis`)
6. **Sentry** — Error tracking (optional, no-op without `SENTRY_DSN`)
7. **Swagger** — OpenAPI 3.0 documentation

### Route Organization

Routes are organized by domain (32 modules):

| Module       | Endpoints                                        | Auth                   |
| ------------ | ------------------------------------------------ | ---------------------- |
| `auth`       | Login, register, refresh, logout, password reset | Public (except logout) |
| `units`      | CRUD, batch, search, filters                     | JWT required           |
| `trackers`   | CRUD, assign/unassign, telemetry                 | JWT required           |
| `public-api` | Public inventory endpoints                       | API key                |
| `admin`      | System administration                            | Admin token            |
| `activity`   | Staff activity feed, efficiency stats            | JWT required           |
| `audits`     | Floor plan audit workflow                        | JWT required           |
| `svc-bays`   | Service bay management, kanban stages            | JWT required           |
| `dashboard`  | Per-user dashboard widget layouts                | JWT required           |
| _...24 more_ | See `docs/api-endpoint-catalog.md`               | Varies                 |

### Authentication Flow

```
Login → JWT access token (15 min) + refresh token (7 days, HttpOnly cookie)
  │
  ├── Access token expired → POST /auth/refresh → new access + refresh pair
  └── Refresh token expired → redirect to login
```

### Multi-Tenancy

Every authenticated request includes `dealershipId` extracted from the JWT. Middleware ensures:

- All database queries include `WHERE dealership_id = $dealershipId`
- Cross-tenant data access is impossible at the application layer
- Admin routes bypass tenant filtering (protected by separate admin token)

## IoT Pipeline (apps/iot-ingest)

The telemetry pipeline processes LoRaWAN tracker events through 11 stages:

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

**Key design decisions:**

- **Kalman filter** uses equirectangular projection (suitable for stationary assets)
- **Zone snapping** within 15m prevents GPS jitter from creating false movements
- **History throttling** — writes every 5 minutes for stationary units, every update for moving units
- **Deduplication** — 60s window with rate limit of 1 event per 5s per device
- **Horizontal scaling** — Redis consumer groups allow multiple worker instances

## Web Dashboard (apps/web)

**Framework:** Next.js 15 (App Router) with React 19

### Page Structure

```
app/
├── page.tsx                    # Marketing landing page
├── (auth)/                     # Login, register, reset-password
├── (dashboard)/                # Authenticated pages (37+ routes)
│   ├── layout.tsx              # Sidebar + header chrome
│   ├── dashboard/              # Customizable widget dashboard
│   ├── inventory/              # Unit management + detail views
│   ├── trackers/               # Device management
│   ├── alerts/                 # Alert rules + history
│   ├── analytics/              # Charts + aging dashboard
│   ├── staging/                # Lot planning
│   ├── service/                # Work orders, recalls, service bays
│   ├── audits/                 # Floor plan audit workflow
│   ├── activity/               # Staff activity timeline
│   ├── test-drives/            # Test drive tracking
│   └── settings/               # Config, users, billing, DMS, widget
└── api/health/                 # Health check endpoint
```

### State Management

- **Server state** — React hooks with `fetch` + SWR-like caching via `useApi` custom hook
- **Auth state** — React Context (`AuthProvider`) with JWT token management
- **WebSocket** — React Context for real-time updates (locations, alerts)
- **No global store** — deliberate choice to keep the web app simple; Zustand is used only in mobile

### Styling

- **Tailwind CSS 4** with CSS custom properties for theming
- **Dark/light mode** via `prefers-color-scheme` media query + CSS variables
- **Component library** — Custom components in `src/components/ui/` (Button, Input, Badge, Card, Dialog, Select, Tabs)

## Mobile App (apps/mobile)

**Framework:** React Native 0.76 with React Navigation 7

### Offline-First Architecture

```
API Request → Success? → Update Zustand store → Render
                │
                └── Failure → Queue in SQLite → Show cached data → Sync on reconnect
```

- **SQLite** (op-sqlite) for persistent unit cache and pending action queue
- **MMKV** for auth tokens and user preferences
- **Zustand** stores with MMKV persistence middleware

## Extension Points

### Adding a New API Route

1. Create route file in `apps/api/src/routes/{domain}.ts`
2. Define Zod schemas for request/response validation
3. Register route in `apps/api/src/server.ts`
4. Add OpenAPI tags for Swagger documentation

### Adding a New Dashboard Page

1. Create page in `apps/web/src/app/(dashboard)/{feature}/page.tsx`
2. Add `'use client'` directive for interactive pages
3. Use `useApi` hook for data fetching
4. Add navigation link in `src/components/layout/Sidebar.tsx`

### Adding a New Database Table

1. Create schema file in `packages/db/src/schema/{table}.ts`
2. Export from `packages/db/src/index.ts`
3. Run `pnpm run db:generate` to create migration
4. Run `pnpm run db:migrate` to apply

### Adding a New Alert Type

1. Add enum value in `packages/shared/src/enums/`
2. Add Zod validator in `packages/shared/src/validators/`
3. Create handler in `apps/api/src/services/alerts/`
4. Add pipeline stage in `apps/iot-ingest/src/pipeline/` (if IoT-triggered)
