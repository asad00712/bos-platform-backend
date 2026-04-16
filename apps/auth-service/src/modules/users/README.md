# Users Module (auth-service)

Identity storage and lookup for every BOS user (tenant users AND platform staff). Owned by Auth Service because it's the only service that writes to `public.users`.

## Purpose

- CRUD for the `bos_core.public.users` row — email, password hash, full name, 2FA secret, lockout state, deletion.
- Internal queries by email / id used by Auth flows (signup, login, password reset, 2FA).
- NO HTTP controllers yet — usage is internal (other auth-service modules call it directly). Admin-facing user management endpoints are added later under platform/tenant RBAC.

## Public API (other modules)

- `UsersService.findByEmail(email)` — login lookup; case-insensitive (email is `citext` in DB)
- `UsersService.findById(id)`
- `UsersService.create(input)` — inserts a new `pending_verification` / `invited` / `active` user
- `UsersService.setPasswordHash(id, hash)`
- `UsersService.markEmailVerified(id)`
- `UsersService.updateStatus(id, status, reason?)` — lock / suspend / delete
- `UsersService.set2FA(id, { enabled, secret, backupCodes })`
- `UsersService.recordLogin(id, ip)` — updates `lastLoginAt` / `lastLoginIp`

## Events Emitted

*(Events are published by the Auth module, not this one — UsersService is a pure data layer. Keeping the emitter/consumer boundary clean.)*

## Events Consumed

None.

## Permissions Defined

None. Admin endpoints (future) will declare `platform:users:*` / `tenant:users:*` via @RequirePermission.

## Database Tables Owned

- `bos_core.public.users` — shared with every module that needs identity, but writes only come from here.

## Dependencies

- `@bos/database` — `CorePrismaService`
- `@bos/errors` — typed exceptions
- `@bos/common` — `UserStatus` enum

## Security Posture

- Never returns `passwordHash` or `twoFactorSecret` to HTTP layer — response DTO strips them.
- Repository methods that return User always use an explicit `select` clause so Prisma doesn't accidentally leak new sensitive columns added later.
- `findByEmail` normalises the email (lowercase + trim) before querying — even though `citext` is case-insensitive, consistent casing avoids cache/search surprises.
- `create` does NOT set a default password; Auth module is responsible for hashing a plaintext password and calling `setPasswordHash` in the same transaction, OR leaving `passwordHash` null for SSO/invited users.

## Open Questions

- Soft-delete lifecycle: currently flipping `status=deleted` + setting `deletedAt`. When the 90-day grace period hits, a cron job should hard-delete — that cron is NOT in scope for this module.
- Password history (last N passwords) enforcement — Phase 2; tracked as TODO in code.
