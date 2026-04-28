import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Public } from '@bos/auth-client';
import {
  TenantSchemaManager,
  LEAD_ASSIGNMENT_WEBHOOK_MIGRATION_SQL,
  LEAD_ACTIVITIES_MIGRATION_SQL,
  TASKS_MIGRATION_SQL,
} from '@bos/database';
import { EmailVerifyService } from '../auth/services/email-verify.service';

class DevVerifyDto {
  @IsEmail()
  email!: string;
}

class DevRunMigrationDto {
  @IsOptional()
  @IsString()
  key?: string;
}

const MIGRATIONS: Record<string, string> = {
  lead_assignment_webhook: LEAD_ASSIGNMENT_WEBHOOK_MIGRATION_SQL,
  lead_activities:         LEAD_ACTIVITIES_MIGRATION_SQL,
  tasks:                   TASKS_MIGRATION_SQL,
};

/**
 * Development-only endpoints. This controller is registered only when
 * NODE_ENV !== 'production' — see DevModule.
 *
 * Provides shortcuts that bypass email sending so you can test the full
 * auth + tenant provisioning flow without a verified sender domain.
 */
@ApiTags('Dev (non-production only)')
@Controller('dev')
export class DevController {
  constructor(
    private readonly emailVerify: EmailVerifyService,
    private readonly tenantSchemaManager: TenantSchemaManager,
  ) {}

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV] Verify a user by email — no token required' })
  @ApiBody({ type: DevVerifyDto })
  @ApiResponse({ status: 200, description: 'User verified + tenant schema provisioned' })
  @ApiResponse({ status: 400, description: 'User not found or already verified' })
  async devVerifyEmail(
    @Body() dto: DevVerifyDto,
  ): Promise<{ message: string; userId: string; tenantId: string }> {
    const result = await this.emailVerify.bypassVerify(dto.email);
    return {
      message: 'Email verified. You can now log in.',
      userId: result.userId,
      tenantId: result.tenantId,
    };
  }

  @Public()
  @Post('run-tenant-migration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Apply a tenant schema migration to all existing schemas',
    description: `Available keys: ${Object.keys(MIGRATIONS).join(', ')}. Omit key to run the latest migration.`,
  })
  @ApiBody({ type: DevRunMigrationDto })
  @ApiResponse({ status: 200, description: 'Migration result per schema' })
  async runTenantMigration(
    @Body() dto: DevRunMigrationDto,
  ): Promise<{
    succeeded: string[];
    failed: Array<{ schemaName: string; error: string }>;
  }> {
    const key = dto.key ?? 'lead_activities';
    const sql = MIGRATIONS[key];
    if (!sql) {
      throw new BadRequestException(`Unknown migration key "${key}". Available: ${Object.keys(MIGRATIONS).join(', ')}`);
    }
    return this.tenantSchemaManager.applyMigrationToAllTenants(sql);
  }
}
