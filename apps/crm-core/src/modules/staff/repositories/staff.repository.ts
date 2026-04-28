import { Injectable } from '@nestjs/common';
import { CorePrismaService, TenantPrismaService } from '@bos/database';
import { SessionEndReason } from '@bos/common';
import type {
  StaffMemberDto,
  StaffRoleAssignmentDto,
  PendingInviteDto,
} from '../dto/staff.response.dto';

export interface CreateInviteParams {
  email:          string;
  firstName?:     string;
  lastName?:      string;
  tenantId:       string;
  roleId:         string;
  branchId?:      string;
  invitedByUserId: string;
  tokenHash:      string;
  expiresAt:      Date;
}

export interface StaffListOptions {
  schemaName: string;
  page:       number;
  limit:      number;
}

/**
 * Data-access layer for the Staff Module.
 *
 * Staff data spans two sources:
 *   - Core DB (bos_core.public):
 *       User, TenantMembership, UserInvite
 *   - Tenant DB (tenant_{uuid} schema):
 *       UserBranchMembership, Role, Branch
 *
 * Application-layer joins are used since cross-schema foreign keys are soft
 * references (no FK constraint).
 */
@Injectable()
export class StaffRepository {
  constructor(
    private readonly corePrisma: CorePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    options: StaffListOptions,
  ): Promise<{ data: StaffMemberDto[]; total: number }> {
    const { schemaName, page, limit } = options;
    const skip = (page - 1) * limit;

    // 1. All memberships for the tenant (excluding 'left')
    const [memberships, total] = await Promise.all([
      this.corePrisma.tenantMembership.findMany({
        where: { tenantId, status: { not: 'left' } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              phone: true,
            },
          },
        },
      }),
      this.corePrisma.tenantMembership.count({
        where: { tenantId, status: { not: 'left' } },
      }),
    ]);

    if (memberships.length === 0) {
      return { data: [], total };
    }

    // 2. Fetch role assignments from tenant schema
    const userIds = memberships.map((m) => m.userId);
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const roleAssignments = await prisma.userBranchMembership.findMany({
      where: { userId: { in: userIds }, revokedAt: null },
      include: {
        role: { select: { id: true, slug: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Index by userId
    const rolesByUserId = new Map<string, StaffRoleAssignmentDto[]>();
    for (const ra of roleAssignments) {
      const entry: StaffRoleAssignmentDto = {
        membershipId: ra.id,
        roleId: ra.role.id,
        roleSlug: ra.role.slug,
        roleName: ra.role.name,
        branchId: ra.branch?.id ?? null,
        branchName: ra.branch?.name ?? null,
        assignedAt: ra.assignedAt,
      };
      const existing = rolesByUserId.get(ra.userId) ?? [];
      existing.push(entry);
      rolesByUserId.set(ra.userId, existing);
    }

    const data: StaffMemberDto[] = memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      phone: m.user.phone,
      membershipStatus: m.status,
      joinedAt: m.joinedAt,
      roles: rolesByUserId.get(m.userId) ?? [],
    }));

    return { data, total };
  }

  // ---------------------------------------------------------------------------
  // Single member
  // ---------------------------------------------------------------------------

  async findById(
    userId: string,
    tenantId: string,
    schemaName: string,
  ): Promise<StaffMemberDto | null> {
    const membership = await this.corePrisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phone: true,
          },
        },
      },
    });
    if (!membership || membership.status === 'left') {
      return null;
    }

    const prisma = this.tenantPrisma.forSchema(schemaName);
    const roleAssignments = await prisma.userBranchMembership.findMany({
      where: { userId, revokedAt: null },
      include: {
        role: { select: { id: true, slug: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return {
      userId: membership.user.id,
      email: membership.user.email,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      avatarUrl: membership.user.avatarUrl,
      phone: membership.user.phone,
      membershipStatus: membership.status,
      joinedAt: membership.joinedAt,
      roles: roleAssignments.map((ra) => ({
        membershipId: ra.id,
        roleId: ra.role.id,
        roleSlug: ra.role.slug,
        roleName: ra.role.name,
        branchId: ra.branch?.id ?? null,
        branchName: ra.branch?.name ?? null,
        assignedAt: ra.assignedAt,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Invite CRUD
  // ---------------------------------------------------------------------------

  async findPendingInvites(tenantId: string): Promise<PendingInviteDto[]> {
    const invites = await this.corePrisma.userInvite.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((inv) => ({
      inviteId: inv.id,
      email: inv.email,
      firstName: inv.user.firstName,
      lastName: inv.user.lastName,
      roleId: inv.roleId,
      branchId: inv.branchId,
      invitedByUserId: inv.invitedByUserId,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  async createInvite(params: CreateInviteParams): Promise<string> {
    const {
      email,
      firstName,
      lastName,
      tenantId,
      roleId,
      branchId,
      invitedByUserId,
      tokenHash,
      expiresAt,
    } = params;

    const invite = await this.corePrisma.$transaction(async (tx) => {
      // Upsert user — if they already exist, we don't overwrite their data
      const user = await tx.user.upsert({
        where: { email },
        create: {
          email,
          firstName,
          lastName,
          status: 'invited',
          emailVerified: false,
        },
        update: {},
        select: { id: true, status: true },
      });

      // Upsert TenantMembership — idempotent if already invited
      await tx.tenantMembership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        create: {
          userId: user.id,
          tenantId,
          status: 'invited',
        },
        update: {},
      });

      // Create the invite record
      return tx.userInvite.create({
        data: {
          tokenHash,
          userId: user.id,
          tenantId,
          invitedByUserId,
          roleId,
          branchId,
          email,
          expiresAt,
        },
        select: { id: true },
      });
    });

    return invite.id;
  }

  async revokeInvite(inviteId: string, tenantId: string): Promise<boolean> {
    const updated = await this.corePrisma.userInvite.updateMany({
      where: {
        id: inviteId,
        tenantId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return updated.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Role assignment
  // ---------------------------------------------------------------------------

  /**
   * Replaces a staff member's role assignment for the given branchId
   * (or tenant-wide if branchId is null). Revokes the old assignment and
   * creates the new one in a single tenant-schema transaction.
   */
  async updateRoleAssignment(
    userId: string,
    schemaName: string,
    assignedByUserId: string,
    newRoleId: string,
    branchId: string | undefined,
  ): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.$transaction(async (tx) => {
      // Preserve roundRobinAvailable from the current active assignment
      const existing = await tx.userBranchMembership.findFirst({
        where: { userId, branchId: branchId ?? null, revokedAt: null },
        select: { roundRobinAvailable: true },
      });
      const roundRobinAvailable = existing?.roundRobinAvailable ?? true;

      // Revoke any existing active assignment at this branch scope
      await tx.userBranchMembership.updateMany({
        where: { userId, branchId: branchId ?? null, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'role_updated' },
      });

      // Create the new assignment, carrying over the availability flag
      await tx.userBranchMembership.create({
        data: {
          userId,
          branchId: branchId ?? null,
          roleId: newRoleId,
          assignedByUserId,
          roundRobinAvailable,
        },
      });
    });
  }

  async setRoundRobinAvailable(
    userId: string,
    schemaName: string,
    branchId: string,
    available: boolean,
  ): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.userBranchMembership.updateMany({
      where: { userId, branchId, revokedAt: null },
      data: { roundRobinAvailable: available },
    });
  }

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  /**
   * Suspends a staff member's tenant membership, revokes all their active role
   * assignments in the tenant schema, and terminates all active sessions for
   * this tenant so they are force-logged-out immediately.
   *
   * Access tokens already in flight will expire naturally within ≤15 min
   * (same trade-off as logoutAll — bulk JTI revocation requires a stored list).
   */
  async deactivateStaff(
    userId: string,
    tenantId: string,
    schemaName: string,
    deactivatedByUserId: string,
  ): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);

    // Collect active tenant session IDs first so we can revoke their refresh tokens.
    const activeSessions = await this.corePrisma.session.findMany({
      where: { userId, tenantId, endedAt: null },
      select: { id: true },
    });
    const sessionIds = activeSessions.map((s) => s.id);

    const ops: Promise<unknown>[] = [
      // Suspend the core-DB membership
      this.corePrisma.tenantMembership.updateMany({
        where: { userId, tenantId, status: 'active' },
        data: { status: 'suspended' },
      }),
      // Revoke all active role assignments in the tenant schema
      prisma.userBranchMembership.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: `deactivated_by:${deactivatedByUserId}`,
        },
      }),
      // Terminate all active tenant sessions
      this.corePrisma.session.updateMany({
        where: { userId, tenantId, endedAt: null },
        data: { endedAt: new Date(), endReason: SessionEndReason.REVOKED_BY_ADMIN },
      }),
    ];

    // Revoke refresh tokens belonging to those sessions (if any exist)
    if (sessionIds.length > 0) {
      ops.push(
        this.corePrisma.refreshToken.updateMany({
          where: { sessionId: { in: sessionIds }, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'staff_deactivated' },
        }),
      );
    }

    await Promise.all(ops);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async getTenantSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }

  async isOwner(userId: string, schemaName: string): Promise<boolean> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const ownerAssignment = await prisma.userBranchMembership.findFirst({
      where: {
        userId,
        revokedAt: null,
        role: { slug: 'owner' },
      },
    });
    return ownerAssignment !== null;
  }
}
