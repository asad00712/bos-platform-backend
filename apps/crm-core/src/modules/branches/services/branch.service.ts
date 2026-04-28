import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { BranchRepository } from '../repositories/branch.repository';
import type { CreateBranchDto } from '../dto/create-branch.dto';
import type { UpdateBranchDto } from '../dto/update-branch.dto';
import type { BranchDto, BranchListResponseDto } from '../dto/branch.response.dto';

export interface BranchListQuery {
  page:            number;
  limit:           number;
  includeInactive?: boolean;
}

@Injectable()
export class BranchService {
  constructor(
    private readonly repository: BranchRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async listBranches(tenantId: string, query: BranchListQuery): Promise<BranchListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const { data, total } = await this.repository.findAll(schemaName, {
      page: query.page,
      limit: query.limit,
      includeInactive: query.includeInactive,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  // ---------------------------------------------------------------------------
  // Get single
  // ---------------------------------------------------------------------------

  async getBranch(tenantId: string, branchId: string): Promise<BranchDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const branch = await this.repository.findById(schemaName, branchId);
    if (!branch) {
      throw new NotFoundException(`Branch not found`);
    }
    return branch;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async createBranch(tenantId: string, dto: CreateBranchDto): Promise<BranchDto> {
    const schemaName = await this.getSchemaName(tenantId);

    // Code uniqueness check (repo uses @unique but gives a nicer error this way)
    const existing = await this.repository.findByCode(schemaName, dto.code);
    if (existing) {
      throw new ConflictException(`Branch code '${dto.code.toUpperCase()}' is already in use`);
    }

    return this.repository.create(schemaName, dto);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async updateBranch(
    tenantId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<BranchDto> {
    const schemaName = await this.getSchemaName(tenantId);

    const existing = await this.repository.findById(schemaName, branchId);
    if (!existing) {
      throw new NotFoundException(`Branch not found`);
    }

    return this.repository.update(schemaName, branchId, dto);
  }

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  async deactivateBranch(tenantId: string, branchId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);

    const branch = await this.repository.findById(schemaName, branchId);
    if (!branch) {
      throw new NotFoundException(`Branch not found`);
    }

    // Cannot deactivate the head office if it's the last active branch
    if (branch.isHeadOffice) {
      const activeCount = await this.repository.countActive(schemaName);
      if (activeCount <= 1) {
        throw new ConflictException(
          'Cannot deactivate the only remaining branch. Create another branch first.',
        );
      }
    }

    // Warn if branch has active staff — we still allow it but the caller should know
    const staffCount = await this.repository.countStaffInBranch(schemaName, branchId);
    if (staffCount > 0) {
      // We proceed — staff memberships become orphaned but remain in DB.
      // A future "staff.deactivated" event will handle cleanup.
      // Frontend should surface this warning via the 200 response body.
    }

    await this.repository.deactivate(schemaName, branchId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
