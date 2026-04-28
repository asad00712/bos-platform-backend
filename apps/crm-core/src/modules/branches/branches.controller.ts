import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import { BranchService } from './services/branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import type { BranchDto, BranchListResponseDto } from './dto/branch.response.dto';

@ApiTags('Branches')
@ApiBearerAuth('bearer')
@Controller('branches')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class BranchesController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all branches' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  listBranches(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<BranchListResponseDto> {
    return this.branchService.listBranches(user.tenantId, {
      page,
      limit: Math.min(limit, 200),
      includeInactive: includeInactive === 'true',
    });
  }

  @Get(':branchId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a single branch' })
  getBranch(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<BranchDto> {
    return this.branchService.getBranch(user.tenantId, branchId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:branches:manage')
  @ApiOperation({ summary: 'Create a new branch' })
  createBranch(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchDto> {
    return this.branchService.createBranch(user.tenantId, dto);
  }

  @Patch(':branchId')
  @HttpCode(200)
  @RequirePermission('tenant:branches:manage')
  @ApiOperation({ summary: 'Update branch details' })
  updateBranch(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchDto> {
    return this.branchService.updateBranch(user.tenantId, branchId, dto);
  }

  @Delete(':branchId')
  @HttpCode(204)
  @RequirePermission('tenant:branches:manage')
  @ApiOperation({ summary: 'Deactivate a branch (soft delete)' })
  async deactivateBranch(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<void> {
    await this.branchService.deactivateBranch(user.tenantId, branchId);
  }
}
