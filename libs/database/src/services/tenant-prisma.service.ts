import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { LRUCache } from 'lru-cache';
import { PrismaClient } from '@bos-prisma/tenant';

/**
 * Strict validator for tenant schema names — prevents SQL injection in the
 * raw connection string. Allowed form: `tenant_` + 16 or more lowercase
 * hex chars. Anything else is rejected.
 */
const SCHEMA_NAME_PATTERN = /^tenant_[a-f0-9]{16,}$/;

export interface TenantClientCacheOptions {
  /** Maximum number of tenant clients to keep in memory. Default 200. */
  maxClients?: number;
  /** Idle TTL before a client is evicted (ms). Default 10 minutes. */
  idleTtlMs?: number;
}

/**
 * Provides per-tenant Prisma clients bound to `tenant_{uuid}` schemas
 * within `bos_core`. Clients are cached with a bounded LRU so thousands
 * of tenants do not balloon memory; idle clients are disposed on eviction.
 *
 * Never used for shared/platform data — that goes through CorePrismaService.
 *
 * Usage:
 *   const prisma = tenantPrisma.forSchema('tenant_a1b2c3d4e5f6a1b2');
 *   const branches = await prisma.branch.findMany();
 */
@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);
  private readonly cache: LRUCache<string, PrismaClient>;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('DATABASE_URL_CORE');
    this.cache = new LRUCache({
      max: 200,
      ttl: 10 * 60 * 1000,
      updateAgeOnGet: true,
      dispose: (client, key) => {
        this.logger.debug(`Evicting tenant client: ${key}`);
        void client.$disconnect().catch((err: unknown) => {
          this.logger.error(`Failed to disconnect ${key}`, err);
        });
      },
    });
  }

  /**
   * Returns a Prisma client bound to the given tenant schema. Reuses a
   * cached instance when available. Throws when `schemaName` does not
   * match the strict pattern.
   */
  forSchema(schemaName: string): PrismaClient {
    if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
      throw new Error(`Invalid tenant schema name: ${schemaName}`);
    }

    const existing = this.cache.get(schemaName);
    if (existing) {
      return existing;
    }

    const client = this.buildClient(schemaName);
    this.cache.set(schemaName, client);
    return client;
  }

  private buildClient(schemaName: string): PrismaClient {
    const url = this.withSchema(this.baseUrl, schemaName);
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  private withSchema(url: string, schemaName: string): string {
    const u = new URL(url);
    u.searchParams.set('schema', schemaName);
    return u.toString();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`Disconnecting ${this.cache.size} cached tenant clients`);
    const disconnects = [...this.cache.values()].map((client) =>
      client.$disconnect().catch(() => undefined),
    );
    await Promise.all(disconnects);
    this.cache.clear();
  }
}
