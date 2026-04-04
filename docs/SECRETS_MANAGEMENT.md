# Secrets Management & Rotation

This document describes how secrets are managed in RV Trax, best practices for production deployments, and step-by-step rotation procedures for each secret.

## Overview

RV Trax requires several secrets for external service integrations. In development, these live in a `.env` file. In production, use a secrets manager (see recommendations below).

## Secret Inventory

| Secret | Required | Used By | Rotation Impact |
|--------|----------|---------|-----------------|
| `JWT_SECRET` | Yes | API server | All active sessions invalidated |
| `COOKIE_SECRET` | No (falls back to JWT_SECRET) | API server | All cookies invalidated |
| `DATABASE_URL` | Yes | API, IoT Ingest, DB package | Service restart required |
| `REDIS_URL` | Yes | API, IoT Ingest | Brief reconnection |
| `STRIPE_SECRET_KEY` | Production | API billing routes | Immediate; old key stops working |
| `STRIPE_WEBHOOK_SECRET` | Production | API webhook handler | Must update Stripe dashboard simultaneously |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Optional | SES email sending | Create new key pair, deploy, then deactivate old |
| `TWILIO_AUTH_TOKEN` | Optional | SMS notifications | Regenerate in Twilio console, deploy immediately |
| `CHIRPSTACK_API_KEY` | Optional | IoT Ingest | Regenerate in ChirpStack, update config |
| `ADMIN_API_TOKEN` | Optional | Admin endpoints | Generate new token, update any admin scripts |

## Recommended Secrets Managers

For production deployments, avoid storing secrets in `.env` files or environment variables set in deployment dashboards. Use one of:

1. **Doppler** — SaaS, easy integration, supports multiple environments. Recommended for small teams.
2. **AWS Secrets Manager / SSM Parameter Store** — If already on AWS. Native SES/SDK integration.
3. **Infisical** — Open-source, self-hostable, good for compliance-sensitive deployments.
4. **HashiCorp Vault** — Enterprise-grade, complex but powerful. Overkill for most RV Trax deployments.

Integration pattern:
```sh
# Example: Doppler
doppler run -- node dist/server.js

# Example: AWS SSM (via dotenv-vault or custom loader)
# Load secrets at startup from SSM Parameter Store
```

## Rotation Procedures

### JWT_SECRET

**Impact:** All active JWT tokens become invalid. All logged-in users will need to re-authenticate.

**Steps:**
1. Generate a new secret: `openssl rand -base64 48`
2. Update the secret in your secrets manager
3. Deploy the API server with the new secret
4. Monitor for increased 401 errors (expected — users re-authenticating)
5. Confirm login flow works with the new secret

**Recommended cadence:** Every 90 days, or immediately if compromised.

### STRIPE_SECRET_KEY

**Impact:** Billing operations use the new key immediately. The old key stops working.

**Steps:**
1. In Stripe Dashboard, go to Developers > API keys
2. Roll the secret key (Stripe supports rolling keys with a grace period)
3. Update the secret in your secrets manager
4. Deploy the API server
5. Verify a test webhook or billing operation succeeds

**Recommended cadence:** Every 6 months, or immediately if exposed.

### STRIPE_WEBHOOK_SECRET

**Impact:** Webhook signature verification uses the new secret.

**Steps:**
1. In Stripe Dashboard, go to Developers > Webhooks
2. Reveal the signing secret for your endpoint
3. Roll the secret (or create a new endpoint and delete the old one)
4. Update `STRIPE_WEBHOOK_SECRET` in your secrets manager
5. Deploy and verify webhooks arrive successfully

### AWS Credentials (SES)

**Impact:** Email sending uses the new credentials.

**Steps:**
1. In AWS IAM, create a new access key for the SES user
2. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your secrets manager
3. Deploy the API server
4. Send a test email to verify
5. Deactivate the old access key in IAM
6. After 7 days with no issues, delete the old access key

**Recommended cadence:** Every 90 days (AWS best practice).

### TWILIO_AUTH_TOKEN

**Impact:** SMS sending uses the new token immediately.

**Steps:**
1. In Twilio Console, go to Account > API keys and tokens
2. Request a secondary auth token
3. Update `TWILIO_AUTH_TOKEN` in your secrets manager
4. Deploy and verify SMS sending works
5. Promote the secondary token to primary in Twilio

### DATABASE_URL

**Impact:** Service must restart to pick up new connection string.

**Steps:**
1. If rotating the password: update it in your database provider first
2. Update `DATABASE_URL` in your secrets manager
3. Restart API and IoT Ingest services
4. Verify health checks pass (`/readyz`)

### REDIS_URL

**Impact:** Brief reconnection; ioredis handles automatic reconnect.

**Steps:**
1. Update password in your Redis provider
2. Update `REDIS_URL` in your secrets manager
3. Restart services (or they will reconnect automatically with the new URL)
4. Verify health checks pass

## Emergency Response

If a secret is exposed (committed to git, leaked in logs, etc.):

1. **Rotate immediately** — follow the relevant procedure above
2. **Audit access** — check audit logs for unauthorized access during the exposure window
3. **Notify stakeholders** — if customer data may have been accessed
4. **Post-mortem** — document how the exposure happened and prevent recurrence

## Audit Checklist

- [ ] All production secrets are in a secrets manager (not `.env` files)
- [ ] No secrets are committed to git (check with `git log --all -p | grep -i "secret\|password\|token"`)
- [ ] JWT_SECRET is at least 32 characters and not a placeholder value
- [ ] Rotation schedule is documented and followed
- [ ] Emergency rotation procedures are tested annually
