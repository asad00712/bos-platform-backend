import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  RequirePermission,
  TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { StaffService } from './services/staff.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import type { StaffListResponseDto, StaffMemberDto, PendingInviteDto } from './dto/staff.response.dto';

@ApiTags('Staff')
@ApiBearerAuth('bearer')
@Controller('staff')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ---------------------------------------------------------------------------
  // GET /staff
  // ---------------------------------------------------------------------------

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all staff members (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  listStaff(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ): Promise<StaffListResponseDto> {
    const safeLimit = Math.min(limit, 100);
    return this.staffService.listStaff(user.tenantId, { page, limit: safeLimit });
  }

  // ---------------------------------------------------------------------------
  // GET /staff/invites
  // ---------------------------------------------------------------------------

  @Get('invites')
  @HttpCode(200)
  @RequirePermission('tenant:users:invite')
  @ApiOperation({ summary: 'List pending staff invitations' })
  listPendingInvites(
    @CurrentUser() user: TenantAuthenticatedUser,
  ): Promise<PendingInviteDto[]> {
    return this.staffService.listPendingInvites(user.tenantId);
  }

  // ---------------------------------------------------------------------------
  // GET /staff/:userId
  // ---------------------------------------------------------------------------

  @Get(':userId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a single staff member' })
  getStaffMember(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<StaffMemberDto> {
    return this.staffService.getStaffMember(userId, user.tenantId);
  }

  // ---------------------------------------------------------------------------
  // POST /staff/invite
  // ---------------------------------------------------------------------------

  @Post('invite')
  @HttpCode(204)
  @RequirePermission('tenant:users:invite')
  @ApiOperation({ summary: 'Invite a new staff member' })
  async inviteStaff(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: InviteStaffDto,
  ): Promise<void> {
    await this.staffService.inviteStaff(user.tenantId, user.userId, dto);
  }

  // ---------------------------------------------------------------------------
  // PATCH /staff/:userId/role
  // ---------------------------------------------------------------------------

  @Patch(':userId/role')
  @HttpCode(204)
  @RequirePermission('tenant:users:manage_roles')
  @ApiOperation({ summary: 'Update a staff member role assignment' })
  async updateStaffRole(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateStaffRoleDto,
  ): Promise<void> {
    await this.staffService.updateStaffRole(userId, user.tenantId, user.userId, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /staff/:userId
  // ---------------------------------------------------------------------------

  @Delete(':userId')
  @HttpCode(204)
  @RequirePermission('tenant:users:manage_roles')
  @ApiOperation({ summary: 'Deactivate a staff member' })
  async deactivateStaff(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.staffService.deactivateStaff(userId, user.tenantId, user.userId);
  }

  // ---------------------------------------------------------------------------
  // DELETE /staff/invites/:inviteId
  // ---------------------------------------------------------------------------

  @Delete('invites/:inviteId')
  @HttpCode(204)
  @RequirePermission('tenant:users:invite')
  @ApiOperation({ summary: 'Revoke a pending staff invitation' })
  async revokeInvite(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<void> {
    await this.staffService.revokeInvite(inviteId, user.tenantId);
  }

  // ---------------------------------------------------------------------------
  // PATCH /staff/:userId/round-robin
  // ---------------------------------------------------------------------------

  @Patch(':userId/round-robin')
  @HttpCode(204)
  @RequirePermission('tenant:staff:round_robin')
  @ApiOperation({ summary: 'Toggle round-robin availability for a staff member in a branch' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'available', required: true, type: Boolean })
  async setRoundRobin(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('available', ParseBoolPipe) available: boolean,
  ): Promise<void> {
    await this.staffService.setRoundRobinAvailable(userId, user.tenantId, branchId, available);
  }
}
