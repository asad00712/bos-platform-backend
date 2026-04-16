import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { CorePrismaService } from './services/core-prisma.service';
import { VolatilePrismaService } from './services/volatile-prisma.service';
import { TenantPrismaService } from './services/tenant-prisma.service';
import { TenantSchemaManager } from './services/tenant-schema-manager.service';
import { DatabaseHealthIndicator } from './health/database.health';

export interface BosDatabaseModuleOptions {
  /** Connect to bos_core (public schema). Most services need this. */
  enableCore?: boolean;
  /** Enable per-request tenant-scoped Prisma client (requires enableCore). */
  enableTenant?: boolean;
  /** Connect to bos_volatile (audit + campaign schemas). */
  enableVolatile?: boolean;
}

@Global()
@Module({})
export class BosDatabaseModule {
  static forRoot(options: BosDatabaseModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [DatabaseHealthIndicator];
    const exports: Provider[] = [DatabaseHealthIndicator];

    if (options.enableTenant && !options.enableCore) {
      throw new Error('enableTenant requires enableCore (tenant schemas live inside bos_core)');
    }

    if (options.enableCore) {
      providers.push(CorePrismaService);
      exports.push(CorePrismaService);
    }

    if (options.enableVolatile) {
      providers.push(VolatilePrismaService);
      exports.push(VolatilePrismaService);
    }

    if (options.enableTenant) {
      providers.push(TenantPrismaService, TenantSchemaManager);
      exports.push(TenantPrismaService, TenantSchemaManager);
    }

    return {
      module: BosDatabaseModule,
      imports: [ConfigModule, TerminusModule],
      providers,
      exports,
    };
  }
}
