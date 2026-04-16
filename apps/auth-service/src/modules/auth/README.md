# Auth Module (auth-service)

Issuance and lifecycle of authentication credentials for every BOS user.

## Purpose

Primary user-facing module of the Auth Service. Owns:

- **Signup** — self-serve org-owner registration + email verification trigger. Tenant schema provisioning is enqueued as an async job AFTER email verification (not during signup).
- **Login** — password verification + lockout tracking + 2FA gating + session + token issuance.
- **Token issuance** — signs JWT access tokens with the private RSA key, generates opaque refresh tokens, persists refresh token metadata with rotation tracking (familyId/parentId) for reuse detection.
- **Refresh** — rotates refresh tokens, detects reuse (→ revokes entire token family).
- **Logout** — single-device + all-device, revokes access jti in Redis + marks refresh revoked.
- **Password reset** — forgot-password request → email token → reset endpoint (revokes all sessions on success).
- **Email verification** — verify email → activate user → trigger tenant provisioning.

## Public API (HTTP)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | Public | Org-owner self-signup — creates User(pending) + Tenant(provisioning) |
| GET | `/auth/verify-email` | Public | Completes email verification via token |
| POST | `/auth/login` | Public | Email + password → access + refresh (+ temp token if 2FA) |
| POST | `/auth/refresh` | Refresh token (cookie) | Rotates tokens with reuse detection |
| POST | `/auth/logout` | Bearer | Ends current session |
| POST | `/auth/logout-all` | Bearer | Ends all sessions for current user |
| POST | `/auth/forgot-password` | Public | Always returns 200 (no email enumeration) |
| POST | `/auth/reset-password` | Public | Uses one-time reset token |
| POST | `/auth/change-password` | Bearer | Authenticated password change |

## Events Emitted

`user.registered`, `user.logged_in`, `user.login_failed`, `user.logged_out`, `user.password_changed`, `tenant.created` (on signup). Payloads follow `@bos/common` `BosEvent<T>` envelope.

## Events Consumed

None directly. Future: listen for `tenant.provisioned` to flip tenant_memberships status from `invited`→`active` for owner on signup. For now that lives in the signup service flow.

## Permissions Defined

None for public endpoints. Protected endpoints (logout, change-password, me) require only authentication, not specific permissions.

## Database Tables Touched

- `public.users` — identity writes (via UsersService)
- `public.tenants` — tenant row creation on signup
- `public.tenant_memberships` — owner membership creation on signup
- `public.sessions` — session rows on login/2FA-complete
- `public.refresh_tokens` — refresh token family rows
- `public.email_verifications` — signup + email change tokens
- `public.password_resets` — forgot-password tokens

## Dependencies

- `UsersModule` (internal)
- `@bos/database` — CorePrismaService
- `@bos/security` — PasswordHasherService + password policy
- `@bos/redis` — RedisService (rate limiting + lockout counter + revocation)
- `@bos/errors` — typed exceptions
- `jose` — RSA JWT signing
- `@bos-prisma/core` — typed models

## Security Posture

- Passwords never traverse logs (Pino redact paths include `req.body.password`, `req.body.newPassword`).
- Refresh tokens are opaque (UUID v4 with 128 bits of entropy); stored hashed (SHA-256). Only the raw token is returned once, via HttpOnly Secure SameSite=Strict cookie.
- Reuse detection: on refresh, if the submitted token has `usedAt` set, the entire token family is revoked and the user is force-logged-out platform-wide with audit trail.
- Login throttle: 5 attempts per minute per IP and 10 per hour per email (via `@nestjs/throttler` named throttlers on the login endpoint).
- Account lockout: 10 consecutive failures within 15 minutes → status=locked for 30 min. Counter stored in Redis with TTL so it resets on success.
- 2FA: after password verify when enabled, we issue a 5-minute temp token with `scope=two_factor_pending`. Only that token can progress to `/auth/2fa/verify`.
- `/auth/forgot-password` always 200 — never reveals whether an email exists (prevents account enumeration).
- `/auth/reset-password` invalidates ALL existing sessions on success (standard defensive practice if reset was triggered by compromise).

## Open Questions

- Do we enforce email deliverability on signup (e.g., syntactic + MX lookup) before writing a row? Deferred to a validator pipe decision in the DTO review.
- Password history enforcement — requires a dedicated `user_password_history` table. Phase 2.
- Device fingerprinting beyond IP + UA — Phase 2 / needs a third-party fingerprinting service choice.
