# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Start services
pnpm run start:auth           # Auth service (port 3001)
pnpm run start:crm-core       # CRM Core service (port 3002)
pnpm run start:auth:dev       # Auth with --watch
pnpm run start:crm-core:dev   # CRM Core with --watch

# Infrastructure (Nginx gateway :80 + Redis + RedisInsight :5540)
pnpm docker:dev:up
pnpm docker:dev:down
```

### Testing

```bash
npx jest                                      # All tests (run from repo root)
npx jest --no-coverage                        # Skip coverage
npx jest apps/crm-core                        # Specific app
npx jest --testPathPattern="staff.service"    # Single spec file
npx jest --watch                              # Watch mode
```

Always run Jest from the repo root (`d:/My Documents/MyProjects/BackendServers/bos-backend`).
Use `jest.resetAllMocks()` in `beforeEach`, not `jest.clearAllMocks()` — clearAllMocks does NOT flush `mockResolvedValueOnce` queues, causing cross-test pollution.

### Type checking & Linting

```bash
pnpm typecheck        # tsc --noEmit (must be clean before any PR)
pnpm lint             # ESLint flat config
pnpm lint:fix         # Auto-fix
pnpm format:check     # Prettier check
pnpm format           # Prettier write
```

### Database

```bash
# Prisma generate (after schema changes)
pnpm db:generate                          # All three clients
pnpm db:generate:core                     # @bos-prisma/core
pnpm db:generate:tenant                   # @bos-prisma/tenant
pnpm db:generate:volatile                 # @bos-prisma/volatile

# Migrations
pnpm db:migrate:core:dev                  # bos_core (runs migration + applies)
pnpm db:migrate:tenant:dev                # tenant-template (--create-only, manual apply)
pnpm db:migrate:volatile:dev              # bos_volatile

# Seed (required after reset — free TenantPlan must exist for signup)
pnpm db:seed:core

# Prisma CLI flag: always --config=prisma/<name>/prisma.config.ts (not --schema)
```

Tenant-template migrations are created with `--create-only` and then applied manually via `TenantSchemaManager.applyMigrationToAllTenants()` to every existing tenant schema.

---

## Architecture

### Monorepo Layout

```
apps/
  auth-service/       # Port 3001 — JWT issuance, signup, login, 2FA, invites
  crm-core/           # Port 3002 — Tenants, staff, branches, roles, custom fields
libs/
  auth-client/        # JWT verification guard, PermissionsGuard, decorators
  common/             # Shared enums, types (SessionScope, UserStatus, etc.)
  config/             # BosConfigModule (Joi-validated env per service)
  database/           # CorePrismaService, TenantPrismaService, TenantSchemaManager
  errors/             # All BosException subclasses + error codes
  health/             # BosHealthModule (terminus)
  logger/             # Pino wrapper (BosLoggerModule)
  mailer/             # MailerService (Resend), email templates
  queue/              # BullMQ module, job names, payload types
  redis/              # BosRedisModule (3-instance ioredis)
  security/           # BosSecurityModule (Helmet, CORS, throttler, ValidationPipe)
prisma/
  core/               # bos_core schema — public (users, tenants, sessions) + tenant models
  tenant-template/    # Template for tenant_{uuid} schemas — RBAC, branches, custom fields
  volatile/           # bos_volatile — OutboundMessage (audit/campaign, partitioned)
```

### Database Strategy

**bos_core** — One PostgreSQL database with two schema layers:
- `public` schema: global platform tables (User, Tenant, TenantMembership, Session, RefreshToken, EmailVerification, etc.). Managed via `CorePrismaService`.
- `tenant_{hex16+}` schemas: per-tenant RBAC + business data. Accessed via `TenantPrismaService.forSchema(schemaName)` which returns a `PrismaClient` bound to that schema via `new PrismaPg(pool, { schema: schemaName })`.

**bos_volatile** — Ephemeral high-volume data. `OutboundMessage` (email/SMS delivery tracking), audit logs. Not yet partitioned.

**TenantSchemaManager** — Provisions new tenant schemas: `CREATE SCHEMA`, applies `TENANT_TEMPLATE_SQL`, seeds default roles/permissions, assigns owner `UserBranchMembership`. Called from `EmailVerifyService.execute()` on email verification. Incremental migrations to existing schemas use `applyMigrationToAllTenants(sql)`.

### Auth & Permissions Flow

**JWT lifecycle**: Auth service signs RS256 JWTs. CRM Core verifies them via `BosAuthClientModule`. The JWT carries `tenantId`, `scope: 'tenant'`, `roles: []` — permissions are NOT embedded in the token.

**Permission resolution** (lazy, per-request):
1. `JwtAuthGuard` (APP_GUARD in `BosAuthClientModule`) — verifies JWT, attaches `request.user` with empty `permissions: Set<string>`.
2. `PermissionsGuard` (APP_GUARD in each service's `AppModule`) — when `@RequirePermission(...)` is hit and `user.permissions.size === 0`, calls `PERMISSION_RESOLVER` to load permissions from DB.
3. `TenantPermissionResolverService` — queries `UserBranchMembership → Role → RolePermission → Permission` in the tenant schema. LRU-caches the result for 60 seconds.

**Critical DI rules for PermissionsGuard**:
- `PermissionsGuard` is registered as `APP_GUARD` inside `BosAuthClientModule`, directly after `JwtAuthGuard`. This ensures correct execution order: JWT verification → permission check.
- **Do NOT register `PermissionsGuard` as APP_GUARD in `AppModule`**. AppModule initializes before BosAuthClientModule; its APP_GUARDs would run before `JwtAuthGuard`, hitting `request.user === undefined` and throwing 403 on every protected route.
- The guard uses `ModuleRef.get(PERMISSION_RESOLVER, { strict: false })` to find the resolver at runtime across the full app context, regardless of which module provided it.
- Each consuming service registers `PERMISSION_RESOLVER` in its own `AppModule.providers`. The guard discovers it automatically.

```typescript
// app.module.ts — correct pattern
providers: [
  TenantPermissionResolverService,
  { provide: PERMISSION_RESOLVER, useExisting: TenantPermissionResolverService },
  // Do NOT add APP_GUARD: PermissionsGuard here — it belongs in BosAuthClientModule
]
```

### Tenant Schema Provisioning

`TenantSchemaManager.provisionSchema()` is called once at email verification:
1. `CREATE SCHEMA IF NOT EXISTS "tenant_{hex}"`
2. Apply `TENANT_TEMPLATE_SQL` (from `libs/database/src/sql/tenant-template.ts`) — executed statement-by-statement with `SET LOCAL search_path`
3. Seed roles + permissions via `seedTenantDefaults()`
4. Assign owner `UserBranchMembership` for the founding user

**SQL embedding**: All SQL is embedded as TypeScript string constants (not `readFileSync`) because webpack bundles break `__dirname`-based file reads.

**SQL splitter**: The `splitSqlStatements()` method strips `--` comment lines BEFORE splitting on `;`, otherwise `CREATE TABLE ...` statements after comment lines get eaten.

**Schema name pattern**: `tenant_[a-f0-9]{16,}` strictly enforced. Never interpolate arbitrary strings into DDL.

### 3-Redis Architecture

| Instance | Port | Purpose |
|---|---|---|
| redis-operational | 6379 | JWT revocation, rate limits, sessions, pub/sub |
| redis-queue-transactional | 6380 | BullMQ — mail, notifications, webhooks, AI |
| redis-queue-heavy | 6381 | BullMQ — campaigns, bulk imports |

`QUEUE_CONN_MAP` in `@bos/queue` is the source of truth for which queue uses which Redis connection. BullMQ `@Processor` decorators must use `configKey` from `QUEUE_CONN_MAP`.

### Module Patterns

Every CRM module follows: `Controller → Service → Repository`. Repositories hold all Prisma queries; services hold business logic; controllers are thin.

New tenant-schema tables need:
1. Added to `prisma/tenant-template/schema.prisma`
2. Added to `TENANT_TEMPLATE_SQL` in `libs/database/src/sql/tenant-template.ts`
3. An incremental migration constant in `libs/database/src/sql/` (idempotent, `IF NOT EXISTS` / `ON CONFLICT` guards, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for new enum types)
4. Applied to existing tenants via `POST /dev/run-tenant-migration` (auth-service dev controller)

### Known Gotchas

- **Prisma 7 + schema routing**: `PrismaPg(pool, { schema: schemaName })` is required. Setting `search_path` on `pg.Pool` options has no effect — Prisma generates fully-qualified SQL from the adapter's `schema` option, ignoring connection-level search_path.
- **`CREATE TYPE IF NOT EXISTS` on Windows psql**: Fails in heredoc. Use `DO $$ BEGIN CREATE TYPE...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` instead.
- **Prisma 7 CLI**: Uses `--config` flag (not `--schema`). `datasourceUrl` removed from schema; use `adapter: new PrismaPg({ connectionString })`.
- **`vertical` column**: Nullable (`VerticalType?`). Valid values: `medical`, `law`, `restaurant`, `school`, `gym`.
- **`db:seed:core` after reset**: The `free` TenantPlan row must exist for signup to succeed.
- **`@Public()` routes**: Never receive `req.user` — manual token verification is needed if auth context is required.
