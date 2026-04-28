import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser, RequirePermission, TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { LeadActivityService } from '../services/lead-activity.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';
import { ActivityQueryDto, MyTasksQueryDto } from '../dto/activity-query.dto';
import type {
  LeadActivityDto,
  LeadActivityListResponseDto,
  LeadActivitySummaryDto,
} from '../dto/lead-activity.dto';

@ApiTags('Lead Activities')
@ApiBearerAuth('bearer')
@Controller('leads')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class LeadActivityController {
  constructor(private readonly service: LeadActivityService) {}

  @Post(':leadId/activities')
  @HttpCode(201)
  @RequirePermission('tenant:leads:log_activity')
  @ApiOperation({ summary: 'Log an activity on a lead (note, call, task, email, meeting, SMS)' })
  createActivity(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateActivityDto,
  ): Promise<LeadActivityDto> {
    return this.service.createActivity(user.tenantId, leadId, dto, user.userId);
  }

  @Get(':leadId/activities')
  @HttpCode(200)
  @RequirePermission('tenant:leads:view_branch')
  @ApiOperation({ summary: 'Get lead activity timeline (newest first, paginated)' })
  listActivities(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Query() query: ActivityQueryDto,
  ): Promise<LeadActivityListResponseDto> {
    return this.service.listActivities(user.tenantId, leadId, query);
  }

  @Get(':leadId/activities/summary')
  @HttpCode(200)
  @RequirePermission('tenant:leads:view_branch')
  @ApiOperation({
    summary: 'Get activity summary for a lead',
    description: 'Returns count per activity type, total touchpoints, last activity date, and next follow-up date.',
  })
  getActivitySummary(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ): Promise<LeadActivitySummaryDto> {
    return this.service.getActivitySummary(user.tenantId, leadId);
  }

  @Patch(':leadId/activities/:activityId')
  @HttpCode(200)
  @RequirePermission('tenant:leads:log_activity')
  @ApiOperation({ summary: 'Update a lead activity (e.g. mark task complete, edit notes, add call outcome)' })
  updateActivity(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateActivityDto,
  ): Promise<LeadActivityDto> {
    return this.service.updateActivity(user.tenantId, leadId, activityId, dto);
  }

  @Delete(':leadId/activities/:activityId')
  @HttpCode(204)
  @RequirePermission('tenant:leads:log_activity')
  @ApiOperation({ summary: 'Soft-delete a lead activity' })
  async deleteActivity(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
  ): Promise<void> {
    await this.service.deleteActivity(user.tenantId, leadId, activityId);
  }
}

@ApiTags('Lead Activities')
@ApiBearerAuth('bearer')
@Controller('lead-activities')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class MyTasksController {
  constructor(private readonly service: LeadActivityService) {}

  @Get('tasks')
  @HttpCode(200)
  @RequirePermission('tenant:leads:view_branch')
  @ApiOperation({
    summary: 'Get my upcoming follow-up tasks across all leads',
    description: 'Returns PENDING + IN_PROGRESS tasks assigned to the calling user, ordered by due date ascending.',
  })
  getMyTasks(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query() query: MyTasksQueryDto,
  ): Promise<LeadActivityListResponseDto> {
    return this.service.getMyTasks(user.tenantId, user.userId, query);
  }
}
