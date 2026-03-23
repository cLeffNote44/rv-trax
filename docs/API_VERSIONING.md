# API Versioning Strategy

## Overview

RV Trax uses **URI-based versioning** (`/api/v1/`, `/api/v2/`). Both versions run simultaneously — clients choose which to use via the URL prefix.

## Versions

| Version | Status        | Base URL   | Notes                                    |
| ------- | ------------- | ---------- | ---------------------------------------- |
| v1      | Stable        | `/api/v1/` | Original API, cursor-based pagination    |
| v2      | New (v0.4.0+) | `/api/v2/` | Offset pagination, standardized envelope |

## v2 Changes

### Standardized Response Envelope

All v2 responses use a consistent envelope:

```json
{
  "data": { ... },
  "meta": {
    "api_version": 2,
    "page": 1,
    "limit": 25,
    "total": 142,
    "total_pages": 6,
    "has_next": true,
    "has_prev": false
  },
  "errors": null
}
```

Error responses:

```json
{
  "data": null,
  "meta": { "api_version": 2 },
  "errors": [{ "code": "NOT_FOUND", "message": "Unit not found" }]
}
```

### Offset Pagination

v2 uses page/limit instead of cursor-based pagination:

```
GET /api/v2/units?page=2&limit=25&sort=created_at&order=desc
```

### Expanded Responses

v2 unit responses include embedded relations (tracker info, etc.) to reduce client-side N+1 queries.

### Response Headers

v2 adds standard headers:

- `X-API-Version: 2`
- `X-RateLimit-Policy: sliding-window`

## Migration Guide (v1 → v2)

1. Update base URL from `/api/v1/` to `/api/v2/`
2. Update pagination: replace `cursor` param with `page` + `limit`
3. Read data from `response.data` (same as v1)
4. Read pagination from `response.meta` instead of `response.pagination`
5. Check `response.errors` for error handling

## Deprecation Policy

- New features ship in **v2 only** (v1 gets bug fixes only)
- v1 will not be removed until **v3** is released
- Minimum **12-month deprecation window** before any version removal
- Deprecation headers will be added to v1 endpoints when v2 equivalents exist

## Available v2 Endpoints

| Method | Path                | Description                       |
| ------ | ------------------- | --------------------------------- |
| GET    | `/api/v2/health`    | Health check (v2 envelope format) |
| GET    | `/api/v2/units`     | List units with offset pagination |
| GET    | `/api/v2/units/:id` | Get unit with expanded relations  |

More v2 endpoints will be added incrementally as the API evolves.
