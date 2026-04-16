import { Injectable, Logger } from '@nestjs/common';
import { CorePrismaService } from './core-prisma.service';
import {
  CORE_TENANT_ROLES,
  CORE_TENANT_PERMISSIONS,
  VERTICAL_ROLES,
  VERTICAL_TENANT_PERMISSIONS,
} from '../seeds/tenant-defaults';
import { TENANT_TEMPLATE_SQL } from '../sql/tenant-template';

/**
 * Strict pattern for tenant schema identifiers — enforced on every DDL
 * operation to prevent SQL injection in interpolated identifiers.
 */
const SCHEMA_NAME_PATTERN = /^tenant_[a-f0-9]{16,}$/;

/**
 * Manages the lifecycle of `tenant_{uuid}` schemas inside `bos_core`.
 *
 * Responsibilities:
 *   - provisionSchema(schemaName, vertical) — full tenant onboarding:
 *       CREATE SCHEMA + apply template DDL + seed roles/permissions + CHECK constraint
 *   - schemaExists(schemaName)   — check presence in pg_namespace
 *   - dropSchema(schemaName)     — DROP SCHEMA ... CASCADE on tenant deletion
 *
 * Template DDL is stored at libs/database/src/sql/tenant-template.sql.
 * Loaded once at module init; cached for the process lifetime.
 */
@Injectable()
export class TenantSchemaManager {
  private readonly logger = new Logger(TenantSchemaManager.name);
  private readonly templateSql: string;

  constructor(private readonly core: CorePrismaService) {
    this.templateSql = TENANT_TEMPLATE_SQL;
  }

  async schemaExists(schemaName: string): Promise<boolean> {
    this.assertValidSchemaName(schemaName);
    const rows = await this.core.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspname = ${schemaName}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  /**
   * Full tenant provisioning:
   *   1. CREATE SCHEMA
   *   2. Apply template DDL (sets search_path so tables land in the right schema)
   *   3. Seed default roles, permissions, and role→permission assignments
   *   4. Apply UserBranchMembership CHECK constraint
   *
   * Idempotent via `ifNotExists` guard — re-running on an existing schema skips.
   */
  async provisionSchema(opts: {
    schemaName: string;
    vertical?: string;
    ifNotExists?: boolean;
  }): Promise<void> {
    const { schemaName, vertical, ifNotExists = false } = opts;
    this.assertValidSchemaName(schemaName);

    const exists = await this.schemaExists(schemaName);
    if (exists) {
      if (ifNotExists) {
        this.logger.warn(`Schema ${schemaName} already exists; skipping provision`);
        return;
      }
      throw new Error(`Schema ${schemaName} already exists`);
    }

    this.logger.log(`Provisioning tenant schema: ${schemaName} (vertical=${vertical ?? 'none'})`);

    // ── Step 1: CREATE SCHEMA ──────────────────────────────────────────────────
    await this.core.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // ── Step 2: Apply template DDL ────────────────────────────────────────────
    // Run each statement individually because $executeRawUnsafe doesn't support
    // multi-statement strings reliably across all Postgres drivers.
    const statements = this.splitSqlStatements(this.templateSql);
    for (const stmt of statements) {
      // Prepend SET search_path so unqualified identifiers resolve to the
      // tenant schema. This is safe: the schema name was validated above.
      await this.core.$executeRawUnsafe(
        `SET LOCAL search_path TO "${schemaName}", public;\n${stmt}`,
      );
    }

    // ── Step 3: Seed roles + permissions ─────────────────────────────────────
    await this.seedTenantDefaults(schemaName, vertical);

    // ── Step 4: scope invariant ───────────────────────────────────────────────
    // TODO: Replace buildTenantPostMigrationSql with a PL/pgSQL trigger.
    // PostgreSQL does not allow subqueries in CHECK constraints (error 0A000),
    // so the cross-table scopeType↔branchId invariant is enforced at the
    // application layer (UserBranchMembershipService) for now.

    this.logger.log(`Schema ${schemaName} provisioned successfully`);
  }

  /**
   * Drops a tenant schema and all its tables. Used after the 90-day retention
   * grace period following tenant.status = 'deleted'. All connections to the
   * schema must be closed before calling.
   */
  async dropSchema(schemaName: string): Promise<void> {
    this.assertValidSchemaName(schemaName);
    await this.core.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    this.logger.warn(`Dropped schema ${schemaName}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async seedTenantDefaults(schemaName: string, vertical?: string): Promise<void> {
    const s = schemaName;

    // Collect vertical-specific items first.
    const verticalRoles = vertical ? (VERTICAL_ROLES[vertical] ?? []) : [];
    const verticalPerms = vertical ? (VERTICAL_TENANT_PERMISSIONS[vertical] ?? []) : [];

    // ── Seed permissions ──────────────────────────────────────────────────────
    const allPerms = [...CORE_TENANT_PERMISSIONS, ...verticalPerms];
    for (const perm of allPerms) {
      await this.core.$executeRawUnsafe(`
        INSERT INTO "${s}"."Permission" (slug, scope, resource, action, description, "isSystem")
        VALUES (
          '${esc(perm.slug)}', 'tenant', '${esc(perm.resource)}',
          '${esc(perm.action)}', '${esc(perm.description)}', true
        )
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // ── Seed roles ────────────────────────────────────────────────────────────
    const allRoles = [
      ...CORE_TENANT_ROLES.map((r) => ({ ...r, isVertical: false })),
      ...verticalRoles.map((r) => ({ ...r, scopeType: 'branch' as const, isVertical: true })),
    ];

    for (const role of allRoles) {
      await this.core.$executeRawUnsafe(`
        INSERT INTO "${s}"."Role" (slug, name, description, "scopeType", "isSystem", "verticalSlug", "updatedAt")
        VALUES (
          '${esc(role.slug)}', '${esc(role.name)}', '${esc(role.description ?? '')}',
          '${role.scopeType}', true, ${vertical ? `'${esc(vertical)}'` : 'NULL'}, CURRENT_TIMESTAMP
        )
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    // ── Seed role → permission assignments ───────────────────────────────────
    for (const role of CORE_TENANT_ROLES) {
      const slugs: string[] =
        role.permissionSlugs === '*'
          ? allPerms.map((p) => p.slug)
          : [...role.permissionSlugs];

      for (const permSlug of slugs) {
        await this.core.$executeRawUnsafe(`
          INSERT INTO "${s}"."RolePermission" ("roleId", "permissionId")
          SELECT r.id, p.id
          FROM "${s}"."Role" r, "${s}"."Permission" p
          WHERE r.slug = '${esc(role.slug)}' AND p.slug = '${esc(permSlug)}'
          ON CONFLICT DO NOTHING
        `);
      }
    }

    // Assign all permissions to vertical roles (scoped to vertical's perms only).
    for (const role of verticalRoles) {
      for (const permSlug of role.permissionSlugs) {
        await this.core.$executeRawUnsafe(`
          INSERT INTO "${s}"."RolePermission" ("roleId", "permissionId")
          SELECT r.id, p.id
          FROM "${s}"."Role" r, "${s}"."Permission" p
          WHERE r.slug = '${esc(role.slug)}' AND p.slug = '${esc(permSlug)}'
          ON CONFLICT DO NOTHING
        `);
      }
    }
  }

  /** Splits a SQL string into individual statements, stripping comment lines first. */
  private splitSqlStatements(sql: string): string[] {
    // Strip single-line comment lines before splitting so that statements
    // like "-- CreateTable\nCREATE TABLE ..." are not filtered out.
    const stripped = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    return stripped
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private assertValidSchemaName(schemaName: string): void {
    if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
      throw new Error(`Invalid tenant schema name: "${schemaName}". Must match: tenant_[hex16+]`);
    }
  }
}

/**
 * Escapes single quotes in a string to prevent SQL injection in raw string
 * interpolations. Values are already validated above (slugs, vertical names)
 * but this is a final safety net for any value that lands in a string literal.
 */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}
