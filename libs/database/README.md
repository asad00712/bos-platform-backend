# @bos/database

Database access layer for BOS. Owns Prisma clients, schema-per-tenant switching, connection pooling, health indicators, and provisioning workflows.

## Purpose

Every BOS service that touches Postgres goes through this library. It exists to:

1. **Hide DB topology from business code.** Services use typed repositories; they never see raw connections, pool config, or which database a table lives in.
2. **Enforce tenant isolation.** The only way to query tenant data is via `TenantPrismaService`, which automatically scopes to the caller's tenant schema. No bypass paths.
3. **Separate concerns between two Postgres instances.** `bos_core` (permanent, transactional) vs `bos_volatile` (ephemeral, partitioned) are distinct clients — queries never cross.
4. **Standardize health + lifecycle.** Connection readiness, graceful shutdown, and Prisma client lifecycle are managed once, not per service.

## Architecture

```
           ┌───────────────────────────────────────┐
           │       @bos/database (this lib)        │
           └───────────────┬───────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
  │ CorePrisma  │   │ Tenant      │   │ VolatilePrisma│
  │ Service     │   │ PrismaService│  │ Service      │
  │ (public)    │   │ (tenant_xyz) │  │ (audit/camp) │
  └──────┬──────┘   └──────┬───────┘   └──────┬───────┘
         │                 │                  │
         ▼                 ▼                  ▼
   Postgres:bos_core       Postgres:bos_core       Postgres:bos_volatile
   (public schema)    (tenant_{uuid} schemas)      (shared partitioned)
```

### Two Physical Databases

- **`bos_core`** — permanent transactional data. Contains `public` schema (global) + N `tenant_{uuid}` schemas (per-tenant isolation).
- **`bos_volatile`** — ephemeral high-volume data. Contains `audit` and `campaign` schemas with monthly-partitioned tables. Auto-dropped via `pg_partman` (audit at 100 days, campaign at 30 days).

### Three Prisma Clients

Prisma does not support dynamic schema selection natively. We work around this with three distinct clients, each compiled from its own schema file:

1. **`CorePrismaService`** — wraps the Prisma client for `bos_core` `public` schema. Used by Auth Service and tenant registry operations in CRM Core.
2. **`TenantPrismaService`** — request-scoped wrapper that rewrites queries to target the caller's `tenant_{uuid}` schema via a dynamic connection URL (`?schema=tenant_xyz`). Used by every module in CRM Core that touches tenant business data.
3. **`VolatilePrismaService`** — wraps the Prisma client for `bos_volatile`. Used by the `audit` module (writes) and analytics queries (reads for reporting).

### Why Not One Prisma Client Per Tenant

Thousands of tenants × one compiled client each would balloon memory and build time. Instead, we keep a single set of compiled tenant clients and vary the `schema` connection parameter at runtime. Prisma 5+ supports this via per-request client instantiation backed by a connection pool configured to understand schema namespacing.

## Public API

### Modules

- `BosDatabaseModule.forRoot({ enableCore, enableVolatile, enableTenant })` — global module that provides the requested clients. Each service opts in to what it needs.

### Services

- `CorePrismaService extends PrismaClient` — typed client for `bos_core.public`. Injectable everywhere.
- `TenantPrismaService` — request-scoped; resolves tenant schema from request context. Injectable in tenant-scoped controllers/services.
- `VolatilePrismaService extends PrismaClient` — typed client for `bos_volatile`.

### Utilities

- `TenantSchemaManager` — creates, drops, and runs migrations against `tenant_{uuid}` schemas. Used during tenant provisioning and decommissioning.
- `DatabaseHealthIndicator` — `@nestjs/terminus` indicator that checks all active Prisma clients.

### Health Endpoints

Services that import this lib automatically expose DB health via the existing `/health/ready` endpoint. Adds three checks: `db.core`, `db.volatile`, and (if request-scoped) `db.tenant`.

## Events Emitted

None. This lib is infrastructure; it does not participate in the event catalog.

## Events Consumed

None directly. Services invoke it via DI.

## Permissions Defined

None. RBAC enforcement lives in guards/services that consume this lib.

## Database Tables Owned

None owned by this lib. It is the transport for schemas defined in `prisma/`:
- `prisma/core/schema.prisma` — `bos_core.public` global tables
- `prisma/tenant-template/schema.prisma` — template cloned into each `tenant_{uuid}` schema on provisioning
- `prisma/volatile/schema.prisma` — `bos_volatile.audit` and `bos_volatile.campaign` shared tables

## Dependencies

- `@prisma/client` — runtime query engine
- `prisma` — schema compiler (dev-only)
- `@nestjs/common`, `@nestjs/terminus`, `@nestjs/config`
- `@bos/common`, `@bos/errors`, `@bos/logger`

## Security Posture

- **Tenant isolation**: `TenantPrismaService` enforces schema scoping at the connection level. A request in tenant A cannot produce queries against tenant B even with crafted input — the Prisma client is bound to a specific schema for the request lifetime.
- **SQL injection**: All queries go through Prisma's parameterized API. Raw SQL (`$queryRaw`, `$executeRaw`) is allowed only inside `TenantSchemaManager` for DDL and is covered by tests that verify tenant identifiers are validated before interpolation.
- **Credential handling**: Database URLs are loaded from env via `@bos/config` Joi schemas. Never logged, never returned in error messages.
- **Audit**: Schema creation, migration runs, and tenant provisioning emit audit events via the event bus so every DDL action is traceable.

## Known Limitations

- Prisma cannot model cross-schema foreign keys (`tenant.user_branch_memberships.userId → public.users.id`). These are defined at the database level via raw SQL in migrations and enforced at the application layer. Prisma generates warnings; they are suppressed in migration scripts.
- Prisma's `$extends` API does not span different generated clients. Cross-DB joins must be done in application code (fetch IDs from one DB, look up rows in the other).
- Tenant schema migrations must be forward-compatible. Online migrations across thousands of tenants require careful planning (covered in `TenantSchemaManager` docs).

## Usage Examples

```typescript
// In Auth Service (uses only Core)
@Module({
  imports: [BosDatabaseModule.forRoot({ enableCore: true })],
})
export class AppModule {}

// Inject and query
constructor(private readonly corePrisma: CorePrismaService) {}
const user = await this.corePrisma.user.findUnique({ where: { email } });

// In CRM Core (uses Core + Tenant + Volatile for audit)
@Module({
  imports: [
    BosDatabaseModule.forRoot({
      enableCore: true,
      enableTenant: true,
      enableVolatile: true,
    }),
  ],
})
export class AppModule {}

// In a tenant-scoped controller
constructor(private readonly tenantPrisma: TenantPrismaService) {}
@Get('contacts')
async list(@Tenant() tenantId: string) {
  const prisma = this.tenantPrisma.forTenant(tenantId);
  return prisma.contact.findMany();
}
```

## Open Questions / Future Work

- **Read replicas**: Not configured Day-1. Add `read` and `write` variants of `CorePrismaService` when query load warrants it.
- **Connection pooling**: Current plan uses Prisma's built-in pool. When tenant count crosses ~500, evaluate PgBouncer as an external pool.
- **Schema change automation**: Cross-tenant migrations (adding a column to every `tenant_{uuid}.contacts`) need a controlled rollout mechanism. Phase 2.
- **`bos_volatile` tech swap**: If audit/campaign data volume outgrows Postgres, migrate partitioned tables to TimescaleDB or ClickHouse. The lib's public API stays stable; only the underlying client changes.
