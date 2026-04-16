import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@bos-prisma/core';

/**
 * Prisma client for `bos_core` `public` schema — global platform data.
 *
 * Extends the generated PrismaClient so business code uses it exactly like
 * any other Prisma client (`corePrisma.user.findUnique(...)` etc.).
 *
 * Connection is via `@prisma/adapter-pg` (the only supported option in
 * Prisma 7 with engine type "client"). `datasourceUrl` is NOT accepted.
 */
@Injectable()
export class CorePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly bosLogger = new Logger(CorePrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL_CORE'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.bosLogger.log('Connected to bos_core');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.bosLogger.log('Disconnected from bos_core');
  }

  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
