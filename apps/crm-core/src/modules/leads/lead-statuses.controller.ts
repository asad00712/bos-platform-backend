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
import { LeadStatusService } from './services/lead-status.service';
import { CreateLeadStatusDto } from './dto/create-lead-status.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import type { LeadStatusDto, LeadStatusListDto } from './dto/lead.response.dto';

@ApiTags('Lead Statuses')
@ApiBearerAuth('bearer')
@Controller('lead-statuses')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class LeadStatusesController {
  constructor(private readonly service: LeadStatusService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List lead status configs for a branch' })
  @ApiQuery({ name: 'branchId', required: false })
  listStatuses(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('branchId') branchId?: string,
  ): Promise<LeadStatusListDto> {
    return this.service.listStatuses(user.tenantId, branchId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:sources:manage')
  @ApiOperation({ summary: 'Create a lead status' })
  createStatus(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateLeadStatusDto,
  ): Promise<LeadStatusDto> {
    return this.service.createStatus(user.tenantId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('tenant:sources:manage')
  @ApiOperation({ summary: 'Update a lead status' })
  updateStatus(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
  ): Promise<LeadStatusDto> {
    return this.service.updateStatus(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tenant:sources:manage')
  @ApiOperation({ summary: 'Delete a lead status (sets statusId to null on linked leads)' })
  async deleteStatus(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.deleteStatus(user.tenantId, id);
  }
}
