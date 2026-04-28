import {
  Body, Controller, Get, HttpCode, Put, Query,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser, RequirePermission, TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { LeadAssignmentConfigService } from './services/lead-assignment-config.service';
import { UpsertLeadAssignmentConfigDto, LeadAssignmentConfigResponseDto } from './dto/lead-assignment.dto';

@ApiTags('Lead Assignment')
@ApiBearerAuth('bearer')
@Controller('lead-assignment-config')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class LeadAssignmentController {
  constructor(private readonly service: LeadAssignmentConfigService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get lead assignment config for a branch' })
  @ApiQuery({ name: 'branchId', required: true })
  getConfig(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<LeadAssignmentConfigResponseDto | null> {
    return this.service.getConfig(user.tenantId, branchId);
  }

  @Put()
  @HttpCode(200)
  @RequirePermission('tenant:leads:configure')
  @ApiOperation({ summary: 'Create or update lead assignment config for a branch' })
  upsertConfig(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: UpsertLeadAssignmentConfigDto,
  ): Promise<LeadAssignmentConfigResponseDto> {
    return this.service.upsertConfig(user.tenantId, dto);
  }
}
