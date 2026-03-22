# Contributing to RV Trax

Thank you for your interest in contributing to RV Trax! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Follow the [Quick Start](README.md#quick-start) guide to set up your development environment
4. Create a feature branch from `main`

## Development Workflow

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, MQTT)
cd infrastructure/docker && docker compose up -d postgres redis mosquitto

# Run all apps in development
pnpm run dev

# Run lint, typecheck, and tests before submitting
pnpm run lint
pnpm run typecheck
pnpm run test
```

## Code Standards

- **TypeScript** with strict mode enabled across all packages
- **ESLint** for linting — run `pnpm run lint` before committing
- **Prettier** for formatting — config in `.prettierrc`
- All API inputs are validated with **Zod** schemas
- Database queries use **Drizzle ORM** (no raw SQL unless necessary)
- Multi-tenant isolation: all queries must filter by `dealershipId`

## Project Structure

This is a **pnpm monorepo** managed with **Turborepo**:

- `apps/api` — Fastify REST API
- `apps/web` — Next.js dashboard
- `apps/mobile` — React Native app
- `apps/iot-ingest` — IoT telemetry pipeline
- `packages/shared` — Shared types, enums, validators
- `packages/db` — Database schema and migrations

## Submitting Changes

1. Create a descriptive branch name (e.g., `fix/alert-pagination`, `feat/batch-tracker-import`)
2. Write clear commit messages
3. Ensure all checks pass (`lint`, `typecheck`, `test`)
4. Open a Pull Request with a description of what changed and why
5. Link any related issues

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include steps to reproduce for bugs
- Include expected vs actual behavior
