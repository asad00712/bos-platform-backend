import { Injectable, Optional } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { CorePrismaService } from '../services/core-prisma.service';
import { VolatilePrismaService } from '../services/volatile-prisma.service';

/**
 * Terminus health indicator covering the active Prisma clients.
 * Skips checks for clients that aren't enabled in the host service.
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly indicatorService: HealthIndicatorService,
    @Optional() private readonly core?: CorePrismaService,
    @Optional() private readonly volatileSvc?: VolatilePrismaService,
  ) {}

  async checkCore(key = 'db.core'): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check(key);
    if (!this.core) {
      return indicator.up({ enabled: false });
    }
    const ok = await this.core.ping();
    return ok ? indicator.up() : indicator.down();
  }

  async checkVolatile(key = 'db.volatile'): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check(key);
    if (!this.volatileSvc) {
      return indicator.up({ enabled: false });
    }
    const ok = await this.volatileSvc.ping();
    return ok ? indicator.up() : indicator.down();
  }
}
