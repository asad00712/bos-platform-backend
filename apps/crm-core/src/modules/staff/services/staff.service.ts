import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'node:crypto';
import {
  QUEUE_NAMES,
  MAIL_JOB_NAMES,
  EmailTemplateId,
  type SendEmailJobPayload,
  type StaffInviteTemplateData,
} from '@bos/queue';
import { CorePrismaService } from '@bos/database';
import {
  CannotRemoveLastOwnerException,
  RoleNotFoundException,
} from '@bos/errors';
import { TenantPrismaService } from '@bos/database';
import { InviteStaffDto } from '../dto/invite-staff.dto';
import { UpdateStaffRoleDto } from '../dto/update-staff-role.dto';
import { StaffRepository } from '../repositories/staff.repository';
import type { StaffListResponseDto, StaffMemberDto, PendingInviteDto } from '../dto/staff.response.dto';

const INVITE_TTL_HOURS = 48;

export interface StaffListQuery {
  page:  number;
  limit: number;
}

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly repository: StaffRepository,
    private readonly corePrisma: CorePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // List staff
  // ---------------------------------------------------------------------------

  async listStaff(tenantId: string, query: StaffListQuery): Promise<StaffListResponseDto> {
    const { page, limit } = query;
    const schemaName = await this.repository.getTenantSchemaName(tenantId);
    const { data, total } = await this.repository.findAll(tenantId, {
      schemaName,
      page,
      limit,
    });
    return { data, total, page, limit };
  }

  // ---------------------------------------------------------------------------
  // Get single staff member
  // ---------------------------------------------------------------------------

  async getStaffMember(userId: string, tenantId: string): Promise<StaffMemberDto> {
    const schemaName = await this.repository.getTenantSchemaName(tenantId);
    const member = await this.repository.findById(userId, tenantId, schemaName);
    if (!member) {
      throw new NotFoundException(`Staff member not found`);
    }
    return member;
  }

  // ---------------------------------------------------------------------------
  // Invite staff
  // ---------------------------------------------------------------------------

  async inviteStaff(
    tenantId: string,
    invitedByUserId: string,
    dto: InviteStaffDto,
  ): Promise<void> {
    // Validate role exists in tenant schema
    const schemaName = await this.repository.getTenantSchemaName(tenantId);
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const role = await prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { id: true, name: true },
    });
    if (!role) {
      throw new RoleNotFoundException();
    }

    // Guard: check for an existing active membership
    const existingUser = await this.corePrisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existingUser) {
      const existingMembership = await this.corePrisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: existingUser.id, tenantId } },
        select: { status: true },
      });
      if (existingMembership?.status === 'active') {
        throw new ConflictException(`${dto.email} is already an active staff member`);
      }
    }

    // Get tenant details for the invite email
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true },
    });
    const inviter = await this.corePrisma.user.findUniqueOrThrow({
      where: { id: invitedByUserId },
      select: { firstName: true, lastName: true, email: true },
    });

    // Generate a cryptographically secure invite token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    await this.repository.createInvite({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      tenantId,
      roleId: dto.roleId,
      branchId: dto.branchId,
      invitedByUserId,
      tokenHash,
      expiresAt,
    });

    // Queue the invite email
    const frontendUrl = this.config.get<string>('APP_FRONTEND_URL') ?? 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite/accept?token=${rawToken}`;
    const inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email;

    const payload: SendEmailJobPayload = {
      tenantId,
      recipientEmail: dto.email,
      subject: `You've been invited to join ${tenant.name} on BOS`,
      templateId: EmailTemplateId.STAFF_INVITE,
      templateData: {
        firstName: dto.firstName ?? dto.email.split('@')[0],
        inviterName,
        orgName: tenant.name,
        inviteUrl,
        expiresHours: INVITE_TTL_HOURS,
      } satisfies StaffInviteTemplateData,
      triggeredByUserId: invitedByUserId,
      correlationId: null,
    };

    await this.mailQueue.add(MAIL_JOB_NAMES.SEND_EMAIL, payload);
    this.logger.log(`Staff invite queued for ${dto.email} to tenant ${tenantId}`);
  }

  // ---------------------------------------------------------------------------
  // Update role
  // ---------------------------------------------------------------------------

  async updateStaffRole(
    targetUserId: string,
    tenantId: string,
    assignedByUserId: string,
    dto: UpdateStaffRoleDto,
  ): Promise<void> {
    const schemaName = await this.repository.getTenantSchemaName(tenantId);

    // Validate role exists
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const role = await prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { id: true },
    });
    if (!role) {
      throw new RoleNotFoundException();
    }

    // Guard: cannot demote the last owner
    const isTargetOwner = await this.repository.isOwner(targetUserId, schemaName);
    if (isTargetOwner) {
      const ownerCount = await prisma.userBranchMembership.count({
        where: { revokedAt: null, role: { slug: 'owner' } },
      });
      if (ownerCount <= 1) {
        throw new CannotRemoveLastOwnerException();
      }
    }

    await this.repository.updateRoleAssignment(
      targetUserId,
      schemaName,
      assignedByUserId,
      dto.roleId,
      dto.branchId,
    );
  }

  // ---------------------------------------------------------------------------
  // Deactivate staff
  // ---------------------------------------------------------------------------

  async deactivateStaff(
    targetUserId: string,
    tenantId: string,
    deactivatedByUserId: string,
  ): Promise<void> {
    const schemaName = await this.repository.getTenantSchemaName(tenantId);

    // Guard: cannot deactivate the last owner
    const isTargetOwner = await this.repository.isOwner(targetUserId, schemaName);
    if (isTargetOwner) {
      const prisma = this.tenantPrisma.forSchema(schemaName);
      const ownerCount = await prisma.userBranchMembership.count({
        where: { revokedAt: null, role: { slug: 'owner' } },
      });
      if (ownerCount <= 1) {
        throw new CannotRemoveLastOwnerException();
      }
    }

    await this.repository.deactivateStaff(
      targetUserId,
      tenantId,
      schemaName,
      deactivatedByUserId,
    );
  }

  // ---------------------------------------------------------------------------
  // Pending invites
  // ---------------------------------------------------------------------------

  async listPendingInvites(tenantId: string): Promise<PendingInviteDto[]> {
    return this.repository.findPendingInvites(tenantId);
  }

  async revokeInvite(inviteId: string, tenantId: string): Promise<void> {
    const revoked = await this.repository.revokeInvite(inviteId, tenantId);
    if (!revoked) {
      throw new NotFoundException(`Invite not found or already accepted/revoked`);
    }
  }

  // ---------------------------------------------------------------------------
  // Round-robin availability
  // ---------------------------------------------------------------------------

  async setRoundRobinAvailable(
    targetUserId: string,
    tenantId: string,
    branchId: string,
    available: boolean,
  ): Promise<void> {
    const schemaName = await this.repository.getTenantSchemaName(tenantId);
    await this.repository.setRoundRobinAvailable(targetUserId, schemaName, branchId, available);
  }
}
