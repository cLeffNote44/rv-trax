# Contributing to RV Trax

Thank you for your interest in contributing to RV Trax! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Follow the [Quick Start](README.md#quick-start) guide to set up your development environment
4. Create a feature branch from `main`

## Prerequisites

- **Node.js** >= 22 (see `.nvmrc`)
- **pnpm** >= 9 (corepack enabled)
- **Docker** & Docker Compose

## Development Workflow

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, MQTT)
cd infrastructure/docker && docker compose up -d postgres redis mosquitto

# Run all apps in development
pnpm run dev

# Run quality checks before submitting
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:coverage   # Check coverage thresholds
```

## Commit Messages

We use **Conventional Commits** enforced by commitlint. Format:

```
type(scope): description

feat(web): add inventory aging dashboard
fix(api): correct rate limit for webhook endpoints
chore(deps): update fastify to v5.3
docs(db): add migration rollback guide
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`
**Scopes:** `web`, `api`, `mobile`, `iot`, `db`, `shared`, `infra`, `ci`, `deps`

## Pre-commit Hooks

Husky + lint-staged automatically runs on `git commit`:

1. **ESLint** — Fixes and checks staged `.ts`/`.tsx` files
2. **Prettier** — Formats all staged files
3. **commitlint** — Validates your commit message format

If hooks fail, fix the reported issues before committing.

## Code Standards

- **TypeScript** with strict mode enabled across all packages
- **ESLint** for linting — run `pnpm run lint` before committing
- **Prettier** for formatting — config in `.prettierrc`
- All API inputs validated with **Zod** schemas
- Database queries use **Drizzle ORM** (no raw SQL unless necessary)
- Multi-tenant isolation: all queries must filter by `dealershipId`

## Project Structure

This is a **pnpm monorepo** managed with **Turborepo**:

- `apps/api` — Fastify REST API
- `apps/web` — Next.js dashboard (33 pages)
- `apps/mobile` — React Native app
- `apps/iot-ingest` — IoT telemetry pipeline
- `packages/shared` — Shared types, enums, validators
- `packages/db` — Database schema and migrations

For detailed architecture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Submitting Changes

1. Create a descriptive branch name (e.g., `fix/alert-pagination`, `feat/batch-tracker-import`)
2. Write clear, conventional commit messages
3. Ensure all checks pass (`lint`, `typecheck`, `test`)
4. Open a Pull Request using the [PR template](.github/pull_request_template.md)
5. Link any related issues
6. Wait for CI to pass and a review from a code owner

## Branch Protection

The `main` branch requires:

- All CI checks passing
- At least 1 approving review
- No force pushes

## Reporting Issues

Use GitHub Issues with our templates:

- **Bug Report** — Include steps to reproduce, expected/actual behavior
- **Feature Request** — Describe the problem and proposed solution

## Documentation

When adding features, update the relevant docs:

- New API endpoints → `docs/api-endpoint-catalog.md`
- New database tables → `docs/DATABASE.md`
- Architecture changes → `docs/ARCHITECTURE.md`
- Security-relevant changes → `docs/SECURITY_CONTROLS.md`
- Secret additions/changes → `docs/SECRETS_MANAGEMENT.md`
- User-facing features → `CHANGELOG.md`
