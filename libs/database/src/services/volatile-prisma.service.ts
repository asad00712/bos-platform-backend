import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@bos-prisma/volatile';

/**
 * Prisma client for `bos_volatile` — audit + campaign schemas.
 *
 * Extends the generated PrismaClient. Writes are append-heavy (audit logs,
 * campaign events); reads are aggregation-heavy (analytics). Kept separate
 * from `bos_core` so a flood of audit writes never affects OLTP paths.
 */
@Injectable()
export class VolatilePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly bosLogger = new Logger(VolatilePrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL_VOLATILE'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.bosLogger.log('Connected to bos_volatile');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.bosLogger.log('Disconnected from bos_volatile');
  }

  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
