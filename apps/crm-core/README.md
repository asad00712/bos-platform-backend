# CRM Core Service

Multi-tenant CRM service. Owns all business-layer operations for tenant organisations: staff management, contacts, deals, appointments, billing, and module configuration. Every request is scoped to a tenant via a validated JWT.

## Responsibilities

- **Tenant configuration** — module selection, business profile, vertical terminology
- **Staff management** — invite, list, update roles, deactivate within a tenant
- **Contacts** — core CRM entity (planned)
- **Deals / Pipeline** — kanban sales workflow (planned)
- **Notes & Activities** — interaction history per contact (planned)
- **Documents** — file attachments per contact/deal (planned)
- **Appointments / Calendar** — scheduling (deferred, pending discussion)

## Service Ports

| Environment | Port |
|---|---|
| Development | `3002` (via `CRM_CORE_PORT`) |
| Swagger UI | `http://localhost:3002/api/v1/docs` |

## Build & Run

```bash
# Development (hot-reload)
pnpm start:crm-core:dev

# Production build
pnpm build:crm-core

# Production run
pnpm start:crm-core
```

## Environment Variables

```env
# From .env.example — subset relevant to CRM Core
CRM_CORE_PORT=3002
APP_FRONTEND_URL=http://localhost:3000

DATABASE_URL_CORE=postgresql://postgres:postgres@localhost:5432/bos_core

AUTH_JWT_PUBLIC_KEY_PATH=./keys/jwt-public.pem
AUTH_JWT_ALGORITHM=RS256

REDIS_HOST=localhost
REDIS_PORT=6379

REDIS_QUEUE_TRANSACTIONAL_HOST=localhost
REDIS_QUEUE_TRANSACTIONAL_PORT=6380

REDIS_QUEUE_HEAVY_HOST=localhost
REDIS_QUEUE_HEAVY_PORT=6381
```

## Module Structure

```
apps/crm-core/src/
├── bootstrap/
│   └── apply-swagger.ts       # Swagger config helper
├── common/
│   └── services/
│       └── permission-resolver.service.ts   # Live RBAC resolution from tenant DB
├── modules/
│   ├── tenant/                # Module selection, business profile, terminology
│   └── staff/                 # Staff invite, list, deactivate, role updates
└── app.module.ts
```

## Authentication & Authorization

Every endpoint (except `/health`) requires a valid Bearer JWT issued by Auth Service. The JWT carries `scope=tenant`, `tenantId`, `roles`, and `accessibleBranchIds`.

Permissions are **not embedded** in the JWT. `PermissionsGuard` calls `TenantPermissionResolverService` on first request to lazily load permission slugs from the tenant schema (`UserBranchMembership → Role → Permission`). Results are cached on `request.user.permissions` for the duration of the request and also cached in an LRU (60s TTL) across requests.

### Permission Slugs Used

| Slug | Required by |
|---|---|
| `tenant:users:invite` | POST /staff/invite, GET/DELETE /staff/invites |
| `tenant:users:manage_roles` | PATCH /staff/:id/role, DELETE /staff/:id |

## Database Access

CRM Core has access to **two** Prisma clients:

| Client | Scope |
|---|---|
| `CorePrismaService` | `bos_core.public` — users, tenants, memberships, invites |
| `TenantPrismaService` | `bos_core.tenant_{uuid}` — roles, branches, user-branch-memberships |

Cross-schema joins are done at the application layer (no FK between schemas).

## Dependencies

- `@bos/config` — `crmCoreEnvSchema` (Joi validation)
- `@bos/logger` — structured Pino logging
- `@bos/security` — CORS, Helmet, compression, ValidationPipe, ThrottlerGuard
- `@bos/redis` — BosRedisModule (ioredis, operational Redis)
- `@bos/database` — CorePrismaService + TenantPrismaService
- `@bos/auth-client` — JwtAuthGuard + PermissionsGuard (global APP_GUARDs)
- `@bos/queue` — BosQueueModule (BullMQ, transactional queue for mail)
- `@bos/health` — `/health`, `/health/live`, `/health/ready`

## Tests

```bash
# Run CRM Core tests only
npx jest "crm-core" --no-coverage

# Full suite
npx jest --no-coverage
```
