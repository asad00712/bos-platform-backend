# BOS Backend

**Business Operating System** — multi-tenant SaaS backend monorepo.

One platform, 100+ industry verticals (Medical, Law, Restaurant, School, Gym, etc.). Replaces CRM + ERP + HRM + Billing + Scheduling + Communication in a single localized system per industry.

## Tech Stack

- **Runtime:** Node.js 22+
- **Framework:** NestJS v11
- **Language:** TypeScript 5+
- **ORM:** Prisma
- **Database:** PostgreSQL (schema-per-tenant for Core; shared + RLS for the rest)
- **Cache / Queue / Events:** Redis (BullMQ + Streams + Pub/Sub)
- **Package Manager:** pnpm 10+

## Architecture


8 microservices in a NestJS monorepo, communicating via Redis (BullMQ for jobs, Streams for broadcast events, Pub/Sub for realtime).

```
apps/
├── auth-service/
├── crm-core/
├── campaign-service/
├── communication-service/
├── file-service/
├── audit-service/
├── notification-service/
└── webhook-service/

libs/
├── common/         # shared types, DTOs, constants
├── config/         # env loading + validation
├── security/       # helmet, CORS, throttler, validation
├── auth-client/    # JWT validation shared lib
├── database/       # Prisma clients (4 DBs)
├── events/         # CloudEvents envelope + pub/sub
├── queue/          # BullMQ wrappers
├── redis/          # Redis client factory
├── logger/         # Pino wrapper with correlationId
├── health/         # health check module
├── errors/         # custom exception classes
└── testing/        # test fixtures + helpers
```

4 PostgreSQL databases: Core (schema-per-tenant), Activity Logs, Campaign, Communication.

See `memory/` for full architecture documentation.

## Local Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop
- PostgreSQL 16+ (local install)
- Git

### First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file (dev defaults already set)
cp .env.example .env

# 3. Start Redis + Redis Insight (port :5540) via Docker
pnpm docker:dev:up

# 4. Create 2 PostgreSQL databases + required extensions (one-time)
#    Run via psql or pgAdmin:
psql -U postgres -c "CREATE DATABASE bos_core;"
psql -U postgres -c "CREATE DATABASE bos_volatile;"
psql -U postgres -d bos_core -c "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -U postgres -d bos_volatile -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 5. Run migrations
pnpm db:migrate:core:dev        # creates public schema tables in bos_core
pnpm db:migrate:volatile:dev    # creates audit + campaign schemas in bos_volatile

# 6. Seed platform roles + permissions + tenant plans
pnpm db:seed:core

# 7. Generate JWT key pair (for auth service)
mkdir -p keys
openssl genrsa -out keys/jwt-private.pem 2048
openssl rsa -in keys/jwt-private.pem -pubout -out keys/jwt-public.pem
```

### Everyday commands

```bash
# Docker
pnpm docker:dev:up         # Start Redis + Redis Insight (:5540)
pnpm docker:dev:down       # Stop containers
pnpm docker:dev:logs       # Tail logs

# Database
pnpm db:generate           # Regenerate all 3 Prisma clients
pnpm db:format             # Format all Prisma schemas
pnpm db:migrate:core:dev   # Create + apply bos_core migration
pnpm db:migrate:volatile:dev
pnpm db:studio:core        # Open Prisma Studio for bos_core
pnpm db:studio:volatile
pnpm db:seed:core          # Seed platform roles/permissions/plans (idempotent)
pnpm db:reset:core         # Drop + recreate + migrate bos_core (destroys data)

# Code
pnpm lint                  # Lint all code
pnpm format                # Prettier format
pnpm typecheck             # TypeScript type check
pnpm test                  # Run all tests

# Services (auth only for now)
pnpm start:auth:dev        # Start auth-service with watch
```

### Database Layout

Two Postgres databases:

| DB | Contents | Retention |
|---|---|---|
| `bos_core` | `public` schema (global: tenants, users, sessions, RBAC) + `tenant_{uuid}` schemas per tenant (business data) | Permanent |
| `bos_volatile` | `audit` schema (audit_logs) + `campaign` schema (recipients, events) | 100 / 30 days (Phase 2 partitioning) |

Prisma uses three generated clients matching this layout:
- `@bos-prisma/core` — connects to `bos_core.public` (global)
- `@bos-prisma/tenant` — connects to `bos_core.tenant_{uuid}` (dynamic schema per request)
- `@bos-prisma/volatile` — connects to `bos_volatile`

## Project Status

**Current phase:** Implementation (Auth + RBAC). CRM and other modules still in planning.

See `memory/` directory for detailed architecture, service decomposition, auth flow, RBAC model, and event catalog.

## License

UNLICENSED — Proprietary.
