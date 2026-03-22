# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in RV Trax, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to the maintainers directly. Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and work to release a patch promptly.

## Security Measures

RV Trax implements the following security measures:

- **Authentication**: JWT with short-lived access tokens (15 min) and rotating refresh tokens (7 day)
- **Password storage**: bcrypt with 12 rounds
- **API key storage**: SHA-256 hashed, never stored in plaintext
- **Rate limiting**: Per-endpoint and per-API-key rate limits
- **Input validation**: All inputs validated with Zod schemas
- **SQL injection**: Prevented via Drizzle ORM parameterized queries
- **CSRF protection**: Fastify CSRF plugin with SameSite cookies
- **Security headers**: Helmet.js middleware
- **Multi-tenancy**: Application-level dealership isolation on all queries
- **Webhook signatures**: HMAC-SHA256 signed payloads
- **Timing-safe comparisons**: For token and secret verification

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
