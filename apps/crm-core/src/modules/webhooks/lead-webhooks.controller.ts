import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser, RequirePermission, TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { LeadWebhookService } from './services/lead-webhook.service';
import { CreateLeadWebhookDto, UpdateLeadWebhookDto, LeadWebhookResponseDto } from './dto/lead-webhook.dto';

@ApiTags('Lead Webhooks')
@ApiBearerAuth('bearer')
@Controller('lead-webhooks')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class LeadWebhooksController {
  constructor(private readonly service: LeadWebhookService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('tenant:leads:configure')
  @ApiOperation({ summary: 'List lead webhooks' })
  @ApiQuery({ name: 'branchId', required: false })
  listWebhooks(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('branchId') branchId?: string,
  ): Promise<LeadWebhookResponseDto[]> {
    return this.service.listWebhooks(user.tenantId, branchId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:leads:configure')
  @ApiOperation({ summary: 'Create a webhook (token auto-generated)' })
  createWebhook(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateLeadWebhookDto,
  ): Promise<LeadWebhookResponseDto> {
    return this.service.createWebhook(user.tenantId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:leads:configure')
  @ApiOperation({ summary: 'Update webhook name, sourceId, or active flag' })
  updateWebhook(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadWebhookDto,
  ): Promise<LeadWebhookResponseDto> {
    return this.service.updateWebhook(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:leads:configure')
  @ApiOperation({ summary: 'Delete a webhook and revoke its token' })
  async deleteWebhook(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteWebhook(user.tenantId, id);
  }

  @Post(':id/regenerate-token')
  @HttpCode(200)
  @RequirePermission('tenant:leads:configure')
  @ApiOperation({ summary: 'Regenerate webhook token (old token immediately invalidated)' })
  regenerateToken(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeadWebhookResponseDto> {
    return this.service.regenerateToken(user.tenantId, id);
  }
}
