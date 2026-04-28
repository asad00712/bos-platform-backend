import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { BranchDto } from '../dto/branch.response.dto';
import type { CreateBranchDto } from '../dto/create-branch.dto';
import type { UpdateBranchDto } from '../dto/update-branch.dto';

export interface BranchListOptions {
  page:         number;
  limit:        number;
  /** When true, include deactivated branches in the result */
  includeInactive?: boolean;
}

@Injectable()
export class BranchRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async findAll(
    schemaName: string,
    options: BranchListOptions,
  ): Promise<{ data: BranchDto[]; total: number }> {
    const { page, limit, includeInactive = false } = options;
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const where = includeInactive ? {} : { isActive: true, deletedAt: null };

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isHeadOffice: 'desc' }, { name: 'asc' }],
        include: {
          childBranches: {
            where: { isActive: true, deletedAt: null },
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.branch.count({ where }),
    ]);

    return { data: branches.map(this.toDto), total };
  }

  // ---------------------------------------------------------------------------
  // Single
  // ---------------------------------------------------------------------------

  async findById(schemaName: string, branchId: string): Promise<BranchDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
      include: {
        childBranches: {
          where: { isActive: true, deletedAt: null },
          select: { id: true, name: true, code: true },
        },
      },
    });
    return branch ? this.toDto(branch) : null;
  }

  async findByCode(schemaName: string, code: string): Promise<BranchDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const branch = await prisma.branch.findUnique({
      where: { code: code.toUpperCase() },
    });
    return branch ? this.toDto(branch) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(schemaName: string, dto: CreateBranchDto): Promise<BranchDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const branch = await prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        postalCode: dto.postalCode,
        phone: dto.phone,
        email: dto.email,
        timezone: dto.timezone ?? 'UTC',
        parentBranchId: dto.parentBranchId,
        isHeadOffice: dto.isHeadOffice ?? false,
        isActive: true,
      },
    });
    return this.toDto(branch);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(
    schemaName: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<BranchDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined)         data.name         = dto.name;
    if (dto.address !== undefined)      data.address      = dto.address;
    if (dto.city !== undefined)         data.city         = dto.city;
    if (dto.state !== undefined)        data.state        = dto.state;
    if (dto.country !== undefined)      data.country      = dto.country;
    if (dto.postalCode !== undefined)   data.postalCode   = dto.postalCode;
    if (dto.phone !== undefined)        data.phone        = dto.phone;
    if (dto.email !== undefined)        data.email        = dto.email;
    if (dto.timezone !== undefined)     data.timezone     = dto.timezone;
    if (dto.parentBranchId !== undefined) data.parentBranchId = dto.parentBranchId;
    if (dto.isHeadOffice !== undefined) data.isHeadOffice = dto.isHeadOffice;

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data,
    });
    return this.toDto(branch);
  }

  // ---------------------------------------------------------------------------
  // Deactivate (soft delete)
  // ---------------------------------------------------------------------------

  async deactivate(schemaName: string, branchId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false, deletedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async countActive(schemaName: string): Promise<number> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    return prisma.branch.count({ where: { isActive: true, deletedAt: null } });
  }

  async countStaffInBranch(schemaName: string, branchId: string): Promise<number> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    return prisma.userBranchMembership.count({
      where: { branchId, revokedAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Private mapper
  // ---------------------------------------------------------------------------

  private toDto(branch: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
    parentBranchId: string | null;
    isHeadOffice: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    childBranches?: { id: string; name: string; code: string }[];
  }): BranchDto {
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      country: branch.country,
      postalCode: branch.postalCode,
      phone: branch.phone,
      email: branch.email,
      timezone: branch.timezone,
      parentBranchId: branch.parentBranchId,
      isHeadOffice: branch.isHeadOffice,
      isActive: branch.isActive,
      children: branch.childBranches,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }
}
